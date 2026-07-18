import type { Case, Verdict } from './schema';

// 勾选/取消勾选一个和解任务，返回**新的** Case（不可变）
// 传入的 caseData 不会被修改，方便 React state 直接 setState(toggleTask(...))
export function toggleTask(
  caseData: Case,
  taskId: string,
  verdict: Verdict,
): Case {
  const task = verdict.reconciliation_checklist.find((t) => t.id === taskId);
  if (!task) return caseData; // 未知 taskId 直接返回原态

  const isChecked = caseData.completedChecklist.includes(taskId);

  if (isChecked) {
    // 取消勾选——移除 id + 扣分
    return {
      ...caseData,
      completedChecklist: caseData.completedChecklist.filter((id) => id !== taskId),
      intimacyScore: caseData.intimacyScore - task.intimacy_points,
    };
  }
  // 勾选——加 id + 加分
  return {
    ...caseData,
    completedChecklist: [...caseData.completedChecklist, taskId],
    intimacyScore: caseData.intimacyScore + task.intimacy_points,
  };
}

// 计算某个判决下亲密度的理论满分
export function totalPossibleIntimacy(verdict: Verdict): number {
  return verdict.reconciliation_checklist.reduce(
    (sum, t) => sum + t.intimacy_points,
    0,
  );
}
