/**
 * Noodilehe (ScorePage) serialiseerimine paged-SVG kujule.
 * Kasutatakse PDF eelvaate, vektor-PDF ekspordi ja print SVG lehtede jaoks.
 */

import { getExportOrientation, getPageCount, getPageMetrics } from './pageGeometry';
import { getExportFontFaceCss, resolveExportTextFamily } from '../export/exportFontAssets';

const XMLNS = 'http://www.w3.org/2000/svg';

function hasSmuflTimeSigDigits (text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xE080 && code <= 0xE089) return true;
  }
  return false;
}

/**
 * svg2pdf/jsPDF Windows: SMuFL PUA digits (U+E080–U+E089) can fall back to a wrong font,
 * rendering as random letters/diacritics. For export SVG only, convert those glyphs to
 * plain ASCII digits and force a system font.
 */
export function rewriteSmuflTimeSigDigitsToAscii (svgInnerHtml) {
  try {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="${XMLNS}">${svgInnerHtml}</svg>`,
      'image/svg+xml'
    );
    const root = doc.documentElement;
    const texts = root.querySelectorAll('text');
    let changed = false;
    texts.forEach((t) => {
      const original = t.textContent || '';
      if (!hasSmuflTimeSigDigits(original)) return;
      const replaced = original.replace(/[\uE080-\uE089]/g, (ch) => String(ch.charCodeAt(0) - 0xE080));
      if (replaced !== original) {
        t.textContent = replaced;
        // Ensure this renders even if music fonts aren't embedded.
        t.setAttribute('font-family', 'sans-serif');
        const style = t.getAttribute('style');
        if (style && /font-family\s*:/i.test(style)) {
          t.setAttribute('style', style.replace(/font-family\s*:\s*[^;]+;?/i, 'font-family: sans-serif;'));
        }
        changed = true;
      }
    });
    if (!changed) return svgInnerHtml;
    // Serialize children of wrapper root back to innerHTML
    return Array.from(root.childNodes).map((n) => new XMLSerializer().serializeToString(n)).join('');
  } catch (_) {
    return svgInnerHtml;
  }
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

function buildFontDefs () {
  return `<defs>
  <style type="text/css"><![CDATA[
${getExportFontFaceCss()}
  ]]></style>
</defs>`;
}

/**
 * Leiab konteinerist noodistiku SVG (suurim viewBox-iga svg).
 */
function findNotationSvg (container, preferredSvg = null) {
  if (preferredSvg && typeof preferredSvg.getAttribute === 'function' && preferredSvg.getAttribute('viewBox')) {
    return preferredSvg;
  }
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

function getRelativePosition (container, element) {
  const containerRect = container?.getBoundingClientRect?.();
  const elementRect = element?.getBoundingClientRect?.();
  if (containerRect && elementRect && Number.isFinite(elementRect.left) && Number.isFinite(elementRect.top)) {
    return {
      x: Math.max(0, elementRect.left - containerRect.left + (container.scrollLeft || 0)),
      y: Math.max(0, elementRect.top - containerRect.top + (container.scrollTop || 0)),
    };
  }

  let x = 0;
  let y = 0;
  let el = element;
  while (el && el !== container) {
    x += el.offsetLeft || 0;
    y += el.offsetTop || 0;
    el = el.offsetParent;
  }
  return { x, y };
}

function normalizePageModel (pageModel = {}) {
  const pageMetrics = pageModel.pageMetrics || getPageMetrics({
    paperSize: pageModel.paperSize,
    orientation: pageModel.orientation,
  });
  const flowDirection = pageModel.flowDirection === 'horizontal' ? 'horizontal' : 'vertical';
  const contentWidth = Math.max(pageMetrics.widthPx, Number(pageModel.contentWidth) || pageMetrics.widthPx);
  const contentHeight = Math.max(pageMetrics.heightPx, Number(pageModel.contentHeight) || pageMetrics.heightPx);
  const pageExtent = flowDirection === 'horizontal' ? pageMetrics.widthPx : pageMetrics.heightPx;
  return {
    pageMetrics,
    flowDirection,
    contentWidth,
    contentHeight,
    pageCount: getPageCount(flowDirection === 'horizontal' ? contentWidth : contentHeight, pageExtent),
  };
}

function buildScoreTextMarkup (pageWidth, options = {}) {
  const {
    songTitle = '',
    author = '',
    documentFontFamily = 'Noto Serif, serif',
    titleFontFamily = '',
    authorFontFamily = '',
    titleFontSize = 55,
    authorFontSize = 14,
    titleBold = false,
    titleItalic = false,
    authorBold = false,
    authorItalic = false,
    titleAlignment = 'center',
    authorAlignment = 'center',
  } = options;
  const anchor = titleAlignment === 'right' ? 'end' : titleAlignment === 'left' ? 'start' : 'middle';
  const authorAnchor = authorAlignment === 'right' ? 'end' : authorAlignment === 'left' ? 'start' : 'middle';
  const titleX = titleAlignment === 'left' ? 40 : titleAlignment === 'right' ? pageWidth - 40 : pageWidth / 2;
  const authorX = authorAlignment === 'left' ? 40 : authorAlignment === 'right' ? pageWidth - 40 : pageWidth / 2;
  const titleFamily = resolveExportTextFamily(titleFontFamily || documentFontFamily, 'ExportTitle');
  const authorFamily = resolveExportTextFamily(authorFontFamily || documentFontFamily, 'ExportBody');
  const titleStyle = `font-family: ${titleFamily}; font-size: ${titleFontSize}px; font-weight: ${titleBold ? '700' : '400'}; font-style: ${titleItalic ? 'italic' : 'normal'}; fill: #1c1917;`;
  const authorStyle = `font-family: ${authorFamily}; font-size: ${authorFontSize}px; font-weight: ${authorBold ? '700' : '400'}; font-style: ${authorItalic ? 'italic' : 'normal'}; fill: #78716c;`;
  return {
    headerHeight: Math.max(160, 120 + 40),
    titleText: `<text x="${titleX}" y="80" text-anchor="${anchor}" dominant-baseline="middle" style="${titleStyle}">${escapeXml(songTitle) || 'Nimetu'}</text>`,
    authorText: `<text x="${authorX}" y="120" text-anchor="${authorAnchor}" dominant-baseline="middle" style="${authorStyle}">${escapeXml(author)}</text>`,
  };
}

export function buildScoreSceneSnapshot (options = {}) {
  const flowDirection = options.pageFlowDirection === 'horizontal' ? 'horizontal' : 'vertical';
  const orientation = getExportOrientation(options.pageOrientation, flowDirection);
  const pageMetrics = getPageMetrics({
    paperSize: options.paperSize,
    orientation,
  });
  const pageWidth = pageMetrics.widthPx;
  const pageHeight = pageMetrics.heightPx;
  const {
    pageDesignDataUrl,
    pageDesignOpacity = 0.25,
    footerText = '',
    contentWidth: explicitContentWidth,
    contentHeight: explicitContentHeight,
    sceneMarkup = '',
    sceneX = 0,
    sceneY = null,
    sceneWidth = pageWidth,
    sceneHeight = 0,
    sceneViewBox = '',
    overlayMarkup = '',
  } = options;
  const defsString = buildFontDefs();
  const textMarkup = buildScoreTextMarkup(pageWidth, options);
  const effectiveSceneY = Number.isFinite(Number(sceneY)) ? Number(sceneY) : textMarkup.headerHeight;
  const sceneW = Math.max(1, Number(sceneWidth) || pageWidth);
  const sceneH = Math.max(1, Number(sceneHeight) || 1);
  const contentWidth = Math.max(pageWidth, Number(explicitContentWidth) || sceneW);
  const contentHeight = Math.max(pageHeight, Number(explicitContentHeight) || (effectiveSceneY + sceneH + 40));
  const viewBox = escapeXml(sceneViewBox || `0 0 ${sceneW} ${sceneH}`);
  const sceneSvg = sceneMarkup
    ? `<g transform="translate(${sceneX}, ${effectiveSceneY})"><svg xmlns="${XMLNS}" x="0" y="0" width="${sceneW}" height="${sceneH}" viewBox="${viewBox}" preserveAspectRatio="xMidYMin meet">${sceneMarkup}</svg></g>`
    : '';
  const contentString = `<g id="scoreContent">${textMarkup.titleText}${textMarkup.authorText}${sceneSvg}${overlayMarkup || ''}</g>`;
  const pageModel = normalizePageModel({
    pageMetrics,
    flowDirection,
    contentWidth,
    contentHeight,
  });
  return {
    defsString,
    contentString,
    pageMetrics,
    contentWidth: pageModel.contentWidth,
    contentHeight: pageModel.contentHeight,
    flowDirection,
    pageCount: pageModel.pageCount,
    orientation,
    paperSize: pageMetrics.paperSize,
    footerText: String(footerText || ''),
    pageDesignDataUrl: pageDesignDataUrl || '',
    pageDesignOpacity: Math.max(0, Math.min(1, Number(pageDesignOpacity) || 0.25)),
  };
}

/**
 * Tagastab paged-SVG mudeli, mida kasutavad preview/print/PDF.
 */
export function scoreToSvg (container, options = {}) {
  const flowDirection = options.pageFlowDirection === 'horizontal' ? 'horizontal' : 'vertical';
  const orientation = getExportOrientation(options.pageOrientation, flowDirection);
  const pageMetrics = getPageMetrics({
    paperSize: options.paperSize,
    orientation,
  });
  const pageWidth = pageMetrics.widthPx;
  const pageHeight = pageMetrics.heightPx;
  const {
    pageDesignDataUrl,
    pageDesignOpacity = 0.25,
    songTitle = '',
    author = '',
    footerText = '',
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
    contentWidth: explicitContentWidth,
    contentHeight: explicitContentHeight,
    notationSvgElement = null,
  } = options;

  const notationSvg = findNotationSvg(container, notationSvgElement);
  if (!notationSvg) {
    throw new Error('Notation SVG not found');
  }
  const { x: tx, y: ty } = getRelativePosition(container, notationSvg);
  const w = notationSvg.getAttribute('width');
  const h = notationSvg.getAttribute('height');
  const width = (w != null && w !== '100%') ? parseFloat(w) : (notationSvg.getBoundingClientRect().width || pageWidth);
  const height = (h != null && h !== '100%') ? parseFloat(h) : (notationSvg.getBoundingClientRect().height || 500);
  const viewBox = notationSvg.getAttribute('viewBox') || `0 0 ${width} ${height}`;
  return buildScoreSceneSnapshot({
    ...options,
    pageDesignDataUrl,
    pageDesignOpacity,
    songTitle,
    author,
    footerText,
    documentFontFamily,
    titleFontFamily,
    titleFontSize,
    authorFontSize,
    titleBold,
    titleItalic,
    authorBold,
    authorItalic,
    titleAlignment,
    authorAlignment,
    contentWidth: Math.max(pageWidth, Number(explicitContentWidth) || container.scrollWidth || pageWidth),
    contentHeight: Math.max(pageHeight, Number(explicitContentHeight) || container.scrollHeight || pageHeight),
    sceneMarkup: notationSvg.innerHTML,
    sceneX: tx,
    sceneY: ty,
    sceneWidth: width,
    sceneHeight: height,
    sceneViewBox: viewBox,
  });
}

/**
 * Tagastab ühe SVG lehe stringi page-modeli põhjal.
 */
export function getPageSvgString (defsString, contentString, pageModel, pageIndex, overlays = {}) {
  const normalized = normalizePageModel(pageModel);
  const { pageMetrics, flowDirection, pageCount } = normalized;
  const PAGE_W = pageMetrics.widthPx;
  const PAGE_H = pageMetrics.heightPx;
  const x = flowDirection === 'horizontal' ? -pageIndex * PAGE_W : 0;
  const y = flowDirection === 'vertical' ? -pageIndex * PAGE_H : 0;
  // Avoid 1–3 px clipping at page edges (strokes/markers), which can differ by OS/browser.
  // Keep the page size exact, but allow a tiny bleed inside the page clip.
  const BLEED = 2;
  const background = (() => {
    const href = overlays && typeof overlays.pageDesignDataUrl === 'string' ? overlays.pageDesignDataUrl.trim() : '';
    if (!href) return '';
    const opacity = Number.isFinite(Number(overlays.pageDesignOpacity))
      ? Math.max(0, Math.min(1, Number(overlays.pageDesignOpacity)))
      : 0.25;
    return `<image href="${String(href).replace(/"/g, '&quot;')}" x="0" y="0" width="${PAGE_W}" height="${PAGE_H}" preserveAspectRatio="xMidYMid slice" opacity="${opacity}"/>`;
  })();
  const footer = (() => {
    const text = overlays && typeof overlays.footerText === 'string' ? overlays.footerText.trim() : '';
    if (!text) return '';
    const align = overlays.footerAlignment === 'left' || overlays.footerAlignment === 'right' ? overlays.footerAlignment : 'center';
    const x = align === 'left' ? 40 : align === 'right' ? (PAGE_W - 40) : (PAGE_W / 2);
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    const fontSize = Number.isFinite(Number(overlays.footerFontSize)) ? Math.max(8, Math.min(18, Number(overlays.footerFontSize))) : 10;
    const opacity = Number.isFinite(Number(overlays.footerOpacity)) ? Math.max(0.2, Math.min(1, Number(overlays.footerOpacity))) : 0.85;
    const style = `font-family: ExportBody, serif; font-size: ${fontSize}px; fill: #57534e; opacity: ${opacity};`;
    const yPos = PAGE_H - 26;
    return `<text x="${x}" y="${yPos}" text-anchor="${anchor}" dominant-baseline="middle" style="${style}">${escapeXml(text)}</text>`;
  })();
  return `<svg xmlns="${XMLNS}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}" height="${PAGE_H}" overflow="visible">
${defsString}
<defs><clipPath id="pageClip"><rect x="${BLEED}" y="${BLEED}" width="${PAGE_W - 2 * BLEED}" height="${PAGE_H - 2 * BLEED}"/></clipPath></defs>
${background}
<g transform="translate(${x}, ${y})" clip-path="url(#pageClip)">${contentString}</g>
${footer}
</svg>`;
}

/**
 * Tagastab esimese lehe eelvaate SVG stringi.
 */
export function getFirstPageSvgString (defsString, contentString, pageModel, overlays = {}) {
  return getPageSvgString(defsString, contentString, pageModel, 0, overlays);
}
