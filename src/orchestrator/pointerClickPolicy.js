/**
 * Pointer-click → selection → toolbox poliitika (Noodimeistri standard).
 * Üks koht, kust tuleneb, milline toolbox avaneb valiku peale.
 *
 * @see docs/selection-state-machine.md
 * @see AGENTS.md — Standard: pointer click selection
 */

/** Runtime kind'id (legacy + AGENTS ühilduvus). */
export const SELECTION_KIND = Object.freeze({
  NONE: 'none',
  NOTE: 'note', // AGENTS: singleNote
  RANGE: 'range', // AGENTS: noteRange
  MEASURE_RANGE: 'measureRange',
  SINGLE_OBJECT: 'singleObject',
  OBJECT_LIST: 'objectList',
});

/** singleObject.objectType väärtused. */
export const SCORE_OBJECT_TYPE = Object.freeze({
  BARLINE: 'barline',
  BARLINE_FINAL: 'barlineFinal',
  BARLINE_SINGLE: 'barlineSingle',
  REPEAT_START: 'repeatStart',
  REPEAT_END: 'repeatEnd',
  SEGNO: 'segno',
  CODA: 'coda',
  VOLTA1: 'volta1',
  VOLTA2: 'volta2',
  CLEF: 'clef',
  CHORD_SYMBOL: 'chordSymbol',
  TEXT_BOX: 'textBox',
  TITLE: 'title',
  AUTHOR: 'author',
  LYRICS: 'lyrics',
});

const BARLINE_FAMILY = new Set([
  SCORE_OBJECT_TYPE.BARLINE,
  SCORE_OBJECT_TYPE.BARLINE_FINAL,
  SCORE_OBJECT_TYPE.BARLINE_SINGLE,
  SCORE_OBJECT_TYPE.REPEAT_START,
  SCORE_OBJECT_TYPE.REPEAT_END,
  SCORE_OBJECT_TYPE.SEGNO,
  SCORE_OBJECT_TYPE.CODA,
  SCORE_OBJECT_TYPE.VOLTA1,
  SCORE_OBJECT_TYPE.VOLTA2,
]);

const TEXT_FAMILY = new Set([
  SCORE_OBJECT_TYPE.TEXT_BOX,
  SCORE_OBJECT_TYPE.TITLE,
  SCORE_OBJECT_TYPE.AUTHOR,
  SCORE_OBJECT_TYPE.LYRICS,
]);

/**
 * Kas markType kuulub taktijoonte / korduste / hüpete perekonda.
 * @param {string} markType
 */
export function isBarlineFamilyMark(markType) {
  return BARLINE_FAMILY.has(markType);
}

/**
 * Selection → toolbox id (või null = ära sunni toolbox'i).
 * @param {{ kind: string, objectType?: string }} selection
 * @returns {string | null}
 */
export function toolboxIdForSelection(selection) {
  if (!selection || typeof selection !== 'object') return null;
  switch (selection.kind) {
    case SELECTION_KIND.NOTE:
    case SELECTION_KIND.RANGE:
    case 'singleNote':
    case 'noteRange':
      return 'rhythm';
    case SELECTION_KIND.MEASURE_RANGE:
      return 'layout';
    case SELECTION_KIND.SINGLE_OBJECT: {
      const t = selection.objectType;
      if (isBarlineFamilyMark(t)) return 'repeatsJumps';
      if (t === SCORE_OBJECT_TYPE.CLEF) return 'clefs';
      if (t === SCORE_OBJECT_TYPE.CHORD_SYMBOL) return 'chords';
      if (TEXT_FAMILY.has(t)) return 'textBox';
      return null;
    }
    case SELECTION_KIND.OBJECT_LIST: {
      const first = Array.isArray(selection.objects) ? selection.objects[0] : null;
      if (!first) return null;
      return toolboxIdForSelection({ kind: SELECTION_KIND.SINGLE_OBJECT, objectType: first.objectType || first.markType });
    }
    default:
      return null;
  }
}

/**
 * Kas note-klikk peab avama N-mode (plain click; mitte Shift-range ega lyric-click).
 * MuseScore: klikk noodile = note select (+ sisestusrežiim); klikk tühjale taktile = bar select.
 * @param {{ shiftKey?: boolean, __nmLyricClick?: boolean } | null | undefined} eventLike
 * @param {{ cursorTool?: string }} ctx
 */
export function shouldEnterNoteInputOnNoteClick(eventLike, ctx = {}) {
  if (eventLike?.shiftKey) return false;
  if (eventLike?.__nmLyricClick) return false;
  if (ctx.cursorTool === 'type') return false;
  return true;
}

/**
 * Hit-test poliitika (dokumentatsioon + view’ide `data-nm-*-hit`):
 * - `data-nm-note-hit` peal → note/range selection
 * - `data-nm-measure-hit` (tühi takt) → measureRange
 */

