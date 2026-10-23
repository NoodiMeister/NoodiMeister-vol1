/**
 * Regression: hand-tool clef / jump-mark offsets must round-trip through project JSON.
 */
import {
  normalizeClefHandOffset,
  normalizeJumpMarkLayoutOverrides,
  clefHandOffsetIsNonDefault,
} from '../src/layout/handPlacementPersistence.js';

function assert(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

const clef = normalizeClefHandOffset({ x: 12.4, y: -3.6, sizePx: 48 });
assert(clef.x === 12 && clef.y === -4 && clef.sizePx === 48, 'normalizeClefHandOffset rounding failed');
assert(clefHandOffsetIsNonDefault(clef) === true, 'non-default clef should persist');
assert(clefHandOffsetIsNonDefault({ x: 0, y: 0, sizePx: null }) === false, 'default clef should omit');

const jumps = normalizeJumpMarkLayoutOverrides({
  '2:coda': { dx: 5.2, dy: -1.1, sizePx: 22 },
  bad: null,
  alsoBad: 'x',
});
assert(jumps['2:coda']?.dx === 5 && jumps['2:coda']?.dy === -1 && jumps['2:coda']?.sizePx === 22, 'jump mark normalize failed');
assert(jumps.bad == null && jumps.alsoBad == null, 'invalid jump entries must be dropped');

// Snapshot shape expected by getPersistedState consumers.
const snapshot = {
  timeSignatureOffset: { x: 0, y: 0 },
  clefHandOffset: clefHandOffsetIsNonDefault(clef) ? normalizeClefHandOffset(clef) : undefined,
  jumpMarkLayoutOverrides: Object.keys(jumps).length ? normalizeJumpMarkLayoutOverrides(jumps) : undefined,
};
const roundTrip = JSON.parse(JSON.stringify(snapshot));
assert(roundTrip.clefHandOffset.x === 12, 'clefHandOffset lost in JSON round-trip');
assert(roundTrip.jumpMarkLayoutOverrides['2:coda'].dx === 5, 'jumpMarkLayoutOverrides lost in JSON round-trip');

console.log('check-hand-placement-persist: ok');
