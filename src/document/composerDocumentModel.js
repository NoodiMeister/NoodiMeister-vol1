const CURRENT_VERSION = 1;
export const COMPOSER_FILE_EXT = '.nmc';
export const COMPOSER_DOC_TYPE = 'noodimeister-composer';
export const A4_PORTRAIT = { width: 794, height: 1123 };
export const A4_LANDSCAPE = { width: 1123, height: 794 };

export function isComposerFileName(name) {
  return String(name || '').toLowerCase().endsWith(COMPOSER_FILE_EXT);
}

export function buildComposerFileName(title) {
  const raw = String(title || 'kujundus').trim() || 'kujundus';
  const withoutExt = raw.replace(/\.nmc$/i, '');
  const safe = withoutExt.replace(/[^\w\s\-.,äöüõÄÖÜÕ]/g, '').trim() || 'kujundus';
  return `${safe}${COMPOSER_FILE_EXT}`;
}

export function parseComposerFileTitle(fileNameOrTitle) {
  const raw = String(fileNameOrTitle || '').trim();
  if (!raw) return 'Nimetu kujundus';
  return raw.replace(/\.nmc$/i, '') || 'Nimetu kujundus';
}

export function isComposerDocumentJson(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s.startsWith('{')) return false;
  return s.includes(`"type":"${COMPOSER_DOC_TYPE}"`) || s.includes(`"type": "${COMPOSER_DOC_TYPE}"`);
}

