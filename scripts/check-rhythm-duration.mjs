/**
 * Takti-sisene rütmiasendus: noot ja paus jagavad sama kestust,
 * muutus jääb takti sisse ega nihuta järgmist takti.
 */
import { rewriteRhythmSpan, rhythmDurationBeats, restsForSpan } from '../src/musical/rhythmDuration.js';

function assert(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

function quarters() {
  return ['C', 'D', 'E', 'F'].map((pitch, i) => ({
    id: pitch,
    pitch,
    octave: 4,
    duration: 1,
    durationLabel: '1/4',
    isDotted: false,
    isRest: false,
    beat: i,
  }));
}

assert(rhythmDurationBeats('1/4', false) === 1, 'quarter note is 1');
assert(rhythmDurationBeats('1/4', false) === rhythmDurationBeats('1/4', false), 'same label');
assert(Math.abs(rhythmDurationBeats('1/8') - 0.5) < 1e-9, 'eighth is 0.5');
assert(Math.abs(rhythmDurationBeats('1/2', true) - 3) < 1e-9, 'dotted half is 3');
const quarterRest = restsForSpan(0, 1)[0];
assert(quarterRest.isRest && quarterRest.duration === 1 && quarterRest.durationLabel === '1/4', 'quarter rest matches quarter note');

const lengthened = rewriteRhythmSpan(quarters(), {
  beat: 0,
  durationBeats: 2,
  durationLabel: '1/2',
  isDotted: false,
  measureEndBeat: 4,
});
assert(lengthened.ok, 'lengthen should fit');
assert(lengthened.notes[0].pitch === 'C' && lengthened.notes[0].duration === 2, 'C becomes half');
assert(!lengthened.notes.some((n) => n.pitch === 'D'), 'overlapping D is replaced');
assert(lengthened.notes.some((n) => n.pitch === 'E' && n.beat === 2), 'E stays at beat 2');
assert(lengthened.notes.some((n) => n.pitch === 'F' && n.beat === 3), 'F stays in the next beat, not shifted to the next bar');
const sum = lengthened.notes.reduce((s, n) => s + n.duration, 0);
assert(Math.abs(sum - 4) < 1e-6, `measure still sums to 4, got ${sum}`);

const shortened = rewriteRhythmSpan(quarters(), {
  beat: 0,
  durationBeats: 0.5,
  durationLabel: '1/8',
  isDotted: false,
  measureEndBeat: 4,
});
assert(shortened.ok, 'shorten should fit');
assert(shortened.notes[0].duration === 0.5 && shortened.notes[0].durationLabel === '1/8', 'C becomes eighth');
const gapRest = shortened.notes.find((n) => n.isRest && Math.abs(n.beat - 0.5) < 1e-6);
assert(gapRest && gapRest.duration === 0.5 && gapRest.durationLabel === '1/8', 'freed time is an eighth rest');
assert(shortened.notes.some((n) => n.pitch === 'D' && n.beat === 1), 'D stays at beat 1');

const overflow = rewriteRhythmSpan(quarters(), {
  beat: 3,
  durationBeats: 2,
  durationLabel: '1/2',
  measureEndBeat: 4,
});
assert(!overflow.ok && overflow.reason === 'exceeds-measure', 'half note on the last beat must not cross the barline');

const intoNext = rewriteRhythmSpan(quarters().concat([{
  id: 'G',
  pitch: 'G',
  octave: 4,
  duration: 1,
  durationLabel: '1/4',
  beat: 4,
}]), {
  beat: 0,
  durationBeats: 2,
  durationLabel: '1/2',
  measureEndBeat: 4,
});
assert(intoNext.ok && intoNext.notes.some((n) => n.pitch === 'G' && n.beat === 4), 'next measure note stays at beat 4');

const mid = rewriteRhythmSpan([{
  id: 'half',
  pitch: 'A',
  octave: 4,
  duration: 2,
  durationLabel: '1/2',
  beat: 0,
}, {
  id: 'q2',
  pitch: 'B',
  octave: 4,
  duration: 1,
  durationLabel: '1/4',
  beat: 2,
}, {
  id: 'q3',
  pitch: 'C',
  octave: 4,
  duration: 1,
  durationLabel: '1/4',
  beat: 3,
}], {
  beat: 1,
  durationBeats: 1,
  durationLabel: '1/4',
  measureEndBeat: 4,
  placeNote: { id: 'new', pitch: 'D', octave: 4, duration: 1, durationLabel: '1/4', isRest: false },
});
assert(mid.ok, 'insert inside a sounding note');
assert(mid.notes.some((n) => n.pitch === 'A' && n.duration === 1 && n.beat === 0), 'previous note is cut to the cursor');
assert(mid.notes.some((n) => n.pitch === 'D' && n.beat === 1 && n.duration === 1), 'new note occupies the cursor');
assert(mid.notes.some((n) => n.pitch === 'B' && n.beat === 2), 'later note stays');
const midSum = mid.notes.reduce((s, n) => s + n.duration, 0);
assert(Math.abs(midSum - 4) < 1e-6, `insert inside a note still fills 4, got ${midSum}`);

console.log('rhythm duration checks ok');
