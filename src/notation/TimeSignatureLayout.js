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
  /** First key-sig accidental center X offset from clef’s right edge (negative = closer to clef). Must match TraditionalNotationView. */
  KEY_SIG_FIRST_CENTER_OFFSET_PX: -4,
  /** Horizontal distance between consecutive key-signature accidentals (max 5px). */
  KEY_SIG_STEP_PX: 5,
  /** Rough right extent past last accidental center for SMuFL glyph (Leland ~1 em). */
  KEY_SIG_GLYPH_TAIL_PX: 16,
  /** Clear gap between last key-sig accidental and time signature (no overlap). */
  GAP_AFTER_KEY_SIG_BEFORE_TIME_SIG_PX: 8,
  BEFORE_FIRST_MEASURE_PX: 6,
  FIGURE_BEFORE_FIRST_MEASURE_PX: 14,
};

/** Max horizontal span of key signature from clef’s right edge (for min measure start / layout). */
export function estimateKeySignatureWidthPx(accidentalCount) {
  const n = Math.max(0, Math.min(7, Math.floor(Number(accidentalCount) || 0)));
  if (n === 0) return 0;
  return (
    TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX +
    (n - 1) * TIME_SIG_SPACING.KEY_SIG_STEP_PX +
    TIME_SIG_SPACING.KEY_SIG_GLYPH_TAIL_PX
  );
}

/**
 * Traditsiooniline režiim: taktimõõdu keskpunkti X (sama koordinaat mis renderTimeSignature `x`).
 * Peab olema pärast viimast võtmemärki + selge vahe, et diees/bemoll ja taktimõõt ei kattuks.
 */
export function getTraditionalTimeSignatureX({
  clefX,
  clefWidth = 45,
  keySigCount = 0,
  measureStartX,
}) {
  const n = Math.max(0, Math.min(7, Math.floor(Number(keySigCount) || 0)));
  const clefRightX = clefX + clefWidth;
  const afterClefGap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.AFTER_CLEF_PX);
  const afterKeySigGap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.GAP_AFTER_KEY_SIG_BEFORE_TIME_SIG_PX);
  let baseX;
  if (n === 0) {
    baseX = clefRightX + afterClefGap;
  } else {
    const keySigRightX =
      clefRightX +
      TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX +
      (n - 1) * TIME_SIG_SPACING.KEY_SIG_STEP_PX +
      TIME_SIG_SPACING.KEY_SIG_GLYPH_TAIL_PX;
    baseX = keySigRightX + afterKeySigGap;
  }
  if (typeof measureStartX === 'number' && Number.isFinite(measureStartX)) {
    // Invariant: key signature and time signature must never overlap.
    // If there is not enough room before the first measure start, keep time signature
    // after key signature; caller/layout must provide enough left prefix width.
    const rightBound = Math.max(0, measureStartX - TIME_SIG_SPACING.BEFORE_FIRST_MEASURE_PX);
    return baseX > rightBound ? baseX : rightBound;
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
  return (
    PEDAGOGICAL_REL_KEY_SIG_FIRST_OFFSET_PX +
    Math.max(0, n - 1) * TIME_SIG_SPACING.KEY_SIG_STEP_PX +
    ensureMinGlyphHorizontalGapPx(Math.round(fs * 0.35))
  );
}

/**
 * Pedagoogiline režiim: taktimõõt pärast (valikuline) trad. võtit, võtmemärki ja JO-võtit.
 * clefX = esimese sümboli (trad. võti või võtmemärk või JO) vasak serv.
 */
export function getPedagogicalTimeSignatureX({
  clefX,
  clefColumnWidth = 45,
  showTraditionalClef,
  keySigCount = 0,
  ksFontSize,
  joClefWidthPx,
  measureStartX,
}) {
  const afterClefGap = ensureMinGlyphHorizontalGapPx(TIME_SIG_SPACING.AFTER_CLEF_PX);
  let x = clefX;
  if (showTraditionalClef) x += clefColumnWidth;
  x += getPedagogicalRelativeKeySignatureWidthPx(keySigCount, ksFontSize);
  x += Math.max(0, Number(joClefWidthPx) || 0);
  x += afterClefGap;
  if (typeof measureStartX === 'number' && Number.isFinite(measureStartX)) {
    return Math.min(x, Math.max(0, measureStartX - TIME_SIG_SPACING.BEFORE_FIRST_MEASURE_PX));
  }
  return x;
}
