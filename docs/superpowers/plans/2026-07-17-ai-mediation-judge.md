# AI Mediation Judge (Feline Court) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零构建一个 Next.js 15 全栈 app：情侣可爱风格 AI 调解法官，Bedrock (Claude Sonnet 4.6) 生成结构化判决，Vercel 公开部署，支持单机 + 远程双人两种模式。

**Architecture:** Next.js App Router 单体仓库（前端 + API 都在此），业务逻辑集中在 `lib/` 便于单测，UI 拆成小组件，远程模式用 Upstash Redis 存 24h TTL 房间状态。全部 SSE 流式返回判决保证等待体验。

**Tech Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · shadcn/ui · @aws-sdk/client-bedrock-runtime · @upstash/redis · zod · next-intl · Vitest · Playwright

---

## 前置说明

**分支策略**：按用户偏好，所有实现都在 `feat/mvp-implementation` 分支上进行，不直接推 main。

**准备工作**（在开始 Task 1 之前手动完成一次）：
```bash
cd /Users/mingyongm/ai-mediation-judge
git checkout main
git merge design/initial-spec --ff-only    # 把 spec 合到 main
git checkout -b feat/mvp-implementation
```

**测试哲学**：TDD——每个 lib/ 函数先写 vitest，再写实现。UI 组件靠 Playwright E2E 覆盖交互。

**提交习惯**：每完成一个 sub-task 立即 commit。commit message 用 conventional commits（feat/fix/chore/test），全英文，简洁描述"why not what"。**不加 Co-Authored-By 尾行**。

---

## 里程碑一览

- **M1（Task 1–5）**：项目脚手架 + 设计 tokens + i18n + 测试工具
- **M2（Task 6–10）**：`lib/` 核心业务逻辑（schema、prompts、bedrock、rooms、intimacy）
- **M3（Task 11–13）**：API 路由（verdict SSE、rooms CRUD）
- **M4（Task 14–22）**：React 组件（JudgeCat、CaseForm、VerdictCard、Checklist 等）
- **M5（Task 23–26）**：页面组装（Landing、Mode、Case、Room）
- **M6（Task 27–29）**：E2E 测试 + 部署

---

# M1 · 脚手架

## Task 1: Next.js 项目初始化

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/`, `public/`

- [ ] **Step 1: 用 create-next-app 生成骨架**

在项目根目录（`/Users/mingyongm/ai-mediation-judge`）跑：

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-eslint \
  --turbopack \
  --yes
```

有确认覆盖的地方选 yes。生成后会有 `app/`, `public/`, `package.json` 等。

- [ ] **Step 2: 验证 dev server 起得来**

```bash
npm run dev
```

浏览器打开 http://localhost:3000 看到默认 Next.js 首页。ctrl-C 停掉。

- [ ] **Step 3: 把猫猫图搬进 public/**

```bash
cp "judge cat.png" public/judge-cat.png
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with TypeScript and Tailwind"
```

---

## Task 2: 安装核心依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装运行时依赖**

```bash
npm install \
  @aws-sdk/client-bedrock-runtime \
  @upstash/redis \
  framer-motion \
  next-intl \
  zod \
  partial-json \
  nanoid
```

`partial-json` 用来在 SSE 流里增量解析 tool_use JSON；`nanoid` 生成 6 位房间码和 case id。

- [ ] **Step 2: 安装 dev 依赖**

```bash
npm install -D \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @playwright/test \
  jsdom
```

- [ ] **Step 3: 装 shadcn/ui CLI 并初始化**

```bash
npx shadcn@latest init --defaults --yes
```

选择默认 style/color。生成 `components/ui/` 目录、`lib/utils.ts`、`components.json`。

- [ ] **Step 4: 装几个 shadcn 组件**

```bash
npx shadcn@latest add button input textarea card progress toast --yes
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: install runtime and dev dependencies"
```

---

## Task 3: Tailwind 设计 tokens（8 色暖色调）

**Files:**
- Modify: `tailwind.config.ts` (Tailwind v4 用 CSS 变量，实际改 `app/globals.css`)
- Modify: `app/globals.css`

- [ ] **Step 1: 在 globals.css 里定义暖色调 tokens**

打开 `app/globals.css`。在文件开头（`@import "tailwindcss"` 之后）加：

```css
/* Feline Court 设计 tokens · 8 层暖色系家族 */
@theme {
  /* 暖色调板 */
  --color-cream: #fef7ee;         /* 最亮，用于输入框底、卡片底 */
  --color-peach: #faeadd;         /* 暖桃，页面背景 */
  --color-honey: #f5d5c0;         /* 蜜杏，卡片渐变中段 */
  --color-sand: #ebc3b0;          /* 沙粉，边框、二级块 */
  --color-rose: #d4879a;          /* 玫瑰，甲方/上诉/情绪强调 */
  --color-terra: #c88a6a;         /* 陶土，主按钮、乙方 */
  --color-cinnamon: #a06753;      /* 肉桂，判决/权威文字 */
  --color-cocoa: #6b4c3b;         /* 暖棕，正文字色 */

  /* 语义色 */
  --color-accept: #7a8759;        /* 鼠尾草绿——唯一冷色点缀，用于"接受"和亲密度上升 */

  /* 字体 */
  --font-display: 'Nunito', 'PingFang SC', system-ui, sans-serif;
  --font-body: 'Nunito', 'PingFang SC', system-ui, sans-serif;
}

/* 页面默认背景 = 暖桃 */
body {
  background: var(--color-peach);
  color: var(--color-cocoa);
  font-family: var(--font-body);
}
```

- [ ] **Step 2: 引入 Nunito 字体**

修改 `app/layout.tsx`，import Nunito 并应用到 body：

```tsx
import { Nunito } from 'next/font/google';
import './globals.css';

// 引入 Nunito——圆润无衬线，配可爱猫猫风格
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
});

export const metadata = {
  title: '🐱 猫猫大法官 · Feline Court',
  description: 'AI 调解法官——用可爱的方式解决情侣小争吵',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 手动验证——把首页改成一个色板测试块**

暂时改 `app/page.tsx`：

```tsx
export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-cocoa">🐱⚖️ 猫猫法庭</h1>
      <div className="flex gap-2 mt-4">
        {['cream', 'peach', 'honey', 'sand', 'rose', 'terra', 'cinnamon', 'cocoa', 'accept'].map(c => (
          <div key={c} className={`w-16 h-16 rounded bg-${c} border border-cocoa/10`} title={c} />
        ))}
      </div>
    </div>
  );
}
```

`npm run dev` 打开 http://localhost:3000 看到 8+1 个色块，验证 tokens 生效。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: define warm 8-color design tokens (Feline Court palette)"
```

---

## Task 4: Vitest 配置

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: 创建 vitest 配置**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest 配置——lib/ 逻辑测试用 node 环境，
// 组件测试用 jsdom（虽然 MVP 组件测试主要走 E2E）
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

`vitest.setup.ts`:

```ts
// 每个测试前重置模块缓存，避免 lib/ 之间的 mock 污染
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});
```

- [ ] **Step 2: 加 npm scripts**

`package.json` 里 `scripts` 段加：

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: 写一个 smoke test 验证配置生效**

`lib/__smoke__.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest smoke test', () => {
  it('should run', () => {
    expect(1 + 1).toBe(2);
  });
});
```

跑 `npm test`，看到 1 passed。

- [ ] **Step 4: 删除 smoke test，commit**

```bash
rm lib/__smoke__.test.ts
git add -A
git commit -m "chore: configure Vitest with jsdom setup"
```

---

## Task 5: Playwright 配置

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/` 目录

- [ ] **Step 1: 初始化 playwright**

```bash
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

// E2E 配置——MVP 只测 chromium，够用
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: 加 e2e script**

`package.json`：

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: 写 landing 冒烟测试**

`e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/猫猫法庭|Feline Court/);
});
```

跑 `npm run test:e2e`——应该 PASS（现在 title 已经设成猫猫法庭）。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: configure Playwright for E2E testing"
```

---

# M2 · 核心业务逻辑（lib/）

## Task 6: Verdict + Case zod schemas

**Files:**
- Create: `lib/schema.ts`
- Create: `lib/schema.test.ts`

- [ ] **Step 1: 写测试——先写失败的**

`lib/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VerdictSchema, PartyStatementSchema, CaseSchema } from './schema';

describe('VerdictSchema', () => {
  it('accepts a valid verdict', () => {
    const valid = {
      core_conflict: '芝士条分配不均',
      responsibility: { left: 70, right: 30 },
      crimes: [
        { side: 'left', charge: '独食未告知罪', severity: '重罪', reasoning: '未与对方商量便独享' },
      ],
      reconciliation_checklist: [
        { id: 'task-1', task: '甲方买 2 盒芝士条赔偿', intimacy_points: 10 },
      ],
      cat_closing_line: '退庭，去抱抱吧 🐾',
    };
    expect(() => VerdictSchema.parse(valid)).not.toThrow();
  });

  it('rejects responsibility not summing to 100', () => {
    const bad = {
      core_conflict: 'x',
      responsibility: { left: 60, right: 30 },
      crimes: [],
      reconciliation_checklist: [],
      cat_closing_line: 'x',
    };
    expect(() => VerdictSchema.parse(bad)).toThrow(/责任比例/);
  });

  it('rejects invalid severity', () => {
    const bad = {
      core_conflict: 'x',
      responsibility: { left: 50, right: 50 },
      crimes: [{ side: 'left', charge: 'x', severity: '死刑', reasoning: 'x' }],
      reconciliation_checklist: [],
      cat_closing_line: 'x',
    };
    expect(() => VerdictSchema.parse(bad)).toThrow();
  });
});

describe('PartyStatementSchema', () => {
  it('requires all fields', () => {
    expect(() => PartyStatementSchema.parse({ name: '', narrative: '', grievance: '' })).toThrow();
  });
});

describe('CaseSchema', () => {
  it('accepts minimal case', () => {
    const c = {
      id: 'abc',
      language: 'zh',
      mode: 'single',
      createdAt: Date.now(),
      left: { name: '甲', narrative: 'x', grievance: 'x' },
      right: { name: '乙', narrative: 'y', grievance: 'y' },
      intimacyScore: 0,
      completedChecklist: [],
    };
    expect(() => CaseSchema.parse(c)).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npm test lib/schema.test.ts
```

预期：`Cannot find module './schema'`。

- [ ] **Step 3: 实现 schema**

`lib/schema.ts`:

```ts
import { z } from 'zod';

// 罪名的严重程度——只允许两级，防止 LLM 输出"死刑"这种破坏可爱风的词
export const SeveritySchema = z.enum(['重罪', '轻罪', 'felony', 'misdemeanor']);

// 单方陈述——三个字段都必填非空
export const PartyStatementSchema = z.object({
  name: z.string().min(1, '名字必填'),
  narrative: z.string().min(1, '经过必填'),
  grievance: z.string().min(1, '生气理由必填'),
  submittedAt: z.number().optional(),
});

// 判决书——LLM 通过 tool_use 输出，用 zod 强校验
export const VerdictSchema = z.object({
  core_conflict: z.string().min(1),
  responsibility: z.object({
    left: z.number().int().min(0).max(100),
    right: z.number().int().min(0).max(100),
  }).refine(
    (r) => r.left + r.right === 100,
    { message: '责任比例必须相加等于 100' }
  ),
  crimes: z.array(z.object({
    side: z.enum(['left', 'right']),
    charge: z.string().min(1),
    severity: SeveritySchema,
    reasoning: z.string().min(1),
  })).min(1),
  reconciliation_checklist: z.array(z.object({
    id: z.string().min(1),
    task: z.string().min(1),
    intimacy_points: z.number().int().min(1).max(30),
  })).min(1),
  cat_closing_line: z.string().min(1),
});

// 一场 case 的完整状态
export const CaseSchema = z.object({
  id: z.string().min(1),
  language: z.enum(['zh', 'en']),
  mode: z.enum(['single', 'remote']),
  createdAt: z.number(),
  left: PartyStatementSchema,
  right: PartyStatementSchema,
  firstVerdict: VerdictSchema.optional(),
  firstVerdictDecisions: z.object({
    leftAccepted: z.boolean().optional(),
    rightAccepted: z.boolean().optional(),
  }).optional(),
  appeal: z.object({
    appellant: z.enum(['left', 'right']),
    appellantSupplement: z.string().min(1),
    respondentSupplement: z.string().optional(),
    respondedAt: z.number().optional(),
  }).optional(),
  finalVerdict: VerdictSchema.optional(),
  intimacyScore: z.number().int().min(0),
  completedChecklist: z.array(z.string()),
});

// 导出 TS 类型
export type Verdict = z.infer<typeof VerdictSchema>;
export type PartyStatement = z.infer<typeof PartyStatementSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
```

