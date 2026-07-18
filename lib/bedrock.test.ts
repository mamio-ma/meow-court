import { describe, it, expect, vi, beforeEach } from 'vitest';

// 必须用 factory 形式 mock @aws-sdk——因为 vitest 会 hoist vi.mock 调用
// 到文件顶部，此时任何顶层引用尚未初始化，只能靠 factory 延迟求值。
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn(),
    ConverseStreamCommand: vi.fn(),
  };
});

describe('streamVerdict', () => {
  beforeEach(() => {
    // 每个测试前清 mock + 重置模块缓存，让 dynamic import 拿到刷新后的 bedrock.ts
    vi.clearAllMocks();
    vi.resetModules();
    process.env.AWS_BEARER_TOKEN_BEDROCK = 'test-token';
    process.env.AWS_REGION = 'us-east-1';
    process.env.BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';
  });

  it('parses streamed tool_use JSON and emits section events', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    // 模拟 Bedrock 分段推流 tool_use JSON——真实场景中 delta 可能落在任意位置
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"core_conflict":"芝士战争"' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"responsibility":{"left":70,"right":30}' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"crimes":[{"side":"left","charge":"独食罪","severity":"重罪","reasoning":"x"}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"reconciliation_checklist":[{"id":"1","task":"抱抱","intimacy_points":10}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"cat_closing_line":"退庭 🐾"}' } } } };
      yield { messageStop: {} };
    };
    // 用 function 声明而非箭头函数——vi.fn().mockImplementation 里必须可被 new 调用
    (BedrockRuntimeClient as any).mockImplementation(function () {
      return {
        send: () => Promise.resolve({ stream: mockStream() }),
      };
    });

    const { streamVerdict } = await import('./bedrock');
    const events: any[] = [];
    for await (const ev of streamVerdict('sys', 'user')) {
      events.push(ev);
    }

    const sections = events.filter((e) => e.type === 'section').map((e) => e.section);
    expect(sections).toContain('core_conflict');
    expect(sections).toContain('responsibility');
    expect(sections).toContain('crimes');
    expect(sections).toContain('reconciliation_checklist');
    expect(events.at(-1)?.type).toBe('done');
    expect((events.at(-1) as any)?.verdict.responsibility.left).toBe(70);
  });

  it('throws on invalid final JSON', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"bogus":' } } } };
      yield { messageStop: {} };
    };
    (BedrockRuntimeClient as any).mockImplementation(function () {
      return {
        send: () => Promise.resolve({ stream: mockStream() }),
      };
    });

    const { streamVerdict } = await import('./bedrock');
    await expect(async () => {
      const events: any[] = [];
      for await (const ev of streamVerdict('sys', 'user')) events.push(ev);
    }).rejects.toThrow();
  });

  // 处理 chunk 从字符串值内部切分的情况——防止 partial-json 的中间态被 emit
  it('handles chunks that split mid-string value', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"core_conflict":"芝士战' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: '争"' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"responsibility":{"left":50,"right":50}' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"crimes":[{"side":"left","charge":"x","severity":"重罪","reasoning":"x"}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"reconciliation_checklist":[{"id":"1","task":"抱抱","intimacy_points":10}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"cat_closing_line":"🐾"}' } } } };
      yield { messageStop: {} };
    };
    (BedrockRuntimeClient as any).mockImplementation(function () {
      return { send: () => Promise.resolve({ stream: mockStream() }) };
    });

    const { streamVerdict } = await import('./bedrock');
    const events: any[] = [];
    for await (const ev of streamVerdict('sys', 'user')) events.push(ev);

    const coreEvent = events.find((e) => e.type === 'section' && e.section === 'core_conflict');
    // 关键断言：core_conflict 事件应发出完整"芝士战争"而非中间态"芝士战"
    expect(coreEvent?.content).toBe('芝士战争');
    expect(events.at(-1)?.type).toBe('done');
  });

  // 字符串值内含 `{` `}` `,"` 等字符时，boundary 检测不应误判为闭合
  it('does not confuse brackets inside string values', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"core_conflict":"她说\\"我错了\\", 独食}罪"' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"responsibility":{"left":60,"right":40}' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"crimes":[{"side":"left","charge":"x","severity":"重罪","reasoning":"y"}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"reconciliation_checklist":[{"id":"1","task":"z","intimacy_points":5}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"cat_closing_line":"end"}' } } } };
      yield { messageStop: {} };
    };
    (BedrockRuntimeClient as any).mockImplementation(function () {
      return { send: () => Promise.resolve({ stream: mockStream() }) };
    });

    const { streamVerdict } = await import('./bedrock');
    const events: any[] = [];
    for await (const ev of streamVerdict('sys', 'user')) events.push(ev);

    const coreEvent = events.find((e) => e.type === 'section' && e.section === 'core_conflict');
    expect(coreEvent?.content).toContain('独食}罪');
    expect(events.at(-1)?.type).toBe('done');
  });

  // Bedrock 流中途抛错时，生成器应向上传播，且不发出 done
  it('propagates errors from the underlying stream', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"core_conflict":"x"' } } } };
      throw new Error('bedrock throttled');
    };
    (BedrockRuntimeClient as any).mockImplementation(function () {
      return { send: () => Promise.resolve({ stream: mockStream() }) };
    });

    const { streamVerdict } = await import('./bedrock');
    const events: any[] = [];
    await expect(async () => {
      for await (const ev of streamVerdict('sys', 'user')) events.push(ev);
    }).rejects.toThrow(/bedrock throttled/);
    // 确保没有 done 事件
    expect(events.find((e) => e.type === 'done')).toBeUndefined();
  });
});