/** Google Docs–style text presets for page composer. */
export const COMPOSER_TEXT_PRESETS = {
  title: {
    label: 'Pealkiri',
    fontSize: 32,
    fontWeight: 700,
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'center',
    color: '#111827',
    lineHeight: 1.2,
    defaultWidth: 720,
    placeholder: 'Pealkiri',
  },
  subtitle: {
    label: 'Alapealkiri',
    fontSize: 18,
    fontWeight: 400,
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'center',
    color: '#4b5563',
    lineHeight: 1.3,
    defaultWidth: 720,
    placeholder: 'Alapealkiri',
  },
  heading1: {
    label: 'Pealkiri 1',
    fontSize: 24,
    fontWeight: 700,
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'left',
    color: '#111827',
    lineHeight: 1.25,
    defaultWidth: 680,
    placeholder: 'Pealkiri 1',
  },
  heading2: {
    label: 'Pealkiri 2',
    fontSize: 18,
    fontWeight: 600,
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'left',
    color: '#111827',
    lineHeight: 1.3,
    defaultWidth: 680,
    placeholder: 'Pealkiri 2',
  },
  body: {
    label: 'Normal',
    fontSize: 14,
    fontWeight: 400,
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'left',
    color: '#111827',
    lineHeight: 1.5,
    defaultWidth: 680,
    placeholder: 'Kirjuta siia…',
  },
  caption: {
    label: 'Pealdis',
    fontSize: 11,
    fontWeight: 400,
    fontStyle: 'italic',
    textDecoration: 'none',
    align: 'left',
    color: '#6b7280',
    lineHeight: 1.4,
    defaultWidth: 680,
    placeholder: 'Pealdis',
  },
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getPageOrientation(page) {
  const w = Number(page?.width) || A4_PORTRAIT.width;
  const h = Number(page?.height) || A4_PORTRAIT.height;
  return w > h ? 'landscape' : 'portrait';
}

export function applyPageOrientation(page, orientation) {
  const dims = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
  return { ...page, width: dims.width, height: dims.height, orientation };
}

export function createComposerPage(orientation = 'portrait') {
  const dims = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
  return {
    id: uid('page'),
    width: dims.width,
    height: dims.height,
    orientation,
    background: '#ffffff',
    blocks: [],
    textBoxes: [],
  };
}

export function createComposerDocument(overrides = {}) {
  const base = {
    type: COMPOSER_DOC_TYPE,
    version: CURRENT_VERSION,
    meta: {
      title: 'Nimetu kujundus',
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

export function isComposerTextBlock(block) {
  return block?.type === 'text';
}

export const COMPOSER_LAYER_BACKGROUND = 'background';
export const COMPOSER_LAYER_FOREGROUND = 'foreground';

export function getComposerBlockLayer(block) {
  if (block?.type !== 'svg') return COMPOSER_LAYER_FOREGROUND;
  return block.layer === COMPOSER_LAYER_BACKGROUND
    ? COMPOSER_LAYER_BACKGROUND
    : COMPOSER_LAYER_FOREGROUND;
}

export function composerPageHasTextBlocks(page) {
  return (page?.blocks || []).some((b) => isComposerTextBlock(b));
}

/** Automaatne noodimport: ainult tühjad lehed ilma tekstialadeta. */
export function isPageAvailableForNotationImport(page) {
  if (!page) return false;
  if (composerPageHasTextBlocks(page)) return false;
  if ((page.textBoxes?.length || 0) > 0) return false;
  return (page.blocks?.length || 0) === 0;
}

export function partitionBlocksForRender(blocks) {
  const backgroundSvg = [];
  const textBlocks = [];
  const foregroundSvg = [];
  for (const block of blocks || []) {
    if (isComposerTextBlock(block)) {
      textBlocks.push(block);
    } else if (block?.type === 'svg') {
      if (getComposerBlockLayer(block) === COMPOSER_LAYER_BACKGROUND) backgroundSvg.push(block);
      else foregroundSvg.push(block);
    } else {
      foregroundSvg.push(block);
    }
  }
  return { backgroundSvg, textBlocks, foregroundSvg };
}

export function findNextNotationImportPageIndex(pages, startIndex = 0) {
  for (let i = Math.max(0, startIndex); i < (pages?.length || 0); i += 1) {
    if (isPageAvailableForNotationImport(pages[i])) return i;
  }
  return pages?.length || 0;
}

function normalizeComposerBlock(block) {
  if (!block || typeof block !== 'object') return block;
  if (block.type === 'svg') {
    return {
      ...block,
      layer: getComposerBlockLayer(block),
    };
  }
  const isLegacyText = !block.type && (block.text != null || block.fontSize != null);
  if (block.type === 'text' || isLegacyText) {
    const presetKey = block.textStyle && COMPOSER_TEXT_PRESETS[block.textStyle]
      ? block.textStyle
      : 'body';
    const preset = COMPOSER_TEXT_PRESETS[presetKey];
    return {
      id: block.id || uid('text'),
      type: 'text',
      name: block.name || preset.label,
      textStyle: presetKey,
      text: block.text ?? '',
      x: Number(block.x) || 36,
      y: Number(block.y) || 36,
      width: Number(block.width) > 0 ? Number(block.width) : preset.defaultWidth,
      height: Number(block.height) > 0 ? Number(block.height) : Math.round(preset.fontSize * preset.lineHeight * 2 + 12),
      fontSize: Number(block.fontSize) || preset.fontSize,
      fontWeight: block.fontWeight ?? preset.fontWeight,
      fontStyle: block.fontStyle || preset.fontStyle,
      textDecoration: block.textDecoration || preset.textDecoration,
      align: block.align || preset.align,
      color: block.color || preset.color,
      lineHeight: Number(block.lineHeight) || preset.lineHeight,
      locked: !!block.locked,
    };
  }
  return block;
}

export function normalizeComposerDocument(raw) {
  if (!raw || typeof raw !== 'object') return createComposerDocument();
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  const normalizedPages = pages.map((page) => {
    const orientation = page?.orientation || getPageOrientation(page);
    const dims = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
    return {
      id: page?.id || uid('page'),
      width: Number(page?.width) > 0 ? Number(page.width) : dims.width,
      height: Number(page?.height) > 0 ? Number(page.height) : dims.height,
      orientation,
      background: page?.background || '#ffffff',
      blocks: (Array.isArray(page?.blocks) ? page.blocks : []).map(normalizeComposerBlock),
      textBoxes: Array.isArray(page?.textBoxes) ? page.textBoxes : [],
    };
  });
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
    layer: COMPOSER_LAYER_FOREGROUND,
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

export function createComposerTextBox(text = '', presetKey = 'body', overrides = {}) {
  const preset = COMPOSER_TEXT_PRESETS[presetKey] || COMPOSER_TEXT_PRESETS.body;
  const fontSize = Number(overrides.fontSize) || preset.fontSize;
  const lineHeight = Number(overrides.lineHeight) || preset.lineHeight;
  return {
    id: uid('text'),
    type: 'text',
    name: preset.label,
    textStyle: presetKey in COMPOSER_TEXT_PRESETS ? presetKey : 'body',
    text,
    x: overrides.x ?? 36,
    y: overrides.y ?? 36,
    width: overrides.width ?? preset.defaultWidth,
    height: overrides.height ?? Math.round(fontSize * lineHeight * 2 + 12),
    fontSize,
    fontWeight: overrides.fontWeight ?? preset.fontWeight,
    fontStyle: overrides.fontStyle ?? preset.fontStyle,
    textDecoration: overrides.textDecoration ?? preset.textDecoration,
    align: overrides.align ?? preset.align,
    color: overrides.color ?? preset.color,
    lineHeight,
    locked: false,
  };
}

/** Apply a text preset to an existing text block (Google Docs style picker). */
export function applyTextPreset(block, presetKey) {
  if (!block || block.type !== 'text') return block;
  const preset = COMPOSER_TEXT_PRESETS[presetKey];
  if (!preset) return block;
  return {
    ...block,
    textStyle: presetKey,
    name: preset.label,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
    textDecoration: preset.textDecoration,
    align: preset.align,
    color: preset.color,
    lineHeight: preset.lineHeight,
    width: Math.max(block.width || 0, preset.defaultWidth),
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
