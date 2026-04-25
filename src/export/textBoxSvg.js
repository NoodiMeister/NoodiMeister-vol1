import { resolveExportTextFamily } from './exportFontAssets';
import { resolveTextBoxLineHeightPx } from '../utils/textBoxLayoutModel';

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getBoxTextLayout(box) {
  const width = Math.max(40, Number(box?.width) || 200);
  const height = Math.max(24, Number(box?.height) || 60);
  const fontSize = Math.max(8, Number(box?.fontSize) || 14);
  const lineHeight = resolveTextBoxLineHeightPx(box, fontSize);
  // Print/PDF peab kasutama täpselt salvestatud teksti ridu (ainult \n murre),
  // et vältida ekspordi automaatset ümberpaigutust võrreldes editoriga.
  const lines = String(box?.text || '').split(/\r?\n/);
  const textAlign = box?.textAlign === 'left' || box?.textAlign === 'right' ? box.textAlign : 'center';
  const anchor = textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle';
  const startY = Math.max(fontSize, 6 + fontSize);
  const clipId = `nm-textbox-clip-${String(box?.id || `${Math.round(Number(box?.x) || 0)}-${Math.round(Number(box?.y) || 0)}`).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const textInnerWidth = Math.max(24, width - 16);
  const x = textAlign === 'left'
    ? 8
    : textAlign === 'right'
      ? (8 + textInnerWidth)
      : (8 + textInnerWidth / 2);
  const columns = [{ lines, x }];
  return { width, height, fontSize, lineHeight, columns, anchor, startY, clipId };
}

export function buildTextBoxesSvgMarkup(textBoxes = [], options = {}) {
  const fallbackFamily = resolveExportTextFamily(options.defaultFontFamily, 'ExportBody');
  const defaultFill = escapeXml(options.defaultFill || '#000000');
  return textBoxes.map((box) => {
    if (!box || box.x == null || box.y == null) return '';
    const { width, height, fontSize, lineHeight, columns, anchor, startY, clipId } = getBoxTextLayout(box);
    const fontFamily = resolveExportTextFamily(box.fontFamily, fallbackFamily);
    const fontWeight = box.fontWeight ? ` font-weight="${escapeXml(box.fontWeight)}"` : '';
    const fontStyle = box.fontStyle ? ` font-style="${escapeXml(box.fontStyle)}"` : '';
    const fillColor = escapeXml(box.color || defaultFill);
    const text = columns.map((column) => (
      column.lines.map((line, idx) => (
        `<tspan x="${column.x}" y="${startY + idx * lineHeight}">${escapeXml(line)}</tspan>`
      )).join('')
    )).join('');
    return `<g transform="translate(${Number(box.x) || 0}, ${Number(box.y) || 0})">
  <defs><clipPath id="${clipId}"><rect x="8" y="6" width="${Math.max(1, width - 16)}" height="${Math.max(1, height - 10)}"/></clipPath></defs>
  <rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="rgba(255,255,255,0.95)" stroke="#fcd34d" stroke-width="1.5"/>
  <text x="0" y="${startY}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" fill="${fillColor}" clip-path="url(#${clipId})"${fontWeight}${fontStyle}>${text}</text>
</g>`;
  }).join('');
}
