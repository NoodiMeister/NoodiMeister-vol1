/**
 * Modulaarne klaver – üks sissepääs.
 * Kasutamine: import { InteractivePiano, usePianoEngine, ... } from './piano';
 */

export { InteractivePiano } from './InteractivePiano.jsx';
export { PianoVisual } from './PianoVisual.jsx';
export { usePianoEngine, midiToFrequency } from './PianoEngine.js';
export { useKeyboardHandler } from './useKeyboardHandler.js';
export { useMidiHandler } from './useMidiHandler.js';
export { buildKeyboardMap, DEFAULT_FIRST_NOTE, DEFAULT_LAST_NOTE } from './keyboardMap.js';
export { getKeysInRange } from './pianoKeys.js';
