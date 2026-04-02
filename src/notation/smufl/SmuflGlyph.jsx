import React from 'react';

/**
 * Render a SMuFL glyph via the Leland music font.
 *
 * Notes:
 * - In SVG, y refers to the text baseline. We set dominantBaseline="middle"
 *   so callers can treat (x,y) as the visual center/anchor point.
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
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
      className={className}
      style={{
        fontFamily,
        fontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fill,
        pointerEvents,
        ...style,
      }}
    >
      {glyph}
    </text>
  );
}

export default SmuflGlyph;

