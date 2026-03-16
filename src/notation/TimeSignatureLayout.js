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
