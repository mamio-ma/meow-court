import { test, expect } from '@playwright/test';

// 冒烟测试——只确认首页能起来、title 正确
// 这个测试依赖 app/layout.tsx 里的 metadata.title
test('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/猫猫法庭|Feline Court|猫猫大法官/);
});
