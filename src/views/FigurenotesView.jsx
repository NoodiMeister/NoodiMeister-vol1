/**
 * Figuurnotatsiooni vaade – TÄIELIKULT ERALDI traditsioonilisest vaatest.
 * Siin JO-võtit EI kuvata. Kasutatakse ainult taktikaste, rütmifiguure ja oktaavipõhiseid kujundeid (rist, ruut, ring jne).
 */
import React from 'react';
import { getFigureSymbol } from '../utils/figurenotes';
import { getJoName } from '../notation/joNames';
import { RhythmSyllableLabel } from '../components/RhythmSyllableLabel';
import { getRhythmSyllableForNote } from '../notation/rhythmSyllables';
import { getFigureNoteWidth, FIGURE_BASE_WIDTH } from '../layout/LayoutEngine';

const LAYOUT = { MARGIN_LEFT: 60, MEASURE_MIN_WIDTH: 28 };
const FIGURE_START_PADDING = 8;
const PAGE_BREAK_GAP = 80;
const barLineWidth = 5;

function getFigurenoteTextColor(pitch) {
  return (pitch === 'A' || pitch === 'E') ? '#000000' : '#ffffff';
}

function renderTimeSignature(timeSignature, timeSignatureMode, centerY) {
  const x = 45;
  const y = centerY;
  if (timeSignatureMode === 'pedagogical') {
    const stemX = x - 4;
    const getNoteSymbolForDenominator = () => {
      const noteY = y + 18;
      const noteX = x;
      switch (timeSignature.beatUnit) {
        case 1:
          return <ellipse cx={noteX} cy={noteY} rx="5" ry="3" fill="none" stroke="#333" strokeWidth="1.5" />;
        case 2:
          return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="none" stroke="#333" strokeWidth="1.5" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /></>);
        case 4:
          return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /></>);
        case 8:
          return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /><path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15}`} fill="#333" /></>);
        case 16:
          return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /><path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15} M ${stemX} ${noteY + 17} Q ${stemX - 6} ${noteY + 15} ${stemX} ${noteY + 12}`} fill="#333" /></>);
        default:
          return <text x={noteX} y={noteY + 20} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">{timeSignature.beatUnit}</text>;
      }
    };
    return (<g><text x={x} y={y - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">{timeSignature.beats}</text><line x1={x - 10} y1={y + 2} x2={x + 10} y2={y + 2} stroke="#333" strokeWidth="1.5" />{getNoteSymbolForDenominator()}</g>);
  }
  return (
    <g>
      <text x={x} y={y - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">{timeSignature.beats}</text>
      <line x1={x - 10} y1={y + 2} x2={x + 10} y2={y + 2} stroke="#333" strokeWidth="1.5" />
      <text x={x} y={y + 20} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">{timeSignature.beatUnit}</text>
    </g>
  );
}

export function FigurenotesView({
  systems,
  effectiveMeasures,
  marginLeft = LAYOUT.MARGIN_LEFT,
  timelineHeight,
  pageWidth,
  timeSignature,
  timeSignatureMode,
  layoutLineBreakBefore = [],
  showLayoutBreakIcons = false,
  onToggleLineBreakAfter,
  translateLabel,
  showBarNumbers = true,
  chords = [],
  figurenotesSize = 16,
  figurenotesStems = false,
  keySignature = 'C',
  isNoteSelected,
  onNoteClick,
  showRhythmSyllables = false,
  lyricFontFamily = 'sans-serif',
  isHorizontal = false,
  a4PageHeight = 400,
  pageFlowDirection = 'vertical',
  figureBaseWidth = FIGURE_BASE_WIDTH,
}) {
  const centerY = timelineHeight / 2;
  const beatsPerMeasure = timeSignature?.beats ?? 4;

  return (
    <>
      {systems.map((sys) => {
        const pageIndex = isHorizontal ? Math.floor(sys.yOffset / a4PageHeight) : 0;
        const groupTransform = isHorizontal && pageWidth ? `translate(${pageIndex * pageWidth}, ${-pageIndex * a4PageHeight})` : undefined;
        return (
          <g key={sys.systemIndex} transform={groupTransform}>
            {sys.pageBreakBefore && (
              <line x1={0} y1={sys.yOffset - PAGE_BREAK_GAP / 2} x2={pageWidth || 800} y2={sys.yOffset - PAGE_BREAK_GAP / 2} stroke="#c4b896" strokeWidth={1} strokeDasharray="4 4" />
            )}

            {/* Taktide number – JO-võtit ei ole */}
            {showBarNumbers && sys.measureIndices.length > 0 && (
              <text x={20} y={sys.yOffset + 12} fontSize="14" fontWeight="bold" fill="#555" textAnchor="middle" fontFamily="sans-serif">
                {sys.measureIndices[0] + 1}
              </text>
            )}

            {sys.systemIndex === 0 && (
              <g transform={`translate(0, ${sys.yOffset})`}>{renderTimeSignature(timeSignature, timeSignatureMode, centerY)}</g>
            )}

            {sys.measureIndices.map((measureIdx, j) => {
              const measure = effectiveMeasures[measureIdx];
              if (!measure) return null;
              const measureWidths = sys.measureWidths ?? sys.measureIndices.map(() => sys.measureWidth ?? beatsPerMeasure * 80);
              const measureWidth = measureWidths[j] ?? (sys.measureWidth ?? beatsPerMeasure * 80);
              const measureX = marginLeft + measureWidths.slice(0, j).reduce((a, b) => a + b, 0);
              const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
              const beatWidth = measureWidth / beatsInMeasure;

              const getSlotsPerBeat = (beatIndex) => {
                const beatStart = measure.startBeat + beatIndex;
                const beatEnd = beatStart + 1;
                const notesInBeat = measure.notes.filter(n => n.beat >= beatStart && n.beat < beatEnd);
                if (notesInBeat.length === 0) return 1;
                const minDur = Math.min(...notesInBeat.map(n => n.duration));
                return Math.max(1, Math.round(1 / minDur));
              };
              const getNoteSlotCenterX = (note) => {
                const beatInMeasure = note.beat - measure.startBeat;
                const beatIndex = Math.floor(beatInMeasure);
                const posInBeat = beatInMeasure - beatIndex;
                const slotsPerBeat = getSlotsPerBeat(beatIndex);
                const slotIndex = Math.min(Math.floor(posInBeat * slotsPerBeat), slotsPerBeat - 1);
                const slotCenter = (slotIndex + 0.5) / slotsPerBeat;
                return measureX + (beatIndex + slotCenter) * beatWidth;
              };
              const getRestBoxWidth = (note) => {
                const beatInMeasure = note.beat - measure.startBeat;
                const beatIndex = Math.floor(beatInMeasure);
                const slotsPerBeat = getSlotsPerBeat(beatIndex);
                return beatWidth / slotsPerBeat;
              };

              const boxHeight = timelineHeight - 8;
              const figureSize = Math.max(14, Math.min(48, boxHeight * 0.5));
              const beatFigurePadding = 4;

              const renderFigurenote = (note, x, y, noteIndex) => {
                const { color, shape } = getFigureSymbol(note.pitch, note.octave);
                const size = figureSize;
                const isSelected = isNoteSelected ? isNoteSelected(noteIndex) : false;
                const dur = note.durationLabel || '1/4';
                const drawStem = figurenotesStems && dur !== '1/1';
                const stemLength = 26;
                const stemX = x + size / 2 + 1;
                const stemY1 = y;
                const stemY2 = y - stemLength;
                const textColor = getFigurenoteTextColor(note.pitch);
                const r = size / 2;
                const strokeW = Math.max(2, size * 0.38);
                const strokeShape = isSelected ? '#2563eb' : '#000';
                const strokeWShape = isSelected ? 3 : 2;
                let shapeEl;
                if (shape === 'none') {
                  shapeEl = <rect x={x - r} y={y - r} width={size} height={size} fill="none" stroke={strokeShape} strokeWidth={strokeWShape} strokeDasharray="2 2" opacity={0.6} />;
                } else if (shape === 'cross') {
                  shapeEl = (<g stroke={color} strokeWidth={strokeW} strokeLinecap="round"><line x1={x - r} y1={y - r} x2={x + r} y2={y + r} /><line x1={x + r} y1={y - r} x2={x - r} y2={y + r} /><rect x={x - r} y={y - r} width={size} height={size} fill="none" stroke={strokeShape} strokeWidth={strokeWShape} /></g>);
                } else if (shape === 'circle') {
                  shapeEl = <circle cx={x} cy={y} r={r} fill={color} stroke={strokeShape} strokeWidth={strokeWShape} />;
                } else if (shape === 'square') {
                  shapeEl = <rect x={x - r} y={y - r} width={size} height={size} fill={color} stroke={strokeShape} strokeWidth={strokeWShape} />;
                } else if (shape === 'triangle') {
                  const h = size * 0.866;
                  shapeEl = <path d={`M ${x} ${y - h / 2} L ${x + size / 2} ${y + h / 2} L ${x - size / 2} ${y + h / 2} Z`} fill={color} stroke={strokeShape} strokeWidth={strokeWShape} />;
                } else if (shape === 'triangleDown') {
                  const h = size * 0.866;
                  shapeEl = <path d={`M ${x} ${y + h / 2} L ${x + size / 2} ${y - h / 2} L ${x - size / 2} ${y - h / 2} Z`} fill={color} stroke={strokeShape} strokeWidth={strokeWShape} />;
                } else {
                  shapeEl = null;
                }
                const tailLen = (dur === '1/1') ? Math.max(20, size * 1.4) : (dur === '1/2') ? Math.max(12, size * 0.85) : 0;
                return (
                  <g>
                    {shapeEl}
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={textColor} fontSize={Math.max(8, size * 0.5)} fontWeight="bold">
                      {getJoName(note.pitch, note.octave, keySignature)}
                    </text>
                    {figurenotesStems && dur !== '1/1' && (
                      <g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.8">
                        <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} />
                        {dur === '1/8' && <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" />}
                        {dur === '1/16' && (<><path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" /><path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill="#1a1a1a" /></>)}
                        {dur === '1/32' && (<><path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" /><path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill="#1a1a1a" /><path d={`M ${stemX} ${stemY2 + 12} Q ${stemX + 8} ${stemY2 + 16} ${stemX} ${stemY2 + 20}`} fill="#1a1a1a" /></>)}
                      </g>
                    )}
                    {(note.accidental === 1 || note.accidental === -1) && (() => {
                      const arrowY = y - size / 2 - Math.max(8, size * 0.4);
                      const arrowLen = Math.max(14, size * 0.85);
                      const head = Math.max(5, size * 0.32);
                      const strokeW2 = Math.max(1.5, size * 0.1);
                      const stroke = '#1a1a1a';
                      if (note.accidental === 1) {
                        return (<g stroke={stroke} fill="none" strokeWidth={strokeW2} strokeLinecap="round" strokeLinejoin="round"><line x1={x - arrowLen / 2} y1={arrowY + arrowLen / 2} x2={x + arrowLen / 2} y2={arrowY - arrowLen / 2} /><path d={`M ${x + arrowLen / 2} ${arrowY - arrowLen / 2} L ${x + arrowLen / 2 - head} ${arrowY - arrowLen / 2 + head * 0.6} M ${x + arrowLen / 2} ${arrowY - arrowLen / 2} L ${x + arrowLen / 2 - head * 0.6} ${arrowY - arrowLen / 2 + head}`} /></g>);
                      }
                      return (<g stroke={stroke} fill="none" strokeWidth={strokeW2} strokeLinecap="round" strokeLinejoin="round"><line x1={x + arrowLen / 2} y1={arrowY + arrowLen / 2} x2={x - arrowLen / 2} y2={arrowY - arrowLen / 2} /><path d={`M ${x - arrowLen / 2} ${arrowY - arrowLen / 2} L ${x - arrowLen / 2 + head} ${arrowY - arrowLen / 2 + head * 0.6} M ${x - arrowLen / 2} ${arrowY - arrowLen / 2} L ${x - arrowLen / 2 + head * 0.6} ${arrowY - arrowLen / 2 + head}`} /></g>);
                    })()}
                    {isSelected && <circle cx={x} cy={y} r={size / 2 + 4} fill="none" stroke="#2563eb" strokeWidth="2" opacity="0.5" />}
                  </g>
                );
              };

              return (
                <g key={measureIdx}>
                  {/* Taktikast + löögivõre */}
                  <rect x={measureX} y={sys.yOffset + 4} width={measureWidth} height={timelineHeight - 8} fill="#fafafa" stroke="#c8c8c8" strokeWidth="1.5" />
                  {Array.from({ length: Math.max(0, Math.ceil(beatsInMeasure) - 1) }, (_, b) => (
                    <line key={`beat-${b}`} x1={measureX + (b + 1) * beatWidth} y1={sys.yOffset + 4} x2={measureX + (b + 1) * beatWidth} y2={sys.yOffset + timelineHeight - 4} stroke="#e0e0e0" strokeWidth="1" />
                  ))}
                  {measureWidth < (LAYOUT.MEASURE_MIN_WIDTH || 28) && (
                    <rect x={measureX - 1} y={sys.yOffset + 2} width={measureWidth + 2} height={timelineHeight - 4} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" rx={2} />
                  )}
                  {showLayoutBreakIcons && typeof onToggleLineBreakAfter === 'function' && (
                    <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleLineBreakAfter(measureIdx); }} style={{ pointerEvents: 'auto' }} title={translateLabel ? translateLabel('layout.lineBreakAfter') : 'Reavahetus selle takti järel'}>
                      <rect x={measureX + measureWidth / 2 - 10} y={sys.yOffset - 18} width={20} height={16} rx={3} fill={layoutLineBreakBefore.includes(measureIdx + 1) ? '#f59e0b' : '#fef3c7'} stroke="#d97706" strokeWidth={1.2} />
                      <path d={`M ${measureX + measureWidth / 2 - 4} ${sys.yOffset - 10} L ${measureX + measureWidth / 2} ${sys.yOffset - 14} L ${measureX + measureWidth / 2 + 4} ${sys.yOffset - 10}`} fill="none" stroke="#92400e" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                  {j !== 0 && <line x1={measureX} y1={sys.yOffset + 5} x2={measureX} y2={sys.yOffset + timelineHeight - 5} stroke="#1a1a1a" strokeWidth={barLineWidth} />}
                  {measureIdx === sys.measureIndices[sys.measureIndices.length - 1] && (
                    <line x1={measureX + measureWidth} y1={sys.yOffset + 5} x2={measureX + measureWidth} y2={sys.yOffset + timelineHeight - 5} stroke="#1a1a1a" strokeWidth={barLineWidth} />
                  )}
                  {chords.filter(c => c.beatPosition >= measure.startBeat && c.beatPosition < measure.endBeat).map((chord) => {
                    const chordX = measureX + (chord.beatPosition - measure.startBeat) * beatWidth;
                    const chordY = sys.yOffset + 8;
                    return (
                      <g key={chord.id}>
                        <text x={chordX} y={chordY} textAnchor="start" fontSize="14" fontWeight="bold" fill="#1a1a1a" fontFamily="sans-serif">{chord.chord}</text>
                        {chord.figuredBass && <text x={chordX} y={chordY + 14} textAnchor="start" fontSize="11" fill="#555" fontFamily="serif">{chord.figuredBass}</text>}
                      </g>
                    );
                  })}
                  {(() => {
                    let currentX = measureX + FIGURE_START_PADDING;
                    return measure.notes.map((note, noteIdx) => {
                      const noteWidth = getFigureNoteWidth(note.durationLabel || '1/4', figureBaseWidth);
                      const figureCenterX = currentX + noteWidth / 2;
                      currentX += noteWidth;

                      let globalNoteIndex = 0;
                      for (let i = 0; i < measureIdx; i++) globalNoteIndex += effectiveMeasures[i].notes.length;
                      globalNoteIndex += noteIdx;
                      const noteY = sys.yOffset + centerY;
                      const noteGroupProps = { onClick: (e) => { e.stopPropagation(); onNoteClick?.(globalNoteIndex); }, style: { cursor: onNoteClick ? 'pointer' : undefined } };
                      if (note.isRest) {
                        const restLabelY = sys.yOffset + centerY + 20;
                        const restSyllable = showRhythmSyllables ? getRhythmSyllableForNote(note) : '';
                        if (!figurenotesStems) {
                          const zSize = Math.min(noteWidth * 0.55, 26);
                          return (<g key={noteIdx} {...noteGroupProps}><text x={figureCenterX} y={sys.yOffset + centerY + zSize * 0.2} textAnchor="middle" fontSize={zSize} fontWeight="bold" fill="#1a1a1a" fontFamily="serif">Z</text>{restSyllable && <RhythmSyllableLabel x={figureCenterX} y={restLabelY} text={restSyllable} staffSpace={10} />}</g>);
                        }
                        return (<g key={noteIdx} {...noteGroupProps}>{restSyllable && <RhythmSyllableLabel x={figureCenterX} y={restLabelY} text={restSyllable} staffSpace={10} />}</g>);
                      }
                      const accidentalNudge = (note.accidental === 1 || note.accidental === -1) ? (note.accidental === 1 ? 1 : -1) * Math.max(2, figureSize * 0.2) : 0;
                      const figureX = figureCenterX + accidentalNudge;
                      const labelFontSize = Math.max(8, Math.round(figureSize * 0.625));
                      const dur = note.durationLabel || '1/4';
                      const tailLen = (dur === '1/1') ? Math.max(20, figureSize * 1.4) : (dur === '1/2') ? Math.max(12, figureSize * 0.85) : 0;
                      const labelY = noteY + figureSize * 0.5 + labelFontSize + tailLen;
                      const bandLeft = currentX - noteWidth;
                      const bandY = sys.yOffset + 6;
                      const bandH = timelineHeight - 12;
                      const { color: bandColor } = getFigureSymbol(note.pitch, note.octave);
                      return (
                        <g key={noteIdx} {...noteGroupProps}>
                          <rect x={bandLeft} y={bandY} width={noteWidth} height={bandH} fill={bandColor} opacity="0.2" rx="2" />
                          {renderFigurenote(note, figureX, noteY, globalNoteIndex)}
                          {(note.lyric != null && String(note.lyric).trim() !== '') && (
                            <text x={figureX} y={labelY + 14} textAnchor="middle" fontSize="11" fill="#333" fontFamily={lyricFontFamily}>{note.lyric}</text>
                          )}
                        </g>
                      );
                    });
                  })()}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}
