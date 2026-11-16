// Configuração própria da página de teste de incorporação (só uso local, fora do build de produção).
// Uso: pnpm --filter casca exec vite --config vite.incorporacao.config.ts
// O `pnpm build` usa o vite.config.ts, cuja única entrada é o index.html: esta página nunca entra no pacote.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5274,
    strictPort: true,
    open: '/teste-incorporacao.html',
  },
});
