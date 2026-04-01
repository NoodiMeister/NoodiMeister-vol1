export const REPEAT_MARK_TYPES = [
  'repeatStart',
  'repeatEnd',
  'volta1',
  'volta2',
  'segno',
  'coda',
  'barlineFinal',
];

export function normalizeRepeatMarksMap(raw, measureCount = 0) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.entries(raw).forEach(([k, markSet]) => {
    const idx = Number(k);
    if (!Number.isInteger(idx) || idx < 0) return;
    if (measureCount > 0 && idx >= measureCount) return;
    if (!markSet || typeof markSet !== 'object') return;
    const normalized = {};
    REPEAT_MARK_TYPES.forEach((t) => {
      if (markSet[t]) normalized[t] = true;
    });
    if (Object.keys(normalized).length > 0) out[idx] = normalized;
  });
  return out;
}

export function applyRepeatMark(prevMap, measureIndex, markType) {
  const next = { ...(prevMap || {}) };
  const marks = { ...(next[measureIndex] || {}) };
  if (!REPEAT_MARK_TYPES.includes(markType)) {
    return { nextMap: next, issues: [{ code: 'unknown_mark', message: `Unknown repeat mark: ${markType}` }] };
  }
  if (markType === 'volta1') delete marks.volta2;
  if (markType === 'volta2') delete marks.volta1;
  marks[markType] = true;
  next[measureIndex] = marks;
  const issues = validateRepeatMarks(next);
  return { nextMap: next, issues };
}

export function removeRepeatMark(prevMap, measureIndex, markType) {
  const next = { ...(prevMap || {}) };
  if (!next[measureIndex]) return next;
  if (!markType) {
    delete next[measureIndex];
    return next;
  }
  const marks = { ...next[measureIndex] };
  delete marks[markType];
  if (Object.keys(marks).length === 0) delete next[measureIndex];
  else next[measureIndex] = marks;
  return next;
}

export function validateRepeatMarks(repeatMarksMap) {
  const issues = [];
  const map = repeatMarksMap || {};
  let segnoCount = 0;
  let codaCount = 0;
  Object.values(map).forEach((m) => {
    if (m.segno) segnoCount += 1;
    if (m.coda) codaCount += 1;
  });
  if (segnoCount > 1) {
    issues.push({ code: 'multiple_segno', message: 'Only one segno is supported per score.' });
  }
  if (codaCount > 1) {
    issues.push({ code: 'multiple_coda', message: 'Only one coda is supported per score.' });
  }

  const idxs = Object.keys(map).map((k) => Number(k)).filter(Number.isInteger).sort((a, b) => a - b);
  idxs.forEach((i) => {
    const m = map[i];
    if (m.volta1 || m.volta2) {
      const hasRepeatStartBefore = idxs.some((j) => j <= i && map[j]?.repeatStart);
      if (!hasRepeatStartBefore) {
        issues.push({ code: 'volta_without_repeat_start', measureIndex: i, message: 'Volta should be inside a repeated section.' });
      }
    }
  });
  return issues;
}

export function mergeMeasuresWithRepeatMarks(measures, repeatMarksMap) {
  const map = normalizeRepeatMarksMap(repeatMarksMap, measures?.length || 0);
  return (measures || []).map((m, i) => ({ ...m, ...(map[i] || {}) }));
}

/**
 * Sibelius-like minimal deterministic repeat traversal:
 * - supports |: :| with one repeat pass
 * - supports volta1/volta2 filtering during first/second pass
 * - segno/coda are retained as semantic marks but are not jumped without DS/DC commands
 */
export function buildPlaybackMeasureSequence(measuresWithMarks, options = {}) {
  const measures = Array.isArray(measuresWithMarks) ? measuresWithMarks : [];
  const maxSteps = Math.max(1, Number(options.maxSteps) || 4096);
  const out = [];
  if (measures.length === 0) return out;

  let i = 0;
  let steps = 0;
  let activeRepeatStart = null;
  let inSecondPass = false;

  while (i >= 0 && i < measures.length && steps < maxSteps) {
    const m = measures[i] || {};

    // Volta branch filtering.
    if (!inSecondPass && m.volta2) {
      i += 1;
      steps += 1;
      continue;
    }
    if (inSecondPass && m.volta1) {
      i += 1;
      steps += 1;
      continue;
    }

    out.push(i);

    if (m.repeatStart && activeRepeatStart == null && !inSecondPass) {
      activeRepeatStart = i;
    }

    if (m.repeatEnd && activeRepeatStart != null) {
      if (!inSecondPass) {
        inSecondPass = true;
        i = activeRepeatStart;
        steps += 1;
        continue;
      }
      inSecondPass = false;
      activeRepeatStart = null;
      i += 1;
      steps += 1;
      continue;
    }

    i += 1;
    steps += 1;
  }

  return out;
}

export function buildPlaybackNoteEvents(notesWithBeats, measuresWithMarks) {
  const notes = Array.isArray(notesWithBeats) ? notesWithBeats : [];
  const measures = Array.isArray(measuresWithMarks) ? measuresWithMarks : [];
  const sequence = buildPlaybackMeasureSequence(measures);
  if (sequence.length === 0) return { events: [], totalBeats: 0, measureSequence: [] };

  const events = [];
  let timelineBeat = 0;
  sequence.forEach((measureIndex) => {
    const m = measures[measureIndex];
    if (!m) return;
    const mStart = Number(m.startBeat) || 0;
    const mEnd = Number(m.endBeat) || (mStart + (Number(m.beatCount) || 4));
    const mLen = Math.max(0, mEnd - mStart);
    notes
      .filter((n) => {
        const b = Number(n.beat);
        return Number.isFinite(b) && b >= mStart && b < mEnd;
      })
      .sort((a, b) => (Number(a.beat) || 0) - (Number(b.beat) || 0))
      .forEach((n) => {
        const localBeat = (Number(n.beat) || 0) - mStart;
        events.push({
          ...n,
          playbackBeat: timelineBeat + localBeat,
        });
      });
    timelineBeat += mLen;
  });

  return { events, totalBeats: timelineBeat, measureSequence: sequence };
}

export function getRepeatMarkPlacement({ measureX, staffY, firstLineY, spacing }) {
  const fs = Math.max(1, spacing * 4);
  const barlineTopY = staffY + firstLineY;
  const gapPx = 1;
  return {
    segnoCodaY: barlineTopY - gapPx - (fs * 0.9 * 0.5),
    voltaTextX: measureX + spacing * 0.3,
    voltaTextY: staffY + firstLineY - spacing * 1.2,
    hitW: spacing * 2.5,
    hitH: spacing * 2,
    fontSize: fs * 0.9,
  };
}
