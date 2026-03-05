/**
 * Vabanotatsiooni / traditsiooniline vaade – TÄIELIKULT ERALDI figuurnotatsioonist.
 * JO-võti on peamine tööriist: liigutatav, dünaamiline; kordub iga uue rea alguses (System Break).
 * Abijooned genereeritakse, kui JO-võti või nootid väljuvad 5-liini süsteemist.
 * Paigutuse tööriistad (Staff Spacer, taktide laiendamine { }) rakenduvad siin.
 */
import React from 'react';
import { JoClefSymbol, TrebleClefSymbol, BassClefSymbol } from '../components/ClefSymbols';
import { NoteHead } from '../components/NoteHead';
import { NoteSymbol } from '../notation/NoteSymbols';
import { RhythmSyllableLabel } from '../components/RhythmSyllableLabel';
import { getJoName } from '../notation/joNames';
import { getRhythmSyllableForNote } from '../notation/rhythmSyllables';
import { expandEmojiShortcuts } from '../utils/emojiShortcuts';
import {
  getStaffLinePositions,
  getYFromStaffPosition,
  getLedgerLineCountExact,
  getNoteheadRx,
  getLedgerHalfWidth,
  getVerticalPosition,
} from '../notation/StaffConstants';
import {
  computeBeamGroups,
  computeBeamGeometry,
  getBeamThickness,
  getBeamGap,
} from '../notation/BeamCalculation';

const LAYOUT = { MARGIN_LEFT: 60, CLEF_WIDTH: 45, MEASURE_MIN_WIDTH: 28 };
const PAGE_BREAK_GAP = 80;
const STAFF_SPACE = 10;
const barLineWidth = 2;

function StaffClefSymbol({ x, y, height, clefType, fill = '#000', staffSpace = 10 }) {
  if (clefType === 'treble') return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
  if (clefType === 'bass') return <BassClefSymbol x={x} y={y} height={height} fill={fill} staffSpace={staffSpace} />;
  if (clefType === 'alto' || clefType === 'tenor') {
    return <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={height * 0.5} fontFamily="serif" fill={fill}>C</text>;
  }
  return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
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
        case 1: return <ellipse cx={noteX} cy={noteY} rx="5" ry="3" fill="none" stroke="#333" strokeWidth="1.5" />;
        case 2: return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="none" stroke="#333" strokeWidth="1.5" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /></>);
        case 4: return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /></>);
        case 8: return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /><path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15}`} fill="#333" /></>);
        case 16: return (<><ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333" /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5" /><path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15} M ${stemX} ${noteY + 17} Q ${stemX - 6} ${noteY + 15} ${stemX} ${noteY + 12}`} fill="#333" /></>);
        default: return <text x={noteX} y={noteY + 20} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">{timeSignature.beatUnit}</text>;
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

