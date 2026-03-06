// SMuFL (Standard Music Font Layout) codepoints (Private Use Area).
// We keep this small & explicit to avoid bundling the full metadata JSON.

export const SMUFL_GLYPH = Object.freeze({
  // Clefs
  gClef: '\uE050',
  cClef: '\uE05C',
  fClef: '\uE062',

  // Noteheads
  noteheadWhole: '\uE0A2',
  noteheadHalf: '\uE0A3',
  noteheadBlack: '\uE0A4',

  // Rests
  restDoubleWhole: '\uE4E2',
  restWhole: '\uE4E3',
  restHalf: '\uE4E4',
  restQuarter: '\uE4E5',
  rest8th: '\uE4E6',
  rest16th: '\uE4E7',
  rest32nd: '\uE4E8',
});

export function smuflNoteheadForType(type) {
  switch (type) {
    case 'whole':
      return SMUFL_GLYPH.noteheadWhole;
    case 'half':
      return SMUFL_GLYPH.noteheadHalf;
    case 'quarter':
    case 'eighth':
    case 'sixteenth':
    default:
      return SMUFL_GLYPH.noteheadBlack;
  }
}

export function smuflRestForDurationLabel(durationLabel) {
  switch (durationLabel) {
    case '1/1':
      return SMUFL_GLYPH.restWhole;
    case '1/2':
      return SMUFL_GLYPH.restHalf;
    case '1/4':
      return SMUFL_GLYPH.restQuarter;
    case '1/8':
      return SMUFL_GLYPH.rest8th;
    case '1/16':
      return SMUFL_GLYPH.rest16th;
    case '1/32':
      return SMUFL_GLYPH.rest32nd;
    default:
      return SMUFL_GLYPH.restQuarter;
  }
}

