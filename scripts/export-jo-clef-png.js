/**
 * Export clef-JO on staff (canonical preview) to PNG.
 * Same rules as clef-jo-a-major: JO on staff, no extra ledger when on staff.
 * Run: node scripts/export-jo-clef-png.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'docs', 'symbol-previews', 'clef-jo.png');

const W = 420;
const H = 220;

// Example: JO at A4 (2nd space), staff position 3 → Y 115. No extra ledger (on staff).
const JO_CLEF_Y = 115;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g id="staff-and-clef">
    <line x1="70" y1="90"  x2="400" y2="90"  stroke="#000" stroke-width="1.2"/>
    <line x1="70" y1="100" x2="400" y2="100" stroke="#000" stroke-width="1.2"/>
    <line x1="70" y1="110" x2="400" y2="110" stroke="#000" stroke-width="1.2"/>
    <line x1="70" y1="120" x2="400" y2="120" stroke="#000" stroke-width="1.2"/>
    <line x1="70" y1="130" x2="400" y2="130" stroke="#000" stroke-width="1.2"/>
    <g transform="translate(24, ${JO_CLEF_Y}) scale(0.5) translate(0, -40)">
      <rect x="0"  y="0" width="6"  height="80" fill="#000"/>
      <rect x="15" y="0" width="6"  height="80" fill="#000"/>
      <rect x="21" y="30" width="32" height="5"  fill="#000"/>
      <rect x="21" y="45" width="32" height="5"  fill="#000"/>
    </g>
    <line x1="49" y1="${JO_CLEF_Y}" x2="61" y2="${JO_CLEF_Y}" stroke="#000" stroke-width="1.2"/>
  </g>
  <text x="320" y="75" font-size="14" fill="#333" font-family="sans-serif" font-weight="600">clef-JO</text>
  <text x="320" y="92" font-size="11" fill="#666" font-family="sans-serif">on staff (4 stripes, tonic position)</text>
</svg>`;

async function main() {
  const sharp = (await import('sharp')).default;
  const outDir = path.dirname(OUT_PATH);
  fs.mkdirSync(outDir, { recursive: true });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync(OUT_PATH, png);
  console.log('Saved', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
