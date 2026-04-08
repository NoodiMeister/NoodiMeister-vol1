/**
 * Taktimõõt ↔ sisemine ajatelg (neljandikühikud, nagu MusicXML divisions / note.duration).
 * Üks neljandik = 1; kaheksandik = 0,5; poolnoot = 2 — sõltumata taktimõõdu kirjest.
 */

/**
 * Täispika takt neljandikühikutes: nt 3/4 → 3, 6/8 → 3, 2/2 → 4.
 * @param {{ beats?: number, beatUnit?: number }|null|undefined} timeSignature
 * @returns {number}
 */
export function measureLengthInQuarterBeats(timeSignature) {
  const beats = Number(timeSignature?.beats) || 4;
  const beatUnit = Number(timeSignature?.beatUnit) || 4;
  return beats * (4 / beatUnit);
}

/**
 * Noodi kestus neljandikühikutes (sama skaala mis NotationContext DURATIONS / note.duration).
 * Sõltumata taktimõõdu kirjest: 1/8 on alati 0,5 neljandikku.
 * @param {string} durationLabel - nt '1/4', '1/8'
 * @param {boolean} [isDotted]
 * @returns {number}
 */
export function durationLabelToQuarterNoteUnits(durationLabel, isDotted = false) {
  const denom = parseInt(String(durationLabel || '1/4').split('/')[1], 10) || 4;
  const base = 4 / denom;
  return isDotted ? base * 1.5 : base;
}

/**
 * Üks taktimõõdu kirjas märgitud "löök" neljandikühikutes (nt 3/4 → 1; 6/8 → 0,5 kui lööke on 6).
 * @param {{ beats?: number, beatUnit?: number }|null|undefined} timeSignature
 */
export function oneMetricalBeatInQuarterBeats(timeSignature) {
  const beats = Number(timeSignature?.beats) || 4;
  return measureLengthInQuarterBeats(timeSignature) / Math.max(1, beats);
}
