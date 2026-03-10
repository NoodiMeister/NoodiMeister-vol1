/**
 * Figured bass figurations for harpsichord (and organ).
 * Loads definitions from public/fonts/fonts_figuredbass.xml when available,
 * and provides rendering helpers for the figured-bass view.
 */
import React from 'react';

const DEFAULT_FIGURES = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '#', 'b', 'h', 'bb', '##',
  '/', '\\', '+', '(', ')'
];

let cachedXmlFigures = null;

/**
 * Parse fonts_figuredbass.xml (MuseScore-style) and return list of figure chars.
 * @param {string} xmlText - Raw XML string
 * @returns {string[]} List of figure characters/strings
 */
export function parseFiguredBassXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return DEFAULT_FIGURES;
  const figures = [];
  const re = /<figure\s[^>]*\bchar="([^"]*)"|id="([^"]*)"[^>]*>/gi;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const char = m[1] || m[2];
    if (char && !figures.includes(char)) figures.push(char);
  }
  if (figures.length === 0) return DEFAULT_FIGURES;
  return figures;
}

/**
 * Fetch and cache fonts_figuredbass.xml from public/fonts.
 * @returns {Promise<string[]>} Resolved with list of figure chars
 */
export async function loadFiguredBassFigurations() {
  if (cachedXmlFigures) return cachedXmlFigures;
  try {
    const base = typeof window !== 'undefined' && window.__BASE_PATH__ ? window.__BASE_PATH__ : '';
    const res = await fetch(`${base}/fonts/fonts_figuredbass.xml`);
    if (!res.ok) return DEFAULT_FIGURES;
    const text = await res.text();
    cachedXmlFigures = parseFiguredBassXml(text);
    return cachedXmlFigures;
  } catch {
    return DEFAULT_FIGURES;
  }
}

/**
 * Tokenize a figured-bass string into display tokens (numbers, slashes, accidentals).
 * E.g. "6/5" -> ["6", "/", "5"], "4#3" -> ["4", "#", "3"].
 * @param {string} str - User input (e.g. "6/5", "4/3", "7-5")
 * @returns {{ type: 'digit'|'slash'|'accidental'|'other', value: string }[]}
 */
export function tokenizeFiguredBass(str) {
  if (!str || typeof str !== 'string') return [];
  const s = str.trim();
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\d/.test(c)) {
      tokens.push({ type: 'digit', value: c });
      i++;
    } else if (c === '/' || c === '\\') {
      tokens.push({ type: 'slash', value: c });
      i++;
    } else if (c === '#' || c === 'b' || c === 'h' || c === '+') {
      let val = c;
      if (c === '#' && s[i + 1] === '#') { val = '##'; i += 2; }
      else if (c === 'b' && s[i + 1] === 'b') { val = 'bb'; i += 2; }
      else i++;
      tokens.push({ type: 'accidental', value: val });
    } else if (c === '(' || c === ')') {
      tokens.push({ type: 'other', value: c });
      i++;
    } else if (c === '-' || c === ',' || c === ' ') {
      tokens.push({ type: 'other', value: c });
      i++;
    } else {
      tokens.push({ type: 'other', value: c });
      i++;
    }
  }
  return tokens;
}

/**
 * Default font family for figured bass (serif, small caps style).
 */
export const FIGUREDBASS_FONT_FAMILY = 'Georgia, "Times New Roman", serif';

/**
 * Render figured bass text using figurations: stacked digits with slashes,
 * suitable for SVG when instrument is harpsichord/organ and view is figuredBass.
 * @param {string} figuredBass - Raw string (e.g. "6/5", "4/3")
 * @param {{ x: number, y: number, fontSize?: number, fill?: string, fontFamily?: string }} options - SVG position and style
 * @returns {import('react').ReactNode} Fragment with <tspan> elements for stacked figures
 */
export function renderFiguredBassFigurations(figuredBass, options = {}) {
  const { x = 0, y = 0, fontSize = 11, fill = '#555', fontFamily = FIGUREDBASS_FONT_FAMILY } = options;
  const tokens = tokenizeFiguredBass(figuredBass);
  if (tokens.length === 0) return null;

  const lineHeight = fontSize * 0.85;
  const elements = [];
  let dy = 0;
  let slashSeen = false;

  tokens.forEach((t, i) => {
    if (t.type === 'slash' || (t.type === 'other' && (t.value === '-' || t.value === ','))) {
      elements.push(
        <tspan key={i} x={x} dy={dy} fontSize={fontSize} fill={fill} fontFamily={fontFamily}>{t.value}</tspan>
      );
      dy = 0;
      if (t.type === 'slash') slashSeen = true;
    } else {
      const isDigit = t.type === 'digit';
      const baselineShift = slashSeen && isDigit ? -lineHeight : 0;
      elements.push(
        <tspan
          key={i}
          x={x}
          dy={dy}
          fontSize={isDigit ? fontSize * 0.95 : fontSize}
          fill={fill}
          fontFamily={fontFamily}
          baselineShift={baselineShift ? `${baselineShift}px` : undefined}
        >
          {t.value}
        </tspan>
      );
      dy = 0;
    }
  });

  return (
    <text x={x} y={y} textAnchor="start" fontFamily={fontFamily} fontSize={fontSize} fill={fill}>
      {elements}
    </text>
  );
}
