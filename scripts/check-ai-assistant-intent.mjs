/**
 * Smoke: natural-language questions → How-to guide intent (no LLM).
 * Run: node scripts/check-ai-assistant-intent.mjs
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Vite-style extensionless imports: load via dynamic import with .js paths rewritten by copying logic inline.
// Use a tiny transform: import the built-free modules with full .js paths.
const answerUrl = pathToFileURL(path.join(root, 'src/services/answerFromHowToGuide.js')).href;

// Patch: Node needs .js on relative imports inside that module — rewrite by evaluating via Vite? 
// Simpler: duplicate the critical import path by reading and using createRequire after fixing.
// Actually the service imports '../content/howToGuideContent' without extension.
// Fix for smoke: use dynamic import with query after temporarily... 
// Best: shell with --experimental-import-meta-resolve won't help.
// Use vite-node if available, else inline test of detect via copying.

async function loadWithJsExt() {
  // Import content first with full path, then answer — but answer still has extensionless import.
  // So we register a custom loader isn't available easily.
  // Workaround: spawn vite-node or use esbuild-register.
  const { build } = await import('esbuild').catch(() => ({ build: null }));
  if (!build) {
    console.log('SKIP: esbuild not available for smoke; rely on vite build.');
    process.exit(0);
  }
  const outfile = path.join(root, 'scripts/.tmp-ai-intent-bundle.mjs');
  await build({
    entryPoints: [path.join(root, 'src/services/answerFromHowToGuide.js')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

const { answerFromHowToGuide, detectQuestionIntent } = await loadWithJsExt();

const cases = [
  {
    q: 'Mul on lugu noodis valmis ja tahaksin kuulata',
    locale: 'et',
    expectIntent: 'listenPlayback',
    expectMatchTitleIncludes: 'kuulata',
  },
  {
    q: 'Kuidas oma pala mängida?',
    locale: 'et',
    expectIntent: 'listenPlayback',
    expectMatchTitleIncludes: 'kuulata',
  },
  {
    q: 'How can I listen to my finished song?',
    locale: 'en',
    expectIntent: 'listenPlayback',
    expectMatchTitleIncludes: 'listen',
  },
  {
    q: 'Kuidas PDF printida?',
    locale: 'et',
    expectIntent: 'exportPrint',
    expectMatchTitleIncludes: 'PDF',
  },
];

let failed = 0;
for (const c of cases) {
  const intent = detectQuestionIntent(c.q, c.locale);
  const ans = answerFromHowToGuide(c.q, c.locale);
  const intentOk = intent?.id === c.expectIntent;
  const matchOk = ans?.matched && String(ans.title).toLowerCase().includes(c.expectMatchTitleIncludes.toLowerCase());
  if (!intentOk || !matchOk) {
    failed += 1;
    console.error('FAIL', c.q, { intent: intent?.id, title: ans?.title, matched: ans?.matched, score: ans?.score });
  } else {
    console.log('OK', c.q, '→', ans.title);
  }
}

try {
  const fs = await import('node:fs');
  fs.unlinkSync(path.join(root, 'scripts/.tmp-ai-intent-bundle.mjs'));
} catch (_) { /* ignore */ }

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nAll intent smoke cases passed.');
