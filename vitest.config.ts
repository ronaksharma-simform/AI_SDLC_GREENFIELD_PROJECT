import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx']
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd())
    }
  }
});
