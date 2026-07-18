import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRoom } from '@/lib/rooms';

// Node runtime——Upstash Redis SDK 用 fetch，Edge 也能跑，
// 但为了和 verdict 保持一致 + 未来可能扩展，都用 nodejs。
export const runtime = 'nodejs';

// 请求体 schema——目前只需要语言字段，房主 token 由服务端生成
const CreateRoomBody = z.object({
  language: z.enum(['zh', 'en']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = CreateRoomBody.safeParse(body);
  if (!parse.success) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  try {
    const { code, hostToken } = await createRoom(parse.data.language);
    return Response.json({ code, hostToken });
  } catch (err) {
    // Redis 未配置或不可达——返回 503 而非 500，UI 可以显示“远程模式暂不可用”
    return Response.json(
      { error: 'Remote mode unavailable', details: (err as Error).message },
      { status: 503 },
    );
  }
}
