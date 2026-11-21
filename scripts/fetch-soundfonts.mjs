#!/usr/bin/env node
/**
 * Laeb Noodimeistri kasutatavad FluidR3_GM (mp3) soundfont-failid
 * public/sounds/FluidR3_GM/ alla (oma host, mitte gleitz CDN runtime'is).
 *
 * Allikas (fetch): https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/
 * Litsents: vt public/sounds/LICENSE.md
 *
 * Kasutus: npm run sounds:fetch
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'sounds', 'FluidR3_GM');
const licensePath = path.join(root, 'public', 'sounds', 'LICENSE.md');
const SOURCE_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM';
const FORMAT = 'mp3';

const LICENSE_MD = `# Noodimeister sound library — FluidR3_GM

Noodimeister hostib eelrenderdatud General MIDI instrumente kaustas \`FluidR3_GM/\`.

## Allikas

- Pre-rendered MIDI.js soundfonts: [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (FluidR3_GM, MP3)
- Originaal SoundFont: FluidR3_GM (Frank Wen jt), MIT

## Attribution (required)

Fluid (R3) SoundFont — Copyright (c) 2000-2002, 2008 Frank Wen.

MIDI.js Soundfonts packaging — Benjamin Gleitzman / contributors
(see upstream repository for CC-BY / packaging notices).

MuseScore_General / FluidR3Mono lineage is MIT; keep this LICENSE with redistributed samples.

## Kasutus Noodimeistris

- Runtime laadib faile \`/sounds/FluidR3_GM/{name}-mp3.js\` (sama päritolu kui rakendus).
- Uuenda faile: \`npm run sounds:fetch\`
`;

async function loadRequiredNames() {
  const modPath = path.join(root, 'src', 'musical', 'soundLibrary.js');
  const mod = await import(pathToFileURL(modPath).href);
  if (typeof mod.listRequiredSoundfontNames !== 'function') {
    throw new Error('listRequiredSoundfontNames missing from soundLibrary.js');
  }
  return mod.listRequiredSoundfontNames();
}

async function fetchOne(name) {
  const fileName = `${name}-${FORMAT}.js`;
  const url = `${SOURCE_BASE}/${fileName}`;
  const dest = path.join(outDir, fileName);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) {
    throw new Error(`Suspiciously small response for ${fileName} (${buf.length} bytes)`);
  }
  fs.writeFileSync(dest, buf);
  return { fileName, bytes: buf.length };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '.gitkeep'), '');
  fs.writeFileSync(licensePath, LICENSE_MD, 'utf8');

  const names = await loadRequiredNames();
  console.log(`[sounds:fetch] ${names.length} instruments → ${outDir}`);

  let ok = 0;
  let failed = 0;
  for (const name of names) {
    try {
      const { fileName, bytes } = await fetchOne(name);
      console.log(`  OK  ${fileName} (${(bytes / 1024).toFixed(0)} KiB)`);
      ok += 1;
    } catch (err) {
      console.error(`  FAIL ${name}: ${err.message || err}`);
      failed += 1;
    }
  }

  console.log(`[sounds:fetch] done: ${ok} ok, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[sounds:fetch]', err);
  process.exit(1);
});
