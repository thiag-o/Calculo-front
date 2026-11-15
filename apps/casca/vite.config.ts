// App casca (hospedeiro zero, ADR 0002). Esqueleto: o plugin do React entra na fase 1.
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
});
