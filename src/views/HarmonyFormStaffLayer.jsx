/**
 * Traditsioonilise režiimi alamrežiim „Vorm + akordid“ — ühe süsteemi render.
 * Taktikastid ja akordid taktijoonte vahel (sama loogika mis figuurnotatsioonis).
 */
import React from 'react';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH } from '../notation/smufl/glyphs';
import {
  THIN_BARLINE_THICKNESS,
  THICK_BARLINE_THICKNESS,
  BARLINE_SEPARATION,
  TEXT_FONT_FAMILY,
} from '../notation/musescoreStyle';
import { getTraditionalTimeSignaturePreferredX } from '../notation/TimeSignatureLayout';
import { getRepeatMarkPlacement } from '../notation/repeatMarksEngine';
import {
  getLeftBarlineRepeatRender,
  shouldDrawRepeatEndGlyphOnRight,
} from '../notation/repeatBarlineResolve';
import {
  getRepeatRightGlyphX,
  getBarlineFrame,
  getFinalDoubleBarlineCentersX,
} from '../notation/repeatBarlineLayout';
import {
  getMeasureBeatCount,
  normalizeHarmonyChordBeatStep,
} from '../notation/harmonyFormMode';

const BEAT_BOX_EDGE = '#c8c8c8';
const BEAT_BOX_BEAT_LINE = '#e0e0e0';
const CHORD_ROW_HEIGHT = 44;
const STAFF_SPACE = 10;
const PAD_VERTICAL = 4;
const FIGURE_REPEAT_NOTE_MIN_GAP_PX = 3;
const TIME_SIG_LANE_PX = 52;

function TimeSigDigits({ x, y, fontSize, number, fill }) {
  const digits = String(number).split('');
  const step = fontSize * 0.55;
  const startX = x - ((digits.length - 1) * step) / 2;
  return (
    <g>
      {digits.map((d, i) => (
        <SmuflGlyph
          key={`${d}-${i}`}
          x={startX + i * step}
          y={y}
          glyph={d}
          fontSize={fontSize}
          fill={fill}
          textAnchor="middle"
          dominantBaseline="middle"
        />
      ))}
    </g>
  );
}

function renderHarmonyTimeSignature(timeSignature, centerY, x = 36) {
  const fNum = 22;
  const yNum = centerY - 10;
  const yDen = centerY + 12;
  const lineHalf = 10;
  return (
    <g>
      <TimeSigDigits x={x} y={yNum} fontSize={fNum} number={timeSignature.beats} fill="#1a1a1a" />
      <line x1={x - lineHalf} y1={centerY} x2={x + lineHalf} y2={centerY} stroke="#1a1a1a" strokeWidth={1.5} />
      <TimeSigDigits x={x} y={yDen} fontSize={fNum} number={timeSignature.beatUnit} fill="#1a1a1a" />
    </g>
  );
}

function computeRepeatLaneWidths({
  measureIndexInSystem,
  measure,
  prevMeasureInSystem,
  nextMeasureInSystem,
}) {
  const sp = STAFF_SPACE;
  const thinW = Math.max(1, sp * THIN_BARLINE_THICKNESS);
  const thickW = Math.max(2, sp * THICK_BARLINE_THICKNESS);
  const gap = Math.max(1.2, sp * BARLINE_SEPARATION);
  const dotR = Math.max(1.2, sp * 0.16) + 1;
  const repeatBlockWidth =
    thickW / 2 + gap + thinW + gap + dotR * 2;
  const repeatBothSplit = Math.max(1.2, sp * 0.18);
  const leftRepeat = getLeftBarlineRepeatRender({
    measureIndexInSystem,
    measure,
    prevMeasureInSystem,
  });
  const hasLeftRepeat = leftRepeat.variant === 'start' || leftRepeat.variant === 'both';
  const hasRightRepeat = shouldDrawRepeatEndGlyphOnRight(measure, nextMeasureInSystem);
  const leftLaneInner = repeatBlockWidth + (leftRepeat.variant === 'both' ? repeatBothSplit : 0);
  const leftLaneWidth = hasLeftRepeat ? leftLaneInner + FIGURE_REPEAT_NOTE_MIN_GAP_PX * 2 : 0;
  const rightLaneWidth = hasRightRepeat ? repeatBlockWidth + FIGURE_REPEAT_NOTE_MIN_GAP_PX * 2 : 0;
  return { left: leftLaneWidth, right: rightLaneWidth, total: leftLaneWidth + rightLaneWidth };
}

