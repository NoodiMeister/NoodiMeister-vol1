/**
 * Figuurnotatsiooni vaade – TÄIELIKULT ERALDI traditsioonilisest vaatest.
 * Siin JO-võtit EI kuvata. Kasutatakse ainult taktikaste, rütmifiguure ja oktaavipõhiseid kujundeid (rist, ruut, ring jne).
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getFigureSymbol, getFigureColor } from "../utils/figurenotes";
import { RhythmSyllableLabel } from "../components/RhythmSyllableLabel";
import { getRhythmSyllableForNote } from "../notation/rhythmSyllables";
import { shouldDrawRestGlyph } from "../notation/restGlyphDedupe";
import { getFigureNoteWidth, FIGURE_BASE_WIDTH } from "../layout/LayoutEngine";
import { SmuflGlyph } from "../notation/smufl/SmuflGlyph";
import {
  smuflNoteheadForType,
  smuflTimeSigDigitsForNumber,
  SMUFL_GLYPH,
  SMUFL_MUSIC_FONT_FAMILY,
} from "../notation/smufl/glyphs";
import { SmuflStemFlags } from "../notation/smufl/SmuflStemFlags";
import {
  getShapePathsByOctave,
  getFigureStyle,
} from "../constants/FigureNotesLibrary";
import { getChordMidiNotes } from "../musical/chordPlayback";
import { measureLengthInQuarterBeats } from "../musical/timeSignature";
import { getAccidentalForPitchInKey } from "../utils/notationConstants";
import {
  TIME_SIG_LAYOUT,
  getFigureTimeSignatureX,
} from "../notation/TimeSignatureLayout";
import {
  getLeftBarlineRepeatRender,
  shouldDrawRepeatEndGlyphOnRight,
} from "../notation/repeatBarlineResolve";
import {
  getBarlineFrame,
  getRepeatRightGlyphX,
} from "../notation/repeatBarlineLayout";
import { computeBeamGroups } from "../notation/BeamCalculation";
import {
  THIN_BARLINE_THICKNESS,
  THICK_BARLINE_THICKNESS,
  BARLINE_SEPARATION,
} from "../notation/musescoreStyle";

const LAYOUT = { MARGIN_LEFT: 60, MEASURE_MIN_WIDTH: 28 };
const FIGURE_START_PADDING = 8;
const PAGE_BREAK_GAP = 80;
const FIGURE_REPEAT_RIGHT_EXTRA_INSET_STAFF_SPACES = 0;
const FIGURE_TIME_SIG_REPEAT_START_CLEARANCE_PX = 44;
const FIGURE_TIME_SIGNATURE_LEFT_SHIFT_PX = 10;
const FIGURE_REPEAT_DOT_NOTE_CLEARANCE_PX = 10;
const FIGURE_REPEAT_NOTE_MIN_GAP_PX = 3;
/** Reference size (px) for which bar line and padding design values were chosen. */
const NOTATION_SIZE_REF = 75;

/**
 * Horizontal space reserved left/right of the beat grid for repeat SMuFL barlines.
 * Beat geometry must use only the middle “content” width; dividing full measure width
 * (including lanes) by beats stretches the grid through repeat lanes and misaligns notes vs beat lines.
 */
function computeRepeatLaneWidths({
  sys,
  layoutSourceMeasures,
  measureIndexInSystem,
  notationScale,
}) {
  const repeatStaffSpaceForLane = 10 * notationScale;
  const repeatThinWForLane = Math.max(
    1,
    repeatStaffSpaceForLane * THIN_BARLINE_THICKNESS,
  );
  const repeatThickWForLane = Math.max(
    2,
    repeatStaffSpaceForLane * THICK_BARLINE_THICKNESS,
  );
  const repeatGapForLane = Math.max(
    1.2,
    repeatStaffSpaceForLane * BARLINE_SEPARATION,
  );
  const repeatDotRForLane = Math.max(1.2, repeatStaffSpaceForLane * 0.16) + 1;
  const repeatBlockWidthForLane =
    repeatThickWForLane / 2 +
    repeatGapForLane +
    repeatThinWForLane +
    repeatGapForLane +
    repeatDotRForLane * 2;
  const repeatBothSplitForLane = Math.max(
    1.2,
    repeatStaffSpaceForLane * 0.18,
  );
  const idx = sys.measureIndices[measureIndexInSystem];
  const m = layoutSourceMeasures[idx];
  if (!m) return { left: 0, right: 0, total: 0 };
  const prev =
    measureIndexInSystem > 0
      ? layoutSourceMeasures[sys.measureIndices[measureIndexInSystem - 1]]
      : null;
  const next =
    measureIndexInSystem < sys.measureIndices.length - 1
      ? layoutSourceMeasures[sys.measureIndices[measureIndexInSystem + 1]]
      : null;
  const leftRepeat = getLeftBarlineRepeatRender({
    measureIndexInSystem,
    measure: m,
    prevMeasureInSystem: prev,
  });
  const hasLeftRepeat =
    leftRepeat.variant === "start" || leftRepeat.variant === "both";
  const hasRightRepeat = shouldDrawRepeatEndGlyphOnRight(m, next);
  const leftLaneInner =
    repeatBlockWidthForLane +
    (leftRepeat.variant === "both" ? repeatBothSplitForLane : 0);
  const leftLaneWidth = hasLeftRepeat
    ? leftLaneInner + FIGURE_REPEAT_NOTE_MIN_GAP_PX * 2
    : 0;
  const rightLaneWidth = hasRightRepeat
    ? repeatBlockWidthForLane + FIGURE_REPEAT_NOTE_MIN_GAP_PX * 2
    : 0;
  return {
    left: leftLaneWidth,
    right: rightLaneWidth,
    total: leftLaneWidth + rightLaneWidth,
  };
}

/**
 * Lõputaktijoon (topelt): õhukese joone vasak serv = takti/löögikasti parem serv (measureRightX);
 * paks joon paremal, vahe nende vahel — topeltjoon ei tungi kasti sisse (varem paks keskendus servale).
 * Vertikaalselt taktikasti sisemised ülemine/alumine äär; akordirea korral kuni akordirea alumise servani.
 */
function getFinalDoubleBarlineGeometry({
  measureRightX,
  notationScale,
  figurenotesSize,
  yOffset,
  melodyRowHeight,
  padVertical,
  chordLineHeight,
  chordLineGap,
  combinedStaffRowCount = 1,
  combinedRowStepPx = 0,
}) {
  const barLineWidth = Math.max(2, Math.round(5 * notationScale));
  const thinW = Math.max(1, barLineWidth);
  const gap = Math.max(
    2,
    Math.round(4 * (figurenotesSize / NOTATION_SIZE_REF)),
  );
  const thickW = Math.max(2, Math.round(barLineWidth * 1.8));
  const thinX = measureRightX + thinW / 2;
  const thickX = measureRightX + thinW + gap + thickW / 2;
  const topY = yOffset + padVertical;
  const stackBelow =
    combinedStaffRowCount > 1
      ? (combinedStaffRowCount - 1) * Math.max(0, combinedRowStepPx)
      : 0;
  const bottomY =
    chordLineHeight > 0
      ? yOffset +
        stackBelow +
        melodyRowHeight +
        chordLineGap +
        chordLineHeight -
        padVertical
      : yOffset + stackBelow + melodyRowHeight - padVertical;
  return { thinX, thickX, thinW, thickW, topY, bottomY };
}

function getFigurenoteTextColor(pitch) {
  const p = String(pitch || "").toUpperCase();
  return p === "A" || p === "E" || p === "B" ? "#000000" : "#ffffff";
}

function getFlagCountForDuration(durationLabel) {
  if (durationLabel === "1/8") return 1;
  if (durationLabel === "1/16") return 2;
  if (durationLabel === "1/32") return 3;
  return 0;
}

/** Akordi taustavärv = noodinime värv (üks allikas: getFigureColor). C=punane, D=pruun, E=hall, F=sinine, G=must, A=kollane, B=roheline. */
function getChordColor(chordSymbol) {
  if (!chordSymbol) return "#e5e7eb";
  const s = String(chordSymbol).trim();
  if (!s) return "#e5e7eb";
  const rootChar = s.charAt(0).toUpperCase();
  const root = rootChar === "H" ? "B" : rootChar;
  if (!["C", "D", "E", "F", "G", "A", "B"].includes(root)) return "#e5e7eb";
  return getFigureColor(root);
}

