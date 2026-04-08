/**
 * Key signature hard standard (single source of truth).
 *
 * Rules:
 * - staffPosition index: 0 = bottom line, +1 = next half-step position (space/line)
 * - order must stay fixed
 */

export const KEY_SIGNATURE_ORDER = {
  sharps: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
  flats: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
};

export const KEY_SIGNATURE_COUNT_BY_KEY = {
  sharps: { G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7 },
  flats: { F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7 },
};

export const KEY_SIGNATURE_STAFF_POSITIONS = {
  sharps: {
    // F#, C#, G#, D#, A#, E#, B#
    treble: [8, 5, 9, 6, 3, 7, 4],
    bass: [6, 3, 7, 4, 1, 5, 2],
    alto: [4, 1, 5, 2, 6, 3, 7],
    tenor: [5, 2, 6, 3, 7, 4, 8],
  },
  flats: {
    // Bb, Eb, Ab, Db, Gb, Cb, Fb
    treble: [4, 7, 3, 6, 2, 5, 1],
    bass: [2, 5, 1, 4, 0, 3, -1],
    alto: [5, 1, 4, 0, 3, -1, 2],
    tenor: [6, 2, 5, 1, 4, 0, 3],
  },
};

