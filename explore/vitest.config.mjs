// Offline fallback for this Windows session where Node cannot spawn esbuild.
// Same test globs/environment as the repository config; TypeScript transpiles in-process.
import { defineConfig } from 'vitest/config';
import ts from 'typescript';

export default defineConfig({
  esbuild: false,
  resolve: { preserveSymlinks: true },
  plugins: [{
    name: 'explore-typescript-in-process',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.tsx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return;
      return {
        code: ts.transpileModule(code, { compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
        }, fileName: id }).outputText,
        map: null,
      };
    },
  }],
  test: {
    environment: 'node', globals: true,
    include: ['src/**/__tests__/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    pool: 'threads', poolOptions: { threads: { singleThread: true } },
    deps: { optimizer: { ssr: { enabled: false }, web: { enabled: false } } },
  },
});
