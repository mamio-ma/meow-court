# 🐱⚖️ 猫猫大法官 · Feline Court

情侣可爱风格 AI 调解 app——三花猫大法官 Chief Justice Whiskers 用「以和为贵」的口吻为你们判决。

## 特性

- **中英双语**——中/EN 一键切换
- **两种模式**：单机（一台手机，两人轮流填）或远程（6 位房间码，两台手机各自打开）
- **可爱判决**：玩梗罪名（"独食未告知罪"）+ 责任比例（60/40）+ 增进感情的和解方案
- **上诉机制**：不服可上诉，二审终局
- **和解 Checklist**：完成任务累计亲密度
- **流式生成**：SSE 逐段输出判决，等待感 → 期待感

## 技术栈

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
- Framer Motion (动画) · shadcn/ui (组件底座)
- AWS Bedrock (Claude Sonnet 4.6, `us.` inference profile) · Upstash Redis (远程模式房间, 24h TTL)
- Vitest (unit) · Playwright (E2E) · zod (schema)

## 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local 填入你的 Bedrock token；Upstash 可选（远程模式才需要）
npm run dev
```

打开 http://localhost:3000

## 测试

```bash
npm test           # Vitest unit (30+ tests)
npm run test:e2e   # Playwright E2E (2 tests, single-mode happy path)
```

## 部署到 Vercel

1. Push 到 GitHub
2. Vercel Dashboard → New Project → Import 该 repo
3. Framework Preset: Next.js（自动检测）
4. Environment Variables：粘贴 `.env.example` 里列出的所有 key + 真实值
5. Upstash Redis：Vercel Marketplace → Add Integration → Upstash → provision 一个免费 Redis DB（自动注入 `UPSTASH_REDIS_REST_*`）
6. Deploy

## 项目结构

```
app/               # Next.js App Router
  api/verdict/     # SSE 判决生成
  api/rooms/       # 远程房间 CRUD
  case/[id]/       # 单机模式全流程
  room/[code]/     # 远程房间页
components/        # 11 个 React 组件
lib/               # 核心逻辑（schema/prompts/bedrock/rooms/intimacy）
messages/          # zh.json + en.json
e2e/               # Playwright 测试
```

## License

Private / 私人项目
