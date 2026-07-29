import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Alias ai pacchetti del monorepo (sorgente TS/CSS): Vite li compila come parte dell'app.
export default defineConfig({
  resolve: {
    alias: {
      '@rg/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@rg/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  server: { port: 5276, host: true, strictPort: true },
});