- [ ] **Step 4: 跑测试确认 PASS**

```bash
npm test lib/schema.test.ts
```

预期：5 tests passed。

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts lib/schema.test.ts
git commit -m "feat(lib): add zod schemas for Verdict, PartyStatement, Case"
```

---

## Task 7: Prompts（zh/en · 一审/二审）

**Files:**
- Create: `lib/prompts.ts`
- Create: `lib/prompts.test.ts`

- [ ] **Step 1: 写测试**

`lib/prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import type { Case } from './schema';

const baseCase: Case = {
  id: 'test-1',
  language: 'zh',
  mode: 'single',
  createdAt: Date.now(),
  left: { name: '小美', narrative: '他吃了我的芝士条', grievance: '心里没我' },
  right: { name: '阿明', narrative: '就一根我没意识到', grievance: '为一根发火太夸张' },
  intimacyScore: 0,
  completedChecklist: [],
};

describe('buildSystemPrompt', () => {
  it('includes cat judge persona in zh', () => {
    const p = buildSystemPrompt('zh');
    expect(p).toMatch(/Chief Justice Whiskers|猫猫大法官/);
    expect(p).toMatch(/以和为贵/);
    expect(p).toMatch(/罪/);
  });

  it('produces english variant', () => {
    const p = buildSystemPrompt('en');
    expect(p).toMatch(/Whiskers/i);
    expect(p).toMatch(/reconciliation|reconcile/i);
    expect(p).not.toMatch(/以和为贵/);
  });
});

describe('buildUserPrompt', () => {
  it('embeds both parties statements in first trial', () => {
    const u = buildUserPrompt(baseCase, false);
    expect(u).toContain('小美');
    expect(u).toContain('阿明');
    expect(u).toContain('芝士条');
  });

  it('embeds first verdict + supplements in appeal trial', () => {
    const withVerdict: Case = {
      ...baseCase,
      firstVerdict: {
        core_conflict: 'x',
        responsibility: { left: 70, right: 30 },
        crimes: [{ side: 'left', charge: 'x', severity: '重罪', reasoning: 'x' }],
        reconciliation_checklist: [{ id: '1', task: 'x', intimacy_points: 10 }],
        cat_closing_line: 'x',
      },
      appeal: {
        appellant: 'left',
        appellantSupplement: '她昨天也吃了我留的饼干',
        respondentSupplement: '那是过期的',
      },
    };
    const u = buildUserPrompt(withVerdict, true);
    expect(u).toContain('一审');
    expect(u).toContain('饼干');
    expect(u).toContain('过期');
  });
});
```

- [ ] **Step 2: 跑测试 FAIL**

```bash
npm test lib/prompts.test.ts
```

- [ ] **Step 3: 实现 prompts**

`lib/prompts.ts`:

```ts
import type { Case } from './schema';

// 中文版系统提示——重点：以和为贵、玩梗罪名、正向和解方案
const SYSTEM_ZH = `你是「Chief Justice Whiskers」——一只三花猫大法官，专门调解情侣之间的小吵小闹。

【原则】
1. **以和为贵**：目的是让双方感情更好，绝不惩罚。
2. **公正但温柔**：责任比例基于事实分析，但用词永远轻松可爱。
3. **罪名要玩梗**：把日常小事包装成庄严罪名，例如：
   ·「独食未告知罪」
   ·「夺被子未通报罪」
   ·「深夜发朋友圈不@罪」
   ·「已读不回一小时罪」
   ·「芝士条分配失衡罪」
4. **和解方案必须是增进感情的行动**：
   ·一起做饭、看电影、散步
   ·鼻尖碰碰、抱抱 30 秒
   ·手写一张小纸条
   绝不写"罚款"、"跪键盘"等负面惩罚。
5. **语气示例**：
   ·「本喵审阅卷宗后...」
   ·「根据神圣的《共享零食公约》第三条...」
   ·「甲方喵，你可要好好反省呀 🐾」
   ·「乙方喵，别气啦，让本喵好好断一断这个案子 ✧」

【责任比例】
- 基于陈述内容分析，可以 50/50、60/40、70/30 甚至 80/20
- 但极少 90/10 或 100/0——即使一方明显更过分，另一方多少也有可以反思的地方
- 无论比例如何，罪名描述保持可爱轻松

【输出】通过 submit_verdict tool 输出结构化 JSON。绝不用自由文字回应。`;

// 英文版系统提示——等价直译 + 英文文化梗
const SYSTEM_EN = `You are "Chief Justice Whiskers"—a calico cat judge who mediates couples' little squabbles.

【Principles】
1. **Reconciliation First**: The goal is to bring the couple closer, never to punish.
2. **Fair but Gentle**: Responsibility ratios are based on facts, but wording is always playful and cute.
3. **Playful Charges**: Wrap everyday incidents into solemn-sounding crimes, e.g.:
   · "Petty Snack Hoarding Felony"
   · "Blanket Kidnapping in the First Degree"
   · "Failure to Tag on Social Media"
   · "Read-Receipt Delay Misdemeanor"
4. **Reconciliation Tasks must strengthen the bond**:
   · Cook a meal together, watch a movie, take a walk
   · Nose-boop, 30-second hug
   · Handwrite a little note
   NEVER punitive tasks like fines or "kneel on keyboards."
5. **Voice Examples**:
   · "After careful mrew-view of the docket..."
   · "Pursuant to the sacred Shared Snacks Accord, Article 3..."
   · "Plaintiff-meow, please reflect a wee bit 🐾"

【Responsibility Ratio】
- Analyze the statements and assign 50/50, 60/40, 70/30 or 80/20 as appropriate
- Very rarely 90/10 or 100/0—even the more-at-fault party has some room for reflection
- Regardless of the ratio, keep the charges playful

【Output】Use the submit_verdict tool for structured JSON. NEVER respond in free text.`;

// 根据 language 选中英文系统 prompt
export function buildSystemPrompt(language: 'zh' | 'en'): string {
  return language === 'zh' ? SYSTEM_ZH : SYSTEM_EN;
}

// 拼装 user message——一审 or 二审
export function buildUserPrompt(caseData: Case, isAppeal: boolean): string {
  const { left, right, language } = caseData;

  const zh = {
    label: (isAppeal ? '二审复核' : '本次调解'),
    plaintiff: '甲方',
    defendant: '乙方',
    narrative: '发生了什么',
    grievance: '为何生气',
    firstVerdictTitle: '一审判决摘要',
    appealTitle: '上诉方补陈',
    respondTitle: '对方回应',
    noResponse: '（对方选择不回应）',
    instruction: isAppeal
      ? '请综合一审结论与新证据/回应重新裁定。可以维持、调整比例、或彻底翻案。'
      : '请为以上案情做出可爱风格的判决。',
  };

  const en = {
    label: (isAppeal ? 'Appeal Review' : 'Mediation Session'),
    plaintiff: 'Plaintiff (Left)',
    defendant: 'Defendant (Right)',
    narrative: 'What Happened',
    grievance: 'Why They Are Upset',
    firstVerdictTitle: 'First-Trial Verdict Summary',
    appealTitle: 'Appellant Supplement',
    respondTitle: 'Respondent Reply',
    noResponse: '(Respondent chose not to reply)',
    instruction: isAppeal
      ? 'Consider the first verdict + new supplements. You may uphold, adjust the ratio, or fully overturn.'
      : 'Deliver a cute-style verdict for the case above.',
  };

  const t = language === 'zh' ? zh : en;

  let prompt = `【${t.label}】

【${t.plaintiff} · ${left.name}】
${t.narrative}: ${left.narrative}
${t.grievance}: ${left.grievance}

【${t.defendant} · ${right.name}】
${t.narrative}: ${right.narrative}
${t.grievance}: ${right.grievance}
`;

  if (isAppeal && caseData.firstVerdict && caseData.appeal) {
    // 二审——把一审判决 JSON + 双方补陈都塞进去
    prompt += `

【${t.firstVerdictTitle}】
${JSON.stringify(caseData.firstVerdict, null, 2)}

【${t.appealTitle}（${caseData.appeal.appellant === 'left' ? left.name : right.name}）】
${caseData.appeal.appellantSupplement}

【${t.respondTitle}】
${caseData.appeal.respondentSupplement ?? t.noResponse}
`;
  }

  prompt += `

${t.instruction}`;

  return prompt;
}
```

- [ ] **Step 4: 跑测试 PASS**

```bash
npm test lib/prompts.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts lib/prompts.test.ts
git commit -m "feat(lib): add bilingual system + user prompts for judge"
```

---

## Task 8: Bedrock 客户端 + 流式解析

**Files:**
- Create: `lib/bedrock.ts`
- Create: `lib/bedrock.test.ts`

- [ ] **Step 1: 写测试（mock AWS SDK）**

`lib/bedrock.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 在 import 之前 mock @aws-sdk 模块
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn(),
    ConverseStreamCommand: vi.fn(),
  };
});

