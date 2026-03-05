/**
 * Klaviatuuri UI: noodinimed (JO/LE/MI) ja figuurnotatsiooni kujundid klahvidel.
 * Kasutab InteractivePiano + PianoSection; nimed ja figuurid tulevad PianoVisualist (figurenotesColors, keySignature).
 */
import React from 'react';
import { PianoSection } from './PianoSection';
import { InteractivePiano } from '../piano';
import { FIGURENOTES_COLORS } from '../utils/figurenotes';

export { PianoSection, InteractivePiano };
export { PianoKeyboardSVG } from './PianoKeyboardSVG';

/**
 * Täielik klaviatuuri riba redaktoris: vahemikud, sulgemine, figuurid ja JO-nimed.
 * @param showNoteNames – kas näidata nootinimesid (JO/LE/MI või C/D/E) – juhitakse keySignature + figurenotesColors kaudu
 * @param showFigurenotes – kas kasutada figuurnotatsiooni värve ja kujundeid (notationStyle === 'FIGURENOTES')
 */
export function PianoKeyboard({
  visible,
  onClose,
  keySignature = 'C',
  notationStyle = 'TRADITIONAL',
  noteInputMode = true,
  onNotePlay,
  t,
  showNoteNames = true,
  showFigurenotes = false,
}) {
  return (
    <PianoSection
      visible={visible}
      onClose={onClose}
      keySignature={keySignature}
      notationStyle={notationStyle}
      noteInputMode={noteInputMode}
      onNotePlay={onNotePlay}
      t={t}
    />
  );
}

/** Vaikimisi figuuri värvid klaviatuuri jaoks (sama mis FigurenotesView). */
export { FIGURENOTES_COLORS };
