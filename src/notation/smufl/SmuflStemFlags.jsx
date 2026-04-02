import React from 'react';
import { getStemCenterXFromNoteCenter, getStemLength, getStemThickness } from '../StaffConstants';
import { getGlyphFontSize } from '../musescoreStyle';
import { SmuflGlyph } from './SmuflGlyph';
import { SMUFL_GLYPH } from './glyphs';

/**
 * Leland/Bravura SMuFL lipuglüüfid (mitte käsitsi Bézier).
 * Ankrud: public/smufl/leland_metadata.json → glyphWithAnchors (stemUpNW / stemDownSW).
 * SVG Y kasvab alla; ankrute Y tõlgendus: originY = stemEndY - anchorY * staffSpace.
 */
function flagGlyphAndAnchor(stemUp, count) {
  const c = Math.min(3, Math.max(1, count));
  if (stemUp) {
    if (c >= 3) return { glyph: SMUFL_GLYPH.flag32ndUp, ax: 0, ay: 0.692 };
    if (c >= 2) return { glyph: SMUFL_GLYPH.flag16thUp, ax: 0, ay: -0.004 };
    return { glyph: SMUFL_GLYPH.flag8thUp, ax: 0, ay: -0.008 };
  }
  if (c >= 3) return { glyph: SMUFL_GLYPH.flag32ndDown, ax: 0, ay: -0.796 };
  if (c >= 2) return { glyph: SMUFL_GLYPH.flag16thDown, ax: 0, ay: -0.036 };
  return { glyph: SMUFL_GLYPH.flag8thDown, ax: 0, ay: 0.004 };
}

/**
 * Lipud tüve otsas (stemX, stemEndY) — sama signatuur mis TraditionalNotationView Flags.
 */
export function SmuflStemFlags({ stemX, stemEndY, staffSpace, stemUp, count = 1, fill = 'var(--note-fill, #1a1a1a)' }) {
  const { glyph, ax, ay } = flagGlyphAndAnchor(stemUp, count);
  const sp = staffSpace;
  const ox = stemX - ax * sp;
  const oy = stemEndY - ay * sp;
  const fontSize = getGlyphFontSize(staffSpace);
  return (
    <SmuflGlyph
      x={ox}
      y={oy}
      glyph={glyph}
      fontSize={fontSize}
      fill={fill}
      textAnchor="start"
      dominantBaseline="alphabetic"
    />
  );
}

/**
 * Noodipea keskpunktist (cx, cy): arvutab tüve otsa ja joonistab SMuFL lipud.
 */
export function SmuflStemFlagsFromNoteCenter({
  cx,
  cy,
  staffSpace,
  stemUp,
  count = 1,
  stemLength,
  fill = 'var(--note-fill, #1a1a1a)',
}) {
  const len = stemLength != null ? stemLength : getStemLength(staffSpace);
  const stemX = getStemCenterXFromNoteCenter(cx, staffSpace, stemUp);
  const stemEndY = stemUp ? cy - len : cy + len;
  return (
    <SmuflStemFlags stemX={stemX} stemEndY={stemEndY} staffSpace={staffSpace} stemUp={stemUp} count={count} fill={fill} />
  );
}
