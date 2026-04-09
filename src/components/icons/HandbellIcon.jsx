import React from 'react';

/**
 * Käsikella siluet (24×24, keskpunkt ~12,12).
 * Ristkülik-sang ja kellakeha ~ sama vertikaalne ulatus; kitsas ülaserv, keskosas laineline väljapoole,
 * alumine kaar (variant 3 hing).
 */
export function HandbellIcon({
  x,
  y,
  size = 18,
  fill = '#f59e0b',
  stroke = '#5c2d0e',
  handleFill = '#141414',
}) {
  const s = size / 24;
  const HANDLE_TOP = 0.55;
  const HANDLE_BOTTOM = 11.05;
  const handleH = HANDLE_BOTTOM - HANDLE_TOP;

  return (
    <g transform={`translate(${x},${y}) scale(${s})`} aria-hidden="true">
      <g transform="translate(-12, -12)">
        <rect
          x="9"
          y={HANDLE_TOP}
          width="6"
          height={handleH}
          rx="0.45"
          ry="0.45"
          fill={handleFill}
          stroke={stroke}
          strokeWidth="0.5"
        />
        <path
          d={`M 9 ${HANDLE_BOTTOM} L 15 ${HANDLE_BOTTOM}
             C 17 13.1 19 14.55 19.25 16.55
             C 19.5 18.2 18.5 19.3 17.8 19.65
             Q 12 21.35 6.2 19.65
             C 5.5 19.3 4.5 18.2 4.75 16.55
             C 5 14.55 7 13.1 9 ${HANDLE_BOTTOM} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth="1.08"
          strokeLinejoin="round"
        />
        <ellipse cx="7.15" cy="15.2" rx="1.65" ry="3.05" fill="rgba(255,255,255,0.36)" />
        <circle cx="12" cy="19.4" r="1.35" fill={stroke} />
      </g>
    </g>
  );
}
