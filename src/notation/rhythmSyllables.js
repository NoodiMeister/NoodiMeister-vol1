/**
 * Kodály rütmisilbid (rhythm-syllables-kodaly.jpg / how-to-read-rhythms.gif).
 * Kasutatakse õpetaja režiimis (Teacher Mode) – kuvatakse noodi või rütmigrupi all.
 * Rütm on konstantne sõltumata noodikirja režiimist (traditsiooniline või JO-LE-MI).
 */

/** Üksikute kestuste silbid (noot või paus) – lihtne taktmõõt (simple meter). */
const SIMPLE_SYLLABLES = {
  '1/1': 'TA-A-A-A',
  '1/2': 'TA-A',
  '1/4': 'TA',
  '1/8': 'TI',
  '1/16': 'RI',
  '1/32': 'RI',
};

/** Pauside silbid. */
const REST_SYLLABLES = {
  '1/1': 'SH',
  '1/2': 'SH',
  '1/4': 'SH',
  '1/8': '(UN)',
  '1/16': '(UN)',
  '1/32': '(UN)',
};

/** Punktiga noodid (dotted). */
const DOTTED_SYLLABLES = {
  '1/2': 'TA-A-A',   // dotted half
  '1/4': 'TA-I',     // dotted quarter
  '1/8': 'TIM',      // dotted eighth
};

/**
 * Tagastab rütmisilbi(te) ühe noodi või rütmigrupi jaoks.
 * @param {Object} note - Noot või paus (durationLabel, isRest, isDotted)
 * @param {Object} [options]
 * @param {Object[]} [options.beamGroupNotes] - Kui antud, siis kogu grupp (nt 2×1/8 → "TI TI", 4×1/16 → "TI RI TI RI")
 * @returns {string} Kuvatav silp või mitu silbi tühikuga (nt "TI TI", "TI RI TI RI")
 */
export function getRhythmSyllableForNote(note, options = {}) {
  const { beamGroupNotes } = options;
  const dur = note.durationLabel || '1/4';

  if (note.isRest) {
    return REST_SYLLABLES[dur] ?? 'SH';
  }

  if (beamGroupNotes && beamGroupNotes.length > 1) {
    return getBeamGroupSyllable(beamGroupNotes);
  }

  if (note.isDotted && DOTTED_SYLLABLES[dur]) {
    return DOTTED_SYLLABLES[dur];
  }

  return SIMPLE_SYLLABLES[dur] ?? 'TA';
}

/**
 * Rütmigrupi (tala all) silbid – Kodály: 2×1/8 = TI TI, 4×1/16 = TI RI TI RI, 1/8+2×1/16 = TI TA TI, jne.
 */
function getBeamGroupSyllable(notes) {
  if (notes.length === 0) return '';
  if (notes.length === 1) {
    const n = notes[0];
    if (n.isDotted && n.durationLabel === '1/8') return 'TIM';
    return SIMPLE_SYLLABLES[n.durationLabel || '1/4'] ?? 'TI';
  }

  const durs = notes.map((n) => n.durationLabel || '1/4');
  const allEighth = durs.every((d) => d === '1/8');
  const allSixteenth = durs.every((d) => d === '1/16');

  if (allEighth && notes.length === 2) return 'TI TI';
  if (allEighth && notes.length === 3) return 'TI TI TI';
  if (allEighth && notes.length === 4) return 'TI RI TI RI';

  if (allSixteenth && notes.length === 2) return 'TI RI';
  if (allSixteenth && notes.length === 4) return 'TI RI TI RI';

  if (notes.length === 3) {
    if (durs[0] === '1/8' && durs[1] === '1/16' && durs[2] === '1/16') return 'TI TA TI';
    if (durs[0] === '1/16' && durs[1] === '1/16' && durs[2] === '1/8') return 'TI TA TI';
    if (durs[0] === '1/8' && durs[1] === '1/8' && durs[2] === '1/8') return 'TI TI TI';
  }

  if (notes.length === 2 && durs[0] === '1/8' && durs[1] === '1/16') return 'TA-I TI';
  if (notes.length === 2 && durs[0] === '1/16' && durs[1] === '1/8') return 'TI TA-I';

  return notes
    .map((n) => {
      const d = n.durationLabel || '1/4';
      if (n.isDotted && d === '1/8') return 'TIM';
      return SIMPLE_SYLLABLES[d] ?? (d === '1/16' ? 'RI' : 'TI');
    })
    .join(' ');
}

export default getRhythmSyllableForNote;
