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
  },
});
