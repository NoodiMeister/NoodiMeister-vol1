const CURRENT_VERSION = 1;
export const A4_PORTRAIT = { width: 794, height: 1123 };

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createComposerPage() {
  return {
    id: uid('page'),
    width: A4_PORTRAIT.width,
    height: A4_PORTRAIT.height,
    background: '#ffffff',
    blocks: [],
    textBoxes: [],
  };
}

export function createComposerDocument(overrides = {}) {
  const base = {
    type: 'noodimeister-composer',
    version: CURRENT_VERSION,
    meta: {
      title: 'Untitled composer',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    pages: [createComposerPage()],
    activePageId: '',
    grid: {
      enabled: true,
      size: 12,
      snap: true,
    },
  };
  const next = { ...base, ...overrides };
  if (!Array.isArray(next.pages) || next.pages.length === 0) next.pages = [createComposerPage()];
  if (!next.activePageId) next.activePageId = next.pages[0].id;
  return next;
}

export function normalizeComposerDocument(raw) {
  if (!raw || typeof raw !== 'object') return createComposerDocument();
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  const normalizedPages = pages.map((page) => ({
    id: page?.id || uid('page'),
    width: Number(page?.width) > 0 ? Number(page.width) : A4_PORTRAIT.width,
    height: Number(page?.height) > 0 ? Number(page.height) : A4_PORTRAIT.height,
    background: page?.background || '#ffffff',
    blocks: Array.isArray(page?.blocks) ? page.blocks : [],
    textBoxes: Array.isArray(page?.textBoxes) ? page.textBoxes : [],
  }));
  const doc = createComposerDocument({
    ...raw,
    pages: normalizedPages.length > 0 ? normalizedPages : undefined,
  });
  return doc;
}

export function createComposerBlockFromSvg({ name, svgMarkup, width = 480, height = 180, source = {} }) {
  const sourceWidth = Number(source?.sourceWidth) > 0 ? Number(source.sourceWidth) : width;
  const sourceHeight = Number(source?.sourceHeight) > 0 ? Number(source.sourceHeight) : height;
  return {
    id: uid('block'),
    type: 'svg',
    name: name || 'Untitled block',
    x: 24,
    y: 24,
    width,
    height,
    rotation: 0,
    locked: false,
    svgMarkup: svgMarkup || '',
    sourceWidth,
    sourceHeight,
    slice: {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    },
    source,
  };
}

export function createComposerTextBox(text = 'Tekst') {
  return {
    id: uid('text'),
    text,
    x: 36,
    y: 36,
    width: 260,
    height: 80,
    fontSize: 20,
    fontWeight: 600,
    align: 'left',
  };
}

export function touchMeta(doc) {
  return {
    ...doc,
    meta: {
      ...(doc.meta || {}),
      updatedAt: Date.now(),
    },
  };
}

export function splitComposerBlock(block, orientation, ratio) {
  if (!block || block.type !== 'svg') return [];
  const r = Math.max(0.05, Math.min(0.95, Number(ratio) || 0.5));
  const slice = block.slice || { x: 0, y: 0, width: block.sourceWidth || block.width, height: block.sourceHeight || block.height };

  if (orientation === 'vertical') {
    const leftDisplayW = block.width * r;
    const rightDisplayW = block.width - leftDisplayW;
    const leftSliceW = slice.width * r;
    const rightSliceW = slice.width - leftSliceW;
    return [
      {
        ...block,
        id: uid('block'),
        name: `${block.name || 'Block'} A`,
        width: leftDisplayW,
        slice: { ...slice, width: leftSliceW },
      },
      {
        ...block,
        id: uid('block'),
        name: `${block.name || 'Block'} B`,
        x: block.x + leftDisplayW,
        width: rightDisplayW,
        slice: { ...slice, x: slice.x + leftSliceW, width: rightSliceW },
      },
    ];
  }

  const topDisplayH = block.height * r;
  const bottomDisplayH = block.height - topDisplayH;
  const topSliceH = slice.height * r;
  const bottomSliceH = slice.height - topSliceH;
  return [
    {
      ...block,
      id: uid('block'),
      name: `${block.name || 'Block'} A`,
      height: topDisplayH,
      slice: { ...slice, height: topSliceH },
    },
    {
      ...block,
      id: uid('block'),
      name: `${block.name || 'Block'} B`,
      y: block.y + topDisplayH,
      height: bottomDisplayH,
      slice: { ...slice, y: slice.y + topSliceH, height: bottomSliceH },
    },
  ];
}
