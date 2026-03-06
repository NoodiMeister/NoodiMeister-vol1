/**
 * Klaviatuuri sisendihaldur.
 * Kaardistab arvutiklahvid MIDI noodinumbritele (ASDF = valged, WETYU = mustad jne) ja kutsub playNote/stopNote.
 * Kui keyboardPlaysPiano === true, siis A–G vajutused mängivad klaverit (Figurenotes õppimine).
 */

import { useEffect, useRef, useMemo } from 'react';
import { buildKeyboardMap } from './keyboardMap.js';

/**
 * @param {number} firstNote – MIDI esimene noot (nt 48)
 * @param {number} lastNote – MIDI viimane noot (nt 72)
 * @param {(pitch: number) => void} playNote
 * @param {(pitch: number) => void} stopNote
 * @param {boolean} [enabled=true]
 * @param {boolean} [keyboardPlaysPiano=false] – true: ASDFGHJ/WETYUOP jne mängivad klaverit (ära reserveeri A–G noodisise jaoks)
 */
export function useKeyboardHandler(firstNote, lastNote, playNote, stopNote, enabled = true, keyboardPlaysPiano = false) {
  const keyMap = useMemo(
    () => buildKeyboardMap(firstNote, lastNote),
    [firstNote, lastNote]
  );
  const pressedRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;

    const reserveLetterKeys = !keyboardPlaysPiano;

    const onKeyDown = (e) => {
      if (e.repeat) return;
      // Tavarežiimis reserveeri A–G noodisise kiirklahvide jaoks; Figurenotes/pedagoogilises režiimis luba need klaveriks.
      if (reserveLetterKeys && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-g]$/i.test(e.key || '')) return;
      const code = e.code;
      const midi = keyMap.get(code);
      if (midi === undefined) return;
      e.preventDefault();
      if (pressedRef.current.has(code)) return;
      pressedRef.current.add(code);
      playNote(midi);
    };

    const onKeyUp = (e) => {
      if (reserveLetterKeys && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-g]$/i.test(e.key || '')) return;
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
  }, [enabled, keyboardPlaysPiano, keyMap, playNote, stopNote]);
}
