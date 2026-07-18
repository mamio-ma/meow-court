import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest 配置——lib/ 逻辑测试用 node 环境；
// 组件测试用 jsdom（MVP 组件测试主要走 E2E，unit 只覆盖 lib/）
// 排除 e2e/ 目录避免 Playwright test 被 vitest 抓走
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
