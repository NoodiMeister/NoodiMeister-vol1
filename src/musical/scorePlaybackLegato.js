/**
 * Taasesitus: helipikkus (gate time) + legato kaar.
 *
 * Gate time: MuseScore instruments.xml vaikimisi (`getArticulationGateRatio`).
 * Legato: kui `slurTo` järgneb kohe järgmisele noodile, lisa kattuvus (fraas).
 */

import { getArticulationGateRatio } from './articulationPlayback.js';

const END_EPS = 1e-4;
/** Järgmine noot loetakse „puudutavaks“, kui ta algab kuni nii palju enne kirjeldatud lõppu (akord / ümardus). */
const ONSET_BEFORE_END_SLACK_BEATS = 0.02;

const nextMelodicOnsetFrom = (staffList, fromBeat) => {
  let best = null;
  const fb = Number(fromBeat) || 0;
  for (const e of staffList) {
    if (e.isRest) continue;
    const b = Number(e.playbackBeat) || 0;
    if (b + END_EPS < fb) continue;
    if (best === null || b < best) best = b;
  }
  return best;
};

const isSlurToImmediateNext = (staffList, slurToId, nextOnset) => {
  if (slurToId == null || nextOnset == null) return false;
  const target = staffList.find((n) => !n.isRest && Number(n.id) === Number(slurToId));
  if (!target) return false;
  return Math.abs((Number(target.playbackBeat) || 0) - nextOnset) < 0.01;
};

/**
 * @param {Object[]} events – buildPlaybackNoteEvents väljund (playbackBeat, duration neljandikes, isRest, id, staffIndex, slurTo …)
 * @param {number} beatMs – ühe neljandiku kestus ms
 */
export function attachPlaybackNoteDurations(events, beatMs) {
  const list = Array.isArray(events) ? events : [];
  const safeBeatMs = Math.max(1, Number(beatMs) || 1);
  const overlapMs = Math.min(120, Math.max(28, safeBeatMs * 0.16));
  const slurExtraMs = Math.min(72, Math.max(0, safeBeatMs * 0.09));

  const byStaff = new Map();
  for (const e of list) {
    const k = Number.isFinite(e.staffIndex) ? e.staffIndex : 0;
    if (!byStaff.has(k)) byStaff.set(k, []);
    byStaff.get(k).push(e);
  }
  for (const arr of byStaff.values()) {
    arr.sort((a, b) => (Number(a.playbackBeat) || 0) - (Number(b.playbackBeat) || 0)
      || (Number(a.id) || 0) - (Number(b.id) || 0));
  }

  for (const e of list) {
    const baseMs = Math.max(40, (Number(e.duration) || 1) * safeBeatMs);
    if (e.isRest) {
      e.playbackDurationMs = baseMs;
      continue;
    }

    const pb = Number(e.playbackBeat) || 0;
    const dur = Number(e.duration) || 1;
    const endBeat = pb + dur;
    const staffKey = Number.isFinite(e.staffIndex) ? e.staffIndex : 0;
    const staffList = byStaff.get(staffKey) || [];
    const nextOnset = nextMelodicOnsetFrom(staffList, endBeat - ONSET_BEFORE_END_SLACK_BEATS);
    const touching = nextOnset != null && nextOnset <= endBeat + END_EPS;

    const gate = getArticulationGateRatio(e.articulation);
    let ms;
    if (touching && isSlurToImmediateNext(staffList, e.slurTo, nextOnset)) {
      ms = baseMs + overlapMs + slurExtraMs;
    } else {
      ms = baseMs * gate;
    }
    e.playbackDurationMs = Math.max(40, ms);
  }
  return list;
}
