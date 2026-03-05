/**
 * Genereerib valge ja musta klahvide nimekirja antud MIDI vahemikus.
 * Valged: C,D,E,F,G,A,B (MIDI mod 12: 0,2,4,5,7,9,11)
 * Mustad: C#,D#,F#,G#,A# (1,3,6,8,10)
 * Musta klahvi whiteIndex = valge klahvi index, mille JÄRELE must asub (vasak serv).
 */

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_OFFSETS = [1, 3, 6, 8, 10];

/**
 * @param {number} firstNote
 * @param {number} lastNote
 * @returns {{ white: { midi: number, index: number }[], black: { midi: number, whiteIndex: number }[] }}
 */
export function getKeysInRange(firstNote, lastNote) {
  const white = [];
  const black = [];
  let whiteIndex = 0;
  for (let midi = firstNote; midi <= lastNote; midi++) {
    const mod = ((midi % 12) + 12) % 12;
    if (WHITE_OFFSETS.includes(mod)) {
      white.push({ midi, index: whiteIndex });
      whiteIndex++;
    }
  }
  for (let midi = firstNote; midi <= lastNote; midi++) {
    const mod = ((midi % 12) + 12) % 12;
    if (!BLACK_OFFSETS.includes(mod)) continue;
    const idxBefore = white.reduce((last, w, i) => (w.midi < midi ? i : last), -1);
    black.push({ midi, whiteIndex: idxBefore });
  }
  return { white, black };
}
