const NOTE_BASE_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const TIN_WHISTLE_RANGE_BY_KEY = {
  // D whistle written range: D4 fundamental bottom; fingering chart matches concert lettering.
  D: ['D4', 'C#7'],
  C: ['C5', 'B6'],
  Bb: ['Bb4', 'A6'],
  A: ['A4', 'G#6'],
  G: ['G4', 'F#6'],
  F: ['F4', 'E6'],
  Eb: ['Eb4', 'D6'],
};

export function noteNameToMidi(noteName) {
  const m = String(noteName || '').trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return null;
  const letter = m[1].toUpperCase().replace('H', 'B');
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  const base = NOTE_BASE_SEMITONE[letter];
  if (!Number.isFinite(octave) || base == null) return null;
  return (octave + 1) * 12 + base + accidental;
}

export function toNoteMidi(pitch, octave, accidental = 0) {
  const letter = String(pitch || '').toUpperCase().replace('H', 'B');
  const base = NOTE_BASE_SEMITONE[letter];
  if (base == null || !Number.isFinite(Number(octave))) return null;
  const acc = Number.isFinite(Number(accidental)) ? Number(accidental) : 0;
  return (Number(octave) + 1) * 12 + base + acc;
}

function normalizeRangePair(range) {
  if (Array.isArray(range) && range.length === 2) return range;
  if (typeof range === 'string' && range.includes('-')) {
    const [low, high] = range.split('-').map((s) => String(s || '').trim()).filter(Boolean);
    if (low && high) return [low, high];
  }
  return null;
}

export function resolveInstrumentRange(instrumentId, keySignature, instrumentRange) {
  const id = String(instrumentId || '');
  if (id === 'tin-whistle' || id.startsWith('tin-whistle-')) {
    const whistleKey = id === 'tin-whistle' ? 'D' : id.slice('tin-whistle-'.length);
    const normalizedKey = whistleKey === 'bb' ? 'Bb' : whistleKey === 'eb' ? 'Eb' : whistleKey.toUpperCase();
    return TIN_WHISTLE_RANGE_BY_KEY[normalizedKey] ?? TIN_WHISTLE_RANGE_BY_KEY[keySignature] ?? TIN_WHISTLE_RANGE_BY_KEY.D;
  }
  return normalizeRangePair(instrumentRange);
}

export function resolveInstrumentRangeMidi(instrumentId, keySignature, instrumentRange) {
  const range = resolveInstrumentRange(instrumentId, keySignature, instrumentRange);
  if (!range) return null;
  const [low, high] = range;
  const lowMidi = noteNameToMidi(low);
  const highMidi = noteNameToMidi(high);
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return null;
  return { low: Math.min(lowMidi, highMidi), high: Math.max(lowMidi, highMidi) };
}

export function isMidiOutOfInstrumentRange(midi, rangeMidi) {
  if (!rangeMidi || !Number.isFinite(midi)) return false;
  return midi < rangeMidi.low || midi > rangeMidi.high;
}
