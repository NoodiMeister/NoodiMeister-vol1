import { listHowToGuideEntries } from '../content/howToGuideContent';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'do', 'does', 'how', 'can', 'i', 'my', 'me', 'we',
  'would', 'like', 'want', 'please', 'with', 'from', 'this', 'that', 'have', 'has', 'been', 'ready',
  'ja', 'voi', 'kas', 'kuidas', 'mul', 'mulle', 'on', 'mis', 'see', 'et', 'ei', 'saab', 'saaksin', 'tahaksin', 'tahaks', 'sooviksin', 'palun',
  'oma', 'olen', 'oleks', 'voi', 'voiks', 'saaks', 'saaksin', 'ning', 'aga', 'siis', 'nagu', 'juba', 'valmis',
  'miten', 'voinko', 'voin', 'haluaisin', 'että', 'kun', 'jos', 'olen', 'valmis',
]);

/**
 * Intent groups: natural-language signals → guide topic boost + user-facing paraphrase.
 * Bot peab aru saama küsimuse sisust, mitte ainult täpsetest pealkirjadest.
 */
const INTENT_DEFS = [
  {
    id: 'listenPlayback',
    paraphrase: {
      et: 'Sain aru: soovid oma valmis lugu kuulata / noodist taasesitada.',
      en: 'I understand: you want to listen to / play back your finished song.',
      fi: 'Ymmärsin: haluat kuunnella / toistaa valmiin kappaleen.',
    },
    signals: [
      'kuula', 'kuulata', 'kuulamine', 'kuulan', 'kuulda', 'kuuleb', 'kuuldav',
      'mangi', 'mangida', 'mangima', 'mangib', 'mangiks',
      'taasesitus', 'taasesitada', 'taasesitust', 'heli', 'heliga',
      'playback', 'play', 'player', 'noodigraafika', 'mangija',
      'listen', 'hearing', 'hear', 'playback', 'toista', 'toistaa', 'kuuntelen', 'kuunnella', 'kuuntelu',
      'song', 'lugu', 'pala', 'kappale', 'piece',
    ],
    // Require at least one “action” signal so “lugu” alone does not force playback.
    requireAny: [
      'kuula', 'kuulata', 'kuulamine', 'kuulan', 'kuulda',
      'mangi', 'mangida', 'mangima',
      'taasesitus', 'taasesitada', 'heli',
      'playback', 'play', 'player', 'listen', 'hear', 'hearing',
      'toista', 'toistaa', 'kuunnella', 'kuuntelen', 'kuuntelu',
    ],
    guideHints: [
      'kuula', 'kuulata', 'taasesitada', 'play', 'playback', 'listen', 'kuuntelen', 'toistan', 'mangija', 'noodigraafika',
    ],
  },
  {
    id: 'saveFile',
    paraphrase: {
      et: 'Sain aru: soovid faili salvestada.',
      en: 'I understand: you want to save the file.',
      fi: 'Ymmärsin: haluat tallentaa tiedoston.',
    },
    signals: ['salvesta', 'salvestada', 'salvestamine', 'save', 'tallentaa', 'tallenna', 'pilve', 'drive', 'onedrive'],
    requireAny: ['salvesta', 'salvestada', 'salvestamine', 'save', 'tallentaa', 'tallenna'],
    guideHints: ['salvestada', 'save', 'tallentaa', 'pilve'],
  },
  {
    id: 'exportPrint',
    paraphrase: {
      et: 'Sain aru: soovid PDF-i või printimist.',
      en: 'I understand: you want PDF export or print.',
      fi: 'Ymmärsin: haluat PDF:n tai tulostuksen.',
    },
    signals: ['pdf', 'print', 'prindi', 'printida', 'eksport', 'export', 'trukk', 'tulosta', 'tulostaa'],
    requireAny: ['pdf', 'print', 'prindi', 'printida', 'eksport', 'export', 'tulosta', 'tulostaa'],
    guideHints: ['pdf', 'print', 'eksport', 'export', 'tulosta'],
  },
  {
    id: 'enterNotes',
    paraphrase: {
      et: 'Sain aru: soovid noote sisestada / noteerida.',
      en: 'I understand: you want to enter / notate notes.',
      fi: 'Ymmärsin: haluat syöttää / nuotintaa nuotteja.',
    },
    signals: ['noteerida', 'sisesta', 'sisestada', 'noodid', 'noote', 'klaviatuur', 'keyboard', 'rütm', 'enter', 'notes', 'syota', 'nuotteja'],
    requireAny: ['noteerida', 'sisesta', 'sisestada', 'noodid', 'noote', 'notes', 'enter', 'syota', 'nuotteja'],
    guideHints: ['noteerida', 'sisesta', 'enter notes', 'nuotteja', 'klaviatuur'],
  },
  {
    id: 'lyrics',
    paraphrase: {
      et: 'Sain aru: soovid laulusõnu lisada.',
      en: 'I understand: you want to add lyrics.',
      fi: 'Ymmärsin: haluat lisätä sanoituksen.',
    },
    signals: ['laulusonu', 'laulusõnad', 'lyrics', 'sonad', 'sanoitus', 'sanoitusta'],
    requireAny: ['laulusonu', 'lyrics', 'sanoitus', 'sanoitusta'],
    guideHints: ['laulusonu', 'lyrics', 'sanoitus'],
  },
  {
    id: 'textBox',
    paraphrase: {
      et: 'Sain aru: soovid tekstikasti / Text tööriista kasutada.',
      en: 'I understand: you want to use the Text tool / text box.',
      fi: 'Ymmärsin: haluat käyttää Text-työkalua / tekstilaatikkoa.',
    },
    signals: ['tekstikast', 'tekst', 'text', 'textbox', 'tekstilaatikko'],
    requireAny: ['tekstikast', 'tekst', 'text', 'textbox', 'tekstilaatikko'],
    guideHints: ['tekst', 'text', 'tekstikast'],
  },
];

