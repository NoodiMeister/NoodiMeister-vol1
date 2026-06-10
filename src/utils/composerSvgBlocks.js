import { PAGE_DIMENSIONS } from '../layout/LayoutEngine';
import {
  captureNotationProjectPages,
  isNotationCaptureSupported,
} from '../export/notationProjectCapture';
import { renderNotationProjectToSvg, getProjectPageDimensions } from './composerProjectToSvg';

function extractProjectTitle(project, fallbackName) {
  const title = String(project?.songTitle || project?.title || '').trim();
  if (title) return title;
  return String(fallbackName || 'Untitled score');
}

function parseProject(rawContent) {
  try {
    return JSON.parse(rawContent);
  } catch {
    return null;
  }
}

function pageDimensionsFromCapture(capture, project) {
  if (capture?.orientation === 'landscape') {
    return { width: 1123, height: 794, orientation: 'landscape' };
  }
  const fromProject = getProjectPageDimensions(project || {});
  return { width: fromProject.width, height: fromProject.height, orientation: fromProject.orientation };
}

function buildBlockFromSvgMarkup({ title, svgMarkup, sourceWidth, sourceHeight, pageIndex = 0, pageCount = 1 }) {
  const previewScale = sourceWidth > 0 ? (sourceWidth >= 1000 ? 560 / sourceWidth : 420 / sourceWidth) : 0.53;
  const suffix = pageCount > 1 ? ` (lk ${pageIndex + 1})` : '';
  return {
    name: `${title}${suffix}`,
    width: Math.round(sourceWidth * previewScale),
    height: Math.round(sourceHeight * previewScale),
    sourceWidth,
    sourceHeight,
    svgMarkup,
  };
}

function mapCaptureProgress(onProgress, phase, detail) {
  if (!onProgress) return;
  const map = {
    start: [2, detail],
    iframe: [2, detail],
    'editor-ready': [3, detail],
    rendering: [3, detail],
    done: [4, detail],
  };
  const entry = map[phase];
  if (entry) onProgress(entry[0], entry[1]);
}

/**
 * @param {string} rawContent
 * @param {string} [sourceName]
 * @param {{ onProgress?: (stepIndex: number, detail?: string) => void, onPipeline?: (pipeline: 'capture'|'fallback') => void }} [options]
 */
export async function createComposerSvgBlocksFromProjectJson(rawContent, sourceName = '', { onProgress, onPipeline } = {}) {
  onProgress?.(0);
  const parsed = parseProject(rawContent);
  if (!parsed) {
    throw new Error('Ei saanud noodiprojekti lugeda — fail ei ole kehtiv JSON.');
  }
  onProgress?.(1, 'Kontrollin stave\'e ja takte…');
  const title = extractProjectTitle(parsed, sourceName);

  if (isNotationCaptureSupported()) {
    try {
      onPipeline?.('capture');
      const capture = await captureNotationProjectPages(parsed, {
        onProgress: (phase, detail) => mapCaptureProgress(onProgress, phase, detail),
      });
      const dims = pageDimensionsFromCapture(capture, parsed);
      const pages = capture.pages?.length ? capture.pages : [];
      if (pages.length > 0) {
        onProgress?.(4, pages.length > 1 ? `${pages.length} lehte valmis` : 'Leht valmis');
        return {
          blocks: pages.map((svgMarkup, pageIndex) => buildBlockFromSvgMarkup({
            title,
            svgMarkup,
            sourceWidth: dims.width,
            sourceHeight: dims.height,
            pageIndex,
            pageCount: pages.length,
          })),
          pipeline: 'capture',
        };
      }
    } catch (_) {
      /* fallback allpool */
    }
  }

  onPipeline?.('fallback');
  onProgress?.(2, 'Kasutan lihtsustatud eelvaadet…');
  const { width: sourceWidth, height: sourceHeight } = getProjectPageDimensions(parsed);
  const svgMarkup = renderNotationProjectToSvg(parsed, { sourceName });
  onProgress?.(3);
  return {
    blocks: [buildBlockFromSvgMarkup({
      title,
      svgMarkup,
      sourceWidth,
      sourceHeight,
      pageIndex: 0,
      pageCount: 1,
    })],
    pipeline: 'fallback',
  };
}

/** @deprecated kasuta createComposerSvgBlocksFromProjectJson */
export function createComposerSvgBlockFromProjectJson(rawContent, sourceName = '') {
  return createComposerSvgBlocksFromProjectJson(rawContent, sourceName).then((r) => r.blocks[0]);
}

export function createComposerSvgBlockFromSvgMarkup(svgMarkup, sourceName = 'SVG block') {
  const dims = PAGE_DIMENSIONS.portrait;
  return buildBlockFromSvgMarkup({
    title: sourceName,
    svgMarkup: String(svgMarkup || ''),
    sourceWidth: dims.width,
    sourceHeight: dims.height,
  });
}
