/**
 * Score load session: instrumentide kogumine + weight kasvab mahuga.
 * Käivita: node scripts/check-score-load-session.mjs
 */
import assert from 'node:assert/strict';
import {
  SCORE_LOAD_PHASE_LAYOUT,
  SCORE_LOAD_PHASE_SOUNDS,
  collectInstrumentIdsFromProject,
  computeLoadProgressPercent,
  countNotesInProject,
  estimateLoadWeight,
  estimateLoadWeightFromProject,
} from '../src/musical/scoreLoadSession.js';

const empty = collectInstrumentIdsFromProject(null);
assert.deepEqual(empty, ['single-staff-treble']);

const multi = collectInstrumentIdsFromProject({
  staves: [
    { instrumentId: 'flute', notes: [{ pitch: 'C' }, { pitch: 'D' }] },
    { instrumentId: 'piano', notes: [{ pitch: 'E' }] },
    { instrumentId: 'flute', notes: [] },
    { instrumentId: 'recorder', notes: Array.from({ length: 40 }, (_, i) => ({ id: i })) },
  ],
});
assert.deepEqual(multi, ['flute', 'piano', 'recorder']);
assert.equal(countNotesInProject({
  staves: [
    { notes: [1, 2] },
    { notes: [3] },
  ],
}), 3);

const legacy = collectInstrumentIdsFromProject({ instrument: 'violin', notes: [{}, {}] });
assert.deepEqual(legacy, ['violin']);
assert.equal(countNotesInProject({ instrument: 'violin', notes: [{}, {}] }), 2);

const w1 = estimateLoadWeight({ instrumentCount: 1, noteCount: 0, staffCount: 1 });
const w5 = estimateLoadWeight({ instrumentCount: 5, noteCount: 100, staffCount: 5 });
assert.ok(w5 > w1, 'weight grows with instruments/notes/staves');

const fromSmall = estimateLoadWeightFromProject({
  staves: [{ instrumentId: 'flute', notes: [] }],
});
const fromLarge = estimateLoadWeightFromProject({
  staves: [
    { instrumentId: 'flute', notes: Array.from({ length: 80 }, () => ({})) },
    { instrumentId: 'clarinet', notes: Array.from({ length: 80 }, () => ({})) },
    { instrumentId: 'oboe', notes: Array.from({ length: 80 }, () => ({})) },
  ],
});
assert.ok(fromLarge > fromSmall, 'project weight reflects multi-instrument score size');

assert.equal(computeLoadProgressPercent({ phase: SCORE_LOAD_PHASE_LAYOUT, done: 0, total: 3 }), 0);
assert.equal(computeLoadProgressPercent({ phase: SCORE_LOAD_PHASE_LAYOUT, done: 1, total: 3 }), 12);
assert.equal(computeLoadProgressPercent({ phase: SCORE_LOAD_PHASE_SOUNDS, done: 0, total: 4 }), 12);
assert.equal(computeLoadProgressPercent({ phase: SCORE_LOAD_PHASE_SOUNDS, done: 2, total: 4 }), 56);
assert.equal(computeLoadProgressPercent({ phase: SCORE_LOAD_PHASE_SOUNDS, done: 4, total: 4 }), 100);
assert.equal(computeLoadProgressPercent({ phase: 'ready', done: 4, total: 4 }), 100);

console.log('check-score-load-session: ok');
