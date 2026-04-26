import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      vscode: '/home/aditya/Code/vscode_extension/metalens/test/__mocks__/vscode.ts',
    },
  },
});
