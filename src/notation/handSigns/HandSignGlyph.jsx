import React from 'react';
import {
  UTHEORY_SOLFEGE_FONT_FAMILY,
  HAND_SIGN_GLYPH_FONT_SIZE_PX,
  getHandSignCharForDegreeName,
} from './handSignMapping';

/**
 * Single Kodály/Curwen hand sign (uTheory font). RTL mirror via scaleX(-1) at render time.
 */
export function HandSignGlyph({
  degreeName = 'JO',
  x = 0,
  y = 0,
  fontSize = HAND_SIGN_GLYPH_FONT_SIZE_PX,
  fill = '#111',
  perspective = 'teacher',
  selected = false,
  onClick,
  onMouseDown,
  onMouseEnter,
}) {
  const char = getHandSignCharForDegreeName(degreeName, { perspective });
  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: onClick || onMouseDown ? 'pointer' : undefined }}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      {selected && (
        <rect
          x={-fontSize * 0.45}
          y={-fontSize * 0.55}
          width={fontSize * 0.9}
          height={fontSize * 1.1}
          rx={4}
          fill="#bfdbfe"
          opacity={0.45}
        />
      )}
      {/* Mirror around glyph center without moving the anchor point */}
      <g transform={`scale(-1, 1)`}>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={fill}
          fontSize={fontSize}
          fontFamily={`'${UTHEORY_SOLFEGE_FONT_FAMILY}', sans-serif`}
          style={{ userSelect: 'none' }}
        >
          {char}
        </text>
      </g>
    </g>
  );
}

export default HandSignGlyph;
