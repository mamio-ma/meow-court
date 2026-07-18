import { describe, it, expect } from 'vitest';
import { VerdictSchema, PartyStatementSchema, CaseSchema, isFelony } from './schema';

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
      crimes: [{ side: 'left', charge: 'x', severity: '重罪', reasoning: 'x' }],
      reconciliation_checklist: [{ id: '1', task: 'x', intimacy_points: 10 }],
      cat_closing_line: 'x',
    };
    expect(() => VerdictSchema.parse(bad)).toThrow(/责任比例/);
  });

  it('rejects invalid severity', () => {
    const bad = {
      core_conflict: 'x',
      responsibility: { left: 50, right: 50 },
      crimes: [{ side: 'left', charge: 'x', severity: '死刑', reasoning: 'x' }],
      reconciliation_checklist: [{ id: '1', task: 'x', intimacy_points: 10 }],
      cat_closing_line: 'x',
    };
    expect(() => VerdictSchema.parse(bad)).toThrow();
  });

  it('accepts boundary responsibility 100/0', () => {
    const boundary = {
      core_conflict: 'x',
      responsibility: { left: 100, right: 0 },
      crimes: [{ side: 'left', charge: 'x', severity: '重罪', reasoning: 'x' }],
      reconciliation_checklist: [{ id: '1', task: 'x', intimacy_points: 10 }],
      cat_closing_line: 'x',
    };
    expect(() => VerdictSchema.parse(boundary)).not.toThrow();
  });

  it('rejects unknown extra keys (strict mode blocks LLM hallucinations)', () => {
    const withExtra = {
      core_conflict: 'x',
      responsibility: { left: 50, right: 50 },
      crimes: [{ side: 'left', charge: 'x', severity: '重罪', reasoning: 'x' }],
      reconciliation_checklist: [{ id: '1', task: 'x', intimacy_points: 10 }],
      cat_closing_line: 'x',
      hallucinated_field: 'oops',
    };
    expect(() => VerdictSchema.parse(withExtra)).toThrow();
  });
});

describe('PartyStatementSchema', () => {
  it('requires all fields', () => {
    expect(() => PartyStatementSchema.parse({ name: '', narrative: '', grievance: '' })).toThrow();
  });

  it('accepts a valid statement', () => {
    expect(() =>
      PartyStatementSchema.parse({ name: '甲', narrative: 'x', grievance: 'y' }),
    ).not.toThrow();
  });
});

describe('isFelony', () => {
  it('normalizes zh + en to a single predicate', () => {
    expect(isFelony('重罪')).toBe(true);
    expect(isFelony('felony')).toBe(true);
    expect(isFelony('轻罪')).toBe(false);
    expect(isFelony('misdemeanor')).toBe(false);
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
