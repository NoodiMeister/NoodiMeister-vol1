/**
 * Noodimeistri GM sound library — instrument → General MIDI program / soundfont name.
 * Helid hostitakse ise: public/sounds/FluidR3_GM/ (vt scripts/fetch-soundfonts.mjs).
 */

export const SOUNDFONT_PACK = 'FluidR3_GM';
export const SOUNDFONT_FORMAT = 'mp3';
export const SOUNDFONT_PUBLIC_BASE = `/sounds/${SOUNDFONT_PACK}`;

/** Noodimeister instrumentId → GM program number (0–127). */
export const INSTRUMENT_TO_GM_PROGRAM = {
  'single-staff-treble': 0,
  'single-staff-bass': 0,
  boomwhackers: 12,
  handbells: 14,
  'soprano-xylophone': 13,
  'alto-xylophone': 13,
  'bass-xylophone': 13,
  'soprano-metallophone': 9,
  'alto-metallophone': 9,
  'bass-metallophone': 9,
  triangle: 112,
  claves: 115,
  woodblock: 115,
  'temple-blocks': 115,
  castanets: 115,
  shakers: 113,
  maracas: 113,
  bongo: 117,
  conga: 117,
  guiro: 115,
  agogo: 113,
  cowbell: 113,
  cymbals: 119,
  rainstick: 96,
  windchimes: 112,
  sleighbells: 112,
  djembe: 116,
  cajon: 116,
  piano: 0,
  'electric-piano': 4,
  organ: 19,
  harpsichord: 6,
  accordion: 21,
  celesta: 8,
  guitar: 24,
  'ukulele-sopran': 24,
  'ukulele-tenor': 24,
  'ukulele-bariton': 24,
  'ukulele-bass': 32,
  violin: 40,
  viola: 41,
  cello: 42,
  'double-bass': 43,
  'strings-ensemble': 48,
  'acoustic-bass': 32,
  'electric-bass': 33,
  flute: 73,
  recorder: 74,
  clarinet: 71,
  oboe: 68,
  bassoon: 70,
  trumpet: 56,
  trombone: 57,
  tuba: 58,
  'french-horn': 60,
  'tin-whistle': 78,
  'tin-whistle-d': 78,
  'tin-whistle-c': 78,
  'tin-whistle-bb': 78,
  'tin-whistle-a': 78,
  'tin-whistle-g': 78,
  'tin-whistle-f': 78,
  saxophone: 65,
  glockenspiel: 9,
  xylophone: 13,
  marimba: 12,
  vibraphone: 11,
  'synth-lead': 80,
  'synth-pad': 88,
  voice: 52,
};

/**
 * Noodimeister instrumentId → midi-js / soundfont-player instrument name (FluidR3_GM).
 * Klassiruumi/Orff: eristatud GM tämbrid (mitte kõik woodblock).
 */
export const INSTRUMENT_TO_SOUNDFONT_NAME = {
  'single-staff-treble': 'acoustic_grand_piano',
  'single-staff-bass': 'acoustic_grand_piano',
  boomwhackers: 'marimba',
  handbells: 'tubular_bells',
  'soprano-xylophone': 'xylophone',
  'alto-xylophone': 'xylophone',
  'bass-xylophone': 'xylophone',
  'soprano-metallophone': 'glockenspiel',
  'alto-metallophone': 'glockenspiel',
  'bass-metallophone': 'glockenspiel',
  triangle: 'tinkle_bell',
  claves: 'woodblock',
  woodblock: 'woodblock',
  'temple-blocks': 'woodblock',
  castanets: 'woodblock',
  shakers: 'agogo',
  maracas: 'agogo',
  bongo: 'melodic_tom',
  conga: 'melodic_tom',
  guiro: 'woodblock',
  agogo: 'agogo',
  cowbell: 'agogo',
  cymbals: 'reverse_cymbal',
  rainstick: 'fx_1_rain',
  windchimes: 'tinkle_bell',
  sleighbells: 'tinkle_bell',
  djembe: 'taiko_drum',
  cajon: 'taiko_drum',
  piano: 'acoustic_grand_piano',
  'electric-piano': 'electric_piano_1',
  organ: 'church_organ',
  harpsichord: 'harpsichord',
  accordion: 'accordion',
  celesta: 'celesta',
  guitar: 'acoustic_guitar_nylon',
  'ukulele-sopran': 'acoustic_guitar_nylon',
  'ukulele-tenor': 'acoustic_guitar_nylon',
  'ukulele-bariton': 'acoustic_guitar_nylon',
  'ukulele-bass': 'acoustic_bass',
  violin: 'violin',
  viola: 'viola',
  cello: 'cello',
  'double-bass': 'contrabass',
  'strings-ensemble': 'string_ensemble_1',
  'acoustic-bass': 'acoustic_bass',
  'electric-bass': 'electric_bass_finger',
  flute: 'flute',
  recorder: 'recorder',
  clarinet: 'clarinet',
  oboe: 'oboe',
  bassoon: 'bassoon',
  trumpet: 'trumpet',
  trombone: 'trombone',
  tuba: 'tuba',
  'french-horn': 'french_horn',
  'tin-whistle': 'whistle',
  'tin-whistle-d': 'whistle',
  'tin-whistle-c': 'whistle',
  'tin-whistle-bb': 'whistle',
  'tin-whistle-a': 'whistle',
  'tin-whistle-g': 'whistle',
  'tin-whistle-f': 'whistle',
  saxophone: 'alto_sax',
  glockenspiel: 'glockenspiel',
  xylophone: 'xylophone',
  marimba: 'marimba',
  vibraphone: 'vibraphone',
  'synth-lead': 'lead_1_square',
  'synth-pad': 'pad_2_warm',
  voice: 'choir_aahs',
};

export function soundfontNameForInstrumentId(instrumentId) {
  return INSTRUMENT_TO_SOUNDFONT_NAME[instrumentId] || 'acoustic_grand_piano';
}

export function soundfontPackForInstrumentId(_instrumentId) {
  return SOUNDFONT_PACK;
}

export function soundfontUrlForName(name, format = SOUNDFONT_FORMAT) {
  const safe = String(name || 'acoustic_grand_piano').replace(/[^a-z0-9_]/gi, '');
  const fmt = format === 'ogg' ? 'ogg' : 'mp3';
  return `${SOUNDFONT_PUBLIC_BASE}/${safe}-${fmt}.js`;
}

/** soundfont-player nameToUrl: (name, soundfont, format) => url */
export function soundfontNameToUrl(name, _soundfont, format) {
  return soundfontUrlForName(name, format || SOUNDFONT_FORMAT);
}

export function soundfontPlayerCacheKey(instrumentId) {
  return `${String(instrumentId || '')}\0${soundfontPackForInstrumentId(instrumentId)}`;
}

/** Unikaalsed FluidR3_GM nimed, mida fetch-skript peab alla laadima. */
export function listRequiredSoundfontNames() {
  const set = new Set(Object.values(INSTRUMENT_TO_SOUNDFONT_NAME));
  set.add('acoustic_grand_piano');
  return [...set].sort();
}
