/**
 * MIDI → pitch spelling + pedagoogilise F/B värvi ankur.
 * Käivita: node scripts/check-midi-pitch-spelling.mjs
 */
import assert from 'node:assert/strict';
import { getPitchFromMidi } from '../src/musical/PitchInputLogic.js';
import { getPedagogicalColor, getRelativeStaffStepsFromJo } from '../src/notation/PedagogicalLogic.js';
import { getStaffPositionTreble, getTonicStaffPosition } from '../src/notation/StaffConstants.js';

/** MuseScore C-duur mustade klahvide eelistus */
const C_MAJOR_BLACK = [
  [61, 'C', 1],   // C#
  [63, 'E', -1],  // Eb
  [66, 'F', 1],   // F#
  [68, 'G', 1],   // G#
  [70, 'B', -1],  // Bb (mitte A#)
];

for (const [midi, pitch, acc] of C_MAJOR_BLACK) {
  const r = getPitchFromMidi(midi, 'C');
  assert.equal(r.pitch, pitch, `MIDI ${midi} pitch`);
  assert.equal(r.accidental, acc, `MIDI ${midi} accidental`);
}

/** Valged: F ja B peavad olema F/B ilma explicit accidentalita */
for (const [midi, pitch] of [[65, 'F'], [71, 'B'], [60, 'C'], [64, 'E'], [67, 'G']]) {
  const r = getPitchFromMidi(midi, 'C');
  assert.equal(r.pitch, pitch, `MIDI ${midi} natural pitch`);
  assert.equal(r.accidental, undefined, `MIDI ${midi} implicit accidental`);
}

/** F-duuris Bb on võtmes (implicit); B♮ on natural */
{
  const bb = getPitchFromMidi(70, 'F');
  assert.equal(bb.pitch, 'B');
  assert.equal(bb.accidental, undefined, 'Bb in F = implicit');
  const bn = getPitchFromMidi(71, 'F');
  assert.equal(bn.pitch, 'B');
  assert.equal(bn.accidental, 0, 'B natural in F');
}

/** Pedagoogiline: F ja B värvid JO=C4 ankruga (mitte nihkes) */
const joPos = getTonicStaffPosition('C');
assert.equal(joPos, getStaffPositionTreble('C', 4));
const stepsF = getRelativeStaffStepsFromJo('C', joPos, 'F', 4);
const stepsB = getRelativeStaffStepsFromJo('C', joPos, 'B', 4);
assert.equal(stepsF, 3, 'F = NA (3 steps from JO)');
assert.equal(stepsB, 6, 'B = DI (6 steps from JO)');
const colorF = getPedagogicalColor('C', joPos, 'F', 4);
const colorB = getPedagogicalColor('C', joPos, 'B', 4);
const colorJo = getPedagogicalColor('C', joPos, 'C', 4);
assert.notEqual(colorF, colorJo, 'F ei tohi olla JO-värv');
assert.notEqual(colorB, colorJo, 'B ei tohi olla JO-värv');
assert.equal(colorF, '#43a047', 'F = NA green');
assert.equal(colorB, '#7b1fa2', 'B = DI purple');

console.log('check-midi-pitch-spelling: ok');
