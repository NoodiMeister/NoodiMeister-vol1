/**
 * Klaviatuuri sisendihaldur.
 * Kaardistab arvutiklahvid MIDI noodinumbritele ja kutsub playNote/stopNote.
 */

import { useEffect, useRef, useMemo } from 'react';
import { buildKeyboardMap } from './keyboardMap.js';

/**
 * @param {number} firstNote – MIDI esimene noot (nt 48)
 * @param {number} lastNote – MIDI viimane noot (nt 72)
 * @param {(pitch: number) => void} playNote
 * @param {(pitch: number) => void} stopNote
 * @param {boolean} [enabled=true]
 */
export function useKeyboardHandler(firstNote, lastNote, playNote, stopNote, enabled = true) {
  const keyMap = useMemo(
    () => buildKeyboardMap(firstNote, lastNote),
    [firstNote, lastNote]
  );
  const pressedRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      if (e.repeat) return;
      const code = e.code;
      const midi = keyMap.get(code);
      if (midi === undefined) return;
      e.preventDefault();
      if (pressedRef.current.has(code)) return;
      pressedRef.current.add(code);
      playNote(midi);
    };

    const onKeyUp = (e) => {
      const code = e.code;
      const midi = keyMap.get(code);
      if (midi === undefined) return;
      e.preventDefault();
      pressedRef.current.delete(code);
      stopNote(midi);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, [enabled, keyMap, playNote, stopNote]);
}
