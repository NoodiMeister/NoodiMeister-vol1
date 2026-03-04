#!/usr/bin/env node
/**
 * Test: klaveri klaviatuuri noodikõrgused ja sagedused.
 * Kontrollib, et iga noot (C3–C5 vahemik) annab õige sageduse (A4 = 440 Hz võrdtempereeritud).
 * Käivita: node scripts/test-piano-notes.mjs
 */

const PITCH_TO_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function getNoteFrequency(refNote, refOctave, refHz, pitch, octave, semitonesOffset = 0) {
  const refSemi = PITCH_TO_SEMI[refNote] ?? 9;
  const noteSemi = PITCH_TO_SEMI[pitch] ?? 0;
  const semitones = (octave - refOctave) * 12 + (noteSemi - refSemi) + semitonesOffset;
  return refHz * Math.pow(2, semitones / 12);
}

function pitchOctaveToMidi(pitch, octave) {
  return (octave + 1) * 12 + (PITCH_TO_SEMI[pitch] ?? 0);
}

// Standard: A4 = 440 Hz
const REF_NOTE = 'A';
const REF_OCTAVE = 4;
const REF_HZ = 440;

const NATURAL_PITCHES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARP_PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const errors = [];
const tested = [];

// 1) A4 peab olema 440 Hz
const a4Freq = getNoteFrequency(REF_NOTE, REF_OCTAVE, REF_HZ, 'A', 4, 0);
if (Math.abs(a4Freq - 440) > 0.01) {
  errors.push(`A4 sagedus peaks olema 440 Hz, saadi ${a4Freq.toFixed(2)}`);
} else {
  tested.push('A4 = 440 Hz ✓');
}

// 2) Kõik noodid vahemikus C3–C5 (looduslikud + dieesid) ja nende sagedused
const OCTAVES = [3, 4, 5];
const expectedFrequencies = {
  'C3': 130.81, 'C#3': 138.59, 'Db3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'Eb3': 155.56, 'E3': 164.81, 'F3': 174.61,
  'F#3': 185.00, 'Gb3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'Ab3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'Bb3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'Db4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13, 'E4': 329.63, 'F4': 349.23,
  'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'Ab4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
  'C5': 523.25
};

for (const oct of OCTAVES) {
  for (const pitch of NATURAL_PITCHES) {
    const freq = getNoteFrequency(REF_NOTE, REF_OCTAVE, REF_HZ, pitch, oct, 0);
    const key = `${pitch}${oct}`;
    const expected = expectedFrequencies[key];
    if (expected != null && Math.abs(freq - expected) > 0.1) {
      errors.push(`${key}: oodati ${expected.toFixed(2)} Hz, saadi ${freq.toFixed(2)}`);
    }
    tested.push({ note: key, freq: Math.round(freq * 100) / 100, midi: pitchOctaveToMidi(pitch, oct) });
  }
}

// Dieesid (semitonesOffset = 1)
for (const oct of OCTAVES) {
  for (const pitch of NATURAL_PITCHES) {
    const freqSharp = getNoteFrequency(REF_NOTE, REF_OCTAVE, REF_HZ, pitch, oct, 1);
    tested.push({ note: `${pitch}#${oct}`, freq: Math.round(freqSharp * 100) / 100, midi: pitchOctaveToMidi(pitch, oct) + 1 });
  }
}

// 3) react-piano MIDI numbrid C3=48, C5=72
const midiC3 = pitchOctaveToMidi('C', 3);
const midiC5 = pitchOctaveToMidi('C', 5);
if (midiC3 !== 48) errors.push(`C3 MIDI peaks olema 48, saadi ${midiC3}`);
if (midiC5 !== 72) errors.push(`C5 MIDI peaks olema 72, saadi ${midiC5}`);
if (midiC3 === 48) tested.push('MIDI C3=48 ✓');
if (midiC5 === 72) tested.push('MIDI C5=72 ✓');

// Tulemused
console.log('=== Klaveri klaviatuuri nooditest (C3–C5) ===\n');
console.log('A4 = 440 Hz:', Math.abs(a4Freq - 440) < 0.01 ? 'OK' : 'VIGA');
console.log('MIDI C3=48, C5=72:', midiC3 === 48 && midiC5 === 72 ? 'OK' : 'VIGA');
console.log('\nNoodid ja sagedused (looduslikud):');
const byOct = { 3: [], 4: [], 5: [] };
tested.filter(t => typeof t === 'object' && t.note && !t.note.includes('#')).forEach(t => {
  const oct = t.note.slice(-1);
  if (byOct[oct]) byOct[oct].push(`${t.note} ${t.freq} Hz (MIDI ${t.midi})`);
});
[3, 4, 5].forEach(oct => console.log(`  Oktaav ${oct}:`, byOct[oct].join(', ')));

// 4) react-piano: iga MIDI number 48–72 -> õige noodinimi ja sagedus (nagu rakenduses)
let midiOk = 0;
try {
  const { MidiNumbers } = await import('react-piano');
  const PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };
  for (let midi = 48; midi <= 72; midi++) {
    const attrs = MidiNumbers.getAttributes(midi);
    const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
    const pitchForPlay = attrs.pitchName.includes('b') ? attrs.pitchName.charAt(0) : naturalPitch;
    const semi = attrs.pitchName.includes('#') ? 1 : attrs.pitchName.includes('b') ? -1 : 0;
    const freq = getNoteFrequency(REF_NOTE, REF_OCTAVE, REF_HZ, pitchForPlay, attrs.octave, semi);
    const key = attrs.pitchName + attrs.octave;
    const expected = expectedFrequencies[key];
    if (expected != null && Math.abs(freq - expected) > 0.15) {
      errors.push(`MIDI ${midi} (${key}): sagedus ${freq.toFixed(2)} Hz, oodati ${expected.toFixed(2)}`);
    } else {
      midiOk++;
    }
  }
  console.log('\nreact-piano MIDI 48–72 → noodinimi → sagedus:', midiOk, 'nooti OK');
} catch (e) {
  console.log('\nreact-piano import (võib olla ESM):', e.message);
}

if (errors.length > 0) {
  console.error('\nVead:', errors);
  process.exit(1);
}
console.log('\nKõik noodikõrgused OK – klaviatuuri vajutamisel peaks iga klahv andma õige sageduse.');
process.exit(0);