function renderAnchoredRepeatBarline({ x, topY, bottomY, staffSpace, type }) {
  const sp = Math.max(1, Number(staffSpace) || 10);
  const top = Number(topY);
  const bottom = Number(bottomY);
  const cy = top + (bottom - top) / 2;
  const thinW = Math.max(1, sp * THIN_BARLINE_THICKNESS);
  const thickW = Math.max(2, sp * THICK_BARLINE_THICKNESS);
  const gap = Math.max(1.2, sp * BARLINE_SEPARATION);
  const dotR = Math.max(1.2, sp * 0.16) + 1;
  const dotDy = Math.max(dotR * 2.4, sp * 0.95);
  const stroke = '#1a1a1a';

  const drawEnd = (anchorX) => (
    <>
      <line x1={anchorX - (thickW / 2 + gap + thinW / 2)} y1={top} x2={anchorX - (thickW / 2 + gap + thinW / 2)} y2={bottom} stroke={stroke} strokeWidth={thinW} />
      <line x1={anchorX} y1={top} x2={anchorX} y2={bottom} stroke={stroke} strokeWidth={thickW} />
      <circle cx={anchorX - (thickW / 2 + gap + thinW + gap + dotR * 1.4)} cy={cy - dotDy} r={dotR} fill={stroke} />
      <circle cx={anchorX - (thickW / 2 + gap + thinW + gap + dotR * 1.4)} cy={cy + dotDy} r={dotR} fill={stroke} />
    </>
  );

  const drawStart = (anchorX) => (
    <>
      <line x1={anchorX + (thickW / 2 + gap + thinW / 2)} y1={top} x2={anchorX + (thickW / 2 + gap + thinW / 2)} y2={bottom} stroke={stroke} strokeWidth={thinW} />
      <line x1={anchorX} y1={top} x2={anchorX} y2={bottom} stroke={stroke} strokeWidth={thickW} />
      <circle cx={anchorX + (thickW / 2 + gap + thinW + gap + dotR * 1.4)} cy={cy - dotDy} r={dotR} fill={stroke} />
      <circle cx={anchorX + (thickW / 2 + gap + thinW + gap + dotR * 1.4)} cy={cy + dotDy} r={dotR} fill={stroke} />
    </>
  );

  if (type === 'end') return <g>{drawEnd(x)}</g>;
  if (type === 'start') return <g>{drawStart(x)}</g>;
  if (type === 'both') {
    const split = Math.max(1.2, sp * 0.18);
    return (
      <g>
        {drawEnd(x - split / 2)}
        {drawStart(x + split / 2)}
      </g>
    );
  }
  return null;
}

