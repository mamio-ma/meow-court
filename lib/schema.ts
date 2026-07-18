import { z } from 'zod';

// 罪名的严重程度
// 中英各两级都接受，因为 LLM 的输出语言取决于 case.language；单次判决内保持一致。
// UI 层用 isFelony(severity) 归一化判断，避免消费者到处写 "重罪 || felony"。
export const SeveritySchema = z.enum(['重罪', '轻罪', 'felony', 'misdemeanor']);

// 归一化判断：是否为重罪。UI 或统计代码统一走这里，防止四个枚举值散落各处判断。
export function isFelony(s: z.infer<typeof SeveritySchema>): boolean {
  return s === '重罪' || s === 'felony';
}

// 单方陈述——三个字段都必填非空
export const PartyStatementSchema = z.object({
  name: z.string().min(1, '名字必填'),
  narrative: z.string().min(1, '经过必填'),
  grievance: z.string().min(1, '生气理由必填'),
  // 提交时间戳可选，用于远程模式下追踪双方陈述完成度
  submittedAt: z.number().optional(),
});

// 判决书——LLM 通过 tool_use 输出，用 zod 强校验
// 用 .strict() 拒绝未知字段：如果 LLM 幻觉出多余键，我们要显式失败并重试，
// 而不是静默丢弃（那样调试很痛苦）。
export const VerdictSchema = z
  .object({
    // 一句话概括核心冲突，作为判决书标题
    core_conflict: z.string().min(1),
    // 双方责任比例，必须是整数且相加为 100
    responsibility: z
      .object({
        left: z.number().int().min(0).max(100),
        right: z.number().int().min(0).max(100),
      })
      .strict()
      .refine((r) => r.left + r.right === 100, {
        message: '责任比例必须相加等于 100',
      }),
    // 罪名列表——至少一条，标明是哪一方的过错
    crimes: z
      .array(
        z
          .object({
            side: z.enum(['left', 'right']),
            charge: z.string().min(1),
            severity: SeveritySchema,
            reasoning: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    // 和解清单——完成后可以增加亲密度积分
    reconciliation_checklist: z
      .array(
        z
          .object({
            id: z.string().min(1),
            task: z.string().min(1),
            intimacy_points: z.number().int().min(1).max(30),
          })
          .strict(),
      )
      .min(1),
    // 猫法官的收束语，一般以可爱 emoji 收尾（非强制，交给 LLM 的品味）
    cat_closing_line: z.string().min(1),
  })
  .strict();

// 一场 case 的完整状态——覆盖单机与远程双人模式
export const CaseSchema = z.object({
  id: z.string().min(1),
  language: z.enum(['zh', 'en']),
  mode: z.enum(['single', 'remote']),
  createdAt: z.number(),
  left: PartyStatementSchema,
  right: PartyStatementSchema,
  // 一审判决书（可选，只有走完一审流程才存在）
  firstVerdict: VerdictSchema.optional(),
  // 双方对一审的接受与否——任一方拒绝即触发上诉
  firstVerdictDecisions: z
    .object({
      leftAccepted: z.boolean().optional(),
      rightAccepted: z.boolean().optional(),
    })
    .optional(),
  // 上诉信息——appellant 是发起上诉的一方，需要双方补充陈述
  appeal: z
    .object({
      appellant: z.enum(['left', 'right']),
      appellantSupplement: z.string().min(1),
      respondentSupplement: z.string().optional(),
      respondedAt: z.number().optional(),
    })
    .optional(),
  // 终审判决书（可选，只有走完二审流程才存在）
  finalVerdict: VerdictSchema.optional(),
  // 亲密度积分——完成和解清单可累计
  intimacyScore: z.number().int().min(0),
  // 已完成的和解任务 id 列表
  completedChecklist: z.array(z.string()),
});

// 导出 TS 类型给业务代码使用
export type Verdict = z.infer<typeof VerdictSchema>;
export type PartyStatement = z.infer<typeof PartyStatementSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
