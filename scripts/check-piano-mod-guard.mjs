/**
 * Regression: computer-keyboard piano map conflicts with app shortcuts.
 * - KeyZ (lower C): Cmd/Ctrl+Z must not insert+undo in N-mode.
 * - Period (~D#3): `.` is dotted-rhythm toggle; must not insert a low note.
 */
import { buildKeyboardMap } from '../src/piano/keyboardMap.js';
import { shouldIgnorePianoComputerKey } from '../src/piano/pianoKeyboardGuards.js';

const map = buildKeyboardMap(48, 72);
if (!map.has('KeyZ')) {
  console.error('Expected KeyZ in piano keyboard map (undo conflict surface).');
  process.exit(1);
}
if (!map.has('Period')) {
  console.error('Expected Period in piano keyboard map (dotted conflict surface).');
  process.exit(1);
}

const cases = [
  [{ code: 'KeyZ', metaKey: true, ctrlKey: false }, true],
  [{ code: 'KeyZ', metaKey: false, ctrlKey: true }, true],
  [{ code: 'KeyZ', metaKey: false, ctrlKey: false }, false],
  [{ code: 'KeyC', metaKey: true, ctrlKey: false }, true],
  [{ code: 'Period', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, true],
  [{ code: 'Period', metaKey: false, ctrlKey: false, shiftKey: true, altKey: false }, false],
  [{ code: 'Period', metaKey: false, ctrlKey: false, shiftKey: false, altKey: true }, false],
];

for (const [event, expected] of cases) {
  const got = shouldIgnorePianoComputerKey(event);
  if (got !== expected) {
    console.error('shouldIgnorePianoComputerKey mismatch', { event, expected, got });
    process.exit(1);
  }
}

console.log('check-piano-mod-guard: ok');
