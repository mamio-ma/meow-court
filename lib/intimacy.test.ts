import { describe, it, expect } from 'vitest';
import { toggleTask, totalPossibleIntimacy } from './intimacy';
import type { Case, Verdict } from './schema';

// 构造一个最小可用的判决书，只填够跑测试的字段
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

// 初始 case——亲密度 0，勾选列表为空，用作各测试用例的起点
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

  it('does not mutate the input case', () => {
    const original = { ...baseCase, completedChecklist: [...baseCase.completedChecklist] };
    toggleTask(baseCase, 'a', verdict);
    expect(baseCase).toEqual(original);
  });
});

describe('totalPossibleIntimacy', () => {
  it('sums all task points', () => {
    expect(totalPossibleIntimacy(verdict)).toBe(30);
  });

  it('returns 0 for an empty checklist', () => {
    const emptyVerdict = { ...verdict, reconciliation_checklist: [] as Verdict['reconciliation_checklist'] };
    expect(totalPossibleIntimacy(emptyVerdict)).toBe(0);
  });
});
