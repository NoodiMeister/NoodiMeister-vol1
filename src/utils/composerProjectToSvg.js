/**
 * Noodigraafika (.nm) projekt → SVG kujundaja plokiks.
 * Figuurnotatsioon: beat-boxid, löögivõre, figuurid (värv+kuju), pausid, pikad kestused.
 */

import { calculateLayout, FIGURE_ROW_HEIGHT, PAGE_DIMENSIONS } from '../layout/LayoutEngine';
import { LAYOUT } from '../layout/LayoutManager';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';
import { getShapePathsByOctave, getFigureColor, getFigureStyle } from '../constants/FigureNotesLibrary';
import { computeBeamGroups } from '../notation/BeamCalculation';
import { shouldDrawRestGlyph } from '../notation/restGlyphDedupe';

const NOTATION_SIZE_REF = 75;

function esc(v) {
  return String(v ?? '').replace(/[<>&"]/g, (ch) => {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    return '&quot;';
  });
}

export function isFigurenotesProject(project) {
  return project?.notationStyle === 'FIGURENOTES'
    || project?.notationMode === 'figurenotes'
    || project?.gridOnlyMode === true;
}

export function durationLabelToQuarterBeats(durationLabel) {
  const direct = Number(durationLabel);
  if (Number.isFinite(direct) && direct > 0 && !String(durationLabel).includes('/')) return direct;
  const denom = parseInt(String(durationLabel || '1/4').split('/')[1], 10) || 4;
  return 4 / denom;
}

export function noteDurationInQuarterBeats(note) {
  const direct = Number(note?.duration);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const base = durationLabelToQuarterBeats(note?.durationLabel || '1/4');
  return note?.isDotted ? base * 1.5 : base;
}

export function notesWithExplicitBeats(noteList) {
  let runningBeat = 0;
  return (noteList || []).map((n) => {
    const beat = typeof n.beat === 'number' ? n.beat : runningBeat;
    runningBeat = beat + noteDurationInQuarterBeats(n);
    return { ...n, beat };
  });
}

function normalizeStaves(project) {
  const visible = Array.isArray(project.visibleStaves) ? project.visibleStaves : null;
  if (Array.isArray(project.staves) && project.staves.length > 0) {
    return project.staves
      .map((s, i) => ({
        id: s.id || `staff-${i}`,
        name: s.name || '',
        notes: s.notes || [],
      }))
      .filter((_, i) => !visible || visible[i] !== false);
  }
  if (Array.isArray(project.notes)) {
    return [{ id: '1', name: '', notes: project.notes }];
  }
  return [{ id: '1', name: '', notes: [] }];
}

function getMeasureBounds(measureIndex, timeSignature, pickup) {
  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  let firstMeasureBeats = measureQuarters;
  if (pickup?.enabled && pickup.quantity > 0 && pickup.duration) {
    const onePickup = durationLabelToQuarterBeats(pickup.duration);
    firstMeasureBeats = pickup.quantity * onePickup;
    firstMeasureBeats = Math.max(0.25, Math.min(firstMeasureBeats, measureQuarters - 0.25));
  }
  if (measureIndex === 0) {
    return { startBeat: 0, endBeat: firstMeasureBeats, beatCount: firstMeasureBeats };
  }
  const startBeat = firstMeasureBeats + (measureIndex - 1) * measureQuarters;
  return { startBeat, endBeat: startBeat + measureQuarters, beatCount: measureQuarters };
}

function buildMeasures(project, staves) {
  const timeSignature = project.timeSignature || { beats: 4, beatUnit: 4 };
  const pickup = {
    enabled: !!project.pickupEnabled,
    quantity: Number(project.pickupQuantity) || 0,
    duration: project.pickupDuration,
  };

  let maxEndBeat = 0;
  for (const staff of staves) {
    for (const n of notesWithExplicitBeats(staff.notes)) {
      maxEndBeat = Math.max(maxEndBeat, (n.beat || 0) + noteDurationInQuarterBeats(n));
    }
  }

  let totalMeasures = Math.max(1, 1 + (Number(project.addedMeasures) || 0));
  while (totalMeasures < 512) {
    const bounds = getMeasureBounds(totalMeasures - 1, timeSignature, pickup);
    if (bounds.endBeat >= maxEndBeat - 1e-6) break;
    totalMeasures += 1;
  }

  const measures = [];
  for (let i = 0; i < totalMeasures; i += 1) {
    measures.push(getMeasureBounds(i, timeSignature, pickup));
  }
  return measures;
}

