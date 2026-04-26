/**
 * Ainult lüükide/sluuride jaoks: noodipea ankrud ühes taktis (sama arvutused mis TraditionalNotationView).
 */
import { ensureGlyphHorizontalGapPx } from './glyphSpacing';
import { computeBeamGroups, computeBeamGeometry } from './BeamCalculation';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';

/**
 * @returns {Map<number, { x: number, y: number, stemUp: boolean, beat: number }>}
 */
export function buildTieSlurAnchorMapForMeasure({
  measure,
  measureX,
  measureWidth,
  timeSignature,
  staffY,
  firstLineY,
  lastLineY,
  centerY,
  staffLines,
  spacing,
  staffCenterY,
  staffResolvePitchY,
  middleLineY,
  isHandbellsStaff,
}) {
  const byId = new Map();
  if (!measure?.notes?.length) return byId;
  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
  const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
  const beatWidth = measureWidth / Math.max(1, beatsInMeasure);
  const getSlotsPerBeat = (beatIndex) => {
    const beatStart = measure.startBeat + beatIndex;
    const beatEnd = beatStart + 1;
    const notesInBeat = measure.notes.filter((n) => n.beat >= beatStart && n.beat < beatEnd);
    if (notesInBeat.length === 0) return 1;
    const minDur = Math.min(...notesInBeat.map((n) => n.duration));
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
  const noteXOverrides = new Map();
  const simultaneousBeatGroups = new Map();
  for (let idx = 0; idx < measure.notes.length; idx += 1) {
    const n = measure.notes[idx];
    if (!n || n.isRest || typeof n.beat !== 'number') continue;
    const beatKey = Math.round((n.beat - measure.startBeat) * 1024) / 1024;
    if (!simultaneousBeatGroups.has(beatKey)) simultaneousBeatGroups.set(beatKey, []);
    simultaneousBeatGroups.get(beatKey).push(idx);
  }
  const chordHorizontalShiftPx = ensureGlyphHorizontalGapPx(spacing * 0.75);
  const secondIntervalThresholdPx = spacing * 0.75;
  simultaneousBeatGroups.forEach((indices) => {
    if (!Array.isArray(indices) || indices.length < 2) return;
    const sorted = [...indices].sort((a, b) => {
      const na = measure.notes[a];
      const nb = measure.notes[b];
      const pyA = na?.pitch && typeof na?.octave === 'number' ? staffResolvePitchY(na.pitch, na.octave) : staffCenterY;
      const pyB = nb?.pitch && typeof nb?.octave === 'number' ? staffResolvePitchY(nb.pitch, nb.octave) : staffCenterY;
      return pyA - pyB;
    });
    let prevPitchY = null;
    let column = 0;
    for (const noteIdxInMeasure of sorted) {
      const n = measure.notes[noteIdxInMeasure];
      const py = n?.pitch && typeof n?.octave === 'number' ? staffResolvePitchY(n.pitch, n.octave) : staffCenterY;
      if (prevPitchY != null && Math.abs(py - prevPitchY) < secondIntervalThresholdPx) {
        column = column === 0 ? 1 : 0;
      } else {
        column = 0;
      }
      if (column === 1) noteXOverrides.set(noteIdxInMeasure, chordHorizontalShiftPx);
      prevPitchY = py;
    }
  });
  const getRenderedNoteCenterX = (note, noteIdx) => {
    const baseX = getNoteSlotCenterX(note);
    return baseX + (noteXOverrides.get(noteIdx) ?? 0);
  };
  const beamGroupsRaw = computeBeamGroups(measure.notes, measure.startBeat, timeSignature);
  const beamGroups = beamGroupsRaw.map((gr) => {
    const noteXs = new Array(measure.notes.length);
    const noteCys = new Array(measure.notes.length);
    for (let k = gr.start; k <= gr.end; k += 1) {
      const n = measure.notes[k];
      noteXs[k] = getRenderedNoteCenterX(n, k);
      const py = n.pitch && typeof n.octave === 'number' ? staffResolvePitchY(n.pitch, n.octave) : staffCenterY;
      noteCys[k] = py;
    }
    let stemUp;
    if (isHandbellsStaff) {
      stemUp = true;
    } else {
      stemUp = noteCys[gr.start] > middleLineY;
      if (gr.end >= gr.start) {
        let sum = 0;
        let count = 0;
        for (let k = gr.start; k <= gr.end; k += 1) {
          if (typeof noteCys[k] === 'number') {
            sum += noteCys[k];
            count += 1;
          }
        }
        const avg = count > 0 ? sum / count : middleLineY;
        stemUp = avg > middleLineY;
      }
    }
    const geom = computeBeamGeometry(gr, measure.notes, noteXs, noteCys, stemUp, spacing);
    return { ...gr, ...geom, noteXs, noteCys };
  });
  const getBeamGroup = (noteIdx) => beamGroups.find((g) => noteIdx >= g.start && noteIdx <= g.end);

  for (let noteIdx = 0; noteIdx < measure.notes.length; noteIdx += 1) {
    const note = measure.notes[noteIdx];
    if (!note || !note.id || note.isRest) continue;
    const x = getRenderedNoteCenterX(note, noteIdx);
    const pitchY = note.pitch && typeof note.octave === 'number' ? staffResolvePitchY(note.pitch, note.octave) : staffCenterY;
    const y = staffY + pitchY;
    const bg = getBeamGroup(noteIdx);
    const stemUp = bg
      ? bg.stemUp
      : isHandbellsStaff
        ? true
        : pitchY > middleLineY;
    byId.set(Number(note.id), { x, y, stemUp, beat: note.beat ?? 0, pitchY });
  }
  return byId;
}

/**
 * Ehitab taktide üle: noteId → ankur (kõigis taktimõõtudel sama staff).
 */
export function findNoteInInstMeasuresById(instMeasures, noteId) {
  if (!Array.isArray(instMeasures) || noteId == null) return null;
  const want = Number(noteId);
  for (let m = 0; m < instMeasures.length; m += 1) {
    const meas = instMeasures[m];
    if (!meas?.notes) continue;
    for (let i = 0; i < meas.notes.length; i += 1) {
      const n = meas.notes[i];
      if (n && Number(n.id) === want) {
        return { measure: meas, measureIndex: m, noteIndex: i, note: n };
      }
    }
  }
  return null;
}

/**
 * Taktide ühendatud ankrute kaart (kogu osa).
 */
export function buildTieSlurAnchorMapForStaffSystem({
  instMeasures,
  measureIndices,
  sys,
  timeSignature,
  staffY,
  firstLineY,
  lastLineY,
  centerY,
  staffLines,
  spacing,
  staffCenterY,
  staffResolvePitchY,
  middleLineY,
  isHandbellsStaff,
  effectiveMarginLeft,
}) {
  const merged = new Map();
  const list = Array.isArray(measureIndices) && measureIndices.length
    ? measureIndices
    : instMeasures.map((_, i) => i);
  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
  const measureWidths = sys?.measureWidths ?? list.map(() => (sys?.measureWidth ?? beatsPerMeasure * 80));
  for (let j = 0; j < list.length; j += 1) {
    const measureIdx = list[j];
    const measure = instMeasures[measureIdx];
    if (!measure) continue;
    const measureWidth = measureWidths[j] ?? (sys?.measureWidth ?? beatsPerMeasure * 80);
    const measureX = effectiveMarginLeft + measureWidths.slice(0, j).reduce((a, b) => a + b, 0);
    const local = buildTieSlurAnchorMapForMeasure({
      measure,
      measureX,
      measureWidth,
      timeSignature,
      staffY,
      firstLineY,
      lastLineY,
      centerY,
      staffLines,
      spacing,
      staffCenterY,
      staffResolvePitchY,
      middleLineY,
      isHandbellsStaff,
    });
    local.forEach((v, k) => merged.set(k, v));
  }
  return merged;
}

export function isNoteLeftEndpointForSpanner(n, target) {
  if (!n || !target || n.isRest || target.isRest) return false;
  const b1 = Number(n.beat) || 0;
  const b2 = Number(target.beat) || 0;
  if (b1 < b2) return true;
  if (b1 > b2) return false;
  return (Number(n.id) || 0) < (Number(target.id) || 0);
}
