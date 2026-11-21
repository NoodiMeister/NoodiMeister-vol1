/**
 * Pitched MIDI step-time sisestus (MuseScore-laadne).
 *
 * - Esimene noteOn (midagi all pole) → primary noot samal beat'il
 * - Järgmised noteOn-id senikaua kui vähemalt üks klahv all → akorditoonid samale beat'ile
 * - Kui kõik klahvid üles → kursor võib edasi minna
 * - Sama MIDI uuesti noteOn seni kuni all → ignoreeri (retrigger / topeltlistener)
 *
 * Unpitched / multi-pad band EI kuulu siia — need on eraldi teed.
 */

/**
 * @returns {{
 *   noteOn: (midi: number) => { action: 'ignore' } | { action: 'primary', midi: number } | { action: 'chordTone', midi: number },
 *   noteOff: (midi: number) => { action: 'ignore' } | { action: 'release', midi: number, shouldAdvance: boolean },
 *   reset: () => void,
 *   heldCount: () => number,
 * }}
 */
export function createMidiPitchedInputSession() {
  /** @type {Set<number>} */
  const held = new Set();

  return {
    noteOn(midi) {
      const n = Number(midi);
      if (!Number.isFinite(n) || n < 0 || n > 127) return { action: 'ignore' };
      if (held.has(n)) return { action: 'ignore' };
      const isPrimary = held.size === 0;
      held.add(n);
      return isPrimary ? { action: 'primary', midi: n } : { action: 'chordTone', midi: n };
    },
    noteOff(midi) {
      const n = Number(midi);
      if (!Number.isFinite(n) || !held.has(n)) return { action: 'ignore' };
      held.delete(n);
      return { action: 'release', midi: n, shouldAdvance: held.size === 0 };
    },
    reset() {
      held.clear();
    },
    heldCount() {
      return held.size;
    },
  };
}
