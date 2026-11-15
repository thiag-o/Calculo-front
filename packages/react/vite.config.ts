// Vite em modo biblioteca (ADR 0004). Esqueleto: os plugins (React, geração de .d.ts)
// e o build do CSS com os tokens --fc-* entram na fase 1.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // React é peer dependency: nunca vai dentro do pacote.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    sourcemap: true,
  },
});
