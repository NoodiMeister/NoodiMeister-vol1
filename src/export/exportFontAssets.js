import bravuraWoff2Url from '@fontsource/bravura/files/bravura-latin-400-normal.woff2?url';
import notoSerifRegularWoff2Url from '@fontsource/noto-serif/files/noto-serif-latin-400-normal.woff2?url';
import notoSerifItalicWoff2Url from '@fontsource/noto-serif/files/noto-serif-latin-400-italic.woff2?url';
import notoSerifBoldWoff2Url from '@fontsource/noto-serif/files/noto-serif-latin-700-normal.woff2?url';
import notoSerifBoldItalicWoff2Url from '@fontsource/noto-serif/files/noto-serif-latin-700-italic.woff2?url';
import notoSansRegularWoff2Url from '@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2?url';
import notoSansBoldWoff2Url from '@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff2?url';

function escapeCssUrl(url) {
  return String(url || '').replace(/"/g, '%22');
}

export const EXPORT_FONT_URLS = {
  bravura: escapeCssUrl(bravuraWoff2Url),
  notoSerifRegular: escapeCssUrl(notoSerifRegularWoff2Url),
  notoSerifItalic: escapeCssUrl(notoSerifItalicWoff2Url),
  notoSerifBold: escapeCssUrl(notoSerifBoldWoff2Url),
  notoSerifBoldItalic: escapeCssUrl(notoSerifBoldItalicWoff2Url),
  notoSansRegular: escapeCssUrl(notoSansRegularWoff2Url),
  notoSansBold: escapeCssUrl(notoSansBoldWoff2Url),
};

const OPTIONAL_INSTRUMENT_FONT_SOURCES = {
  TinWhistleTab: '/fonts/TinWhistleTab.ttf',
  RecorderFont: '/fonts/RecorderFont-BYDx.ttf',
};

const optionalInstrumentFontStatus = {
  TinWhistleTab: false,
  RecorderFont: false,
};

function getOptionalInstrumentFontFaceCss(fontDisplay = 'swap') {
  const fontDisplayRule = fontDisplay ? ` font-display: ${fontDisplay};` : '';
  return `
@font-face { font-family: 'TinWhistleTab'; font-style: normal; font-weight: 400; src: url("${OPTIONAL_INSTRUMENT_FONT_SOURCES.TinWhistleTab}") format("truetype");${fontDisplayRule} }
@font-face { font-family: 'RecorderFont'; font-style: normal; font-weight: 400; src: url("${OPTIONAL_INSTRUMENT_FONT_SOURCES.RecorderFont}") format("truetype");${fontDisplayRule} }
`.trim();
}

function getSharedFontFaceCss({ includeTextFamilyOverrides = false, fontDisplay = 'swap' } = {}) {
  const urls = EXPORT_FONT_URLS;
  const fontDisplayRule = fontDisplay ? ` font-display: ${fontDisplay};` : '';
  const fontFaces = `
@font-face { font-family: 'Bravura'; font-style: normal; font-weight: 400; src: url("${urls.bravura}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'Noto Serif'; font-style: normal; font-weight: 400; src: url("${urls.notoSerifRegular}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'Noto Serif'; font-style: italic; font-weight: 400; src: url("${urls.notoSerifItalic}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'Noto Serif'; font-style: normal; font-weight: 700; src: url("${urls.notoSerifBold}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'Noto Serif'; font-style: italic; font-weight: 700; src: url("${urls.notoSerifBoldItalic}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 400; src: url("${urls.notoSansRegular}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 700; src: url("${urls.notoSansBold}") format("woff2");${fontDisplayRule} }

@font-face { font-family: 'Leland'; font-style: normal; font-weight: 400; src: url("${urls.bravura}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'LelandText'; font-style: normal; font-weight: 400; src: url("${urls.notoSerifRegular}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'ExportTitle'; font-style: normal; font-weight: 700; src: url("${urls.notoSerifBold}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'ExportTitle'; font-style: italic; font-weight: 700; src: url("${urls.notoSerifBoldItalic}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'ExportBody'; font-style: normal; font-weight: 400; src: url("${urls.notoSerifRegular}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'ExportBody'; font-style: italic; font-weight: 400; src: url("${urls.notoSerifItalic}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'ExportSans'; font-style: normal; font-weight: 400; src: url("${urls.notoSansRegular}") format("woff2");${fontDisplayRule} }
@font-face { font-family: 'ExportSans'; font-style: normal; font-weight: 700; src: url("${urls.notoSansBold}") format("woff2");${fontDisplayRule} }
`.trim();
  if (!includeTextFamilyOverrides) return fontFaces;
  return `
${fontFaces}

text[font-family="sans-serif"],
tspan[font-family="sans-serif"],
text[font-family="Arial, sans-serif"],
tspan[font-family="Arial, sans-serif"],
text[font-family="monospace"],
tspan[font-family="monospace"],
[style*="font-family: sans-serif"],
[style*="font-family:sans-serif"],
[style*="font-family: Arial, sans-serif"],
[style*="font-family:Arial, sans-serif"],
[style*="font-family: monospace"],
[style*="font-family:monospace"] {
  font-family: 'ExportSans' !important;
}

text[font-family="serif"],
tspan[font-family="serif"],
[style*="font-family: serif"],
[style*="font-family:serif"] {
  font-family: 'ExportBody' !important;
}
`.trim();
}

export function getExportFontFaceCss() {
  return getSharedFontFaceCss({ includeTextFamilyOverrides: true, fontDisplay: 'swap' });
}

export function getRuntimeFontFaceCss() {
  return getSharedFontFaceCss({ includeTextFamilyOverrides: false, fontDisplay: 'swap' });
}

export function installRuntimeFontFaces(targetDocument = typeof document !== 'undefined' ? document : null) {
  if (!targetDocument?.head) return null;
  const styleId = 'noodimeister-runtime-font-faces';
  let styleEl = targetDocument.getElementById(styleId);
  if (styleEl) return styleEl;
  styleEl = targetDocument.createElement('style');
  styleEl.id = styleId;
  styleEl.setAttribute('data-noodimeister-fonts', 'runtime');
  styleEl.textContent = getRuntimeFontFaceCss();
  targetDocument.head.prepend(styleEl);
  return styleEl;
}

export function warmRuntimeFonts(targetDocument = typeof document !== 'undefined' ? document : null) {
  if (!targetDocument?.fonts?.load) return Promise.resolve([]);
  return Promise.allSettled([
    targetDocument.fonts.load('16px "Bravura"'),
    targetDocument.fonts.load('16px "Leland"'),
    targetDocument.fonts.load('16px "Noto Serif"'),
    targetDocument.fonts.load('16px "LelandText"'),
    targetDocument.fonts.load('16px "Noto Sans"'),
  ]);
}

export async function loadOptionalInstrumentFonts(targetDocument = typeof document !== 'undefined' ? document : null) {
  if (!targetDocument?.fonts?.add || typeof FontFace === 'undefined') return optionalInstrumentFontStatus;
  await Promise.allSettled(Object.entries(OPTIONAL_INSTRUMENT_FONT_SOURCES).map(async ([family, url]) => {
    try {
      // Avoid noisy OTS decode errors when optional font files are missing or mapped to HTML.
      const probe = await fetch(url, { method: 'GET', cache: 'no-store' });
      const contentType = String(probe.headers.get('content-type') || '').toLowerCase();
      if (!probe.ok || contentType.includes('text/html')) {
        optionalInstrumentFontStatus[family] = false;
        return;
      }
      const face = new FontFace(family, `url("${url}") format("truetype")`, { style: 'normal', weight: '400' });
      const loadedFace = await face.load();
      targetDocument.fonts.add(loadedFace);
      optionalInstrumentFontStatus[family] = true;
    } catch (_) {
      optionalInstrumentFontStatus[family] = false;
    }
  }));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('noodimeister-optional-fonts-changed'));
  }
  return { ...optionalInstrumentFontStatus };
}

export function hasBundledOptionalFont(family) {
  return optionalInstrumentFontStatus[family] === true;
}

export function resolveExportTextFamily(fontFamily, fallback = 'ExportBody') {
  const raw = String(fontFamily || '').toLowerCase();
  if (raw.includes('sans') || raw.includes('arial') || raw.includes('ui')) return 'ExportSans';
  if (raw.includes('mono')) return 'ExportSans';
  if (raw.includes('bravura') || raw.includes('leland')) return 'Leland';
  return fallback;
}
