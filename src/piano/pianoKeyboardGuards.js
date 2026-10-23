/**
 * Computer-keyboard piano map must not steal app shortcuts.
 * - Cmd/Ctrl chords (KeyZ is lower C on the map → N-mode was insert+undo).
 * - Period is rhythm dotted toggle (`.`); map offset 3 ≈ D#3 → “random” low note on `.`.
 */
export function shouldIgnorePianoComputerKey(e) {
  if (!e) return false;
  if (e.metaKey || e.ctrlKey) return true;
  // Same modifiers as N-mode / rhythm-toolbox Period handler in noodimeister-complete.
  if (e.code === 'Period' && !e.shiftKey && !e.altKey) return true;
  return false;
}
