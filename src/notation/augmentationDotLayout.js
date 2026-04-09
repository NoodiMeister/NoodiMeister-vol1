/**
 * Augmentation dot placement (SMuFL / MuseScore-style defaults from musescoreStyle).
 * Vertical: Gould — on a staff line, sit the dot in the adjacent space above.
 */

import { DOT_NOTE_DISTANCE, DOT_REST_DISTANCE } from './musescoreStyle';
import { getNoteheadRx } from './StaffConstants';
import { ensureMinGlyphHorizontalGapPx } from './glyphSpacing';

const ON_LINE_EPS = 0.12;

/**
 * Staff-local Y for dot center (same coordinate system as pitchY / firstLineY).
 * @param {number} pitchY - notehead center Y on staff
 * @param {number} firstLineY - top staff line Y
 * @param {number} spacing - one staff space (px)
 */
export function getAugmentationDotCenterPitchY(pitchY, firstLineY, spacing) {
  if (spacing <= 0) return pitchY;
  const n = (pitchY - firstLineY) / spacing;
  const k = Math.round(n);
  const onLine = Math.abs(n - k) < ON_LINE_EPS;
  if (!onLine) return pitchY;
  return firstLineY + (k - 0.5) * spacing;
}

export function getAugmentationDotXFromNoteCenter(noteX, staffSpace) {
  const rx = getNoteheadRx(staffSpace);
  return noteX + rx + ensureMinGlyphHorizontalGapPx(DOT_NOTE_DISTANCE * staffSpace);
}

export function getAugmentationDotXFromRestCenter(restCenterX, staffSpace) {
  const rx = getNoteheadRx(staffSpace);
  return restCenterX + rx + ensureMinGlyphHorizontalGapPx(DOT_REST_DISTANCE * staffSpace);
}

/** Middle staff space center (treble 5-line: between lines 2 and 3 from top). */
export function getRestAugmentationDotPitchY(firstLineY, spacing) {
  return firstLineY + 2.5 * spacing;
}
