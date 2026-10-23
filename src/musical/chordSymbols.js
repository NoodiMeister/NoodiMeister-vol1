/**
 * Akordimärgid (chord symbols): jagatud timeline `chords[]` abid.
 * Traditional = MuseScore-laadne inline kirjutamine; figurenotes = akordirida/plokid.
 * Sisestus-UX elab orkestreerijas; siin ainult deterministlikud puhtad funktsioonid.
 */

const EPS = 1e-6;

/**
 * Normaliseeri tipitud / paleti akordistring (C, Dm, m+C → Cm, 7+G → G7).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeChordSymbol(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('+')) {
    const [prefixRaw, noteRaw] = s.split('+');
    const type = String(prefixRaw || '').trim().toLowerCase();
    const notePart = String(noteRaw || '').trim();
    if (!notePart) return s;
    const base = notePart.charAt(0).toUpperCase() + notePart.slice(1);
    if (type === 'm') return `${base}m`;
    if (type === '7') return `${base}7`;
    return base;
  }
  if (/^[a-gA-G]$/.test(s)) {
    return s.toUpperCase();
  }
  if (/^[a-gA-G][#b]?$/.test(s)) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Freeform MuseScore-like: keep quality/bass, capitalize root letter.
  const m = s.match(/^([a-gA-GHh])([#b]?)(.*)$/);
  if (m) {
    const root = m[1].toUpperCase() === 'H' ? 'B' : m[1].toUpperCase();
    return `${root}${m[2] || ''}${m[3] || ''}`;
  }
  return s;
}

/**
 * Leia akord täpselt beatPosition'il (EPS).
 * @param {Array<{ id?: *, beatPosition?: number, chord?: string }>} chords
 * @param {number} beat
 */
export function findChordAtBeat(chords, beat) {
  const b = Number(beat);
  if (!Number.isFinite(b) || !Array.isArray(chords)) return undefined;
  return chords.find((c) => Math.abs((Number(c.beatPosition) || 0) - b) <= EPS);
}

/**
 * Leia akord id järgi.
 * @param {Array<{ id?: * }>} chords
 * @param {*} chordId
 */
export function findChordById(chords, chordId) {
  if (chordId == null || !Array.isArray(chords)) return undefined;
  return chords.find((c) => c && c.id === chordId);
}

/**
 * Asenda / lisa akord beat'il; tagasta uus sorteeritud massiiv (immutable).
 * @param {Array} chords
 * @param {{ beatPosition: number, chord: string, figuredBass?: string, durationBeats?: number, id?: * }} entry
 */
export function commitChordAtBeat(chords, entry) {
  const beat = Math.max(0, Number(entry?.beatPosition) || 0);
  const chordText = normalizeChordSymbol(entry?.chord);
  if (!chordText) {
    return Array.isArray(chords) ? chords.slice() : [];
  }
  const prev = Array.isArray(chords) ? chords : [];
  const next = prev.filter((c) => Math.abs((Number(c.beatPosition) || 0) - beat) > EPS);
  const durationBeats = Number(entry?.durationBeats);
  const newChord = {
    id: entry?.id ?? `chord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    beatPosition: beat,
    chord: chordText,
    figuredBass: entry?.figuredBass ? String(entry.figuredBass).trim() : '',
    ...(Number.isFinite(durationBeats) && durationBeats > 0 ? { durationBeats: Math.max(0.125, durationBeats) } : {}),
  };
  next.push(newChord);
  next.sort((a, b) => (Number(a.beatPosition) || 0) - (Number(b.beatPosition) || 0));
  return next;
}

/**
 * Eemalda akord id või beat järgi.
 * @param {Array} chords
 * @param {{ chordId?: *, beat?: number }} target
 */
export function removeChordSymbol(chords, target = {}) {
  const prev = Array.isArray(chords) ? chords : [];
  if (target.chordId != null) {
    return prev.filter((c) => c?.id !== target.chordId);
  }
  if (Number.isFinite(Number(target.beat))) {
    const beat = Number(target.beat);
    return prev.filter((c) => Math.abs((Number(c.beatPosition) || 0) - beat) > EPS);
  }
  return prev.slice();
}

/**
 * Absoluutne alguslöök noodi indeksil (toetab beat-välja või järjestikust kestust).
 * @param {Array} staffNotes
 * @param {number} index
 */
function beatAtNoteIndexLocal(staffNotes, index) {
  if (index < 0 || index >= (staffNotes?.length ?? 0)) return 0;
  let beat = 0;
  for (let i = 0; i < staffNotes.length; i++) {
    const n = staffNotes[i];
    const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
    if (i === index) return noteBeat;
    beat = noteBeat + (Number(n.duration) || 1);
  }
  return beat;
}

/**
 * MuseScore Space/Tab: järgmise helilise noodi beat; kui puudub → fromBeat + stepBeats.
 * @param {Array} notes
 * @param {number} fromBeat
 * @param {{ stepBeats?: number }} [opts]
 * @returns {number}
 */
export function nextChordAdvanceBeat(notes, fromBeat, opts = {}) {
  const from = Number(fromBeat) || 0;
  const step = Number.isFinite(Number(opts.stepBeats)) && Number(opts.stepBeats) > 0
    ? Number(opts.stepBeats)
    : 1;
  const arr = Array.isArray(notes) ? notes : [];
  let best = null;
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    if (!n || n.isRest) continue;
    const b = beatAtNoteIndexLocal(arr, i);
    if (b > from + EPS && (best == null || b < best)) best = b;
  }
  if (best != null) return best;
  return Math.max(0, from + step);
}

/**
 * Kas klahv on lubatud akordimärgi tippimisel (MuseScore-laadne vaba tekst).
 * @param {KeyboardEvent | { key?: string, code?: string }} e
 */
export function isChordSymbolTypingKey(e) {
  const key = String(e?.key ?? '');
  if (key.length === 1) {
    // Letters, digits, # b / ( ) + - . ° Δ etc. common in chord symbols
    if (/^[a-zA-Z0-9#bB\/\(\)\+\-\.°,ΔøØ]$/.test(key)) return true;
    // Allow lowercase accidental 'b' already covered; also '#'
    return false;
  }
  return false;
}
