import { describe, it, expect, vi, beforeEach } from 'vitest';

// 用内存 Map 模拟 Upstash Redis——避免真调 API
// vitest 4 下 vi.fn().mockImplementation(arrow) 不能被 new 调用，
// 因此这里改用普通 class 声明，行为等价
const fakeStore = new Map<string, any>();
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async get(k: string) {
      return fakeStore.get(k) ?? null;
    }
    async set(k: string, v: any) {
      fakeStore.set(k, v);
      return 'OK';
    }
    async del(k: string) {
      fakeStore.delete(k);
      return 1;
    }
    async exists(k: string) {
      return fakeStore.has(k) ? 1 : 0;
    }
  },
}));

beforeEach(() => {
  fakeStore.clear();
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake';
});

describe('rooms', () => {
  it('creates a room with 6-char code and returns host token', async () => {
    const { createRoom } = await import('./rooms');
    const { code, hostToken } = await createRoom('zh');
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    expect(hostToken).toBeTruthy();
  });

  it('assigns host as left, guest as right', async () => {
    const { createRoom, joinRoom } = await import('./rooms');
    const { code, hostToken } = await createRoom('zh');
    const hostResult = await joinRoom(code, hostToken);
    expect(hostResult?.role).toBe('left');

    const guestToken = 'guest-token-xyz';
    const guest1 = await joinRoom(code, guestToken);
    expect(guest1?.role).toBe('right');

    // 相同 guest token 二次访问角色仍为 right
    const guest2 = await joinRoom(code, guestToken);
    expect(guest2?.role).toBe('right');
  });

  it('submitStatement writes into the correct side', async () => {
    const { createRoom, joinRoom, submitStatement, getRoom } = await import('./rooms');
    const { code, hostToken } = await createRoom('zh');
    await joinRoom(code, hostToken);
    await submitStatement(code, hostToken, {
      name: '甲', narrative: 'x', grievance: 'y',
    });
    const room = await getRoom(code);
    expect(room?.left.name).toBe('甲');
    expect(room?.right.name).toBe('');
  });

  it('returns null for non-existent room', async () => {
    const { getRoom } = await import('./rooms');
    expect(await getRoom('NOROOM')).toBeNull();
  });

  it('acceptVerdict marks the correct side', async () => {
    const { createRoom, joinRoom, acceptVerdict } = await import('./rooms');
    const { code, hostToken } = await createRoom('zh');
    await joinRoom(code, hostToken);
    const updated = await acceptVerdict(code, hostToken);
    expect(updated?.firstVerdictDecisions?.leftAccepted).toBe(true);
    expect(updated?.firstVerdictDecisions?.rightAccepted).toBeUndefined();
  });

  it('checkTask accumulates intimacy score, idempotent', async () => {
    const { createRoom, joinRoom, checkTask } = await import('./rooms');
    const { code, hostToken } = await createRoom('zh');
    await joinRoom(code, hostToken);
    const r1 = await checkTask(code, 'task-a', 10);
    expect(r1?.intimacyScore).toBe(10);
    expect(r1?.completedChecklist).toContain('task-a');

    // 重复勾选不重复加分
    const r2 = await checkTask(code, 'task-a', 10);
    expect(r2?.intimacyScore).toBe(10);
  });
});
