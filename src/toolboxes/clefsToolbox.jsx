/**
 * Noodivõtmete tööriistakast: JO, viiuli-, bassi-, alto/tenor võtme visuaalsed sümbolid.
 */
import React from 'react';
import { JoClefSymbol } from '../components/ClefSymbols';

const TREBLE_CLEF_PATH = 'M14 2v2c0 2-1 4-3 5-2 1-4 1-5 0-1-1-1-3 0-4 1-1 2-2 2-3 1-2-1-2-3 0-4 2-1 4-1 6 0 2 1 3 2 4 3 1 2 2 3 2 5 0 2-1 4-3 5-2 1-4 1-6-1-2-2-2-5 0-7 2-2 4-2 7 0 3 2 4 4 4 7 0 2-2 4-4 5-2 1-4 0-5-2-1-2-1-4 0-6 1-2 3-2 5 0 2 2 3 4 3 6 0 1-1 2-2 2-3 0-1-1-1-2 0-2 1 0 2 0 3-1 1-1 2-2 2-4 0-2-1-3-2-4-1-1-3-1-4 0-1 1-1 2 0 3 1 1 2 1 3 0';
const BASS_CLEF_PATH = 'M8 4c0 2 1 3 2 3 1 0 2-1 2-3 0-2-1-3-2-3-1 0-2 1-2 3zm8 0c0 2 1 3 2 3 1 0 2-1 2-3 0-2-1-3-2-3-1 0-2 1-2 3zm-10 4v12c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2-1 0-2 1-2 2zm12 0v12c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2-1 0-2 1-2 2zM10 6c-1 0-2 1-2 2v8c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2zm4 0c-1 0-2 1-2 2v8c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2z';
const ALTO_TENOR_CLEF_PATH = 'M8 4c-2 0-4 2-4 5s2 5 4 5 4-2 4-5-2-5-4-5zm0 6c-1 0-2-1-2-1 0 0 1-1 2-1s2 1 2 1c0 0-1 1-2 1zm8-6c2 0 4 2 4 5s-2 5-4 5-4-2-4-5 2-5 4-5zm0 6c1 0 2-1 2-1 0 0-1-1-2-1s-2 1-2 1c0 0 1 1 2 1z';

export function ClefIcon({ clefType }) {
  if (clefType === 'do' || clefType === 'jo') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <JoClefSymbol x={2} centerY={12} staffSpacing={4} stroke="currentColor" />
      </svg>
    );
  }
  const paths = {
    treble: <path d={TREBLE_CLEF_PATH} fill="currentColor" transform="scale(0.08) translate(-80,-20)" />,
    bass: <path d={BASS_CLEF_PATH} fill="currentColor" transform="scale(0.35) translate(2,2)" />,
    alto: <path d={ALTO_TENOR_CLEF_PATH} fill="currentColor" transform="scale(0.4) translate(2,2)" />,
    tenor: <path d={ALTO_TENOR_CLEF_PATH} fill="currentColor" transform="scale(0.4) translate(2,2)" />,
  };
  const trebleSvg = (
    <path fill="currentColor" d="M16 2.5c-.6 0-1.2.3-1.5.8-.4.6-.4 1.4 0 2 .3.5.9.8 1.5.8.6 0 1.2-.3 1.5-.8.4-.6.4-1.4 0-2-.3-.5-.9-.8-1.5-.8zm-2 4v14.2c0 .5.4.8.8.8.5 0 .8-.4.8-.8V6.5h-1.6zm4 0v14.2c0 .5.4.8.8.8.5 0 .8-.4.8-.8V6.5H18zM12 4c-.5 0-1 .4-1.2 1-.2.5 0 1 .4 1.3.4.2.8.2 1.2 0 .4-.3.6-.8.4-1.3C13 4.4 12.5 4 12 4z"/>
  );
  const bassSvg = (
    <g fill="currentColor">
      <ellipse cx="8" cy="10" rx="1.8" ry="2.2"/>
      <ellipse cx="16" cy="10" rx="1.8" ry="2.2"/>
      <path d="M10 4v16c0 .6.5 1 1 1s1-.4 1-1V4c0-.6-.5-1-1-1s-1 .4-1 1zm4 0v16c0 .6.5 1 1 1s1-.4 1-1V4c0-.6-.5-1-1-1s-1 .4-1 1z"/>
    </g>
  );
  const altoSvg = (
    <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M6 6c-1.5 0-3 1.2-3 3s1.5 3 3 3 3-1.2 3-3-1.5-3-3-3z"/>
      <path d="M18 6c1.5 0 3 1.2 3 3s-1.5 3-3 3-3-1.2-3-3 1.5-3 3-3z"/>
    </g>
  );
  const svgByClef = { treble: trebleSvg, bass: bassSvg, alto: altoSvg, tenor: altoSvg };
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      {svgByClef[clefType] || trebleSvg}
    </svg>
  );
}
