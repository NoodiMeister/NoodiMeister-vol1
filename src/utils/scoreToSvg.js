/**
 * Noodilehe (ScorePage) serialiseerimine paged-SVG kujule.
 * Kasutatakse PDF eelvaate, vektor-PDF ekspordi ja print SVG lehtede jaoks.
 */

import { getExportOrientation, getPageCount, getPageMetrics } from './pageGeometry';
import { getExportFontFaceCss, resolveExportTextFamily } from '../export/exportFontAssets';

const XMLNS = 'http://www.w3.org/2000/svg';
const DEFAULT_PAGE_MARGIN_PX = 0;
/** Parem serv: topelt-taktijoone paks joon + anti-alias; vältimaks clipPath/svg2pdf lõikamist. */
const EXPORT_RIGHT_EDGE_PAD_PX = 14;

function hasSmuflTimeSigDigits (text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xE080 && code <= 0xE089) return true;
  }
  return false;
}

/**
 * Legacy helper: asendas SMuFL taktimõõdu numbrid ASCII-ga (sans-serif), et vältida
 * vanemates svg2pdf/Windows kombinatsioonides vigase fonti. PDF-ekspordi põhitee kasutab
 * nüüd otse ekspordi @font-face (Leland → Bravura woff2), et eelvaade ja fail ühtiksid.
 * Seda funktsiooni võib kasutada ainult kui konkreetses keskkonnas SMuFL PDF-is ikka läheb katki.
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
 * Leiab konteinerist noodistiku SVG (eelista suurimat partituuri-SVG-d).
 */
function findNotationSvg (container, preferredSvg = null) {
  if (preferredSvg && typeof preferredSvg.getAttribute === 'function') {
    return preferredSvg;
  }
  const svgs = container.querySelectorAll('svg');
  let best = null;
  let bestScore = -1;
  let richest = null;
  let richestLen = -1;
  svgs.forEach((el) => {
    let w = 0;
    let h = 0;
    const vb = el.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/\s+/);
      if (parts.length >= 4) {
        w = parseFloat(parts[2]) || 0;
        h = parseFloat(parts[3]) || 0;
      }
    }
    if (!(w > 0 && h > 0)) {
      const widthAttr = parseFloat(el.getAttribute('width') || '0');
      const heightAttr = parseFloat(el.getAttribute('height') || '0');
      w = widthAttr > 0 ? widthAttr : (el.getBoundingClientRect?.().width || 0);
      h = heightAttr > 0 ? heightAttr : (el.getBoundingClientRect?.().height || 0);
    }
    const area = w * h;
    const contentLen = (el.innerHTML?.length || 0);
    const complexityBoost = Math.min(400000, contentLen * 6) + Math.min(120000, (el.childElementCount || 0) * 80);
    const score = area + complexityBoost;
    if (contentLen > richestLen) {
      richestLen = contentLen;
      richest = el;
    }
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  });
  if (best) return best;
  return richest;
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

/**
 * Timeline SVG: width="100%" + viewBox (fikseeritud noodikoordinaadid). getBoundingClientRect().width
 * sõltub vaateakna laiusest — PDF/print eelvaade (nt kitsas Cursor Simple Browser) moonutaks geomeetriat
 * ja võib lõigata parema serva (sh topelt-taktijoon).
 */
function getSvgIntrinsicDimensions (svg, pageWidthFallback = 794) {
  const viewBoxRaw = svg.getAttribute('viewBox');
  let vbW = 0;
  let vbH = 0;
  if (viewBoxRaw) {
    const p = viewBoxRaw.trim().split(/[\s,]+/);
    if (p.length >= 4) {
      vbW = Math.max(1, parseFloat(p[2]) || 0);
      vbH = Math.max(1, parseFloat(p[3]) || 0);
    }
  }
  const wa = svg.getAttribute('width');
  const ha = svg.getAttribute('height');
  const widthIsPercent = wa == null || String(wa).includes('%');
  const heightIsPercent = ha == null || String(ha).includes('%');
  const wAttr = !widthIsPercent && wa != null ? parseFloat(wa) : NaN;
  const hAttr = !heightIsPercent && ha != null ? parseFloat(ha) : NaN;
  const rect = svg.getBoundingClientRect?.();
  const width = (Number.isFinite(wAttr) && wAttr > 0)
    ? wAttr
    : (vbW > 0 ? vbW : (rect?.width || pageWidthFallback));
  const height = (Number.isFinite(hAttr) && hAttr > 0)
    ? hAttr
    : (vbH > 0 ? vbH : (rect?.height || 500));
  const viewBox = (viewBoxRaw && viewBoxRaw.trim()) || `0 0 ${width} ${height}`;
  return { width, height, viewBox };
}

