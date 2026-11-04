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

/**
 * Kas ASDF/WETYU arvutiklahvid mängivad klaverikaarti (KeyA→C) või jäävad A–G nooditähtedeks.
 *
 * Figuurnotatsioon: klaverikaart on õppimise UX.
 * Pedagoogiline SEL + avatud klaveririba: klaverikaart OK.
 * Pedagoogiline/traditsiooniline N-režiim: A–G peavad olema pitch letters (A≠C, B≠…).
 *
 * @param {{ notationStyle?: string, notationMode?: string, noteInputMode?: boolean, pianoStripVisible?: boolean }} opts
 * @returns {boolean}
 */
export function shouldComputerKeysPlayPianoMap({
  notationStyle = 'TRADITIONAL',
  notationMode = 'traditional',
  noteInputMode = false,
  pianoStripVisible = false,
} = {}) {
  if (!pianoStripVisible) return false;
  if (notationStyle === 'FIGURENOTES') return true;
  const pedagogical = notationMode === 'vabanotatsioon' || notationMode === 'pedagogical';
  if (pedagogical && !noteInputMode) return true;
  return false;
}
