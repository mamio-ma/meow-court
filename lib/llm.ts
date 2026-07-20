import Anthropic from '@anthropic-ai/sdk';
import { parse as parsePartial } from 'partial-json';
import { VerdictSchema, type Verdict } from './schema';

// SSE 事件类型——服务端向客户端 push 时用
export type StreamEvent =
  | { type: 'section'; section: keyof Verdict; content: unknown }
  | { type: 'done'; verdict: Verdict }
  | { type: 'error'; message: string };

// Verdict 的 JSON Schema（Anthropic tool input_schema）
// 手写而非 zod-to-json-schema 生成：字段 description 用来引导 LLM 输出风格
const VERDICT_TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  required: [
    'core_conflict',
    'responsibility',
    'crimes',
    'reconciliation_checklist',
    'cat_closing_line',
  ],
  properties: {
    core_conflict: {
      type: 'string',
      description: '一句话总结本次吵架的核心矛盾',
    },
    responsibility: {
      type: 'object',
      required: ['left', 'right'],
      properties: {
        left: { type: 'integer', minimum: 0, maximum: 100, description: '甲方责任百分比' },
        right: { type: 'integer', minimum: 0, maximum: 100, description: '乙方责任百分比' },
      },
      description: 'left + right 必须等于 100',
    },
    crimes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['side', 'charge', 'severity', 'reasoning'],
        properties: {
          side: { type: 'string', enum: ['left', 'right'] },
          charge: { type: 'string', description: '玩梗罪名，如"独食未告知罪"' },
          severity: { type: 'string', enum: ['重罪', '轻罪', 'felony', 'misdemeanor'] },
          reasoning: { type: 'string', description: '猫猫口吻的一两句解释' },
        },
      },
    },
    reconciliation_checklist: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'task', 'intimacy_points'],
        properties: {
          id: { type: 'string' },
          task: { type: 'string', description: '增进感情的具体行动' },
          intimacy_points: { type: 'integer', minimum: 1, maximum: 30 },
        },
      },
    },
    cat_closing_line: { type: 'string', description: '猫猫结尾一句可爱的话' },
  },
};

// Anthropic 客户端 lazy 单例——方便测试 mock
let clientInstance: Anthropic | null = null;
function getClient(): Anthropic {
  if (!clientInstance) {
    // ANTHROPIC_API_KEY 环境变量存在时 SDK 自动读取
    clientInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return clientInstance;
}

// 流式生成判决——异步生成器逐段 yield section 事件
export async function* streamVerdict(
  systemPrompt: string,
  userPrompt: string,
): AsyncGenerator<StreamEvent> {
  const client = getClient();
  // 默认 Sonnet 4.5；换成其他型号只需改 env
  const model = process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-5-20250929';

  const stream = client.messages.stream({
    model,
    max_tokens: 2048,
    temperature: 0.85, // 稍高一点让罪名更有创意
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [
      {
        name: 'submit_verdict',
        description: '提交结构化判决书。这是唯一被允许的输出方式。',
        input_schema: VERDICT_TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_verdict' }, // 强制调用
  });

  // 累积 tool_use 的 partial_json 增量，每次 partial parse 一次
  // 发现某个 top-level section 完整就 emit
  let accumulated = '';
  const emittedSections = new Set<string>();

  for await (const event of stream) {
    // Anthropic 流式 tool_use JSON 走 input_json_delta 事件
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'input_json_delta'
    ) {
      accumulated += event.delta.partial_json;

      try {
        const partial = parsePartial(accumulated);
        if (partial && typeof partial === 'object') {
          for (const key of Object.keys(partial)) {
            if (
              !emittedSections.has(key) &&
              isSectionComplete(partial as Record<string, unknown>, key, accumulated)
            ) {
              emittedSections.add(key);
              yield {
                type: 'section',
                section: key as keyof Verdict,
                content: (partial as Record<string, unknown>)[key],
              };
            }
          }
        }
      } catch {
        // 累积到能解析为止——初期 chunk 常常还不足以形成 valid partial JSON
      }
    }
  }

  // 流结束，最终严格解析 + zod 校验
  // 严格模式：不容忍任何格式错误。invalid JSON 直接抛，交给上层重试/降级。
  // 注：spec §7 要求"invalid JSON 内部重试 1 次"——这层重试放在 API route
  // 而非 generator 内部，因为重试要重放 SSE 而非重新累积同一个流。
  const finalParsed = JSON.parse(accumulated);
  const validated = VerdictSchema.parse(finalParsed);
  yield { type: 'done', verdict: validated };
}

// 判断某个 top-level key 对应的值是否已经完整可 emit：
// 从 "key": 之后扫描，若值本身的括号/引号已经收尾（对基元值：走到 `,` 或顶层 `}`；
// 对 object/array 值：内部深度从 1 回到 0），就是完成。
// 用这个"完成信号"避免把 partial-json 半吊子解析的中间态错发给前端。
function isSectionComplete(
  partial: Record<string, unknown>,
  key: string,
  raw: string,
): boolean {
  const val = partial[key];
  if (val === undefined || val === null) return false;

  const keyPattern = new RegExp(`"${key}"\\s*:`);
  const match = raw.match(keyPattern);
  if (!match) return false;
  const afterKey = raw.slice(match.index! + match[0].length);
  return valueIsClosed(afterKey);
}

// 扫描 `"key":` 之后的字符串，判断该值是否已完整闭合。
// 三种情况都算已完整：
//   1. 顶层对象闭合（depth < 0，说明超过了本值范围到达外层 `}`）
//   2. 本值是 object/array，其内部深度从首个开括号回到 0
//   3. 本值是基元（字符串/数字/布尔），后面出现 `,` 分隔符
// 字符串内部的括号/逗号必须跳过——支持转义与 emoji。
function valueIsClosed(s: string): boolean {
  let depth = 0;
  let opened = false;
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      depth++;
      opened = true;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth < 0) return true;
      if (opened && depth === 0) return true;
      continue;
    }
    if (ch === ',' && !opened && depth === 0) return true;
  }
  return false;
}
