import type { Case } from './schema';

// 中文版系统提示——重点：以和为贵、玩梗罪名、正向和解方案
// 内容较长，从 spec (docs/superpowers/specs/2026-07-17-ai-mediation-judge-design.md 第 7 节) 抄下来
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

// 英文版系统提示
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

  // 各语言下的标签——避免 buildUserPrompt 里混排 zh/en
  const zh = {
    label: isAppeal ? '二审复核' : '本次调解',
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
    label: isAppeal ? 'Appeal Review' : 'Mediation Session',
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
    const appellantName =
      caseData.appeal.appellant === 'left' ? left.name : right.name;
    prompt += `

【${t.firstVerdictTitle}】
${JSON.stringify(caseData.firstVerdict, null, 2)}

【${t.appealTitle}（${appellantName}）】
${caseData.appeal.appellantSupplement}

【${t.respondTitle}】
${caseData.appeal.respondentSupplement ?? t.noResponse}
`;
  }

  prompt += `

${t.instruction}`;

  return prompt;
}
