import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest 配置——lib/ 逻辑测试用 node 环境；
// 组件测试用 jsdom（MVP 组件测试主要走 E2E，unit 只覆盖 lib/）
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
