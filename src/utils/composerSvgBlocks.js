function safe(v) {
  return String(v || '').replace(/[<>&"]/g, (ch) => {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    return '&quot;';
  });
}

function extractProjectTitle(project, fallbackName) {
  const title = String(project?.songTitle || project?.title || '').trim();
  if (title) return title;
  return String(fallbackName || 'Untitled score');
}

function extractSummary(project) {
  const notationMode = project?.notationMode || (project?.gridOnlyMode ? 'figurenotes' : 'traditional');
  const beats = Number(project?.timeSignature?.beats);
  const beatUnit = Number(project?.timeSignature?.beatUnit);
  const timeSig = beats > 0 && beatUnit > 0 ? `${beats}/${beatUnit}` : '4/4';
  const staves = Array.isArray(project?.staves) ? project.staves.length : 1;
  const paperSize = String(project?.paperSize || 'A4').toUpperCase();
  const orientation = project?.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  return { notationMode, timeSig, staves, paperSize, orientation };
}

function letterIndex(letter) {
  const map = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  return map[String(letter || '').toUpperCase()] ?? 0;
}

function pitchToStaffY(pitch, octave, staffCenterY, staffStepPx) {
  const idx = letterIndex(pitch) + (Number(octave) || 4) * 7;
  const e4 = letterIndex('E') + 4 * 7;
  return staffCenterY - ((idx - e4) * staffStepPx);
}

function extractRenderableNotes(project) {
  const out = [];
  if (Array.isArray(project?.notes)) {
    project.notes.forEach((n, idx) => {
      if (n?.isRest) return;
      out.push({
        id: n.id || `n_${idx}`,
        pitch: n.pitch || 'C',
        octave: Number.isFinite(Number(n.octave)) ? Number(n.octave) : 4,
        beat: Number.isFinite(Number(n.beat)) ? Number(n.beat) : idx,
        duration: Number.isFinite(Number(n.duration)) ? Number(n.duration) : 1,
      });
    });
    return out;
  }
  if (Array.isArray(project?.staves)) {
    project.staves.forEach((staff) => {
      (staff?.measures || []).forEach((m) => {
        (m?.notes || []).forEach((n, idx) => {
          if (n?.isRest) return;
          out.push({
            id: n.id || `${staff.id || 'staff'}_${m.startBeat || 0}_${idx}`,
            pitch: n.pitch || 'C',
            octave: Number.isFinite(Number(n.octave)) ? Number(n.octave) : 4,
            beat: Number.isFinite(Number(n.beat)) ? Number(n.beat) : (Number(m.startBeat) || 0) + idx,
            duration: Number.isFinite(Number(n.duration)) ? Number(n.duration) : 1,
          });
        });
      });
    });
  }
  return out;
}

