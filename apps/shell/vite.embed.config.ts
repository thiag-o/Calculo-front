// Dedicated config for the embed test page (local use only, outside the production build).
// Uso: pnpm --filter shell exec vite --config vite.embed.config.ts
// `pnpm build` uses vite.config.ts, whose only entry is index.html: this page never ships in the package.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5274,
    strictPort: true,
    open: '/embed-test.html',
  },
});
