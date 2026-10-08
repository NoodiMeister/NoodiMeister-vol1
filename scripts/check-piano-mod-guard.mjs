/**
 * Regression: computer-keyboard piano map includes KeyZ (lower C).
 * Cmd/Ctrl+Z must never trigger that map (N-mode was doing insert+undo).
 */
import { buildKeyboardMap } from '../src/piano/keyboardMap.js';
import { shouldIgnorePianoComputerKey } from '../src/piano/pianoKeyboardGuards.js';

const map = buildKeyboardMap(48, 72);
if (!map.has('KeyZ')) {
  console.error('Expected KeyZ in piano keyboard map (undo conflict surface).');
  process.exit(1);
}

const cases = [
  [{ code: 'KeyZ', metaKey: true, ctrlKey: false }, true],
  [{ code: 'KeyZ', metaKey: false, ctrlKey: true }, true],
  [{ code: 'KeyZ', metaKey: false, ctrlKey: false }, false],
  [{ code: 'KeyC', metaKey: true, ctrlKey: false }, true],
];

for (const [event, expected] of cases) {
  const got = shouldIgnorePianoComputerKey(event);
  if (got !== expected) {
    console.error('shouldIgnorePianoComputerKey mismatch', { event, expected, got });
    process.exit(1);
  }
}

console.log('check-piano-mod-guard: ok');