function localeKey(locale) {
  const n = String(locale || '').toLowerCase();
  if (n.startsWith('et')) return 'et';
  if (n.startsWith('fi')) return 'fi';
  return 'en';
}

/** Lightweight normalize for matching (diacritics / õäöü folded). */
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[õÕ]/g, 'o')
    .replace(/[äÄ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/[šŠ]/g, 's')
    .replace(/[žŽ]/g, 'z')
    .replace(/[åÅ]/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function includesSignal(normText, signal) {
  const s = normalize(signal);
  if (!s) return false;
  // word-boundary-ish: avoid matching tiny fragments inside unrelated words when short
  if (s.length <= 3) {
    return new RegExp(`(?:^|\\s)${s}(?:$|\\s)`).test(` ${normText} `);
  }
  return normText.includes(s);
}

/**
 * Analyze free-text question → best intent (if any).
 * @returns {{ id: string, paraphrase: string, score: number } | null}
 */
export function detectQuestionIntent(userText, locale) {
  const norm = normalize(userText);
  if (!norm) return null;
  const lang = localeKey(locale);

  let best = null;
  for (const def of INTENT_DEFS) {
    const requiredOk = (def.requireAny || []).some((sig) => includesSignal(norm, sig));
    if (def.requireAny?.length && !requiredOk) continue;

    let score = 0;
    for (const sig of def.signals) {
      if (includesSignal(norm, sig)) score += sig.length >= 5 ? 3 : 2;
    }
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = {
        id: def.id,
        paraphrase: def.paraphrase[lang] || def.paraphrase.en,
        score,
        guideHints: def.guideHints,
      };
    }
  }
  return best;
}

function scoreEntryAgainstQuery(entry, qTokens, queryNorm, intent) {
  const hay = `${entry.question} ${entry.steps.join(' ')}`;
  const hayNorm = normalize(hay);
  const hayTokens = new Set(tokens(hay));

  let score = 0;
  for (const tok of qTokens) {
    if (hayTokens.has(tok)) score += 3;
    else if (hayNorm.includes(tok)) score += 1;
  }

  const titleTokens = tokens(entry.question);
  const titleHits = qTokens.filter((t) => titleTokens.includes(t)).length;
  if (titleHits >= 1) score += titleHits * 2;

  if (intent?.guideHints?.length) {
    let hintHits = 0;
    for (const hint of intent.guideHints) {
      if (includesSignal(hayNorm, hint)) hintHits += 1;
    }
    if (hintHits > 0) {
      // Strong boost when free-text intent matches this guide topic.
      score += 12 + hintHits * 3 + (intent.score || 0);
    }
  }

  // Soft phrase overlap (e.g. “valmis lugu” near “valmis lugu kuulata”)
  if (queryNorm.length >= 8 && hayNorm.includes(queryNorm.slice(0, Math.min(24, queryNorm.length)))) {
    score += 4;
  }

  return score;
}

/**
 * Match user question to Kuidas? guide using intent + keyword analysis.
 * @returns {{ matched: boolean, title: string, steps: string[], score: number, howToPath: string, understoodAs: string }}
 */
export function answerFromHowToGuide(userText, locale) {
  const query = String(userText || '').trim();
  if (!query) return null;

  const queryNorm = normalize(query);
  const qTokens = tokens(query);
  const intent = detectQuestionIntent(query, locale);

  if (qTokens.length === 0 && !intent) return null;

  const entries = listHowToGuideEntries(locale);
  let best = null;

  for (const entry of entries) {
    const score = scoreEntryAgainstQuery(entry, qTokens, queryNorm, intent);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  // Intent alone can unlock a guide (natural language without shared keywords).
  const minScore = intent
    ? Math.max(8, Math.min(14, (qTokens.length || 2) * 2))
    : Math.max(4, Math.min(8, (qTokens.length || 1) * 2));

  if (!best || best.score < minScore) {
    return {
      matched: false,
      title: '',
      steps: [],
      score: best?.score || 0,
      howToPath: '/kuidas',
      understoodAs: intent?.paraphrase || '',
    };
  }

  return {
    matched: true,
    title: best.entry.question,
    steps: best.entry.steps,
    score: best.score,
    howToPath: '/kuidas',
    understoodAs: intent?.paraphrase || '',
  };
}
