/**
 * Noodi ja pausi ühine kestus (neljandik = 1) ning takti-sisene asendus.
 * Sama glüüf (1/4, 1/8, …) on noodil ja pausil sama arv.
 * MuseScore replace: uus noot või uus rütm kirjutab takti sees vahemiku [beat, beat+kestus) üle.
 * Lühem jätab pausi. Pikem sööb sündmused, mis algavad selle vahemiku sees.
 * Taktipiiri ei ületata ja järgmise takti noodid ei nihku.
 */

import { durationLabelToQuarterNoteUnits } from './timeSignature.js';

const EPS = 1e-6;

const REST_UNITS = [
  { beats: 4, label: '1/1' },
  { beats: 2, label: '1/2' },
  { beats: 1, label: '1/4' },
  { beats: 0.5, label: '1/8' },
  { beats: 0.25, label: '1/16' },
  { beats: 0.125, label: '1/32' },
];

const EXACT_RHYTHMS = [
  { beats: 4, label: '1/1', dotted: false },
  { beats: 3, label: '1/2', dotted: true },
  { beats: 2, label: '1/2', dotted: false },
  { beats: 1.5, label: '1/4', dotted: true },
  { beats: 1, label: '1/4', dotted: false },
  { beats: 0.75, label: '1/8', dotted: true },
  { beats: 0.5, label: '1/8', dotted: false },
  { beats: 0.375, label: '1/16', dotted: true },
  { beats: 0.25, label: '1/16', dotted: false },
  { beats: 0.1875, label: '1/32', dotted: true },
  { beats: 0.125, label: '1/32', dotted: false },
];

let restSerial = 0;

export function rhythmDurationBeats(durationLabel, isDotted = false) {
  if (typeof durationLabel !== 'string' || !durationLabel.includes('/')) return null;
  const beats = durationLabelToQuarterNoteUnits(durationLabel, !!isDotted);
  if (!Number.isFinite(beats) || beats <= 0) return null;
  return beats;
}

function noteBeat(note) {
  return Number(note?.beat) || 0;
}

function noteDuration(note) {
  const direct = Number(note?.duration);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return rhythmDurationBeats(note?.durationLabel || '1/4', !!note?.isDotted) || 1;
}

function sameBeat(a, b) {
  return Math.abs(a - b) < EPS;
}

function snapBeat(value) {
  return Math.round((Number(value) || 0) * 1e6) / 1e6;
}

function makeRest(beat, beats, label) {
  restSerial += 1;
  return {
    id: `rest-${snapBeat(beat)}-${label}-${restSerial}`,
    pitch: 'C',
    octave: 4,
    duration: beats,
    durationLabel: label,
    isDotted: false,
    isRest: true,
    beat: snapBeat(beat),
    lyric: '',
  };
}

/** Täida [start, end) suurimate standardpausidega. Sama tabel mis noodi glüüfidel. */
export function restsForSpan(startBeat, endBeat) {
  const rests = [];
  let t = snapBeat(startBeat);
  const end = Number(endBeat) || 0;
  while (end - t > EPS) {
    const remaining = end - t;
    const unit = REST_UNITS.find((x) => x.beats <= remaining + EPS);
    if (!unit) break;
    rests.push(makeRest(t, unit.beats, unit.label));
    t = snapBeat(t + unit.beats);
    if (rests.length > 10000) break;
  }
  return rests;
}

function applyExactDuration(note, beats) {
  const exact = EXACT_RHYTHMS.find((x) => Math.abs(x.beats - beats) < EPS);
  const next = { ...note, beat: noteBeat(note), duration: beats };
  delete next.tuplet;
  delete next.beamGroupId;
  if (exact) {
    next.durationLabel = exact.label;
    next.isDotted = exact.dotted;
  }
  return next;
}