describe('streamVerdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_BEARER_TOKEN_BEDROCK = 'test-token';
    process.env.AWS_REGION = 'us-east-1';
    process.env.BEDROCK_MODEL_ID = 'anthropic.claude-sonnet-4-6';
  });

  it('parses streamed tool_use JSON and emits section events', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    // Mock 流：模拟 Bedrock 一段一段吐 JSON
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"core_conflict":"芝士战争"' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"responsibility":{"left":70,"right":30}' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"crimes":[{"side":"left","charge":"独食罪","severity":"重罪","reasoning":"x"}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"reconciliation_checklist":[{"id":"1","task":"抱抱","intimacy_points":10}]' } } } };
      yield { contentBlockDelta: { delta: { toolUse: { input: ',"cat_closing_line":"退庭 🐾"}' } } } };
      yield { messageStop: {} };
    };
    (BedrockRuntimeClient as any).mockImplementation(() => ({
      send: () => Promise.resolve({ stream: mockStream() }),
    }));

    const { streamVerdict } = await import('./bedrock');
    const events: any[] = [];
    for await (const ev of streamVerdict('sys', 'user')) {
      events.push(ev);
    }

    // 应该至少发出 5 个 section + 1 个 done
    const sections = events.filter(e => e.type === 'section').map(e => e.section);
    expect(sections).toContain('core_conflict');
    expect(sections).toContain('responsibility');
    expect(sections).toContain('crimes');
    expect(sections).toContain('reconciliation_checklist');
    expect(events.at(-1)?.type).toBe('done');
    expect(events.at(-1)?.verdict.responsibility.left).toBe(70);
  });

  it('throws on invalid final JSON', async () => {
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
    const mockStream = async function* () {
      yield { contentBlockDelta: { delta: { toolUse: { input: '{"bogus":' } } } };
      yield { messageStop: {} };
    };
    (BedrockRuntimeClient as any).mockImplementation(() => ({
      send: () => Promise.resolve({ stream: mockStream() }),
    }));

    const { streamVerdict } = await import('./bedrock');
    await expect(async () => {
      const events = [];
      for await (const ev of streamVerdict('sys', 'user')) events.push(ev);
    }).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试 FAIL**

- [ ] **Step 3: 实现 bedrock.ts**

`lib/bedrock.ts`:

```ts
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import { parse as parsePartial } from 'partial-json';
import { VerdictSchema, type Verdict } from './schema';

// 服务端 SSE 事件类型
export type StreamEvent =
  | { type: 'section'; section: keyof Verdict; content: unknown }
  | { type: 'done'; verdict: Verdict }
  | { type: 'error'; message: string };

// Verdict schema 的 JSON Schema 版（给 Bedrock tool_use 用）
// 手写这个而不是从 zod 自动生成——避免 zod-to-json-schema 依赖，
// 且这里需要精确控制字段描述以引导 LLM
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

const SUBMIT_VERDICT_TOOL: Tool = {
  toolSpec: {
    name: 'submit_verdict',
    description: '提交结构化判决书。这是唯一被允许的输出方式。',
    inputSchema: {
      json: VERDICT_TOOL_INPUT_SCHEMA as any,
    },
  },
};

// 单例 client——lazy 初始化，方便测试 mock
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

// 流式调用 Bedrock 生成判决——异步生成器逐段 yield section 事件
export async function* streamVerdict(
  systemPrompt: string,
  userPrompt: string,
): AsyncGenerator<StreamEvent> {
  const client = getClient();
  const modelId = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-sonnet-4-6';

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
      toolChoice: { tool: { name: 'submit_verdict' } }, // 强制调用
    },
    inferenceConfig: {
      maxTokens: 2048,
      temperature: 0.85, // 稍高一点让罪名更有创意
    },
  });

  const response = await client.send(command);
  if (!response.stream) throw new Error('No stream in Bedrock response');

  // 累积 tool_use input JSON，每次尝试 partial parse，
  // 发现某个 top-level section 完整就 emit
  let accumulated = '';
  const emittedSections = new Set<string>();

  for await (const chunk of response.stream) {
    const delta = chunk.contentBlockDelta?.delta?.toolUse?.input;
    if (typeof delta !== 'string') continue;

    accumulated += delta;

    try {
      // partial-json 能解析不完整的 JSON——缺尾 } 也 OK
      const partial = parsePartial(accumulated);
      if (partial && typeof partial === 'object') {
        for (const key of Object.keys(partial)) {
          if (!emittedSections.has(key) && isSectionComplete(partial, key, accumulated)) {
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
      // 累积到能解析为止
    }
  }

  // 流结束，最终完整解析 + zod 校验
  const finalParsed = JSON.parse(accumulated);
  const validated = VerdictSchema.parse(finalParsed);
  yield { type: 'done', verdict: validated };
}

// 简单判断：某个 top-level key 后面是否已出现 `,` 或 `}`（表示该字段值已完整）
function isSectionComplete(partial: any, key: string, raw: string): boolean {
  const val = partial[key];
  if (val === undefined || val === null) return false;

  // 找到 "key": 出现的位置
  const keyPattern = new RegExp(`"${key}"\\s*:`);
  const match = raw.match(keyPattern);
  if (!match) return false;
  const afterKey = raw.slice(match.index! + match[0].length);
  // 简化判断：若 afterKey 里出现下一个逗号 + 引号（下一 key 的开始），或收尾 }，则本 section 完成
  const closingDepth = countDepth(afterKey);
  return closingDepth.balanced || /,\s*"/m.test(afterKey);
}

function countDepth(s: string): { balanced: boolean } {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
    if (depth < 0) return { balanced: true };
  }
  return { balanced: false };
}
```

- [ ] **Step 4: 跑测试 PASS**

```bash
npm test lib/bedrock.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/bedrock.ts lib/bedrock.test.ts
git commit -m "feat(lib): Bedrock client with streaming tool_use JSON parser"
```

---

## Task 9: 房间存储层（Upstash Redis）

**Files:**
- Create: `lib/rooms.ts`
- Create: `lib/rooms.test.ts`

- [ ] **Step 1: 写测试（mock Upstash）**

`lib/rooms.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory fake redis
const fakeStore = new Map<string, any>();
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: async (k: string) => fakeStore.get(k) ?? null,
    set: async (k: string, v: any, opts?: any) => { fakeStore.set(k, v); return 'OK'; },
    del: async (k: string) => { fakeStore.delete(k); return 1; },
    exists: async (k: string) => fakeStore.has(k) ? 1 : 0,
  })),
}));

beforeEach(() => {
  fakeStore.clear();
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
    expect((await joinRoom(code, hostToken)).role).toBe('left');

    const guestToken = 'guest-token-xyz';
    expect((await joinRoom(code, guestToken)).role).toBe('right');

    // 相同 token 二次访问角色一致
    expect((await joinRoom(code, guestToken)).role).toBe('right');
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
});
```

- [ ] **Step 2: 跑测试 FAIL**

- [ ] **Step 3: 实现 rooms.ts**

`lib/rooms.ts`:

```ts
import { Redis } from '@upstash/redis';
import { customAlphabet } from 'nanoid';
import type { Case, PartyStatement, Verdict } from './schema';

// 6 位大写字母数字房间码——去掉 0OIL 避免混淆
const generateCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);

const TTL_SECONDS = 24 * 60 * 60; // 24 小时

// Upstash 客户端 lazy 初始化
let redisInstance: Redis | null = null;
function redis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisInstance;
}

// Room 内部结构——Case 之外还存 token → role 映射
type Room = {
  case: Case;
  hostToken: string;         // 房主 token
  guestToken?: string;       // 首次访问的非房主自动占位
};

const roomKey = (code: string) => `room:${code}`;

// 创建房间——房主自动 left
export async function createRoom(language: 'zh' | 'en'): Promise<{ code: string; hostToken: string }> {
  const code = generateCode();
  const hostToken = crypto.randomUUID();

  const initialCase: Case = {
    id: code,
    language,
    mode: 'remote',
    createdAt: Date.now(),
    left: { name: '', narrative: '', grievance: '' },
    right: { name: '', narrative: '', grievance: '' },
    intimacyScore: 0,
    completedChecklist: [],
  };

  const room: Room = { case: initialCase, hostToken };
  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
  return { code, hostToken };
}

// 加入/访问房间——返回该 token 的 role 和 case
export async function joinRoom(
  code: string,
  token: string,
): Promise<{ case: Case; role: 'left' | 'right' } | null> {
  const room = (await redis().get<Room>(roomKey(code)));
  if (!room) return null;

  let role: 'left' | 'right';
  if (token === room.hostToken) {
    role = 'left';
  } else if (room.guestToken === token) {
    role = 'right';
  } else if (!room.guestToken) {
    // 首次访问的第二人——记为 guest
    room.guestToken = token;
    await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
    role = 'right';
  } else {
    // 已有 guest，第三方拒绝——但这里我们退化：仍返回观察者视角，role 默认 right
    role = 'right';
  }

  return { case: room.case, role };
}

// 获取原始房间（不带 token 校验）
export async function getRoom(code: string): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  return room?.case ?? null;
}

// 提交陈述——按 token 确定写入哪一侧
export async function submitStatement(
  code: string,
  token: string,
  statement: PartyStatement,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  const side = token === room.hostToken ? 'left' : 'right';
  room.case[side] = { ...statement, submittedAt: Date.now() };

  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
  return room.case;
}

// 写入判决（由服务端在双方都提交后调用）
export async function saveVerdict(
  code: string,
  verdict: Verdict,
  isAppeal: boolean,
): Promise<void> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return;

  if (isAppeal) {
    room.case.finalVerdict = verdict;
  } else {
    room.case.firstVerdict = verdict;
    room.case.firstVerdictDecisions = {};
  }

  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
}

// 记录接受判决
export async function acceptVerdict(code: string, token: string): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  const side = token === room.hostToken ? 'left' : 'right';
  room.case.firstVerdictDecisions = room.case.firstVerdictDecisions ?? {};
  room.case.firstVerdictDecisions[side === 'left' ? 'leftAccepted' : 'rightAccepted'] = true;

  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
  return room.case;
}

// 上诉——立即抢占，即使对方已接受
export async function submitAppeal(
  code: string,
  token: string,
  supplement: string,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  const side: 'left' | 'right' = token === room.hostToken ? 'left' : 'right';
  room.case.appeal = {
    appellant: side,
    appellantSupplement: supplement,
  };

  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
  return room.case;
}

// 对方回应上诉
export async function respondToAppeal(
  code: string,
  token: string,
  supplement: string,
): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room?.case.appeal) return null;

  room.case.appeal.respondentSupplement = supplement;
  room.case.appeal.respondedAt = Date.now();

  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
  return room.case;
}

// 勾选和解任务
export async function checkTask(code: string, taskId: string, points: number): Promise<Case | null> {
  const room = await redis().get<Room>(roomKey(code));
  if (!room) return null;

  if (!room.case.completedChecklist.includes(taskId)) {
    room.case.completedChecklist.push(taskId);
    room.case.intimacyScore += points;
  }
  await redis().set(roomKey(code), room, { ex: TTL_SECONDS });
  return room.case;
}
```

- [ ] **Step 4: 跑测试 PASS**

```bash
npm test lib/rooms.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/rooms.ts lib/rooms.test.ts
git commit -m "feat(lib): Upstash-backed room storage with 24h TTL"
```

---

## Task 10: 亲密度累计辅助（客户端 state 逻辑）

**Files:**
- Create: `lib/intimacy.ts`
- Create: `lib/intimacy.test.ts`

- [ ] **Step 1: 写测试**

`lib/intimacy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toggleTask, totalPossibleIntimacy } from './intimacy';
import type { Case, Verdict } from './schema';

const verdict: Verdict = {
  core_conflict: 'x',
  responsibility: { left: 50, right: 50 },
  crimes: [{ side: 'left', charge: 'x', severity: '重罪', reasoning: 'x' }],
  reconciliation_checklist: [
    { id: 'a', task: 't1', intimacy_points: 10 },
    { id: 'b', task: 't2', intimacy_points: 15 },
    { id: 'c', task: 't3', intimacy_points: 5 },
  ],
  cat_closing_line: 'x',
};

const baseCase: Case = {
  id: '1',
  language: 'zh',
  mode: 'single',
  createdAt: 0,
  left: { name: 'a', narrative: 'a', grievance: 'a' },
  right: { name: 'b', narrative: 'b', grievance: 'b' },
  firstVerdict: verdict,
  intimacyScore: 0,
  completedChecklist: [],
};

describe('toggleTask', () => {
  it('checks a task and adds its points', () => {
    const next = toggleTask(baseCase, 'a', verdict);
    expect(next.completedChecklist).toContain('a');
    expect(next.intimacyScore).toBe(10);
  });

  it('unchecks a task and removes its points', () => {
    const checked = toggleTask(baseCase, 'a', verdict);
    const unchecked = toggleTask(checked, 'a', verdict);
    expect(unchecked.completedChecklist).not.toContain('a');
    expect(unchecked.intimacyScore).toBe(0);
  });

  it('is idempotent for unknown task ids', () => {
    const next = toggleTask(baseCase, 'zzz', verdict);
    expect(next).toEqual(baseCase);
  });
});

describe('totalPossibleIntimacy', () => {
  it('sums all task points', () => {
    expect(totalPossibleIntimacy(verdict)).toBe(30);
  });
});
```

- [ ] **Step 2: 跑测试 FAIL**

- [ ] **Step 3: 实现**

`lib/intimacy.ts`:

```ts
import type { Case, Verdict } from './schema';

// 勾选/取消勾选一个和解任务，返回新的 Case（immutable）
export function toggleTask(caseData: Case, taskId: string, verdict: Verdict): Case {
  const task = verdict.reconciliation_checklist.find(t => t.id === taskId);
  if (!task) return caseData; // 未知 taskId 直接返回原态

  const isChecked = caseData.completedChecklist.includes(taskId);

  if (isChecked) {
    // 取消勾选——移除 id + 扣分
    return {
      ...caseData,
      completedChecklist: caseData.completedChecklist.filter(id => id !== taskId),
      intimacyScore: caseData.intimacyScore - task.intimacy_points,
    };
  } else {
    // 勾选——加 id + 加分
    return {
      ...caseData,
      completedChecklist: [...caseData.completedChecklist, taskId],
      intimacyScore: caseData.intimacyScore + task.intimacy_points,
    };
  }
}

// 计算某个判决下亲密度的理论满分
export function totalPossibleIntimacy(verdict: Verdict): number {
  return verdict.reconciliation_checklist.reduce(
    (sum, t) => sum + t.intimacy_points,
    0,
  );
}
```

- [ ] **Step 4: 跑测试 PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/intimacy.ts lib/intimacy.test.ts
git commit -m "feat(lib): intimacy score toggle helper"
```

---

# M3 · API 路由

## Task 11: `/api/verdict` · SSE 流式判决

**Files:**
- Create: `app/api/verdict/route.ts`

- [ ] **Step 1: 实现 route handler**

`app/api/verdict/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { CaseSchema } from '@/lib/schema';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts';
import { streamVerdict } from '@/lib/bedrock';

// Node runtime——Bedrock SDK 需要 Node，不用 Edge
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parseResult = CaseSchema.safeParse(body.case);
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: 'Invalid case', details: parseResult.error.issues }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const caseData = parseResult.data;
  const isAppeal: boolean = body.isAppeal === true;

  const systemPrompt = buildSystemPrompt(caseData.language);
  const userPrompt = buildUserPrompt(caseData, isAppeal);

  // 用 ReadableStream 手动构 SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        for await (const ev of streamVerdict(systemPrompt, userPrompt)) {
          send(ev);
        }
      } catch (err) {
        // 猫猫口吻的错误——但 error 事件仍返回原因给前端 log
        send({ type: 'error', message: (err as Error).message ?? 'unknown' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: 手动 smoke test（需要 Bedrock token）**

创建 `.env.local`（**不入 git**）——写入 token（从我们之前探测的结果）：

```env
AWS_BEARER_TOKEN_BEDROCK=<user 提供的 token>
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6
```

启动 dev server：

```bash
npm run dev
```

新终端跑：

```bash
curl -N -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{
    "case": {
      "id": "test-1",
      "language": "zh",
      "mode": "single",
      "createdAt": 1,
      "left": {"name":"小美","narrative":"他吃完了我的芝士条","grievance":"心里没我"},
      "right": {"name":"阿明","narrative":"就一根我没意识","grievance":"为一根发火太过"},
      "intimacyScore": 0,
      "completedChecklist": []
    },
    "isAppeal": false
  }'
```

预期：多行 `data: {"type":"section", ...}`，最后 `data: {"type":"done", "verdict": {...}}`。

- [ ] **Step 3: Commit**

```bash
git add app/api/verdict/route.ts
git commit -m "feat(api): SSE streaming verdict endpoint"
```

---

## Task 12: `/api/rooms` · 创建房间

**Files:**
- Create: `app/api/rooms/route.ts`

- [ ] **Step 1: 实现**

`app/api/rooms/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRoom } from '@/lib/rooms';

export const runtime = 'nodejs';

const CreateRoomBody = z.object({
  language: z.enum(['zh', 'en']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = CreateRoomBody.safeParse(body);
  if (!parse.success) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { code, hostToken } = await createRoom(parse.data.language);
  return Response.json({ code, hostToken });
}
```

- [ ] **Step 2: 手动 smoke test**

```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"language":"zh"}'
```

预期：`{"code":"ABC123","hostToken":"uuid..."}`。

（如果 UPSTASH_REDIS_REST_URL 还没配，先在 Upstash console 创建一个免费 Redis DB，把 URL/TOKEN 加到 `.env.local`。）

- [ ] **Step 3: Commit**

```bash
git add app/api/rooms/route.ts
git commit -m "feat(api): create room endpoint"
```

---

## Task 13: `/api/rooms/[code]` · GET/PATCH 房间状态

**Files:**
- Create: `app/api/rooms/[code]/route.ts`

- [ ] **Step 1: 实现**

`app/api/rooms/[code]/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  joinRoom,
  submitStatement,
  acceptVerdict,
  submitAppeal,
  respondToAppeal,
  checkTask,
  saveVerdict,
  getRoom,
} from '@/lib/rooms';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompts';
import { streamVerdict } from '@/lib/bedrock';
import type { Case } from '@/lib/schema';

export const runtime = 'nodejs';

// 在返回给客户端前 mask 对方还没提交的陈述内容
function maskOpponent(caseData: Case, myRole: 'left' | 'right'): Case {
  const opp: 'left' | 'right' = myRole === 'left' ? 'right' : 'left';
  const oppData = caseData[opp];
  if (oppData.narrative || oppData.grievance) {
    // 已提交——不 mask
    return caseData;
  }
  return {
    ...caseData,
    [opp]: { ...oppData, narrative: '', grievance: '', name: oppData.name || '' },
  };
}

// GET —— 拉当前状态
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const result = await joinRoom(code, token);
  if (!result) {
    return Response.json({ error: 'Room not found' }, { status: 404 });
  }
  return Response.json({
    case: maskOpponent(result.case, result.role),
    myRole: result.role,
    opponentHasSubmitted: !!result.case[result.role === 'left' ? 'right' : 'left'].submittedAt,
  });
}

// PATCH —— 各种 action
const PatchBody = z.object({
  token: z.string(),
  action: z.enum([
    'submit_statement',
    'accept_verdict',
    'submit_appeal',
    'respond_to_appeal',
    'check_task',
  ]),
  payload: z.any(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await req.json();
  const parse = PatchBody.safeParse(body);
  if (!parse.success) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const { token, action, payload } = parse.data;

  let updated: Case | null = null;

  switch (action) {
    case 'submit_statement':
      updated = await submitStatement(code, token, payload);
      // 检查双方都提交了 → 自动触发判决生成
      if (updated?.left.submittedAt && updated?.right.submittedAt && !updated.firstVerdict) {
        void generateVerdictForRoom(code, updated, false);
      }
      break;
    case 'accept_verdict':
      updated = await acceptVerdict(code, token);
      break;
    case 'submit_appeal':
      updated = await submitAppeal(code, token, payload.supplement);
      break;
    case 'respond_to_appeal':
      updated = await respondToAppeal(code, token, payload.supplement);
      if (updated?.appeal) {
        // 对方回应后触发二审
        void generateVerdictForRoom(code, updated, true);
      }
      break;
    case 'check_task':
      updated = await checkTask(code, payload.taskId, payload.points);
      break;
  }

  if (!updated) return Response.json({ error: 'Room not found' }, { status: 404 });
  return Response.json({ case: updated });
}

// 后台生成判决——不 block PATCH 响应，写回 Redis 后客户端轮询能拿到
async function generateVerdictForRoom(code: string, caseData: Case, isAppeal: boolean) {
  try {
    const sys = buildSystemPrompt(caseData.language);
    const user = buildUserPrompt(caseData, isAppeal);
    let verdict = null;
    for await (const ev of streamVerdict(sys, user)) {
      if (ev.type === 'done') verdict = ev.verdict;
    }
    if (verdict) {
      await saveVerdict(code, verdict, isAppeal);
    }
  } catch (err) {
    console.error('[verdict-gen] failed for room', code, err);
    // MVP：失败就吞掉，用户重试可通过前端"重敲法槌"按钮显式触发
  }
}
```

- [ ] **Step 2: 手动 smoke test**

用之前创建的 room code：

```bash
CODE=<从 Task 12 拿的>
TOKEN=<hostToken>

# GET 空房间
curl "http://localhost:3000/api/rooms/$CODE?token=$TOKEN"

# 提交甲方陈述
curl -X PATCH "http://localhost:3000/api/rooms/$CODE" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"action\":\"submit_statement\",\"payload\":{\"name\":\"小美\",\"narrative\":\"他吃了芝士\",\"grievance\":\"生气\"}}"
```

预期：返回 `{"case":{...left: {name:"小美",...}}}`。

- [ ] **Step 3: Commit**

```bash
git add app/api/rooms/[code]/route.ts
git commit -m "feat(api): room GET/PATCH with auto-verdict trigger"
```

---

# M4 · React 组件

## Task 14: LanguageToggle + i18n context

**Files:**
- Create: `lib/i18n.ts`
- Create: `messages/zh.json`
- Create: `messages/en.json`
- Create: `components/LanguageProvider.tsx`
- Create: `components/LanguageToggle.tsx`

- [ ] **Step 1: 创建 messages 文件**

`messages/zh.json`:

```json
{
  "app": {
    "title": "🐱⚖️ 猫猫大法官",
    "subtitle": "Feline Court · Est. 2026",
    "start": "开始审判 ⚖️",
    "tagline": "本喵今日为您调解 ✧"
  },
  "mode": {
    "title": "选择审判方式",
    "single": "一起用一台手机",
    "single_desc": "两人共用一个屏幕，最简单",
    "remote": "分别在两台手机",
    "remote_desc": "生成 6 位房间码，各自打开链接",
    "your_code": "你的房间码",
    "share_hint": "把这串码告诉对方"
  },
  "input": {
    "your_name": "你的名字",
    "what_happened": "发生了什么",
    "why_angry": "你为什么生气",
    "submit": "🐱 交给猫猫审判 ⚖️",
    "waiting_opponent": "对方还在书写状纸 🐾..."
  },
  "animation": {
    "thinking": "本喵正在思考",
    "generating": "生成判决中...",
    "second_thinking": "本喵重新审阅卷宗..."
  },
  "verdict": {
    "title": "⚖️ 判决书",
    "final_title": "🔒 终审判决",
    "core_conflict": "核心矛盾",
    "responsibility": "责任比例",
    "declaration": "本喵宣判",
    "reconciliation": "和解方案",
    "accept": "接受判决 ✓",
    "appeal": "我要上诉 ↑",
    "accept_only": "接受并执行",
    "waiting_opponent_decision": "等待对方决定...",
    "felony": "重罪",
    "misdemeanor": "轻罪"
  },
  "appeal": {
    "title": "二审补陈",
    "your_supplement": "补充新信息",
    "placeholder": "如：她昨天也吃了我留的饼干...",
    "waiting_response": "对方回应中",
    "seconds": "秒",
    "submit": "提交二审 →",
    "skipped": "对方选择不补充"
  },
  "checklist": {
    "title": "和解任务",
    "intimacy_added": "亲密度",
    "total": "亲密度",
    "success": "和解成功！",
    "next_case": "开启下一案 →"
  },
  "error": {
    "sleepy": "本喵犯困了，再敲一次法槌？",
    "archived": "本案卷宗已归档 📂 · 请开启新案",
    "retry": "重敲法槌"
  }
}
```

`messages/en.json`:

```json
{
  "app": {
    "title": "🐱⚖️ Chief Justice Whiskers",
    "subtitle": "Feline Court · Est. 2026",
    "start": "Open Court ⚖️",
    "tagline": "Purr-siding today, meow ✧"
  },
  "mode": {
    "title": "Pick a mode",
    "single": "One phone, together",
    "single_desc": "Share a single screen — simplest",
    "remote": "Two phones, separately",
    "remote_desc": "Generate a 6-char room code",
    "your_code": "Your room code",
    "share_hint": "Send this code to the other side"
  },
  "input": {
    "your_name": "Your name",
    "what_happened": "What happened",
    "why_angry": "Why you're upset",
    "submit": "🐱 Submit to the Cat ⚖️",
    "waiting_opponent": "The other side is still writing 🐾..."
  },
  "animation": {
    "thinking": "The cat is deliberating",
    "generating": "Drafting the verdict...",
    "second_thinking": "The cat is re-reviewing the docket..."
  },
  "verdict": {
    "title": "⚖️ Verdict",
    "final_title": "🔒 Final Verdict",
    "core_conflict": "Core Conflict",
    "responsibility": "Responsibility Ratio",
    "declaration": "Ruling",
    "reconciliation": "Reconciliation",
    "accept": "Accept ✓",
    "appeal": "Appeal ↑",
    "accept_only": "Accept & Execute",
    "waiting_opponent_decision": "Waiting for the other side...",
    "felony": "Felony",
    "misdemeanor": "Misdemeanor"
  },
  "appeal": {
    "title": "Appeal Supplement",
    "your_supplement": "Add new info",
    "placeholder": "e.g., She ate my cookies yesterday too...",
    "waiting_response": "Awaiting reply",
    "seconds": "s",
    "submit": "Submit Appeal →",
    "skipped": "The other side declined to reply"
  },
  "checklist": {
    "title": "Reconciliation Tasks",
    "intimacy_added": "Intimacy",
    "total": "Intimacy",
    "success": "Reconciled! 💚",
    "next_case": "New Case →"
  },
  "error": {
    "sleepy": "The cat is drowsy — try again?",
    "archived": "This case has been archived 📂",
    "retry": "Bang the gavel again"
  }
}
```

- [ ] **Step 2: 实现 i18n context（简化版，不用 next-intl 完整功能）**

`lib/i18n.ts`:

```ts
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';

export const translations = { zh, en } as const;
export type Language = 'zh' | 'en';
export type TranslationTree = typeof zh;
```

`components/LanguageProvider.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, type Language, type TranslationTree } from '@/lib/i18n';

type Ctx = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationTree;
};

const LanguageContext = createContext<Ctx | null>(null);

// 本地存储 key——记住用户偏好
const STORAGE_KEY = 'feline-court-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');

  // 首次挂载时从 localStorage 读
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved === 'zh' || saved === 'en') setLanguageState(saved);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
```

`components/LanguageToggle.tsx`:

```tsx
'use client';

import { useLanguage } from './LanguageProvider';

// 顶部右上角的中英切换开关
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
      className="px-3 py-1 rounded-full border-2 border-sand bg-cream text-cinnamon text-xs font-bold hover:bg-honey transition"
      aria-label="Toggle language"
    >
      {language === 'zh' ? '中 / EN' : 'EN / 中'}
    </button>
  );
}
```

- [ ] **Step 3: 在 layout.tsx 里 wrap Provider**

修改 `app/layout.tsx`：

```tsx
import { Nunito } from 'next/font/google';
import { LanguageProvider } from '@/components/LanguageProvider';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
});

export const metadata = {
  title: '🐱 猫猫大法官 · Feline Court',
  description: 'AI 调解法官——用可爱的方式解决情侣小争吵',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={nunito.variable}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(i18n): bilingual (zh/en) message files + provider + toggle"
```

---

## Task 15: JudgeCat 组件（含动画状态）

**Files:**
- Create: `components/JudgeCat.tsx`

- [ ] **Step 1: 实现**

`components/JudgeCat.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

// 猫猫头像的几种状态：静态、审判中（左右摇）、震怒（皱眉？留白，MVP 用变体动画代替）
type CatState = 'idle' | 'judging' | 'reviewing';

type Props = {
  state?: CatState;
  size?: number; // 直径 px
  showBadge?: boolean;
};

// 猫猫组件——所有屏共用
export function JudgeCat({ state = 'idle', size = 240, showBadge = false }: Props) {
  // 不同 state 用不同 framer motion 变体
  const variants = {
    idle: { rotate: 0, y: 0 },
    judging: {
      rotate: [-3, 3, -3],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    },
    reviewing: {
      y: [0, -4, 0],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
  } as const;

  return (
    <div className="relative inline-block">
      <motion.div
        animate={state}
        variants={variants}
        className="rounded-2xl overflow-hidden p-2"
        style={{
          background: 'linear-gradient(135deg, #e8a583 0%, #c88a6a 100%)',
          boxShadow: '0 8px 20px rgba(139, 90, 71, 0.25)',
          width: size + 16,
          height: size + 16,
        }}
      >
        <Image
          src="/judge-cat.png"
          alt="Chief Justice Whiskers"
          width={size}
          height={size}
          className="rounded-xl object-cover"
          priority
        />
      </motion.div>
      {showBadge && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-rose text-cream text-xs font-bold border-2 border-cream shadow-md whitespace-nowrap">
          CHIEF JUSTICE 🐾
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/JudgeCat.tsx
git commit -m "feat(ui): JudgeCat component with idle/judging/reviewing states"
```

---

## Task 16: CaseForm 组件（单侧输入表单）

**Files:**
- Create: `components/CaseForm.tsx`

- [ ] **Step 1: 实现**

`components/CaseForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useLanguage } from './LanguageProvider';
import type { PartyStatement } from '@/lib/schema';

type Props = {
  side: 'left' | 'right';           // 决定颜色（甲方玫瑰，乙方陶土）
  initialValue?: Partial<PartyStatement>;
  onChange: (val: PartyStatement) => void;
  onSubmit?: () => void;
  disabled?: boolean;
};

// 单侧的陈述表单——三个字段：名字、发生了什么、生气理由
export function CaseForm({ side, initialValue, onChange, onSubmit, disabled }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialValue?.name ?? '');
  const [narrative, setNarrative] = useState(initialValue?.narrative ?? '');
  const [grievance, setGrievance] = useState(initialValue?.grievance ?? '');

  const accent = side === 'left' ? 'text-rose' : 'text-terra';
  const border = side === 'left' ? 'border-rose/40' : 'border-terra/40';

  // 任意字段变化都往上抛
  const update = (patch: Partial<PartyStatement>) => {
    const next = { name, narrative, grievance, ...patch };
    setName(next.name);
    setNarrative(next.narrative);
    setGrievance(next.grievance);
    onChange(next);
  };

  return (
    <div className={`rounded-2xl bg-cream p-6 border-2 ${border} shadow-md relative`}>
      <div className={`text-xs font-bold uppercase tracking-wider ${accent} mb-2`}>
        {side === 'left' ? '📝 甲方 · Plaintiff' : '📝 乙方 · Defendant'}
      </div>

      <label className="block text-xs uppercase tracking-wide text-cinnamon mt-3 mb-1">
        {t.input.your_name}
      </label>
      <input
        className="w-full rounded-xl bg-white border-2 border-sand px-4 py-2 text-cocoa outline-none focus:border-terra"
        value={name}
        onChange={e => update({ name: e.target.value })}
        disabled={disabled}
      />

      <label className="block text-xs uppercase tracking-wide text-cinnamon mt-3 mb-1">
        {t.input.what_happened}
      </label>
      <textarea
        className="w-full rounded-xl bg-white border-2 border-sand px-4 py-2 text-cocoa outline-none focus:border-terra min-h-[80px]"
        value={narrative}
        onChange={e => update({ narrative: e.target.value })}
        disabled={disabled}
      />

      <label className="block text-xs uppercase tracking-wide text-cinnamon mt-3 mb-1">
        {t.input.why_angry}
      </label>
      <textarea
        className="w-full rounded-xl bg-white border-2 border-sand px-4 py-2 text-cocoa outline-none focus:border-terra min-h-[60px]"
        value={grievance}
        onChange={e => update({ grievance: e.target.value })}
        disabled={disabled}
      />

      {onSubmit && (
        <button
          onClick={onSubmit}
          disabled={disabled || !name || !narrative || !grievance}
          className="w-full mt-4 py-3 rounded-full bg-gradient-to-br from-terra to-cinnamon text-cream font-bold disabled:opacity-50 hover:shadow-lg transition"
        >
          {t.input.submit}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/CaseForm.tsx
git commit -m "feat(ui): CaseForm for single-side statement input"
```

---

## Task 17: JudgingAnimation 组件

**Files:**
- Create: `components/JudgingAnimation.tsx`

- [ ] **Step 1: 实现**

`components/JudgingAnimation.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { JudgeCat } from './JudgeCat';
import { useLanguage } from './LanguageProvider';

type Props = {
  variant?: 'first' | 'appeal'; // 一审 vs 二审文案不同
};

// 审判动画屏——猫猫摇头 + 法槌敲击 + 呼吸点
export function JudgingAnimation({ variant = 'first' }: Props) {
  const { t } = useLanguage();
  const label = variant === 'first' ? t.animation.thinking : t.animation.second_thinking;

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="flex items-end gap-3">
        <JudgeCat state="judging" size={200} />
        {/* 法槌——摆动 */}
        <motion.div
          className="text-6xl origin-bottom-right"
          animate={{ rotate: [-20, 25, -20] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          🔨
        </motion.div>
      </div>

      {/* 呼吸点提示 */}
      <div className="flex items-center gap-2 text-cinnamon font-semibold">
        <span>{label}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-terra"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </span>
      </div>

      <p className="text-xs text-cinnamon/70">{t.animation.generating}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/JudgingAnimation.tsx
git commit -m "feat(ui): JudgingAnimation with cat + gavel + breathing dots"
```

---

## Task 18: VerdictCard + 子组件

**Files:**
- Create: `components/VerdictCard.tsx`
- Create: `components/ResponsibilityBar.tsx`
- Create: `components/CrimeCard.tsx`

- [ ] **Step 1: 实现 ResponsibilityBar**

`components/ResponsibilityBar.tsx`:

```tsx
'use client';

type Props = {
  left: number;   // 0-100
  right: number;  // 0-100
  leftName: string;
  rightName: string;
};

// 责任比例条——两色渐变对半分
export function ResponsibilityBar({ left, right, leftName, rightName }: Props) {
  return (
    <div className="flex h-8 rounded-full overflow-hidden border-2 border-cocoa/10 bg-cream">
      <div
        className="bg-gradient-to-br from-rose to-rose/80 text-cream flex items-center justify-center text-xs font-bold px-2"
        style={{ width: `${left}%` }}
      >
        {leftName} {left}%
      </div>
      <div
        className="bg-gradient-to-br from-terra to-terra/80 text-cream flex items-center justify-center text-xs font-bold px-2"
        style={{ width: `${right}%` }}
      >
        {rightName} {right}%
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 实现 CrimeCard**

`components/CrimeCard.tsx`:

```tsx
'use client';

import type { Verdict } from '@/lib/schema';
import { useLanguage } from './LanguageProvider';

type Props = {
  crime: Verdict['crimes'][number];
  partyName: string;
};

// 罪名卡片——重罪玫瑰红，轻罪陶土色
export function CrimeCard({ crime, partyName }: Props) {
  const { t } = useLanguage();
  const isFelony = crime.severity === '重罪' || crime.severity === 'felony';
  const label = isFelony ? t.verdict.felony : t.verdict.misdemeanor;

  return (
    <div
      className={`rounded-lg p-3 border-l-4 ${
        isFelony ? 'bg-rose/15 border-rose' : 'bg-terra/15 border-terra'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-bold text-cocoa">
          {partyName} · <em className="not-italic text-cinnamon">「{crime.charge}」</em>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            isFelony ? 'bg-rose text-cream' : 'bg-terra text-cream'
          }`}
        >
          {label}
        </span>
      </div>
      <p className="text-sm text-cocoa/85 mt-1">{crime.reasoning}</p>
    </div>
  );
}
```

- [ ] **Step 3: 实现 VerdictCard**

`components/VerdictCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import type { Verdict } from '@/lib/schema';
import { useLanguage } from './LanguageProvider';
import { ResponsibilityBar } from './ResponsibilityBar';
import { CrimeCard } from './CrimeCard';

type Props = {
  verdict: Partial<Verdict>;        // 流式生成——各字段可能未到齐
  leftName: string;
  rightName: string;
  onAccept?: () => void;
  onAppeal?: () => void;
  isFinal?: boolean;                 // 二审终局
  acceptedByMe?: boolean;
  acceptedByOpponent?: boolean;
};

// 判决书主组件——所有 section 逐个 fade in
export function VerdictCard({
  verdict, leftName, rightName, onAccept, onAppeal,
  isFinal = false, acceptedByMe = false, acceptedByOpponent = false,
}: Props) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-honey to-sand p-6 border-2 border-terra shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-block bg-cinnamon text-cream px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          {isFinal ? t.verdict.final_title : t.verdict.title}
        </span>
      </div>

      {/* 责任比例 */}
      {verdict.responsibility && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-xs uppercase tracking-widest text-cinnamon font-bold mb-2">
            {t.verdict.responsibility}
          </div>
          <ResponsibilityBar
            left={verdict.responsibility.left}
            right={verdict.responsibility.right}
            leftName={leftName}
            rightName={rightName}
          />
        </motion.section>
      )}

      {/* 核心矛盾 */}
      {verdict.core_conflict && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-xs uppercase tracking-widest text-cinnamon font-bold mb-2">
            {t.verdict.core_conflict}
          </div>
          <p className="text-cocoa">{verdict.core_conflict}</p>
        </motion.section>
      )}

      {/* 罪名 */}
      {verdict.crimes && verdict.crimes.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-xs uppercase tracking-widest text-cinnamon font-bold mb-2">
            {t.verdict.declaration}
          </div>
          <div className="space-y-2">
            {verdict.crimes.map((c, i) => (
              <CrimeCard
                key={i}
                crime={c}
                partyName={c.side === 'left' ? leftName : rightName}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* 结语 */}
      {verdict.cat_closing_line && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="italic text-center text-cinnamon"
        >
          {verdict.cat_closing_line}
        </motion.p>
      )}

      {/* 按钮 */}
      {verdict.reconciliation_checklist && (onAccept || onAppeal) && (
        <div className="flex gap-3 pt-2">
          {onAccept && (
            <button
              onClick={onAccept}
              disabled={acceptedByMe}
              className="flex-1 py-3 rounded-full bg-accept text-cream font-bold disabled:opacity-60 hover:shadow-md transition"
            >
              {acceptedByMe && acceptedByOpponent
                ? '✓✓'
                : acceptedByMe
                ? t.verdict.waiting_opponent_decision
                : isFinal
                ? t.verdict.accept_only
                : t.verdict.accept}
            </button>
          )}
          {onAppeal && !isFinal && (
            <button
              onClick={onAppeal}
              className="flex-1 py-3 rounded-full bg-rose text-cream font-bold hover:shadow-md transition"
            >
              {t.verdict.appeal}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/VerdictCard.tsx components/ResponsibilityBar.tsx components/CrimeCard.tsx
git commit -m "feat(ui): VerdictCard with responsibility bar and crime cards"
```

---

## Task 19: ChecklistProgress 组件

**Files:**
- Create: `components/ChecklistProgress.tsx`

- [ ] **Step 1: 实现**

`components/ChecklistProgress.tsx`:

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Verdict } from '@/lib/schema';
import { useLanguage } from './LanguageProvider';
import { totalPossibleIntimacy } from '@/lib/intimacy';

type Props = {
  verdict: Verdict;
  completedIds: string[];
  intimacyScore: number;
  onToggle: (taskId: string, points: number) => void;
};

// 和解 checklist——可交互勾选 + 飘浮 "+X 亲密度" 弹窗
export function ChecklistProgress({ verdict, completedIds, intimacyScore, onToggle }: Props) {
  const { t } = useLanguage();
  const [popup, setPopup] = useState<{ id: number; points: number } | null>(null);
  const total = totalPossibleIntimacy(verdict);

  const handleClick = (taskId: string, points: number) => {
    const isNewlyChecked = !completedIds.includes(taskId);
    onToggle(taskId, points);
    if (isNewlyChecked) {
      // 飘浮弹窗 1.5s
      setPopup({ id: Date.now(), points });
      setTimeout(() => setPopup(null), 1500);
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-cream to-peach p-6 border-2 border-accept/50 relative">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-accept text-xs font-bold uppercase tracking-widest">
          🌿 {t.checklist.title}
        </span>
        <span className="text-cocoa font-bold">
          {t.checklist.total} · {intimacyScore} / {total}
        </span>
      </div>

      <div className="space-y-2">
        {verdict.reconciliation_checklist.map(task => {
          const isChecked = completedIds.includes(task.id);
          return (
            <button
              key={task.id}
              onClick={() => handleClick(task.id, task.intimacy_points)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left border transition ${
                isChecked
                  ? 'bg-accept/20 border-accept/40'
                  : 'bg-white border-accept/20 hover:border-accept/50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  isChecked ? 'bg-accept border-accept' : 'border-accept/60'
                }`}
              >
                {isChecked && <span className="text-cream text-xs">✓</span>}
              </div>
              <span className="text-cocoa flex-1">{task.task}</span>
              <span className="text-xs text-accept font-bold">+{task.intimacy_points}</span>
            </button>
          );
        })}
      </div>

      {/* 飘浮弹窗 */}
      <AnimatePresence>
        {popup && (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -30 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ duration: 1.5 }}
            className="absolute top-4 right-4 bg-accept text-cream px-3 py-1 rounded-full font-bold text-sm pointer-events-none"
          >
            +{popup.points} 🌿
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChecklistProgress.tsx
git commit -m "feat(ui): ChecklistProgress with intimacy popup"
```

---

## Task 20: AppealForm 组件

**Files:**
- Create: `components/AppealForm.tsx`

- [ ] **Step 1: 实现**

`components/AppealForm.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';

type Props = {
  side: 'left' | 'right';
  role: 'appellant' | 'respondent';    // 上诉方 or 反驳方
  responseWindowSeconds?: number;      // 反驳方倒计时
  onSubmit: (supplement: string) => void;
  onSkip?: () => void;
};

// 上诉/反驳表单
export function AppealForm({ side, role, responseWindowSeconds, onSubmit, onSkip }: Props) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(responseWindowSeconds ?? 0);

  // 反驳方倒计时
  useEffect(() => {
    if (role !== 'respondent' || !responseWindowSeconds) return;
    const tick = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(tick);
          onSkip?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [role, responseWindowSeconds, onSkip]);

  const accent = side === 'left' ? 'border-rose' : 'border-terra';

  return (
    <div className={`rounded-2xl bg-rose/10 p-6 border-2 ${accent} space-y-3`}>
      <div className="inline-block bg-rose text-cream px-3 py-1 rounded-md text-xs font-bold -rotate-2">
        📌 {role === 'appellant' ? t.appeal.title : t.appeal.waiting_response}
      </div>
      <div className="text-xs uppercase tracking-wide text-cinnamon">
        {t.appeal.your_supplement}
      </div>
      <textarea
        className="w-full rounded-xl bg-white border-2 border-rose/30 px-4 py-3 text-cocoa outline-none focus:border-rose min-h-[100px]"
        placeholder={t.appeal.placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
      />

      {role === 'respondent' && remaining > 0 && (
        <div className="text-xs text-rose font-bold">
          ⏱️ {t.appeal.waiting_response} · {remaining}{t.appeal.seconds}
        </div>
      )}

      <button
        onClick={() => onSubmit(text)}
        disabled={!text.trim()}
        className="w-full py-2 rounded-full bg-rose text-cream font-bold disabled:opacity-50"
      >
        {t.appeal.submit}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AppealForm.tsx
git commit -m "feat(ui): AppealForm for appellant + respondent with countdown"
```

---

## Task 21: ModeSelector 组件

**Files:**
- Create: `components/ModeSelector.tsx`

- [ ] **Step 1: 实现**

`components/ModeSelector.tsx`:

```tsx
'use client';

import { useLanguage } from './LanguageProvider';

type Props = {
  onSelect: (mode: 'single' | 'remote') => void;
};

// 模式选择器——两个大按钮
export function ModeSelector({ onSelect }: Props) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-cinnamon text-center">
        {t.mode.title}
      </h2>

      <button
        onClick={() => onSelect('single')}
        className="w-full bg-cream border-2 border-terra rounded-2xl p-6 text-left hover:shadow-lg transition"
      >
        <div className="text-xl font-bold text-cocoa mb-1">📱 {t.mode.single}</div>
        <div className="text-sm text-cinnamon">{t.mode.single_desc}</div>
      </button>

      <button
        onClick={() => onSelect('remote')}
        className="w-full bg-cream border-2 border-rose rounded-2xl p-6 text-left hover:shadow-lg transition"
      >
        <div className="text-xl font-bold text-cocoa mb-1">📱↔️📱 {t.mode.remote}</div>
        <div className="text-sm text-cinnamon">{t.mode.remote_desc}</div>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ModeSelector.tsx
git commit -m "feat(ui): ModeSelector for single vs remote"
```

---

## Task 22: SSE 客户端 hook

**Files:**
- Create: `lib/useVerdictStream.ts`

- [ ] **Step 1: 实现**

`lib/useVerdictStream.ts`:

```ts
'use client';

import { useState, useCallback } from 'react';
import type { Case, Verdict } from './schema';

type StreamState = {
  partial: Partial<Verdict>;
  done: boolean;
  error: string | null;
  loading: boolean;
};

// SSE 客户端 hook——发起 POST /api/verdict 并逐段积累判决
export function useVerdictStream() {
  const [state, setState] = useState<StreamState>({
    partial: {},
    done: false,
    error: null,
    loading: false,
  });

  const start = useCallback(async (caseData: Case, isAppeal: boolean) => {
    setState({ partial: {}, done: false, error: null, loading: true });

    try {
      const res = await fetch('/api/verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case: caseData, isAppeal }),
      });

      if (!res.ok || !res.body) throw new Error('Bad response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // 逐 chunk 读取 SSE
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 事件分隔（\n\n）拆包
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          try {
            const ev = JSON.parse(json);
            if (ev.type === 'section') {
              setState(prev => ({
                ...prev,
                partial: { ...prev.partial, [ev.section]: ev.content },
              }));
            } else if (ev.type === 'done') {
              setState(prev => ({ ...prev, partial: ev.verdict, done: true, loading: false }));
              return ev.verdict as Verdict;
            } else if (ev.type === 'error') {
              throw new Error(ev.message);
            }
          } catch (e) {
            // 忽略单条解析错，继续读下一条
          }
        }
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: (err as Error).message, loading: false }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ partial: {}, done: false, error: null, loading: false });
  }, []);

  return { ...state, start, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/useVerdictStream.ts
git commit -m "feat(lib): useVerdictStream hook for SSE verdict streaming"
```

---

# M5 · 页面组装

## Task 23: Landing 页 (Screen 1)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 实现**

`app/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { JudgeCat } from '@/components/JudgeCat';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';

// Landing 屏——猫猫大图 + 一句 tagline + 开始按钮 + 中英切换
export default function Home() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <JudgeCat state="idle" size={240} showBadge />

      <div className="text-center space-y-2 mt-6">
        <div className="text-xs uppercase tracking-[0.3em] text-cinnamon">
          {t.app.subtitle}
        </div>
        <h1 className="text-4xl font-extrabold text-cocoa">
          {t.app.title}
        </h1>
        <p className="text-cinnamon italic">{t.app.tagline}</p>
      </div>

      <button
        onClick={() => router.push('/mode')}
        className="px-10 py-4 rounded-full bg-gradient-to-br from-rose to-cinnamon text-cream font-bold text-lg shadow-lg hover:shadow-xl transition"
      >
        {t.app.start}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: 视觉验证**

`npm run dev` → http://localhost:3000 应该看到猫猫大图 + 按钮。点击应该跳到 `/mode`（下一 task 实现）。

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): Landing page with cat hero + CTA"
```

---

## Task 24: Mode 选择页 (Screen 2)

**Files:**
- Create: `app/mode/page.tsx`

- [ ] **Step 1: 实现**

`app/mode/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { ModeSelector } from '@/components/ModeSelector';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';

// 模式选择屏——单机模式生成 caseId 后跳 /case/[id]，
// 远程模式调 /api/rooms 拿房间码后跳 /room/[code]
export default function ModePage() {
  const router = useRouter();
  const { language } = useLanguage();

  const handleSelect = async (mode: 'single' | 'remote') => {
    if (mode === 'single') {
      const id = nanoid(10);
      router.push(`/case/${id}?lang=${language}`);
    } else {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      const { code, hostToken } = await res.json();
      // hostToken 存 localStorage 以便回访时 recover
      localStorage.setItem(`room-token:${code}`, hostToken);
      router.push(`/room/${code}`);
    }
  };

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center gap-8">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <ModeSelector onSelect={handleSelect} />
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/mode/page.tsx
git commit -m "feat(ui): Mode selection page"
```

---

## Task 25: 单机模式全流程页 (Screens 3–8)

**Files:**
- Create: `app/case/[id]/page.tsx`

- [ ] **Step 1: 实现**

`app/case/[id]/page.tsx`:

```tsx
'use client';

import { use, useEffect, useState } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { JudgingAnimation } from '@/components/JudgingAnimation';
import { VerdictCard } from '@/components/VerdictCard';
import { ChecklistProgress } from '@/components/ChecklistProgress';
import { AppealForm } from '@/components/AppealForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { JudgeCat } from '@/components/JudgeCat';
import { useLanguage } from '@/components/LanguageProvider';
import { useVerdictStream } from '@/lib/useVerdictStream';
import { toggleTask, totalPossibleIntimacy } from '@/lib/intimacy';
import type { Case, PartyStatement, Verdict } from '@/lib/schema';

type Phase =
  | 'input'
  | 'judging'
  | 'verdict'
  | 'appeal-supplement'
  | 'judging-appeal'
  | 'final-verdict'
  | 'checklist'
  | 'done';

// 单机模式：所有屏幕在一个页面里，用 phase state 切换
export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { language, t } = useLanguage();
  const stream = useVerdictStream();

  // 双方陈述——单机模式两人共用一台，同时可见
  const [left, setLeft] = useState<PartyStatement>({ name: '', narrative: '', grievance: '' });
  const [right, setRight] = useState<PartyStatement>({ name: '', narrative: '', grievance: '' });
  const [phase, setPhase] = useState<Phase>('input');
  const [caseState, setCaseState] = useState<Case | null>(null);
  const [finalVerdict, setFinalVerdict] = useState<Verdict | null>(null);
  const [appellant, setAppellant] = useState<'left' | 'right' | null>(null);
  const [appellantSupplement, setAppellantSupplement] = useState('');

  // 构建 case data
  const buildCase = (): Case => ({
    id,
    language,
    mode: 'single',
    createdAt: Date.now(),
    left,
    right,
    intimacyScore: caseState?.intimacyScore ?? 0,
    completedChecklist: caseState?.completedChecklist ?? [],
    firstVerdict: caseState?.firstVerdict,
    firstVerdictDecisions: caseState?.firstVerdictDecisions,
    appeal: caseState?.appeal,
    finalVerdict: caseState?.finalVerdict,
  });

  // ===== 一审 =====
  const handleSubmit = async () => {
    setPhase('judging');
    const c = buildCase();
    await stream.start(c, false);
    // stream 完成后 state.partial 已是完整 verdict
  };

  // 用 effect 监听 stream done——避免在 render 里 setState 引发死循环
  useEffect(() => {
    if (stream.done && phase === 'judging') {
      const c = buildCase();
      c.firstVerdict = stream.partial as Verdict;
      setCaseState(c);
      setPhase('verdict');
      stream.reset();
    }
    if (stream.done && phase === 'judging-appeal') {
      setFinalVerdict(stream.partial as Verdict);
      setPhase('final-verdict');
      stream.reset();
    }
  }, [stream.done, phase]);

  const handleAccept = () => {
    setPhase('checklist');
  };

  const handleAppealClick = (who: 'left' | 'right') => {
    setAppellant(who);
    setPhase('appeal-supplement');
  };

  // ===== 二审 =====
  const handleAppealSubmit = async (supplement: string) => {
    setAppellantSupplement(supplement);
    // 简化：单机模式不需要对方回应等待，直接进入二审动画
    // （单机模式两人共用一台，可以口头协商；如需分开输入可增加流程）
    setPhase('judging-appeal');
    const c = buildCase();
    if (c.firstVerdict) {
      c.appeal = { appellant: appellant!, appellantSupplement: supplement };
      await stream.start(c, true);
    }
  };

  // ===== Checklist =====
  const handleToggleTask = (taskId: string, points: number) => {
    if (!caseState) return;
    const verdict = finalVerdict ?? caseState.firstVerdict!;
    const next = toggleTask(caseState, taskId, verdict);
    setCaseState(next);

    // 全勾完了 → done
    if (next.completedChecklist.length === verdict.reconciliation_checklist.length) {
      setTimeout(() => setPhase('done'), 800);
    }
  };

  const displayVerdict = finalVerdict ?? caseState?.firstVerdict;
  const partialVerdict = stream.partial;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <JudgeCat state={phase === 'judging' || phase === 'judging-appeal' ? 'judging' : 'idle'} size={56} />
          <span className="text-cinnamon font-bold">{t.app.title}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Phase: input */}
      {phase === 'input' && (
        <div className="grid md:grid-cols-2 gap-4">
          <CaseForm side="left" onChange={setLeft} />
          <CaseForm side="right" onChange={setRight} onSubmit={handleSubmit} />
        </div>
      )}

      {/* Phase: judging (一审 or 二审) */}
      {(phase === 'judging' || phase === 'judging-appeal') && (
        <>
          <JudgingAnimation variant={phase === 'judging-appeal' ? 'appeal' : 'first'} />
          {/* 判决部分字段可能已到——预览渲染 */}
          {Object.keys(partialVerdict).length > 0 && (
            <VerdictCard
              verdict={partialVerdict}
              leftName={left.name}
              rightName={right.name}
            />
          )}
        </>
      )}

      {/* Phase: verdict (一审判决 + 接受/上诉按钮) */}
      {phase === 'verdict' && caseState?.firstVerdict && (
        <>
          <VerdictCard
            verdict={caseState.firstVerdict}
            leftName={left.name}
            rightName={right.name}
            onAccept={handleAccept}
            onAppeal={() => handleAppealClick('left')}  // 单机模式简化：默认甲方点上诉
          />
          <div className="flex gap-2 justify-center text-sm">
            <button className="text-cinnamon underline" onClick={() => handleAppealClick('left')}>
              甲方上诉
            </button>
            <span>·</span>
            <button className="text-cinnamon underline" onClick={() => handleAppealClick('right')}>
              乙方上诉
            </button>
          </div>
        </>
      )}

      {/* Phase: appeal-supplement */}
      {phase === 'appeal-supplement' && appellant && (
        <AppealForm
          side={appellant}
          role="appellant"
          onSubmit={handleAppealSubmit}
        />
      )}

      {/* Phase: final-verdict */}
      {phase === 'final-verdict' && finalVerdict && (
        <>
          <VerdictCard
            verdict={finalVerdict}
            leftName={left.name}
            rightName={right.name}
            isFinal
            onAccept={handleAccept}
          />
        </>
      )}

      {/* Phase: checklist */}
      {phase === 'checklist' && displayVerdict && caseState && (
        <ChecklistProgress
          verdict={displayVerdict}
          completedIds={caseState.completedChecklist}
          intimacyScore={caseState.intimacyScore}
          onToggle={handleToggleTask}
        />
      )}

      {/* Phase: done */}
      {phase === 'done' && caseState && displayVerdict && (
        <div className="text-center py-12 space-y-4">
          <div className="text-6xl">✨🌸🐾💚</div>
          <div className="text-accept text-xl font-bold">{t.checklist.success}</div>
          <div className="text-7xl font-black text-accept">+{caseState.intimacyScore}</div>
          <div className="text-cinnamon">{t.checklist.total}</div>
          <button
            onClick={() => (window.location.href = '/')}
            className="mt-6 px-8 py-3 rounded-full bg-accept text-cream font-bold hover:shadow-lg transition"
          >
            {t.checklist.next_case}
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 手动测试整个流程**

浏览器打开 `/case/test123`，双方填内容 → 点提交 → 看审判动画 → 看判决 → 点接受 → 勾 checklist → 看到 +X 亲密度飘 → 全勾完看撒花页。

- [ ] **Step 3: 上诉路径手动测试**

再走一遍，点"我要上诉" → 填补陈 → 看二审动画 → 看终审判决 → 接受 → checklist → done。

- [ ] **Step 4: Commit**

```bash
git add app/case/[id]/page.tsx
git commit -m "feat(ui): single-device flow orchestrator (input→verdict→checklist)"
```

---

## Task 26: 远程模式页 (Screen 3–8 · 房间轮询版)

**Files:**
- Create: `app/room/[code]/page.tsx`

- [ ] **Step 1: 实现**

`app/room/[code]/page.tsx`:

```tsx
'use client';

import { use, useEffect, useState } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { JudgingAnimation } from '@/components/JudgingAnimation';
import { VerdictCard } from '@/components/VerdictCard';
import { ChecklistProgress } from '@/components/ChecklistProgress';
import { AppealForm } from '@/components/AppealForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { JudgeCat } from '@/components/JudgeCat';
import { useLanguage } from '@/components/LanguageProvider';
import type { Case, PartyStatement } from '@/lib/schema';
import { nanoid } from 'nanoid';

// 远程模式：每 2s 拉一次房间状态，UI 根据 case 字段推断当前 phase
export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { t } = useLanguage();

  // token 生成或恢复——房主的 hostToken 在 mode 页存过；否则新访客生成一个
  const [token] = useState(() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(`room-token:${code}`);
    if (stored) return stored;
    const fresh = nanoid();
    localStorage.setItem(`room-token:${code}`, fresh);
    return fresh;
  });

  const [caseState, setCaseState] = useState<Case | null>(null);
  const [myRole, setMyRole] = useState<'left' | 'right'>('left');
  const [oppSubmitted, setOppSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [myStatement, setMyStatement] = useState<PartyStatement>({ name: '', narrative: '', grievance: '' });
  const [submitted, setSubmitted] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  // 轮询房间状态
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}?token=${token}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setCaseState(data.case);
        setMyRole(data.myRole);
        setOppSubmitted(data.opponentHasSubmitted);
      } catch (e) {
        // ignore transient errors
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [code, token]);

  const patch = async (action: string, payload: any) => {
    await fetch(`/api/rooms/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, payload }),
    });
  };

  const handleSubmit = async () => {
    await patch('submit_statement', myStatement);
    setSubmitted(true);
  };

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-4xl">📂</div>
        <p className="text-cinnamon">{t.error.archived}</p>
      </main>
    );
  }

  if (!caseState) return <main className="min-h-screen flex items-center justify-center">Loading...</main>;

  const mySide = caseState[myRole];
  const oppSide = caseState[myRole === 'left' ? 'right' : 'left'];
  const iSubmitted = !!mySide.submittedAt || submitted;
  const bothSubmitted = mySide.submittedAt && oppSide.submittedAt;

  const displayVerdict = caseState.finalVerdict ?? caseState.firstVerdict;
  const iAccepted = caseState.firstVerdictDecisions?.[`${myRole}Accepted`] as boolean | undefined;
  const oppAcceptedKey: 'leftAccepted' | 'rightAccepted' = myRole === 'left' ? 'rightAccepted' : 'leftAccepted';
  const oppAccepted = caseState.firstVerdictDecisions?.[oppAcceptedKey] as boolean | undefined;

  // 房间码顶部展示（方便分享）
  const codeBadge = (
    <div className="text-center py-2 bg-cream border-b border-sand text-xs text-cinnamon">
      {t.mode.your_code}: <span className="font-bold text-cocoa tracking-widest">{code}</span> · {t.mode.share_hint}
    </div>
  );

  return (
    <main className="min-h-screen">
      {codeBadge}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <JudgeCat state={caseState.firstVerdict || iSubmitted ? 'idle' : 'idle'} size={48} />
            <span className="text-cinnamon font-bold text-sm">{myRole === 'left' ? '甲方' : '乙方'}</span>
          </div>
          <LanguageToggle />
        </div>

        {/* 阶段 1：陈述 */}
        {!displayVerdict && !iSubmitted && (
          <CaseForm side={myRole} onChange={setMyStatement} onSubmit={handleSubmit} />
        )}

        {/* 阶段 2：等对方 or 等判决 */}
        {!displayVerdict && iSubmitted && (
          <div className="text-center py-16">
            {!bothSubmitted ? (
              <p className="text-cinnamon">{t.input.waiting_opponent}</p>
            ) : (
              <JudgingAnimation variant="first" />
            )}
          </div>
        )}

        {/* 阶段 3：判决书 */}
        {displayVerdict && !showAppealForm && (
          <VerdictCard
            verdict={displayVerdict}
            leftName={caseState.left.name || '甲方'}
            rightName={caseState.right.name || '乙方'}
            isFinal={!!caseState.finalVerdict}
            onAccept={() => patch('accept_verdict', {})}
            onAppeal={() => setShowAppealForm(true)}
            acceptedByMe={!!iAccepted}
            acceptedByOpponent={!!oppAccepted}
          />
        )}

        {/* 阶段 4：上诉补陈 */}
        {showAppealForm && (
          <AppealForm
            side={myRole}
            role="appellant"
            onSubmit={async (supplement) => {
              await patch('submit_appeal', { supplement });
              setShowAppealForm(false);
            }}
          />
        )}

        {/* 阶段 5：Checklist（双方都接受后） */}
        {displayVerdict && iAccepted && oppAccepted && (
          <ChecklistProgress
            verdict={displayVerdict}
            completedIds={caseState.completedChecklist}
            intimacyScore={caseState.intimacyScore}
            onToggle={(taskId, points) => patch('check_task', { taskId, points })}
          />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 手动测试**

开两个浏览器窗口（无痕/普通），一个当房主访问 `/mode` 选远程模式拿到房间码；另一个访问 `/room/<code>`。分别填内容 → 提交 → 都应看到判决 → 双方接受 → 一起做 checklist。

- [ ] **Step 3: Commit**

```bash
git add app/room/[code]/page.tsx
git commit -m "feat(ui): remote-mode room page with polling"
```

---

# M6 · E2E + 部署

## Task 27: Playwright E2E · 单机模式黄金路径

**Files:**
- Create: `e2e/single-mode-happy-path.spec.ts`
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 写 E2E（mock verdict API 避免真调 Bedrock）**

`e2e/single-mode-happy-path.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// 在测试里 stub /api/verdict 返回预制的 SSE 流，避免真 Bedrock
const MOCK_VERDICT = {
  core_conflict: 'test conflict',
  responsibility: { left: 60, right: 40 },
  crimes: [{ side: 'left', charge: 'test-charge', severity: '轻罪', reasoning: 'test' }],
  reconciliation_checklist: [
    { id: 'task1', task: 'test task 1', intimacy_points: 10 },
  ],
  cat_closing_line: 'test closing',
};

test('single-mode happy path: input → verdict → accept → checklist → done', async ({ page }) => {
  // stub API
  await page.route('/api/verdict', route => {
    const sse = [
      `data: ${JSON.stringify({ type: 'section', section: 'core_conflict', content: MOCK_VERDICT.core_conflict })}\n\n`,
      `data: ${JSON.stringify({ type: 'section', section: 'responsibility', content: MOCK_VERDICT.responsibility })}\n\n`,
      `data: ${JSON.stringify({ type: 'section', section: 'crimes', content: MOCK_VERDICT.crimes })}\n\n`,
      `data: ${JSON.stringify({ type: 'section', section: 'reconciliation_checklist', content: MOCK_VERDICT.reconciliation_checklist })}\n\n`,
      `data: ${JSON.stringify({ type: 'section', section: 'cat_closing_line', content: MOCK_VERDICT.cat_closing_line })}\n\n`,
      `data: ${JSON.stringify({ type: 'done', verdict: MOCK_VERDICT })}\n\n`,
    ].join('');
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sse,
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /开始审判|Open Court/ }).click();

  await page.getByRole('button', { name: /一起用一台|One phone/ }).click();

  // 填甲方
  await page.locator('input').first().fill('小美');
  await page.locator('textarea').first().fill('他吃了我的芝士条');
  await page.locator('textarea').nth(1).fill('心里没我');

  // 填乙方
  await page.locator('input').nth(1).fill('阿明');
  await page.locator('textarea').nth(2).fill('就一根');
  await page.locator('textarea').nth(3).fill('小题大做');

  // 提交
  await page.getByRole('button', { name: /交给猫猫|Submit to the Cat/ }).click();

  // 等判决出现
  await expect(page.getByText('test conflict')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/test-charge/)).toBeVisible();

  // 接受
  await page.getByRole('button', { name: /接受判决|Accept/ }).first().click();

  // Checklist 出现，勾第一项
  await page.getByText('test task 1').click();
  await expect(page.getByText(/\+10/)).toBeVisible();

  // 全部勾完 → done
  await expect(page.getByText(/和解成功|Reconciled/)).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 2: 跑 E2E**

```bash
npm run test:e2e
```

预期 2 passed（smoke + happy path）。

- [ ] **Step 3: Commit**

```bash
git add e2e/single-mode-happy-path.spec.ts
git commit -m "test(e2e): single-mode happy path with mocked verdict SSE"
```

---

## Task 28: Vercel 部署配置

**Files:**
- Create: `.env.example`
- Create: `vercel.json`（可选，MVP 不需要）

- [ ] **Step 1: 创建 .env.example（提示需要哪些变量）**

`.env.example`:

```env
# 用户实际部署时需要把这些填到 Vercel Environment Variables 里

# AWS Bedrock（必填）
AWS_BEARER_TOKEN_BEDROCK=ABSK...
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6

# Upstash Redis（仅远程模式需要；用 Vercel Integration 一键 provision 会自动注入）
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

- [ ] **Step 2: 更新 README（部署指引）**

`README.md`:

```markdown
# 🐱⚖️ 猫猫大法官 · Feline Court

情侣可爱风格 AI 调解 app。

## 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local 填入 Bedrock token + Upstash 凭证
npm run dev
```

## 测试

```bash
npm test           # Vitest unit
npm run test:e2e   # Playwright E2E
```

## 部署到 Vercel

1. Push 到 GitHub
2. Vercel 连接 repo
3. Environment Variables 里粘贴 `.env.example` 里列出的所有变量
4. Upstash Redis 用 Vercel Integration 一键 provision（自动注入 UPSTASH_* 变量）
5. Deploy
```

- [ ] **Step 3: 手动 build 检查**

```bash
npm run build
```

预期：build 成功，无 TS 错误。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add .env.example and README with deploy instructions"
```

---

## Task 29: 推送 + 部署验证

- [ ] **Step 1: 推分支到远端（如果 remote 已配置）**

```bash
# 只在用户手动创建了 github repo 后跑
git push -u origin feat/mvp-implementation
```

如果 remote 未配置，等 Task 30 手动步骤——**这一步由用户执行**：
1. 在 github 创建空 repo
2. `git remote add origin <url>`
3. `git push -u origin main`（先推 main，再 push feat 分支）

- [ ] **Step 2: 在 Vercel 连接 repo**

**用户手动操作**：
1. Vercel dashboard → New Project → Import 该 repo
2. Framework Preset: Next.js（自动检测）
3. Environment Variables：粘贴 `.env.example` 里的所有 key 及实际值
4. Add Integration → Upstash → provision Redis DB（自动注入 UPSTASH_*）
5. Deploy

- [ ] **Step 3: 冒烟验证**

访问 Vercel 分配的 URL（如 `feline-court.vercel.app`）：
- Landing 加载正常
- 走一遍单机模式黄金路径
- 走一遍远程模式（两个浏览器）

- [ ] **Step 4: 开 PR 合回 main**

```bash
gh pr create --title "MVP: Feline Court AI mediation judge" \
  --body "$(cat <<'EOF'
## Summary
- Landing → Mode → Case Input → Verdict → Checklist / Appeal
- Single-device mode + Remote mode with 6-char room codes
- Bilingual (zh/en)
- Bedrock Claude Sonnet 4.6 with tool_use structured output, SSE streaming
- Upstash Redis for remote room state (24h TTL)

## Test plan
- [x] Vitest unit tests for lib/ (schema, prompts, bedrock stream parser, rooms, intimacy)
- [x] Playwright E2E for single-mode happy path
- [x] Manual verification of remote mode (two browsers)
- [x] Manual verification of appeal path
- [x] Deployed to Vercel with real Bedrock

EOF
)"
```

（不加 Co-Authored-By 尾行。）

---

# 附录

## 依赖版本参考

MVP 用最新稳定版即可。参考：
- next@15.x
- react@19.x
- tailwindcss@4.x
- framer-motion@11.x
- @aws-sdk/client-bedrock-runtime@3.x
- @upstash/redis@1.x
- zod@3.x
- vitest@2.x
- @playwright/test@1.x

## 已知遗留 / MVP 之后可优化

- Bedrock 冷启延迟：可考虑 Vercel Fluid Compute 或预热
- 罪名 corpus：初版靠模型创造力，如效果差可预置 20 个金句给模型 few-shot
- 远程模式改 WebSocket 降轮询开销
- 移动端 responsive polish（MVP 桌面优先）
- 加更多语言（日/韩/西？）
- 罪名分享卡片（social share OG image）

---

## Self-Review 记录

我已过一遍 spec 和 plan 的映射：

- ✅ 每个 spec 章节都对应至少一个 task
- ✅ 数据模型 → Task 6
- ✅ Prompts 中英双语 + 一审二审 → Task 7
- ✅ Bedrock 流式 + tool_use → Task 8
- ✅ Rooms Redis → Task 9
- ✅ /api/verdict SSE → Task 11
- ✅ /api/rooms POST + [code] GET/PATCH → Task 12, 13
- ✅ 8 屏 UI → Task 15-26
- ✅ E2E → Task 27
- ✅ 部署 → Task 28-29
- ✅ 错误处理文案 → messages/zh.json + en.json 里的 error.* 段
- ✅ 亲密度累计 → Task 10 + 集成在 Task 25

**遗留**：单机模式一审后"甲方 vs 乙方谁点上诉"的 UI 稍简化——Task 25 里加了两个 underline text 链接明确谁上诉，够 MVP。真机测试时若不够直观，可回来把按钮做大。
