/**
 * MuseScore/Dorico-style horizontal spacing regressions:
 * - traditional: 1/16 and shorter must not collapse under equal beat boxes
 * - figurenotes: 1/8 and shorter must keep min distance from figure size
 */
import {
  DEFAULT_SPACING_RATIO,
  buildMeasureSpacingModel,
  createMeasureHorizontalLayout,
  figurenotesMinNoteDistancePx,
  naturalMeasureWidthFromNotes,
  spacingWidthForDurationBeats,
  traditionalMinNoteDistancePx,
} from '../src/layout/horizontalSpacing.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  assert(DEFAULT_SPACING_RATIO > 1.4 && DEFAULT_SPACING_RATIO < 1.42, 'Default spacing ratio must be √2 (Gould/Dorico).');

  const wq = 85;
  const minTrad = traditionalMinNoteDistancePx(10);
  const q = spacingWidthForDurationBeats(1, { quarterWidthPx: wq, minNoteDistancePx: minTrad });
  const e = spacingWidthForDurationBeats(0.5, { quarterWidthPx: wq, minNoteDistancePx: minTrad });
  const s = spacingWidthForDurationBeats(0.25, { quarterWidthPx: wq, minNoteDistancePx: minTrad });
  const t = spacingWidthForDurationBeats(0.125, { quarterWidthPx: wq, minNoteDistancePx: minTrad });
  assert(Math.abs(q - wq) < 1e-6, 'Quarter width equals reference.');
  assert(e < q && e > minTrad - 1e-6, 'Eighth is narrower than quarter but above min distance.');
  assert(s < e && s >= minTrad - 1e-6, 'Sixteenth is narrower than eighth but above min distance.');
  assert(t >= minTrad - 1e-6, 'Thirty-second respects min note distance floor.');

  // Dense 32nds in one measure must request more natural width than empty 4/4.
  const start = 0;
  const end = 4;
  const thirtySeconds = [];
  for (let i = 0; i < 16; i += 1) {
    thirtySeconds.push({ beat: i * 0.125, duration: 0.125, pitch: 'C', octave: 4 });
  }
  const emptyW = naturalMeasureWidthFromNotes([], {
    startBeat: start,
    endBeat: end,
    beatCount: 4,
    quarterWidthPx: wq,
    minNoteDistancePx: minTrad,
  });
  const denseW = naturalMeasureWidthFromNotes(thirtySeconds, {
    startBeat: start,
    endBeat: end,
    beatCount: 4,
    quarterWidthPx: wq,
    minNoteDistancePx: minTrad,
  });
  assert(denseW > emptyW + 1, 'Dense 1/32 content must widen natural measure width (MuseScore springs).');

  // Within a mixed measure, short notes must not sit in equal beat slots (empty steal).
  const mixed = [
    { beat: 0, duration: 1, pitch: 'C', octave: 4 },
    { beat: 1, duration: 1, pitch: 'D', octave: 4 },
    { beat: 2, duration: 0.25, pitch: 'E', octave: 4 },
    { beat: 2.25, duration: 0.25, pitch: 'F', octave: 4 },
    { beat: 2.5, duration: 0.125, pitch: 'G', octave: 4 },
    { beat: 2.625, duration: 0.125, pitch: 'A', octave: 4 },
    { beat: 2.75, duration: 0.125, pitch: 'B', octave: 4 },
    { beat: 2.875, duration: 0.125, pitch: 'C', octave: 5 },
  ];
  const layout = createMeasureHorizontalLayout({
    notes: mixed,
    startBeat: 0,
    endBeat: 4,
    beatCount: 4,
    measureX: 0,
    measureWidth: 340,
    quarterWidthPx: wq,
    minNoteDistancePx: minTrad,
  });
  const x16a = layout.noteCenterX(mixed[2]);
  const x16b = layout.noteCenterX(mixed[3]);
  const x32a = layout.noteCenterX(mixed[4]);
  const x32b = layout.noteCenterX(mixed[5]);
  assert(x16b - x16a > 14, `1/16 centers must stay readable (got ${x16b - x16a}).`);
  assert(x32b - x32a > 10, `1/32 centers must stay above min gap (got ${x32b - x32a}).`);
  // Equal-beat model would place beat-3 content in [255,340]; springs should pull denser region left of a pure empty trailing steal.
  assert(x16a < 255, 'Dense region must claim space earlier than equal beat-3 box (empty-barline steal regression).');

  // Figurenotes: 1/8 floor from scaled figure size.
  const figSize = 85;
  const min8 = figurenotesMinNoteDistancePx(figSize, 0.5);
  assert(min8 >= figSize * 0.5 + 3, 'Figurenotes 1/8 min distance must cover half-size figure + gap.');
  const eighths = [
    { beat: 0, duration: 0.5, pitch: 'C', octave: 4 },
    { beat: 0.5, duration: 0.5, pitch: 'D', octave: 4 },
    { beat: 1, duration: 0.5, pitch: 'E', octave: 4 },
    { beat: 1.5, duration: 0.5, pitch: 'F', octave: 4 },
    { beat: 2, duration: 0.5, pitch: 'G', octave: 4 },
    { beat: 2.5, duration: 0.5, pitch: 'A', octave: 4 },
    { beat: 3, duration: 0.5, pitch: 'B', octave: 4 },
    { beat: 3.5, duration: 0.5, pitch: 'C', octave: 5 },
  ];
  const figModel = buildMeasureSpacingModel(eighths, {
    startBeat: 0,
    endBeat: 4,
    beatCount: 4,
    quarterWidthPx: wq,
    minNoteDistancePx: min8,
  });
  assert(figModel.naturalWidth >= 8 * min8 - 1, 'Eight eighths must reserve at least 8× figure min distance.');

  console.log('check-horizontal-spacing: ok');
}

main();
