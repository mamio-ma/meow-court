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