function assignNotesToMeasures(measures, notes) {
  const out = measures.map(() => []);
  let fallbackBeat = 0;
  for (const note of notesWithExplicitBeats(notes)) {
    const noteBeat = typeof note.beat === 'number' ? note.beat : fallbackBeat;
    const idx = measures.findIndex((m) => noteBeat >= m.startBeat && noteBeat < m.endBeat);
    if (idx >= 0) out[idx].push({ ...note, beat: noteBeat });
    fallbackBeat = noteBeat + noteDurationInQuarterBeats(note);
  }
  return out;
}

function getDurationInBeats(durLabel, beatsInMeasure = 4) {
  if (durLabel === '1/1') return 4;
  if (durLabel === '1/2') return 2;
  if (durLabel === '1/4') return 1;
  if (durLabel === '1/8') return 0.5;
  if (durLabel === '1/16' || durLabel === '1/32') return 0.25;
  const d = Number(durLabel);
  if (Number.isFinite(d) && d > 0 && d < 0.5) return d * beatsInMeasure;
  return 1;
}

function getFigureScaleForDuration(durLabel) {
  if (durLabel === '1/8') return 0.5;
  if (durLabel === '1/16' || durLabel === '1/32') return 0.25;
  return 1;
}

function getFlagCountForDuration(durationLabel) {
  if (durationLabel === '1/8') return 1;
  if (durationLabel === '1/16') return 2;
  if (durationLabel === '1/32') return 3;
  return 0;
}

function figurenoteTextColor(pitch) {
  const fill = getFigureColor(pitch);
  const isBlack = !fill || fill.toLowerCase() === '#000000' || fill.toLowerCase() === 'black';
  return isBlack ? '#ffffff' : '#111827';
}

function renderFigureShape(note, cx, cy, figureSize) {
  const style = getFigureStyle(note.pitch, note.octave);
  const shapePaths = getShapePathsByOctave(note.octave);
  const half = figureSize / 2;
  const paths = shapePaths.map((d) => (
    `<path d="${d}" fill="${esc(style.fill)}" stroke="${esc(style.stroke || 'none')}" stroke-width="${style.strokeWidth ?? 0}" vector-effect="non-scaling-stroke"/>`
  )).join('');
  return `<svg x="${cx - half}" y="${cy - half}" width="${figureSize}" height="${figureSize}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" overflow="visible">${paths}</svg>`;
}

function getSlotsPerBeat(notesInBeat) {
  if (!notesInBeat.length) return 1;
  const minDur = Math.min(...notesInBeat.map((n) => noteDurationInQuarterBeats(n)));
  return Math.max(1, Math.round(1 / minDur));
}

function getSlotIndexInBeat(note, measure, notesInMeasure) {
  const beatIndex = Math.floor(note.beat - measure.startBeat);
  const beatStart = measure.startBeat + beatIndex;
  const beatEnd = beatStart + 1;
  const notesInBeat = notesInMeasure
    .filter((n) => n.beat >= beatStart && n.beat < beatEnd)
    .sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
  const idx = notesInBeat.findIndex((n) => n === note);
  return idx >= 0 ? idx : 0;
}

