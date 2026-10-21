/**
 * Smoke: key-aware transpose peab austama helistiku diatoonilisi #/♭
 * ja mitte jätma beekaare F/C peale D-duuris pärast D→A (jm) transpositsiooni.
 */
import {
  transposeNotes,
  normalizeAccidentalsForKey,
  getEffectiveAccidental,
  pitchOctaveToMidi,
} from '../src/musical/transpose.js';
import { getAccidentalForPitchInKey } from '../src/utils/notationConstants.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// D-duur: F ja C ilma accidentalita = F# / C#
const dMajorNotes = [
  { id: 1, pitch: 'D', octave: 4 },
  { id: 2, pitch: 'E', octave: 4 },
  { id: 3, pitch: 'F', octave: 4 }, // implied F#
  { id: 4, pitch: 'C', octave: 5 }, // implied C#
];

assert(getEffectiveAccidental(dMajorNotes[2], 'D') === 1, 'F in D → effective #');
assert(getEffectiveAccidental(dMajorNotes[3], 'D') === 1, 'C in D → effective #');
assert(getEffectiveAccidental({ pitch: 'E', octave: 4 }, 'D') === 0, 'E in D → natural');

const fMidiBroken = pitchOctaveToMidi('F', 4) + 0;
const fMidiCorrect = pitchOctaveToMidi('F', 4) + getEffectiveAccidental(dMajorNotes[2], 'D');
assert(fMidiCorrect === fMidiBroken + 1, 'implied F# is one semitone above F♮');

// D → A = +7 semitones; F# → C#, C# → G#
const toA = normalizeAccidentalsForKey(
  transposeNotes(dMajorNotes, 7, { fromKey: 'D', toKey: 'A' }),
  'A'
);

const byId = Object.fromEntries(toA.map((n) => [n.id, n]));
assert(byId[1].pitch === 'A', `D→A: D becomes A (got ${byId[1].pitch})`);
assert(byId[2].pitch === 'B', `D→A: E becomes B (got ${byId[2].pitch})`);
assert(byId[3].pitch === 'C', `D→A: F# becomes C (got ${byId[3].pitch})`);
assert(
  byId[3].accidental === undefined || byId[3].accidental === null,
  'D→A: C (from F#) should use implied # in A major (no explicit accidental)'
);
assert(getAccidentalForPitchInKey('C', 'A') === 1, 'A major has C#');

// Broken path (no fromKey): F treated as F♮ → wrong pitch + often explicit natural after normalize
const broken = normalizeAccidentalsForKey(transposeNotes(dMajorNotes, 7), 'A');
const brokenF = broken.find((n) => n.id === 3);
assert(
  brokenF.pitch !== 'C' || brokenF.accidental === 0,
  'regression guard: old transpose without fromKey mis-handles implied F#'
);

// Explicit F♮ in D must survive normalize (shows ♮) but stay movable via chromatic path elsewhere
const withNatural = normalizeAccidentalsForKey(
  [{ pitch: 'F', octave: 4, accidental: 0 }],
  'D'
);
assert(withNatural[0].accidental === 0, 'explicit F♮ in D kept (courtesy/cancel)');

if (process.exitCode) {
  console.error('\ntranspose accidental checks failed');
  process.exit(1);
}
console.log('\nAll transpose accidental checks passed');
