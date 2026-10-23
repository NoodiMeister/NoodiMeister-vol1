/**
 * Smoke: MusicXML eksport peab olema Failimenüüs ja score-partwise builder peab eksisteerima.
 * Run: node scripts/check-musicxml-export.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

async function main() {
  const exportMod = await read('src/export/musicXmlExport.js');
  const app = await read('src/noodimeister-complete.jsx');
  const i18n = await read('src/i18n.js');

  assert(exportMod.includes('export function buildMusicXmlFromProject'), 'Missing MusicXML builder.');
  assert(exportMod.includes('score-partwise'), 'Builder must emit score-partwise.');
  assert(exportMod.includes('export function downloadMusicXmlFile'), 'Missing download helper.');
  assert(exportMod.includes('export function getMusicXmlExportFileName'), 'Missing filename helper.');
  assert(exportMod.includes('groupStavesIntoParts'), 'Multi-staff brace grouping missing.');

  assert(app.includes('buildMusicXmlFromProject'), 'App must import MusicXML builder.');
  assert(app.includes('exportToMusicXml'), 'App must expose exportToMusicXml handler.');
  assert(app.includes("t('file.exportMusicXml')"), 'File menu must show MusicXML export.');

  assert(i18n.includes("'file.exportMusicXml'"), 'i18n missing exportMusicXml (et).');
  assert(i18n.includes("'file.exportMusicXmlTitle'"), 'i18n missing exportMusicXmlTitle.');
  assert(i18n.includes("'file.exportMusicXmlDone'"), 'i18n missing exportMusicXmlDone.');

  console.log('check-musicxml-export: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