function buildNoteLayoutHelpers(measure, notes, beatContentLeft, beatContentWidth, beatsInMeasure) {
  const beatWidth = beatContentWidth / beatsInMeasure;

  const getNoteSlotCenterX = (note) => {
    const beatInMeasure = note.beat - measure.startBeat;
    const beatIndex = Math.floor(beatInMeasure);
    const beatStart = measure.startBeat + beatIndex;
    const beatEnd = beatStart + 1;
    const notesInBeat = notes.filter((n) => n.beat >= beatStart && n.beat < beatEnd);
    const slotsPerBeat = getSlotsPerBeat(notesInBeat);
    const slotIndex = getSlotIndexInBeat(note, measure, notes);
    const slotCenter = (Math.min(slotIndex, slotsPerBeat - 1) + 0.5) / slotsPerBeat;
    return beatContentLeft + (beatIndex + slotCenter) * beatWidth;
  };

  const getRestBoxWidth = (note) => {
    const beatInMeasure = note.beat - measure.startBeat;
    const beatIndex = Math.floor(beatInMeasure);
    const beatStart = measure.startBeat + beatIndex;
    const beatEnd = beatStart + 1;
    const notesInBeat = notes.filter((n) => n.beat >= beatStart && n.beat < beatEnd);
    const slotsPerBeat = getSlotsPerBeat(notesInBeat);
    return beatWidth / slotsPerBeat;
  };

  const compactCenters = new Map();
  const figureSizeByNoteIndex = new Map();
  const notesByBeat = new Map();
  const figureSizeBase = 65; // overwritten by caller via closure patch

  return {
    beatWidth,
    setFigureSizeBase(size) { this.figureSizeBase = size; },
    figureSizeBase: 65,
    getNoteSlotCenterX,
    getRestBoxWidth,
    buildCompactLayout(figureSizeBaseForMeasure) {
      notes.forEach((note, idx) => {
        if (note.isRest) return;
        const durLabel = note.durationLabel || '1/4';
        const durBeats = typeof note.duration === 'number'
          ? note.duration
          : getDurationInBeats(durLabel, beatsInMeasure);
        if (durBeats >= 1) return;
        const beatIndex = Math.floor(note.beat - measure.startBeat);
        if (!notesByBeat.has(beatIndex)) notesByBeat.set(beatIndex, []);
        const scale = getFigureScaleForDuration(durLabel);
        const figureSize = figureSizeBaseForMeasure * scale;
        figureSizeByNoteIndex.set(idx, figureSize);
        notesByBeat.get(beatIndex).push({ note, idx, figureSize });
      });
      notesByBeat.forEach((group, beatIndex) => {
        if (!group || group.length <= 1) return;
        group.sort((a, b) => (a.note.beat ?? 0) - (b.note.beat ?? 0) || a.idx - b.idx);
        const beatLeft = beatContentLeft + beatIndex * beatWidth;
        let leftEdge = beatLeft + 1;
        group.forEach(({ idx, figureSize }) => {
          compactCenters.set(idx, leftEdge + figureSize / 2);
          leftEdge = leftEdge + figureSize + 1;
        });
      });
    },
    getFigureCenterXForNote(note, idx, figureSizeBaseForMeasure) {
      const defaultCenterX = getNoteSlotCenterX(note);
      const baseCenter = compactCenters.has(idx) ? compactCenters.get(idx) : defaultCenterX;
      const figureSize = figureSizeByNoteIndex.get(idx) ?? figureSizeBaseForMeasure;
      const halfFigure = figureSize / 2;
      const minCenter = beatContentLeft + halfFigure;
      const maxCenter = beatContentLeft + beatContentWidth - halfFigure;
      if (minCenter > maxCenter) return baseCenter;
      return Math.max(minCenter, Math.min(baseCenter, maxCenter));
    },
    figureSizeByNoteIndex,
  };
}

