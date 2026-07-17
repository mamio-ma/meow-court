# AI Mediation Judge · 设计文档

> **代号**: Feline Court · 猫猫法庭
> **日期**: 2026-07-17
> **状态**: Design approved · 待写实现计划

## 1 · 概览

一个给情侣用的 AI 调解 app。双方各自陈述吵架经过与生气理由，一只可爱的猫猫大法官（Chief Justice Whiskers）做出**公正但轻松**的判决——包括吵架核心原因、责任比例、可爱风格的"罪名"、以增进感情为目的的和解方案。

判决以"和为贵"而非惩罚。双方可选择接受或上诉；上诉进入二审终审。

## 2 · 目标与非目标

### 目标（In Scope）

- 一次调解一场吵架：陈述 → 判决 → 接受/上诉 → checklist → 完成
- 两种使用模式：**单机**（一起用一台）和**远程**（各用一台，房间码同步）
- 中英双语切换
- 可爱风格判决（玩梗的罪名 + 温柔口吻）
- 结构化输出（责任 % + 罪名卡片 + checklist）
- 和解 checklist 可交互勾选，本会话内累计亲密度
- 二审终审机制（任一方可上诉，另一方可反驳）
- 部署 Vercel 公开访问，AWS Bedrock 作 LLM

### 非目标（Explicitly Out of Scope）

- ❌ 用户账号系统
- ❌ 亲密度跨会话持久化（刷新即重置）
- ❌ 三审以上（二审终局）
- ❌ 历史 case 查看
- ❌ 移动 App（Web 优先，响应式即可）
- ❌ 支付/订阅（MVP）
- ❌ 多语言（zh/en 之外的）

## 3 · 用户流程（8 屏）

主线 4 屏 + 分支点 + 两条支线（接受路径 2 屏，上诉路径 3 屏）。

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌───────────┐
│ 1.Land  │──▶│ 2.Mode  │──▶│ 3.Input │──▶│ 4.Anim  │──▶│ 5.Verdict │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────┬─────┘
                                                              │
                            ┌─────────────────────────────────┴─────┐
                            │                                        │
                            ▼ 双方接受                                 ▼ 任一方上诉
                    ┌─────────────┐                          ┌──────────────┐
                    │ 6A.Checklist│                          │ 6B.Appeal    │
                    └──────┬──────┘                          └──────┬───────┘
                           ▼                                         ▼
                    ┌─────────────┐                          ┌──────────────┐
                    │ 7A.Done ✨   │                          │ 7B.Anim(2)   │
                    └─────────────┘                          └──────┬───────┘
                                                                    ▼
                                                             ┌──────────────┐
                                                             │ 8B.Final Vrd │
                                                             └──────────────┘
```

### 各屏职责

| # | 屏名 | 内容要点 |
|---|---|---|
| 1 | Landing | 猫猫大图 · "开始审判"按钮 · 中英切换 · 一句可爱开场白 |
| 2 | Mode Select | 单机 / 远程（生成 6 位房间码）二选一 |
| 3 | Case Input | 双方名字 · 发生了什么 · 为何生气；单机模式左右并排，远程模式只显示自己那侧 + 对方"还在写..." |
| 4 | Judging Animation | 猫猫敲槌 + 天平摇摆 + 呼吸点 + 判决 SSE 流式生成 |
| 5 | Verdict (分支点) | 责任比例条 · 核心矛盾 · 罪名卡片（重罪/轻罪）· 和解方案 · **接受** / **上诉** 双按钮。**单机模式**：一次点击代表双方共识；**远程模式**：双方各自客户端独立点，两侧都点"接受"才进 6A，任一方点"上诉"立即进 6B |
| 6A | Reconciliation Checklist | 每条任务可勾选，勾选时 "+X 亲密度 🌿" 飘浮弹窗 |
| 7A | Done | 亲密度总分 + 撒花庆祝 + "开启下一案"重置按钮 |
| 6B | Appeal Supplement | 上诉方补新证据 + 对方 30s 内可回应，超时自动跳过 |
| 7B | Second Animation | 猫猫翻卷宗 + 皱眉 + 再敲，二审判决流式生成 |
| 8B | Final Verdict | 修订后的责任比例 + 新和解方案，只能"接受并执行"，无法再上诉 |

## 4 · 技术栈

### 前端
- **Next.js 15**（App Router）+ **React 19** + **TypeScript**
- **Tailwind CSS 4**——把设计定的 8 色暖色调板做成 design tokens
- **Framer Motion**——猫猫审判动画（敲槌、天平、翻卷宗）
- **shadcn/ui**——组件底座，全部改成猫猫风格
- **next-intl**——i18n（zh/en）

### 后端
- 所有 API 都跑在 **Next.js Route Handlers**（Node runtime，不用 Edge——Bedrock SDK 需要 Node）
- **@aws-sdk/client-bedrock-runtime**——调 Bedrock Converse API 支持 streaming + tool_use
- **@upstash/redis**——远程模式房间状态（24h TTL）
- **zod**——运行时 schema 验证（verdict 结构、API payload）

### 部署
- **Vercel**——git 连过去自动 CI/CD
- **Upstash Redis**（Vercel Integration 一键 provision）

## 5 · 数据模型

会话内 case 结构，客户端 state + 远程模式 Redis 存的都是这个：

```ts
// 一场 case 的完整状态
type Case = {
  id: string                    // UUID，也是分享链接的一部分
  language: 'zh' | 'en'
  mode: 'single' | 'remote'
  createdAt: number             // epoch ms

  // 双方陈述
  left: PartyStatement          // 甲方
  right: PartyStatement         // 乙方

  // 一审
  firstVerdict?: Verdict
  firstVerdictDecisions?: {
    leftAccepted?: boolean      // 单机模式两个 flag 都存在客户端
    rightAccepted?: boolean     // 远程模式各自的客户端 PATCH 更新
  }

  // 二审（可选）
  appeal?: {
    appellant: 'left' | 'right'
    appellantSupplement: string          // 上诉方补新料
    respondentSupplement?: string        // 对方反驳，30s 超时可空
    respondedAt?: number                 // 对方是否回应（用于 UI 状态）
  }
  finalVerdict?: Verdict          // 存在 = 二审终局

  // 亲密度（仅当前会话）
  intimacyScore: number
  completedChecklist: string[]    // 已勾选的 checklist item id
}

