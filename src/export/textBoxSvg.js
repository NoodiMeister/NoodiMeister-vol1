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

function wrapBoxText(text, width, fontSize) {
  const approxCharWidth = Math.max(5, Number(fontSize) * 0.56);
  const maxChars = Math.max(1, Math.floor((Math.max(40, Number(width) || 200) - 16) / approxCharWidth));
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
  const lines = wrapBoxText(box?.text || '', columnWidth + 16, fontSize);
  const textAlign = box?.textAlign === 'left' || box?.textAlign === 'right' ? box.textAlign : 'center';
  const anchor = textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle';
  const availableHeight = Math.max(lineHeight, height - 10);
  const maxLinesPerColumn = Math.max(1, Math.floor(availableHeight / lineHeight));
  const maxLines = Math.max(1, maxLinesPerColumn * columnCount);
  const visibleLines = lines.slice(0, maxLines);
  const startY = Math.max(fontSize, 6 + fontSize);
  const columns = Array.from({ length: columnCount }, (_, idx) => {
    const start = idx * maxLinesPerColumn;
    const end = start + maxLinesPerColumn;
    const columnLines = visibleLines.slice(start, end);
    const colStartX = 8 + idx * (columnWidth + columnGap);
    const x = textAlign === 'left'
      ? colStartX
      : textAlign === 'right'
        ? colStartX + columnWidth
        : colStartX + columnWidth / 2;
    return { lines: columnLines, x };
  });
  return { width, height, fontSize, lineHeight, columns, anchor, startY };
}

export function buildTextBoxesSvgMarkup(textBoxes = [], options = {}) {
  const fallbackFamily = resolveExportTextFamily(options.defaultFontFamily, 'ExportBody');
  const fillColor = escapeXml(options.defaultFill || '#78350f');
  return textBoxes.map((box) => {
    if (!box || box.x == null || box.y == null) return '';
    const { width, height, fontSize, lineHeight, columns, anchor, startY } = getBoxTextLayout(box);
    const fontFamily = resolveExportTextFamily(box.fontFamily, fallbackFamily);
    const fontWeight = box.fontWeight ? ` font-weight="${escapeXml(box.fontWeight)}"` : '';
    const fontStyle = box.fontStyle ? ` font-style="${escapeXml(box.fontStyle)}"` : '';
    const text = columns.map((column) => (
      column.lines.map((line, idx) => (
        `<tspan x="${column.x}" y="${startY + idx * lineHeight}">${escapeXml(line)}</tspan>`
      )).join('')
    )).join('');
    return `<g transform="translate(${Number(box.x) || 0}, ${Number(box.y) || 0})">
  <rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="rgba(255,255,255,0.95)" stroke="#fcd34d" stroke-width="1.5"/>
  <text x="0" y="${startY}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" fill="${fillColor}"${fontWeight}${fontStyle}>${text}</text>
</g>`;
  }).join('');
}
