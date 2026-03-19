import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return readFile(absolutePath, 'utf8');
}

async function main() {
  const scoreToSvg = await read('src/utils/scoreToSvg.js');
  const app = await read('src/noodimeister-complete.jsx');
  const css = await read('src/index.css');

  assert(scoreToSvg.includes('export function buildScoreSceneSnapshot'), 'Missing DOM-free scene snapshot builder.');
  assert(!scoreToSvg.includes('local("serif")'), 'Export defs still depend on local serif fallback.');
  assert(app.includes('buildScoreSceneSnapshot('), 'Preview/PDF path is not using the scene snapshot builder.');
  assert(app.includes('renderToStaticMarkup('), 'Export scene is not rendered from deterministic React markup.');
  assert(app.includes('pageDiv.innerHTML = pageSvg;'), 'Print preview is not using inline SVG pages.');
  assert(css.includes("@font-face {\n  font-family: 'Leland';"), 'Leland alias font-face is missing.');
  assert(css.includes('@fontsource/bravura/files/bravura-latin-400-normal.woff2'), 'Leland is not mapped to bundled Bravura.');

  console.log('Export determinism smoke checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
