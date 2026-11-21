import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import {
  OMR_CONFIDENCE,
  PDF_SOURCE_TYPE,
  OMR_INSTRUMENT_OPTIONS,
  confidenceBand,
  emptyConstraints,
} from './omrConstants.js';
import { renderPdfPagesToDataUrls } from './renderPdfPages.js';
import { callOmrApi } from './callOmrApi.js';

// pdf.js nõuab workerSrc enne getDocument(); ilma selleta: No "GlobalWorkerOptions.workerSrc" specified.
if (typeof pdfjsLib?.GlobalWorkerOptions === 'object' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

export const PDF_IMPORT_STAGE = {
  ACCEPTED: 'accepted',
  GUIDED: 'guided',
  EXTRACT: 'extract',
  ANALYZE: 'analyze',
  OMR: 'omr',
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
  if (!m) return null;
  return { beats: Number(m[1]) || 4, beatUnit: Number(m[2]) || 4 };
}

function parseInstrumentName(lines) {
  const known = OMR_INSTRUMENT_OPTIONS.map((o) => o.instrumentId).filter((id) => id !== 'single-staff-treble');
  const text = lines.join(' ').toLowerCase();
  const hit = known.find((k) => text.includes(k));
  if (!hit) return null;
  const opt = OMR_INSTRUMENT_OPTIONS.find((o) => o.instrumentId === (hit === 'cello' ? 'bass' : hit));
  return opt || { instrumentId: hit, name: hit[0].toUpperCase() + hit.slice(1), clefType: 'treble' };
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

function classifySourceType({ lines, tokens, pageCount, preferred }) {
  if (
    preferred === PDF_SOURCE_TYPE.HANDWRITTEN ||
    preferred === PDF_SOURCE_TYPE.PRINTED_SCAN ||
    preferred === PDF_SOURCE_TYPE.TEXT_LAYER
  ) {
    return preferred;
  }
  const textLen = (lines || []).join(' ').trim().length;
  if (textLen < 24 && (tokens || []).length < 4) {
    return PDF_SOURCE_TYPE.PRINTED_SCAN;
  }
  if ((tokens || []).length >= 4) return PDF_SOURCE_TYPE.TEXT_LAYER;
  if (pageCount > 0 && textLen < 80) return PDF_SOURCE_TYPE.PRINTED_SCAN;
  return PDF_SOURCE_TYPE.TEXT_LAYER;
}

function noteId(idx) {
  return `pdf-note-${idx}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildNotesFromTokens(tokens, { defaultConfidence = 0.72 } = {}) {
  return tokens.slice(0, 512).map((tk, idx) => {
    const durationDef = DURATION_BY_TOKEN[tk.durToken] || DURATION_BY_TOKEN.q;
    const hasOctave = Number.isFinite(tk.octave) && tk.octave >= 0;
    const conf = Math.max(
      0.4,
      Math.min(0.95, defaultConfidence + (hasOctave ? 0.06 : 0) + (tk.durToken && tk.durToken !== 'q' ? 0.04 : 0))
    );
    return {
      id: noteId(idx),
      pitch: tk.pitch,
      octave: tk.octave,
      accidental: tk.accidental,
      duration: durationDef.duration,
      durationLabel: durationDef.durationLabel,
      isDotted: false,
      isRest: false,
      importConfidence: conf,
      importConfidenceBand: confidenceBand(conf),
    };
  });
}

function applyConstraintsToDraft({ tokens, constraints, fileName, omrNotes }) {
  const c = { ...emptyConstraints(), ...(constraints || {}) };
  const instrumentOpt =
    OMR_INSTRUMENT_OPTIONS.find((o) => o.instrumentId === c.instrumentId) ||
    OMR_INSTRUMENT_OPTIONS.find((o) => o.instrumentId === 'single-staff-treble');

  const notes =
    Array.isArray(omrNotes) && omrNotes.length > 0
      ? omrNotes.map((n, idx) => {
          const conf = Number(n.importConfidence ?? n.confidence ?? 0.7);
          return {
            id: n.id || noteId(idx),
            pitch: String(n.pitch || 'C').toUpperCase(),
            octave: Number.isFinite(n.octave) ? n.octave : 4,
            accidental: Number(n.accidental) || 0,
            duration: Number(n.duration) || 1,
            durationLabel: n.durationLabel || '1/4',
            isDotted: !!n.isDotted,
            isRest: !!n.isRest,
            importConfidence: conf,
            importConfidenceBand: confidenceBand(conf),
            importBBox: n.bbox || n.importBBox || null,
          };
        })
      : buildNotesFromTokens(tokens, {
          defaultConfidence: c.sourceType === PDF_SOURCE_TYPE.TEXT_LAYER ? 0.74 : 0.58,
        });

  // Low confidence → keep as rest placeholder when below medium and not rest already
  const resolvedNotes = notes.map((n) => {
    if (n.isRest) return n;
    if ((n.importConfidence ?? 1) < OMR_CONFIDENCE.MEDIUM) {
      return {
        ...n,
        isRest: true,
        pitch: 'C',
        accidental: 0,
        importWasLowConfidence: true,
        importConfidenceBand: 'red',
      };
    }
    return n;
  });

  const mode = c.notationMode || 'traditional';
  const style =
    mode === 'figurenotes' ? 'FIGURENOTES' : mode === 'pedagogical' ? 'PEDAGOGICAL' : 'TRADITIONAL';

  const title = String(c.title || '').trim() || 'PDF import';

  return {
    songTitle: title,
    author: '',
    notationMode: mode,
    notationStyle: style,
    sourceNotationMode: mode === 'pedagogical' ? 'vabanotatsioon' : mode,
    keySignature: c.keySignature || 'C',
    timeSignature: c.timeSignature || { beats: 4, beatUnit: 4 },
    setupCompleted: true,
    staves: [
      {
        id: `staff-pdf-${Date.now()}`,
        instrumentId: instrumentOpt.instrumentId,
        clefType: c.clefType || instrumentOpt.clefType || 'treble',
        notes: resolvedNotes,
        notationMode: mode,
        name: c.instrumentName || instrumentOpt.name,
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
  return { lines, pageCount: pdf.numPages, bytes };
}

/**
 * Quick suggestions for GuidedSetup (before full pipeline / OMR).
 */
export async function preparePdfImportSuggestions(file) {
  if (!(file instanceof File)) {
    throw new Error('PDF import vajab File-objekti');
  }
  const extracted = await extractPdfLines(file);
  const tokens = extractMusicTokens(extracted.lines);
  const suggestedTitle = parseTitle(extracted.lines);
  const suggestedTime = parseTimeSignature(extracted.lines);
  const suggestedInstrument = parseInstrumentName(extracted.lines);
  const sourceType = classifySourceType({
    lines: extracted.lines,
    tokens,
    pageCount: extracted.pageCount,
  });

  return {
    fileName: file.name || '',
    pageCount: extracted.pageCount,
    textBlocksDetected: extracted.lines.length,
    noteTokenCount: tokens.length,
    sourceType,
    suggestedConstraints: emptyConstraints({
      title: suggestedTitle || '',
      instrumentId: suggestedInstrument?.instrumentId || 'single-staff-treble',
      instrumentName: suggestedInstrument?.name || 'Meloodia (G-võti)',
      clefType: suggestedInstrument?.clefType || 'treble',
      timeSignature: suggestedTime || { beats: 4, beatUnit: 4 },
      keySignature: 'C',
      notationMode: 'traditional',
      sourceType,
    }),
    lines: extracted.lines,
  };
}

function summarizeNoteConfidence(notes) {
  const bands = { green: 0, yellow: 0, red: 0 };
  const markers = [];
  (notes || []).forEach((n, idx) => {
    const band = n.importConfidenceBand || confidenceBand(n.importConfidence);
    if (bands[band] != null) bands[band] += 1;
    if (band === 'yellow' || band === 'red') {
      markers.push({
        noteId: n.id,
        index: idx,
        band,
        confidence: n.importConfidence,
        label: n.isRest
          ? `Paus / ebakindel (#${idx + 1})`
          : `${n.pitch}${n.accidental === 1 ? '#' : n.accidental === -1 ? 'b' : ''}${n.octave ?? ''} (${n.durationLabel || ''})`,
      });
    }
  });
  return { bands, markers, needsReviewCount: markers.length };
}

