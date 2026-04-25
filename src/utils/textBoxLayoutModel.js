export function resolveTextBoxLineHeightPx(input = {}, fallbackFontSize = 14) {
  const fontSize = Math.max(8, Number(input?.fontSize) || Number(fallbackFontSize) || 14);
  const explicit = Number(input?.lineHeight);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(fontSize, explicit);
  }
  return Math.max(fontSize * 1.2, fontSize + 2);
}

