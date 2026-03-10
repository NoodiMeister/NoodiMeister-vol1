/**
 * Traditional notation layout constants from Leland font engraving defaults.
 * Source: public/smufl/leland_metadata.json → engravingDefaults
 * Values in staff-space units (sp). Using Leland’s recommended values improves
 * readability and matches the font design.
 */

// --- Stems (Leland: stemThickness 0.1) ---
export const STEM_WIDTH = 0.1;

/** Stem length from notehead center to tip (sp). Common default 3.5. */
export const STEM_LENGTH = 3.5;

/** Minimum stem length when shortened (e.g. beamed). */
export const SHORTEST_STEM = 2.5;

// --- Staff and ledger (Leland) ---
/** Staff line thickness (sp). Leland: staffLineThickness 0.11 */
export const STAFF_LINE_WIDTH = 0.11;

/** Ledger line thickness (sp). Leland: legerLineThickness 0.16 */
export const LEDGER_LINE_WIDTH = 0.16;

/** Ledger line extension each side (sp). Leland: legerLineExtension 0.33 */
export const LEDGER_LINE_LENGTH = 0.33;

// --- Beams (Leland) ---
/** Beam thickness (sp). Leland: beamThickness 0.5 */
export const BEAM_WIDTH = 0.5;

/** Gap between beams (sp). Leland: beamSpacing 0.25 */
export const BEAM_SPACING = 0.25;

/** Minimum length of beam (sp). */
export const BEAM_MIN_LEN = 1.1;

// --- Bar lines (Leland) ---
/** Single bar line thickness (sp). Leland: thinBarlineThickness 0.18 */
export const THIN_BARLINE_THICKNESS = 0.18;

/** Final/double bar line thickness (sp). Leland: thickBarlineThickness 0.55 */
export const THICK_BARLINE_THICKNESS = 0.55;

/** Separation between thin and thick in a double bar (sp). Leland: thinThickBarlineSeparation 0.37 */
export const BARLINE_SEPARATION = 0.37;

// --- Lyrics (Leland: lyricLineThickness 0.1; textFontFamily Edwin/serif – we use LelandText) ---
/** Lyric underline thickness (sp). Leland: lyricLineThickness 0.1 */
export const LYRIC_LINE_THICKNESS = 0.1;

// --- Dots ---
export const DOT_NOTE_DISTANCE = 0.5;
export const DOT_REST_DISTANCE = 0.25;

// --- Glyph scaling (SMuFL: 1 em = 4 staff spaces) ---
export const GLYPH_FONT_SIZE_SP = 4;
export const REST_FONT_SIZE_SP = 4;

/** Leland recommends Edwin/serif for text; we use LelandText for lyrics and chord text. */
export const TEXT_FONT_FAMILY = 'LelandText';

// --- Helpers: scale by staffSpace (pixels per sp) ---

export function getStemWidth(staffSpace) {
  return staffSpace * STEM_WIDTH;
}

export function getStemLength(staffSpace) {
  return staffSpace * STEM_LENGTH;
}

export function getShortestStem(staffSpace) {
  return staffSpace * SHORTEST_STEM;
}

export function getStaffLineWidth(staffSpace) {
  return staffSpace * STAFF_LINE_WIDTH;
}

export function getLedgerLineWidth(staffSpace) {
  return staffSpace * LEDGER_LINE_WIDTH;
}

export function getBeamWidth(staffSpace) {
  return staffSpace * BEAM_WIDTH;
}

export function getBeamSpacing(staffSpace) {
  return staffSpace * BEAM_SPACING;
}

export function getThinBarlineThickness(staffSpace) {
  return staffSpace * THIN_BARLINE_THICKNESS;
}

export function getThickBarlineThickness(staffSpace) {
  return staffSpace * THICK_BARLINE_THICKNESS;
}

export function getLyricLineThickness(staffSpace) {
  return staffSpace * LYRIC_LINE_THICKNESS;
}

export function getGlyphFontSize(staffSpace) {
  return staffSpace * GLYPH_FONT_SIZE_SP;
}

export function getRestFontSize(staffSpace) {
  return staffSpace * REST_FONT_SIZE_SP;
}
