/**
 * Mõõdab Wikimedia Commons võtmemärgi-piltidelt noodijooned (5 võrdse vahega joont)
 * ja võtmemärkide vertikaalsed asukohad → staff-positsioon (poolspace, 0 = alumine joon).
 *
 * Käivita: node scripts/analyze-wikimedia-keysig-images.mjs
 * Väljund: konsool + scripts/wikimedia-measured-key-positions.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.join(__dirname, 'tmp-wm-keysig');
const OUT_JSON = path.join(__dirname, 'wikimedia-measured-key-positions.json');

/** Treble: teooria järjekord (kvintiring) — kasutame võrdluseks */
const THEORY_SHARP = [8, 5, 9, 6, 3, 7, 4];
const THEORY_FLAT = [4, 0, 3, 6, 2, 5, 1];

const FILES = [
  { name: 'G_Major_key_sig.png', sharps: 1, flats: 0, crop: null },
  { name: 'D_major.png', sharps: 2, flats: 0, crop: 'topStaff' },
  { name: 'A_major.png', sharps: 3, flats: 0, crop: 'topStaff' },
  { name: 'Eflat_Major_key_sig.png', sharps: 0, flats: 3, crop: null },
  { name: 'Aflat_Major_key_sig.png', sharps: 0, flats: 4, crop: null },
  { name: 'Aflat_jpg.jpg', sharps: 0, flats: 4, crop: 'topStaff' },
];

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function loadFlatBuffer(filePath) {
  return sharp(filePath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function rowInk(buf, width, channels, y, threshold) {
  let n = 0;
  const row = y * width * channels;
  for (let x = 0; x < width; x += 1) {
    const i = row + x * channels;
    const L = lum(buf[i], buf[i + 1], buf[i + 2]);
    if (L < threshold) n += 1;
  }
  return n;
}

/** Otsib 5 võrdse vahega horisontaaljoont (võrk: L0 + j*gap) */
function findStaffLinesGridSearch(rowInkArr, height) {
  let best = null;
  let bestScore = -1;
  for (let gap = 6; gap <= Math.min(55, Math.floor(height / 3)); gap += 1) {
    for (let L0 = 1; L0 + 4 * gap < height - 1; L0 += 1) {
      let score = 0;
      const ys = [];
      for (let j = 0; j < 5; j += 1) {
        const y = Math.min(height - 1, Math.round(L0 + j * gap));
        ys.push(y);
        score += rowInkArr[y] || 0;
      }
      if (score > bestScore) {
        bestScore = score;
        best = ys;
      }
    }
  }
  return { lineYs: best, score: bestScore };
}

function staffPositionFromY(y, lineYs) {
  const bottomY = lineYs[4];
  const topY = lineYs[0];
  const staffSpacePx = (bottomY - topY) / 4;
  const half = staffSpacePx / 2;
  return (bottomY - y) / half;
}

function medianYInBox(buf, width, height, channels, x0, x1, y0, y1, threshold) {
  const ys = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * width + x) * channels;
      if (lum(buf[i], buf[i + 1], buf[i + 2]) < threshold) ys.push(y);
    }
  }
  if (!ys.length) return null;
  ys.sort((a, b) => a - b);
  return ys[Math.floor(ys.length / 2)];
}

function columnInk(buf, width, height, channels, x, y0, y1, threshold) {
  let n = 0;
  for (let y = y0; y <= y1; y += 1) {
    const i = (y * width + x) * channels;
    if (lum(buf[i], buf[i + 1], buf[i + 2]) < threshold) n += 1;
  }
  return n;
}

/**
 * Horisontaalprofiili tippude valik: võtmemärgi veergude tuvastamiseks (üks tugev tipp ühe märgi kohta).
 * Eelmise versiooni ühendsegment segas kogu võtmemärgi ja taktimõõdu — tipud on stabiilsemad.
 */
function buildColumnProfile(buf, width, height, channels, staffTop, staffBottom, clefXMax, threshold) {
  const profile = [];
  for (let x = clefXMax; x < width; x += 1) {
    profile.push(columnInk(buf, width, height, channels, x, staffTop, staffBottom, threshold));
  }
  return profile;
}

function selectNPeaksFromProfile(profile, clefXMax, nWanted, staffSpacePx, thresholdHint) {
  const maxP = profile.length ? Math.max(...profile) : 0;
  const minPeak = Math.max(8, maxP * 0.15, thresholdHint * 0.06);
  const minSep = Math.max(5, Math.floor((staffSpacePx || 10) * 0.55));

  const candidates = [];
  for (let i = 1; i < profile.length - 1; i += 1) {
    if (profile[i] >= profile[i - 1] && profile[i] >= profile[i + 1] && profile[i] >= minPeak) {
      candidates.push({ x: clefXMax + i, s: profile[i] });
    }
  }
  candidates.sort((a, b) => b.s - a.s);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.every((ch) => Math.abs(c.x - ch.x) >= minSep)) {
      chosen.push({ x: c.x, s: c.s });
      if (chosen.length === nWanted) break;
    }
  }
  chosen.sort((a, b) => a.x - b.x);
  return { peaks: chosen, minPeak, minSep, maxProfile: maxP };
}

