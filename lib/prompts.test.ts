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