const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function getChordToneNames(chordSymbol) {
  try {
    const midiNotes = getChordMidiNotes(chordSymbol);
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return [];
    return midiNotes
      .map((n) => {
        const pc = ((Number(n) % 12) + 12) % 12;
        return PITCH_CLASS_NAMES[pc] || "";
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

const CHORD_NAME_WIDTH_PER_CHAR = 0.55;

/** Akordi juurtäht (C, D, E, F, G, A, B). */
function getChordRootLetter(chordSymbol) {
  const c = String(chordSymbol || "")
    .trim()
    .charAt(0)
    .toUpperCase();
  return c === "H" ? "B" : c;
}

/** Kujund akordi tooni jaoks: kuni E = kõik ruut; F,G = bass X, 3. X, kvint ruut; A,B = bass X, 3. ruut (C#/D#), kvint ruut. */
function getChordToneShape(chordRootLetter, toneIndex) {
  const root = chordRootLetter.toUpperCase();
  if (root <= "E") return "square";
  if (root === "F" || root === "G") return toneIndex <= 1 ? "cross" : "square";
  if (root === "A" || root === "B") return toneIndex === 0 ? "cross" : "square";
  return toneIndex === 0 ? "cross" : "square";
}

/** Tooni nimi → { baseName, isSharp } (nt C# → { baseName: 'C', isSharp: true }). */
function parseToneName(toneName) {
  const s = String(toneName || "").trim();
  if (s.endsWith("#"))
    return { baseName: s.slice(0, -1).toUpperCase(), isSharp: true };
  if (s.endsWith("b"))
    return {
      baseName: (s.slice(0, -1).toUpperCase() || "C").replace("H", "B"),
      isSharp: false,
    };
  return { baseName: s.toUpperCase().replace("H", "B"), isSharp: false };
}

/** Reference size used when design was at 16px; scale = size/16. */
const TIME_SIG_REF = 16;

/** Leland SMuFL time signature digits centered at (x, y). Multi-digit (e.g. 12) laid out horizontally. */
function TimeSigDigits({ x, y, fontSize, number, fill }) {
  const digits = smuflTimeSigDigitsForNumber(number);
  if (digits.length === 0) return null;
  const spacing = fontSize * 0.5;
  const startX = x - ((digits.length - 1) * spacing) / 2;
  return (
    <g>
      {digits.map((glyph, i) => (
        <SmuflGlyph
          key={i}
          x={startX + i * spacing}
          y={y}
          glyph={glyph}
          fontSize={fontSize}
          fill={fill}
          fontFamily={SMUFL_MUSIC_FONT_FAMILY}
        />
      ))}
    </g>
  );
}

function renderTimeSignature(
  timeSignature,
  timeSignatureMode,
  centerY,
  notationSize = TIME_SIG_REF,
  textColor = "#333",
  noteFill = "#333",
  x = 45,
) {
  const scale = notationSize / TIME_SIG_REF;
  const L = TIME_SIG_LAYOUT;
  const y = centerY;
  const fNum = Math.round(18 * scale);
  const fDen = Math.round(18 * scale);
  const fDenFallback = Math.round(16 * scale);
  const lineHalf = L.LINE_HALF * scale;
  const yNum = y + L.Y_NUM * scale;
  const yLine = y + L.Y_LINE * scale;
  const yDen = y + L.Y_DEN * scale;
  const noteX = x + L.NOTE_X_OFFSET * scale;
  const noteY = y + L.NOTE_Y * scale;
  const stemY1 = y + L.STEM_Y1 * scale;
  const stemY2 = y + L.STEM_Y2 * scale;
  const strokeW = Math.max(1, 1.5 * scale);
  const numeratorDigits = (
    <TimeSigDigits
      x={x}
      y={yNum}
      fontSize={fNum}
      number={timeSignature.beats}
      fill={textColor}
    />
  );
  if (timeSignatureMode === "pedagogical") {
    const stemX = x + L.STEM_X_OFFSET * scale;
    const getNoteSymbolForDenominator = () => {
      const r1 = L.WHOLE_RX * scale;
      const r1y = L.WHOLE_RY * scale;
      const r2 = L.ELLIPSE_RX * scale;
      const r2y = L.ELLIPSE_RY * scale;
      const q = 6 * scale;
      switch (timeSignature.beatUnit) {
        case 1:
          return (
            <ellipse
              cx={noteX}
              cy={noteY}
              rx={r1}
              ry={r1y}
              fill="none"
              stroke={textColor}
              strokeWidth={strokeW}
            />
          );
        case 2:
          return (
            <>
              <ellipse
                cx={noteX}
                cy={noteY}
                rx={r2}
                ry={r2y}
                fill="none"
                stroke={textColor}
                strokeWidth={strokeW}
              />
              <line
                x1={stemX}
                y1={stemY1}
                x2={stemX}
                y2={stemY2}
                stroke={textColor}
                strokeWidth={strokeW}
              />
            </>
          );
        case 4:
          return (
            <>
              <ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill={noteFill} />
              <line
                x1={stemX}
                y1={stemY1}
                x2={stemX}
                y2={stemY2}
                stroke={textColor}
                strokeWidth={strokeW}
              />
            </>
          );
        case 8:
          return (
            <>
              <ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill={noteFill} />
              <line
                x1={stemX}
                y1={stemY1}
                x2={stemX}
                y2={stemY2}
                stroke={textColor}
                strokeWidth={strokeW}
              />
              <path
                d={`M ${stemX} ${stemY2} Q ${stemX - q} ${stemY2 - 2 * scale} ${stemX} ${stemY2 - 5 * scale}`}
                fill={noteFill}
              />
            </>
          );
        case 16:
          return (
            <>
              <ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill={noteFill} />
              <line
                x1={stemX}
                y1={stemY1}
                x2={stemX}
                y2={stemY2}
                stroke={textColor}
                strokeWidth={strokeW}
              />
              <path
                d={`M ${stemX} ${stemY2} Q ${stemX - q} ${stemY2 - 2 * scale} ${stemX} ${stemY2 - 5 * scale} M ${stemX} ${stemY2 - 3 * scale} Q ${stemX - q} ${stemY2 - 5 * scale} ${stemX} ${stemY2 - 8 * scale}`}
                fill={noteFill}
              />
            </>
          );
        default:
          return (
            <TimeSigDigits
              x={noteX}
              y={stemY2}
              fontSize={fDenFallback}
              number={timeSignature.beatUnit}
              fill={textColor}
            />
          );
      }
    };
    return (
      <g>
        <g stroke="none">{numeratorDigits}</g>
        <line
          x1={x - lineHalf}
          y1={yLine}
          x2={x + lineHalf}
          y2={yLine}
          stroke={textColor}
          strokeWidth={strokeW}
        />
        {getNoteSymbolForDenominator()}
      </g>
    );
  }
  return (
    <g>
      {numeratorDigits}
      <line
        x1={x - lineHalf}
        y1={yLine}
        x2={x + lineHalf}
        y2={yLine}
        stroke={textColor}
        strokeWidth={strokeW}
      />
      <TimeSigDigits
        x={x}
        y={yDen}
        fontSize={fDen}
        number={timeSignature.beatUnit}
        fill={textColor}
      />
    </g>
  );
}

export function FigurenotesView({
  systems,
  effectiveMeasures,
  marginLeft = LAYOUT.MARGIN_LEFT,
  timelineHeight,
  selectedDuration = "1/4",
  chordLineGap = 0,
  chordLineHeight = 0,
  chordBlocksEnabled = false,
  chordBlocksShowTones = true,
  showMelodyNoteNames = true,
  pageWidth,
  timeSignature,
  timeSignatureMode,
  layoutLineBreakBefore = [],
  showLayoutBreakIcons = false,
  onToggleLineBreakAfter,
  translateLabel,
  showBarNumbers = true,
  barNumberSize = 11,
  chords = [],
  figurenotesSize = 16,
  figurenotesStems = false,
  timeSignatureSize = 36,
  keySignature = "C",
  isNoteSelected,
  onNoteClick,
  onNoteMouseDown,
  onNoteMouseEnter,
  onNoteBeatChange,
  canHandDragNotes = false,
  timeSignatureOffset = { x: 0, y: 0 },
  onTimeSignatureOffsetChange,
  timelineSvgRef,
  onBeatSlotClick,
  onChordLineMouseMove,
  onChordLineClick,
  showRhythmSyllables = false,
  lyricFontFamily = "sans-serif",
  lyricFontSize = 12,
  lyricBold = false,
  lyricItalic = false,
  lyricUnderline = false,
  lyricWeight = 400,
  lyricLineYOffset = 0,
  lyricReserveHeight = 0,
  isHorizontal = false,
  a4PageHeight = 400,
  pageFlowDirection = "vertical",
  figureBaseWidth = FIGURE_BASE_WIDTH,
  showStaffSpacerHandles = false,
  onStaffSpacerMouseDown,
  onSystemYOffsetChange,
  canHandDragSystems = false,
  onSystemXOffsetChange,
  systemXOffsets = [],
  showLyricSpacerHandles = false,
  onLyricSpacerMouseDown,
  onLyricSpacerNudge,
  themeColors,
  activeLyricNoteIndex = null,
  selectedRepeatMark = null, // { measureIndex, markType } | null
  selectedRepeatMarks = [], // [{ measureIndex, markType }]
  onSelectRepeatMark, // (measureIndex, markType) => void
  /** Mitme rea ühendatud figuurisüsteem (orchestration): instrumentide read + taktid iga rea jaoks. */
  instruments = [],
  effectiveMeasuresPerInstrument = {},
  /** Vertikaalne samm ridade vahel (meloodia + akordirida + layoutPartsGap) — sama mis Timeline perStaffRowStep. */
  figurenotesCombinedRowStepPx = 0,
  /** Aktiivse rea indeks ühendatud figuuris (0 = ülemine); beat-drag ainult sellel real. */
  figurenotesCombinedActiveStaffRowIndex = null,
}) {
  /** Melody row height (beat-box); chord line sits below with chordLineGap and height chordLineHeight (half of melody when in chord mode). */
  const melodyRowHeight = timelineHeight;
  const centerY = melodyRowHeight / 2;
  const combinedRows = Array.isArray(instruments) && instruments.length > 1;
  const rowStepPx =
    combinedRows && figurenotesCombinedRowStepPx > 0
      ? figurenotesCombinedRowStepPx
      : melodyRowHeight + chordLineGap + chordLineHeight + lyricReserveHeight;
  const layoutSourceMeasures =
    combinedRows && instruments[0]?.id
      ? (effectiveMeasuresPerInstrument[instruments[0].id] ?? effectiveMeasures)
      : effectiveMeasures;
  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
  const timeSigTextColor = themeColors?.textColor ?? "#333";
  const timeSigNoteFill = themeColors?.noteFill ?? "#333";

  /** Scale beat-box padding and barlines with Noodigraafika suurus so they match note size. */
  const notationScale = Math.max(0.5, figurenotesSize / NOTATION_SIZE_REF);
  const padVertical = Math.max(2, Math.round(4 * notationScale));
  const barLineInset = Math.max(2, Math.round(5 * notationScale));
  const barLineWidth = Math.max(2, Math.round(5 * notationScale));
  const isRepeatMarkSelected = (measureIndex, markType) =>
    (
      selectedRepeatMark?.measureIndex === measureIndex &&
      selectedRepeatMark?.markType === markType
    ) ||
    (Array.isArray(selectedRepeatMarks) &&
      selectedRepeatMarks.some(
        (m) => m?.measureIndex === measureIndex && m?.markType === markType,
      ));
  const debugRepeatOverlay = useMemo(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return p.get("debugRepeat") === "1";
  }, []);

  const [noteBeatDrag, setNoteBeatDrag] = useState(null);
  const [timeSigDrag, setTimeSigDrag] = useState(null); // { startClientX, startClientY, startOffsetX, startOffsetY }
  const [systemDrag, setSystemDrag] = useState(null); // { systemIndex, startClientX, startClientY }
  const measureLayout = useMemo(() => {
    const sys = systems?.[0];
    if (!sys || !layoutSourceMeasures?.length) return [];
    const mw =
      sys.measureWidths ??
      sys.measureIndices.map(() => sys.measureWidth ?? beatsPerMeasure * 80);
    const mwDefault = sys.measureWidth ?? beatsPerMeasure * 80;
    return sys.measureIndices
      .map((measureIdx, j) => {
        const measure = layoutSourceMeasures[measureIdx];
        if (!measure) return null;
        const lanes = computeRepeatLaneWidths({
          sys,
          layoutSourceMeasures,
          measureIndexInSystem: j,
          notationScale,
        });
        const baseW = mw[j] ?? mwDefault;
        let measureX = marginLeft;
        for (let i = 0; i < j; i += 1) {
          const bi = mw[i] ?? mwDefault;
          const li = computeRepeatLaneWidths({
            sys,
            layoutSourceMeasures,
            measureIndexInSystem: i,
            notationScale,
          });
          measureX += bi + li.total;
        }
        const beatContentLeft = measureX + lanes.left;
        const beatContentWidth = baseW;
        const xStart = beatContentLeft;
        const xEnd = beatContentLeft + beatContentWidth;
        const startBeat = measure.startBeat;
        const endBeat = measure.endBeat ?? measure.startBeat + beatsPerMeasure;
        return { xStart, xEnd, startBeat, endBeat };
      })
      .filter(Boolean);
  }, [systems, layoutSourceMeasures, marginLeft, beatsPerMeasure, notationScale]);
  const getBeatFromX = useCallback(
    (x) => {
      const firstSystemOffsetX = Number(systemXOffsets?.[systems?.[0]?.systemIndex]) || 0;
      const normalizedX = x - firstSystemOffsetX;
      for (const m of measureLayout) {
        if (normalizedX >= m.xStart && normalizedX <= m.xEnd) {
          const t =
            m.xEnd - m.xStart > 0 ? (normalizedX - m.xStart) / (m.xEnd - m.xStart) : 0;
          return m.startBeat + t * (m.endBeat - m.startBeat);
        }
      }
      return measureLayout.length > 0 ? measureLayout[0].startBeat : 0;
    },
    [measureLayout, systemXOffsets, systems],
  );
  useEffect(() => {
    if (
      !noteBeatDrag ||
      typeof onNoteBeatChange !== "function" ||
      !timelineSvgRef?.current
    )
      return;
    const { noteIndex } = noteBeatDrag;
    const onUp = (e) => {
      const svg = timelineSvgRef.current;
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = 0;
        const local = pt.matrixTransform(svg.getScreenCTM().inverse());
        const beat = getBeatFromX(local.x);
        onNoteBeatChange(noteIndex, beat);
      }
      setNoteBeatDrag(null);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [noteBeatDrag, onNoteBeatChange, getBeatFromX, timelineSvgRef]);

  useEffect(() => {
    if (!timeSigDrag || typeof onTimeSignatureOffsetChange !== "function") return;
    const onMove = (e) => {
      onTimeSignatureOffsetChange({
        x: timeSigDrag.startOffsetX + (e.clientX - timeSigDrag.startClientX),
        y: timeSigDrag.startOffsetY + (e.clientY - timeSigDrag.startClientY),
      });
    };
    const onUp = () => setTimeSigDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [timeSigDrag, onTimeSignatureOffsetChange]);

  useEffect(() => {
    if (!systemDrag) return;
    const onMove = (e) => {
      const deltaX = e.clientX - systemDrag.startClientX;
      const deltaY = e.clientY - systemDrag.startClientY;
      if (Math.abs(deltaX) >= 0.5 && typeof onSystemXOffsetChange === "function") {
        onSystemXOffsetChange(systemDrag.systemIndex, deltaX);
      }
      if (Math.abs(deltaY) >= 0.5 && typeof onSystemYOffsetChange === "function") {
        onSystemYOffsetChange(systemDrag.systemIndex, deltaY);
      }
      setSystemDrag({
        systemIndex: systemDrag.systemIndex,
        startClientX: e.clientX,
        startClientY: e.clientY,
      });
    };
    const onUp = () => setSystemDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [systemDrag, onSystemXOffsetChange, onSystemYOffsetChange]);

  const renderAnchoredRepeatBarline = useCallback(
    ({ x, topY, bottomY, staffSpace, type }) => {
      const sp = Math.max(1, Number(staffSpace) || 10);
      const top = Number(topY);
      const bottom = Number(bottomY);
      const span = Math.max(1, bottom - top);
      const cy = top + span / 2;
      // Use engraving-default ratios so geometric repeat matches SMuFL/Leland feel.
      const thinW = Math.max(1, sp * THIN_BARLINE_THICKNESS);
      const thickW = Math.max(2, sp * THICK_BARLINE_THICKNESS);
      const gap = Math.max(1.2, sp * BARLINE_SEPARATION);
      const dotR = Math.max(1.2, sp * 0.16) + 1;
      const dotDy = Math.max(dotR * 2.4, sp * 0.95);
      // Keep dots away from noteheads, but never so inward that lines visually cover them.
      const maxSafeInwardShift = Math.max(
        0,
        gap + dotR * 1.4 - (thinW / 2 + dotR + 1.5),
      );
      const inwardShift = Math.min(
        FIGURE_REPEAT_DOT_NOTE_CLEARANCE_PX,
        maxSafeInwardShift,
      );
      const stroke = "#1a1a1a";

      const drawEnd = (anchorX) => {
        const thickCx = anchorX;
        const thinCx = thickCx - (thickW / 2 + gap + thinW / 2);
        const dotsX =
          thinCx -
          (gap + dotR * 1.4) +
          inwardShift;
        return (
          <>
            <line
              x1={thinCx}
              y1={top}
              x2={thinCx}
              y2={bottom}
              stroke={stroke}
              strokeWidth={thinW}
            />
            <line
              x1={thickCx}
              y1={top}
              x2={thickCx}
              y2={bottom}
              stroke={stroke}
              strokeWidth={thickW}
            />
            <circle cx={dotsX} cy={cy - dotDy} r={dotR} fill={stroke} />
            <circle cx={dotsX} cy={cy + dotDy} r={dotR} fill={stroke} />
          </>
        );
      };

      const drawStart = (anchorX) => {
        const thickCx = anchorX;
        const thinCx = thickCx + (thickW / 2 + gap + thinW / 2);
        const dotsX =
          thinCx +
          (gap + dotR * 1.4) -
          inwardShift;
        return (
          <>
            <line
              x1={thinCx}
              y1={top}
              x2={thinCx}
              y2={bottom}
              stroke={stroke}
              strokeWidth={thinW}
            />
            <line
              x1={thickCx}
              y1={top}
              x2={thickCx}
              y2={bottom}
              stroke={stroke}
              strokeWidth={thickW}
            />
            <circle cx={dotsX} cy={cy - dotDy} r={dotR} fill={stroke} />
            <circle cx={dotsX} cy={cy + dotDy} r={dotR} fill={stroke} />
          </>
        );
      };

      if (type === "end") return <g>{drawEnd(x)}</g>;
      if (type === "start") return <g>{drawStart(x)}</g>;
      if (type === "both") {
        const split = Math.max(1.2, sp * 0.18);
        return (
          <g>
            {drawEnd(x - split)}
            {drawStart(x + split)}
          </g>
        );
      }
      return null;
    },
    [],
  );

  return (
    <>
      {systems.map((sys) => {
        const systemOffsetX = Number(systemXOffsets?.[sys.systemIndex]) || 0;
        const pageIndex = isHorizontal
          ? Math.floor(sys.yOffset / a4PageHeight)
          : 0;
        const groupTransform =
          isHorizontal && pageWidth
            ? `translate(${pageIndex * pageWidth}, ${-pageIndex * a4PageHeight})`
            : undefined;
        return (
          <g key={sys.systemIndex} transform={groupTransform}>
            <g transform={systemOffsetX ? `translate(${systemOffsetX}, 0)` : undefined}>
            {canHandDragSystems && (
              <rect
                x={0}
                y={sys.yOffset}
                width={Math.max(1, Number(pageWidth) || 1000)}
                height={
                  combinedRows
                    ? (instruments.length - 1) * rowStepPx +
                      melodyRowHeight +
                      chordLineGap +
                      chordLineHeight +
                      lyricReserveHeight
                    : melodyRowHeight +
                      chordLineGap +
                      chordLineHeight +
                      lyricReserveHeight
                }
                fill="transparent"
                style={{ cursor: "grab" }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  setSystemDrag({
                    systemIndex: sys.systemIndex,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                  });
                }}
              />
            )}
            {showStaffSpacerHandles &&
              typeof onStaffSpacerMouseDown === "function" && (
                <rect
                  className="staff-spacer-handle"
                  x={0}
                  y={sys.yOffset}
                  width={14}
                  height={
                    combinedRows
                      ? (instruments.length - 1) * rowStepPx +
                        melodyRowHeight +
                        chordLineGap +
                        chordLineHeight +
                        lyricReserveHeight
                      : melodyRowHeight +
                        chordLineGap +
                        chordLineHeight +
                        lyricReserveHeight
                  }
                  fill="#e5e7eb"
                  stroke="#9ca3af"
                  strokeWidth={1}
                  rx={2}
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={(e) =>
                    onStaffSpacerMouseDown(sys.systemIndex)(e)
                  }
                />
              )}
            {showLyricSpacerHandles &&
              typeof onLyricSpacerMouseDown === "function" && (
                <rect
                  className="lyric-spacer-handle"
                  x={16}
                  y={
                    sys.yOffset +
                    melodyRowHeight +
                    chordLineGap +
                    chordLineHeight +
                    Math.max(2, lyricReserveHeight * 0.12) +
                    (lyricLineYOffset || 0)
                  }
                  width={14}
                  height={14}
                  fill="#dbeafe"
                  stroke="#60a5fa"
                  strokeWidth={1}
                  rx={2}
                  tabIndex={0}
                  role="slider"
                  aria-label="Lyrics row vertical offset"
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={onLyricSpacerMouseDown}
                  onKeyDown={(e) => {
                    if (typeof onLyricSpacerNudge !== "function") return;
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      onLyricSpacerNudge(-1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      onLyricSpacerNudge(1);
                    }
                  }}
                />
              )}
            {/* Taktinumber iga rea esimese takti vasak ja ülemine nurk (esimese taktikasti nurk) */}
            {showBarNumbers && sys.measureIndices.length > 0 && (
              <text
                x={marginLeft}
                y={sys.yOffset + padVertical}
                fontSize={barNumberSize}
                fontWeight="bold"
                fill="#555"
                textAnchor="end"
                dominantBaseline="text-after-edge"
                fontFamily="sans-serif"
              >
                {sys.measureIndices[0] + 1}
              </text>
            )}

            {sys.systemIndex === 0 && (
              <g transform={`translate(0, ${sys.yOffset})`}>
                {(() => {
                  const firstMeasureIdx = sys.measureIndices?.[0];
                  const firstMeasure =
                    typeof firstMeasureIdx === "number"
                      ? layoutSourceMeasures[firstMeasureIdx]
                      : null;
                  const hasRepeatStartAtRowStart = !!firstMeasure?.repeatStart;
                  const timeSigX = hasRepeatStartAtRowStart
                    ? getFigureTimeSignatureX(marginLeft) -
                      FIGURE_TIME_SIG_REPEAT_START_CLEARANCE_PX -
                      FIGURE_TIME_SIGNATURE_LEFT_SHIFT_PX
                    : getFigureTimeSignatureX(marginLeft);
                  return (
                    <g
                      transform={`translate(${Number(timeSignatureOffset?.x) || 0}, ${Number(timeSignatureOffset?.y) || 0})`}
                      onMouseDown={
                        canHandDragNotes &&
                        typeof onTimeSignatureOffsetChange === "function"
                          ? (e) => {
                              if (e.button !== 0) return;
                              e.stopPropagation();
                              setTimeSigDrag({
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                startOffsetX:
                                  Number(timeSignatureOffset?.x) || 0,
                                startOffsetY:
                                  Number(timeSignatureOffset?.y) || 0,
                              });
                            }
                          : undefined
                      }
                      style={canHandDragNotes ? { cursor: "grab" } : undefined}
                    >
                      {renderTimeSignature(
                        timeSignature,
                        timeSignatureMode,
                        centerY,
                        timeSignatureSize,
                        timeSigTextColor,
                        timeSigNoteFill,
                        timeSigX,
                      )}
                    </g>
                  );
                })()}
              </g>
            )}

            {(() => {
              const measureWidths =
                sys.measureWidths ??
                sys.measureIndices.map(
                  () => sys.measureWidth ?? beatsPerMeasure * 80,
                );
              const mwDefault = sys.measureWidth ?? beatsPerMeasure * 80;
              let systemTimelineWidth = 0;
              for (let jj = 0; jj < sys.measureIndices.length; jj += 1) {
                const baseW = measureWidths[jj] ?? mwDefault;
                const ln = computeRepeatLaneWidths({
                  sys,
                  layoutSourceMeasures,
                  measureIndexInSystem: jj,
                  notationScale,
                });
                systemTimelineWidth += baseW + ln.total;
              }
              return sys.measureIndices.map((measureIdx, j) => {
              const lanesJ = computeRepeatLaneWidths({
                sys,
                layoutSourceMeasures,
                measureIndexInSystem: j,
                notationScale,
              });
              const baseMeasureWidth = measureWidths[j] ?? mwDefault;
              const measureWidth = baseMeasureWidth + lanesJ.total;
              const measureX =
                marginLeft +
                measureWidths.slice(0, j).reduce((a, _b, idxInSlice) => {
                  const bi = measureWidths[idxInSlice] ?? mwDefault;
                  const li = computeRepeatLaneWidths({
                    sys,
                    layoutSourceMeasures,
                    measureIndexInSystem: idxInSlice,
                    notationScale,
                  });
                  return a + bi + li.total;
                }, 0);
              const beatContentLeft = measureX + lanesJ.left;
              const beatContentWidth = baseMeasureWidth;
              const mBarForBeatBox = layoutSourceMeasures[measureIdx];
              const prevBarForBeatBox =
                j > 0 ? layoutSourceMeasures[sys.measureIndices[j - 1]] : null;
              const leftBarRepeatForBeatBox = getLeftBarlineRepeatRender({
                measureIndexInSystem: j,
                measure: mBarForBeatBox,
                prevMeasureInSystem: prevBarForBeatBox,
              });
              /**
               * Täis-rect stroke jättis vertikaaltaktijoone alles ka siis, kui repeat-plokk
               * joonistas sama kohta SMuFL glüüfi — tundus, nagu kordus ei asendaks taktijoont.
               * Vertikaal: vasak äär ainult kui repeatBarlineResolve ei joonista seal midagi;
               * parem äär mitte kunagi (joonistab repeat-plokk või järgmise takti vasak serv).
               */
              const hideBeatBoxLeftStroke =
                leftBarRepeatForBeatBox.variant !== "none";
              const staffRowsForCombinedFigure = combinedRows
                ? instruments
                : [{ id: "_figure_single" }];
              const nStaffRows = staffRowsForCombinedFigure.length;
              const activeRowForBeatDrag =
                figurenotesCombinedActiveStaffRowIndex != null &&
                Number.isFinite(figurenotesCombinedActiveStaffRowIndex)
                  ? figurenotesCombinedActiveStaffRowIndex
                  : 0;
              return (
                <g key={`${sys.systemIndex}-meas-${measureIdx}`}>
                  {staffRowsForCombinedFigure.map((inst, staffSi) => {
                    const instMeasures =
                      combinedRows && inst.id !== "_figure_single"
                        ? (effectiveMeasuresPerInstrument[inst.id] ??
                          layoutSourceMeasures)
                        : effectiveMeasures;
                    const measure = instMeasures[measureIdx];
                    if (!measure) return null;
                    const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
                    const beatWidth = beatContentWidth / beatsInMeasure;
                    const measureIndexInSystem = sys.measureIndices.indexOf(measureIdx);
                    const prevMeasureInSystem =
                      measureIndexInSystem > 0
                        ? instMeasures[sys.measureIndices[measureIndexInSystem - 1]]
                        : null;
                    const nextMeasureInSystem =
                      measureIndexInSystem >= 0 &&
                      measureIndexInSystem < sys.measureIndices.length - 1
                        ? instMeasures[sys.measureIndices[measureIndexInSystem + 1]]
                        : null;
                    const leftRepeatRender = getLeftBarlineRepeatRender({
                      measureIndexInSystem,
                      measure,
                      prevMeasureInSystem,
                    });
                    const drawRightRepeat = shouldDrawRepeatEndGlyphOnRight(
                      measure,
                      nextMeasureInSystem,
                    );
                    const repeatStaffSpace = 10 * notationScale;
                    const repeatThinW = Math.max(
                      1,
                      repeatStaffSpace * THIN_BARLINE_THICKNESS,
                    );
                    const repeatThickW = Math.max(
                      2,
                      repeatStaffSpace * THICK_BARLINE_THICKNESS,
                    );
                    const repeatGap = Math.max(
                      1.2,
                      repeatStaffSpace * BARLINE_SEPARATION,
                    );
                    const repeatDotR =
                      Math.max(1.2, repeatStaffSpace * 0.16) + 1;
                    const repeatBlockWidth =
                      repeatThickW / 2 +
                      repeatGap +
                      repeatThinW +
                      repeatGap +
                      repeatDotR * 2;
                    /** Interpret duration as beats (1=quarter, 0.5=eighth) or measure fraction (0.125=eighth in 4/4). */
                    const durationInBeats = (d) =>
                      d > 0 && d < 0.5 ? d * (beatsInMeasure || 4) : d;
                    const getSlotsPerBeat = (beatIndex) => {
                      const beatStart = measure.startBeat + beatIndex;
                      const beatEnd = beatStart + 1;
                      const notesInBeat = measure.notes.filter(
                        (n) => n.beat >= beatStart && n.beat < beatEnd,
                      );
                      if (notesInBeat.length === 0) return 1;
                      const minDur = Math.min(
                        ...notesInBeat.map((n) => n.duration),
                      );
                      const minDurBeats = durationInBeats(minDur);
                      return Math.max(1, Math.round(1 / minDurBeats));
                    };
                    /** Slot index by position within beat (order when sorted by beat). */
                    const getSlotIndexInBeat = (note) => {
                      const beatIndex = Math.floor(
                        note.beat - measure.startBeat,
                      );
                      const beatStart = measure.startBeat + beatIndex;
                      const beatEnd = beatStart + 1;
                      const notesInBeat = measure.notes
                        .filter((n) => n.beat >= beatStart && n.beat < beatEnd)
                        .sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
                      const idx = notesInBeat.findIndex((n) => n === note);
                      return idx >= 0 ? idx : 0;
                    };
                    const getNoteSlotCenterX = (note) => {
                      const beatInMeasure = note.beat - measure.startBeat;
                      const beatIndex = Math.floor(beatInMeasure);
                      const slotsPerBeat = getSlotsPerBeat(beatIndex);
                      const slotIndex = getSlotIndexInBeat(note);
                      const slotCenter =
                        (Math.min(slotIndex, slotsPerBeat - 1) + 0.5) /
                        slotsPerBeat;
                      return beatContentLeft + (beatIndex + slotCenter) * beatWidth;
                    };
                    const getRestBoxWidth = (note) => {
                      const beatInMeasure = note.beat - measure.startBeat;
                      const beatIndex = Math.floor(beatInMeasure);
                      const slotsPerBeat = getSlotsPerBeat(beatIndex);
                      return beatWidth / slotsPerBeat;
                    };

                    const boxHeight = timelineHeight - 2 * padVertical;
                    /** User-chosen notation size (px). Shapes are never stretched or capped by beat width — kept intact. */
                    const figureSizeBase = Math.max(
                      12,
                      Math.min(100, figurenotesSize),
                    );
                    const figureSizeBaseForMeasure = figureSizeBase;

                    /** Scale figure when shorter than quarter so multiple notes fit in one beat: eighth = 0.5, 16th/32nd = 0.25. */
                    const getFigureScaleForDuration = (durLabel) => {
                      if (durLabel === "1/8") return 0.5;
                      if (durLabel === "1/16" || durLabel === "1/32")
                        return 0.25;
                      return 1;
                    };

                    /* Bottom of beat box row for long-duration rectangle (so long notes don't overlap barlines). */
                    const beatBoxBottomY =
                      sys.yOffset + melodyRowHeight - padVertical;

                    /** Duration in beats for long rectangle: 1/4=1, 1/2=2, 1/1=4. */
                    const getDurationInBeats = (durLabel) => {
                      if (durLabel === "1/1") return 4;
                      if (durLabel === "1/2") return 2;
                      if (durLabel === "1/4") return 1;
                      if (durLabel === "1/8") return 0.5;
                      if (durLabel === "1/16" || durLabel === "1/32")
                        return 0.25;
                      return 1;
                    };

                    const renderFigurenote = (
                      note,
                      x,
                      y,
                      noteIndex,
                      noteWidth,
                      figureSize,
                      longRectEndX = null,
                      beamInfo = null,
                    ) => {
                      const pitch = String(note.pitch || "")
                        .toUpperCase()
                        .replace("H", "B");
                      // Figuurnotatsioonis võtmemärke ei kuvata – kui noodil pole alteratsiooni, võta helistikust (nt D-duur → F#, C#; Bb-duur → B♭, E♭).
                      const effectiveAccidental =
                        note.accidental !== undefined &&
                        note.accidental !== null
                          ? note.accidental
                          : getAccidentalForPitchInKey(
                              note.pitch,
                              keySignature,
                            );
                      const style = getFigureStyle(note.pitch, note.octave);
                      const shapePaths = getShapePathsByOctave(note.octave);
                      const size = figureSize ?? figureSizeBase;
                      const isSelected = isNoteSelected
                        ? combinedRows
                          ? isNoteSelected(noteIndex, staffSi)
                          : isNoteSelected(noteIndex)
                        : false;
                      const dur = note.durationLabel || "1/4";
                      const smuflType =
                        dur === "1/1"
                          ? "whole"
                          : dur === "1/2"
                            ? "half"
                            : dur === "1/8"
                              ? "eighth"
                              : dur === "1/16" || dur === "1/32"
                                ? "sixteenth"
                                : "quarter";
                      /* Long rhythm (1/2, 1/1): rectangle from center of figure until end of last beat (e.g. half note → end of 2nd beat). */
                      const hasTail = dur === "1/2" || dur === "1/1";
                      const tailSize = hasTail ? size / 2 : 0;
                      const figureCenterX = x;
                      const longRectWidth =
                        hasTail &&
                        typeof longRectEndX === "number" &&
                        longRectEndX > figureCenterX
                          ? longRectEndX - figureCenterX
                          : 0;
                      const stemLength = 26;
                      const stemX = figureCenterX + size / 2 + 1;
                      const stemY1 = y;
                      const stemY2 = y - stemLength;
                      const textColor = getFigurenoteTextColor(note.pitch);
                      const r = size / 2;
                      const strokeShape = isSelected ? "#2563eb" : "#000";
                      const strokeWShape = isSelected ? 3 : 2;

                      const fill = style.fill ?? "#C7BAB7";
                      const effectiveStroke = style.stroke ?? "none";
                      const effectiveStrokeWidth = style.strokeWidth ?? 0;

                      /* Long-duration rectangle: start exactly at figure center and extend to beat end.
                         To avoid the old "floating corner" artifact near the join, keep the join square
                         (no rounding at the left edge). */
                      const longRectRenderX = figureCenterX;
                      const longRectRenderWidth = Math.max(0, longRectWidth);
                      const longRectRadius = 0;
                      const longDurationRectEl = hasTail &&
                        longRectRenderWidth > 0 && (
                          <rect
                            x={longRectRenderX}
                            y={beatBoxBottomY - tailSize}
                            width={longRectRenderWidth}
                            height={tailSize}
                            rx={longRectRadius}
                            ry={longRectRadius}
                            fill={fill}
                            stroke="#000"
                            strokeWidth={2}
                          />
                        );

                      /* Quarter (1/4) and all durations: use a square SVG and preserve aspect ratio so shapes
                   are never stretched — perfect circle, square, X, or triangle (not oval/rectangular). */
                      const shapeSize = size;
                      const svgX = figureCenterX - shapeSize / 2;
                      const svgY = y - shapeSize / 2;

                      const isBlackFigure =
                        !fill ||
                        String(fill).toLowerCase() === "#000000" ||
                        String(fill).toLowerCase() === "black";
                      const showWhiteHalo =
                        !!themeColors?.isDark && isBlackFigure;

                      const haloEl = showWhiteHalo ? (
                        <circle
                          cx={figureCenterX}
                          cy={y}
                          r={shapeSize / 2 + 4}
                          fill="#ffffff"
                        />
                      ) : null;

                      const shapeEl = (
                        <svg
                          x={svgX}
                          y={svgY}
                          width={shapeSize}
                          height={shapeSize}
                          viewBox="0 0 100 100"
                          preserveAspectRatio="xMidYMid meet"
                          style={{ overflow: "visible" }}
                        >
                          {shapePaths.map((d, i) => (
                            <path
                              key={i}
                              d={d}
                              fill={fill}
                              stroke={effectiveStroke}
                              strokeWidth={effectiveStrokeWidth}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                        </svg>
                      );

                      return (
                        <g>
                          {/* Long-duration bar: rectangle at bottom of beat box, slightly under figure layer */}
                          {longDurationRectEl}
                          {/* Pedagoogiline aluskiht: SMuFL notehead (Leland) */}
                          <SmuflGlyph
                            x={figureCenterX}
                            y={y}
                            glyph={smuflNoteheadForType(smuflType)}
                            fontSize={size * 1.35}
                            fill="var(--note-fill, #1a1a1a)"
                            style={{ opacity: 0.18 }}
                          />
                          {haloEl}
                          {shapeEl}
                          {showMelodyNoteNames && (
                            <text
                              x={figureCenterX}
                              y={y + 10}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              alignmentBaseline="middle"
                              fill={textColor}
                              fontSize={Math.max(8, size * 0.5)}
                              fontWeight="bold"
                              fontFamily="Arial, sans-serif"
                            >
                              {String(note.pitch || "")
                                .toUpperCase()
                                .replace("H", "B")}
                            </text>
                          )}
                          {figurenotesStems && dur !== "1/1" && (
                            <g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.8">
                              <line
                                x1={stemX}
                                y1={stemY1}
                                x2={stemX}
                                y2={stemY2}
                              />
                              {!beamInfo?.group && getFlagCountForDuration(dur) > 0 && (
                                <SmuflStemFlags
                                  stemX={stemX}
                                  stemEndY={stemY2}
                                  staffSpace={10}
                                  stemUp
                                  count={getFlagCountForDuration(dur)}
                                  fill="#1a1a1a"
                                />
                              )}
                              {beamInfo?.isStart && Array.isArray(beamInfo.segments) && (
                                <>
                                  {beamInfo.segments.map((seg, i) => (
                                    <line
                                      key={`beam-${i}`}
                                      x1={seg.x1}
                                      y1={seg.y}
                                      x2={seg.x2}
                                      y2={seg.y}
                                      stroke="#1a1a1a"
                                      strokeWidth={2.2}
                                      strokeLinecap="butt"
                                    />
                                  ))}
                                </>
                              )}
                            </g>
                          )}
                          {(effectiveAccidental === 1 ||
                            effectiveAccidental === -1) &&
                            (() => {
                              const arrowLen = 28 / Math.SQRT2; // diagonaal 28px (SVG näidis on 17px; siin pikem, et rakenduses ei tunduks vars lühikeseks)
                              const head = Math.max(3, size * 0.14);
                              const strokeW2 = Math.max(2.5, size * 0.07);
                              const gap = 0; // figuuri ja noole vahe (0,5px vähendatud)
                              const arrowY = y - size / 2 - gap - arrowLen / 2;
                              const stroke = "#1a1a1a";
                              if (effectiveAccidental === 1) {
                                // Sharp: diagonal arrow up-right (↗), 90° täidetud noolepea, terav tipp
                                const tipX = figureCenterX + arrowLen / 2;
                                const tipY = arrowY - arrowLen / 2;
                                return (
                                  <g
                                    stroke={stroke}
                                    fill={stroke}
                                    strokeWidth={strokeW2}
                                    strokeLinecap="butt"
                                    strokeLinejoin="miter"
                                  >
                                    <line
                                      x1={figureCenterX - arrowLen / 2}
                                      y1={arrowY + arrowLen / 2}
                                      x2={tipX}
                                      y2={tipY}
                                    />
                                    <polygon
                                      points={`${tipX},${tipY} ${tipX - head},${tipY} ${tipX},${tipY + head}`}
                                    />
                                  </g>
                                );
                              }
                              // Flat: diagonal arrow up-left (↖), 90° täidetud noolepea, terav tipp
                              const tipX = figureCenterX - arrowLen / 2;
                              const tipY = arrowY - arrowLen / 2;
                              return (
                                <g
                                  stroke={stroke}
                                  fill={stroke}
                                  strokeWidth={strokeW2}
                                  strokeLinecap="butt"
                                  strokeLinejoin="miter"
                                >
                                  <line
                                    x1={figureCenterX + arrowLen / 2}
                                    y1={arrowY + arrowLen / 2}
                                    x2={tipX}
                                    y2={tipY}
                                  />
                                  <polygon
                                    points={`${tipX},${tipY} ${tipX + head},${tipY} ${tipX},${tipY + head}`}
                                  />
                                </g>
                              );
                            })()}
                          {isSelected && (
                            <g className="nm-note-selection-glow">
                              <circle
                                cx={figureCenterX}
                                cy={y}
                                r={size / 2 + 4}
                                fill="none"
                                stroke="#2563eb"
                                strokeWidth="2"
                                opacity="0.5"
                              />
                            </g>
                          )}
                        </g>
                      );
                    };

                    const handleBeatSlot = (
                      beatIndex,
                      slotIndex,
                      slotsPerBeat,
                      e,
                    ) => {
                      if (typeof onBeatSlotClick !== "function") return;
                      e.stopPropagation();
                      e.preventDefault?.();
                      const s = Math.max(1, Number(slotsPerBeat) || 1);
                      const slot = Math.max(
                        0,
                        Math.min(s - 1, Number(slotIndex) || 0),
                      );
                      const beatPosition =
                        measure.startBeat + beatIndex + slot / s;
                      if (combinedRows)
                        onBeatSlotClick(beatPosition, {
                          staffRowIndex: staffSi,
                        });
                      else onBeatSlotClick(beatPosition);
                    };

                    const canDragBeatOnThisRow =
                      canHandDragNotes &&
                      typeof onNoteBeatChange === "function" &&
                      (!combinedRows || staffSi === activeRowForBeatDrag);

                    return (
                      <g
                        key={`${inst.id}-${measureIdx}-${staffSi}`}
                        transform={
                          combinedRows
                            ? `translate(0, ${staffSi * rowStepPx})`
                            : undefined
                        }
                      >
                        {/* Taktikast + löögivõre (vertikaaltaktijoon eraldi repeat-plokis, et ei dubleeruks glüüfidega) */}
                        {(() => {
                          const topY = sys.yOffset + padVertical;
                          const bottomY = sys.yOffset + melodyRowHeight - padVertical;
                          const edge = "#c8c8c8";
                          const sw = 1.5;
                          return (
                            <g>
                              <line
                                x1={measureX}
                                y1={topY}
                                x2={measureX + measureWidth}
                                y2={topY}
                                stroke={edge}
                                strokeWidth={sw}
                              />
                              <line
                                x1={measureX}
                                y1={bottomY}
                                x2={measureX + measureWidth}
                                y2={bottomY}
                                stroke={edge}
                                strokeWidth={sw}
                              />
                              {/* Repeat symbol lanes are intentionally transparent.
                                  Beat grid is offset into the middle “content” width so notes align with beat lines. */}
                              {!hideBeatBoxLeftStroke && (
                                <line
                                  x1={measureX}
                                  y1={topY}
                                  x2={measureX}
                                  y2={bottomY}
                                  stroke={edge}
                                  strokeWidth={sw}
                                />
                              )}
                            </g>
                          );
                        })()}
                        {Array.from(
                          {
                            length: Math.max(0, Math.ceil(beatsInMeasure) - 1),
                          },
                          (_, b) => (
                            <line
                              key={`beat-${b}`}
                              x1={beatContentLeft + (b + 1) * beatWidth}
                              y1={sys.yOffset + padVertical}
                              x2={beatContentLeft + (b + 1) * beatWidth}
                              y2={sys.yOffset + melodyRowHeight - padVertical}
                              stroke="#e0e0e0"
                              strokeWidth="1"
                            />
                          ),
                        )}
                        {/* Tahvel/sõrm: puudeala löögikastidele – noodi lisamine soovitud löögile */}
                        {onBeatSlotClick &&
                          Array.from(
                            { length: Math.ceil(beatsInMeasure) },
                            (_, beatIndex) => {
                              // Click slots are subdivided by currently selected duration (e.g. 1/8 => 2 slots per beat).
                              // Also respect existing shorter rhythms in this beat so user can click them reliably.
                              const selDurBeats =
                                getDurationInBeats(selectedDuration);
                              const fromSelected =
                                selDurBeats > 0 && selDurBeats < 1
                                  ? Math.round(1 / selDurBeats)
                                  : 1;
                              const fromExisting = getSlotsPerBeat(beatIndex);
                              const slotsPerBeat = Math.max(
                                1,
                                fromSelected,
                                fromExisting,
                              );
                              return Array.from(
                                { length: slotsPerBeat },
                                (_, slotIndex) => (
                                  <rect
                                    key={`beat-hit-${beatIndex}-${slotIndex}`}
                                    x={
                                      beatContentLeft +
                                      (beatIndex + slotIndex / slotsPerBeat) *
                                        beatWidth
                                    }
                                    y={sys.yOffset + padVertical}
                                    width={beatWidth / slotsPerBeat}
                                    height={boxHeight}
                                    fill="transparent"
                                    style={{ cursor: "pointer" }}
                                    onPointerDown={(e) =>
                                      handleBeatSlot(
                                        beatIndex,
                                        slotIndex,
                                        slotsPerBeat,
                                        e,
                                      )
                                    }
                                  />
                                ),
                              );
                            },
                          )}
                        {measureWidth < (LAYOUT.MEASURE_MIN_WIDTH || 28) && (
                          <rect
                            x={measureX - 1}
                            y={sys.yOffset + 2}
                            width={measureWidth + 2}
                            height={melodyRowHeight - 2 * padVertical}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth={2}
                            strokeDasharray="4 2"
                            rx={2}
                          />
                        )}
                        {showLayoutBreakIcons &&
                          typeof onToggleLineBreakAfter === "function" &&
                          (!combinedRows || staffSi === 0) && (
                            <g
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLineBreakAfter(measureIdx);
                              }}
                              style={{ pointerEvents: "auto" }}
                              title={
                                translateLabel
                                  ? translateLabel("layout.lineBreakAfter")
                                  : "Reavahetus selle takti järel"
                              }
                            >
                              <rect
                                x={measureX + measureWidth / 2 - 10}
                                y={sys.yOffset - 18}
                                width={20}
                                height={16}
                                rx={3}
                                fill={
                                  layoutLineBreakBefore.includes(measureIdx + 1)
                                    ? "#f59e0b"
                                    : "#fef3c7"
                                }
                                stroke="#d97706"
                                strokeWidth={1.2}
                              />
                              <path
                                d={`M ${measureX + measureWidth / 2 - 4} ${sys.yOffset - 10} L ${measureX + measureWidth / 2} ${sys.yOffset - 14} L ${measureX + measureWidth / 2 + 4} ${sys.yOffset - 10}`}
                                fill="none"
                                stroke="#92400e"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </g>
                          )}
                        {!combinedRows &&
                          (() => {
                            const mBar =
                              layoutSourceMeasures[measureIdx] ?? measure;
                            const prevM =
                              j > 0
                                ? layoutSourceMeasures[sys.measureIndices[j - 1]]
                                : null;
                            const nextM =
                              j < sys.measureIndices.length - 1
                                ? layoutSourceMeasures[
                                    sys.measureIndices[j + 1]
                                  ]
                                : null;
                            const leftR = getLeftBarlineRepeatRender({
                              measureIndexInSystem: j,
                              measure: mBar,
                              prevMeasureInSystem: prevM,
                            });
                            const drawEnd = shouldDrawRepeatEndGlyphOnRight(
                              mBar,
                              nextM,
                            );
                            const barLineTopY = sys.yOffset + padVertical;
                            const barLineBottomY =
                              sys.yOffset + melodyRowHeight - padVertical;
                            const rowBarFrame = getBarlineFrame({
                              barlineX: measureX,
                              barTopY: barLineTopY,
                              barBottomY: barLineBottomY,
                              staffSpace: 10 * notationScale,
                            });
                            const isRightBarlineOfSystem =
                              measureIdx ===
                              sys.measureIndices[sys.measureIndices.length - 1];
                            const isLastMeasureOfScore =
                              measureIdx === layoutSourceMeasures.length - 1;
                            const showFinalBar =
                              (isLastMeasureOfScore || mBar.barlineFinal) &&
                              !mBar.repeatEnd;
                            const xRight = measureX + measureWidth;
                            const finalGeom = showFinalBar
                              ? getFinalDoubleBarlineGeometry({
                                  measureRightX: xRight,
                                  notationScale,
                                  figurenotesSize,
                                  yOffset: sys.yOffset,
                                  melodyRowHeight,
                                  padVertical,
                                  chordLineHeight,
                                  chordLineGap,
                                })
                              : null;
                            const rightBarFrame = getBarlineFrame({
                              barlineX: xRight,
                              barTopY: rowBarFrame.topY,
                              barBottomY: rowBarFrame.bottomY,
                              staffSpace: rowBarFrame.staffSpace,
                            });
                            const repeatRightX = getRepeatRightGlyphX({
                              barlineX: rightBarFrame.x,
                              staffSpace: rightBarFrame.staffSpace,
                            }) - rightBarFrame.staffSpace * FIGURE_REPEAT_RIGHT_EXTRA_INSET_STAFF_SPACES;
                            const anchoredRepeatRightX = drawEnd
                              ? rightBarFrame.x
                              : repeatRightX;
                            return (
                              <>
                                {leftR.variant === "both" ? (
                                  <g
                                    onClick={
                                      typeof onSelectRepeatMark === "function"
                                        ? (e) => {
                                            e.stopPropagation();
                                            onSelectRepeatMark(
                                              measureIdx,
                                              "repeatStart",
                                              { toggle: !!(e.metaKey || e.ctrlKey) },
                                            );
                                          }
                                        : undefined
                                    }
                                    style={{
                                      cursor: onSelectRepeatMark
                                        ? "pointer"
                                        : undefined,
                                    }}
                                    pointerEvents={
                                      onSelectRepeatMark ? "auto" : "none"
                                    }
                                  >
                                    {renderAnchoredRepeatBarline({
                                      x: measureX,
                                      topY: barLineTopY,
                                      bottomY: barLineBottomY,
                                      staffSpace: rowBarFrame.staffSpace,
                                      type: "both",
                                    })}
                                    {isRepeatMarkSelected(
                                      measureIdx,
                                      "repeatStart",
                                    ) && (
                                      <rect
                                        x={measureX - rowBarFrame.staffSpace * 2}
                                        y={
                                          barLineTopY -
                                          rowBarFrame.staffSpace * 0.5
                                        }
                                        width={rowBarFrame.staffSpace * 4}
                                        height={
                                          barLineBottomY -
                                          barLineTopY +
                                          rowBarFrame.staffSpace
                                        }
                                        fill="#93c5fd"
                                        opacity="0.32"
                                        rx={3}
                                      />
                                    )}
                                    {onSelectRepeatMark && (
                                      <rect
                                        x={measureX - rowBarFrame.staffSpace * 2}
                                        y={barLineTopY - rowBarFrame.staffSpace}
                                        width={rowBarFrame.staffSpace * 4}
                                        height={
                                          barLineBottomY -
                                          barLineTopY +
                                          rowBarFrame.staffSpace * 2
                                        }
                                        fill="transparent"
                                      />
                                    )}
                                  </g>
                                ) : leftR.variant === "start" ? (
                                  <g
                                    onClick={
                                      typeof onSelectRepeatMark === "function"
                                        ? (e) => {
                                            e.stopPropagation();
                                            onSelectRepeatMark(
                                              measureIdx,
                                              "repeatStart",
                                              { toggle: !!(e.metaKey || e.ctrlKey) },
                                            );
                                          }
                                        : undefined
                                    }
                                    style={{
                                      cursor: onSelectRepeatMark
                                        ? "pointer"
                                        : undefined,
                                    }}
                                    pointerEvents={
                                      onSelectRepeatMark ? "auto" : "none"
                                    }
                                  >
                                    {renderAnchoredRepeatBarline({
                                      x: measureX,
                                      topY: barLineTopY,
                                      bottomY: barLineBottomY,
                                      staffSpace: rowBarFrame.staffSpace,
                                      type: "start",
                                    })}
                                    {isRepeatMarkSelected(
                                      measureIdx,
                                      "repeatStart",
                                    ) && (
                                      <rect
                                        x={measureX - rowBarFrame.staffSpace * 2}
                                        y={
                                          barLineTopY -
                                          rowBarFrame.staffSpace * 0.5
                                        }
                                        width={rowBarFrame.staffSpace * 4}
                                        height={
                                          barLineBottomY -
                                          barLineTopY +
                                          rowBarFrame.staffSpace
                                        }
                                        fill="#93c5fd"
                                        opacity="0.32"
                                        rx={3}
                                      />
                                    )}
                                    {onSelectRepeatMark && (
                                      <rect
                                        x={measureX - rowBarFrame.staffSpace * 2}
                                        y={barLineTopY - rowBarFrame.staffSpace}
                                        width={rowBarFrame.staffSpace * 2.2}
                                        height={
                                          barLineBottomY -
                                          barLineTopY +
                                          rowBarFrame.staffSpace * 2
                                        }
                                        fill="transparent"
                                      />
                                    )}
                                  </g>
                                ) : leftR.variant === "barline" ? (
                                  <line
                                    x1={measureX}
                                    y1={barLineTopY}
                                    x2={measureX}
                                    y2={barLineBottomY}
                                    stroke="#1a1a1a"
                                    strokeWidth={barLineWidth}
                                  />
                                ) : null}
                                {drawEnd ? (
                                  <g
                                    onClick={
                                      typeof onSelectRepeatMark === "function"
                                        ? (e) => {
                                            e.stopPropagation();
                                            onSelectRepeatMark(
                                              measureIdx,
                                              "repeatEnd",
                                              { toggle: !!(e.metaKey || e.ctrlKey) },
                                            );
                                          }
                                        : undefined
                                    }
                                    style={{
                                      cursor: onSelectRepeatMark
                                        ? "pointer"
                                        : undefined,
                                    }}
                                    pointerEvents={
                                      onSelectRepeatMark ? "auto" : "none"
                                    }
                                  >
                                    {renderAnchoredRepeatBarline({
                                      x: anchoredRepeatRightX,
                                      topY: barLineTopY,
                                      bottomY: barLineBottomY,
                                      staffSpace: rightBarFrame.staffSpace,
                                      type: "end",
                                    })}
                                    {isRepeatMarkSelected(
                                      measureIdx,
                                      "repeatEnd",
                                    ) && (
                                      <rect
                                        x={
                                          Math.min(anchoredRepeatRightX, xRight) -
                                          rightBarFrame.staffSpace * 2
                                        }
                                        y={
                                          barLineTopY -
                                          rightBarFrame.staffSpace * 0.5
                                        }
                                        width={
                                          Math.abs(
                                            xRight - anchoredRepeatRightX,
                                          ) +
                                          rightBarFrame.staffSpace * 4
                                        }
                                        height={
                                          barLineBottomY -
                                          barLineTopY +
                                          rightBarFrame.staffSpace
                                        }
                                        fill="#93c5fd"
                                        opacity="0.32"
                                        rx={3}
                                      />
                                    )}
                                    {onSelectRepeatMark && (
                                      <rect
                                        x={
                                          Math.min(anchoredRepeatRightX, xRight) -
                                          rightBarFrame.staffSpace * 2
                                        }
                                        y={barLineTopY - rightBarFrame.staffSpace}
                                        width={
                                          Math.abs(
                                            xRight - anchoredRepeatRightX,
                                          ) +
                                          rightBarFrame.staffSpace * 4
                                        }
                                        height={
                                          barLineBottomY -
                                          barLineTopY +
                                          rightBarFrame.staffSpace * 2
                                        }
                                        fill="transparent"
                                      />
                                    )}
                                    {debugRepeatOverlay && (
                                      <>
                                        <line
                                          x1={xRight}
                                          y1={barLineTopY}
                                          x2={xRight}
                                          y2={barLineBottomY}
                                          stroke="#ef4444"
                                          strokeWidth={1}
                                          strokeDasharray="3 2"
                                        />
                                        <line
                                          x1={anchoredRepeatRightX}
                                          y1={barLineTopY}
                                          x2={anchoredRepeatRightX}
                                          y2={barLineBottomY}
                                          stroke="#0ea5e9"
                                          strokeWidth={1}
                                          strokeDasharray="3 2"
                                        />
                                        <text
                                          x={xRight - 2}
                                          y={barLineTopY - 4}
                                          textAnchor="end"
                                          fontSize={10}
                                          fill="#dc2626"
                                          fontFamily="sans-serif"
                                        >
                                          {`bar ${xRight.toFixed(1)}`}
                                        </text>
                                        <text
                                          x={anchoredRepeatRightX + 2}
                                          y={barLineTopY - 4}
                                          textAnchor="start"
                                          fontSize={10}
                                          fill="#0369a1"
                                          fontFamily="sans-serif"
                                        >
                                          {`rep ${anchoredRepeatRightX.toFixed(1)} Δ ${(anchoredRepeatRightX - xRight).toFixed(1)}`}
                                        </text>
                                      </>
                                    )}
                                  </g>
                                ) : (
                                  isRightBarlineOfSystem &&
                                  !showFinalBar && (
                                    <line
                                      x1={xRight}
                                      y1={barLineTopY}
                                      x2={xRight}
                                      y2={barLineBottomY}
                                      stroke="#1a1a1a"
                                      strokeWidth={barLineWidth}
                                    />
                                  )
                                )}
                                {showFinalBar && finalGeom && (
                                  <g>
                                    <line
                                      x1={finalGeom.thinX}
                                      y1={finalGeom.topY}
                                      x2={finalGeom.thinX}
                                      y2={finalGeom.bottomY}
                                      stroke="#1a1a1a"
                                      strokeWidth={finalGeom.thinW}
                                    />
                                    <line
                                      x1={finalGeom.thickX}
                                      y1={finalGeom.topY}
                                      x2={finalGeom.thickX}
                                      y2={finalGeom.bottomY}
                                      stroke="#1a1a1a"
                                      strokeWidth={finalGeom.thickW}
                                    />
                                  </g>
                                )}
                                {(() => {
                                  if (!onSelectRepeatMark) return null;
                                  const markerY =
                                    sys.yOffset +
                                    padVertical -
                                    Math.max(12, 12 * notationScale);
                                  const markers = [];
                                  if (mBar.segno) markers.push({ key: "segno", label: "segno", glyph: SMUFL_GLYPH.segno });
                                  if (mBar.coda) markers.push({ key: "coda", label: "coda", glyph: SMUFL_GLYPH.coda });
                                  if (mBar.volta1) markers.push({ key: "volta1", label: "1." });
                                  if (mBar.volta2) markers.push({ key: "volta2", label: "2." });
                                  if (markers.length === 0) return null;
                                  const step = Math.max(20, 20 * notationScale);
                                  const fontSize = Math.max(12, 16 * notationScale);
                                  return markers.map((mk, idx) => {
                                    const x = measureX + 6 + idx * step;
                                    const selected = isRepeatMarkSelected(measureIdx, mk.key);
                                    return (
                                      <g
                                        key={`fig-marker-${measureIdx}-${mk.key}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectRepeatMark(measureIdx, mk.key, {
                                            toggle: !!(e.metaKey || e.ctrlKey),
                                          });
                                        }}
                                        style={{ cursor: "pointer" }}
                                        pointerEvents="auto"
                                      >
                                        {selected && (
                                          <rect
                                            x={x - fontSize * 0.6}
                                            y={markerY - fontSize * 0.7}
                                            width={fontSize * 1.2}
                                            height={fontSize * 1.2}
                                            fill="#93c5fd"
                                            opacity="0.32"
                                            rx={3}
                                          />
                                        )}
                                        {mk.glyph ? (
                                          <SmuflGlyph
                                            x={x}
                                            y={markerY}
                                            glyph={mk.glyph}
                                            fontSize={fontSize}
                                            fill="#1a1a1a"
                                          />
                                        ) : (
                                          <text
                                            x={x}
                                            y={markerY}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize={fontSize * 0.85}
                                            fontFamily="sans-serif"
                                            fill="#1a1a1a"
                                          >
                                            {mk.label}
                                          </text>
                                        )}
                                        <rect
                                          x={x - fontSize * 0.6}
                                          y={markerY - fontSize * 0.7}
                                          width={fontSize * 1.2}
                                          height={fontSize * 1.2}
                                          fill="transparent"
                                        />
                                      </g>
                                    );
                                  });
                                })()}
                              </>
                            );
                          })()}
                        {/* Chord line: half-height row below melody; chords drawn in that row. Invisible overlay for cursor-follow on hover. */}
                        {chordLineHeight > 0 &&
                          j === 0 &&
                          (!combinedRows || staffSi === nStaffRows - 1) && (
                            <>
                              <rect
                                x={marginLeft}
                                y={sys.yOffset + melodyRowHeight + chordLineGap}
                                width={systemTimelineWidth}
                                height={chordLineHeight}
                                fill="rgba(0,0,0,0.03)"
                                stroke="#e8e8e8"
                                strokeWidth={1}
                                rx={2}
                              />
                              {(typeof onChordLineMouseMove === "function" ||
                                typeof onChordLineClick === "function") &&
                                timelineSvgRef?.current && (
                                  <rect
                                    x={marginLeft}
                                    y={
                                      sys.yOffset +
                                      melodyRowHeight +
                                      chordLineGap
                                    }
                                    width={systemTimelineWidth}
                                    height={chordLineHeight}
                                    fill="transparent"
                                    style={{ cursor: "pointer" }}
                                    onMouseMove={
                                      typeof onChordLineMouseMove === "function"
                                        ? (e) => {
                                            const svg = timelineSvgRef.current;
                                            if (!svg) return;
                                            const pt = svg.createSVGPoint();
                                            pt.x = e.clientX;
                                            pt.y = 0;
                                            const local = pt.matrixTransform(
                                              svg.getScreenCTM().inverse(),
                                            );
                                            const beat = getBeatFromX(local.x);
                                            onChordLineMouseMove(beat);
                                          }
                                        : undefined
                                    }
                                    onClick={
                                      typeof onChordLineClick === "function"
                                        ? (e) => {
                                            e.stopPropagation();
                                            const svg = timelineSvgRef.current;
                                            if (!svg) return;
                                            const pt = svg.createSVGPoint();
                                            pt.x = e.clientX;
                                            pt.y = 0;
                                            const local = pt.matrixTransform(
                                              svg.getScreenCTM().inverse(),
                                            );
                                            const beat = getBeatFromX(local.x);
                                            onChordLineClick(beat);
                                          }
                                        : undefined
                                    }
                                  />
                                )}
                            </>
                          )}
                        {(() => {
                          const chordsInMeasure = chords
                            .filter(
                              (c) =>
                                c.beatPosition >= measure.startBeat &&
                                c.beatPosition < measure.endBeat,
                            )
                            .sort((a, b) => a.beatPosition - b.beatPosition);
                          const chordFontSizeBase = Math.round(
                            14 * (figurenotesSize / 16),
                          );
                          const chordFontSize =
                            chordLineHeight > 0
                              ? Math.min(
                                  chordLineHeight * 0.6,
                                  chordFontSizeBase,
                                )
                              : chordFontSizeBase;
                          const chordRowTop =
                            sys.yOffset + melodyRowHeight + chordLineGap;
                          const chordY =
                            chordLineHeight > 0
                              ? chordRowTop + chordLineHeight / 2
                              : sys.yOffset + padVertical + 4;

                          if (!chordBlocksEnabled || chordLineHeight <= 0) {
                            return chordsInMeasure.map((chord) => {
                              const chordX =
                                beatContentLeft +
                                (chord.beatPosition - measure.startBeat) *
                                  beatWidth;
                              return (
                                <g key={chord.id}>
                                  <text
                                    x={chordX}
                                    y={chordY}
                                    textAnchor="start"
                                    dominantBaseline="middle"
                                    fontSize={chordFontSize}
                                    fontWeight="bold"
                                    fill="#1a1a1a"
                                    fontFamily="sans-serif"
                                  >
                                    {chord.chord}
                                  </text>
                                  {chord.figuredBass && (
                                    <text
                                      x={chordX}
                                      y={chordY + chordFontSize * 0.85}
                                      textAnchor="start"
                                      dominantBaseline="middle"
                                      fontSize={Math.round(
                                        chordFontSize * 0.75,
                                      )}
                                      fill="#555"
                                      fontFamily="serif"
                                    >
                                      {chord.figuredBass}
                                    </text>
                                  )}
                                </g>
                              );
                            });
                          }

                          const rectGap = 2;
                          const slotGap = 2;
                          const rectY = chordRowTop + 2;
                          const rectH = Math.max(0, chordLineHeight - 4);
                          const mainTextY =
                            chordRowTop + chordLineHeight * 0.45;
                          const tonesFontSize = Math.max(
                            8,
                            Math.round(chordFontSize * 0.6),
                          );
                          const figSize = Math.min(
                            chordFontSize * 0.9,
                            Math.max(6, rectH * 0.38),
                          );
                          const figGap = 2;
                          const figuresY = chordRowTop + chordLineHeight * 0.72;
                          const measureStart = measure.startBeat;
                          const measureEnd =
                            measure.endBeat ??
                            measure.startBeat + beatsInMeasure;

                          // Dynamic chord segments with optional duration:
                          // segment end = min(start + durationBeats, nextChordStart, measureEnd)
                          // fallback (no durationBeats) => nextChordStart/measureEnd.
                          const chordSpans = chordsInMeasure
                            .map((ch, idx) => {
                              const start = Number(ch.beatPosition);
                              const nextStart =
                                idx < chordsInMeasure.length - 1
                                  ? Number(
                                      chordsInMeasure[idx + 1].beatPosition,
                                    )
                                  : measureEnd;
                              const durationBeats = Number(ch.durationBeats);
                              const durationEnd =
                                Number.isFinite(durationBeats) &&
                                durationBeats > 0
                                  ? start + durationBeats
                                  : measureEnd;
                              const end = Math.max(
                                start,
                                Math.min(durationEnd, nextStart, measureEnd),
                              );
                              return { chord: ch, start, end };
                            })
                            .filter(
                              (s) =>
                                Number.isFinite(s.start) &&
                                Number.isFinite(s.end) &&
                                s.end > s.start,
                            );
                          const boundaries = (() => {
                            const points = [measureStart, measureEnd];
                            chordSpans.forEach((s) => {
                              points.push(s.start, s.end);
                            });
                            return Array.from(new Set(points))
                              .filter(
                                (p) =>
                                  Number.isFinite(p) &&
                                  p >= measureStart &&
                                  p <= measureEnd,
                              )
                              .sort((a, b) => a - b);
                          })();
                          const segments = boundaries
                            .slice(0, -1)
                            .map((start, idx) => ({
                              start,
                              end: boundaries[idx + 1],
                            }))
                            .filter((seg) => seg.end > seg.start);

                          return (
                            <g
                              key={`chord-blocks-${measureIdx}-${measure.startBeat}`}
                            >
                              {segments.map((segment, slotIndex) => {
                                const slotStart = segment.start;
                                const slotEnd = segment.end;
                                const slotChord = chordSpans
                                  .filter(
                                    (span) =>
                                      slotStart >= span.start &&
                                      slotStart < span.end,
                                  )
                                  .sort((a, b) => b.start - a.start)[0]?.chord;
                                const leftInset =
                                  slotIndex === 0 ? rectGap / 2 : slotGap / 2;
                                const rightInset =
                                  slotIndex === segments.length - 1
                                    ? rectGap / 2
                                    : slotGap / 2;
                                const startRatio =
                                  (slotStart - measureStart) / beatsInMeasure;
                                const endRatio =
                                  (slotEnd - measureStart) / beatsInMeasure;
                                const rawX =
                                  beatContentLeft + startRatio * beatContentWidth;
                                const rawW =
                                  (endRatio - startRatio) * beatContentWidth;
                                const rectX = rawX + leftInset;
                                const rectWidth = Math.max(
                                  0,
                                  rawW - leftInset - rightInset,
                                );
                                const fill = slotChord
                                  ? getChordColor(slotChord.chord)
                                  : "#e5e7eb";
                                const chordRoot = slotChord
                                  ? getChordRootLetter(slotChord.chord)
                                  : null;
                                const chordTextColor = chordRoot
                                  ? getFigurenoteTextColor(chordRoot)
                                  : "#1a1a1a";
                                const textX = rectX + 6;
                                return (
                                  <g
                                    key={`chord-block-${measureIdx}-${slotIndex}`}
                                  >
                                    <rect
                                      x={rectX}
                                      y={rectY}
                                      width={rectWidth}
                                      height={rectH}
                                      fill={fill}
                                      stroke="#111827"
                                      strokeWidth={0.8}
                                      rx={3}
                                    />
                                    {slotChord && (
                                      <>
                                        <text
                                          x={textX}
                                          y={mainTextY}
                                          textAnchor="start"
                                          dominantBaseline="middle"
                                          fontSize={chordFontSize}
                                          fontWeight="bold"
                                          fill={chordTextColor}
                                          fontFamily="sans-serif"
                                        >
                                          {slotChord.chord}
                                        </text>
                                        {chordBlocksShowTones &&
                                          (() => {
                                            const tones = getChordToneNames(
                                              slotChord.chord,
                                            );
                                            if (tones.length === 0) return null;
                                            const chordNameWidth =
                                              slotChord.chord.length *
                                              chordFontSize *
                                              CHORD_NAME_WIDTH_PER_CHAR;
                                            const gapPx = 10;
                                            const tonesTextX =
                                              textX + chordNameWidth + gapPx;
                                            const figuresStartX = tonesTextX;
                                            return (
                                              <>
                                                {tones.map((toneName, ti) => {
                                                  const toneCenterX =
                                                    figuresStartX +
                                                    ti * (figSize + figGap) +
                                                    figSize / 2;
                                                  return (
                                                    <text
                                                      key={`tone-${ti}-${toneName}`}
                                                      x={toneCenterX}
                                                      y={mainTextY}
                                                      textAnchor="middle"
                                                      dominantBaseline="middle"
                                                      fontSize={tonesFontSize}
                                                      fill={chordTextColor}
                                                      fontFamily="monospace"
                                                    >
                                                      {toneName}
                                                    </text>
                                                  );
                                                })}
                                                {tones.map((toneName, ti) => {
                                                  const { baseName, isSharp } =
                                                    parseToneName(toneName);
                                                  const shape =
                                                    getChordToneShape(
                                                      chordRoot,
                                                      ti,
                                                    );
                                                  const style = getFigureStyle(
                                                    baseName,
                                                    shape === "cross" ? 2 : 3,
                                                  );
                                                  const cx =
                                                    figuresStartX +
                                                    ti * (figSize + figGap) +
                                                    figSize / 2;
                                                  const paths =
                                                    getShapePathsByOctave(
                                                      shape === "cross" ? 2 : 3,
                                                    );
                                                  const viewScale =
                                                    figSize / 100;
                                                  const arrowLen =
                                                    figSize * 0.4;
                                                  const head = Math.max(
                                                    2,
                                                    figSize * 0.15,
                                                  );
                                                  return (
                                                    <g
                                                      key={`fig-${ti}-${toneName}`}
                                                    >
                                                      {paths.map((d, pi) => (
                                                        <path
                                                          key={pi}
                                                          d={d}
                                                          fill={style.fill}
                                                          stroke={
                                                            style.stroke ||
                                                            "none"
                                                          }
                                                          strokeWidth={
                                                            (style.strokeWidth ||
                                                              0) * viewScale
                                                          }
                                                          transform={`translate(${cx - figSize / 2}, ${figuresY - figSize / 2}) scale(${viewScale})`}
                                                          vectorEffect="non-scaling-stroke"
                                                        />
                                                      ))}
                                                      {isSharp &&
                                                        (() => {
                                                          const tipX =
                                                            cx + arrowLen / 2;
                                                          const tipY =
                                                            figuresY -
                                                            arrowLen / 2;
                                                          const stroke =
                                                            "#1a1a1a";
                                                          const strokeW =
                                                            Math.max(
                                                              1.5,
                                                              figSize * 0.08,
                                                            );
                                                          return (
                                                            <g
                                                              stroke={stroke}
                                                              fill={stroke}
                                                              strokeWidth={
                                                                strokeW
                                                              }
                                                              strokeLinecap="butt"
                                                              strokeLinejoin="miter"
                                                            >
                                                              <line
                                                                x1={
                                                                  cx -
                                                                  arrowLen / 2
                                                                }
                                                                y1={
                                                                  figuresY +
                                                                  arrowLen / 2
                                                                }
                                                                x2={tipX}
                                                                y2={tipY}
                                                              />
                                                              <polygon
                                                                points={`${tipX},${tipY} ${tipX - head},${tipY} ${tipX},${tipY + head}`}
                                                              />
                                                            </g>
                                                          );
                                                        })()}
                                                    </g>
                                                  );
                                                })}
                                              </>
                                            );
                                          })()}
                                        {slotChord.figuredBass && (
                                          <text
                                            x={rectX + rectWidth - 6}
                                            y={rectY + rectH - 3}
                                            textAnchor="end"
                                            fontSize={Math.max(
                                              8,
                                              Math.round(chordFontSize * 0.6),
                                            )}
                                            fill="#111827"
                                            fontFamily="serif"
                                          >
                                            {slotChord.figuredBass}
                                          </text>
                                        )}
                                      </>
                                    )}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })()}
                        {(() => {
                          // If a beat-slot is already "filled" by a figurenote, do not render any rest that overlaps it.
                          // This avoids the Z-rest appearing behind/over a figurshape in figurenotation mode.
                          const playedIntervals = measure.notes
                            .filter((n) => !n?.isRest)
                            .map((n) => {
                              const start = Number(n.beat ?? 0);
                              const dur = Math.max(0, Number(n.duration ?? 0));
                              return { start, end: start + dur };
                            })
                            .filter(
                              (iv) =>
                                Number.isFinite(iv.start) &&
                                Number.isFinite(iv.end) &&
                                iv.end > iv.start,
                            );
                          const restOverlapsPlayed = (restNote) => {
                            const start = Number(restNote?.beat ?? 0);
                            const dur = Math.max(
                              0,
                              Number(restNote?.duration ?? 0),
                            );
                            const end = start + dur;
                            if (
                              !Number.isFinite(start) ||
                              !Number.isFinite(end) ||
                              end <= start
                            )
                              return false;
                            // strict overlap on timeline: [a,b) intersects [c,d)
                            return playedIntervals.some(
                              (iv) => start < iv.end && end > iv.start,
                            );
                          };

                          // Shorter-than-quarter notes in the same beat: place so that
                          // right edge of one shape + 1px gap + left edge of next shape (repeated for every short note).
                          const compactCenters = new Map();
                          const figureSizeByNoteIndex = new Map();
                          const notesByBeat = new Map();
                          measure.notes.forEach((note, idx) => {
                            if (note.isRest) return;
                            const durLabel = note.durationLabel || "1/4";
                            const durBeats =
                              typeof note.duration === "number"
                                ? note.duration
                                : getDurationInBeats(durLabel);
                            if (durBeats >= 1) return; // only shorter than quarter
                            const beatInMeasure = note.beat - measure.startBeat;
                            const beatIndex = Math.floor(beatInMeasure);
                            if (!notesByBeat.has(beatIndex))
                              notesByBeat.set(beatIndex, []);
                            const scale = getFigureScaleForDuration(durLabel);
                            const figureSize = figureSizeBaseForMeasure * scale;
                            figureSizeByNoteIndex.set(idx, figureSize);
                            notesByBeat
                              .get(beatIndex)
                              .push({ note, idx, figureSize });
                          });
                          notesByBeat.forEach((group, beatIndex) => {
                            if (!group || group.length <= 1) return;
                            group.sort(
                              (a, b) =>
                                (a.note.beat ?? 0) - (b.note.beat ?? 0) ||
                                a.idx - b.idx,
                            );
                            const beatLeft =
                              beatContentLeft + beatIndex * beatWidth;
                            let leftEdge = beatLeft + 1; // left edge of first short note in this beat
                            group.forEach(({ idx, figureSize }) => {
                              const center = leftEdge + figureSize / 2;
                              compactCenters.set(idx, center);
                              const rightEdge = leftEdge + figureSize;
                              leftEdge = rightEdge + 1; // 1px gap, then left edge of next shape
                            });
                          });
                          const getFigureCenterXForNote = (note, idx) => {
                            const defaultCenterX = getNoteSlotCenterX(note);
                            const baseCenter = compactCenters.has(idx)
                              ? compactCenters.get(idx)
                              : defaultCenterX;
                            const figureSize =
                              figureSizeByNoteIndex.get(idx) ??
                              figureSizeBaseForMeasure;
                            const halfFigure = figureSize / 2;
                            const minCenter = beatContentLeft + halfFigure;
                            const maxCenter =
                              beatContentLeft + beatContentWidth - halfFigure;
                            if (minCenter > maxCenter) return baseCenter;
                            return Math.max(minCenter, Math.min(baseCenter, maxCenter));
                          };
                          const beamGroups = figurenotesStems
                            ? computeBeamGroups(
                                measure.notes,
                                measure.startBeat,
                                timeSignature,
                              )
                            : [];
                          const beamInfoByNoteIndex = new Map();
                          const beamGapPx = 6;
                          beamGroups.forEach((group) => {
                            const levelByIdx = new Map();
                            const stemXByIdx = new Map();
                            for (let idx = group.start; idx <= group.end; idx += 1) {
                              const n = measure.notes[idx];
                              const level = getFlagCountForDuration(
                                n?.durationLabel || "1/4",
                              );
                              levelByIdx.set(idx, level);
                              const fs =
                                figureSizeByNoteIndex.get(idx) ??
                                figureSizeBaseForMeasure;
                              const cx = getFigureCenterXForNote(n, idx);
                              stemXByIdx.set(idx, cx + fs / 2 + 1);
                            }
                            const segments = [];
                            for (let beamLevel = 1; beamLevel <= 3; beamLevel += 1) {
                              for (
                                let idx = group.start;
                                idx < group.end;
                                idx += 1
                              ) {
                                const leftLevel = levelByIdx.get(idx) ?? 0;
                                const rightLevel = levelByIdx.get(idx + 1) ?? 0;
                                if (
                                  leftLevel >= beamLevel &&
                                  rightLevel >= beamLevel
                                ) {
                                  segments.push({
                                    x1: stemXByIdx.get(idx),
                                    x2: stemXByIdx.get(idx + 1),
                                    y:
                                      sys.yOffset +
                                      centerY -
                                      26 -
                                      (beamLevel - 1) * beamGapPx,
                                  });
                                }
                              }
                            }
                            for (let idx = group.start; idx <= group.end; idx += 1) {
                              beamInfoByNoteIndex.set(idx, {
                                group,
                                isStart: idx === group.start,
                                segments:
                                  idx === group.start ? segments : undefined,
                              });
                            }
                          });

                          return measure.notes.map((note, noteIdx) => {
                            const dur = note.durationLabel || "1/4";
                            const scale = getFigureScaleForDuration(dur);
                            const figureSize = figureSizeBaseForMeasure * scale;
                            const figureCenterX = getFigureCenterXForNote(
                              note,
                              noteIdx,
                            );
                            const noteWidth = getRestBoxWidth(note);

                            let globalNoteIndex = 0;
                            for (let i = 0; i < measureIdx; i++)
                              globalNoteIndex +=
                                instMeasures[i]?.notes?.length ?? 0;
                            globalNoteIndex += noteIdx;
                            // Anchor every figure shape (short and long) by its bottom
                            // edge to the beat-box bottom line.
                            const noteY = beatBoxBottomY - figureSize / 2;
                            const canDragBeat = canDragBeatOnThisRow;
                            const noteGroupProps = {
                              onClick: (e) => {
                                e.stopPropagation();
                                if (combinedRows)
                                  onNoteClick?.(globalNoteIndex, staffSi);
                                else onNoteClick?.(globalNoteIndex);
                              },
                              onMouseDown: (e) => {
                                if (
                                  typeof onNoteMouseDown === "function" &&
                                  e.shiftKey
                                ) {
                                  if (combinedRows)
                                    onNoteMouseDown(
                                      globalNoteIndex,
                                      e,
                                      staffSi,
                                    );
                                  else onNoteMouseDown(globalNoteIndex, e);
                                  return;
                                }
                                if (canDragBeat && e.button === 0) {
                                  e.stopPropagation();
                                  setNoteBeatDrag({
                                    noteIndex: globalNoteIndex,
                                    startClientX: e.clientX,
                                  });
                                  return;
                                }
                                if (typeof onNoteMouseDown === "function") {
                                  if (combinedRows)
                                    onNoteMouseDown(
                                      globalNoteIndex,
                                      e,
                                      staffSi,
                                    );
                                  else onNoteMouseDown(globalNoteIndex, e);
                                }
                              },
                              onMouseEnter:
                                typeof onNoteMouseEnter === "function"
                                  ? (e) =>
                                      combinedRows
                                        ? onNoteMouseEnter(
                                            globalNoteIndex,
                                            e,
                                            staffSi,
                                          )
                                        : onNoteMouseEnter(globalNoteIndex, e)
                                  : undefined,
                              style: {
                                cursor:
                                  onNoteClick || onNoteMouseDown || canDragBeat
                                    ? "pointer"
                                    : undefined,
                              },
                            };
                            if (note.isRest) {
                              // Ära kuva automaatselt tekitatud "tühja koha" pause (MusicXML jms puhul).
                              // Need tulevad normalizeNotesToGlobalTimeline → fillGapWithRests kaudu
                              // ning nende id algab prefiksiga "rest-". Figuurnotatsioonis soovime,
                              // et pausid tekiks ainult uue takti lisamisel või kasutaja enda valikul.
                              const isAutoGapRest =
                                typeof note.id === "string" &&
                                note.id.startsWith("rest-");
                              if (isAutoGapRest) return null;
                              // Kui samas ajavahemikus on juba figurshape/noot, loe see slot täidetuks ja ära joonista pausi.
                              if (restOverlapsPlayed(note)) return null;
                              const drawRestGlyph = shouldDrawRestGlyph(
                                measure.notes,
                                noteIdx,
                              );
                              const restLabelY = sys.yOffset + centerY + 20;
                              const restSyllable =
                                drawRestGlyph && showRhythmSyllables
                                  ? getRhythmSyllableForNote(note)
                                  : "";
                              const restHitRect = (zSize) => (
                                <rect
                                  x={figureCenterX - noteWidth / 2}
                                  y={sys.yOffset + centerY - zSize * 0.35}
                                  width={noteWidth}
                                  height={Math.max(figureSize * 1.4, zSize * 1.5)}
                                  fill="transparent"
                                />
                              );
                              if (!figurenotesStems) {
                                const zSize = Math.min(noteWidth * 0.55, 26);
                                if (!drawRestGlyph) {
                                  return (
                                    <g key={noteIdx} {...noteGroupProps}>
                                      {restHitRect(zSize)}
                                    </g>
                                  );
                                }
                                return (
                                  <g key={noteIdx} {...noteGroupProps}>
                                    <text
                                      x={figureCenterX}
                                      y={sys.yOffset + centerY + zSize * 0.2}
                                      textAnchor="middle"
                                      fontSize={zSize}
                                      fontWeight="bold"
                                      fill="#1a1a1a"
                                      fontFamily="serif"
                                    >
                                      Z
                                    </text>
                                    {restSyllable && (
                                      <RhythmSyllableLabel
                                        x={figureCenterX}
                                        y={restLabelY}
                                        text={restSyllable}
                                        staffSpace={10}
                                      />
                                    )}
                                  </g>
                                );
                              }
                              if (!drawRestGlyph) {
                                const zSize = Math.min(noteWidth * 0.55, 26);
                                return (
                                  <g key={noteIdx} {...noteGroupProps}>
                                    {restHitRect(zSize)}
                                  </g>
                                );
                              }
                              return (
                                <g key={noteIdx} {...noteGroupProps}>
                                  {restSyllable && (
                                    <RhythmSyllableLabel
                                      x={figureCenterX}
                                      y={restLabelY}
                                      text={restSyllable}
                                      staffSpace={10}
                                    />
                                  )}
                                </g>
                              );
                            }
                            const labelFontSize = Math.max(
                              8,
                              Math.round(figureSize * 0.625),
                            );
                            const labelY =
                              noteY + figureSize * 0.5 + labelFontSize;
                            const bandLeft = figureCenterX - noteWidth / 2;
                            const bandY = sys.yOffset + padVertical + 2;
                            const bandH =
                              melodyRowHeight - 2 * (padVertical + 2);
                            const bandColor = getFigureColor(note.pitch);
                            const isDarkTheme = !!themeColors?.isDark;
                            const pitchLabel = String(note.pitch || "")
                              .toUpperCase()
                              .replace("H", "B");
                            const isGNote = pitchLabel.startsWith("G");
                            const durLabel = note.durationLabel || "1/4";
                            const noteDurationBeats =
                              typeof note.duration === "number"
                                ? note.duration
                                : getDurationInBeats(durLabel);
                            const isLongerThanQuarter = noteDurationBeats > 1;
                            const showBand =
                              isDarkTheme && isGNote && isLongerThanQuarter;
                            /* Long-duration rectangle: from center of figure to end of last beat (e.g. half note → end of 2nd beat). */
                            const endBeat = Math.min(
                              note.beat + noteDurationBeats,
                              measure.endBeat ??
                                measure.startBeat + beatsInMeasure,
                            );
                            const longRectEndX =
                              durLabel === "1/2" || durLabel === "1/1"
                                ? Math.min(
                                    beatContentLeft + beatContentWidth,
                                    beatContentLeft +
                                      (endBeat - measure.startBeat) * beatWidth,
                                  )
                                : null;
                            /* Laulusõnad: vahe (gap) = lauluteksti fondi suurus (lyricFontSize); Cmd/Ctrl+L režiim loeb seda seadest. */
                            const lyricGapTop = sys.yOffset + melodyRowHeight;
                            const hasChordRow = chordLineHeight > 0;
                            const fs = Math.max(1, Number(lyricFontSize)) || 12;
                            const fallbackLyricBandTop =
                              sys.yOffset +
                              melodyRowHeight +
                              Math.max(0, lyricReserveHeight * 0.08);
                            const lyricBaseY = hasChordRow
                              ? lyricGapTop + fs * 0.5 + (lyricLineYOffset || 0)
                              : fallbackLyricBandTop + fs * 0.9 + (lyricLineYOffset || 0);
                            const lyricStepY = hasChordRow ? fs : fs * 1.1;
                            const isLyricActive =
                              typeof activeLyricNoteIndex === "number" &&
                              activeLyricNoteIndex === globalNoteIndex;
                            return (
                              <g key={noteIdx} {...noteGroupProps}>
                                {isLyricActive && (
                                  <rect
                                    x={figureCenterX - noteWidth * 0.6}
                                    y={lyric1Y - fs * 1.2}
                                    width={noteWidth * 1.2}
                                    height={fs * 1.8}
                                    rx={4}
                                    fill="rgba(59,130,246,0.12)"
                                    stroke="#2563eb"
                                    strokeWidth={1}
                                  />
                                )}
                                {showBand && (
                                  <rect
                                    x={bandLeft}
                                    y={bandY}
                                    width={noteWidth}
                                    height={bandH}
                                    fill={bandColor}
                                    opacity="0.2"
                                    rx="2"
                                  />
                                )}
                                {renderFigurenote(
                                  note,
                                  figureCenterX,
                                  noteY,
                                  globalNoteIndex,
                                  noteWidth,
                                  figureSize,
                                  longRectEndX,
                                  beamInfoByNoteIndex.get(noteIdx) ?? null,
                                )}
                                {Array.from({ length: 10 }, (_, lyricIdx) => {
                                  const lyricKey = lyricIdx === 0 ? "lyric" : `lyric${lyricIdx + 1}`;
                                  const lyricColorKey = lyricIdx === 0 ? "lyricColor" : `lyric${lyricIdx + 1}Color`;
                                  const lyricText = note?.[lyricKey];
                                  if (lyricText == null || String(lyricText).trim() === "") return null;
                                  return (
                                    <text
                                      key={lyricKey}
                                      x={figureCenterX}
                                      y={lyricBaseY + lyricStepY * lyricIdx}
                                      textAnchor="middle"
                                      fontSize={fs}
                                      fill={note?.[lyricColorKey] || "#000000"}
                                      fontFamily={lyricFontFamily}
                                      fontStyle={lyricItalic ? "italic" : undefined}
                                      textDecoration={lyricUnderline ? "underline" : undefined}
                                      fontWeight={lyricBold ? "700" : Math.max(100, Math.min(900, Number(lyricWeight) || 400))}
                                    >
                                      {lyricText}
                                    </text>
                                  );
                                })}
                              </g>
                            );
                          });
                        })()}
                      </g>
                    );
                  })}
                  {combinedRows &&
                    (() => {
                      const measureBar = layoutSourceMeasures[measureIdx];
                      if (!measureBar) return null;
                      const prevBar =
                        j > 0
                          ? layoutSourceMeasures[sys.measureIndices[j - 1]]
                          : null;
                      const nextBar =
                        j < sys.measureIndices.length - 1
                          ? layoutSourceMeasures[sys.measureIndices[j + 1]]
                          : null;
                      const leftR = getLeftBarlineRepeatRender({
                        measureIndexInSystem: j,
                        measure: measureBar,
                        prevMeasureInSystem: prevBar,
                      });
                      const drawEnd = shouldDrawRepeatEndGlyphOnRight(
                        measureBar,
                        nextBar,
                      );
                      const barLineTopY = sys.yOffset + padVertical;
                      const barLineBottomY =
                        sys.yOffset +
                        (nStaffRows - 1) * rowStepPx +
                        melodyRowHeight -
                        padVertical;
                      const repeatSmuflPerRow = Array.from(
                        { length: nStaffRows },
                        (_, rowIdx) => {
                          const rowTopY =
                            sys.yOffset + rowIdx * rowStepPx + padVertical;
                          const rowBottomY =
                            sys.yOffset +
                            rowIdx * rowStepPx +
                            melodyRowHeight -
                            padVertical;
                          const rowFrame = getBarlineFrame({
                            barlineX: measureX,
                            barTopY: rowTopY,
                            barBottomY: rowBottomY,
                            staffSpace: 10 * notationScale,
                          });
                          return {
                            topY: rowTopY,
                            bottomY: rowBottomY,
                            staffSpace: rowFrame.staffSpace,
                          };
                        },
                      );
                      const isRightBarlineOfSystem =
                        measureIdx ===
                        sys.measureIndices[sys.measureIndices.length - 1];
                      const isLastMeasureOfScore =
                        measureIdx === layoutSourceMeasures.length - 1;
                      const showFinalBar =
                        (isLastMeasureOfScore || measureBar.barlineFinal) &&
                        !measureBar.repeatEnd;
                      const xRight = measureX + measureWidth;
                      const finalGeom = showFinalBar
                        ? getFinalDoubleBarlineGeometry({
                            measureRightX: xRight,
                            notationScale,
                            figurenotesSize,
                            yOffset: sys.yOffset,
                            melodyRowHeight,
                            padVertical,
                            chordLineHeight,
                            chordLineGap,
                            combinedStaffRowCount: nStaffRows,
                            combinedRowStepPx: rowStepPx,
                          })
                        : null;
                      const rightBarFrame = getBarlineFrame({
                        barlineX: xRight,
                        barTopY: barLineTopY,
                        barBottomY: barLineBottomY,
                        staffSpace: 10 * notationScale,
                      });
                      const repeatRightX = getRepeatRightGlyphX({
                        barlineX: rightBarFrame.x,
                        staffSpace: rightBarFrame.staffSpace,
                      }) - rightBarFrame.staffSpace * FIGURE_REPEAT_RIGHT_EXTRA_INSET_STAFF_SPACES;
                      const anchoredRepeatRightX = drawEnd
                        ? rightBarFrame.x
                        : repeatRightX;
                      return (
                        <>
                          {leftR.variant === "both" ? (
                            repeatSmuflPerRow.map((rp, rowIdx) => (
                              <g key={`repeat-left-both-${measureIdx}-${rowIdx}`}>
                                {renderAnchoredRepeatBarline({
                                  x: measureX,
                                  topY: rp.topY,
                                  bottomY: rp.bottomY,
                                  staffSpace: rp.staffSpace,
                                  type: "both",
                                })}
                              </g>
                            ))
                          ) : leftR.variant === "start" ? (
                            repeatSmuflPerRow.map((rp, rowIdx) => (
                              <g key={`repeat-left-start-${measureIdx}-${rowIdx}`}>
                                {renderAnchoredRepeatBarline({
                                  x: measureX,
                                  topY: rp.topY,
                                  bottomY: rp.bottomY,
                                  staffSpace: rp.staffSpace,
                                  type: "start",
                                })}
                              </g>
                            ))
                          ) : leftR.variant === "barline" ? (
                            <line
                              x1={measureX}
                              y1={barLineTopY}
                              x2={measureX}
                              y2={barLineBottomY}
                              stroke="#1a1a1a"
                              strokeWidth={barLineWidth}
                            />
                          ) : null}
                          {(leftR.variant === "start" || leftR.variant === "both") &&
                            onSelectRepeatMark && (
                              <g
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRepeatMark(measureIdx, "repeatStart", { toggle: !!(e.metaKey || e.ctrlKey) });
                                }}
                                style={{ cursor: "pointer" }}
                                pointerEvents="auto"
                              >
                                {isRepeatMarkSelected(measureIdx, "repeatStart") && (
                                  <rect
                                    x={measureX - rightBarFrame.staffSpace * 2}
                                    y={barLineTopY - rightBarFrame.staffSpace * 0.5}
                                    width={rightBarFrame.staffSpace * 4}
                                    height={
                                      barLineBottomY -
                                      barLineTopY +
                                      rightBarFrame.staffSpace
                                    }
                                    fill="#93c5fd"
                                    opacity="0.32"
                                    rx={3}
                                  />
                                )}
                                <rect
                                  x={measureX - rightBarFrame.staffSpace * 2}
                                  y={barLineTopY - rightBarFrame.staffSpace}
                                  width={rightBarFrame.staffSpace * 4}
                                  height={
                                    barLineBottomY -
                                    barLineTopY +
                                    rightBarFrame.staffSpace * 2
                                  }
                                  fill="transparent"
                                />
                              </g>
                            )}
                          {drawEnd ? (
                            repeatSmuflPerRow.map((rp, rowIdx) => (
                              <g key={`repeat-right-${measureIdx}-${rowIdx}`}>
                                {renderAnchoredRepeatBarline({
                                  x: anchoredRepeatRightX,
                                  topY: rp.topY,
                                  bottomY: rp.bottomY,
                                  staffSpace: rp.staffSpace,
                                  type: "end",
                                })}
                                {debugRepeatOverlay && (
                                  <>
                                    <line
                                      x1={xRight}
                                      y1={rp.topY}
                                      x2={xRight}
                                      y2={rp.bottomY}
                                      stroke="#ef4444"
                                      strokeWidth={1}
                                      strokeDasharray="3 2"
                                    />
                                    <line
                                      x1={anchoredRepeatRightX}
                                      y1={rp.topY}
                                      x2={anchoredRepeatRightX}
                                      y2={rp.bottomY}
                                      stroke="#0ea5e9"
                                      strokeWidth={1}
                                      strokeDasharray="3 2"
                                    />
                                    {rowIdx === 0 && (
                                      <>
                                        <text
                                          x={xRight - 2}
                                          y={rp.topY - 4}
                                          textAnchor="end"
                                          fontSize={10}
                                          fill="#dc2626"
                                          fontFamily="sans-serif"
                                        >
                                          {`bar ${xRight.toFixed(1)}`}
                                        </text>
                                        <text
                                          x={anchoredRepeatRightX + 2}
                                          y={rp.topY - 4}
                                          textAnchor="start"
                                          fontSize={10}
                                          fill="#0369a1"
                                          fontFamily="sans-serif"
                                        >
                                          {`rep ${anchoredRepeatRightX.toFixed(1)} Δ ${(anchoredRepeatRightX - xRight).toFixed(1)}`}
                                        </text>
                                      </>
                                    )}
                                  </>
                                )}
                              </g>
                            ))
                          ) : (
                            isRightBarlineOfSystem &&
                            !showFinalBar && (
                              <line
                                x1={xRight}
                                y1={barLineTopY}
                                x2={xRight}
                                y2={barLineBottomY}
                                stroke="#1a1a1a"
                                strokeWidth={barLineWidth}
                              />
                            )
                          )}
                          {drawEnd && onSelectRepeatMark && (
                            <g
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectRepeatMark(measureIdx, "repeatEnd", { toggle: !!(e.metaKey || e.ctrlKey) });
                              }}
                              style={{ cursor: "pointer" }}
                              pointerEvents="auto"
                            >
                              {isRepeatMarkSelected(measureIdx, "repeatEnd") && (
                                <rect
                                  x={
                                    Math.min(anchoredRepeatRightX, xRight) -
                                    rightBarFrame.staffSpace * 2
                                  }
                                  y={barLineTopY - rightBarFrame.staffSpace * 0.5}
                                  width={
                                    Math.abs(xRight - anchoredRepeatRightX) +
                                    rightBarFrame.staffSpace * 4
                                  }
                                  height={
                                    barLineBottomY -
                                    barLineTopY +
                                    rightBarFrame.staffSpace
                                  }
                                  fill="#93c5fd"
                                  opacity="0.32"
                                  rx={3}
                                />
                              )}
                              <rect
                                x={
                                  Math.min(anchoredRepeatRightX, xRight) -
                                  rightBarFrame.staffSpace * 2
                                }
                                y={barLineTopY - rightBarFrame.staffSpace}
                                width={
                                  Math.abs(xRight - anchoredRepeatRightX) +
                                  rightBarFrame.staffSpace * 4
                                }
                                height={
                                  barLineBottomY -
                                  barLineTopY +
                                  rightBarFrame.staffSpace * 2
                                }
                                fill="transparent"
                              />
                            </g>
                          )}
                          {showFinalBar && finalGeom && (
                            <g>
                              <line
                                x1={finalGeom.thinX}
                                y1={finalGeom.topY}
                                x2={finalGeom.thinX}
                                y2={finalGeom.bottomY}
                                stroke="#1a1a1a"
                                strokeWidth={finalGeom.thinW}
                              />
                              <line
                                x1={finalGeom.thickX}
                                y1={finalGeom.topY}
                                x2={finalGeom.thickX}
                                y2={finalGeom.bottomY}
                                stroke="#1a1a1a"
                                strokeWidth={finalGeom.thickW}
                              />
                            </g>
                          )}
                          {(() => {
                            if (!onSelectRepeatMark) return null;
                            const markerY =
                              sys.yOffset +
                              padVertical -
                              Math.max(12, 12 * notationScale);
                            const markers = [];
                            if (measureBar.segno) markers.push({ key: "segno", label: "segno", glyph: SMUFL_GLYPH.segno });
                            if (measureBar.coda) markers.push({ key: "coda", label: "coda", glyph: SMUFL_GLYPH.coda });
                            if (measureBar.volta1) markers.push({ key: "volta1", label: "1." });
                            if (measureBar.volta2) markers.push({ key: "volta2", label: "2." });
                            if (markers.length === 0) return null;
                            const step = Math.max(20, 20 * notationScale);
                            const fontSize = Math.max(12, 16 * notationScale);
                            return markers.map((mk, idx) => {
                              const x = measureX + 6 + idx * step;
                              const selected = isRepeatMarkSelected(measureIdx, mk.key);
                              return (
                                <g
                                  key={`fig-marker-combined-${measureIdx}-${mk.key}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectRepeatMark(measureIdx, mk.key, {
                                      toggle: !!(e.metaKey || e.ctrlKey),
                                    });
                                  }}
                                  style={{ cursor: "pointer" }}
                                  pointerEvents="auto"
                                >
                                  {selected && (
                                    <rect
                                      x={x - fontSize * 0.6}
                                      y={markerY - fontSize * 0.7}
                                      width={fontSize * 1.2}
                                      height={fontSize * 1.2}
                                      fill="#93c5fd"
                                      opacity="0.32"
                                      rx={3}
                                    />
                                  )}
                                  {mk.glyph ? (
                                    <SmuflGlyph
                                      x={x}
                                      y={markerY}
                                      glyph={mk.glyph}
                                      fontSize={fontSize}
                                      fill="#1a1a1a"
                                    />
                                  ) : (
                                    <text
                                      x={x}
                                      y={markerY}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      fontSize={fontSize * 0.85}
                                      fontFamily="sans-serif"
                                      fill="#1a1a1a"
                                    >
                                      {mk.label}
                                    </text>
                                  )}
                                  <rect
                                    x={x - fontSize * 0.6}
                                    y={markerY - fontSize * 0.7}
                                    width={fontSize * 1.2}
                                    height={fontSize * 1.2}
                                    fill="transparent"
                                  />
                                </g>
                              );
                            });
                          })()}
                        </>
                      );
                    })()}
                  })}
                </g>
              );
            });
            })()}
            {/* Fallback: draw final double bar at end of score if last measure is in this system (in case it was skipped in the loop). */}
            {Array.isArray(layoutSourceMeasures) &&
              layoutSourceMeasures.length > 0 &&
              (() => {
                const lastIdx = layoutSourceMeasures.length - 1;
                const lastMeasure = layoutSourceMeasures[lastIdx];
                if (lastMeasure?.repeatEnd) return null;
                const j = sys.measureIndices.indexOf(lastIdx);
                if (j < 0) return null;
                const mw =
                  sys.measureWidths ??
                  sys.measureIndices.map(
                    () => sys.measureWidth ?? beatsPerMeasure * 80,
                  );
                const mwDefault = sys.measureWidth ?? beatsPerMeasure * 80;
                const xRight =
                  marginLeft +
                  mw.slice(0, j + 1).reduce((a, _b, idxInSlice) => {
                    const bi = mw[idxInSlice] ?? mwDefault;
                    const li = computeRepeatLaneWidths({
                      sys,
                      layoutSourceMeasures,
                      measureIndexInSystem: idxInSlice,
                      notationScale,
                    });
                    return a + bi + li.total;
                  }, 0);
                const fg = getFinalDoubleBarlineGeometry({
                  measureRightX: xRight,
                  notationScale,
                  figurenotesSize,
                  yOffset: sys.yOffset,
                  melodyRowHeight,
                  padVertical,
                  chordLineHeight,
                  chordLineGap,
                  combinedStaffRowCount: combinedRows ? instruments.length : 1,
                  combinedRowStepPx: combinedRows ? rowStepPx : 0,
                });
                return (
                  <g>
                    <line
                      x1={fg.thinX}
                      y1={fg.topY}
                      x2={fg.thinX}
                      y2={fg.bottomY}
                      stroke="#1a1a1a"
                      strokeWidth={fg.thinW}
                    />
                    <line
                      x1={fg.thickX}
                      y1={fg.topY}
                      x2={fg.thickX}
                      y2={fg.bottomY}
                      stroke="#1a1a1a"
                      strokeWidth={fg.thickW}
                    />
                  </g>
                );
              })()}
            </g>
          </g>
        );
      })}
    </>
  );
}