function uncoveredRests(notes, start, end) {
  const spans = notes
    .map((n) => ({ b: noteBeat(n), e: noteBeat(n) + noteDuration(n) }))
    .filter((s) => s.e > start + EPS && s.b < end - EPS)
    .sort((a, b) => a.b - b.b);
  const rests = [];
  let cursor = start;
  for (const span of spans) {
    if (span.b > cursor + EPS) rests.push(...restsForSpan(cursor, Math.min(span.b, end)));
    cursor = Math.max(cursor, Math.min(span.e, end));
  }
  if (end > cursor + EPS) rests.push(...restsForSpan(cursor, end));
  return rests;
}

/**
 * Kirjuta takti sees vahemik [beat, beat+durationBeats) üle.
 * placeNote asendab sellel löögil oleva sündmuse (sisestus).
 * Ilma placeNote’ta uuendatakse seal olevat nooti/pausi/akordi (rütmimuutus).
 *
 * @returns {{ ok: true, notes: Array } | { ok: false, reason: string }}
 */
export function rewriteRhythmSpan(notes, spec = {}) {
  const beat = Number(spec.beat);
  const durationBeats = Number(spec.durationBeats);
  const measureEndBeat = Number(spec.measureEndBeat);
  if (!Number.isFinite(beat) || beat < -EPS) return { ok: false, reason: 'invalid-beat' };
  if (!Number.isFinite(durationBeats) || durationBeats <= 0) return { ok: false, reason: 'invalid-duration' };
  if (!Number.isFinite(measureEndBeat)) return { ok: false, reason: 'exceeds-measure' };
  if (beat + durationBeats > measureEndBeat + EPS) return { ok: false, reason: 'exceeds-measure' };

  let list = (Array.isArray(notes) ? notes : []).map((n) => ({ ...n, beat: noteBeat(n) }));

  let releasedEnd = beat;
  const split = [];
  for (const n of list) {
    const start = noteBeat(n);
    const end = start + noteDuration(n);
    if (start < beat - EPS && end > beat + EPS) {
      const headBeats = beat - start;
      if (n.isRest) split.push(...restsForSpan(start, beat));
      else if (headBeats > EPS) split.push(applyExactDuration(n, headBeats));
      releasedEnd = Math.max(releasedEnd, end);
    } else {
      split.push(n);
    }
  }
  list = split;

  const atBeat = list.filter((n) => sameBeat(noteBeat(n), beat));
  const placing = spec.placeNote != null;
  if (!placing && atBeat.length === 0) return { ok: false, reason: 'no-event' };

  const oldEnd = atBeat.reduce((max, n) => Math.max(max, noteBeat(n) + noteDuration(n)), beat);
  const newEnd = beat + durationBeats;
  const removed = list.filter((n) => {
    const start = noteBeat(n);
    return start > beat + EPS && start < newEnd - EPS;
  });
  const removedEnd = removed.reduce((max, n) => Math.max(max, noteBeat(n) + noteDuration(n)), newEnd);

  const durationLabel = spec.durationLabel
    || atBeat[0]?.durationLabel
    || EXACT_RHYTHMS.find((x) => Math.abs(x.beats - durationBeats) < EPS)?.label
    || '1/4';
  const isDotted = spec.isDotted != null ? !!spec.isDotted : !!atBeat[0]?.isDotted;

  let placed;
  if (placing) {
    const src = spec.placeNote;
    placed = [{
      ...src,
      beat,
      duration: durationBeats,
      durationLabel: src.durationLabel || durationLabel,
      isDotted: src.isDotted != null ? !!src.isDotted : isDotted,
    }];
  } else {
    placed = atBeat.map((n) => {
      const next = {
        ...n,
        beat,
        duration: durationBeats,
        durationLabel,
        isDotted,
      };
      delete next.tuplet;
      delete next.beamGroupId;
      return next;
    });
  }

  const removedSet = new Set(removed);
  const atBeatSet = new Set(atBeat);
  let next = list.filter((n) => !removedSet.has(n) && !atBeatSet.has(n));
  next = next.concat(placed);

  const coverageEnd = Math.max(newEnd, oldEnd, removedEnd, releasedEnd);
  if (coverageEnd > newEnd + EPS) next = next.concat(uncoveredRests(next, newEnd, coverageEnd));

  next.sort((a, b) => noteBeat(a) - noteBeat(b));
  return { ok: true, notes: next };
}
