import { resolveExportTextFamily } from './exportFontAssets';

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLine(line, maxChars) {
  const text = String(line || '').trim();
  if (!text) return [''];
  if (maxChars <= 0 || text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) lines.push(current);
  return lines;
}

function getCanvasTextContext({ fontSize, fontFamily, fontWeight, fontStyle }) {
  try {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const size = Math.max(8, Number(fontSize) || 14);
    const family = String(fontFamily || 'serif');
    const weight = String(fontWeight || 'normal');
    const style = String(fontStyle || 'normal');
    ctx.font = `${style} ${weight} ${size}px ${family}`;
    return ctx;
  } catch (_) {
    return null;
  }
}

function wrapLineByMeasuredWidth(line, maxWidth, ctx) {
  const text = String(line || '');
  const limit = Math.max(12, Number(maxWidth) || 12);
  if (!ctx) return wrapLine(text, Math.max(1, Math.floor(limit / 8)));
  if (!text.trim()) return [''];
  if (ctx.measureText(text).width <= limit) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > limit) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function wrapBoxText(text, width, fontSize, style = {}) {
  const measureCtx = getCanvasTextContext({
    fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
  });
  const contentWidth = Math.max(24, Number(width) || 24);
  if (measureCtx) {
    return String(text || '')
      .split(/\r?\n/)
      .flatMap((line) => wrapLineByMeasuredWidth(line, contentWidth, measureCtx));
  }
  const approxCharWidth = Math.max(5, Number(fontSize) * 0.56);
  const maxChars = Math.max(1, Math.floor((Math.max(40, Number(contentWidth) || 200) - 16) / approxCharWidth));
  return String(text || '')
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(line, maxChars));
}

function clampColumnCount(value) {
  const n = Math.floor(Number(value) || 1);
  return Math.max(1, Math.min(5, n));
}

function getBoxTextLayout(box) {
  const width = Math.max(40, Number(box?.width) || 200);
  const height = Math.max(24, Number(box?.height) || 60);
  const fontSize = Math.max(8, Number(box?.fontSize) || 14);
  const lineHeight = Math.max(fontSize * 1.25, fontSize + 4);
  const columnCount = clampColumnCount(box?.columnCount);
  const columnGap = columnCount > 1 ? 16 : 0;
  const textInnerWidth = Math.max(24, width - 16);
  const totalGapWidth = Math.max(0, (columnCount - 1) * columnGap);
  const columnWidth = Math.max(12, (textInnerWidth - totalGapWidth) / columnCount);
  const lines = wrapBoxText(box?.text || '', columnWidth + 16, fontSize, {
    fontFamily: box?.fontFamily,
    fontWeight: box?.fontWeight,
    fontStyle: box?.fontStyle,
  });
  const textAlign = box?.textAlign === 'left' || box?.textAlign === 'right' ? box.textAlign : 'center';
  const anchor = textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle';
  const availableHeight = Math.max(lineHeight, height - 10);
  const maxLinesPerColumn = Math.max(1, Math.floor(availableHeight / lineHeight));
  const startY = Math.max(fontSize, 6 + fontSize);
  const clipId = `nm-textbox-clip-${String(box?.id || `${Math.round(Number(box?.x) || 0)}-${Math.round(Number(box?.y) || 0)}`).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const columns = Array.from({ length: columnCount }, (_, idx) => {
    const start = idx * maxLinesPerColumn;
    const end = start + Math.max(lines.length, maxLinesPerColumn);
    const columnLines = lines.slice(start, end);
    const colStartX = 8 + idx * (columnWidth + columnGap);
    const x = textAlign === 'left'
      ? colStartX
      : textAlign === 'right'
        ? colStartX + columnWidth
        : colStartX + columnWidth / 2;
    return { lines: columnLines, x };
  });
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
