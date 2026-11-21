/** PDF/OMR confidence and source-type constants (AGENTS: PDF/OMR import). */

export const OMR_CONFIDENCE = {
  HIGH: 0.85,
  MEDIUM: 0.55,
};

export const PDF_SOURCE_TYPE = {
  TEXT_LAYER: 'text-layer',
  PRINTED_SCAN: 'printed-scan',
  HANDWRITTEN: 'handwritten',
};

export const OMR_INSTRUMENT_OPTIONS = [
  { instrumentId: 'piano', name: 'Piano', clefType: 'treble' },
  { instrumentId: 'single-staff-treble', name: 'Meloodia (G-võti)', clefType: 'treble' },
  { instrumentId: 'violin', name: 'Violin', clefType: 'treble' },
  { instrumentId: 'flute', name: 'Flute', clefType: 'treble' },
  { instrumentId: 'clarinet', name: 'Clarinet', clefType: 'treble' },
  { instrumentId: 'voice', name: 'Voice', clefType: 'treble' },
  { instrumentId: 'guitar', name: 'Guitar', clefType: 'treble' },
  { instrumentId: 'bass', name: 'Bass / Cello', clefType: 'bass' },
];

export const OMR_KEY_SIGNATURES = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb'];

export const OMR_NOTATION_MODES = [
  { value: 'traditional', label: 'Traditsiooniline' },
  { value: 'figurenotes', label: 'Figuurnotatsioon' },
  { value: 'pedagogical', label: 'Pedagoogiline' },
];

export const OMR_MAX_PAGES_WITHOUT_CONFIRM = 8;

export function confidenceBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < OMR_CONFIDENCE.MEDIUM) return 'red';
  if (n < OMR_CONFIDENCE.HIGH) return 'yellow';
  return 'green';
}

export function emptyConstraints(overrides = {}) {
  return {
    title: '',
    instrumentId: 'single-staff-treble',
    instrumentName: 'Meloodia (G-võti)',
    clefType: 'treble',
    timeSignature: { beats: 4, beatUnit: 4 },
    keySignature: 'C',
    notationMode: 'traditional',
    sourceType: PDF_SOURCE_TYPE.TEXT_LAYER,
    language: 'et',
    ...overrides,
  };
}
