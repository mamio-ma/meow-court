import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  joinRoom,
  submitStatement,
  acceptVerdict,
  submitAppeal,
  respondToAppeal,
  checkTask,
  saveVerdict,
} from '@/lib/rooms';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts';
import { streamVerdict } from '@/lib/llm';
import type { Case } from '@/lib/schema';

export const runtime = 'nodejs';

// mask 对方还没提交的陈述——避免"我还没写完对方就看到"
function maskOpponent(caseData: Case, myRole: 'left' | 'right'): Case {
  const opp: 'left' | 'right' = myRole === 'left' ? 'right' : 'left';
  const oppData = caseData[opp];
  if (oppData.submittedAt) {
    // 已提交——不 mask
    return caseData;
  }
  return {
    ...caseData,
    [opp]: { ...oppData, narrative: '', grievance: '', name: oppData.name || '' },
  };
}

// GET —— 拉当前状态
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const token = req.nextUrl.searchParams.get('token') ?? '';
  try {
    const result = await joinRoom(code, token);
    if (!result) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    const oppRole = result.role === 'left' ? 'right' : 'left';
    return Response.json({
      case: maskOpponent(result.case, result.role),
      myRole: result.role,
      opponentHasSubmitted: !!result.case[oppRole].submittedAt,
    });
  } catch (err) {
    return Response.json(
      { error: 'Remote mode unavailable', details: (err as Error).message },
      { status: 503 },
    );
  }
}

// PATCH —— 各种 action
const PatchBody = z.object({
  token: z.string(),
  action: z.enum([
    'submit_statement',
    'accept_verdict',
    'submit_appeal',
    'respond_to_appeal',
    'check_task',
  ]),
  payload: z.any(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await req.json();
  const parse = PatchBody.safeParse(body);
  if (!parse.success) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const { token, action, payload } = parse.data;

  let updated: Case | null = null;

  try {
    switch (action) {
      case 'submit_statement':
        updated = await submitStatement(code, token, payload);
        // 双方都提交陈述 → 自动触发一审判决生成（后台异步，不阻塞响应）
        if (
          updated?.left.submittedAt &&
          updated?.right.submittedAt &&
          !updated.firstVerdict
        ) {
          void generateVerdictForRoom(code, updated, false);
        }
        break;
      case 'accept_verdict':
        updated = await acceptVerdict(code, token);
        break;
      case 'submit_appeal':
        updated = await submitAppeal(code, token, payload.supplement);
        break;
      case 'respond_to_appeal':
        updated = await respondToAppeal(code, token, payload.supplement);
        // 对方回应后触发二审
        if (updated?.appeal) {
          void generateVerdictForRoom(code, updated, true);
        }
        break;
      case 'check_task':
        updated = await checkTask(code, payload.taskId, payload.points);
        break;
    }
  } catch (err) {
    return Response.json(
      { error: 'Remote mode unavailable', details: (err as Error).message },
      { status: 503 },
    );
  }

  if (!updated) return Response.json({ error: 'Room not found' }, { status: 404 });
  return Response.json({ case: updated });
}

// 后台生成判决——不阻塞 PATCH 响应。生成完成后写回 Redis，
// 客户端下一次轮询 GET 即可看到 firstVerdict / finalVerdict。
async function generateVerdictForRoom(code: string, caseData: Case, isAppeal: boolean) {
  try {
    const sys = buildSystemPrompt(caseData.language);
    const user = buildUserPrompt(caseData, isAppeal);
    let verdict = null;
    for await (const ev of streamVerdict(sys, user)) {
      if (ev.type === 'done') verdict = ev.verdict;
    }
    if (verdict) {
      await saveVerdict(code, verdict, isAppeal);
    }
  } catch (err) {
    // MVP：失败就吞掉；后续可以在 room 里存一个 "verdictError" 字段
    // 让前端展示"本喵犯困了，请轻点重敲法槌"
    console.error('[verdict-gen] failed for room', code, err);
  }
}
