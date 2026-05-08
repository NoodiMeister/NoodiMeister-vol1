/**
 * Ühine taktimõõdu kujunduse konstantid (disainüksused).
 * Kõik taktimõõdu joonistused kasutavad neid; vahed skaleeritakse proportsionaalselt
 * (px suurenemisega suurenevad vahed sama suhtega, et välimus püsiks ühtlane).
 *
 * Esimene variant (klassikaline 4/4): lugeja, kriips, nimetaja – Y_NUM, Y_LINE, Y_DEN, LINE_HALF.
 * Kasutus: TraditionalNotationView, FigurenotesView, timeSignatureToolbox (MeterIcon).
 *
 * Teine variant (pedagoogiline 4/4): lugeja, kriips, noodipea+varras – NOTE_X_OFFSET, NOTE_Y, STEM_X_OFFSET, STEM_Y1, STEM_Y2, ELLIPSE_RX, ELLIPSE_RY.
 * Kasutus: TraditionalNotationView, FigurenotesView, timeSignatureToolbox (PedagogicalMeterIcon), noodimeister-complete.jsx (importib toolboxist).
 */
import { MIN_GLYPH_HORIZONTAL_GAP_PX, ensureMinGlyphHorizontalGapPx } from './glyphSpacing';

export const TIME_SIG_LAYOUT = {
  /** Lugeja baseline y (tsentrist) – 3 ühikut kriipsust üles */
  Y_NUM: -11,
  /** Kriipsu y – piisavalt all, et kriips ei läbiks Leland-numbrit */
  Y_LINE: -2,
  /** Nimetaja baseline y (klassikaline 4/4 – esimene variant) */
  Y_DEN: 5,
  /** Kriipsu poollaius (x) */
  LINE_HALF: 10,
  /** Pedagoogiline: noodipea keskpunkti x nihe (tsentrist) */
  NOTE_X_OFFSET: 1,
  /** Pedagoogiline: noodipea keskpunkti y (kriipsust eemal) */
  NOTE_Y: 2.5,
  /** Pedagoogiline: varre x (tsentrist) */
  STEM_X_OFFSET: -3,
  /** Pedagoogiline: varre ülemine y */
  STEM_Y1: 3,
  /** Pedagoogiline: varre alumine y */
  STEM_Y2: 23,
  /** Noodipea ellips rx, ry */
  ELLIPSE_RX: 4,
  ELLIPSE_RY: 2.5,
  /** Täisnoot (beatUnit 1) ellips */
  WHOLE_RX: 5,
  WHOLE_RY: 3,
};

/** MuseScore-like visual spacing: place time signature after clef+key and before first measure content. */
export const TIME_SIG_SPACING = {
  /** Hard floor: minimum horizontal gap between adjacent SMuFL/glyph blocks. */
  MIN_GLYPH_HORIZONTAL_GAP_PX,
  /** Gap after clef column before first key-signature accidental (visual: tuck time sig after key). */
  AFTER_CLEF_PX: 2,
  /** First key-sig accidental center X offset from clef’s right edge (negative = closer to clef, MuseScore-like). */
  KEY_SIG_FIRST_CENTER_OFFSET_PX: -6,
  /** Fallback horizontal distance between consecutive key-signature accidentals. */
  KEY_SIG_STEP_PX: 10,
  /** Rough right extent past last accidental center for SMuFL glyph (Leland ~1 em). */
  KEY_SIG_GLYPH_TAIL_PX: 16,
  /** Clear gap between last key-sig accidental and time signature (no overlap). */
  GAP_AFTER_KEY_SIG_BEFORE_TIME_SIG_PX: 8,
  BEFORE_FIRST_MEASURE_PX: 6,
  FIGURE_BEFORE_FIRST_MEASURE_PX: 14,
};

/**
 * Key-signature accidental step calibrated to `public/reference/key-signature-all-staves.svg`:
 * configurable proportion of staff-space.
 */
export function getKeySignatureStepPx(ksFontSize) {
  const font = Number(ksFontSize);
  if (!Number.isFinite(font) || font <= 0) return TIME_SIG_SPACING.KEY_SIG_STEP_PX;
  const staffSpace = font / 4;
  return Math.max(8, Math.round(staffSpace * 1.5));
}

/** Max horizontal span of key signature from clef’s right edge (for min measure start / layout). */
export function estimateKeySignatureWidthPx(accidentalCount, ksFontSize) {
  const n = Math.max(0, Math.min(7, Math.floor(Number(accidentalCount) || 0)));
  if (n === 0) return 0;
  const stepPx = getKeySignatureStepPx(ksFontSize);
  return (
    TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX +
    (n - 1) * stepPx +
    TIME_SIG_SPACING.KEY_SIG_GLYPH_TAIL_PX
  );
}

