/**
 * Regression: R = repeat selection dubleerib ajateljele järele (insert, mitte overwrite).
 */
import {
  extractNoteIndexRangeRelative,
  extractBeatRangeRelative,
  applyRepeatAfterBeat,
  findNoteIndicesInBeatRange,
  clampNoteIndexToAnchorMeasure,
  measureIndexForNoteIndex,
} from '../src/musical/repeatSelection.js';

function assert(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

const notes = [
  { pitch: 'C', octave: 4, duration: 1, beat: 0 },
  { pitch: 'D', octave: 4, duration: 1, beat: 1 },
  { pitch: 'E', octave: 4, duration: 1, beat: 2 },
  { pitch: 'F', octave: 4, duration: 1, beat: 3 },
];

const extracted = extractNoteIndexRangeRelative(notes, 0, 1);
assert(extracted && Math.abs(extracted.spanBeats - 2) < 1e-6, 'span of C+D should be 2');
assert(extracted.notes.length === 2, 'two relative notes');
assert(Math.abs(extracted.notes[0].beat - 0) < 1e-6, 'first relative beat 0');
assert(Math.abs(extracted.notes[1].beat - 1) < 1e-6, 'second relative beat 1');

const repeated = applyRepeatAfterBeat(notes, extracted.endBeat, extracted.spanBeats, extracted.notes);
assert(repeated.length === 6, `expected 6 notes after repeat, got ${repeated.length}`);
assert(repeated[2].pitch === 'C' && Math.abs(repeated[2].beat - 2) < 1e-6, 'copy of C at beat 2');
assert(repeated[3].pitch === 'D' && Math.abs(repeated[3].beat - 3) < 1e-6, 'copy of D at beat 3');
assert(repeated[4].pitch === 'E' && Math.abs(repeated[4].beat - 4) < 1e-6, 'original E shifted to 4');
assert(repeated[5].pitch === 'F' && Math.abs(repeated[5].beat - 5) < 1e-6, 'original F shifted to 5');

const idxs = findNoteIndicesInBeatRange(repeated, 2, 4);
assert(idxs.length === 2 && idxs[0] === 2 && idxs[1] === 3, 'new selection indices 2..3');

const measureNotes = extractBeatRangeRelative(notes, 0, 2);
assert(measureNotes.length === 2 && measureNotes[1].pitch === 'D', 'beat-range extract for measures');

const emptyTail = applyRepeatAfterBeat(
  [{ pitch: 'G', octave: 4, duration: 1, beat: 0 }],
  1,
  1,
  [{ pitch: 'G', octave: 4, duration: 1, beat: 0 }],
);
assert(emptyTail.length === 2 && Math.abs(emptyTail[1].beat - 1) < 1e-6, 'repeat at end appends');

// Measure boundary clamp (plain drag stays in anchor measure)
const twoBarNotes = [
  { pitch: 'C', octave: 4, duration: 1, beat: 0 },
  { pitch: 'D', octave: 4, duration: 1, beat: 1 },
  { pitch: 'E', octave: 4, duration: 1, beat: 2 },
  { pitch: 'F', octave: 4, duration: 1, beat: 3 },
  { pitch: 'G', octave: 4, duration: 1, beat: 4 },
  { pitch: 'A', octave: 4, duration: 1, beat: 5 },
];
const twoBars = [
  { startBeat: 0, endBeat: 4 },
  { startBeat: 4, endBeat: 8 },
];
assert(measureIndexForNoteIndex(twoBarNotes, twoBars, 1) === 0, 'note 1 in measure 0');
assert(measureIndexForNoteIndex(twoBarNotes, twoBars, 4) === 1, 'note 4 in measure 1');
assert(clampNoteIndexToAnchorMeasure(twoBarNotes, twoBars, 0, 5) === 3, 'clamp drag to end of measure 0');
assert(clampNoteIndexToAnchorMeasure(twoBarNotes, twoBars, 5, 1) === 4, 'clamp drag back to start of measure 1');
assert(clampNoteIndexToAnchorMeasure(twoBarNotes, twoBars, 0, 2) === 2, 'within measure unchanged');

console.log('check-repeat-selection: ok');