export function HarmonyFormStaffLayer({
  sys,
  staffY,
  marginLeft = 60,
  timeSignature,
  chords = [],
  notes = [],
  harmonyFormChordBeatStep = 4,
  measureWidths = [],
  showBarNumbers = true,
  barNumberSize = 11,
  isFirstSystem = false,
  lyricFontFamily = TEXT_FONT_FAMILY,
  lyricFontSize = 12,
  lyricBold = false,
  lyricItalic = false,
  lyricUnderline = false,
  lyricWeight = 400,
  lyricLineYOffset = 0,
  lyricReserveHeight = 0,
  onBeatClick,
  onSelectRepeatMark,
  selectedRepeatMark = null,
  selectedRepeatMarks = [],
  onJumpMarkPointerDown,
  jumpMarkLayoutOverrides = {},
  effectiveMeasures = [],
}) {
  const stepBeats = normalizeHarmonyChordBeatStep(harmonyFormChordBeatStep, timeSignature);
  const beatsPerMeasure = getMeasureBeatCount(timeSignature);
  const rowTop = staffY + PAD_VERTICAL;
  const rowBottom = staffY + CHORD_ROW_HEIGHT - PAD_VERTICAL;
  const boxHeight = rowBottom - rowTop;
  const rowCenterY = (rowTop + rowBottom) / 2;
  const lyricGapTop = staffY + CHORD_ROW_HEIGHT + 4;
  const fs = Math.max(1, Number(lyricFontSize)) || 12;
  const lyricBaseY = lyricGapTop + fs * 0.9 + (lyricLineYOffset || 0);
  const lyricStepY = fs * 1.1;
  const chordFontSize = Math.min(boxHeight * 0.55, 16);

  const isRepeatMarkSelected = (measureIdx, markType) => {
    if (selectedRepeatMark?.measureIndex === measureIdx && selectedRepeatMark?.markType === markType) return true;
    return selectedRepeatMarks.some((m) => m.measureIndex === measureIdx && m.markType === markType);
  };

  const getJumpMarkOverride = (measureIdx, markType) => {
    const key = `${measureIdx}:${markType}`;
    return jumpMarkLayoutOverrides[key] || {};
  };

  const notesWithBeat = (() => {
    let running = 0;
    return (notes || []).map((note) => {
      const beat = typeof note.beat === 'number' ? note.beat : running;
      running = beat + (note.duration ?? 1);
      return { note, beat };
    });
  })();

  const timeSigLane = isFirstSystem ? TIME_SIG_LANE_PX : 0;
  let measureCursorX = marginLeft + timeSigLane;

  return (
    <g>
      {isFirstSystem && renderHarmonyTimeSignature(
        timeSignature,
        rowCenterY,
        getTraditionalTimeSignaturePreferredX({ staffSpace: STAFF_SPACE, beats: timeSignature.beats, beatUnit: timeSignature.beatUnit }),
      )}

      {sys.measureIndices.map((measureIdx, mi) => {
        const measure = effectiveMeasures[measureIdx];
        if (!measure) return null;

        const prevMeasure = mi > 0 ? effectiveMeasures[sys.measureIndices[mi - 1]] : null;
        const nextMeasure = mi < sys.measureIndices.length - 1 ? effectiveMeasures[sys.measureIndices[mi + 1]] : null;
        const lanes = computeRepeatLaneWidths({
          measureIndexInSystem: mi,
          measure,
          prevMeasureInSystem: prevMeasure,
          nextMeasureInSystem: nextMeasure,
        });

        const baseMeasureWidth = measureWidths[mi] ?? 80;
        const measureWidth = baseMeasureWidth + lanes.total;
        const measureX = measureCursorX;
        measureCursorX += measureWidth;

        const beatContentLeft = measureX + lanes.left;
        const beatContentWidth = baseMeasureWidth;
        const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
        const beatWidth = beatContentWidth / beatsInMeasure;

        const leftRepeat = getLeftBarlineRepeatRender({
          measureIndexInSystem: mi,
          measure,
          prevMeasureInSystem: prevMeasure,
        });
        const hideBeatBoxLeftStroke = leftRepeat.variant !== 'none';
        const drawRepeatEnd = shouldDrawRepeatEndGlyphOnRight(measure, nextMeasure);
        const isLastMeasureInSystem = mi === sys.measureIndices.length - 1;
        const isLastMeasureOfScore = measureIdx === effectiveMeasures.length - 1;
        const showFinalBar = (isLastMeasureOfScore || measure.barlineFinal) && !measure.repeatEnd;
        const measureRightX = measureX + measureWidth;

        const chordsInMeasure = chords
          .filter((c) => c.beatPosition >= measure.startBeat && c.beatPosition < measure.endBeat)
          .sort((a, b) => a.beatPosition - b.beatPosition);

        const barFrame = getBarlineFrame({
          barlineX: measureX,
          barTopY: rowTop,
          barBottomY: rowBottom,
          staffSpace: STAFF_SPACE,
        });

        const placement = getRepeatMarkPlacement({ measureX, staffY: rowTop, firstLineY: 0, spacing: STAFF_SPACE });

        return (
          <g key={`hf-m-${measureIdx}`}>
            {showBarNumbers && (
              <text
                x={measureX + lanes.left + 4}
                y={rowTop - 6}
                fontSize={barNumberSize}
                fill="#555"
                fontFamily="sans-serif"
              >
                {measureIdx + 1}
              </text>
            )}

            <g>
              <line x1={measureX} y1={rowTop} x2={measureRightX} y2={rowTop} stroke={BEAT_BOX_EDGE} strokeWidth={1.5} />
              <line x1={measureX} y1={rowBottom} x2={measureRightX} y2={rowBottom} stroke={BEAT_BOX_EDGE} strokeWidth={1.5} />
              {!hideBeatBoxLeftStroke && (
                <line x1={measureX} y1={rowTop} x2={measureX} y2={rowBottom} stroke={BEAT_BOX_EDGE} strokeWidth={1.5} />
              )}
            </g>

            {Array.from({ length: Math.max(0, Math.ceil(beatsInMeasure) - 1) }, (_, b) => (
              <line
                key={`beat-line-${b}`}
                x1={beatContentLeft + (b + 1) * beatWidth}
                y1={rowTop}
                x2={beatContentLeft + (b + 1) * beatWidth}
                y2={rowBottom}
                stroke={BEAT_BOX_BEAT_LINE}
                strokeWidth={1}
              />
            ))}

            {onBeatClick && Array.from({ length: Math.max(1, Math.ceil(beatsInMeasure / stepBeats)) }, (_, slotIndex) => {
              const slotBeat = measure.startBeat + slotIndex * stepBeats;
              if (slotBeat >= measure.endBeat) return null;
              const localStart = slotBeat - measure.startBeat;
              const slotBeats = Math.min(stepBeats, beatsInMeasure - localStart);
              const sx = beatContentLeft + localStart * beatWidth;
              const sw = slotBeats * beatWidth;
              return (
                <rect
                  key={`hit-${slotIndex}`}
                  x={sx}
                  y={rowTop}
                  width={sw}
                  height={boxHeight}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onBeatClick(slotBeat); }}
                />
              );
            })}

            {chordsInMeasure.map((chord) => {
              const chordX = beatContentLeft + (chord.beatPosition - measure.startBeat) * beatWidth + 4;
              return (
                <g key={chord.id}>
                  <text
                    x={chordX}
                    y={rowCenterY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize={chordFontSize}
                    fontWeight="bold"
                    fill="#1a1a1a"
                    fontFamily="sans-serif"
                    pointerEvents="none"
                  >
                    {chord.chord}
                  </text>
                  {chord.figuredBass && (
                    <text
                      x={chordX}
                      y={rowCenterY + chordFontSize * 0.85}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fontSize={Math.round(chordFontSize * 0.75)}
                      fill="#555"
                      fontFamily="serif"
                      pointerEvents="none"
                    >
                      {chord.figuredBass}
                    </text>
                  )}
                </g>
              );
            })}

            {notesWithBeat
              .filter(({ beat }) => beat >= measure.startBeat && beat < measure.endBeat)
              .map(({ note, beat: noteBeat }, ni) => {
                const localBeat = noteBeat - measure.startBeat;
                const nx = beatContentLeft + localBeat * beatWidth + 4;
                return Array.from({ length: 10 }, (_, lyricIdx) => {
                  const lyricKey = lyricIdx === 0 ? 'lyric' : `lyric${lyricIdx + 1}`;
                  const lyricColorKey = lyricIdx === 0 ? 'lyricColor' : `lyric${lyricIdx + 1}Color`;
                  const lyricText = note?.[lyricKey];
                  if (lyricText == null || String(lyricText).trim() === '') return null;
                  return (
                    <text
                      key={`ly-${ni}-${lyricKey}`}
                      x={nx}
                      y={lyricBaseY + lyricStepY * lyricIdx}
                      textAnchor="start"
                      fill={note?.[lyricColorKey] || '#000000'}
                      fontFamily={lyricFontFamily}
                      fontStyle={lyricItalic ? 'italic' : undefined}
                      textDecoration={lyricUnderline ? 'underline' : undefined}
                      fontWeight={lyricBold ? '700' : Math.max(100, Math.min(900, Number(lyricWeight) || 400))}
                      fontSize={fs}
                    >
                      {lyricText}
                    </text>
                  );
                });
              })}

            {(leftRepeat.variant === 'start' || leftRepeat.variant === 'both') && (
              <g
                onClick={onSelectRepeatMark ? (e) => { e.stopPropagation(); onSelectRepeatMark(measureIdx, 'repeatStart', { toggle: !!(e.metaKey || e.ctrlKey) }); } : undefined}
                style={{ cursor: onSelectRepeatMark ? 'pointer' : undefined }}
              >
                {renderAnchoredRepeatBarline({
                  x: measureX,
                  topY: barFrame.topY,
                  bottomY: barFrame.bottomY,
                  staffSpace: barFrame.staffSpace,
                  type: leftRepeat.variant === 'both' ? 'both' : 'start',
                })}
                {isRepeatMarkSelected(measureIdx, 'repeatStart') && (
                  <rect x={measureX - 8} y={rowTop - 4} width={16} height={boxHeight + 8} fill="#93c5fd" opacity={0.32} rx={3} />
                )}
              </g>
            )}

            {drawRepeatEnd ? (
              <g
                onClick={onSelectRepeatMark ? (e) => { e.stopPropagation(); onSelectRepeatMark(measureIdx, 'repeatEnd', { toggle: !!(e.metaKey || e.ctrlKey) }); } : undefined}
                style={{ cursor: onSelectRepeatMark ? 'pointer' : undefined }}
              >
                {renderAnchoredRepeatBarline({
                  x: getRepeatRightGlyphX(measureRightX, STAFF_SPACE),
                  topY: barFrame.topY,
                  bottomY: barFrame.bottomY,
                  staffSpace: barFrame.staffSpace,
                  type: 'end',
                })}
                {isRepeatMarkSelected(measureIdx, 'repeatEnd') && (
                  <rect x={measureRightX - 12} y={rowTop - 4} width={16} height={boxHeight + 8} fill="#93c5fd" opacity={0.32} rx={3} />
                )}
              </g>
            ) : showFinalBar ? (
              (() => {
                const { thinCx, thickCx, thinW, thickW } = getFinalDoubleBarlineCentersX(measureRightX, STAFF_SPACE);
                return (
                  <g>
                    <line x1={thinCx} y1={rowTop} x2={thinCx} y2={rowBottom} stroke="#1a1a1a" strokeWidth={thinW} />
                    <line x1={thickCx} y1={rowTop} x2={thickCx} y2={rowBottom} stroke="#1a1a1a" strokeWidth={thickW} />
                  </g>
                );
              })()
            ) : !isLastMeasureInSystem ? (
              <line
                x1={measureRightX}
                y1={rowTop}
                x2={measureRightX}
                y2={rowBottom}
                stroke={BEAT_BOX_EDGE}
                strokeWidth={1.5}
              />
            ) : null}

            {measure.segno && (
              <SmuflGlyph
                x={measureX + 6 + (Number(getJumpMarkOverride(measureIdx, 'segno').dx) || 0)}
                y={placement.segnoCodaY + (Number(getJumpMarkOverride(measureIdx, 'segno').dy) || 0)}
                glyph={SMUFL_GLYPH.segno}
                fontSize={18}
                fill="#1a1a1a"
                onClick={onSelectRepeatMark ? (e) => { e.stopPropagation(); onSelectRepeatMark(measureIdx, 'segno', { toggle: !!(e.metaKey || e.ctrlKey) }); } : undefined}
                style={{ cursor: onSelectRepeatMark ? 'pointer' : undefined }}
              />
            )}
            {measure.coda && (
              <SmuflGlyph
                x={measureX + 6 + (Number(getJumpMarkOverride(measureIdx, 'coda').dx) || 0)}
                y={placement.segnoCodaY + (Number(getJumpMarkOverride(measureIdx, 'coda').dy) || 0)}
                glyph={SMUFL_GLYPH.coda}
                fontSize={18}
                fill="#1a1a1a"
                onClick={onSelectRepeatMark ? (e) => { e.stopPropagation(); onSelectRepeatMark(measureIdx, 'coda', { toggle: !!(e.metaKey || e.ctrlKey) }); } : undefined}
                style={{ cursor: onSelectRepeatMark ? 'pointer' : undefined }}
              />
            )}
          </g>
        );
      })}

      {lyricReserveHeight > 0 && (
        <rect
          x={marginLeft}
          y={lyricGapTop}
          width={Math.max(0, measureCursorX - marginLeft)}
          height={lyricReserveHeight}
          fill="transparent"
        />
      )}
    </g>
  );
}

export const HARMONY_FORM_ROW_HEIGHT = CHORD_ROW_HEIGHT + 12;
