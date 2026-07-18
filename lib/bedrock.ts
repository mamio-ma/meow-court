import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import { parse as parsePartial } from 'partial-json';
import { VerdictSchema, type Verdict } from './schema';

// SSE 事件类型——服务端向客户端 push 时用
// section: 某个 top-level 字段流式解析完成，可以立刻渲染
// done: 全部 JSON 完整解析并通过 zod 校验，附带最终 verdict
// error: 兜底错误（本文件目前只 throw，未直接 yield，但类型保留给上层用）
export type StreamEvent =
  | { type: 'section'; section: keyof Verdict; content: unknown }
  | { type: 'done'; verdict: Verdict }
  | { type: 'error'; message: string };

// Verdict schema 的 JSON Schema 版（Bedrock tool_use inputSchema）
// 手写而非 zod-to-json-schema 生成：字段 description 用来引导 LLM 输出风格，
// 也让 severity 的中英枚举、responsibility 相加为 100 这些"猫法官"味道更明显。
const VERDICT_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['core_conflict', 'responsibility', 'crimes', 'reconciliation_checklist', 'cat_closing_line'],
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

// 单一工具定义——Converse API 要求以 { toolSpec: ... } 形式包裹
const SUBMIT_VERDICT_TOOL: Tool = {
  toolSpec: {
    name: 'submit_verdict',
    description: '提交结构化判决书。这是唯一被允许的输出方式。',
    inputSchema: {
      // Bedrock 的 json 字段类型签名较严格，这里直接 any 绕过
      json: VERDICT_TOOL_INPUT_SCHEMA as any,
    },
  },
};

// Lazy 单例——方便测试 mock，同时避免模块加载时就实例化 client
let clientInstance: BedrockRuntimeClient | null = null;
function getClient(): BedrockRuntimeClient {
  if (!clientInstance) {
    // AWS_BEARER_TOKEN_BEDROCK 环境变量存在时，SDK 自动用 Bearer 认证
    clientInstance = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });
  }
  return clientInstance;
}

// 流式生成判决——异步生成器逐段 yield section 事件。
// 完成流后再做一次严格 JSON.parse + zod 校验，防止分段解析漏掉尾部字段。
export async function* streamVerdict(
  systemPrompt: string,
  userPrompt: string,
): AsyncGenerator<StreamEvent> {
  const client = getClient();
  // Bedrock Sonnet 4.6 需要 inference profile ID（`us.` 前缀），不能用 model ID 直接调用
  // ——on-demand throughput 已废弃。默认走 US regional profile。
  const modelId = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6';

  const command = new ConverseStreamCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: userPrompt }] as ContentBlock[],
      },
    ],
    toolConfig: {
      tools: [SUBMIT_VERDICT_TOOL],
      // 强制调用 submit_verdict，杜绝模型走 free-form text 分支
      toolChoice: { tool: { name: 'submit_verdict' } },
    },
    inferenceConfig: {
      maxTokens: 2048,
      // 稍高一点让罪名更有创意——但仍在可控范围内
      temperature: 0.85,
    },
  });

  const response = await client.send(command);
  if (!response.stream) throw new Error('No stream in Bedrock response');

  // 累积 tool_use input JSON 字符串，每次 chunk 到来后尝试 partial parse。
  // 一旦发现某个 top-level section 完整就 emit——保证前端能"section by section"渲染。
  let accumulated = '';
  const emittedSections = new Set<string>();

  for await (const chunk of response.stream as any) {
    // Bedrock 分段推流的 toolUse.input 一定是 string 类型，其他块跳过
    const delta = chunk.contentBlockDelta?.delta?.toolUse?.input;
    if (typeof delta !== 'string') continue;

    accumulated += delta;

    try {
      // partial-json 能解析不完整 JSON——缺尾 } 也 OK
      const partial = parsePartial(accumulated);
      if (partial && typeof partial === 'object') {
        for (const key of Object.keys(partial)) {
          if (
            !emittedSections.has(key) &&
            isSectionComplete(partial, key, accumulated)
          ) {
            emittedSections.add(key);
            yield {
              type: 'section',
              section: key as keyof Verdict,
              content: (partial as any)[key],
            };
          }
        }
      }
    } catch {
      // 累积到能解析为止——初期 chunk 常常还不足以形成 valid partial JSON
    }
  }

  // 流结束，最终严格解析 + zod 校验
  // 严格模式：不容忍任何格式错误。invalid JSON 直接抛，交给上层重试/降级。
  // 注：spec §7 要求"invalid JSON 内部重试 1 次"——这层重试放在 API route (Task 11)
  // 而非 generator 内部，因为重试要重放 SSE 而非重新累积同一个流。
  const finalParsed = JSON.parse(accumulated);
  const validated = VerdictSchema.parse(finalParsed);
  yield { type: 'done', verdict: validated };
}

// 判断某个 top-level key 后面是否已出现"这段确实结束"的标记：
// 判断某个 top-level key 对应的值是否已经完整可 emit：
// 从 "key": 之后扫描，若值本身的括号/引号已经收尾（对基元值：走到 `,` 或顶层 `}`；
// 对 object/array 值：内部深度从 1 回到 0），就是完成。
// 用这个"完成信号"避免把 partial-json 半吊子解析的中间态错发给前端。
function isSectionComplete(partial: any, key: string, raw: string): boolean {
  const val = partial[key];
  if (val === undefined || val === null) return false;

  // 找到 "key": 出现的位置
  const keyPattern = new RegExp(`"${key}"\\s*:`);
  const match = raw.match(keyPattern);
  if (!match) return false;
  const afterKey = raw.slice(match.index! + match[0].length);
  return valueIsClosed(afterKey);
}

// 扫描 `"key":` 之后的字符串，判断该值是否已完整闭合。
// 三种情况都算已完整：
//   1. 顶层对象闭合（depth < 0，说明超过了本值范围到达外层 `}`）
//   2. 本值是 object/array，其内部深度从首个开括号回到 0（意味着本值收尾）
//   3. 本值是基元（字符串/数字/布尔），后面出现 `,` 分隔符（意味着下一个字段开始）
// 字符串内部的括号/逗号必须跳过——支持转义与 emoji。
function valueIsClosed(s: string): boolean {
  let depth = 0;
  let opened = false; // 是否已经进入过 object/array
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
      // 情况 1：外层 } 提前出现（顶层对象闭合）
      if (depth < 0) return true;
      // 情况 2：本值是 object/array，深度从 >0 回到 0，说明本值收尾
      if (opened && depth === 0) return true;
      continue;
    }
    // 情况 3：基元值，处在顶层且遇到 `,`——说明本值已完整，下一个字段开始
    if (ch === ',' && !opened && depth === 0) return true;
  }
  return false;
}
