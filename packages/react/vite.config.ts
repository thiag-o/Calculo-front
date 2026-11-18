// Vite in library mode (ADR 0004) and Vitest.
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.json', include: ['src'], exclude: ['src/**/*.test.*', 'src/**/*.spec.*'] })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rollupOptions: {
      // Runtime dependencies and peers never go inside the package.
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^react-router/, /^@tanstack\//, /^@radix-ui\//, /^react-hook-form/, /^@hookform\//, /^zod/, /^openapi-fetch/, /^@fontsource/],
    },
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    // Measured on this 12-thread machine (F43): with the default of 11 workers, jsdom tests that take 1.7 s alone took up to 4.9 s
    // (the 5 s limit was hit); with 4 workers the full run takes the same time (~170 s) and the slowest test stays under 2 s.
    // The cause is CPU oversubscription, not a wait in the tests.
    maxWorkers: 4,
    // Same cause: with the e2e (6 browsers) running at the same time, tests that take ~1 s alone took up to 5 s and hit the default
    // 5 s limit (measured in F43: 1 timeout in 913 tests with the e2e in parallel, 0 without it).
    testTimeout: 15000,
  },
});
