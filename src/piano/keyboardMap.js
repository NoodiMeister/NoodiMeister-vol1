/**
 * Arvutiklaviatuuri kaardistus MIDI noodinumbritele.
 * Stiil: muted.io / paljud veebiklaverid – üks rida valgeks, üks mustadeks.
 * firstNote, lastNote = MIDI vahemik (nt 48–72 for C3–C5).
 */

/**
 * Ühe rea konfiguratsioon: klahvikood -> nihe pooltonides (0 = firstNote).
 * Nt firstNote=48 (C3): 0=C3, 1=C#3, 2=D3 ...
 */
const HOME_ROW_WHITE = [
  ['KeyA', 0],   // C
  ['KeyS', 2],   // D
  ['KeyD', 4],   // E
  ['KeyF', 5],   // F
  ['KeyG', 7],   // G
  ['KeyH', 9],   // A
  ['KeyJ', 11],  // B
  ['KeyK', 12],  // C
  ['KeyL', 14],  // D
  ['Semicolon', 16],  // E
  ['Quote', 17], // F
  ['KeyZ', -12], // C (oktav all)
  ['KeyX', -10],
  ['KeyC', -8],
  ['KeyV', -7],
  ['KeyB', -5],
  ['KeyN', -3],
  ['KeyM', -1],
  ['Comma', 1],
  ['Period', 3],
  ['Slash', 5],
];

const HOME_ROW_BLACK = [
  ['KeyW', 1],   // C#
  ['KeyE', 3],   // D#
  ['KeyT', 6],   // F#
  ['KeyY', 8],   // G#
  ['KeyU', 10],  // A#
  ['KeyO', 13],  // C#
  ['KeyP', 15],  // D#
  ['BracketLeft', 18],  // F# (kõrgem oktaav)
];

/**
 * Koostab kaardi: code -> MIDI number antud vahemikus.
 * Tagastab Map: keyCode (string) -> midiNumber (number).
 */
export function buildKeyboardMap(firstNote, lastNote) {
  const map = new Map();
  const addAll = (pairs) => {
    pairs.forEach(([code, semi]) => {
      let midi = firstNote + semi;
      while (midi < firstNote) midi += 12;
      while (midi > lastNote) midi -= 12;
      if (midi >= firstNote && midi <= lastNote) map.set(code, midi);
    });
  };
  addAll(HOME_ROW_WHITE);
  addAll(HOME_ROW_BLACK);
  return map;
}

/**
 * Vaikimisi vahemik C3–C5 (nagu muted.io).
 */
export const DEFAULT_FIRST_NOTE = 48; // C3
export const DEFAULT_LAST_NOTE = 72;  // C5