type PartyStatement = {
  name: string
  narrative: string        // 发生了什么
  grievance: string        // 生气的理由
  submittedAt?: number     // 远程模式判断"对方还在写"用
}

// LLM 输出的判决书结构（强制 schema）
type Verdict = {
  core_conflict: string           // 一句话总结吵架核心
  responsibility: {
    left: number                  // 0-100，整数
    right: number                 // left + right = 100
  }
  crimes: Array<{
    side: 'left' | 'right'
    charge: string                // 玩梗罪名："独食未告知罪"
    severity: '重罪' | '轻罪'     // 或 'felony' | 'misdemeanor' (en)
    reasoning: string             // 猫猫口吻的一两句解释
  }>
  reconciliation_checklist: Array<{
    id: string                    // 稳定 id，前端用来 track 勾选
    task: string                  // "甲方买 2 盒同款芝士条赔偿"
    intimacy_points: number       // 10-30 之间
  }>
  cat_closing_line: string        // 结尾一句："退庭，去抱抱吧 🐾"
}
```

## 6 · API 端点

Next.js App Router route handlers。所有 API 返回 JSON（除 `/api/verdict` 是 SSE）。

### `POST /api/verdict` · 生成判决（流式）

**Request body**:
```ts
{
  case: Case                      // 完整 case（含双方陈述）
  isAppeal: boolean               // false = 一审, true = 二审
}
```

**Response**: Server-Sent Events 流。每个 event 是判决 JSON 的增量片段。客户端边收边更新 UI，先看到"核心矛盾"，再看到罪名，最后看到 checklist。

事件格式：
```
data: {"type":"section","section":"core_conflict","content":"..."}
data: {"type":"section","section":"responsibility","content":{...}}
data: {"type":"section","section":"crimes","content":[...]}
data: {"type":"section","section":"checklist","content":[...]}
data: {"type":"done","verdict":{...}}   // 最终完整对象
```

**实现注意**：Bedrock Converse Stream 返回的是 tool_use JSON 的增量 chunk，服务端需要边收边尝试解析（用 `partial-json` 库），每当一个 top-level section 变完整就 emit 一个 `section` 事件。这个流式解析层在 `lib/bedrock.ts` 里封装。

### 远程模式路由

```
POST   /api/rooms                # 创建房间
GET    /api/rooms/:code          # 拉状态（对方陈述在提交前不可见）
PATCH  /api/rooms/:code          # 更新自己那侧状态
```

**POST /api/rooms**
- Request: `{ language }`
- Response: `{ code: string, hostToken: string }`
  - `code`: 6 位大写字母数字（易念）
  - `hostToken`: 房主身份 token（cookie 保存）

**GET /api/rooms/:code**
- Request: `?token=X`
- Response: `{ case: Case, myRole: 'left' | 'right', opponentHasSubmitted: boolean }`
  - 房主默认 `left`；未见过的 token 首次访问自动分配 `right`
  - 敏感字段（对方陈述在 `firstVerdict` 生成前）在返回前 masked，只返回 `submittedAt` 让 UI 显示"对方已提交"或"对方还在写"
  - 客户端每 2s 轮询一次（MVP 不用 WebSocket）

**PATCH /api/rooms/:code**
- Request: `{ token, action, payload }`
- Actions:
  - `submit_statement`: `{ name, narrative, grievance }`
  - `accept_verdict`: `{}`
  - `submit_appeal`: `{ supplement }`
  - `respond_to_appeal`: `{ supplement }`
  - `check_task`: `{ taskId }`

房间生命周期：24h Redis TTL。任一时刻双方都完成 checklist → 保留状态供二人查看，24h 后自动清理。

**判决触发时机**：远程模式服务端在 `submit_statement` PATCH 里检测——**当双方都已提交陈述**时，服务端**自动**触发 verdict 生成（内部调 `/api/verdict` 逻辑），把结果写回房间 state。两侧客户端下一次轮询能看到 `firstVerdict` 字段出现。

## 7 · LLM Prompt 策略

### Model
- **主模型**: `anthropic.claude-sonnet-4-6` in `us-east-1`
- **可切换**: `BEDROCK_MODEL_ID` 环境变量控制，方便切成 `anthropic.claude-haiku-4-5-20251001-v1:0` 省钱

### API
- **Bedrock Converse API**（`bedrock-runtime.us-east-1.amazonaws.com/model/{id}/converse-stream`）
- **Auth**: Bearer token via `AWS_BEARER_TOKEN_BEDROCK` env（Bedrock API Keys 特性）
- **Streaming**: `converse-stream` 支持 token-by-token 流

### System Prompt（zh 版骨架）

```
你是「Chief Justice Whiskers」——一只三花猫大法官，
专门调解情侣之间的小吵小闹。