/** Ref. staff space (px) — sama mis TraditionalNotationView STAFF_SPACE. */
const TS_STAFF_SPACE_REF = 10;
/** Leland time sig numerator/denominator font at ref. staff space — sama mis TIME_SIG_REFS.FONT_NUM_AT_REF_SP. */
const TS_FONT_NUM_AT_REF_SP = 5.2;
const TS_DEN_FALLBACK_RATIO = 25 / 26;

function timeSigDigitCount(num) {
  const n = Math.max(0, Math.floor(Number(num) || 0));
  return Math.max(1, String(n).length);
}

/** Pool horisontaalset ulatust SMuFL taktimõõdu numbririda keskelt (ligikaudne, veidi konservatiivne). */
function timeSigDigitRunHalfWidthPx(fNum, num) {
  const f = Math.max(8, Math.round(Number(fNum) || 8));
  const spacing = f * 0.5;
  const d = timeSigDigitCount(num);
  const runWidth = (d - 1) * spacing + f * 0.88;
  return runWidth / 2;
}

/**
 * Klassikaline taktimõõt (stacked digits + keskjoon): parem pool keskpunktist kuni visuaalse servani.
 * Kasutatakse nii paigutusreservi kui clamp’i, et taktimõõt ei kattuks esimese takti sisuga.
 */
export function estimateClassicTimeSignatureRightExtentPx(staffSpace, beats, beatUnit) {
  const sp = Math.max(3, Number(staffSpace) || TS_STAFF_SPACE_REF);
  const scale = Math.max(0.3, sp / TS_STAFF_SPACE_REF);
  const fNum = Math.max(8, Math.round(TS_FONT_NUM_AT_REF_SP * sp));
  const fDen = Math.max(8, Math.round(fNum * TS_DEN_FALLBACK_RATIO));
  const lineHalf = TIME_SIG_LAYOUT.LINE_HALF * scale;
  const halfNum = timeSigDigitRunHalfWidthPx(fNum, beats);
  const halfDen = timeSigDigitRunHalfWidthPx(fDen, beatUnit);
  const stackedHalf = Math.max(halfNum, halfDen);
  return Math.max(lineHalf, stackedHalf) + 1;
}

/**
 * Pedagoogiline taktimõõt: parem pool keskpunktist (lugeja + kriips + nimetaja sümbol).
 */
export function estimatePedagogicalTimeSignatureRightExtentPx(staffSpace, beats, beatUnit, pedagogicalOptions = {}) {
  const sp = Math.max(3, Number(staffSpace) || TS_STAFF_SPACE_REF);
  const scale = Math.max(0.3, sp / TS_STAFF_SPACE_REF);
  const fNum = Math.max(8, Math.round(TS_FONT_NUM_AT_REF_SP * sp));
  const L = TIME_SIG_LAYOUT;
  const lineHalf = L.LINE_HALF * scale;
  const halfNum = timeSigDigitRunHalfWidthPx(fNum, beats);
  const noteXOfs = L.NOTE_X_OFFSET * scale;
  const denType = pedagogicalOptions.denominatorType || 'rhythm';

  let denRight = 0;
  if (denType === 'number') {
    const fDen = Math.max(8, Math.round(fNum * TS_DEN_FALLBACK_RATIO));
    denRight = noteXOfs + timeSigDigitRunHalfWidthPx(fDen, beatUnit);
  } else if (denType === 'emoji') {
    const fs = Math.max(8, Math.max(18 * scale, Math.round(fNum * TS_DEN_FALLBACK_RATIO)));
    denRight = noteXOfs + fs * 0.55;
  } else if (denType === 'instrument') {
    denRight = noteXOfs + 10 * scale;
  } else {
    const bu = Math.floor(Number(beatUnit) || 4);
    if (bu === 1) denRight = noteXOfs + L.WHOLE_RX * scale + 1;
    else if (bu === 2 || bu === 4 || bu === 8 || bu === 16) denRight = noteXOfs + L.ELLIPSE_RX * scale + 3 * scale;
    else {
      const fDen = Math.max(8, Math.round(fNum * TS_DEN_FALLBACK_RATIO));
      denRight = noteXOfs + timeSigDigitRunHalfWidthPx(fDen, bu);
    }
  }
  return Math.max(lineHalf, halfNum, denRight) + 1;
}

/**
 * Traditsiooniline režiim: eelistatud taktimõõdu kesk-X (enne esimese takti serva clamp’i).
 */
