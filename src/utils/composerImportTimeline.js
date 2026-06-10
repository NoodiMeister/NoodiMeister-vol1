/** Lihtsustatud import-sammud kujundaja kasutajale. */

export const COMPOSER_IMPORT_STEPS = {
  notation: [
    'Fail valitud',
    'Loen projekti andmeid',
    'Käivitan noodigraafika renderi',
    'Joonistan noodid, beat-boxid ja sümbolid',
    'Koostan lehekülged',
    'Lisan leheküljed kujundusse',
    'Valmis',
  ],
  notationFallback: [
    'Fail valitud',
    'Loen projekti andmeid',
    'Koostan lihtsustatud eelvaate',
    'Lisan leheküljed kujundusse',
    'Valmis',
  ],
  composerDoc: [
    'Fail valitud',
    'Loen kujunduse andmeid',
    'Avan lehed ja plokid',
    'Valmis',
  ],
  cloudComposer: [
    'Laen faili pilvest',
    'Kontrollin kujunduse vormingut',
    'Avan lehed ja plokid',
    'Valmis',
  ],
  cloudNotation: [
    'Laen faili pilvest',
    'Tuvastan noodiprojekti',
    'Käivitan noodigraafika renderi',
    'Joonistan noodid ja kujundid',
    'Lisan leheküljed kujundusse',
    'Valmis',
  ],
  fileInfo: [
    'Salvestan faili nime',
    'Uuendan faili asukohta',
    'Kirjutan sisu pilve',
    'Valmis',
  ],
};

export const IMPORT_TIMELINE_LABELS = {
  notation: 'Noodiprojekti import',
  notationFallback: 'Noodiprojekti import',
  composerDoc: 'Kujunduse avamine',
  cloudComposer: 'Kujunduse laadimine',
  cloudNotation: 'Noodiprojekti import',
  fileInfo: 'Faili andmete salvestus',
};

export function createComposerImportTimeline(type, stepsOverride) {
  const steps = stepsOverride || COMPOSER_IMPORT_STEPS[type] || ['Töös…', 'Valmis'];
  return {
    type,
    steps,
    current: 0,
    status: 'running',
    detail: '',
    startedAt: Date.now(),
  };
}

export function advanceComposerImportTimeline(prev, stepIndex, detail = '') {
  if (!prev) return prev;
  const max = Math.max(0, prev.steps.length - 1);
  return {
    ...prev,
    current: Math.max(prev.current, Math.min(stepIndex, max)),
    detail: detail || prev.detail,
  };
}

export function finishComposerImportTimeline(prev, ok, detail = '') {
  if (!prev) return prev;
  return {
    ...prev,
    status: ok ? 'done' : 'error',
    current: Math.max(0, prev.steps.length - 1),
    detail: detail || prev.detail,
  };
}

/** Visuaalse ootamise ajal vahelduv detail (render kestab kaua). */
export const NOTATION_RENDER_WAIT_HINTS = [
  'Joonistan beat-boxe…',
  'Paigutan figuure ja glüüfe…',
  'Arvestan akordiridu…',
  'Kontrollin kordusmärke…',
];
