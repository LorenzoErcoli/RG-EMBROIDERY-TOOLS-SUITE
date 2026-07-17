import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@rg/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@rg/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@app/net-45': fileURLToPath(new URL('../net-45/src/tool.ts', import.meta.url)),
    },
  },
  server: { port: 5270, host: '127.0.0.1' },
});
