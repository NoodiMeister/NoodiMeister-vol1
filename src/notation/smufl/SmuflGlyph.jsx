import React from 'react';

/** svg2pdf ei loe CSS var(--token, #hex) — kasuta fallback-hexi SVG fill atribuudis. */
function resolvePaintForSvg (fill) {
  const s = String(fill ?? '').trim();
  if (!s) return '#1a1a1a';
  if (!/var\s*\(/i.test(s)) return s;
  const m = s.match(/var\s*\(\s*--[^,)]+\s*,\s*([^)]+)\)/i);
  return (m ? String(m[1]).trim() : '') || '#1a1a1a';
}

/**
 * Render a SMuFL glyph via the Leland music font.
 *
 * SMuFL scoring registration: the font alphabetic baseline is the staff-position
 * anchor (notehead/accidental center, clef pitch line, etc.). Use
 * dominantBaseline="alphabetic" (default) so y maps to that origin.
 * Do not use middle/central for staff-anchored glyphs — that shifts ink by ~0.5sp
 * (one diatonic step) and places E on the D position, F on the E line, etc.
 * svg2pdf ignores dominant-baseline; alignmentBaseline mirrors the same value.
 */
export function SmuflGlyph({
  x = 0,
  y = 0,
  glyph = '',
  fontSize = 24,
  fill = 'var(--note-fill, #1a1a1a)',
  fontFamily = 'Leland',
  textAnchor = 'middle',
  dominantBaseline = 'alphabetic',
  className,
  style,
  pointerEvents = 'none',
}) {
  if (!glyph) return null;
  const paint = resolvePaintForSvg(fill);
  // Mirror dominant-baseline for PDF; never force "middle" onto SMuFL anchors.
  const alignBaseline =
    dominantBaseline === 'central' ? 'middle'
      : (dominantBaseline || 'alphabetic');
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
      alignmentBaseline={alignBaseline}
      fill={paint}
      className={className}
      style={{
        fontFamily,
        fontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fill: paint,
        pointerEvents,
        ...style,
      }}
    >
      {glyph}
    </text>
  );
}

export default SmuflGlyph;