/**
 * Ekspordi/print SVG innerHTML sisaldab ka UI-kihte, mida ekraanil peidetakse CSS-iga — eraldi SVG-s (PDF, print)
 * need reeglid ei kehti. Eemaldame need klasside järgi.
 */
const EXPORT_STRIP_SELECTORS = [
  '.nm-cursor',
  '.staff-spacer-handle',
  '.nm-selection-highlight',
  '.nm-note-selection-glow',
];

function stripExportUiFromSvgInnerHtml (innerHtml) {
  const raw = innerHtml == null ? '' : String(innerHtml);
  const needsStrip = EXPORT_STRIP_SELECTORS.some((sel) => {
    const token = sel.slice(1);
    return raw.includes(token);
  });
  if (!needsStrip) return raw;
  try {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="${XMLNS}">${raw}</svg>`,
      'image/svg+xml'
    );
    const root = doc.documentElement;
    EXPORT_STRIP_SELECTORS.forEach((sel) => {
      root.querySelectorAll(sel).forEach((el) => el.remove());
    });
    return Array.from(root.childNodes).map((n) => new XMLSerializer().serializeToString(n)).join('');
  } catch (_) {
    return raw;
  }
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

function clampScale (value) {
  return Math.max(0.25, Math.min(3, Number(value) || 1));
}

/**
 * Canonical export/print layout snapshot.
 * All page renderers (preview, pdf, print) must derive geometry from this single model.
 */
function buildLayoutSnapshot ({
  pageMetrics,
  headerHeight,
  sceneX = 0,
  sceneY = 0,
  sceneWidth = 0,
  sceneHeight = 0,
  exportScaleFactor = 1,
  explicitContentWidth,
  explicitContentHeight,
  /** Vertikaalvoog + ühe lehe laiune stseen: ära luba exportScaleFactor suurendada stseeni lehest laiemaks (muidu pageClip lõikab parema serva). */
  clampScoreWidthToContent = false,
}) {
  const pageWidth = Number(pageMetrics?.widthPx) || 0;
  const pageHeight = Number(pageMetrics?.heightPx) || 0;
  const marginTop = DEFAULT_PAGE_MARGIN_PX;
  const marginRight = DEFAULT_PAGE_MARGIN_PX;
  const marginBottom = DEFAULT_PAGE_MARGIN_PX;
  const marginLeft = DEFAULT_PAGE_MARGIN_PX;
  const contentX = marginLeft;
  const contentY = marginTop + Math.max(0, Number(headerHeight) || 0);
  const contentWidth = Math.max(1, pageWidth - marginLeft - marginRight);
  const contentHeight = Math.max(1, pageHeight - marginTop - marginBottom - Math.max(0, Number(headerHeight) || 0));
  let scale = clampScale(exportScaleFactor);
  const sourceW = Math.max(1, Number(sceneWidth) || contentWidth);
  const sourceH = Math.max(1, Number(sceneHeight) || contentHeight);
  if (clampScoreWidthToContent && sourceW > 0) {
    const ox = Math.max(0, Number(sceneX) || 0);
    const maxW = Math.max(1, contentWidth - EXPORT_RIGHT_EDGE_PAD_PX - ox);
    const maxScaleW = maxW / sourceW;
    if (Number.isFinite(maxScaleW) && maxScaleW > 0) {
      scale = Math.min(scale, maxScaleW);
    }
  }
  const scoreW = sourceW * scale;
  const scoreH = sourceH * scale;
  const scoreOffsetX = Number(sceneX) || 0;
  const scoreOffsetY = Number(sceneY) || 0;
  const finalContentWidth = Math.max(pageWidth, Number(explicitContentWidth) || (contentX + scoreOffsetX + scoreW + marginRight));
  const finalContentHeight = Math.max(pageHeight, Number(explicitContentHeight) || (contentY + scoreOffsetY + scoreH + marginBottom));
  return {
    page: {
      widthPx: pageWidth,
      heightPx: pageHeight,
      marginTopPx: marginTop,
      marginRightPx: marginRight,
      marginBottomPx: marginBottom,
      marginLeftPx: marginLeft,
    },
    header: {
      totalHeightPx: Math.max(0, Number(headerHeight) || 0),
    },
    content: {
      xPx: contentX,
      yPx: contentY,
      widthPx: contentWidth,
      heightPx: contentHeight,
    },
    score: {
      sourceWidthPx: sourceW,
      sourceHeightPx: sourceH,
      scale,
      offsetXPx: scoreOffsetX,
      offsetYPx: scoreOffsetY,
      widthPx: scoreW,
      heightPx: scoreH,
    },
    output: {
      contentWidth: finalContentWidth,
      contentHeight: finalContentHeight,
    },
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
  // Avoid dominant-baseline clipping differences across SVG/PDF engines.
  const titleY = Math.max(56, 24 + Number(titleFontSize || 55));
  const authorY = titleY + Math.max(26, Number(authorFontSize || 14) + 16);
  return {
    headerHeight: Math.max(160, authorY + 36),
    titleText: `<text x="${titleX}" y="${titleY}" text-anchor="${anchor}" style="${titleStyle}">${escapeXml(songTitle) || 'Nimetu'}</text>`,
    authorText: `<text x="${authorX}" y="${authorY}" text-anchor="${authorAnchor}" style="${authorStyle}">${escapeXml(author)}</text>`,
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
    pageDesignFit = 'cover',
    pageDesignPositionX = 50,
    pageDesignPositionY = 50,
    pageDesignCrop = null,
    pageDesignLayer = 'behind',
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
    exportScaleFactor = 1,
  } = options;
  const scaleFactor = clampScale(exportScaleFactor);
  const defsString = buildFontDefs();
  const textMarkup = buildScoreTextMarkup(pageWidth, options);
  const sceneW = Math.max(1, Number(sceneWidth) || pageWidth);
  const sceneH = Math.max(1, Number(sceneHeight) || 1);
  const singlePageWideScene = flowDirection === 'vertical' && sceneW <= pageWidth * 1.06;
  const snapshot = buildLayoutSnapshot({
    pageMetrics,
    headerHeight: textMarkup.headerHeight,
    sceneX: Number(sceneX || 0),
    sceneY: Number(sceneY || 0),
    sceneWidth: sceneW,
    sceneHeight: sceneH,
    exportScaleFactor: scaleFactor,
    explicitContentWidth,
    explicitContentHeight,
    clampScoreWidthToContent: singlePageWideScene,
  });
  const viewBox = escapeXml(sceneViewBox || `0 0 ${sceneW} ${sceneH}`);
  const sceneSvg = sceneMarkup
    ? `<g transform="translate(${snapshot.content.xPx + snapshot.score.offsetXPx}, ${snapshot.content.yPx + snapshot.score.offsetYPx}) scale(${snapshot.score.scale})"><svg xmlns="${XMLNS}" x="0" y="0" width="${sceneW}" height="${sceneH}" viewBox="${viewBox}" preserveAspectRatio="xMidYMin meet" overflow="visible">${sceneMarkup}</svg></g>`
    : '';
  const contentString = `<g id="scoreContent">${textMarkup.titleText}${textMarkup.authorText}${sceneSvg}${overlayMarkup || ''}</g>`;
  const pageModel = normalizePageModel({
    pageMetrics,
    flowDirection,
    contentWidth: snapshot.output.contentWidth,
    contentHeight: snapshot.output.contentHeight,
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
    pageDesignFit: pageDesignFit === 'contain' ? 'contain' : 'cover',
    pageDesignPositionX: Math.max(0, Math.min(100, Number(pageDesignPositionX) || 50)),
    pageDesignPositionY: Math.max(0, Math.min(100, Number(pageDesignPositionY) || 50)),
    pageDesignCrop: pageDesignCrop && typeof pageDesignCrop === 'object'
      ? {
          top: Math.max(0, Math.min(50, Number(pageDesignCrop.top) || 0)),
          right: Math.max(0, Math.min(50, Number(pageDesignCrop.right) || 0)),
          bottom: Math.max(0, Math.min(50, Number(pageDesignCrop.bottom) || 0)),
          left: Math.max(0, Math.min(50, Number(pageDesignCrop.left) || 0)),
        }
      : { top: 0, right: 0, bottom: 0, left: 0 },
    pageDesignLayer: pageDesignLayer === 'inFront' ? 'inFront' : 'behind',
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
    const svgCount = container?.querySelectorAll?.('svg')?.length || 0;
    throw new Error(`Notation SVG not found (svgCount=${svgCount})`);
  }
  // If caller passes an explicit notation SVG, use stable origin from SVG coordinates
  // instead of DOM rect/scroll math (which can drift between preview/print captures).
  const useStableNotationOrigin = Boolean(notationSvgElement);
  const { x: tx, y: ty } = useStableNotationOrigin
    ? { x: 0, y: 0 }
    : getRelativePosition(container, notationSvg);
  const { width, height, viewBox } = getSvgIntrinsicDimensions(notationSvg, pageWidth);
  const sourceContentWidth = useStableNotationOrigin ? width : (container.scrollWidth || pageWidth);
  const sourceContentHeight = useStableNotationOrigin ? height : (container.scrollHeight || pageHeight);
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
    // Ära korruta suumiga enne layoutSnapshot’i: tegelik skaala (sh laiuse piirang) rakendatakse buildLayoutSnapshot’is.
    contentWidth: Math.max(pageWidth, Number(explicitContentWidth) || sourceContentWidth),
    contentHeight: Math.max(pageHeight, Number(explicitContentHeight) || sourceContentHeight),
    sceneMarkup: stripExportUiFromSvgInnerHtml(notationSvg.innerHTML),
    sceneX: tx,
    sceneY: ty,
    sceneWidth: width,
    sceneHeight: height,
    sceneViewBox: viewBox,
    exportScaleFactor: options.exportScaleFactor,
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
  const mergedOverlays = {
    footerText: pageModel?.footerText,
    pageDesignDataUrl: pageModel?.pageDesignDataUrl,
    pageDesignOpacity: pageModel?.pageDesignOpacity,
    pageDesignFit: pageModel?.pageDesignFit,
    pageDesignPositionX: pageModel?.pageDesignPositionX,
    pageDesignPositionY: pageModel?.pageDesignPositionY,
    pageDesignCrop: pageModel?.pageDesignCrop,
    pageDesignLayer: pageModel?.pageDesignLayer,
    ...(overlays || {}),
  };
  const x = flowDirection === 'horizontal' ? -pageIndex * PAGE_W : 0;
  const y = flowDirection === 'vertical' ? -pageIndex * PAGE_H : 0;
  // Parema serva lõikamine (clipPath) võib lõigata topelt-taktijoone paksust joont; lisa horisontaalne padi.
  const BLEED = 0;
  const clipPadRight = flowDirection === 'vertical' ? 32 : 12;
  const pageDesignMarkup = (() => {
    const href = typeof mergedOverlays.pageDesignDataUrl === 'string' ? mergedOverlays.pageDesignDataUrl.trim() : '';
    if (!href) return { behind: '', front: '' };
    const opacity = Number.isFinite(Number(mergedOverlays.pageDesignOpacity))
      ? Math.max(0, Math.min(1, Number(mergedOverlays.pageDesignOpacity)))
      : 0.25;
    const fit = mergedOverlays.pageDesignFit === 'contain' ? 'contain' : 'cover';
    const posX = Math.max(0, Math.min(100, Number(mergedOverlays.pageDesignPositionX) || 50));
    const posY = Math.max(0, Math.min(100, Number(mergedOverlays.pageDesignPositionY) || 50));
    const crop = mergedOverlays.pageDesignCrop && typeof mergedOverlays.pageDesignCrop === 'object'
      ? {
          top: Math.max(0, Math.min(50, Number(mergedOverlays.pageDesignCrop.top) || 0)),
          right: Math.max(0, Math.min(50, Number(mergedOverlays.pageDesignCrop.right) || 0)),
          bottom: Math.max(0, Math.min(50, Number(mergedOverlays.pageDesignCrop.bottom) || 0)),
          left: Math.max(0, Math.min(50, Number(mergedOverlays.pageDesignCrop.left) || 0)),
        }
      : { top: 0, right: 0, bottom: 0, left: 0 };
    const alignX = posX < 33 ? 'xMin' : posX > 66 ? 'xMax' : 'xMid';
    const alignY = posY < 33 ? 'YMin' : posY > 66 ? 'YMax' : 'YMid';
    const preserveAspectRatio = fit === 'contain'
      ? `${alignX}${alignY} meet`
      : `${alignX}${alignY} slice`;
    const image = fit === 'cover' || fit === 'contain'
      ? `<image href="${String(href).replace(/"/g, '&quot;')}" x="0" y="0" width="${PAGE_W}" height="${PAGE_H}" preserveAspectRatio="${preserveAspectRatio}" opacity="${opacity}"/>`
      : `<image href="${String(href).replace(/"/g, '&quot;')}" x="0" y="0" width="${PAGE_W}" height="${PAGE_H}" preserveAspectRatio="none" opacity="${opacity}"/>`;
    const cropId = `pageDesignCrop-${pageIndex}`;
    const hasCrop = crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0;
    const cropped = hasCrop
      ? `<defs><clipPath id="${cropId}"><rect x="${(crop.left / 100) * PAGE_W}" y="${(crop.top / 100) * PAGE_H}" width="${PAGE_W - ((crop.left + crop.right) / 100) * PAGE_W}" height="${PAGE_H - ((crop.top + crop.bottom) / 100) * PAGE_H}"/></clipPath></defs><g clip-path="url(#${cropId})">${image}</g>`
      : image;
    if (mergedOverlays.pageDesignLayer === 'inFront') return { behind: '', front: cropped };
    return { behind: cropped, front: '' };
  })();
  const footer = (() => {
    const text = typeof mergedOverlays.footerText === 'string' ? mergedOverlays.footerText.trim() : '';
    if (!text) return '';
    const align = mergedOverlays.footerAlignment === 'left' || mergedOverlays.footerAlignment === 'right' ? mergedOverlays.footerAlignment : 'center';
    const x = align === 'left' ? 40 : align === 'right' ? (PAGE_W - 40) : (PAGE_W / 2);
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    const fontSize = Number.isFinite(Number(mergedOverlays.footerFontSize)) ? Math.max(8, Math.min(18, Number(mergedOverlays.footerFontSize))) : 10;
    const opacity = Number.isFinite(Number(mergedOverlays.footerOpacity)) ? Math.max(0.2, Math.min(1, Number(mergedOverlays.footerOpacity))) : 0.85;
    const style = `font-family: ExportBody, serif; font-size: ${fontSize}px; fill: #57534e; opacity: ${opacity};`;
    const yPos = PAGE_H - 26;
    return `<text x="${x}" y="${yPos}" text-anchor="${anchor}" dominant-baseline="middle" style="${style}">${escapeXml(text)}</text>`;
  })();
  // Valge paber: PDF/print/eelvaade; ei sõltu rakenduse taustast ega teemast. Lehe kujundus joonistatakse peale (behind/front).
  const paperRect = `<rect x="0" y="0" width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`;
  return `<svg xmlns="${XMLNS}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}" height="${PAGE_H}" overflow="visible">
${defsString}
<defs><clipPath id="pageClip"><rect x="${BLEED}" y="${BLEED}" width="${PAGE_W - 2 * BLEED + clipPadRight}" height="${PAGE_H - 2 * BLEED}"/></clipPath></defs>
${paperRect}
${pageDesignMarkup.behind}
<g transform="translate(${x}, ${y})" clip-path="url(#pageClip)">${contentString}</g>
${pageDesignMarkup.front}
${footer}
</svg>`;
}

/**
 * Tagastab esimese lehe eelvaate SVG stringi.
 */
export function getFirstPageSvgString (defsString, contentString, pageModel, overlays = {}) {
  return getPageSvgString(defsString, contentString, pageModel, 0, overlays);
}
