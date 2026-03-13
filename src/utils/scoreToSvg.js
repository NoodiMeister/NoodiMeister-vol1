/**
 * Noodilehe (ScorePage) serialiseerimine üheks SVG-ks.
 * viewBox lukustab A4 raami: portrait 794×1123 px, landscape 1123×794 px (297×210 mm).
 * Kasutatakse PDF eelvaate ja svg2pdf ekspordi jaoks.
 */

const XMLNS = 'http://www.w3.org/2000/svg';

function getPageWh (orientation) {
  const isLandscape = orientation === 'landscape';
  return isLandscape ? { w: 1123, h: 794 } : { w: 794, h: 1123 };
}

function escapeXml (str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Ehitab @font-face defs, et pealkiri ja autor kasutaksid sama fonti (süsteemifondid).
 */
function buildFontDefs (documentFontFamily, titleFontFamily) {
  const titleFont = titleFontFamily || documentFontFamily || 'Georgia, serif';
  const bodyFont = documentFontFamily || 'Georgia, serif';
  return `<defs>
  <style type="text/css">
    @font-face { font-family: 'ExportTitle'; src: local('${escapeXml(titleFont.split(',')[0].trim())'), local('serif'); }
    @font-face { font-family: 'ExportBody'; src: local('${escapeXml(bodyFont.split(',')[0].trim())'), local('serif'); }
  </style>
</defs>`;
}

/**
 * Leiab konteinerist noodistiku SVG (suurim viewBox-iga svg).
 */
function findNotationSvg (container) {
  const svgs = container.querySelectorAll('svg[viewBox]');
  let best = null;
  let maxArea = 0;
  svgs.forEach((el) => {
    const vb = el.getAttribute('viewBox');
    if (!vb) return;
    const parts = vb.trim().split(/\s+/);
    if (parts.length >= 4) {
      const w = parseFloat(parts[2]) || 0;
      const h = parseFloat(parts[3]) || 0;
      if (w > 300 && h > 200 && w * h > maxArea) {
        maxArea = w * h;
        best = el;
      }
    }
  });
  return best;
}

/**
 * Tagastab { defsString, contentString, contentHeight }.
 * contentString on <g> sees: taust, pealkiri, autor, noodistiku SVG kloon.
 */
export function scoreToSvg (container, options = {}) {
  const orientation = options.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const { w: pageWidth, h: pageHeight } = getPageWh(orientation);
  const {
    pageDesignDataUrl,
    pageDesignOpacity = 0.25,
    songTitle = '',
    author = '',
    documentFontFamily = 'Georgia, serif',
    titleFontFamily = '',
    titleFontSize = 55,
    authorFontSize = 14,
    titleBold = false,
    titleItalic = false,
    authorBold = false,
    authorItalic = false,
    titleAlignment = 'center',
    authorAlignment = 'center',
  } = options;

  const contentHeight = Math.max(pageHeight, container.scrollHeight || pageHeight);
  const defsString = buildFontDefs(documentFontFamily, titleFontFamily);

  let bg = '';
  if (pageDesignDataUrl) {
    const opacity = Math.max(0, Math.min(1, Number(pageDesignOpacity) || 0.25));
    const safeHref = String(pageDesignDataUrl).replace(/"/g, '&quot;');
    bg = `<image href="${safeHref}" x="0" y="0" width="${pageWidth}" height="${contentHeight}" preserveAspectRatio="xMidYMid slice" opacity="${opacity}"/>`;
  }

  const titleY = 80;
  const authorY = 120;
  const anchor = titleAlignment === 'right' ? 'end' : titleAlignment === 'left' ? 'start' : 'middle';
  const authorAnchor = authorAlignment === 'right' ? 'end' : authorAlignment === 'left' ? 'start' : 'middle';
  const titleX = titleAlignment === 'left' ? 40 : titleAlignment === 'right' ? pageWidth - 40 : pageWidth / 2;
  const authorX = authorAlignment === 'left' ? 40 : authorAlignment === 'right' ? pageWidth - 40 : pageWidth / 2;

  const titleStyle = `font-family: ExportTitle, serif; font-size: ${titleFontSize}px; font-weight: ${titleBold ? 'bold' : 'normal'}; font-style: ${titleItalic ? 'italic' : 'normal'}; fill: #1c1917;`;
  const authorStyle = `font-family: ExportBody, serif; font-size: ${authorFontSize}px; font-weight: ${authorBold ? 'bold' : 'normal'}; font-style: ${authorItalic ? 'italic' : 'normal'}; fill: #78716c;`;

  const titleText = `<text x="${titleX}" y="${titleY}" text-anchor="${anchor}" dominant-baseline="middle" style="${titleStyle}">${escapeXml(songTitle) || 'Nimetu'}</text>`;
  const authorText = `<text x="${authorX}" y="${authorY}" text-anchor="${authorAnchor}" dominant-baseline="middle" style="${authorStyle}">${escapeXml(author)}</text>`;

  let notationGroup = '';
  const notationSvg = findNotationSvg(container);
  if (!notationSvg) {
    throw new Error('Notation SVG not found');
  }
  {
    let tx = 0;
    let ty = 0;
    let el = notationSvg;
    while (el && el !== container) {
      tx += el.offsetLeft || 0;
      ty += el.offsetTop || 0;
      el = el.offsetParent;
    }
    const w = notationSvg.getAttribute('width');
    const h = notationSvg.getAttribute('height');
    const width = (w != null && w !== '100%') ? parseFloat(w) : (notationSvg.getBoundingClientRect().width || pageWidth);
    const height = (h != null && h !== '100%') ? parseFloat(h) : (notationSvg.getBoundingClientRect().height || 500);
    const inner = notationSvg.innerHTML;
    const vb = notationSvg.getAttribute('viewBox') || `0 0 ${width} ${height}`;
    notationGroup = `<g transform="translate(${tx}, ${ty})"><svg xmlns="${XMLNS}" x="0" y="0" width="${width}" height="${height}" viewBox="${escapeXml(vb)}" preserveAspectRatio="xMidYMin meet">${inner}</svg></g>`;
  }

  const contentString = `<g id="scoreContent">${bg}${titleText}${authorText}${notationGroup}</g>`;

  return { defsString, contentString, contentHeight, orientation };
}

/**
 * Tagastab ühe lehe (A4) SVG stringi. pageIndex 0 = esimene leht.
 * orientation 'landscape' → viewBox "0 0 1123 794", muul juhul "0 0 794 1123".
 */
export function getPageSvgString (defsString, contentString, contentHeight, pageIndex, orientation = 'portrait') {
  const { w: PAGE_W, h: PAGE_H } = getPageWh(orientation);
  const y = -pageIndex * PAGE_H;
  return `<svg xmlns="${XMLNS}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}" height="${PAGE_H}">
${defsString}
<defs><clipPath id="pageClip"><rect x="0" y="0" width="${PAGE_W}" height="${PAGE_H}"/></clipPath></defs>
<g transform="translate(0, ${y})" clip-path="url(#pageClip)">${contentString}</g>
</svg>`;
}

/**
 * Tagastab esimese lehe eelvaate SVG stringi (viewBox sünkroonitud orientationiga).
 */
export function getFirstPageSvgString (defsString, contentString, contentHeight, orientation = 'portrait') {
  return getPageSvgString(defsString, contentString, contentHeight, 0, orientation);
}
