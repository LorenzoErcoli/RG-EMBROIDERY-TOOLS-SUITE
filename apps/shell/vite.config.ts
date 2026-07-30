import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  // In build: percorso RELATIVO agli asset → il sito funziona servito da https://utente.github.io/<repo>/
  // (GitHub Pages) senza dover conoscere il nome del repo. In sviluppo resta la radice.
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      '@rg/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@rg/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@app/net-45': fileURLToPath(new URL('../net-45/src/tool.ts', import.meta.url)),
      '@app/pattern-grammar': fileURLToPath(new URL('../pattern-grammar/src/tool.ts', import.meta.url)),
      '@app/interlace': fileURLToPath(new URL('../interlace/src/tool.ts', import.meta.url)),
      '@app/bitmap': fileURLToPath(new URL('../bitmap/src/tool.ts', import.meta.url)),
      '@app/oblique': fileURLToPath(new URL('../oblique/src/tool.ts', import.meta.url)),
      '@rg/pattern-grammar': fileURLToPath(new URL('../../packages/pattern-grammar/src/index.ts', import.meta.url)),
    },
  },
  // host: true → ascolta su tutte le interfacce di rete (LAN), non solo su localhost.
  // strictPort → la porta resta 5270, così l'indirizzo per gli altri dispositivi è stabile.
  server: { port: 5270, host: true, strictPort: true },
}));