export function getTraditionalTimeSignaturePreferredX({ clefX, clefWidth = 45, keySigCount = 0, ksFontSize }) {
  const n = Math.max(0, Math.min(7, Math.floor(Number(keySigCount) || 0)));
  const stepPx = getKeySignatureStepPx(ksFontSize);
  const clefRightX = clefX + clefWidth;
  const afterClefGap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.AFTER_CLEF_PX);
  const afterKeySigGap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.GAP_AFTER_KEY_SIG_BEFORE_TIME_SIG_PX);
  if (n === 0) {
    return clefRightX + afterClefGap;
  }
  const keySigRightX =
    clefRightX +
    TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX +
    (n - 1) * stepPx +
    TIME_SIG_SPACING.KEY_SIG_GLYPH_TAIL_PX;
  return keySigRightX + afterKeySigGap;
}

/**
 * Traditsiooniline režiim: taktimõõdu keskpunkti X (sama koordinaat mis renderTimeSignature `x`).
 * Peab olema pärast viimast võtmemärki + selge vahe, et diees/bemoll ja taktimõõt ei kattuks.
 * Kui `measureStartX` on antud, ei tohi taktimõõt ulatuda esimese takti algusesse (overlap noodiga).
 */
export function getTraditionalTimeSignatureX({
  clefX,
  clefWidth = 45,
  keySigCount = 0,
  ksFontSize,
  measureStartX,
  staffSpace = TS_STAFF_SPACE_REF,
  beats = 4,
  beatUnit = 4,
}) {
  const baseX = getTraditionalTimeSignaturePreferredX({ clefX, clefWidth, keySigCount, ksFontSize });
  if (typeof measureStartX === 'number' && Number.isFinite(measureStartX)) {
    const gap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.BEFORE_FIRST_MEASURE_PX);
    const rightEx = estimateClassicTimeSignatureRightExtentPx(staffSpace, beats, beatUnit);
    return Math.min(baseX, measureStartX - gap - rightEx);
  }
  return baseX;
}

export function getFigureTimeSignatureX(measureStartX, fallbackX = 45) {
  if (typeof measureStartX !== 'number' || !Number.isFinite(measureStartX)) return fallbackX;
  return Math.max(12, measureStartX - TIME_SIG_SPACING.FIGURE_BEFORE_FIRST_MEASURE_PX);
}

/** Pedagoogiline (suhteline) võtmemärk: horisontaalne ulatus pärast võtmekolonni algust — sama arvutus mis TraditionalNotationView. */
const PEDAGOGICAL_REL_KEY_SIG_FIRST_OFFSET_PX = -4;

export function getPedagogicalRelativeKeySignatureWidthPx(ksCount, ksFontSize) {
  const n = Math.max(0, Math.floor(Number(ksCount) || 0));
  if (n === 0) return 0;
  const fs = Number(ksFontSize) || 16;
  const stepPx = getKeySignatureStepPx(fs);
  return (
    PEDAGOGICAL_REL_KEY_SIG_FIRST_OFFSET_PX +
    Math.max(0, n - 1) * stepPx +
    ensureMinGlyphHorizontalGapPx(Math.round(fs * 0.35))
  );
}

/**
 * Pedagoogiline režiim: eelistatud taktimõõdu kesk-X (enne clamp’i).
 * clefX = esimese sümboli (trad. võti või võtmemärk või JO) vasak serv.
 */
export function getPedagogicalTimeSignaturePreferredX({
  clefX,
  clefColumnWidth = 45,
  showTraditionalClef,
  keySigCount = 0,
  ksFontSize,
  joClefWidthPx,
}) {
  const afterClefGap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.AFTER_CLEF_PX);
  let x = clefX;
  if (showTraditionalClef) x += clefColumnWidth;
  x += getPedagogicalRelativeKeySignatureWidthPx(keySigCount, ksFontSize);
  x += Math.max(0, Number(joClefWidthPx) || 0);
  x += afterClefGap;
  return x;
}

/**
 * Pedagoogiline režiim: taktimõõt pärast (valikuline) trad. võtit, võtmemärki ja JO-võtit.
 */
export function getPedagogicalTimeSignatureX({
  clefX,
  clefColumnWidth = 45,
  showTraditionalClef,
  keySigCount = 0,
  ksFontSize,
  joClefWidthPx,
  measureStartX,
  staffSpace = TS_STAFF_SPACE_REF,
  beats = 4,
  beatUnit = 4,
  pedagogicalDenominatorType = 'rhythm',
}) {
  const x = getPedagogicalTimeSignaturePreferredX({
    clefX,
    clefColumnWidth,
    showTraditionalClef,
    keySigCount,
    ksFontSize,
    joClefWidthPx,
  });
  if (typeof measureStartX === 'number' && Number.isFinite(measureStartX)) {
    const gap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.BEFORE_FIRST_MEASURE_PX);
    const rightEx = estimatePedagogicalTimeSignatureRightExtentPx(staffSpace, beats, beatUnit, {
      denominatorType: pedagogicalDenominatorType,
    });
    return Math.min(x, Math.max(0, measureStartX - gap - rightEx));
  }
  return x;
}