function renderFigurenotesMeasureContent({
  measure,
  measureIdx,
  measureX,
  measureWidth,
  beatContentLeft,
  beatContentWidth,
  sysYOffset,
  melodyRowHeight,
  padVertical,
  figureSizeBase,
  figurenotesStems,
  showNoteNames,
  timeSignature,
}) {
  const beatsInMeasure = measure.beatCount ?? measureLengthInQuarterBeats(timeSignature);
  const beatWidth = beatContentWidth / beatsInMeasure;
  const beatBoxBottomY = sysYOffset + melodyRowHeight - padVertical;
  const centerY = sysYOffset + melodyRowHeight / 2;
  const notes = measure.notes || [];
  const layout = buildNoteLayoutHelpers(measure, notes, beatContentLeft, beatContentWidth, beatsInMeasure);
  layout.buildCompactLayout(figureSizeBase);

  const playedIntervals = notes
    .filter((n) => !n.isRest)
    .map((n) => ({
      start: Number(n.beat) || 0,
      end: (Number(n.beat) || 0) + noteDurationInQuarterBeats(n),
    }))
    .filter((iv) => iv.end > iv.start);

  const restOverlapsPlayed = (restNote) => {
    const start = Number(restNote?.beat ?? 0);
    const end = start + noteDurationInQuarterBeats(restNote);
    return playedIntervals.some((iv) => start < iv.end && end > iv.start);
  };

  const beamGroups = figurenotesStems
    ? computeBeamGroups(notes, measure.startBeat, timeSignature)
    : [];
  const beamSegmentsByStart = new Map();
  beamGroups.forEach((group) => {
    const levelByIdx = new Map();
    const stemXByIdx = new Map();
    for (let idx = group.start; idx <= group.end; idx += 1) {
      const n = notes[idx];
      levelByIdx.set(idx, getFlagCountForDuration(n?.durationLabel || '1/4'));
      const durLabel = n?.durationLabel || '1/4';
      const fs = layout.figureSizeByNoteIndex.get(idx) ?? figureSizeBase * getFigureScaleForDuration(durLabel);
      const cx = layout.getFigureCenterXForNote(n, idx, figureSizeBase);
      stemXByIdx.set(idx, cx + fs / 2 + 1);
    }
    const segments = [];
    for (let beamLevel = 1; beamLevel <= 3; beamLevel += 1) {
      for (let idx = group.start; idx < group.end; idx += 1) {
        if ((levelByIdx.get(idx) ?? 0) >= beamLevel && (levelByIdx.get(idx + 1) ?? 0) >= beamLevel) {
          segments.push({
            x1: stemXByIdx.get(idx),
            x2: stemXByIdx.get(idx + 1),
            y: centerY - 26 - (beamLevel - 1) * 6,
          });
        }
      }
    }
    beamSegmentsByStart.set(group.start, segments);
  });

  let markup = '';
  notes.forEach((note, noteIdx) => {
    if (note.isRest) {
      const isAutoGapRest = typeof note.id === 'string' && note.id.startsWith('rest-');
      if (isAutoGapRest || restOverlapsPlayed(note)) return;
      if (!shouldDrawRestGlyph(notes, noteIdx)) return;
      const cx = layout.getFigureCenterXForNote(note, noteIdx, figureSizeBase);
      const noteWidth = layout.getRestBoxWidth(note);
      const zSize = Math.min(noteWidth * 0.55, 26);
      if (!figurenotesStems) {
        markup += `<text x="${cx}" y="${centerY + zSize * 0.2}" text-anchor="middle" font-size="${zSize}" font-weight="bold" fill="#1a1a1a" font-family="Georgia, serif">Z</text>`;
      }
      return;
    }

    const durLabel = note.durationLabel || '1/4';
    const scale = getFigureScaleForDuration(durLabel);
    const figureSize = figureSizeBase * scale;
    const figureCenterX = layout.getFigureCenterXForNote(note, noteIdx, figureSizeBase);
    const noteY = beatBoxBottomY - figureSize / 2;
    const durBeats = typeof note.duration === 'number'
      ? note.duration
      : getDurationInBeats(durLabel, beatsInMeasure);
    const hasTail = durLabel === '1/2' || durLabel === '1/1';
    const tailSize = hasTail ? figureSize / 2 : 0;
    const style = getFigureStyle(note.pitch, note.octave);
    const fill = style.fill ?? '#C7BAB7';

    if (hasTail) {
      const endBeat = Math.min(note.beat + durBeats, measure.endBeat ?? measure.startBeat + beatsInMeasure);
      const longRectEndX = Math.min(
        beatContentLeft + beatContentWidth,
        beatContentLeft + (endBeat - measure.startBeat) * beatWidth,
      );
      const longRectWidth = Math.max(0, longRectEndX - figureCenterX);
      if (longRectWidth > 0) {
        markup += `<rect x="${figureCenterX}" y="${beatBoxBottomY - tailSize}" width="${longRectWidth}" height="${tailSize}" fill="${esc(fill)}" stroke="#000" stroke-width="2"/>`;
      }
    }

    markup += renderFigureShape(note, figureCenterX, noteY, figureSize);

    if (showNoteNames) {
      const pitchLabel = String(note.pitch || '').toUpperCase().replace('H', 'B');
      markup += `<text x="${figureCenterX}" y="${noteY + figureSize * 0.5 + Math.max(8, figureSize * 0.5)}" text-anchor="middle" dominant-baseline="middle" fill="${esc(figurenoteTextColor(note.pitch))}" font-size="${Math.max(8, figureSize * 0.5)}" font-weight="bold" font-family="Arial, sans-serif">${esc(pitchLabel)}</text>`;
    }

    if (figurenotesStems && durLabel !== '1/1') {
      const stemX = figureCenterX + figureSize / 2 + 1;
      markup += `<line x1="${stemX}" y1="${noteY}" x2="${stemX}" y2="${noteY - 26}" stroke="#1a1a1a" stroke-width="1.8"/>`;
      const segments = beamSegmentsByStart.get(noteIdx);
      if (segments) {
        segments.forEach((seg) => {
          markup += `<line x1="${seg.x1}" y1="${seg.y}" x2="${seg.x2}" y2="${seg.y}" stroke="#1a1a1a" stroke-width="2"/>`;
        });
      }
    }
  });

  return markup;
}

