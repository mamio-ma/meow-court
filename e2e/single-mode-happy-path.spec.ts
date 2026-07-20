import { test, expect } from '@playwright/test';

// 预制的 mock verdict——避免 E2E 真调 Bedrock（慢 + 花钱 + 不稳定）
const MOCK_VERDICT = {
  core_conflict: 'e2e-test-conflict',
  responsibility: { left: 60, right: 40 },
  crimes: [
    { side: 'left', charge: 'e2e-charge', severity: '轻罪', reasoning: 'e2e-reasoning' },
  ],
  reconciliation_checklist: [
    { id: 'task1', task: 'e2e task 1', intimacy_points: 10 },
  ],
  cat_closing_line: 'e2e closing',
};

// 把 mock verdict 拼成 SSE 流响应体——模拟真接口的 event 顺序
const buildSseBody = () =>
  [
    { type: 'section', section: 'core_conflict', content: MOCK_VERDICT.core_conflict },
    { type: 'section', section: 'responsibility', content: MOCK_VERDICT.responsibility },
    { type: 'section', section: 'crimes', content: MOCK_VERDICT.crimes },
    { type: 'section', section: 'reconciliation_checklist', content: MOCK_VERDICT.reconciliation_checklist },
    { type: 'section', section: 'cat_closing_line', content: MOCK_VERDICT.cat_closing_line },
    { type: 'done', verdict: MOCK_VERDICT },
  ]
    .map((ev) => `data: ${JSON.stringify(ev)}\n\n`)
    .join('');

test('single-mode happy path: input → verdict → accept → checklist → done', async ({ page }) => {
  // Stub /api/verdict——不真调 Bedrock
  await page.route('**/api/verdict', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: buildSseBody(),
    }),
  );

  // Screen 1: Landing → 点击开始审判
  await page.goto('/');
  await expect(page.getByText(/猫猫大法官|Chief Justice Whiskers/)).toBeVisible();
  await page.getByRole('button', { name: /开始审判|Open Court/ }).click();

  // Screen 2: Mode 选择 → 点击单机
  await page.getByRole('button', { name: /一起用一台|One phone/ }).click();

  // Screen 3: 填甲方 —— 用 label 关联的第一个 input + 前两个 textarea
  await page.locator('input').first().fill('小美');
  await page.locator('textarea').nth(0).fill('他吃了我的芝士条');
  await page.locator('textarea').nth(1).fill('心里没我');

  // 填乙方 —— 第二个 input + 后两个 textarea
  await page.locator('input').nth(1).fill('阿明');
  await page.locator('textarea').nth(2).fill('就一根');
  await page.locator('textarea').nth(3).fill('小题大做');

  // 点提交 —— 触发 SSE
  await page.getByRole('button', { name: /交给猫猫|Submit to the Cat/ }).click();

  // 判决渲染——mock verdict 中的核心矛盾应出现
  await expect(page.getByText('e2e-test-conflict')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/e2e-charge/)).toBeVisible();

  // 点"接受判决"
  await page.getByRole('button', { name: /接受判决|Accept/ }).first().click();

  // Checklist 出现——勾第一项
  await page.getByText('e2e task 1').click();
  // 飘浮 "+10 🌿" 弹窗——用带叶子 emoji 的完整文案精确定位，避开 checklist 按钮里的 "+10" 标签
  await expect(page.getByText('+10 🌿')).toBeVisible();

  // 全部勾完（只有一项）→ done 页
  await expect(page.getByText(/和解成功|Reconciled/)).toBeVisible({ timeout: 5_000 });
});
