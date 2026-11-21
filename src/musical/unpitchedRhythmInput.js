/**
 * Unpitched Orff / rütmipill — faas A (üks pill, 1-jooneline staff).
 * Pitch ankur tuleb instrumentist; MIDI note number ei määra kõrgust.
 */

/**
 * @param {string|null|undefined} instId
 * @param {object|null|undefined} cfg
 * @param {(instId: string, cfg: object|null|undefined) => { pitch: string, octave: number }|null} getSingleLineStaffPitch
 * @returns {{ pitch: string, octave: number }}
 */
export function resolveUnpitchedHitPitch(instId, cfg, getSingleLineStaffPitch) {
  const resolved = typeof getSingleLineStaffPitch === 'function'
    ? getSingleLineStaffPitch(instId, cfg)
    : null;
  if (resolved?.pitch != null && Number.isFinite(Number(resolved.octave))) {
    return { pitch: String(resolved.pitch), octave: Number(resolved.octave) };
  }
  if (cfg?.defaultClef === 'bass') return { pitch: 'C', octave: 4 };
  return { pitch: 'C', octave: 5 };
}
