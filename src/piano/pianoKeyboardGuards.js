/**
 * Cmd/Ctrl chords are app shortcuts — never map them to piano MIDI.
 * KeyZ is on the computer-keyboard map (lower C); without this guard,
 * N-mode + open piano strip runs insert+undo on Cmd/Ctrl+Z.
 */
export function shouldIgnorePianoComputerKey(e) {
  return !!(e && (e.metaKey || e.ctrlKey));
}
