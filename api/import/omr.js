/**
 * POST /api/import/omr
 * Brauser saadab lehepildid + guided constraints; server tagastab noodimustandi + confidence.
 *
 * Praegune stub: constraints-first heuristika (+ tekstikihi tokenid kui olemas).
 * Vision/LLM saab siia lisada ilma kliendi lepingut murdmata.
 */

const DURATION_BY_TOKEN = {
  w: { duration: 4, durationLabel: '1/1' },
  h: { duration: 2, durationLabel: '1/2' },
  q: { duration: 1, durationLabel: '1/4' },
  e: { duration: 0.5, durationLabel: '1/8' },
  s: { duration: 0.25, durationLabel: '1/16' },
};

const HIGH = 0.85;
const MEDIUM = 0.55;

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function confidenceBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < MEDIUM) return 'red';
  if (n < HIGH) return 'yellow';
  return 'green';
}

function extractTokens(lines) {
  const tokens = [];
  const tokenRegex = /\b([A-Ga-g])([#b]?)(\d?)(?:\/([whqes]))?\b/g;
  for (const line of lines || []) {
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

function tokensToNotes(tokens, sourceType) {
  const base = sourceType === 'handwritten' ? 0.52 : sourceType === 'printed-scan' ? 0.6 : 0.72;
  return tokens.slice(0, 512).map((tk, idx) => {
    const durationDef = DURATION_BY_TOKEN[tk.durToken] || DURATION_BY_TOKEN.q;
    const conf = Math.max(
      0.35,
      Math.min(0.92, base + (tk.octave != null ? 0.05 : 0) + (tk.durToken !== 'q' ? 0.03 : 0))
    );
    return {
      id: `omr-note-${idx}`,
      pitch: tk.pitch,
      octave: tk.octave,
      accidental: tk.accidental,
      duration: durationDef.duration,
      durationLabel: durationDef.durationLabel,
      isDotted: false,
      isRest: false,
      confidence: conf,
      importConfidence: conf,
      importConfidenceBand: confidenceBand(conf),
      bbox: null,
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const constraints = body.constraints && typeof body.constraints === 'object' ? body.constraints : {};
    const textLines = Array.isArray(body.textLines) ? body.textLines : [];
    const pages = Array.isArray(body.pages) ? body.pages : [];
    const fileName = String(body.fileName || '').trim();
    const sourceType = String(constraints.sourceType || 'printed-scan');

    // Payload size guard (base64 pages) — keep under typical serverless body limits
    const approxBytes = JSON.stringify(body).length;
    if (approxBytes > 4_500_000) {
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Vähenda lehtede arvu või resolutsiooni OMR päringus.',
      });
    }

    const tokens = extractTokens(textLines);
    let notes = tokensToNotes(tokens, sourceType);

    // No text tokens: placeholder empty draft with warning (vision engine hook)
    const warnings = [];
    if (!notes.length) {
      warnings.push(
        'Server OMR stub: tekstikihist tokene ei leitud. Vision/käekirja mudel pole veel ühendatud — kontrolli GuidedSetup ja sisesta noodid käsitsi või proovi uuesti pärast OCR-mudeli aktiveerimist.'
      );
      // One soft rest beat so draft still opens as editable score
      notes = [
        {
          id: 'omr-placeholder-0',
          pitch: 'C',
          octave: 4,
          accidental: 0,
          duration: 1,
          durationLabel: '1/4',
          isDotted: false,
          isRest: true,
          confidence: 0.4,
          importConfidence: 0.4,
          importConfidenceBand: 'red',
          bbox: null,
        },
      ];
    } else if (sourceType === 'handwritten') {
      warnings.push(
        'Käsikiri: praegune server kasutab tekstikihi heuristikat + constraints. Vision-OMR tuleb järgmises faasis.'
      );
    }

    if (pages.length === 0) {
      warnings.push('Lehepildid puudusid päringus — ainult tekstikiht / constraints.');
    }

    const instrumentId = String(constraints.instrumentId || 'single-staff-treble');
    const instrumentName = String(constraints.instrumentName || instrumentId);
    const clefType = String(constraints.clefType || 'treble');
    const notationMode = String(constraints.notationMode || 'traditional');
    const timeSignature = constraints.timeSignature || { beats: 4, beatUnit: 4 };
    const keySignature = String(constraints.keySignature || 'C');
    const title = String(constraints.title || '').trim() || fileName.replace(/\.pdf$/i, '') || 'PDF import';

    // Constraints are authoritative — never silently override without flag
    const suggestedOverride = null;

    const draftProject = {
      songTitle: title,
      author: '',
      notationMode,
      notationStyle:
        notationMode === 'figurenotes'
          ? 'FIGURENOTES'
          : notationMode === 'pedagogical'
            ? 'PEDAGOGICAL'
            : 'TRADITIONAL',
      keySignature,
      timeSignature,
      setupCompleted: true,
      staves: [
        {
          id: `staff-omr-${Date.now()}`,
          instrumentId,
          clefType,
          notes: notes.map(({ confidence, ...rest }) => rest),
          notationMode,
          name: instrumentName,
        },
      ],
    };

    const avg =
      notes.reduce((s, n) => s + (Number(n.importConfidence) || 0.5), 0) / Math.max(1, notes.length);

    return res.status(200).json({
      ok: true,
      engine: 'nm-omr-stub-v1',
      sourceType,
      constraintsHonored: true,
      suggestedOverride,
      warnings,
      confidence: {
        score: Math.max(0.35, Math.min(0.95, avg)),
        basis: tokens.length ? 'text-tokens-under-constraints' : 'placeholder-no-tokens',
      },
      notes,
      draftProject,
      pageCount: pages.length,
      fileName,
    });
  } catch (e) {
    console.error('[import/omr]', e?.message || e);
    return res.status(500).json({
      error: 'Server error',
      message: 'OMR päring ebaõnnestus. Proovi uuesti või sisesta noodid käsitsi.',
    });
  }
}