function buildSummarySvg({ title, notationMode, timeSig, staves, sourceName, paperSize, orientation, project }) {
  const modeLabel = String(notationMode || 'traditional').toUpperCase();
  const pageW = orientation === 'landscape' ? 1123 : 794;
  const pageH = orientation === 'landscape' ? 794 : 1123;
  const innerW = pageW - 64;
  const staffStartY = 240;
  const staffLineGap = 20;
  const notes = extractRenderableNotes(project);
  const maxBeat = Math.max(8, ...notes.map((n) => n.beat + n.duration));
  const beatWidth = innerW / maxBeat;

  const noteMarkup = notes.map((n) => {
    const x = 32 + Math.max(0, n.beat) * beatWidth + 8;
    const y = pitchToStaffY(n.pitch, n.octave, staffStartY + staffLineGap * 2, staffLineGap / 2);
    const isFilled = Number(n.duration) <= 1;
    return `
    <g>
      <ellipse cx="${x}" cy="${y}" rx="8.5" ry="6.3" fill="${isFilled ? '#111827' : '#ffffff'}" stroke="#111827" stroke-width="1.6"/>
      <line x1="${x + 7}" y1="${y}" x2="${x + 7}" y2="${y - 34}" stroke="#111827" stroke-width="1.5"/>
    </g>`;
  }).join('');

  const barlineMarkup = Array.from({ length: Math.max(2, Math.floor(maxBeat / 4)) }, (_, i) => {
    const beat = i * 4;
    const x = 32 + beat * beatWidth;
    return `<line x1="${x}" y1="${staffStartY - 8}" x2="${x}" y2="${staffStartY + staffLineGap * 11 + 8}" stroke="#7c2d12" stroke-width="1"/>`;
  }).join('');

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}" width="${pageW}" height="${pageH}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff7ed"/>
      <stop offset="100%" stop-color="#ffedd5"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>
  <rect x="16" y="16" width="${pageW - 32}" height="${pageH - 32}" rx="18" fill="url(#bg)" stroke="#f59e0b" stroke-width="2"/>
  <text x="32" y="64" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#7c2d12">${safe(title)}</text>
  <text x="32" y="96" font-family="Inter, Arial, sans-serif" font-size="16" fill="#92400e">Source: ${safe(sourceName || 'Noodimeister')}</text>
  <line x1="32" y1="118" x2="${pageW - 32}" y2="118" stroke="#fdba74" stroke-width="2"/>
  <text x="32" y="152" font-family="Inter, Arial, sans-serif" font-size="19" fill="#78350f">Mode: ${safe(modeLabel)}</text>
  <text x="32" y="182" font-family="Inter, Arial, sans-serif" font-size="19" fill="#78350f">Time signature: ${safe(timeSig)}</text>
  <text x="32" y="212" font-family="Inter, Arial, sans-serif" font-size="19" fill="#78350f">Layout: ${safe(paperSize)} ${safe(orientation)}</text>
  <text x="32" y="242" font-family="Inter, Arial, sans-serif" font-size="19" fill="#78350f">Staves: ${safe(String(staves))}</text>
  ${barlineMarkup}
  <g transform="translate(32,${staffStartY})">
    <line x1="0" y1="0" x2="${innerW}" y2="0" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap}" x2="${innerW}" y2="${staffLineGap}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 2}" x2="${innerW}" y2="${staffLineGap * 2}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 3}" x2="${innerW}" y2="${staffLineGap * 3}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 4}" x2="${innerW}" y2="${staffLineGap * 4}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 7}" x2="${innerW}" y2="${staffLineGap * 7}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 8}" x2="${innerW}" y2="${staffLineGap * 8}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 9}" x2="${innerW}" y2="${staffLineGap * 9}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 10}" x2="${innerW}" y2="${staffLineGap * 10}" stroke="#9a3412" stroke-width="1"/>
    <line x1="0" y1="${staffLineGap * 11}" x2="${innerW}" y2="${staffLineGap * 11}" stroke="#9a3412" stroke-width="1"/>
  </g>
  ${noteMarkup}
</svg>`.trim();
}

export function createComposerSvgBlockFromProjectJson(rawContent, sourceName = '') {
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    parsed = {};
  }
  const title = extractProjectTitle(parsed, sourceName);
  const summary = extractSummary(parsed);
  return {
    name: title,
    width: summary.orientation === 'landscape' ? 560 : 420,
    height: summary.orientation === 'landscape' ? 395 : 594,
    sourceWidth: summary.orientation === 'landscape' ? 1123 : 794,
    sourceHeight: summary.orientation === 'landscape' ? 794 : 1123,
    svgMarkup: buildSummarySvg({
      ...summary,
      title,
      sourceName,
      project: parsed,
    }),
  };
}

export function createComposerSvgBlockFromSvgMarkup(svgMarkup, sourceName = 'SVG block') {
  const sourceWidth = 794;
  const sourceHeight = 1123;
  return {
    name: sourceName,
    width: 420,
    height: 594,
    sourceWidth,
    sourceHeight,
    svgMarkup: String(svgMarkup || ''),
  };
}
