/**
 * Traditsioonilise meetodi alamrežiim: vorm + akordid (instrumendivalik töö loomisel).
 * Ei ole pillispetsiifiline — `form-chords` on töö tüübi marker instrumentide nimekirjas.
 */

export const HARMONY_FORM_INSTRUMENT_ID = 'form-chords';

export function isHarmonyFormInstrument(instrumentId, instrumentConfig = {}) {
  if (!instrumentId) return false;
  if (instrumentId === HARMONY_FORM_INSTRUMENT_ID) return true;
  const cfg = instrumentConfig[instrumentId];
  return cfg?.type === 'harmonyForm';
}

/** Taktis olevate löögiühikute arv (veerandnootide kestuses). */
export function getMeasureBeatCount(timeSignature) {
  const beats = Math.max(1, Number(timeSignature?.beats) || 4);
  const beatUnit = Math.max(1, Number(timeSignature?.beatUnit) || 4);
  return beats * (4 / beatUnit);
}

/** Akordi sisestusruudu laius löökides (1 … takt). */
export function normalizeHarmonyChordBeatStep(step, timeSignature) {
  const measureBeats = getMeasureBeatCount(timeSignature);
  const n = Number(step);
  if (!Number.isFinite(n) || n <= 0) return measureBeats;
  return Math.max(1, Math.min(measureBeats, n));
}

/** Löökide sammud, mida kasutaja saab valida (1, 2, pool taktist, terve takt jne). */
export function getHarmonyChordBeatStepOptions(timeSignature) {
  const measureBeats = getMeasureBeatCount(timeSignature);
  const raw = [1, 2, 3, 4, measureBeats];
  const uniq = [...new Set(raw.map((v) => Math.round(v * 1000) / 1000))].filter((v) => v >= 1 && v <= measureBeats);
  return uniq.sort((a, b) => a - b);
}

/** Ümardab beat-positsiooni lähimasse akordiruudu algusesse. */
export function snapBeatToHarmonyChordGrid(beat, stepBeats, timeSignature) {
  const step = normalizeHarmonyChordBeatStep(stepBeats, timeSignature);
  const b = Math.max(0, Number(beat) || 0);
  const measureBeats = getMeasureBeatCount(timeSignature);
  const measureIndex = Math.floor(b / measureBeats);
  const local = b - measureIndex * measureBeats;
  const slotIndex = Math.round(local / step);
  const maxSlot = Math.max(0, Math.floor((measureBeats - 1e-6) / step));
  const clampedSlot = Math.min(maxSlot, Math.max(0, slotIndex));
  return measureIndex * measureBeats + clampedSlot * step;
}

/** Järgmine akordiruut pärast sisestust. */
export function advanceHarmonyChordBeat(beat, stepBeats, timeSignature) {
  const step = normalizeHarmonyChordBeatStep(stepBeats, timeSignature);
  return snapBeatToHarmonyChordGrid(beat, stepBeats, timeSignature) + step;
}

/** Algusnoodid (peidetud pausid) laulusõnade ankurdamiseks akordiruutude alguses. */
export function buildHarmonyFormAnchorNotes(measureCount, timeSignature, chordBeatStep, startId = 1) {
  const measureBeats = getMeasureBeatCount(timeSignature);
  const step = normalizeHarmonyChordBeatStep(chordBeatStep, timeSignature);
  const slotsPerMeasure = Math.max(1, Math.ceil(measureBeats / step));
  const totalMeasures = Math.max(1, measureCount);
  const notes = [];
  let id = startId;
  for (let m = 0; m < totalMeasures; m += 1) {
    for (let s = 0; s < slotsPerMeasure; s += 1) {
      const startBeat = m * measureBeats + s * step;
      const duration = Math.min(step, measureBeats - s * step);
      if (duration <= 0) continue;
      notes.push({
        id: id++,
        pitch: 'C',
        octave: 4,
        duration,
        durationLabel: duration >= 1 ? (duration === 1 ? '1/4' : `${duration}/4`) : '1/4',
        isDotted: false,
        isRest: true,
        beat: startBeat,
      });
    }
  }
  return notes;
}