【原则】
1. 以和为贵：目的是让双方感情更好，绝不惩罚。
2. 公正但温柔：责任比例基于事实分析，但用词永远轻松可爱。
3. 罪名要玩梗：把日常小事包装成庄严罪名，例如：
   · 「独食未告知罪」
   · 「夺被子未通报罪」
   · 「深夜发朋友圈不@罪」
   · 「已读不回一小时罪」
4. 和解方案必须是**增进感情**的行动：
   · 一起做饭、看电影、散步
   · 鼻尖碰碰、抱抱 30 秒
   · 手写一张小纸条
   绝不写"罚款"、"跪键盘"等负面惩罚。
5. 语气示例：
   · 「本喵审阅卷宗后...」
   · 「根据神圣的《共享零食公约》第三条...」
   · 「甲方喵，你可要好好反省呀 🐾」
   · 「乙方喵，别气啦，让本喵好好断一断这个案子 ✧」

【责任比例】
- 基于陈述内容分析，可以 50/50、60/40、70/30 甚至 80/20
- 但极少 90/10 或 100/0——即使一方明显更过分，另一方多少也
  有可以反思的地方（沟通方式、情绪表达等）
- 无论比例如何，罪名描述保持可爱轻松

【输出】通过 submit_verdict tool 输出结构化 JSON。
```

英文版是等价直译，把梗改成英文文化里的（e.g., "Petty Snack Hoarding Felony"）。

### Tool-use 结构化输出

定义 `submit_verdict` tool，参数 schema = 上面的 `Verdict` 类型。Claude 必须调用该 tool，不能自由文字输出——彻底杜绝格式漂。

服务端 route handler 用 zod 二次校验 tool_use 参数；不通过 → 重试 1 次；再不通过 → 返回错误。

### 二审 Prompt 附加段

在一审 system prompt 后加：

```
【二审说明】
以下是一审判决 + 双方补陈材料。请综合考虑所有信息重新裁定。
可以维持原判决、调整比例、或彻底翻案。理由要说明。

一审判决：{first_verdict_json}
上诉方（{appellant}）补陈：{appellant_supplement}
{if respondent_supplement}
对方回应：{respondent_supplement}
{else}
（对方选择不回应）
{endif}
```

## 8 · 部署

### Vercel

- github repo → Vercel Project 连接
- Framework preset: **Next.js**
- Build command: `next build`
- Node version: 20.x

### 环境变量（Vercel Env）

```env
# Bedrock（Production + Preview 都要设）
AWS_BEARER_TOKEN_BEDROCK=ABSK...      # secrets，不入 git
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6

# Upstash Redis（Vercel Integration provisioning 会自动注入）
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Domain

MVP 用 Vercel 默认二级域名（如 `feline-court.vercel.app`）；后续可绑自定义域名。

## 9 · 错误处理

所有错误提示都用**猫猫口吻**——不打破沉浸。

