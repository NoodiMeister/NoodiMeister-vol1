/**
 * Taktimõõtude tööriistakast: visuaalsed sümbolid (klassikaline ja pedagoogiline režiim).
 * Kasutab sama proportsioone mis TimeSignatureLayout (lugeja–kriips–nimetaja vahed).
 */
import React from 'react';
import { TIME_SIG_LAYOUT as L } from '../notation/TimeSignatureLayout';

/** Ikooni viewBox 24×24, tsenter y=12; positsioonid 12 + L.Y_* */
const C = 12;
const yNum = C + L.Y_NUM;
const yLine = C + L.Y_LINE;
const yDen = C + L.Y_DEN;
const noteX = C + L.NOTE_X_OFFSET;
const noteY = C + L.NOTE_Y;
const stemX = C + L.STEM_X_OFFSET;
const stemY1 = C + L.STEM_Y1;
const stemY2Icon = Math.min(C + L.STEM_Y2, 23);
const lineLeft = C - L.LINE_HALF;
const lineRight = C + L.LINE_HALF;
const rx = 2.5;
const ry = 1.6;

export function MeterIcon({ beats, beatUnit }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <text x={C} y={yNum} textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
      <line x1={lineLeft} y1={yLine} x2={lineRight} y2={yLine} stroke="currentColor" strokeWidth="1.5"/>
      <text x={C} y={yDen} textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beatUnit}</text>
    </svg>
  );
}

/** Pedagoogiline taktimõõt – nimetaja kuvatakse noodi sümbolina. */
export function PedagogicalMeterIcon({ beats, beatUnit }) {
  function getNoteSymbol() {
    switch (beatUnit) {
      case 1:
        return <ellipse cx={noteX} cy={noteY} rx={rx + 0.5} ry={ry + 0.3} fill="none" stroke="currentColor" strokeWidth="1"/>;
      case 2:
        return (
          <>
            <ellipse cx={noteX} cy={noteY} rx={rx} ry={ry} fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2Icon} stroke="currentColor" strokeWidth="1"/>
          </>
        );
      case 4:
        return (
          <>
            <ellipse cx={noteX} cy={noteY} rx={rx} ry={ry} fill="currentColor"/>
            <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2Icon} stroke="currentColor" strokeWidth="1"/>
          </>
        );
      case 8:
        return (
          <>
            <ellipse cx={noteX} cy={noteY} rx={rx} ry={ry} fill="currentColor"/>
            <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2Icon} stroke="currentColor" strokeWidth="1"/>
            <path d={`M ${stemX} ${stemY2Icon} Q ${stemX - 4} ${stemY2Icon - 2} ${stemX} ${stemY2Icon - 4}`} fill="currentColor"/>
          </>
        );
      case 16:
        return (
          <>
            <ellipse cx={noteX} cy={noteY} rx={rx} ry={ry} fill="currentColor"/>
            <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2Icon} stroke="currentColor" strokeWidth="1"/>
            <path d={`M ${stemX} ${stemY2Icon} Q ${stemX - 4} ${stemY2Icon - 2} ${stemX} ${stemY2Icon - 4} M ${stemX} ${stemY2Icon - 3} Q ${stemX - 4} ${stemY2Icon - 5} ${stemX} ${stemY2Icon - 7}`} fill="currentColor"/>
          </>
        );
      default:
        return <text x={noteX} y={stemY2Icon} textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor">{beatUnit}</text>;
    }
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <text x={C} y={yNum} textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
      <line x1={lineLeft} y1={yLine} x2={lineRight} y2={yLine} stroke="currentColor" strokeWidth="1.5"/>
      {getNoteSymbol()}
    </svg>
  );
}
