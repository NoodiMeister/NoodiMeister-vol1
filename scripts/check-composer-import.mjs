#!/usr/bin/env node
/**
 * Smoke: kujundaja import loeb staves[].notes ja figuurnotatsioon renderdab beat-boxe.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

// Mirror core beat logic (must match composerProjectToSvg.js)
function durationLabelToQuarterBeats(durationLabel) {
  const denom = parseInt(String(durationLabel || '1/4').split('/')[1], 10) || 4;
  return 4 / denom;
}
function noteDurationInQuarterBeats(note) {
  const direct = Number(note?.duration);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const base = durationLabelToQuarterBeats(note?.durationLabel || '1/4');
  return note?.isDotted ? base * 1.5 : base;
}
function notesWithExplicitBeats(noteList) {
  let runningBeat = 0;
  return (noteList || []).map((n) => {
    const beat = typeof n.beat === 'number' ? n.beat : runningBeat;
    runningBeat = beat + noteDurationInQuarterBeats(n);
    return { ...n, beat };
  });
}

const beats = notesWithExplicitBeats([
  { pitch: 'C', octave: 4, durationLabel: '1/4', duration: 1 },
  { pitch: 'D', octave: 4, durationLabel: '1/4', duration: 1 },
  { pitch: 'E', octave: 4, durationLabel: '1/4', duration: 1 },
]);
assert(beats[0].beat === 0 && beats[1].beat === 1 && beats[2].beat === 2, 'staves[].notes sequential beats');

const renderer = read('src/utils/composerProjectToSvg.js');
assert(renderer.includes('normalizeStaves'), 'normalizeStaves helper');
assert(renderer.includes('staff.notes'), 'reads staves[].notes');
assert(renderer.includes('assignNotesToMeasures'), 'assignNotesToMeasures');
assert(renderer.includes('calculateLayout(\'figure\''), 'uses figure layout engine');
assert(renderer.includes('getShapePathsByOctave'), 'figure shape paths');
assert(renderer.includes('stroke="#e0e0e0"'), 'beat grid lines in fallback svg output');

const capture = read('src/export/notationProjectCapture.js');
assert(capture.includes('onProgress'), 'capture reports progress phases');

const timelineUi = read('src/components/composer/ComposerImportTimeline.jsx');
assert(timelineUi.includes('ComposerImportTimeline'), 'import timeline UI component');
assert(timelineUi.includes('Edasi'), 'success dismiss uses Edasi button');

const placement = read('src/utils/composerImportPlacement.js');
assert(placement.includes('placeImportedBlocksOnPages'), 'import placement helper');
assert(placement.includes('isPageAvailableForNotationImport'), 'skips text pages on import');

const model = read('src/document/composerDocumentModel.js');
assert(model.includes('partitionBlocksForRender'), 'layer render ordering');
assert(model.includes('COMPOSER_LAYER_BACKGROUND'), 'background layer support');

const composerPage = read('src/pages/ComposerPage.jsx');
assert(composerPage.includes('ComposerImportTimeline'), 'composer page shows import timeline');
assert(composerPage.includes('placeImportedBlocksOnPages'), 'composer page uses page placement');
assert(composerPage.includes('onBlockLayerChange'), 'composer page supports layer tool');
assert(composerPage.includes('beginImport'), 'composer page orchestrates import steps');
assert(renderer.includes('shouldDrawRestGlyph'), 'rest dedupe parity with editor');

const blocks = read('src/utils/composerSvgBlocks.js');
assert(blocks.includes('captureNotationProjectPages'), 'primary import uses notation capture');
assert(blocks.includes('createComposerSvgBlocksFromProjectJson'), 'multi-page import blocks');
assert(blocks.includes('renderNotationProjectToSvg'), 'fallback project renderer');

function composerPageHasContent(page) {
  if (!page) return false;
  if ((page.blocks?.length || 0) > 0) return true;
  if ((page.textBoxes?.length || 0) > 0) return true;
  return false;
}
function getLastContentPageIndex(pages) {
  let last = -1;
  for (let i = 0; i < (pages?.length || 0); i += 1) {
    if (composerPageHasContent(pages[i])) last = i;
  }
  return last;
}
const samplePages = [
  { blocks: [{ id: 't' }], textBoxes: [] },
  { blocks: [], textBoxes: [{ id: 'tb' }] },
  { blocks: [], textBoxes: [] },
];
assert(getLastContentPageIndex(samplePages) === 1, 'last content skips trailing empty page');

function isPageAvailableForNotationImport(page) {
  if (!page) return false;
  if ((page.blocks || []).some((b) => b.type === 'text')) return false;
  if ((page.textBoxes?.length || 0) > 0) return false;
  return (page.blocks?.length || 0) === 0;
}
assert(isPageAvailableForNotationImport({ blocks: [], textBoxes: [] }), 'empty page ok for import');
assert(!isPageAvailableForNotationImport({ blocks: [{ type: 'text', text: 'Tiitel' }], textBoxes: [] }), 'text page blocked for import');

console.log('check-composer-import: OK');
