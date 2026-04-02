import React, { useMemo } from 'react';
import { computeBeamGroups, computeBeamGeometry } from '../notation/BeamCalculation';
import {
  getBeamGap,
  getBeamThickness,
  getNoteheadRx,
  getStemLength,
  getStemThickness,
} from '../notation/StaffConstants';
import { getGlyphFontSize } from '../notation/musescoreStyle';
import { RHYTHM_PATTERN_SEGMENTS } from '../notation/rhythmPatternSpecs';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH } from '../notation/smufl/glyphs';

const ICON_STAFF_SPACE = 5;
const TIME_SIG = { beats: 4, beatUnit: 4 };
const FILL = 'currentColor';

function buildNotesFromSegments(segments) {
  let beat = 0;
  return segments.map((seg) => {
    const n = {
      durationLabel: seg.durationLabel,
      duration: seg.duration,
      isRest: false,
      beat,
      isDotted: false,
      ...(seg.beamGroupId != null ? { beamGroupId: seg.beamGroupId } : {}),
      ...(seg.tuplet ? { tuplet: seg.tuplet } : {}),
    };
    beat += seg.duration;
    return n;
  });
}

function layoutNoteXs(notes, contentWidthPx) {
  const total = notes.reduce((s, n) => s + n.duration, 0) || 1;
  const xs = [];
  let acc = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const center = acc + n.duration / 2;
    xs.push(-contentWidthPx / 2 + (center / total) * contentWidthPx);
    acc += n.duration;
  }
  return xs;
}

/**
 * Rütmimustri ikoon: sama SMuFL noodipea + vars + talad + (triool) märgis kui partituuril.
 */
export function BeamedRhythmPatternIcon({ pattern }) {
  const svg = useMemo(() => {
    const segments = RHYTHM_PATTERN_SEGMENTS[pattern];
    if (!segments?.length) return null;
    const staffSpace = ICON_STAFF_SPACE;
    const notes = buildNotesFromSegments(segments);
    const middleLineY = 0;
    const noteCys = notes.map(() => middleLineY);
    const contentW = Math.max(14, segments.length * 3.2) * staffSpace * 0.22;
    const noteXs = layoutNoteXs(notes, contentW);
    const stemUp = true;
    const beamGroups = computeBeamGroups(notes, 0, TIME_SIG).map((gr) => {
      const geom = computeBeamGeometry(gr, notes, noteXs, noteCys, stemUp, staffSpace);
      return { ...gr, ...geom, noteXs };
    });
    const getBeamGroup = (i) => beamGroups.find((g) => i >= g.start && i <= g.end);

    const rx = getNoteheadRx(staffSpace);
    const defaultStemLen = getStemLength(staffSpace);
    const stemStrokeW = getStemThickness(staffSpace);
    const glyphFontSize = getGlyphFontSize(staffSpace);
    const beamThick = getBeamThickness(staffSpace);
    const beamGap = getBeamGap(staffSpace);
    const beamOffset = beamThick + beamGap;

    const headEls = [];
    const stemEls = [];
    const beamEls = [];
    const drawnBeamStarts = new Set();

    for (let i = 0; i < notes.length; i++) {
      const noteX = noteXs[i];
      const cy = noteCys[i];
      const beamGroup = getBeamGroup(i);
      const stemLen = beamGroup ? beamGroup.stemLengths[i - beamGroup.start] ?? defaultStemLen : defaultStemLen;
      const stemX = noteX + rx - stemStrokeW / 2;
      const stemY2 = cy - stemLen;

      headEls.push(
        <SmuflGlyph
          key={`nh-${i}`}
          x={noteX}
          y={cy}
          glyph={SMUFL_GLYPH.noteheadBlack}
          fontSize={glyphFontSize}
          fill={FILL}
        />
      );
      stemEls.push(
        <line
          key={`st-${i}`}
          x1={stemX}
          y1={cy}
          x2={stemX}
          y2={stemY2}
          stroke={FILL}
          strokeWidth={stemStrokeW}
          strokeLinecap="butt"
        />
      );

      if (beamGroup && i === beamGroup.start && !drawnBeamStarts.has(beamGroup.start)) {
        drawnBeamStarts.add(beamGroup.start);
        const dir = beamGroup.stemUp ? -1 : 1;
        const y1 = beamGroup.beamY1;
        const y2 = beamGroup.beamY2;
        for (let b = beamGroup.numBeams - 1; b >= 0; b--) {
          let xL = beamGroup.xLeft;
          let xR = beamGroup.xRight;
          if (b >= 1 && beamGroup.beamLevels && beamGroup.noteXs) {
            const levels = beamGroup.beamLevels;
            const idxMin = levels.findIndex((lev) => lev >= b + 1);
            const idxMax = levels.length - 1 - [...levels].reverse().findIndex((lev) => lev >= b + 1);
            if (idxMin >= 0 && idxMax >= 0) {
              xL = beamGroup.noteXs[idxMin];
              xR = beamGroup.noteXs[idxMax];
            }
          }
          const dy = b * beamOffset * dir;
          beamEls.push(
            <line
              key={`bm-${beamGroup.start}-${b}`}
              x1={xL}
              y1={y1 + dy}
              x2={xR}
              y2={y2 + dy}
              stroke={FILL}
              strokeWidth={beamThick}
              strokeLinecap="butt"
            />
          );
        }
      }
    }

    const staffTop = -2 * staffSpace;
    const staffBottom = 2 * staffSpace;
    const extTop = Math.min(
      staffTop,
      ...beamGroups.map((g) => Math.min(g.beamY1, g.beamY2) - g.numBeams * beamOffset)
    );
    const pad = staffSpace * 1.2;
    const vbMinY = extTop - pad;
    const vbMaxY = staffBottom + staffSpace * 2.2;
    const vbHalfW = contentW / 2 + staffSpace * 2;

    const staffLines = [-2, -1, 0, 1, 2].map((k) => (
      <line
        key={`sl-${k}`}
        x1={-vbHalfW}
        y1={k * staffSpace}
        x2={vbHalfW}
        y2={k * staffSpace}
        stroke={FILL}
        strokeOpacity={0.22}
        strokeWidth={Math.max(0.35, staffSpace * 0.11)}
      />
    ));

    const isTriplet = pattern === 'triplet-8' || pattern === 'triplet-4';
    const tripletMark = isTriplet ? (
      <text
        x={0}
        y={vbMinY + staffSpace * 0.85}
        textAnchor="middle"
        fontSize={staffSpace * 1.15}
        fontWeight="bold"
        fill={FILL}
        fontFamily="system-ui, sans-serif"
      >
        3
      </text>
    ) : null;

    return (
      <svg
        viewBox={`${-vbHalfW} ${vbMinY} ${vbHalfW * 2} ${vbMaxY - vbMinY}`}
        className="w-5 h-5 shrink-0"
        aria-hidden="true"
      >
        {staffLines}
        {headEls}
        {stemEls}
        {beamEls}
        {tripletMark}
      </svg>
    );
  }, [pattern]);

  if (!svg) return null;
  return <span className="inline-flex items-center text-amber-900">{svg}</span>;
}
