// 每个测试前重置模块缓存，避免 lib/ 之间的 mock 污染
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});
