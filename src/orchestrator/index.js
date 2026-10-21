/**
 * Keskne mootor – ühtne sissepääs orkestratorile ja NotationContextile.
 */
export { NotationOrchestrator, getPitchFromMidi } from './NotationOrchestrator';
export { useNotation, useNotationOptional, NotationProvider, DURATIONS, getEffectiveDuration } from '../store/NotationContext';
export {
  SELECTION_KIND,
  SCORE_OBJECT_TYPE,
  SELECTION_DRIVEN_TOOLBOX_IDS,
  toolboxIdForSelection,
  shouldEnterNoteInputOnNoteClick,
  shouldCloseToolboxOnDeselect,
  isSamePointerTarget,
  selectionForBarlineMark,
  selectionForMeasure,
  selectionForNote,
  selectionForClef,
  selectionForText,
  isBarlineFamilyMark,
} from './pointerClickPolicy';