function renderFigurenotesStaffRow({
  staffMeasures,
  measureIdx,
  measureX,
  measureWidth,
  beatContentLeft,
  beatContentWidth,
  sysYOffset,
  rowYOffset,
  melodyRowHeight,
  padVertical,
  figureSizeBase,
  figurenotesStems,
  showNoteNames,
  timeSignature,
  hideLeftStroke,
}) {
  const measure = { ...staffMeasures[measureIdx], notes: staffMeasures[measureIdx]?.notes || [] };
  const beatsInMeasure = measure.beatCount ?? measureLengthInQuarterBeats(timeSignature);
  const yBase = sysYOffset + rowYOffset;
  const topY = yBase + padVertical;
  const bottomY = yBase + melodyRowHeight - padVertical;
  const edge = '#c8c8c8';
  const sw = 1.5;
  const beatWidth = beatContentWidth / beatsInMeasure;

  let markup = '';
  markup += `<line x1="${measureX}" y1="${topY}" x2="${measureX + measureWidth}" y2="${topY}" stroke="${edge}" stroke-width="${sw}"/>`;
  markup += `<line x1="${measureX}" y1="${bottomY}" x2="${measureX + measureWidth}" y2="${bottomY}" stroke="${edge}" stroke-width="${sw}"/>`;
  if (!hideLeftStroke) {
    markup += `<line x1="${measureX}" y1="${topY}" x2="${measureX}" y2="${bottomY}" stroke="${edge}" stroke-width="${sw}"/>`;
  }
  for (let b = 0; b < Math.max(0, Math.ceil(beatsInMeasure) - 1); b += 1) {
    const x = beatContentLeft + (b + 1) * beatWidth;
    markup += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${bottomY}" stroke="#e0e0e0" stroke-width="1"/>`;
  }
  markup += renderFigurenotesMeasureContent({
    measure,
    measureIdx,
    measureX,
    measureWidth,
    beatContentLeft,
    beatContentWidth,
    sysYOffset: yBase,
    melodyRowHeight,
    padVertical,
    figureSizeBase,
    figurenotesStems,
    showNoteNames,
    timeSignature,
  });
  return markup;
}