/**
 * Full PDF/OMR pipeline: guided constraints → extract → optional server OMR → draft + review markers.
 */
export async function runPdfImportPipeline({ pendingImport, constraints, onProgress, skipOmrApi = false } = {}) {
  const timeline = [];
  const fileName = String(pendingImport?.fileName || pendingImport?.file?.name || '').trim();
  const userConstraints = { ...emptyConstraints(), ...(constraints || {}) };

  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.ACCEPTED,
    fileName ? `PDF accepted: ${fileName}` : 'PDF accepted',
    onProgress
  );

  if (!(pendingImport?.file instanceof File)) {
    throw new Error('PDF import vajab File-objekti');
  }

  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.GUIDED,
    `Guided metadata: ${userConstraints.title || '(pealkiri kinnitamata)'} · ${userConstraints.instrumentName} · ${userConstraints.timeSignature?.beats}/${userConstraints.timeSignature?.beatUnit} · ${userConstraints.keySignature}`,
    onProgress
  );

  const extracted = await extractPdfLines(pendingImport.file);
  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.EXTRACT,
    `Extracted text layer from ${extracted.pageCount} page(s)`,
    onProgress
  );

  const musicTokens = extractMusicTokens(extracted.lines);
  const sourceType = classifySourceType({
    lines: extracted.lines,
    tokens: musicTokens,
    pageCount: extracted.pageCount,
    preferred: userConstraints.sourceType,
  });
  userConstraints.sourceType = sourceType;

  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.ANALYZE,
    `Analyzed: source=${sourceType}, tokens=${musicTokens.length}`,
    onProgress
  );

  let pagePreviews = [];
  let pageMeta = { pageCount: extracted.pageCount, truncated: false };
  let omrNotes = null;
  let omrMeta = null;
  const needsServerOmr =
    sourceType === PDF_SOURCE_TYPE.HANDWRITTEN || sourceType === PDF_SOURCE_TYPE.PRINTED_SCAN;

  try {
    const rendered = await renderPdfPagesToDataUrls(pendingImport.file, {
      maxPages: 8,
      scale: needsServerOmr ? 1.35 : 1.1,
    });
    pagePreviews = rendered.pages;
    pageMeta = { pageCount: rendered.pageCount, truncated: rendered.truncated };
  } catch (err) {
    pushTimeline(
      timeline,
      PDF_IMPORT_STAGE.EXTRACT,
      `Page preview render skipped: ${err?.message || 'error'}`,
      onProgress
    );
  }

  if (needsServerOmr && !skipOmrApi) {
    pushTimeline(timeline, PDF_IMPORT_STAGE.OMR, 'Calling OMR API…', onProgress);
    try {
      const omr = await callOmrApi({
        pages: pagePreviews,
        constraints: userConstraints,
        fileName,
        textLines: extracted.lines,
      });
      omrMeta = {
        ok: !!omr?.ok,
        engine: omr?.engine || 'server',
        warnings: omr?.warnings || [],
      };
      if (Array.isArray(omr?.notes) && omr.notes.length > 0) {
        omrNotes = omr.notes;
      } else if (Array.isArray(omr?.draftProject?.staves?.[0]?.notes)) {
        omrNotes = omr.draftProject.staves[0].notes;
      }
      pushTimeline(
        timeline,
        PDF_IMPORT_STAGE.OMR,
        `OMR returned ${omrNotes?.length || 0} note(s)`,
        onProgress
      );
    } catch (err) {
      omrMeta = { ok: false, error: err?.message || 'OMR API unavailable' };
      pushTimeline(
        timeline,
        PDF_IMPORT_STAGE.OMR,
        `OMR API unavailable — using text-layer fallback (${err?.message || 'error'})`,
        onProgress
      );
    }
  }

  const draftProject = applyConstraintsToDraft({
    tokens: musicTokens,
    constraints: userConstraints,
    fileName,
    omrNotes,
  });

  const noteSummary = summarizeNoteConfidence(draftProject?.staves?.[0]?.notes || []);

  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.MAP_TO_SCORE,
    `Mapped draft (${draftProject?.staves?.[0]?.notes?.length || 0} notes; ${noteSummary.needsReviewCount} need review)`,
    onProgress
  );

  const reviewRequired = true;
  pushTimeline(
    timeline,
    PDF_IMPORT_STAGE.REVIEW,
    needsServerOmr
      ? 'Review required (handwritten/scan): verify notes, rhythms, and guided metadata'
      : 'Review required: verify rhythms, voices, and text boxes',
    onProgress
  );

  const overallScore = (() => {
    const notes = draftProject?.staves?.[0]?.notes || [];
    if (!notes.length) return needsServerOmr ? 0.45 : 0.5;
    const avg =
      notes.reduce((s, n) => s + (Number(n.importConfidence) || 0.5), 0) / notes.length;
    return Math.max(0.35, Math.min(0.95, avg));
  })();

  const warnings = [
    'Guided metadata (title, instrument, time signature, key, mode) overrides AI suggestions on apply.',
    sourceType === PDF_SOURCE_TYPE.TEXT_LAYER
      ? 'Text-layer path: notes come from textual A–G tokens when OMR is not used.'
      : 'Graphic/handwritten path: server OMR preferred; text-layer is fallback only.',
  ];
  if (omrMeta && omrMeta.ok === false) {
    warnings.push(`OMR server: ${omrMeta.error || 'unavailable'} — kontrolli mustandit hoolikalt.`);
  }
  if (noteSummary.bands.red > 0) {
    warnings.push(`${noteSummary.bands.red} sündmust asendati pausiga või märgiti punaseks (confidence < ${OMR_CONFIDENCE.MEDIUM}).`);
  }
  if (pageMeta.truncated) {
    warnings.push(`Ainult esimesed ${pagePreviews.length} lehte eelvaates/OMR-is (kokku ${pageMeta.pageCount}).`);
  }

  return {
    ok: true,
    reviewRequired,
    reviewCompleted: false,
    createNewOnly: true,
    sourceType,
    constraintsApplied: userConstraints,
    suggestedOverrides: {
      title: parseTitle(extracted.lines) || null,
      timeSignature: parseTimeSignature(extracted.lines),
      instrument: parseInstrumentName(extracted.lines),
    },
    confidence: {
      score: overallScore,
      basis: omrNotes ? 'omr-plus-constraints' : 'text-layer-token-coverage',
      bands: noteSummary.bands,
    },
    noteMarkers: noteSummary.markers,
    pagePreviews: pagePreviews.map((p) => ({
      pageIndex: p.pageIndex,
      width: p.width,
      height: p.height,
      dataUrl: p.dataUrl,
    })),
    warnings,
    nextSteps: [
      'Confirm guided metadata before apply',
      'Review yellow/red confidence markers',
      'Apply only as create-new project',
    ],
    timeline,
    omr: omrMeta,
    extracted: {
      title: draftProject.songTitle || '',
      instrumentsDetected: 1,
      textBlocksDetected: extracted.lines.length,
      pageCount: pageMeta.pageCount,
      noteTokenCount: musicTokens.length,
    },
    draftProject,
  };
}

export { emptyConstraints, PDF_SOURCE_TYPE, OMR_CONFIDENCE };
