import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const LOGS_DIR = resolve(process.cwd(), 'logs');
const LAST_AUTH_ERROR_FILE = resolve(LOGS_DIR, 'last-auth-error.json');
const LAST_AUTH_ERROR_STATUS_FILE = resolve(LOGS_DIR, 'last-auth-error-status.json');

/** Arendusrežiimis: auth-vea salvestamine ja staatus (pending / fixed) kasutaja teavitamiseks. */
function devReportAuthErrorPlugin() {
  return {
    name: 'dev-report-auth-error',
    configureServer(server) {
      const sendJson = (res, data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };

      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';

        if (req.method === 'GET' && path === '/__dev-auth-error-status') {
          try {
            const data = existsSync(LAST_AUTH_ERROR_STATUS_FILE)
              ? JSON.parse(readFileSync(LAST_AUTH_ERROR_STATUS_FILE, 'utf-8'))
              : { status: 'pending' };
            res.statusCode = 200;
            sendJson(res, data);
          } catch {
            sendJson(res, { status: 'pending' });
          }
          return;
        }

        if (req.method === 'POST' && path === '/__dev-mark-error-fixed') {
          try {
            mkdirSync(LOGS_DIR, { recursive: true });
            const record = { status: 'fixed', fixedAt: new Date().toISOString() };
            writeFileSync(LAST_AUTH_ERROR_STATUS_FILE, JSON.stringify(record, null, 2), 'utf-8');
            res.statusCode = 200;
            sendJson(res, record);
          } catch (e) {
            res.statusCode = 500;
            sendJson(res, { error: String(e.message) });
          }
          return;
        }

        if (req.method !== 'POST' || path !== '/__dev-report-error') {
          next();
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            mkdirSync(LOGS_DIR, { recursive: true });
            const payload = JSON.parse(body || '{}');
            const record = {
              timestamp: new Date().toISOString(),
              ...payload,
            };
            writeFileSync(LAST_AUTH_ERROR_FILE, JSON.stringify(record, null, 2), 'utf-8');
            writeFileSync(
              LAST_AUTH_ERROR_STATUS_FILE,
              JSON.stringify({ status: 'pending', reportedAt: record.timestamp }, null, 2),
              'utf-8'
            );
            res.statusCode = 204;
            res.end();
          } catch (e) {
            res.statusCode = 400;
            sendJson(res, { error: String(e.message) });
          }
        });
      });
    },
  };
}

/** SPA fallback preview'i jaoks: /app, /login jms suunatakse index.html poole. */
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '/';
        const hasExtension = url.includes('.');
        // Ära suuna puuduvaid faili-URL-e index.html peale; vasta 404-ga.
        // Muidu üritab brauser HTML-i fondina/parsitava failina dekodeerida (OTS vead + aeglane laadimine).
        if (hasExtension) {
          const localPath = url.startsWith('/') ? url.slice(1) : url;
          const distFilePath = resolve(process.cwd(), 'dist', localPath);
          if (!existsSync(distFilePath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Not Found');
            return;
          }
          next();
          return;
        }
        if (!hasExtension) {
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
  plugins: [react(), devReportAuthErrorPlugin(), spaFallbackPlugin()],
  base: '/',
  // Vercel seab VERCEL_ENV: 'production' | 'preview' | 'development' – test-riba jaoks
  define: {
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV ?? ''),
  },
  optimizeDeps: {
    include: ['lucide-react'],
  },
  root: '.',
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/lucide-react')) return 'lucide-react';
        },
      },
    },
  },
  server: {
    host: '127.0.0.1', // vältib uv_interface_addresses viga (nagu preview)
    // Fikseeritud port — sama mis AGENTS.md / demo-intro (ära lase Vitel vaikimisi 5173 peale hüpata).
    port: 5197,
    strictPort: true,
    open: '/demo-intro',
    // Devis ära kasuta browser cache'i, et iga muudatus tuleks kohe nähtavale.
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
  },
  preview: {
    host: '127.0.0.1',  // vältib uv_interface_addresses viga (Node/OS)
    port: 4177,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
  },
});