function renderFigurenotesProjectSvg(project, sourceName = '') {
  const orientation = project.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const pageDims = PAGE_DIMENSIONS[orientation] ?? PAGE_DIMENSIONS.portrait;
  const pageW = pageDims.width;
  const marginLeft = LAYOUT.MARGIN_LEFT;
  const scoreContentWidth = pageW - marginLeft - LAYOUT.MARGIN_RIGHT;

  const staves = normalizeStaves(project);
  const measures = buildMeasures(project, staves);
  const staffMeasuresList = staves.map((staff) => {
    const notesByMeasure = assignNotesToMeasures(measures, staff.notes);
    return measures.map((m, i) => ({ ...m, notes: notesByMeasure[i] || [] }));
  });

  const figurenotesSize = Math.max(12, Math.min(100, Number(project.figurenotesSize) || 65));
  const figurenotesRowHeight = Math.max(FIGURE_ROW_HEIGHT, Math.round(FIGURE_ROW_HEIGHT * figurenotesSize / NOTATION_SIZE_REF));
  const layoutPartsGap = Number(project.layoutPartsGap) || 0;
  const rowStepPx = figurenotesRowHeight + layoutPartsGap;
  const figureSystemCoreHeight = staves.length * figurenotesRowHeight + Math.max(0, staves.length - 1) * layoutPartsGap;
  const layoutSystemGap = Number(project.layoutSystemGap) || 120;

  const layoutData = {
    measures,
    timeSignature: project.timeSignature || { beats: 4, beatUnit: 4 },
    pixelsPerBeat: Number(project.pixelsPerBeat) > 0 ? Number(project.pixelsPerBeat) : undefined,
    staffSpacing: figureSystemCoreHeight + layoutSystemGap,
    globalSpacingMultiplier: Number(project.layoutGlobalSpacingMultiplier) || 1,
    boxesPerRow: Number(project.layoutMeasuresPerLine) || 4,
    pageWidth: scoreContentWidth,
    pageHeight: pageDims.height - pageDims.margin * 2,
    lineBreakBefore: project.layoutLineBreakBefore || [],
    pageBreakBefore: project.layoutPageBreakBefore || [],
    figurenotesSize,
    excludePickupFromMeasureCount: !!project.pickupEnabled,
    pickupMeasureIndex: 0,
    enforceMeasuresPerLine: project.layoutStrictMeasuresPerLine !== false,
  };

  const systems = calculateLayout('figure', orientation, layoutData);
  const beatsPerMeasure = measureLengthInQuarterBeats(layoutData.timeSignature);
  const notationScale = Math.max(0.5, figurenotesSize / NOTATION_SIZE_REF);
  const padVertical = Math.max(2, Math.round(4 * notationScale));
  const figurenotesStems = !!project.figurenotesStems;
  const showNoteNames = project.figurenotesMelodyShowNoteNames !== false;

  let content = '';
  systems.forEach((sys) => {
    const mwDefault = sys.measureWidth ?? beatsPerMeasure * 80;
    const measureWidths = sys.measureWidths ?? sys.measureIndices.map(() => mwDefault);

    sys.measureIndices.forEach((measureIdx, j) => {
      const baseMeasureWidth = measureWidths[j] ?? mwDefault;
      const measureWidth = baseMeasureWidth;
      let measureX = marginLeft;
      for (let i = 0; i < j; i += 1) {
        measureX += measureWidths[i] ?? mwDefault;
      }
      const beatContentLeft = measureX;
      const beatContentWidth = baseMeasureWidth;

      staves.forEach((staff, staffSi) => {
        content += renderFigurenotesStaffRow({
          staffMeasures: staffMeasuresList[staffSi],
          measureIdx,
          measureX,
          measureWidth,
          beatContentLeft,
          beatContentWidth,
          sysYOffset: sys.yOffset,
          rowYOffset: staffSi * rowStepPx,
          melodyRowHeight: figurenotesRowHeight,
          padVertical,
          figureSizeBase: figurenotesSize,
          figurenotesStems,
          showNoteNames,
          timeSignature: layoutData.timeSignature,
          hideLeftStroke: false,
        });
      });

      const rightX = measureX + measureWidth;
      const systemBottom = sys.yOffset + figureSystemCoreHeight;
      content += `<line x1="${rightX}" y1="${sys.yOffset + padVertical}" x2="${rightX}" y2="${systemBottom - padVertical}" stroke="#c8c8c8" stroke-width="1.5"/>`;
    });
  });

  const maxY = systems.reduce(
    (max, sys) => Math.max(max, sys.yOffset + figureSystemCoreHeight),
    figurenotesRowHeight,
  );
  const pageH = Math.max(pageDims.height, maxY + 48);
  const title = String(project.songTitle || project.title || sourceName || 'Nimetu').trim() || 'Nimetu';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}" width="${pageW}" height="${pageH}">
  <rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>
  <text x="${marginLeft}" y="36" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#111827">${esc(title)}</text>
  <g transform="translate(0, 52)">${content}</g>
