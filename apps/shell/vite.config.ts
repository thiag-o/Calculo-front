// Shell app (host app zero, ADR 0002).
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { e2ePorts } from '../../scripts/e2e-ports.mjs';

// Port: 5173, or a derived one when FLUXO_TEST_ISOLATION_ID is set (scripts/e2e-ports.mjs).
const { shellPort } = e2ePorts();

export default defineConfig({
  plugins: [react()],
  server: {
    port: shellPort,
    strictPort: true,
  },
});
