/**
 * Pedagoogiline kuvarežiim C: 7 astmejoont + käemärgid (noodi glüüfide asemel) + laulusõnad all.
 * Sama loo andmed mis A (notes / lyrics / timeSignature / JO-ankur).
 * X = beat/taktimõõt (ti-ti lähestikku); Y = diatooniline aste JO…DI.
 */
import React from 'react';
import { getJoDegreeIndex, JO_NAMES } from '../notation/joNames';
import { HandSignGlyph } from '../notation/handSigns/HandSignGlyph';
import {
  getDegreeLineY,
  getHandSignStaffGeometry,
  resolveHandSignGlyphMetrics,
} from '../notation/handSigns/handSignMapping';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';

const LAYOUT = { MARGIN_LEFT: 60, MEASURE_MIN_WIDTH: 28 };

function getSlotsPerBeat(measure, beatIndex) {
  const beatStart = measure.startBeat + beatIndex;
  const beatEnd = beatStart + 1;
  const notesInBeat = (measure.notes || []).filter((n) => n.beat >= beatStart && n.beat < beatEnd);
  if (notesInBeat.length === 0) return 1;
  const minDur = Math.min(...notesInBeat.map((n) => n.duration || 1));
  return Math.max(1, Math.round(1 / minDur));
}

function getNoteSlotCenterX(note, measure, measureX, beatWidth) {
  const beatInMeasure = note.beat - measure.startBeat;
  const beatIndex = Math.floor(beatInMeasure);
  const posInBeat = beatInMeasure - beatIndex;
  const slotsPerBeat = getSlotsPerBeat(measure, beatIndex);
  const slotIndex = Math.min(Math.floor(posInBeat * slotsPerBeat), slotsPerBeat - 1);
  const slotCenter = (slotIndex + 0.5) / slotsPerBeat;
  return measureX + (beatIndex + slotCenter) * beatWidth;
}

