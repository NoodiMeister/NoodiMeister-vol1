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

function getBoxTextLayout(box) {
  const width = Math.max(40, Number(box?.width) || 200);
  const height = Math.max(24, Number(box?.height) || 60);
  const fontSize = Math.max(8, Number(box?.fontSize) || 14);
  const lineHeight = Math.max(fontSize * 1.25, fontSize + 4);
  const lines = wrapBoxText(box?.text || '', width, fontSize);
  const textAlign = box?.textAlign === 'left' || box?.textAlign === 'right' ? box.textAlign : 'center';
  const anchor = textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle';
  const x = textAlign === 'left' ? 8 : textAlign === 'right' ? width - 8 : width / 2;
  const availableHeight = Math.max(lineHeight, height - 8);
  const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const totalTextHeight = visibleLines.length * lineHeight;
  const startY = Math.max(fontSize, (height - totalTextHeight) / 2 + fontSize);
  return { width, height, fontSize, lineHeight, visibleLines, anchor, x, startY };
}

export function buildTextBoxesSvgMarkup(textBoxes = [], options = {}) {
  const fallbackFamily = resolveExportTextFamily(options.defaultFontFamily, 'ExportBody');
  const fillColor = escapeXml(options.defaultFill || '#78350f');
  return textBoxes.map((box) => {
    if (!box || box.x == null || box.y == null) return '';
    const { width, height, fontSize, lineHeight, visibleLines, anchor, x, startY } = getBoxTextLayout(box);
    const fontFamily = resolveExportTextFamily(box.fontFamily, fallbackFamily);
    const fontWeight = box.fontWeight ? ` font-weight="${escapeXml(box.fontWeight)}"` : '';
    const fontStyle = box.fontStyle ? ` font-style="${escapeXml(box.fontStyle)}"` : '';
    const text = visibleLines.map((line, idx) => (
      `<tspan x="${x}" y="${startY + idx * lineHeight}">${escapeXml(line)}</tspan>`
    )).join('');
    return `<g transform="translate(${Number(box.x) || 0}, ${Number(box.y) || 0})">
  <rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="rgba(255,255,255,0.95)" stroke="#fcd34d" stroke-width="1.5"/>
  <text x="${x}" y="${startY}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" fill="${fillColor}"${fontWeight}${fontStyle}>${text}</text>
</g>`;
  }).join('');
}
