/**
 * Akordide mängimise loogika – kasutab PianoEngine/Soundfont või Web Audio API.
 * Võib laiendada akordi nime (C, F, G7) → noodide loendiks ja mängimiseks.
 */

/**
 * Akordi nimetus → MIDI noodid (C4 oktav). Võib laiendada rohkem akordidega.
 */
const CHORD_TO_MIDI = {
  C: [48, 52, 55],
  D: [50, 54, 57],
  Dm: [50, 53, 57],
  E: [52, 56, 59],
  Em: [52, 55, 59],
  F: [53, 57, 60],
  G: [55, 59, 62],
  Am: [57, 60, 64],
  A: [57, 61, 64],
  Bdim: [59, 62, 65],
  B: [59, 63, 66],
  C7: [48, 52, 55, 58],
  G7: [55, 59, 62, 65],
  Fmaj7: [53, 57, 60, 64],
  Am7: [57, 60, 64, 67],
};

export function getChordMidiNotes(chordSymbol) {
  const key = String(chordSymbol).trim();
  return CHORD_TO_MIDI[key] ?? null;
}

/**
 * Mängi akordi (playChord tuleb väljast – nt usePianoEngine.playNote).
 */
export function playChord(chordSymbol, playNoteFn, durationMs = 400) {
  const midiNotes = getChordMidiNotes(chordSymbol);
  if (!midiNotes || !playNoteFn) return;
  midiNotes.forEach((midi) => playNoteFn(midi, durationMs));
}
