import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export const PDF_IMPORT_STAGE = {
  ACCEPTED: 'accepted',
  EXTRACT: 'extract',
  ANALYZE: 'analyze',
  MAP_TO_SCORE: 'map_to_score',
  REVIEW: 'review',
};

const DURATION_BY_TOKEN = {
  w: { duration: 4, durationLabel: '1/1' },
  h: { duration: 2, durationLabel: '1/2' },
  q: { duration: 1, durationLabel: '1/4' },
  e: { duration: 0.5, durationLabel: '1/8' },
  s: { duration: 0.25, durationLabel: '1/16' },
};

function pushTimeline(timeline, stage, message, onProgress) {
  const entry = { stage, message };
  timeline.push(entry);
  if (typeof onProgress === 'function') onProgress(entry);
}

function parseTitle(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return '';
  const top = lines.slice(0, 5).find((ln) => String(ln || '').trim().length >= 3);
  return String(top || '').trim();
}

function parseTimeSignature(lines) {
  const joined = lines.join(' ');
  const m = joined.match(/\b([2-9]|1[0-2])\s*\/\s*(2|4|8|16)\b/);
  if (!m) return { beats: 4, beatUnit: 4 };
  return { beats: Number(m[1]) || 4, beatUnit: Number(m[2]) || 4 };
}

function parseInstrumentName(lines) {
  const known = ['piano', 'violin', 'cello', 'flute', 'clarinet', 'voice', 'guitar', 'bass'];
  const text = lines.join(' ').toLowerCase();
  const hit = known.find((k) => text.includes(k));
  if (!hit) return { instrumentId: 'piano', name: 'Piano' };
  return { instrumentId: hit === 'cello' ? 'bass' : hit, name: hit[0].toUpperCase() + hit.slice(1) };
}

function extractMusicTokens(lines) {
  const tokens = [];
  const tokenRegex = /\b([A-Ga-g])([#b]?)(\d?)(?:\/([whqes]))?\b/g;
  for (const line of lines) {
    const src = String(line || '');
    let m = tokenRegex.exec(src);
    while (m) {
      tokens.push({
        pitch: m[1].toUpperCase(),
        accidental: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0,
        octave: m[3] ? Number(m[3]) : 4,
        durToken: (m[4] || 'q').toLowerCase(),
      });
      m = tokenRegex.exec(src);
    }
  }
  return tokens;
}

function buildDraftProjectFromTokens({ fileName, lines, tokens }) {
  const timeSignature = parseTimeSignature(lines);
  const title = parseTitle(lines) || String(fileName || '').replace(/\.pdf$/i, '');
  const instrument = parseInstrumentName(lines);

  const notes = tokens.slice(0, 512).map((tk, idx) => {
    const durationDef = DURATION_BY_TOKEN[tk.durToken] || DURATION_BY_TOKEN.q;
    return {
      id: `pdf-note-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      pitch: tk.pitch,
      octave: tk.octave,
      accidental: tk.accidental,
      duration: durationDef.duration,
      durationLabel: durationDef.durationLabel,
      isDotted: false,
      isRest: false,
    };
  });

  return {
    songTitle: title || 'PDF import',
    author: '',
    notationMode: 'traditional',
    notationStyle: 'TRADITIONAL',
    timeSignature,
    staves: [
      {
        id: `staff-pdf-${Date.now()}`,
        instrumentId: instrument.instrumentId,
        clefType: 'treble',
        notes,
        notationMode: 'traditional',
        name: instrument.name,
      },
    ],
  };
}

async function extractPdfLines(file) {
  const bytes = await file.arrayBuffer();
  const docTask = pdfjsLib.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false });
  const pdf = await docTask.promise;
  const lines = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const pageLines = (tc.items || [])
      .map((it) => String(it?.str || '').trim())
      .filter(Boolean);
    lines.push(...pageLines);
  }
  return { lines, pageCount: pdf.numPages };
}

export async function runPdfImportPipeline({ pendingImport, onProgress } = {}) {
  const timeline = [];
  const fileName = String(pendingImport?.fileName || '').trim();

  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.ACCEPTED,
    fileName ? `PDF accepted: ${fileName}` : 'PDF accepted',
    onProgress
  );

  if (!(pendingImport?.file instanceof File)) {
    throw new Error('PDF import vajab File-objekti');
  }
  const extracted = await extractPdfLines(pendingImport.file);
  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.EXTRACT,
    `Extracted text layer from ${extracted.pageCount} page(s)`,
    onProgress
  );

  const musicTokens = extractMusicTokens(extracted.lines);
  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.ANALYZE,
    `Analyzed text candidates: ${musicTokens.length} note token(s)`,
    onProgress
  );

  const draftProject = buildDraftProjectFromTokens({
    fileName,
    lines: extracted.lines,
    tokens: musicTokens,
  });
  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.MAP_TO_SCORE,
    `Mapped to editable score draft (${draftProject?.staves?.[0]?.notes?.length || 0} notes)`,
    onProgress
  );

  // Always end with an explicit human-review step.
  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.REVIEW,
    'Review required: verify rhythms, voices, and text boxes',
    onProgress
  );

  return {
    ok: true,
    confidence: {
      score: Math.max(0, Math.min(0.99, musicTokens.length >= 24 ? 0.86 : musicTokens.length >= 8 ? 0.72 : 0.58)),
      basis: 'text-layer-token-coverage',
    },
    warnings: [
      'Current parser reads PDF text layer and builds editable draft notes from textual tokens (A-G + optional octave/duration token).',
      'Graphic-only notation (no text layer) still needs OCR/AI music symbol recognition.',
    ],
    nextSteps: [
      'Add OCR/AI recognition for scanned and vector symbol layers',
      'Detect voices/chords/rests directly from glyph geometry',
      'Map text blocks to editable Noodimeister text boxes',
      'Add confidence-based correction UI before apply',
    ],
    timeline,
    extracted: {
      title: draftProject.songTitle || '',
      instrumentsDetected: 1,
      textBlocksDetected: extracted.lines.length,
    },
    draftProject,
  };
}

