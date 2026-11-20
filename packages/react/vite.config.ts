// Vite in library mode (ADR 0004) and Vitest.
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { defineConfig, type Plugin } from 'vitest/config';

// ADR 0037: Monaco's sash.css declares its variables on `:root`, a global selector (ADR 0002). Scope them to the module root.
function scopeMonacoRoot(): Plugin {
  return {
    name: 'fc-scope-monaco-root',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replaceAll('\\', '/');
      if (!file.endsWith('.css') || !file.includes('/monaco-editor/')) return null;
      return { code: code.replace(/:root(?![\w-])/g, '.fc-root'), map: null };
    },
  };
}

// React Flow (@xyflow/react) imports `react-compiler-runtime`, a CommonJS file that calls `require('react')`. Bundled into an ES
// module with `react` external, that `require` has nowhere to run and the host app page fails on load. Only the memo cache `c` is
// used; this is its logic (from react-compiler-runtime 1.0.0) as ES module code, so `react` stays an ordinary import.
function reactCompilerRuntime(): Plugin {
  const id = '\0fc-react-compiler-runtime';
  return {
    name: 'fc-react-compiler-runtime',
    enforce: 'pre',
    resolveId: (source) => (source === 'react-compiler-runtime' ? id : null),
    load: (file) =>
      file === id
        ? `import * as React from 'react';
const empty = Symbol.for('react.memo_cache_sentinel');
export const c = typeof React.__COMPILER_RUNTIME?.c === 'function'
  ? React.__COMPILER_RUNTIME.c
  : function memoCache(size) {
      return React.useMemo(() => {
        const cache = new Array(size);
        for (let index = 0; index < size; index++) cache[index] = empty;
        cache[empty] = true;
        return cache;
      }, []);
    };`
        : null,
  };
}

export default defineConfig({
  plugins: [scopeMonacoRoot(), reactCompilerRuntime(), react(), dts({ tsconfigPath: './tsconfig.json', include: ['src'], exclude: ['src/**/*.test.*', 'src/**/*.spec.*'] })],
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
      output: {
        // ADR 0037: Monaco is bundled (not external) and goes into its own chunk, reached only through a dynamic import(),
        // so dist/index.js never contains it and the browser downloads it when the editor opens (E4-21).
        codeSplitting: {
          groups: [{ name: 'monaco', test: /node_modules[\\/]monaco-editor[\\/]/, priority: 10 }],
        },
      },
    },
    sourcemap: true,
  },
  // The editor worker is imported with `?worker` (monaco-editor/editor/editor.worker?worker) and emitted as a local file in dist/:
  // no CDN. Without that worker, Monaco runs on the page thread (slower, still works).
  worker: { format: 'es' },
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