| 场景 | 用户看到 | 后台处理 |
|---|---|---|
| Bedrock 超时 | "本喵犯困了，再敲一次法槌？" + 重试按钮 | 记 log，前端保留输入 |
| Bedrock 返回非法 JSON | 同上 | 内部重试 1 次；仍失败才展示 |
| 远程房间码不存在 | "本案卷宗已归档 📂 · 请开启新案" | 404 |
| 远程对方还没提交 | "对方还在书写状纸 🐾..." | 无超时，友好等待 |
| 二审对方 30s 未回应 | 自动跳过 → "对方选择不补充" | 服务端标记 `respondentSupplement=null` |
| 网络断开 | 页面级 banner: "连接中断..." | 保留 local state |
| 房间已过期（24h TTL） | "案子太久没动，本喵归档啦 📂" | Redis 自动清 |

## 10 · 测试策略

- **Vitest** unit tests
  - Prompt 拼装函数（zh/en 版本、二审 prompt 变体）
  - Verdict schema 校验（zod parse）
  - 亲密度累计逻辑
- **Playwright** E2E
  - 单机模式黄金路径（Landing → 输入 → 判决 → 接受 → checklist → 完成）
  - 单机模式上诉路径
- **手动测试** 远程模式
  - 两个 browser context 同时开，房间码同步验证
  - MVP 阶段先手动；后续 playwright 可自动化
- **Prompt 回归**
  - 硬编码 5 个 case 例子（不同情境）
  - 人工 review 判决质量，尤其：罪名是否玩梗、和解方案是否正向、责任比例是否合理

## 11 · 项目结构

```
ai-mediation-judge/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 全局 layout（i18n provider、字体）
│   ├── page.tsx                  # Landing (Screen 1)
│   ├── mode/page.tsx             # Mode select (Screen 2)
│   ├── case/[id]/page.tsx        # 单机模式：输入→判决→checklist 全在这
│   ├── room/[code]/page.tsx      # 远程模式入口
│   ├── globals.css               # Tailwind + design tokens
│   └── api/
│       ├── verdict/route.ts      # POST 生成判决（SSE）
│       └── rooms/
│           ├── route.ts          # POST 创建房间
│           └── [code]/route.ts   # GET/PATCH 状态
├── components/
│   ├── JudgeCat.tsx              # 猫猫头像 + 各种动画状态
│   ├── LanguageToggle.tsx        # 中英切换
│   ├── CaseForm.tsx              # 陈述表单（单侧）
│   ├── JudgingAnimation.tsx      # 审判动画屏
│   ├── VerdictCard.tsx           # 判决书主组件
│   ├── ResponsibilityBar.tsx     # 责任比例条
│   ├── CrimeCard.tsx             # 罪名卡片
│   ├── ChecklistProgress.tsx     # 和解 checklist + 亲密度
│   ├── AppealForm.tsx            # 上诉补陈表单
│   └── ui/                       # shadcn/ui 定制组件
├── lib/
│   ├── bedrock.ts                # Bedrock client + streaming helper
│   ├── prompts.ts                # 系统 prompt 各语言各阶段
│   ├── verdict-schema.ts         # zod schema + Verdict TS type
│   ├── rooms.ts                  # Upstash Redis client + room ops
│   ├── i18n.ts                   # next-intl 配置
│   └── uuid.ts                   # 房间码 / case id 生成
├── locales/
│   ├── zh.json                   # 所有 UI 字符串
│   └── en.json
├── public/
│   ├── judge-cat.png             # 猫猫头像（用户提供）
│   └── favicon.ico
├── tailwind.config.ts            # 8 色暖色 design tokens
├── next.config.ts
├── package.json
└── .env.local                    # gitignored, 存 secrets
```

## 12 · 关键交互边界（避免歧义）

- **单机模式的 role 归属**：单机模式下 `Case.left` / `Case.right` 是纯数据划分（"左边填的人 vs 右边填的人"），没有"当前用户是哪一方"的概念——按钮点了就是"双方共识"。
- **远程模式接受判决的推进**：一方点接受后，服务端标记 `firstVerdictDecisions.{side}Accepted = true`，返回给对方轮询显示"对方已接受，等你确认"。**任一方点上诉立即抢占**——即使对方已接受，上诉也会覆盖，进入 6B。
- **上诉方补陈提交后**：立即写入 Redis，对方轮询能看到；对方回应窗口 30s，由客户端起计时器，服务端在 `respondedAt` 存回应时间作为二审生成的 gate。
- **二审终局**：`finalVerdict` 存在时前端 UI 隐藏"上诉"按钮，只显示"接受并执行"。

## 13 · 开放问题（等实现时决定，不阻塞设计）

- Vercel Serverless Function 冷启对 Bedrock 调用延迟的影响——如果明显，考虑 Vercel Edge Config 保 warm 或改 Fluid Compute
- 罪名 corpus 是否要预置一份"金句表"给 LLM 参考避免重复——初版靠模型创造力，看效果决定
- 移动端猫猫大图性能——考虑 Next.js Image 优化 + WebP fallback
- 远程模式的 role 分配：房主默认 left 还是让创建时选？——默认房主 left，加入者 right
