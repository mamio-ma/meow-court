import { Redis } from '@upstash/redis';
import { customAlphabet } from 'nanoid';
import type { Case, PartyStatement, Verdict } from './schema';

// 6 位大写字母数字房间码——去掉 0OIL 避免混淆
const generateCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);

const TTL_SECONDS = 24 * 60 * 60; // 24 小时后 Redis 自动清

// Upstash 客户端 lazy 初始化——避免测试环境无环境变量时崩溃
// 兼容两种命名：UPSTASH_REDIS_REST_*（旧版 / 手动配）
// 或 KV_REST_API_*（新版 Vercel Marketplace Integration 自动注入）
let redisInstance: Redis | null = null;
function redis(): Redis {
  if (!redisInstance) {
    const url =
      process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN ??
      process.env.KV_REST_API_TOKEN;
    redisInstance = new Redis({ url: url!, token: token! });
  }
  return redisInstance;
}

// Room 内部结构——Case 之外还存 token → role 映射，用于 joinRoom 判断哪一侧
type Room = {
  case: Case;
  hostToken: string;
  guestToken?: string;
};

const roomKey = (code: string) => `room:${code}`;

// Redis SET，24h TTL
// Upstash SDK 的 set 重载在 { ex } 选项上 TS 推断偶尔不稳，
// 这里用 as any 兜底——运行时行为正确即可，测试 mock 也接受任意签名
async function persist(code: string, room: Room): Promise<void> {
  await (redis().set as any)(roomKey(code), room, { ex: TTL_SECONDS });
}

// 创建房间——房主 token 分配 left 角色
export async function createRoom(
  language: 'zh' | 'en',
): Promise<{ code: string; hostToken: string }> {
  const code = generateCode();
  const hostToken = crypto.randomUUID();

  const initialCase: Case = {
    id: code,
    language,
    mode: 'remote',
    createdAt: Date.now(),
    left: { name: '', narrative: '', grievance: '' },
    right: { name: '', narrative: '', grievance: '' },
    intimacyScore: 0,
    completedChecklist: [],
  };

  await persist(code, { case: initialCase, hostToken });
  return { code, hostToken };
}

// 加入/访问房间——按 token 决定 role
// 首次访问的非房主 token 自动占位 guest（分配 right）
export async function joinRoom(
  code: string,
  token: string,
): Promise<{ case: Case; role: 'left' | 'right' } | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  let role: 'left' | 'right';
  if (token === room.hostToken) {
    role = 'left';
  } else if (room.guestToken === token) {
    role = 'right';
  } else if (!room.guestToken) {
    room.guestToken = token;
    await persist(code, room);
    role = 'right';
  } else {
    // 已有 guest 占位，第三方观察者也归 right（退化处理，MVP 够用）
    role = 'right';
  }

  return { case: room.case, role };
}

// 获取原始 case（不带 token 校验，服务端内部使用）
export async function getRoom(code: string): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  return room?.case ?? null;
}

// 提交陈述——按 token 确定写入哪一侧
export async function submitStatement(
  code: string,
  token: string,
  statement: PartyStatement,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  const side: 'left' | 'right' = token === room.hostToken ? 'left' : 'right';
  room.case[side] = { ...statement, submittedAt: Date.now() };

  await persist(code, room);
  return room.case;
}

// 写入判决书（服务端在双方都提交陈述后自动触发）
// isAppeal 区分一审 / 终审——一审同时初始化 firstVerdictDecisions 空对象，
// 供后续 acceptVerdict 累加标记
export async function saveVerdict(
  code: string,
  verdict: Verdict,
  isAppeal: boolean,
): Promise<void> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return;

  if (isAppeal) {
    room.case.finalVerdict = verdict;
  } else {
    room.case.firstVerdict = verdict;
    room.case.firstVerdictDecisions = {};
  }

  await persist(code, room);
}

// 接受判决——标记对应一侧的 accepted flag
export async function acceptVerdict(
  code: string,
  token: string,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  const side: 'left' | 'right' = token === room.hostToken ? 'left' : 'right';
  room.case.firstVerdictDecisions = room.case.firstVerdictDecisions ?? {};
  if (side === 'left') {
    room.case.firstVerdictDecisions.leftAccepted = true;
  } else {
    room.case.firstVerdictDecisions.rightAccepted = true;
  }

  await persist(code, room);
  return room.case;
}

// 上诉——立即抢占，即使对方已经接受
export async function submitAppeal(
  code: string,
  token: string,
  supplement: string,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  const side: 'left' | 'right' = token === room.hostToken ? 'left' : 'right';
  room.case.appeal = {
    appellant: side,
    appellantSupplement: supplement,
  };

  await persist(code, room);
  return room.case;
}

// 对方回应上诉
export async function respondToAppeal(
  code: string,
  token: string,
  supplement: string,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room?.case.appeal) return null;

  room.case.appeal.respondentSupplement = supplement;
  room.case.appeal.respondedAt = Date.now();

  await persist(code, room);
  return room.case;
}

// 勾选/完成和解任务——已完成的任务不重复加分（idempotent）
export async function checkTask(
  code: string,
  taskId: string,
  points: number,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  if (!room.case.completedChecklist.includes(taskId)) {
    room.case.completedChecklist.push(taskId);
    room.case.intimacyScore += points;
  }
  await persist(code, room);
  return room.case;
}