</svg>`.trim();
}

function renderTraditionalProjectSvg(project, sourceName = '') {
  const orientation = project.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const pageW = orientation === 'landscape' ? 1123 : 794;
  const pageH = orientation === 'landscape' ? 794 : 1123;
  const staves = normalizeStaves(project);
  const measures = buildMeasures(project, staves);
  const staffMeasuresList = staves.map((staff) => {
    const notesByMeasure = assignNotesToMeasures(measures, staff.notes);
    return measures.map((m, i) => ({ ...m, notes: notesByMeasure[i] || [] }));
  });

  const staffGap = 90;
  const staffLineGap = 10;
  const left = 48;
  const innerW = pageW - 96;
  const title = String(project.songTitle || project.title || sourceName || 'Nimetu').trim() || 'Nimetu';

  let markup = '';
  staves.forEach((staff, staffIdx) => {
    const staffY = 120 + staffIdx * staffGap;
    for (let li = 0; li < 5; li += 1) {
      const y = staffY + li * staffLineGap;
      markup += `<line x1="${left}" y1="${y}" x2="${left + innerW}" y2="${y}" stroke="#374151" stroke-width="1"/>`;
    }
    const staffMeasures = staffMeasuresList[staffIdx];
    const maxBeat = Math.max(8, ...staffMeasures.map((m) => m.endBeat));
    const beatWidth = innerW / maxBeat;
    staffMeasures.forEach((measure) => {
      (measure.notes || []).forEach((note) => {
        if (note.isRest) return;
        const x = left + (note.beat || 0) * beatWidth + 8;
        const pitchIdx = 'CDEFGAB'.indexOf(String(note.pitch || 'C').toUpperCase().charAt(0));
        const octave = Number.isFinite(Number(note.octave)) ? Number(note.octave) : 4;
        const y = staffY + staffLineGap * 2 - (pitchIdx + octave * 7 - 28) * (staffLineGap / 2);
        const filled = noteDurationInQuarterBeats(note) <= 1;
        markup += `<ellipse cx="${x}" cy="${y}" rx="7" ry="5.5" fill="${filled ? '#111827' : '#ffffff'}" stroke="#111827" stroke-width="1.4"/>`;
        markup += `<line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y - 28}" stroke="#111827" stroke-width="1.3"/>`;
      });
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}" width="${pageW}" height="${pageH}">
  <rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>
  <text x="${left}" y="48" font-family="Georgia, serif" font-size="24" font-weight="700" fill="#111827">${esc(title)}</text>
  <text x="${left}" y="72" font-family="Inter, Arial, sans-serif" font-size="13" fill="#6b7280">${esc(sourceName || 'Noodimeister')}</text>
  ${markup}
</svg>`.trim();
}

export function renderNotationProjectToSvg(project, { sourceName = '' } = {}) {
  const parsed = project && typeof project === 'object' ? project : {};
  if (isFigurenotesProject(parsed)) {
    return renderFigurenotesProjectSvg(parsed, sourceName);
  }
  return renderTraditionalProjectSvg(parsed, sourceName);
}

export function getProjectPageDimensions(project) {
  const orientation = project?.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const dims = PAGE_DIMENSIONS[orientation] ?? PAGE_DIMENSIONS.portrait;
  return { width: dims.width, height: dims.height, orientation };
}
