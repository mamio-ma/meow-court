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
    process.env.BEDROCK_MODEL_ID = 'anthropic.claude-sonnet-4-6';
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
});
