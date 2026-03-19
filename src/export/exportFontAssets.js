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

export function getExportFontFaceCss() {
  const urls = EXPORT_FONT_URLS;
  return `
@font-face { font-family: 'Bravura'; font-style: normal; font-weight: 400; src: url("${urls.bravura}") format("woff2"); }
@font-face { font-family: 'Noto Serif'; font-style: normal; font-weight: 400; src: url("${urls.notoSerifRegular}") format("woff2"); }
@font-face { font-family: 'Noto Serif'; font-style: italic; font-weight: 400; src: url("${urls.notoSerifItalic}") format("woff2"); }
@font-face { font-family: 'Noto Serif'; font-style: normal; font-weight: 700; src: url("${urls.notoSerifBold}") format("woff2"); }
@font-face { font-family: 'Noto Serif'; font-style: italic; font-weight: 700; src: url("${urls.notoSerifBoldItalic}") format("woff2"); }
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 400; src: url("${urls.notoSansRegular}") format("woff2"); }
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 700; src: url("${urls.notoSansBold}") format("woff2"); }

@font-face { font-family: 'Leland'; font-style: normal; font-weight: 400; src: url("${urls.bravura}") format("woff2"); }
@font-face { font-family: 'LelandText'; font-style: normal; font-weight: 400; src: url("${urls.notoSerifRegular}") format("woff2"); }
@font-face { font-family: 'ExportTitle'; font-style: normal; font-weight: 700; src: url("${urls.notoSerifBold}") format("woff2"); }
@font-face { font-family: 'ExportTitle'; font-style: italic; font-weight: 700; src: url("${urls.notoSerifBoldItalic}") format("woff2"); }
@font-face { font-family: 'ExportBody'; font-style: normal; font-weight: 400; src: url("${urls.notoSerifRegular}") format("woff2"); }
@font-face { font-family: 'ExportBody'; font-style: italic; font-weight: 400; src: url("${urls.notoSerifItalic}") format("woff2"); }
@font-face { font-family: 'ExportSans'; font-style: normal; font-weight: 400; src: url("${urls.notoSansRegular}") format("woff2"); }
@font-face { font-family: 'ExportSans'; font-style: normal; font-weight: 700; src: url("${urls.notoSansBold}") format("woff2"); }

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

export function resolveExportTextFamily(fontFamily, fallback = 'ExportBody') {
  const raw = String(fontFamily || '').toLowerCase();
  if (raw.includes('sans') || raw.includes('arial') || raw.includes('ui')) return 'ExportSans';
  if (raw.includes('mono')) return 'ExportSans';
  if (raw.includes('bravura') || raw.includes('leland')) return 'Leland';
  return fallback;
}
