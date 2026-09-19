import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'shared/test/**/*.test.ts',
      'api/test/**/*.test.ts',
      'db-tests/**/*.test.ts',
      'web/src/**/*.test.ts',
    ],
    setupFiles: ['./web/src/lib/__tests__/setup.jsdomStorage.ts'],
  },
});
