import React from 'react';
import {
  FIGURENOTES_CROSS_PATHS,
  FIGURENOTES_SHAPE_VIEWBOX,
  FIGURENOTES_CROSS_ARM_THICKNESS_RATIO,
} from '../constants/FigureNotesLibrary';
import { SMUFL_LELAND_NOTEHEAD_BLACK_WIDTH_SP } from './StaffConstants';

/**
 * Path fills ~80% of the 100×100 viewBox (coords 10…90).
 * Used to match optical size to SMuFL noteheadBlack (~1.3 staff spaces).
 */
export const FIGURENOTES_CROSS_PATH_SPAN = 0.8;

/**
 * Noodipea X suurus (px), et optiline bbox ≈ SMuFL noteheadBlack samal staffSpace’il.
 * (fontSize = 4×sp → notehead laius ≈ 1.3×sp; path span 0.8 → size = laius / 0.8)
 */
export function figurenotesCrossNoteheadSizeForStaff (staffSpace) {
  const sp = Math.max(1, Number(staffSpace) || 10);
  return (sp * SMUFL_LELAND_NOTEHEAD_BLACK_WIDTH_SP) / FIGURENOTES_CROSS_PATH_SPAN;
}

/**
 * Noodipea “X” = figuurnoti oktaav-2 rist (paksud täidetud harud), mitte SMuFL noteheadXBlack.
 * Joonistatakse <g transform> (mitte nested <svg>), et score/gallery/export oleksid stabiilsed.
 */
export function FigurenotesCrossNotehead ({
  x = 0,
  y = 0,
  size = 24,
  fill = '#1a1a1a',
  hollow = false,
}) {
  const s = Math.max(4, Number(size) || 24);
  const scale = s / FIGURENOTES_SHAPE_VIEWBOX;
  const outlineStroke = FIGURENOTES_CROSS_ARM_THICKNESS_RATIO * FIGURENOTES_SHAPE_VIEWBOX * 0.45;
  return (
    <g
      transform={`translate(${Number(x) - s / 2}, ${Number(y) - s / 2}) scale(${scale})`}
      aria-hidden="true"
    >
      {FIGURENOTES_CROSS_PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={hollow ? 'none' : fill}
          stroke={fill}
          strokeWidth={hollow ? outlineStroke : 0}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

export { FIGURENOTES_CROSS_ARM_THICKNESS_RATIO, FIGURENOTES_CROSS_PATHS };
