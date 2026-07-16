import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Alias @rg/core alla sorgente TS: Vite compila il core come parte dell'app (no build step separato).
export default defineConfig({
  resolve: {
    alias: {
      '@rg/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5273, host: '127.0.0.1' },
});