function renderStandardRest(note, x, restY) {
  const dur = note.durationLabel || '1/4';
  const scale = 0.9;
  const w = 8 * scale, h = 3 * scale;
  if (dur === '1/1' || dur === '1/2') return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#1a1a1a" />;
  if (dur === '1/4') return <path d={`M ${x} ${restY - 10} Q ${x + 6} ${restY - 4} ${x} ${restY} Q ${x - 6} ${restY + 4} ${x} ${restY + 10}`} stroke="#1a1a1a" strokeWidth="1.8" fill="none" />;
  if (dur === '1/8') return (<g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.2"><circle cx={x} cy={restY - 4} r="2" /><path d={`M ${x} ${restY - 2} Q ${x - 6} ${restY} ${x} ${restY + 6}`} fill="none" strokeWidth="1.5" /></g>);
  if (dur === '1/16') return (<g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.2"><circle cx={x} cy={restY - 6} r="1.8" /><circle cx={x} cy={restY} r="1.8" /><path d={`M ${x} ${restY + 2} Q ${x - 5} ${restY + 4} ${x} ${restY + 10}`} fill="none" strokeWidth="1.5" /></g>);
  if (dur === '1/32') return (<g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.1"><circle cx={x} cy={restY - 8} r="1.5" /><circle cx={x} cy={restY - 2} r="1.5" /><circle cx={x} cy={restY + 4} r="1.5" /><path d={`M ${x} ${restY + 6} Q ${x - 4} ${restY + 8} ${x} ${restY + 12}`} fill="none" strokeWidth="1.3" /></g>);
  return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#1a1a1a" />;
}

const durationLabelToNoteSymbolType = (dur) => {
  const map = { '1/1': 'whole', '1/2': 'half', '1/4': 'quarter', '1/8': 'eighth', '1/16': 'sixteenth', '1/32': 'sixteenth' };
  return map[dur] || 'quarter';
};

export function TraditionalNotationView({
  systems,
  effectiveMeasures: effectiveMeasuresProp,
  instruments = [],
  effectiveMeasuresPerInstrument = {},
  marginLeft = LAYOUT.MARGIN_LEFT,
  timelineHeight,
  pageWidth,
  timeSignature,
  timeSignatureMode,
  staffLines = 5,
  staffSpace: staffSpaceProp,
  clefType = 'treble',
  keySignature = 'C',
  notationMode, // 'traditional' | 'vabanotatsioon'
  joClefStaffPosition,
  relativeNotationShowKeySignature = false,
  relativeNotationShowTraditionalClef = false,
  onJoClefPositionChange,
  joClefFocused = false,
  onJoClefFocus,
  layoutLineBreakBefore = [],
  showLayoutBreakIcons = false,
  onToggleLineBreakAfter,
  translateLabel,
  showBarNumbers = true,
  showRhythmSyllables = false,
  showAllNoteLabels = false,
  enableEmojiOverlays = true,
  chords = [],
  isNoteSelected,
  onNoteClick,
  onNoteTeacherLabelChange,
  onNoteLabelClick,
  getPitchY, // (pitch, octave) => Y relative to staff center (Timeline arvutab JO/viiulivõtme järgi)
  isFirstInBraceGroup = false,
  braceGroupSize = 0,
  lyricFontFamily = 'sans-serif',
  isHorizontal = false,
  a4PageHeight = 400,
  getStaffHeight = () => 140,
  showStaffSpacerHandles = false,
  onStaffSpacerMouseDown, // (systemIndex) => (e) => { ... } – ridade vertikaalne liigutamine (Layout)
}) {
  const spacing = staffSpaceProp ?? STAFF_SPACE;
  const centerY = timelineHeight / 2;
  const staffLinePositions = getStaffLinePositions(centerY, staffLines, spacing);
  const trebleGLine = staffLinePositions[1];
  const bassFLine = staffLinePositions[3];
  const middleLineY = centerY;
  const resolvePitchY = (pitch, octave) => (typeof getPitchY === 'function' ? getPitchY(pitch, octave) : centerY);
  const clefFontSize = spacing * 6;
  const clefX = 24;
  const firstLineY = staffLinePositions[0];
  const lastLineY = staffLinePositions[staffLinePositions.length - 1];

  const multiStaff = Array.isArray(instruments) && instruments.length > 0;
  const effectiveMeasures = multiStaff ? null : effectiveMeasuresProp;

  // JO-võti: ankur ja abijooned. Kordub IGA rea alguses.
  const joKeyY = getYFromStaffPosition(joClefStaffPosition, centerY, 5, spacing);
  const isVabanotatsioon = notationMode === 'vabanotatsioon';

  const staffList = multiStaff ? instruments : [{ id: '_single', name: '', clef: clefType }];

  return (
    <>
      {systems.map((sys) => {
        const pageIndex = isHorizontal ? Math.floor(sys.yOffset / a4PageHeight) : 0;
        const groupTransform = isHorizontal && pageWidth ? `translate(${pageIndex * pageWidth}, ${-pageIndex * a4PageHeight})` : undefined;
        return (
          <g key={sys.systemIndex} transform={groupTransform}>
            {showStaffSpacerHandles && typeof onStaffSpacerMouseDown === 'function' && (
              <rect
                x={0}
                y={sys.yOffset}
                width={14}
                height={timelineHeight * (multiStaff ? staffList.length : 1)}
                fill="#e5e7eb"
                stroke="#9ca3af"
                strokeWidth={1}
                rx={2}
                style={{ cursor: 'ns-resize' }}
                onMouseDown={onStaffSpacerMouseDown(sys.systemIndex)}
              />
            )}
            {sys.pageBreakBefore && (
              <line x1={0} y1={sys.yOffset - PAGE_BREAK_GAP / 2} x2={pageWidth || 800} y2={sys.yOffset - PAGE_BREAK_GAP / 2} stroke="#c4b896" strokeWidth={1} strokeDasharray="4 4" />
            )}
            {/* Grand Staff klamber (ainult traditsioonilisel, mitte figuurnotatsioonil) */}
            {isFirstInBraceGroup && braceGroupSize >= 2 && !multiStaff && (() => {
              const staffH = getStaffHeight();
              const grandGap = Math.max(80, Math.min(100, 90));
              const braceH = braceGroupSize * staffH + grandGap;
              const top = sys.yOffset + 2;
              const bottom = sys.yOffset + braceH - 2;
              const lineX = 16;
              const braceLeft = 2;
              const pathD = `M ${lineX - 2} ${top} Q ${braceLeft} ${top + braceH * 0.25} ${braceLeft} ${top + braceH / 2} Q ${braceLeft} ${bottom - braceH * 0.25} ${lineX - 2} ${bottom}`;
              return (
                <g>
                  <line x1={lineX} y1={top} x2={lineX} y2={bottom} stroke="#000" strokeWidth="3" />
                  <path d={pathD} fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })()}

            {staffList.map((inst, staffIndex) => {
              const staffY = sys.yOffset + staffIndex * timelineHeight;
              const staffCenterY = timelineHeight / 2;
              const staffFirstLineY = staffLinePositions[0];
              const staffLastLineY = staffLinePositions[staffLinePositions.length - 1];
              const instClef = inst.clef ?? clefType;
              const instMeasures = multiStaff ? (effectiveMeasuresPerInstrument[inst.id] ?? []) : effectiveMeasures;
              const staffResolvePitchY = multiStaff
                ? (pitch, octave) => getVerticalPosition(pitch, octave, instClef, { centerY: staffCenterY, staffSpace: spacing, keySignature })
                : resolvePitchY;

              return (
                <g key={inst.id + staffIndex}>
                  {/* 5-liiniline noodijoonestik */}
                  {staffLinePositions.map((y, index) => (
                    <line
                      key={`staff-${sys.systemIndex}-${staffIndex}-${index}`}
                      x1={0}
                      y1={staffY + y}
                      x2={marginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
                      y2={staffY + y}
                      stroke="#000"
                      strokeWidth="1.2"
                    />
                  ))}

                  {/* Partii rida: instrumendi nimi vasakul, siis noodivõti */}
                  {multiStaff && inst.name && (
                    <text
                      x={4}
                      y={staffY + staffCenterY}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fontSize={Math.max(10, spacing * 1.2)}
                      fontFamily="sans-serif"
                      fontWeight="600"
                      fill="#333"
                    >
                      {inst.name}
                    </text>
                  )}
                  {/* Üks noodivõti per staff */}
                  {staffLines === 5 && (
                    (() => {
                      const nameWidth = multiStaff ? 50 : 0;
                      const clefXStaff = clefX + nameWidth;
                      if (multiStaff) {
                        const clefY = instClef === 'treble' ? staffY + trebleGLine : instClef === 'bass' ? staffY + bassFLine : staffY + centerY;
                        return (
                          <StaffClefSymbol
                            key={`clef-${sys.systemIndex}-${staffIndex}-${instClef}`}
                            x={clefXStaff}
                            y={clefY}
                            height={clefFontSize}
                            clefType={instClef}
                            fill="#000"
                            staffSpace={spacing}
                          />
                        );
                      }
                      let g = [];
                      if (isVabanotatsioon) {
                        const joClefCenterY = staffY + joKeyY;
                        const { above: ledgerAbove, below: ledgerBelow } = getLedgerLineCountExact(joKeyY, firstLineY, lastLineY, spacing);
                        const joClefEl = (
                          <JoClefSymbol
                            x={xOffset}
                            centerY={joClefCenterY}
                            staffSpacing={spacing}
                            stroke="#000"
                            ledgerLinesAbove={ledgerAbove}
                            ledgerLinesBelow={ledgerBelow}
                            firstLineY={staffY + firstLineY}
                            lastLineY={staffY + lastLineY}
                          />
                        );
                        const isFirstSystem = sys.systemIndex === 0;
                        const canFocus = isFirstSystem && typeof onJoClefFocus === 'function';
                        g.push(
                          <g
                            key="jo-clef"
                            data-jo-clef
                            style={{ cursor: canFocus ? 'pointer' : undefined }}
                            title={canFocus ? (joClefFocused ? 'Kasuta nooleklahve ↑ ja ↓ JO-võtme nihutamiseks. Escape = lõpeta.' : 'Klõpsa JO-võtit, seejärel nooltega ↑↓ nihuta võtit.') : undefined}
                            onClick={canFocus ? (e) => { e.stopPropagation(); onJoClefFocus(true); } : undefined}
                          >
                            {joClefEl}
                            {joClefFocused && isFirstSystem && (
                              <rect x={xOffset - 2} y={joClefCenterY - spacing * 2 - 4} width={24} height={spacing * 4 + 8} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="4 2" rx="2" />
                            )}
                          </g>
                        );
                        xOffset += LAYOUT.CLEF_WIDTH;
                        if (relativeNotationShowTraditionalClef) {
                          const tradY = clefType === 'treble' ? staffY + trebleGLine : clefType === 'bass' ? staffY + bassFLine : staffY + centerY;
                          g.push(<StaffClefSymbol key="trad-clef" x={xOffset} y={tradY} height={clefFontSize} clefType={clefType} fill="#000" staffSpace={spacing} />);
                          xOffset += LAYOUT.CLEF_WIDTH;
                        }
                        if (relativeNotationShowKeySignature && keySignature && keySignature !== 'C') {
                          const sharpCount = { G: 1, D: 2, A: 3, E: 4, B: 5 }[keySignature] || 0;
                          const flatCount = { F: 1, Bb: 2, Eb: 3 }[keySignature] || 0;
                          const sym = flatCount ? '♭' : '♯';
                          for (let i = 0; i < (sharpCount || flatCount); i++) {
                            g.push(<text key={`ks-${i}`} x={xOffset + i * 10} y={staffY + centerY - 8} fontSize="20" fontFamily="serif" fill="#333" textAnchor="middle" dominantBaseline="middle">{sym}</text>);
                          }
                          xOffset += Math.max(sharpCount, flatCount) * 12;
                        }
                        return <g>{g}</g>;
                      }
                      const clefY = clefType === 'treble' ? staffY + trebleGLine : clefType === 'bass' ? staffY + bassFLine : staffY + centerY;
                      return (
                        <StaffClefSymbol
                          key={`clef-${sys.systemIndex}-${staffIndex}-${clefType}`}
                          x={clefX}
                          y={clefY}
                          height={clefFontSize}
                          clefType={clefType}
                          fill="#000"
                          staffSpace={spacing}
                        />
                      );
                    })()
                  )}

                  {showBarNumbers && staffIndex === 0 && sys.measureIndices.length > 0 && (
                    <text x={20} y={staffY + staffLinePositions[0] - 14} fontSize="14" fontWeight="bold" fill="#555" textAnchor="middle" fontFamily="sans-serif">
                      {sys.measureIndices[0] + 1}
                    </text>
                  )}

                  {sys.systemIndex === 0 && staffIndex === 0 && (
                    <g transform={`translate(0, ${staffY})`}>{renderTimeSignature(timeSignature, timeSignatureMode, centerY)}</g>
                  )}

                  {/* Taktid: jooned, akordid, nootid (per staff) */}
                  {Array.isArray(instMeasures) && (() => {
                    const beatsPerMeasure = timeSignature?.beats ?? 4;
                    return sys.measureIndices.map((measureIdx, j) => {
                      const measure = instMeasures[measureIdx];
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

                const noteheadRx = getNoteheadRx(spacing);
                const beamGroupsRaw = computeBeamGroups(measure.notes, measure.startBeat, timeSignature);
                const beamGroups = beamGroupsRaw.map((gr) => {
                  const noteXs = [];
                  const noteCys = [];
                  for (let k = gr.start; k <= gr.end; k++) {
                    const n = measure.notes[k];
                    noteXs.push(getNoteSlotCenterX(n));
                    const py = n.pitch && typeof n.octave === 'number' ? staffResolvePitchY(n.pitch, n.octave) : staffCenterY;
                    noteCys.push(py);
                  }
                  let stemUp = noteCys[0] > middleLineY ? false : true;
                  if (noteCys.length > 0 && noteCys.every((cy) => (stemUp ? cy <= middleLineY : cy >= middleLineY)) === false) {
                    stemUp = noteCys.reduce((s, cy) => s + cy, 0) / noteCys.length > middleLineY ? false : true;
                  }
                  const geom = computeBeamGeometry(gr, measure.notes, noteXs, noteCys, stemUp, spacing);
                  return { ...gr, ...geom, noteXs, noteCys };
                });
                const getBeamGroup = (noteIdx) => beamGroups.find(g => noteIdx >= g.start && noteIdx <= g.end);

                return (
                  <g key={measureIdx}>
                    {measureWidth < (LAYOUT.MEASURE_MIN_WIDTH || 28) && (
                      <rect x={measureX - 1} y={staffY + firstLineY - 2} width={measureWidth + 2} height={lastLineY - firstLineY + 4} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" rx={2} />
                    )}
                    {showLayoutBreakIcons && typeof onToggleLineBreakAfter === 'function' && (
                      <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleLineBreakAfter(measureIdx); }} style={{ pointerEvents: 'auto' }} title={translateLabel ? translateLabel('layout.lineBreakAfter') : 'Reavahetus'}>
                        <rect x={measureX + measureWidth / 2 - 10} y={staffY - 18} width={20} height={16} rx={3} fill={layoutLineBreakBefore.includes(measureIdx + 1) ? '#f59e0b' : '#fef3c7'} stroke="#d97706" strokeWidth={1.2} />
                        <path d={`M ${measureX + measureWidth / 2 - 4} ${staffY - 10} L ${measureX + measureWidth / 2} ${staffY - 14} L ${measureX + measureWidth / 2 + 4} ${staffY - 10}`} fill="none" stroke="#92400e" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    )}
                    {j !== 0 && <line x1={measureX} y1={staffY + firstLineY} x2={measureX} y2={staffY + lastLineY} stroke="#1a1a1a" strokeWidth={barLineWidth} />}
                    {measureIdx === sys.measureIndices[sys.measureIndices.length - 1] && (
                      <line x1={measureX + measureWidth} y1={staffY + firstLineY} x2={measureX + measureWidth} y2={staffY + lastLineY} stroke="#1a1a1a" strokeWidth={barLineWidth} />
                    )}
                    {chords.filter(c => c.beatPosition >= measure.startBeat && c.beatPosition < measure.endBeat).map((chord) => (
                      <g key={chord.id}>
                        <text x={measureX + (chord.beatPosition - measure.startBeat) * beatWidth} y={staffY + firstLineY - 18} textAnchor="start" fontSize="14" fontWeight="bold" fill="#1a1a1a" fontFamily="sans-serif">{chord.chord}</text>
                        {chord.figuredBass && <text x={measureX + (chord.beatPosition - measure.startBeat) * beatWidth} y={staffY + firstLineY - 4} textAnchor="start" fontSize="11" fill="#555" fontFamily="serif">{chord.figuredBass}</text>}
                      </g>
                    ))}
                    {measure.notes.map((note, noteIdx) => {
                      const noteX = getNoteSlotCenterX(note);
                      let globalNoteIndex = 0;
                      for (let i = 0; i < measureIdx; i++) globalNoteIndex += (instMeasures[i]?.notes?.length ?? 0);
                      globalNoteIndex += noteIdx;
                      const pitchY = note.pitch && typeof note.octave === 'number' ? staffResolvePitchY(note.pitch, note.octave) : staffCenterY;
                      const noteY = staffY + pitchY;
                      const beamGroup = getBeamGroup(noteIdx);
                      const stemUp = beamGroup ? beamGroup.stemUp : (pitchY > middleLineY);
                      const noteGroupProps = { onClick: (e) => { e.stopPropagation(); onNoteClick?.(globalNoteIndex); }, style: { cursor: onNoteClick ? 'pointer' : undefined } };
                      const restLabelY = staffY + lastLineY + spacing * 1.8;

                      if (note.isRest) {
                        const restSyllable = showRhythmSyllables ? getRhythmSyllableForNote(note) : '';
                        return (
                          <g key={noteIdx} {...noteGroupProps}>
                            {renderStandardRest(note, noteX, staffY + staffCenterY)}
                            {restSyllable && <RhythmSyllableLabel x={noteX} y={restLabelY} text={restSyllable} staffSpace={spacing} />}
                          </g>
                        );
                      }

                      const isSelected = isNoteSelected ? isNoteSelected(globalNoteIndex) : false;
                      const ledgerHalfWidth = getLedgerHalfWidth(spacing);
                      const { above: nLedgerAbove, below: nLedgerBelow } = getLedgerLineCountExact(pitchY, firstLineY, lastLineY, spacing);

                      return (
                        <g key={noteIdx} {...noteGroupProps}>
                          {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                            <line key={`la-${i}`} x1={noteX - ledgerHalfWidth} y1={staffY + firstLineY - (i + 1) * spacing} x2={noteX + ledgerHalfWidth} y2={staffY + firstLineY - (i + 1) * spacing} stroke="#333" strokeWidth="1.5" />
                          ))}
                          {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                            <line key={`lb-${i}`} x1={noteX - ledgerHalfWidth} y1={staffY + lastLineY + (i + 1) * spacing} x2={noteX + ledgerHalfWidth} y2={staffY + lastLineY + (i + 1) * spacing} stroke="#333" strokeWidth="1.5" />
                          ))}
                          {isSelected && <rect x={noteX - 18} y={noteY - 22} width={36} height={44} fill="#93c5fd" opacity="0.3" rx="4" />}
                          {(note.accidental === 1 || note.accidental === -1) && (
                            <text x={noteX - (noteheadRx + spacing * 0.5)} y={noteY} textAnchor="middle" dominantBaseline="central" fontSize={Math.round(spacing * 1.4)} fill="#1a1a1a" fontFamily="serif">{note.accidental === 1 ? '♯' : '♭'}</text>
                          )}
                          <g transform={`translate(${noteX}, ${noteY})`}>
                            <NoteSymbol
                              type={durationLabelToNoteSymbolType(note.durationLabel)}
                              cx={0}
                              cy={0}
                              staffSpace={spacing}
                              stemUp={stemUp}
                              hideFlags={!!beamGroup}
                              stemLength={beamGroup ? beamGroup.stemLengths[noteIdx - beamGroup.start] : undefined}
                            />
                          </g>
                          {beamGroup && noteIdx === beamGroup.start && (() => {
                            const thick = getBeamThickness(spacing);
                            const gap = getBeamGap(spacing);
                            const offset = thick + gap;
                            const y1 = staffY + beamGroup.beamY1;
                            const y2 = staffY + beamGroup.beamY2;
                            const dir = beamGroup.stemUp ? -1 : 1;
                            const beams = [];
                            for (let b = 0; b < beamGroup.numBeams; b++) {
                              let xL = beamGroup.xLeft;
                              let xR = beamGroup.xRight;
                              if (b >= 1 && beamGroup.beamLevels && beamGroup.noteXs) {
                                const idxMin = beamGroup.beamLevels.findIndex((lev) => lev >= b + 1);
                                const idxMax = beamGroup.beamLevels.length - 1 - [...beamGroup.beamLevels].reverse().findIndex((lev) => lev >= b + 1);
                                if (idxMin >= 0 && idxMax >= 0) {
                                  xL = beamGroup.noteXs[idxMin];
                                  xR = beamGroup.noteXs[idxMax];
                                }
                              }
                              const dy = b * offset * dir;
                              beams.push(
                                <line
                                  key={b}
                                  x1={xL}
                                  y1={y1 + dy}
                                  x2={xR}
                                  y2={y2 + dy}
                                  stroke="#1a1a1a"
                                  strokeWidth={thick}
                                  strokeLinecap="round"
                                />
                              );
                            }
                            return <g>{beams}</g>;
                          })()}
                          {(note.lyric != null && String(note.lyric).trim() !== '') && (
                            <text x={noteX} y={staffY + lastLineY + 18} textAnchor="middle" fontSize="12" fill="#333" fontFamily={lyricFontFamily}>{note.lyric}</text>
                          )}
                          {showRhythmSyllables && (() => {
                            const labelY = staffY + lastLineY + spacing * 1.8;
                            if (beamGroup && noteIdx === beamGroup.start) {
                              const groupNotes = measure.notes.slice(beamGroup.start, beamGroup.end + 1);
                              const syllable = getRhythmSyllableForNote(note, { beamGroupNotes: groupNotes });
                              const xCenter = (beamGroup.xLeft + beamGroup.xRight) / 2;
                              return <RhythmSyllableLabel key="syl" x={xCenter} y={labelY} text={syllable} staffSpace={spacing} />;
                            }
                            if (!beamGroup) {
                              const syllable = getRhythmSyllableForNote(note);
                              return <RhythmSyllableLabel key="syl" x={noteX} y={labelY} text={syllable} staffSpace={spacing} />;
                            }
                            return null;
                          })()}
                          {enableEmojiOverlays && (isVabanotatsioon || true) && (() => {
                            const labelAboveY = staffY + pitchY - spacing * 2.2;
                            const hasCustom = note.teacherLabel != null && note.teacherLabel !== '';
                            const displayText = hasCustom ? expandEmojiShortcuts(note.teacherLabel) : (showAllNoteLabels && isVabanotatsioon ? getJoName(note.pitch, note.octave, keySignature) : '');
                            const canEdit = typeof onNoteLabelClick === 'function';
                            return (
                              <g key="teacher-label" data-teacher-label style={{ cursor: canEdit ? 'pointer' : undefined }} onClick={canEdit ? (ev) => { ev.stopPropagation(); onNoteLabelClick(globalNoteIndex); } : undefined} title={canEdit ? (translateLabel ? translateLabel('teacher.noteLabelHint') : null) || 'Klõpsa valimiseks' : undefined}>
                                {displayText ? <text x={noteX} y={labelAboveY} textAnchor="middle" dominantBaseline="auto" fontSize={Math.max(10, spacing * 1.0)} fill="#333" fontFamily="sans-serif" fontWeight="600">{displayText}</text> : <rect x={noteX - 14} y={labelAboveY - 12} width={28} height={14} fill="transparent" />}
                              </g>
                            );
                          })()}
                        </g>
                      );
                    })}
                  </g>
                );
              });
            })()}

                  {/* Rea lõpu taktijoon (topelt) */}
                  {sys.measureIndices.length > 0 && (
                    <line
                      x1={marginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
                      y1={staffY + firstLineY - 5}
                      x2={marginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
                      y2={staffY + lastLineY + 5}
                      stroke="#333"
                      strokeWidth="2"
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}
