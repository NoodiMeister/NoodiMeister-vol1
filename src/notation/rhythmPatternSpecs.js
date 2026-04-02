/**
 * Liitrütmimustrid: sama struktuur nagu kursori juures sisestusel (insertPattern).
 * Kasutatakse rütmikasti SMuFL eelvaates ja noodimeister-complete.jsx mustri sisestuses.
 */
const TRIPLET_3_IN_2 = { type: 3, inSpaceOf: 2 };

function repeatSegment(n, seg) {
  return Array.from({ length: n }, () => ({ ...seg }));
}

export const RHYTHM_PATTERN_SEGMENTS = Object.freeze({
  '2/8': [
    { durationLabel: '1/8', duration: 0.5 },
    { durationLabel: '1/8', duration: 0.5 },
  ],
  '2/8+2/8': [
    { durationLabel: '1/8', duration: 0.5, beamGroupId: 'A' },
    { durationLabel: '1/8', duration: 0.5, beamGroupId: 'A' },
    { durationLabel: '1/8', duration: 0.5, beamGroupId: 'B' },
    { durationLabel: '1/8', duration: 0.5, beamGroupId: 'B' },
  ],
  '4/8': repeatSegment(4, { durationLabel: '1/8', duration: 0.5, beamGroupId: 'A' }),
  '4/16': repeatSegment(4, { durationLabel: '1/16', duration: 0.25 }),
  '8/16': repeatSegment(8, { durationLabel: '1/16', duration: 0.25 }),
  '1/8+2/16': [
    { durationLabel: '1/8', duration: 0.5 },
    { durationLabel: '1/16', duration: 0.25 },
    { durationLabel: '1/16', duration: 0.25 },
  ],
  '2/16+1/8': [
    { durationLabel: '1/16', duration: 0.25 },
    { durationLabel: '1/16', duration: 0.25 },
    { durationLabel: '1/8', duration: 0.5 },
  ],
  'triplet-8': repeatSegment(3, { durationLabel: '1/8', duration: 1 / 3, tuplet: TRIPLET_3_IN_2 }),
  'triplet-4': repeatSegment(3, { durationLabel: '1/4', duration: 2 / 3, tuplet: TRIPLET_3_IN_2 }),
});
