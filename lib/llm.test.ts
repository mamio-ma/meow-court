import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock @anthropic-ai/sdk——factory 形式，vi.mock 会被 hoist 到文件顶部
vi.mock('@anthropic-ai/sdk', () => {
  const Anthropic = vi.fn();
  return { default: Anthropic };
});

// 构造 mock 事件——模拟 Anthropic streaming API 的 content_block_delta
function inputJsonDelta(partialJson: string) {
  return {
    type: 'content_block_delta' as const,
    delta: {
      type: 'input_json_delta' as const,
      partial_json: partialJson,
    },
  };
}

describe('streamVerdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL_ID = 'claude-sonnet-4-5-20250929';
  });

  it('parses streamed tool_use JSON and emits section events', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default;
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield inputJsonDelta('{"core_conflict":"芝士战争"');
        yield inputJsonDelta(',"responsibility":{"left":70,"right":30}');
        yield inputJsonDelta(
          ',"crimes":[{"side":"left","charge":"独食罪","severity":"重罪","reasoning":"x"}]',
        );
        yield inputJsonDelta(
          ',"reconciliation_checklist":[{"id":"1","task":"抱抱","intimacy_points":10}]',
        );
        yield inputJsonDelta(',"cat_closing_line":"退庭 🐾"}');
      },
    };
    (AnthropicMock as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return { messages: { stream: () => mockStream } };
      },
    );

    const { streamVerdict } = await import('./llm');
    const events: unknown[] = [];
    for await (const ev of streamVerdict('sys', 'user')) events.push(ev);

    const sections = events
      .filter(
        (e): e is { type: 'section'; section: string } =>
          (e as { type: string }).type === 'section',
      )
      .map((e) => e.section);
    expect(sections).toContain('core_conflict');
    expect(sections).toContain('responsibility');
    expect(sections).toContain('crimes');
    expect(sections).toContain('reconciliation_checklist');
    const last = events.at(-1) as {
      type: string;
      verdict?: { responsibility: { left: number } };
    };
    expect(last.type).toBe('done');
    expect(last.verdict?.responsibility.left).toBe(70);
  });

  it('throws on invalid final JSON', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default;
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield inputJsonDelta('{"bogus":');
      },
    };
    (AnthropicMock as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return { messages: { stream: () => mockStream } };
      },
    );

    const { streamVerdict } = await import('./llm');
    await expect(async () => {
      // 消费流以触发最终解析
      for await (const _ev of streamVerdict('sys', 'user')) {
        void _ev;
      }
    }).rejects.toThrow();
  });

  it('handles chunks that split mid-string value', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default;
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield inputJsonDelta('{"core_conflict":"芝士战');
        yield inputJsonDelta('争"');
        yield inputJsonDelta(',"responsibility":{"left":50,"right":50}');
        yield inputJsonDelta(
          ',"crimes":[{"side":"left","charge":"x","severity":"重罪","reasoning":"x"}]',
        );
        yield inputJsonDelta(
          ',"reconciliation_checklist":[{"id":"1","task":"抱抱","intimacy_points":10}]',
        );
        yield inputJsonDelta(',"cat_closing_line":"🐾"}');
      },
    };
    (AnthropicMock as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return { messages: { stream: () => mockStream } };
      },
    );

    const { streamVerdict } = await import('./llm');
    const events: unknown[] = [];
    for await (const ev of streamVerdict('sys', 'user')) events.push(ev);

    const coreEvent = events.find(
      (e): e is { type: 'section'; section: string; content: string } =>
        (e as { type: string }).type === 'section' &&
        (e as { section: string }).section === 'core_conflict',
    );
    expect(coreEvent?.content).toBe('芝士战争');
    expect((events.at(-1) as { type: string }).type).toBe('done');
  });

  it('does not confuse brackets inside string values', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default;
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield inputJsonDelta('{"core_conflict":"她说\\"我错了\\", 独食}罪"');
        yield inputJsonDelta(',"responsibility":{"left":60,"right":40}');
        yield inputJsonDelta(
          ',"crimes":[{"side":"left","charge":"x","severity":"重罪","reasoning":"y"}]',
        );
        yield inputJsonDelta(
          ',"reconciliation_checklist":[{"id":"1","task":"z","intimacy_points":5}]',
        );
        yield inputJsonDelta(',"cat_closing_line":"end"}');
      },
    };
    (AnthropicMock as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return { messages: { stream: () => mockStream } };
      },
    );

    const { streamVerdict } = await import('./llm');
    const events: unknown[] = [];
    for await (const ev of streamVerdict('sys', 'user')) events.push(ev);

    const coreEvent = events.find(
      (e): e is { type: 'section'; section: string; content: string } =>
        (e as { type: string }).type === 'section' &&
        (e as { section: string }).section === 'core_conflict',
    );
    expect(coreEvent?.content).toContain('独食}罪');
    expect((events.at(-1) as { type: string }).type).toBe('done');
  });

  it('propagates errors from the underlying stream', async () => {
    const AnthropicMock = (await import('@anthropic-ai/sdk')).default;
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield inputJsonDelta('{"core_conflict":"x"');
        throw new Error('anthropic api throttled');
      },
    };
    (AnthropicMock as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return { messages: { stream: () => mockStream } };
      },
    );

    const { streamVerdict } = await import('./llm');
    const events: unknown[] = [];
    await expect(async () => {
      for await (const ev of streamVerdict('sys', 'user')) events.push(ev);
    }).rejects.toThrow(/throttled/);
    expect(events.find((e) => (e as { type: string }).type === 'done')).toBeUndefined();
  });
});
