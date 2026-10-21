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
 * Notes:
 * - In SVG, y refers to the text baseline. We set dominantBaseline="middle"
 *   so callers can treat (x,y) as the visual center/anchor point.
 * - svg2pdf ignores dominant-baseline; also set alignmentBaseline for PDF export.
 */
export function SmuflGlyph({
  x = 0,
  y = 0,
  glyph = '',
  fontSize = 24,
  fill = 'var(--note-fill, #1a1a1a)',
  fontFamily = 'Leland',
  textAnchor = 'middle',
  dominantBaseline = 'middle',
  className,
  style,
  pointerEvents = 'none',
}) {
  if (!glyph) return null;
  const paint = resolvePaintForSvg(fill);
  const alignBaseline = dominantBaseline === 'middle' || dominantBaseline === 'central'
    ? 'middle'
    : dominantBaseline;
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

