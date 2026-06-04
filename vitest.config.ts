import { defineConfig } from 'vitest/config'

// Standalone config so tests don't pull in the PWA build plugins.
// Pure-logic unit tests run in a node environment (no DOM needed).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