/**
 * Ehita singleObject selection taktijoonte/korduste jaoks.
 * @param {number} measureIndex
 * @param {string} markType
 */
export function selectionForBarlineMark(measureIndex, markType) {
  return {
    kind: SELECTION_KIND.SINGLE_OBJECT,
    objectType: markType,
    measureIndex,
    markType,
  };
}

/**
 * @param {number} measureIndex
 */
export function selectionForMeasure(measureIndex) {
  return {
    kind: SELECTION_KIND.MEASURE_RANGE,
    anchorMeasure: measureIndex,
    focusMeasure: measureIndex,
  };
}

/**
 * @param {number} noteIndex
 */
export function selectionForNote(noteIndex) {
  return { kind: SELECTION_KIND.NOTE, index: noteIndex };
}

/**
 * @param {{ staffId?: string, clefType?: string }} payload
 */
export function selectionForClef(payload = {}) {
  return {
    kind: SELECTION_KIND.SINGLE_OBJECT,
    objectType: SCORE_OBJECT_TYPE.CLEF,
    staffId: payload.staffId ?? null,
    clefType: payload.clefType ?? null,
  };
}

/**
 * @param {{ id?: string, objectType?: string }} payload
 */
export function selectionForText(payload = {}) {
  return {
    kind: SELECTION_KIND.SINGLE_OBJECT,
    objectType: payload.objectType || SCORE_OBJECT_TYPE.TEXT_BOX,
    id: payload.id ?? null,
  };
}

/** Toolbox’id, mis avanevad pointer-selectionist (deselect võib need sulgeda). */
export const SELECTION_DRIVEN_TOOLBOX_IDS = Object.freeze([
  'layout',
  'repeatsJumps',
  'clefs',
  'chords',
  'textBox',
  'rhythm',
]);

/**
 * @param {{ id?: *, beatPosition?: number, chord?: string }} payload
 */
export function selectionForChordSymbol(payload = {}) {
  return {
    kind: SELECTION_KIND.SINGLE_OBJECT,
    objectType: SCORE_OBJECT_TYPE.CHORD_SYMBOL,
    id: payload.id ?? null,
    beatPosition: Number.isFinite(Number(payload.beatPosition)) ? Number(payload.beatPosition) : null,
    chord: payload.chord != null ? String(payload.chord) : '',
  };
}

/**
 * Kas deselect peab sulgema aktiivse toolbox’i.
 * N-mode + rhythm jääb lahti (õpetaja jätkab sisestust); objektitööriistad sulguvad.
 * @param {string | null | undefined} toolboxId
 * @param {{ noteInputMode?: boolean }} [ctx]
 */
export function shouldCloseToolboxOnDeselect(toolboxId, ctx = {}) {
  if (!toolboxId) return false;
  if (!SELECTION_DRIVEN_TOOLBOX_IDS.includes(toolboxId)) return false;
  if (ctx.noteInputMode && toolboxId === 'rhythm') return false;
  return true;
}

/**
 * Kas teine klikk samale objektile peab deselectima (toggle).
 * @param {{ kind?: string, measureIndex?: number, markType?: string, objectType?: string, index?: number, anchorMeasure?: number, focusMeasure?: number }} current
 * @param {{ kind: string, measureIndex?: number, markType?: string, objectType?: string, index?: number, anchorMeasure?: number, focusMeasure?: number }} next
 */
export function isSamePointerTarget(current, next) {
  if (!current || !next || current.kind === 'none' || next.kind === 'none') return false;
  if (current.kind === 'measureRange' && next.kind === 'measureRange') {
    const cStart = Math.min(current.anchorMeasure, current.focusMeasure);
    const cEnd = Math.max(current.anchorMeasure, current.focusMeasure);
    const nStart = Math.min(next.anchorMeasure, next.focusMeasure);
    const nEnd = Math.max(next.anchorMeasure, next.focusMeasure);
    return cStart === nStart && cEnd === nEnd;
  }
  if (current.kind === 'note' && next.kind === 'note') {
    return current.index === next.index;
  }
  if (current.kind === 'singleObject' && next.kind === 'singleObject') {
    const cType = current.objectType || current.markType;
    const nType = next.objectType || next.markType;
    if (cType !== nType) return false;
    if (cType === SCORE_OBJECT_TYPE.CLEF) return true;
    if (cType === SCORE_OBJECT_TYPE.TEXT_BOX) return (current.id ?? null) === (next.id ?? null);
    if (cType === SCORE_OBJECT_TYPE.CHORD_SYMBOL) return (current.id ?? null) === (next.id ?? null);
    if (Number.isInteger(current.measureIndex) && Number.isInteger(next.measureIndex)) {
      return current.measureIndex === next.measureIndex;
    }
    return true;
  }
  return false;
}