function roundToHalfStep(pos) {
  return Math.round(pos * 2) / 2;
}

function nearestInt(pos) {
  return Math.round(pos);
}

async function analyzeOne(meta) {
  const filePath = path.join(IMG_DIR, meta.name);
  if (!fs.existsSync(filePath)) return { ...meta, error: 'missing file' };

  let { data, info } = await loadFlatBuffer(filePath);
  let { width, height, channels } = info;

  if (meta.crop === 'topStaff') {
    const h = Math.floor(height * 0.46);
    const cropped = await sharp(filePath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .extract({ left: 0, top: 0, width, height: h })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = cropped.data;
    height = h;
    info = cropped.info;
  }

  const threshold = 150;
  const rowInkArr = new Array(height);
  for (let y = 0; y < height; y += 1) {
    rowInkArr[y] = rowInk(data, width, channels, y, threshold);
  }

  const { lineYs, score } = findStaffLinesGridSearch(rowInkArr, height);
  if (!lineYs) return { ...meta, error: 'no staff' };

  const staffTop = Math.max(0, lineYs[0] - 2);
  const staffBottom = Math.min(height - 1, lineYs[4] + 2);
  const clefXMax = Math.floor(width * 0.28);

  const profile = buildColumnProfile(
    data,
    width,
    height,
    channels,
    staffTop,
    staffBottom,
    clefXMax,
    threshold
  );
  const staffSpacePx = (lineYs[4] - lineYs[0]) / 4;
  const expected = meta.sharps || meta.flats || 0;
  const { peaks, minPeak, minSep, maxProfile } = selectNPeaksFromProfile(
    profile,
    clefXMax,
    expected,
    staffSpacePx,
    threshold
  );

  const centers = [];
  const xPad = Math.max(2, Math.floor(staffSpacePx * 0.25));
  for (const pk of peaks) {
    const cy = medianYInBox(
      data,
      width,
      height,
      channels,
      Math.max(clefXMax, pk.x - xPad),
      Math.min(width - 1, pk.x + xPad),
      staffTop,
      staffBottom,
      threshold
    );
    if (cy == null) continue;
    const rawPos = staffPositionFromY(cy, lineYs);
    centers.push({
      cx: pk.x,
      cy,
      rawPos,
      intPos: nearestInt(rawPos),
      halfPos: roundToHalfStep(rawPos),
      peakStrength: pk.s,
    });
  }

  return {
    ...meta,
    width,
    height,
    lineYs,
    staffSpacePx,
    gridScore: score,
    peakDetection: { expected, found: peaks.length, minPeak, minSep, maxProfile },
    peakCountMatches: expected > 0 ? peaks.length === expected : true,
    centers,
  };
}

async function main() {
  const results = [];
  for (const f of FILES) {
    results.push(await analyzeOne(f));
  }

  const sharpByIndex = [];
  const flatByIndex = [];

  for (const r of results) {
    if (!r.centers) continue;
    if (r.sharps > 0) {
      r.centers.forEach((c, i) => {
        if (!sharpByIndex[i]) sharpByIndex[i] = [];
        sharpByIndex[i].push(c.intPos);
      });
    }
    if (r.flats > 0) {
      r.centers.forEach((c, i) => {
        if (!flatByIndex[i]) flatByIndex[i] = [];
        flatByIndex[i].push(c.intPos);
      });
    }
  }

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  /** Raster-glyphi massikeskpunkti ümardatud indeksid (debug; ei pruugi ühtida joonega) */
  const pixelCentroidIntPosBySharpIndex = sharpByIndex.map((vals) => median(vals));
  const pixelCentroidIntPosByFlatIndex = flatByIndex.map((vals) => median(vals));

  const allPeaksMatch = results.every((r) => r.peakCountMatches !== false);

  const payload = {
    source:
      'Wikimedia Commons PNG/JPEG — scripts/analyze-wikimedia-keysig-images.mjs (noodijooned + veergude tipud)',
    method:
      'Noodijooned: 5 võrdse vahega joonte võrk. Võtmemärgid: veeruprofiili tugevaimad lahutatud tipud (greedy, min vahe ~0,55× staff-space). Vertikaal: raster-glyphi keskpunkt ei ole usaldusväärne joone asukoha jaoks; lõplikud staff-indeksid (0 = alumine joon) on standardne pitch→staff (kvintiring), sama mis StaffConstants / generate-key-signatures-reference-svg.mjs.',
    trebleSharpStaffPositions: THEORY_SHARP,
    trebleFlatStaffPositions: THEORY_FLAT,
    pixelCentroidIntPosBySharpIndex,
    pixelCentroidIntPosByFlatIndex,
    allReferenceImagesPeakCountOk: allPeaksMatch,
    files: FILES.map((f) => f.name),
    detail: results,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\nWrote', OUT_JSON);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
