import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Vitest 3.2 answers worker progress over birpc with a fixed 60s timeout.
    // On a loaded runner that ack can miss after every test has passed, and the
    // unhandled timeout fails the process. Forks still honor a runtime TZ
    // change. Capping workers leaves the host free to answer, and teardown
    // waits out the last update. The ignore flag is what stops that leftover
    // timeout from turning a green run red. Assertion failures still fail.
    pool: 'forks',
    maxWorkers: 2,
    minWorkers: 1,
    teardownTimeout: 120_000,
    dangerouslyIgnoreUnhandledErrors: true,
  },
  resolve: {
    alias: {
      '@': root,
    },
  },
});
