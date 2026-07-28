import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@rg/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@rg/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@rg/pattern-grammar': fileURLToPath(new URL('../../packages/pattern-grammar/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5274, host: true, strictPort: true },
});
