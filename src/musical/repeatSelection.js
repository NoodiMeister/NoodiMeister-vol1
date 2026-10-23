/**
 * MuseScore-laadne "R = repeat selection": dubleeri valitud ajapiirkond kohe järele.
 * Sisestus nihutab järgnevat sisu edasi (ei overwrite’i) — taktidel tekib lisa takt(e).
 */

import { insertBeatGapIntoStaffNotes, insertBeatGapIntoChords } from './measureProperties.js';

const EPS = 1e-6;

/**
 * MuseScore-laadne hit-test eristus:
 * - klikk noodipea hit-alale → note select
 * - klikk takti tühjale alale (väljaspool noodi hit’i) → measure select
 */
export const NOTE_POINTER_HIT = Object.freeze({
  /** Traditsiooniline noodipea / pausi tabamisala (SVG px umbes staffSpace~12). */
  traditionalHalfW: 18,
  traditionalHalfH: 22,
  /** Figuurnoodi ploki tabamisala. */
  figurenotesHalfW: 22,
  figurenotesHalfH: 26,
});

/** Absoluutne alguslöök noodi indeksil (toetab nii beat-välja kui järjestikust kestust). */
export function beatAtNoteIndex(staffNotes, index) {
  if (index < 0 || index >= (staffNotes?.length ?? 0)) return 0;
  let beat = 0;
  for (let i = 0; i < staffNotes.length; i++) {
    const n = staffNotes[i];
    const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
    if (i === index) return noteBeat;
    beat = noteBeat + (Number(n.duration) || 1);
  }
  return beat;
}

/**
 * Taktindeks noodi indeksist (takti startBeat/endBeat järgi).
 * @returns {number} -1 kui ei leia
 */
export function measureIndexForNoteIndex(staffNotes, measures, noteIndex) {
  if (!Array.isArray(measures) || measures.length === 0) return -1;
  const beat = beatAtNoteIndex(staffNotes, noteIndex);
  const i = measures.findIndex((m) => beat >= m.startBeat - EPS && beat < m.endBeat - EPS);
  if (i >= 0) return i;
  const last = measures[measures.length - 1];
  if (last && beat >= last.startBeat - EPS && beat <= last.endBeat + EPS) return measures.length - 1;
  return -1;
}

/** Nootide indeksid, mille algus jääb takti [startBeat, endBeat). */
export function noteIndicesInMeasure(staffNotes, measure) {
  if (!measure) return [];
  const blockStart = Number(measure.startBeat) || 0;
  const blockEnd = Number(measure.endBeat) || blockStart;
  const out = [];
  let run = 0;
  (staffNotes || []).forEach((n, i) => {
    const s = typeof n.beat === 'number' ? n.beat : run;
    const dur = Number(n.duration) || 1;
    run = s + dur;
    if (s >= blockStart - EPS && s < blockEnd - EPS) out.push(i);
  });
  return out;
}

/**
 * Plain left-drag: ära ületa taktipiiri. Shift lubab üle takti.
 * Kui focus on väljaspool ankru takti, klambi ankru takti äärmise noodini (sama suund).
 */
export function clampNoteIndexToAnchorMeasure(staffNotes, measures, anchorIndex, focusIndex) {
  if (!Number.isInteger(anchorIndex) || !Number.isInteger(focusIndex)) return focusIndex;
  if (anchorIndex === focusIndex) return focusIndex;
  const mi = measureIndexForNoteIndex(staffNotes, measures, anchorIndex);
  if (mi < 0 || !measures?.[mi]) return focusIndex;
  const idxs = noteIndicesInMeasure(staffNotes, measures[mi]);
  if (idxs.length === 0) return anchorIndex;
  if (idxs.includes(focusIndex)) return focusIndex;
  if (focusIndex > anchorIndex) return idxs[idxs.length - 1];
  return idxs[0];
}

/**
 * Valitud noodiindeksite [startIdx..endIdx] suhteline koopia + span.
 * @returns {{ spanBeats: number, notes: object[], startBeat: number, endBeat: number } | null}
 */
export function extractNoteIndexRangeRelative(staffNotes, startIdx, endIdx) {
  const arr = staffNotes || [];
  if (!arr.length) return null;
  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  if (lo < 0 || hi >= arr.length) return null;
  const startBeat = beatAtNoteIndex(arr, lo);
  const endNoteStart = beatAtNoteIndex(arr, hi);
  const endBeat = endNoteStart + (Number(arr[hi].duration) || 1);
  const spanBeats = endBeat - startBeat;
  if (spanBeats <= EPS) return null;
  const notes = [];
  for (let i = lo; i <= hi; i++) {
    const abs = beatAtNoteIndex(arr, i);
    const { id: _id, ...rest } = arr[i] || {};
    notes.push({ ...rest, beat: abs - startBeat });
  }
  return { spanBeats, notes, startBeat, endBeat };
}

/**
 * Võta kõik noodid [blockStart, blockEnd) suhteliste beat’idega.
 */
export function extractBeatRangeRelative(staffNotes, blockStart, blockEnd) {
  const span = blockEnd - blockStart;
  if (span <= EPS) return [];
  let run = 0;
  const out = [];
  for (const n of staffNotes || []) {
    const s = typeof n.beat === 'number' ? n.beat : run;
    const dur = Number(n.duration) || 1;
    run = s + dur;
    if (s >= blockStart - EPS && s < blockEnd - EPS) {
      const { id: _id, ...rest } = n;
      out.push({ ...rest, beat: s - blockStart });
    }
  }
  return out;
}

export function extractChordsBeatRangeRelative(chordList, blockStart, blockEnd) {
  return (chordList || [])
    .filter((c) => {
      const p = Number(c.beatPosition) || 0;
      return p >= blockStart - EPS && p < blockEnd - EPS;
    })
    .map((c) => ({ ...c, beatPosition: (Number(c.beatPosition) || 0) - blockStart }));
}

/**
 * Nihuta ajatelge `insertAt` pealt `spanBeats` võrra ja kleebi suhtelised noodid sinna.
 */
export function applyRepeatAfterBeat(staffNotes, insertAt, spanBeats, relativeNotes) {
  const withGap = insertBeatGapIntoStaffNotes(staffNotes || [], insertAt, spanBeats);
  const incoming = (relativeNotes || []).map((n) => ({
    ...n,
    beat: insertAt + (Number(n.beat) || 0),
    id: Date.now() + Math.random(),
  }));
  return [...withGap, ...incoming].sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
}

export function applyRepeatChordsAfterBeat(chordList, insertAt, spanBeats, relativeChords) {
  const withGap = insertBeatGapIntoChords(chordList || [], insertAt, spanBeats);
  const incoming = (relativeChords || []).map((c) => ({
    ...c,
    beatPosition: insertAt + (Number(c.beatPosition) || 0),
  }));
  return [...withGap, ...incoming].sort(
    (a, b) => (a.beatPosition || 0) - (b.beatPosition || 0),
  );
}

/** Indeksid, mille noodi algus jääb [rangeStart, rangeEnd). */
export function findNoteIndicesInBeatRange(staffNotes, rangeStart, rangeEnd) {
  let run = 0;
  const indices = [];
  (staffNotes || []).forEach((n, i) => {
    const s = typeof n.beat === 'number' ? n.beat : run;
    const dur = Number(n.duration) || 1;
    run = s + dur;
    if (s >= rangeStart - EPS && s < rangeEnd - EPS) indices.push(i);
  });
  return indices;
}
