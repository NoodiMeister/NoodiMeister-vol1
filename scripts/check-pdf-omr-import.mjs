/**
 * Smoke: PDF/OMR constants + confidence bands + empty constraints (no pdf.js).
 */
import assert from 'node:assert/strict';
import {
  OMR_CONFIDENCE,
  PDF_SOURCE_TYPE,
  confidenceBand,
  emptyConstraints,
} from '../src/import/pdf/omrConstants.js';

assert.equal(confidenceBand(0.9), 'green');
assert.equal(confidenceBand(0.7), 'yellow');
assert.equal(confidenceBand(0.4), 'red');
assert.equal(confidenceBand(OMR_CONFIDENCE.HIGH), 'green');
assert.equal(confidenceBand(OMR_CONFIDENCE.MEDIUM - 0.01), 'red');

const c = emptyConstraints({ title: 'Test', sourceType: PDF_SOURCE_TYPE.HANDWRITTEN });
assert.equal(c.title, 'Test');
assert.equal(c.sourceType, PDF_SOURCE_TYPE.HANDWRITTEN);
assert.equal(c.timeSignature.beats, 4);
assert.equal(c.keySignature, 'C');

console.log('check-pdf-omr-import: ok');
