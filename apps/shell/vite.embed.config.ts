// Dedicated config for the embed test page (local use only, outside the production build).
// Uso: pnpm --filter shell exec vite --config vite.embed.config.ts
// `pnpm build` uses vite.config.ts, whose only entry is index.html: this page never ships in the package.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { e2ePorts } from '../../scripts/e2e-ports.mjs';

// Port: 5274, or a derived one when FLUXO_TEST_ISOLATION_ID is set (scripts/e2e-ports.mjs).
const { hostAppPort } = e2ePorts();

export default defineConfig({
  plugins: [react()],
  server: {
    port: hostAppPort,
    strictPort: true,
    open: '/embed-test.html',
  },
});