export function HandSignDegreeStaffView({
  systems = [],
  effectiveMeasures = [],
  marginLeft = LAYOUT.MARGIN_LEFT,
  timeSignature,
  keySignature = 'C',
  joClefStaffPosition,
  isNoteSelected,
  onNoteClick,
  onNoteMouseDown,
  onNoteMouseEnter,
  lyricFontFamily = 'sans-serif',
  lyricFontSize = 12,
  lyricBold = false,
  lyricItalic = false,
  lyricUnderline = false,
  lyricWeight = 400,
  lyricLineYOffset = 0,
  systemXOffsets = [],
  themeColors,
  showBarNumbers = true,
  barNumberSize = 11,
  layoutBarNumberRestartAt = [],
  pickupEnabled = false,
  handSignStyle = null,
}) {
  const ink = themeColors?.textColor || '#1a1a1a';
  const staffLineColor = themeColors?.staffLineColor || '#333';
  const metrics = resolveHandSignGlyphMetrics(handSignStyle, { ink });
  const showDegreeLines = handSignStyle?.showDegreeLines !== false;
  const geom = getHandSignStaffGeometry({
    lineSpacing: metrics.lineSpacing,
    lyricReserve: Math.max(20, (Number(lyricFontSize) || 12) + 12),
  });
  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature) || 4;

  return (
    <g className="hand-sign-degree-staff" aria-label="Käemärgid 7 astmejoonel">
      {/* Degree labels once at left of first system */}
      {systems[0] && (
        <g aria-hidden="true">
          {JO_NAMES.map((name, degreeIndex) => {
            const y = systems[0].yOffset + getDegreeLineY(degreeIndex, geom.topLineY, geom.lineSpacing);
            return (
              <text
                key={`deg-lab-${name}`}
                x={Math.max(8, marginLeft - 28)}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={700}
                fill={ink}
                opacity={0.55}
              >
                {name}
              </text>
            );
          })}
        </g>
      )}

      {systems.map((sys) => {
        const systemOffsetX = Number(systemXOffsets?.[sys.systemIndex]) || 0;
        const measureWidths =
          sys.measureWidths ??
          (sys.measureIndices || []).map(() => sys.measureWidth ?? beatsPerMeasure * 80);
        const staffTop = sys.yOffset + geom.topLineY;
        const staffBottom = sys.yOffset + geom.bottomLineY;
        const measureAreaLeft = marginLeft + systemOffsetX;

        return (
          <g key={`hs-sys-${sys.systemIndex}`}>
            {/* 7 degree lines (optional — hand signs already sit on degree heights) */}
            {showDegreeLines && JO_NAMES.map((_, degreeIndex) => {
              const y = sys.yOffset + getDegreeLineY(degreeIndex, geom.topLineY, geom.lineSpacing);
              const rowWidth = measureWidths.reduce((a, b) => a + (b || 0), 0);
              return (
                <line
                  key={`hs-line-${sys.systemIndex}-${degreeIndex}`}
                  x1={measureAreaLeft}
                  y1={y}
                  x2={measureAreaLeft + rowWidth}
                  y2={y}
                  stroke={staffLineColor}
                  strokeWidth={1.25}
                />
              );
            })}

            {(sys.measureIndices || []).map((measureIdx, j) => {
              const measure = effectiveMeasures[measureIdx];
              if (!measure) return null;
              const measureWidth = measureWidths[j] ?? beatsPerMeasure * 80;
              const measureX = measureAreaLeft + measureWidths.slice(0, j).reduce((a, b) => a + (b || 0), 0);
              const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
              const beatWidth = measureWidth / beatsInMeasure;
              const barX = measureX + measureWidth;

              const displayBar =
                typeof layoutBarNumberRestartAt?.[measureIdx] === 'number'
                  ? layoutBarNumberRestartAt[measureIdx]
                  : (pickupEnabled ? measureIdx : measureIdx + 1);

              return (
                <g key={`hs-m-${sys.systemIndex}-${measureIdx}`}>
                  {/* Left barline (first measure) or right barline after each measure — spans 1–7 */}
                  {j === 0 && (
                    <line
                      x1={measureX}
                      y1={staffTop}
                      x2={measureX}
                      y2={staffBottom}
                      stroke={ink}
                      strokeWidth={2}
                    />
                  )}
                  <line
                    x1={barX}
                    y1={staffTop}
                    x2={barX}
                    y2={staffBottom}
                    stroke={ink}
                    strokeWidth={2}
                  />

                  {showBarNumbers && j === 0 && (
                    <text
                      x={measureX + 4}
                      y={staffTop - 6}
                      fontSize={barNumberSize}
                      fill={ink}
                      opacity={0.7}
                    >
                      {displayBar}
                    </text>
                  )}

                  {(measure.notes || []).map((note, noteLocalIdx) => {
                    if (!note || note.isRest) return null;
                    if (!note.pitch || typeof note.octave !== 'number') return null;
                    let globalNoteIndex = 0;
                    for (let i = 0; i < measureIdx; i += 1) {
                      globalNoteIndex += (effectiveMeasures[i]?.notes?.length ?? 0);
                    }
                    globalNoteIndex += noteLocalIdx;
                    const degreeIndex = getJoDegreeIndex(
                      note.pitch,
                      note.octave,
                      keySignature,
                      joClefStaffPosition,
                    );
                    const degreeName = JO_NAMES[degreeIndex] ?? 'JO';
                    const x = getNoteSlotCenterX(note, measure, measureX, beatWidth);
                    const y = sys.yOffset + getDegreeLineY(degreeIndex, geom.topLineY, geom.lineSpacing);
                    const selected = typeof isNoteSelected === 'function'
                      ? isNoteSelected(globalNoteIndex)
                      : false;
                    const lyric = note.lyric || note.lyric1 || '';

                    return (
                      <g key={`hs-n-${measureIdx}-${noteLocalIdx}-${note.beat}`}>
                        <HandSignGlyph
                          degreeName={degreeName}
                          x={x}
                          y={y}
                          fontSize={metrics.fontSize}
                          fill={metrics.fill}
                          stroke={metrics.stroke}
                          strokeWidth={metrics.strokeWidth}
                          selected={!!selected}
                          onClick={onNoteClick ? (e) => { e.stopPropagation(); onNoteClick(globalNoteIndex, e); } : undefined}
                          onMouseDown={onNoteMouseDown ? (e) => { e.stopPropagation(); onNoteMouseDown(globalNoteIndex, e); } : undefined}
                          onMouseEnter={onNoteMouseEnter ? () => onNoteMouseEnter(globalNoteIndex) : undefined}
                        />
                        {lyric ? (
                          <text
                            x={x}
                            y={staffBottom + 18 + (lyricLineYOffset || 0)}
                            textAnchor="middle"
                            fontFamily={lyricFontFamily}
                            fontSize={lyricFontSize}
                            fontWeight={lyricBold ? 700 : lyricWeight}
                            fontStyle={lyricItalic ? 'italic' : 'normal'}
                            textDecoration={lyricUnderline ? 'underline' : 'none'}
                            fill={ink}
                          >
                            {lyric}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

export { getHandSignStaffGeometry };
export default HandSignDegreeStaffView;
