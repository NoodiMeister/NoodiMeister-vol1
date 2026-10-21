/**
 * Noodipea (notehead) kujundite kataloog — MuseScore / SMuFL inspireeritud.
 * Tööriistakast „Noodipea“ muudab ainult noodipea kujutist (mitte rütmi ega kestust).
 * Preview codepoints peavad ühtima `smufl/glyphs.js` NOTEHEAD_SHAPE_GLYPH väärtustega.
 */

/** Toetatud kujundite ID-d (salvestus / state). */
export const NOTEHEAD_SHAPE_IDS = Object.freeze([
  'oval',
  'x',
  'triangleUp',
  'triangleDown',
  'diamond',
  'square',
  'emoji',
]);

/** SMuFL black noteheads — toolbox preview. X = null (Figurenotes path UI). */
const PREVIEW = Object.freeze({
  oval: '\uE0A4',
  x: null,
  triangleUp: '\uE0BE',
  triangleDown: '\uE0C7',
  diamond: '\uE0DB',
  square: '\uE0B9',
});

/**
 * @typedef {{ id: string, labelKey: string, previewGlyph: string | null, aliases?: string[] }} NoteheadShapeDef
 */

/** @type {readonly NoteheadShapeDef[]} */
export const NOTEHEAD_SHAPE_DEFS = Object.freeze([
  {
    id: 'oval',
    labelKey: 'notehead.shapeOval',
    previewGlyph: PREVIEW.oval,
  },
  {
    id: 'x',
    labelKey: 'notehead.shapeX',
    /** Preview fallback; UI draws FIGURENOTES_CROSS_PATHS (sama paksus mis figuurnoti X). */
    previewGlyph: PREVIEW.x,
  },
  {
    id: 'triangleUp',
    labelKey: 'notehead.shapeTriangleUp',
    previewGlyph: PREVIEW.triangleUp,
    aliases: ['triangle'],
  },
  {
    id: 'triangleDown',
    labelKey: 'notehead.shapeTriangleDown',
    previewGlyph: PREVIEW.triangleDown,
  },
  {
    id: 'diamond',
    labelKey: 'notehead.shapeDiamond',
    previewGlyph: PREVIEW.diamond,
  },
  {
    id: 'square',
    labelKey: 'notehead.shapeSquare',
    previewGlyph: PREVIEW.square,
  },
  {
    id: 'emoji',
    labelKey: 'notehead.shapeEmoji',
    previewGlyph: '♪',
  },
]);

const ALIAS_TO_ID = (() => {
  const map = Object.create(null);
  for (const def of NOTEHEAD_SHAPE_DEFS) {
    map[def.id] = def.id;
    for (const a of def.aliases || []) map[a] = def.id;
  }
  return map;
})();

/** Normaliseeri salvestatud / pärandväärtus (nt `triangle` → `triangleUp`). */
export function normalizeNoteheadShape (raw) {
  const key = String(raw || '').trim();
  if (!key) return 'oval';
  return ALIAS_TO_ID[key] || 'oval';
}

export function isNoteheadShapeId (value) {
  return NOTEHEAD_SHAPE_IDS.includes(normalizeNoteheadShape(value))
    && normalizeNoteheadShape(value) === value;
}

export function getNoteheadShapePreviewGlyph (shapeId) {
  const id = normalizeNoteheadShape(shapeId);
  const def = NOTEHEAD_SHAPE_DEFS.find((d) => d.id === id);
  return def?.previewGlyph ?? PREVIEW.oval;
}
