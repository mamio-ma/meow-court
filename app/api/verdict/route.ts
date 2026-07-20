import { NextRequest } from 'next/server';
import { CaseSchema } from '@/lib/schema';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts';
import { streamVerdict } from '@/lib/llm';

// Node runtime——Bedrock SDK 需要 Node，不用 Edge
export const runtime = 'nodejs';

// spec §7 要求 "Bedrock 返回非法 JSON → 内部重试 1 次"
// 这层重试放在 route handler，因为要重新调用 streamVerdict（重新推流）
// 而非 generator 内部重播已消费的 chunk
const MAX_RETRIES = 1;

export async function POST(req: NextRequest) {
  // 请求体先做一次 zod 校验——非法 case 直接 400，不消耗 Bedrock quota
  const body = await req.json();
  const parseResult = CaseSchema.safeParse(body.case);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid case', details: parseResult.error.issues }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const caseData = parseResult.data;
  // isAppeal 走严格布尔判断——防止前端传字符串 "false" 被当 truthy
  const isAppeal: boolean = body.isAppeal === true;

  const systemPrompt = buildSystemPrompt(caseData.language);
  const userPrompt = buildUserPrompt(caseData, isAppeal);

  // 用 ReadableStream 手动构 SSE——不用第三方 sse 库，减少依赖面
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // SSE 帧格式：`data: <JSON>\n\n`——两个换行是消息结束符
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // 重试循环：spec §7 允许 1 次内部重试
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt <= MAX_RETRIES) {
        try {
          for await (const ev of streamVerdict(systemPrompt, userPrompt)) {
            send(ev);
          }
          // 成功——退出重试循环
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          attempt++;
          if (attempt > MAX_RETRIES) break;
          // 重试前告诉前端 attempt 数——UI 可以显示"本喵在再想想..."
          send({ type: 'retry', attempt });
        }
      }

      if (lastError) {
        // 所有重试都失败——用猫猫口吻发 error 事件（前端捕获后显示 toast）
        send({
          type: 'error',
          message: (lastError as Error).message ?? 'unknown',
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
