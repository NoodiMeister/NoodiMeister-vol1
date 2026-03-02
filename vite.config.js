import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/** SPA fallback preview'i jaoks: /app, /login jms suunatakse index.html poole. */
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '/';
        // Kui ei ole päring staatilisele failile (assets), anna index.html (SPA fallback)
        const isAsset = url.startsWith('/assets/') || url.includes('.');
        if (!isAsset) {
          try {
            const index = resolve(process.cwd(), 'dist', 'index.html');
            const html = readFileSync(index, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch {
            next();
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  base: '/',  // Vercel serveerib juurest; sama paigutus kohalikult ja veebis
  root: '.',
  build: {
    sourcemap: true,
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    host: '127.0.0.1',  // vältib uv_interface_addresses viga (nagu preview)
    port: 5173,
    strictPort: false, // use next free port if 5173 is taken
    open: true,   // open browser automatically
  },
  preview: {
    host: '127.0.0.1',  // vältib uv_interface_addresses viga (Node/OS)
    port: 4173,
  },
});
