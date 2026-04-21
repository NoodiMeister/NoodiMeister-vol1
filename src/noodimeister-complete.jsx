// Version 1.0.5 - Final Graphics Fix
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { InteractivePiano } from './piano';
import * as googleDrive from './services/googleDrive';
import * as oneDrive from './services/oneDrive';
import * as authStorage from './services/authStorage';
import { refreshGoogleTokenSilently, refreshMicrosoftTokenSilently } from './services/cloudTokenRefresh';
import { JoClefSymbol, TrebleClefSymbol, BassClefSymbol } from './components/ClefSymbols';
import { AppLogo } from './components/AppLogo';
import { NoteHead } from './components/NoteHead';
import { NoteSymbol } from './notation/NoteSymbols';
import {
  STAFF_SPACE,
  getStaffLinePositions as getStaffLinePositionsFromConstants,
  getMiddleStaffLineY,
  getVerticalPosition,
  getLedgerLineCountExact,
  getNoteheadRx,
  getNoteheadRy,
  getLedgerHalfWidth,
  getStemLength,
  getTonicStaffPosition,
  getKeyFromStaffPosition,
  getYFromStaffPosition,
  getVerticalPositionFromJoAnchor,
  getPitchFromJoClick,
} from './notation/StaffConstants';
import { getRhythmSyllableForNote } from './notation/rhythmSyllables';
import { RHYTHM_PATTERN_SEGMENTS } from './notation/rhythmPatternSpecs';
import { RhythmSyllableLabel } from './components/RhythmSyllableLabel';
import { getJoName } from './notation/joNames';
import { expandEmojiShortcuts } from './utils/emojiShortcuts';
import {
  DEFAULT_JO_CLEF_STAFF_POSITION,
  JO_CLEF_POSITION_MIN,
  JO_CLEF_POSITION_MAX,
  DEFAULT_SHOW_EMOJI_OVERLAYS,
  DEFAULT_SHOW_RHYTHM_SYLLABLES,
  DEFAULT_SHOW_ALL_NOTE_LABELS,
  KEY_TO_SEMITONE,
  getSemitonesFromKey,
  getDiatonicScaleForKey,
  getPitchSemitone,
  getAccidentalForPitchInKey,
} from './utils/notationConstants';
import { FIGURENOTES_COLORS, getFigureSymbol } from './utils/figurenotes';
import { getFigureStyle, getShapePathsByOctave } from './constants/FigureNotesLibrary';
import { getChromaNotesColor, getPedagogicalSymbol, getSchoolHandbellColor } from './notation/PedagogicalLogic';
import { FigurenotesBlockIcon, RhythmIcon, RhythmPatternIcon, MeterIcon, PedagogicalMeterIcon } from './toolboxes';
import { SmuflGlyph } from './notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH, NOTEHEAD_SHAPE_GLYPH } from './notation/smufl/glyphs';
import { getAugmentationDotCenterPitchY, getAugmentationDotXFromNoteCenter } from './notation/augmentationDotLayout';
import { getGlyphFontSize } from './notation/musescoreStyle';
import { FigurenotesView } from './views/FigurenotesView';
import { TraditionalNotationView } from './views/TraditionalNotationView';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, createT } from './i18n';
import { computeLayout, getStaffHeight, LAYOUT, PAGE_BREAK_GAP } from './layout/LayoutManager';
import {
  getTraditionalStaffLineSpanPx,
  getTraditionalInterStaffGapPx,
  getTraditionalStaffStepPx,
  getTraditionalLayoutStaffHeightPx,
  getTraditionalSystemTotalHeightPx,
  computeTraditionalVisibleStaffGeometry,
} from './layout/traditionalMultiStaffGeometry';
import { FIGURE_BASE_WIDTH, FIGURE_ROW_HEIGHT, calculateLayout } from './layout/LayoutEngine';
import { transposeNotes } from './musical/transpose';
import {
  measureLengthInQuarterBeats,
  durationLabelToQuarterNoteUnits,
  oneMetricalBeatInQuarterBeats,
} from './musical/timeSignature';
import { useNoodimeisterOptional } from './store/NoodimeisterContext';
import { useNotationOptional } from './store/NotationContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import Soundfont from 'soundfont-player';
import {
  scoreToSvg,
  getFirstPageSvgString,
  getPageSvgString,
  validateSmuflTimeSigExport,
  rewriteSmuflTimeSigDigitsToAscii,
} from './utils/scoreToSvg';
import {
  buildNmPrintSvgPagesMarkup,
  buildNmStandalonePrintDocumentHtml,
  runIsolatedPrintFromHtml,
} from './print/nmPrintDocument';
import { registerSmuflFontsForJsPdf } from './export/registerSmuflFontForJsPdf';
import { getScorePageDimensions } from './layout/LayoutManager';
import { getPageCount, normalizePaperSize } from './utils/pageGeometry';
import { openCloudFileInNewBrowserTab } from './utils/appUrls';
import {
  resolveInstrumentRange,
  resolveInstrumentRangeMidi,
  toNoteMidi,
  isMidiOutOfInstrumentRange,
} from './notation/instrumentRangeRules';
import {
  normalizeRepeatMarksMap,
  applyRepeatMark,
  removeRepeatMark,
  validateRepeatMarks,
  mergeMeasuresWithRepeatMarks,
  buildPlaybackNoteEvents,
} from './notation/repeatMarksEngine';

// Safe Initialization: väline seadete objekt KÕIGE ALGUSES (väljaspool komponente). Vercel ei minifitseeri var-deklaratsioone YA/JA-ks.
var GLOBAL_NOTATION_CONFIG = {
  STAFF_HEIGHT: 140,
  JO_VOTI: 0,
  EMOJIS: true,
  DEFAULT_JO_STAFF_POSITION: 7,
  CLEF_WIDTH: 45,
  SYSTEM_GAP: 120,
  GRAND_STAFF_GAP_MIN: 90,
  STAFF_SPACE: 10,
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 40
};
if (typeof window !== 'undefined') {
  var _wc = window.NOODIMEISTER_CONFIG;
  if (_wc) {
    if (_wc.STAFF_HEIGHT != null && _wc.STAFF_HEIGHT > 0) GLOBAL_NOTATION_CONFIG.STAFF_HEIGHT = _wc.STAFF_HEIGHT;
    if (_wc.JO_VOTI != null) GLOBAL_NOTATION_CONFIG.JO_VOTI = _wc.JO_VOTI;
    if (_wc.EMOJIS !== undefined) GLOBAL_NOTATION_CONFIG.EMOJIS = _wc.EMOJIS;
  }
  window.NOODIMEISTER_CONFIG = GLOBAL_NOTATION_CONFIG;
}

// getStaffHeight, LAYOUT, PAGE_BREAK_GAP imporditud layout/LayoutManager.js
var DEMO_MAX_MEASURES = 8;
var SCORE_ZOOM_MIN = 0.25;
var SCORE_ZOOM_MAX = 3;
var KEY_ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb'];

/**
 * Avalik /demo-noodid — minimaalne partituur noodijoonte ja figuurnootide nähtavuse kontrolliks (ei sõltu pilvest ega localStorage restore’ist).
 */
function buildDemoVisibilityProject({ figurenotes, grandStaff }) {
  const demoNotes = [
    { id: 'd1', pitch: 'C', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd2', pitch: 'D', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd3', pitch: 'E', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd4', pitch: 'F', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd5', pitch: 'G', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd6', pitch: 'A', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd7', pitch: 'B', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 'd8', pitch: 'C', octave: 5, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
  ];
  const braceId = 'demo-grand-staff';
  let staves;
  if (grandStaff && !figurenotes) {
    staves = [
      { id: 'demo-treble', instrumentId: 'piano', clefType: 'treble', notes: demoNotes, braceGroupId: braceId, notationMode: 'traditional' },
      { id: 'demo-bass', instrumentId: 'piano', clefType: 'bass', notes: [], braceGroupId: braceId, notationMode: 'traditional' },
    ];
  } else {
    staves = [
      { id: 'demo-single', instrumentId: 'single-staff-treble', clefType: 'treble', notes: demoNotes, notationMode: figurenotes ? 'figurenotes' : 'traditional' },
    ];
  }
  return {
    setupCompleted: true,
    songTitle: figurenotes ? 'Demo — figuurnoot' : grandStaff ? 'Demo — klaver (2 rida)' : 'Demo — noodijooned',
    author: 'Noodimeister',
    timeSignature: { beats: 4, beatUnit: 4 },
    timeSignatureMode: 'standard',
    keySignature: 'C',
    staffLines: 5,
    notationStyle: figurenotes ? 'FIGURENOTES' : 'TRADITIONAL',
    notationMode: figurenotes ? 'figurenotes' : 'traditional',
    pixelsPerBeat: 85,
    figurenotesSize: 65,
    figurenotesStems: true,
    figurenotesMelodyShowNoteNames: true,
    layoutMeasuresPerLine: 4,
    addedMeasures: 0,
    viewFitPage: true,
    viewSmartPage: false,
    pageOrientation: 'portrait',
    paperSize: 'a4',
    pageFlowDirection: 'vertical',
    cursorPosition: 0,
    staves,
    activeStaffIndex: 0,
    staffYOffsets: staves.map(() => 0),
    systemYOffsets: [],
    pageDesignDataUrl: null,
  };
}

// Graafika ja app konstandid var'iga faili alguses (GLOBAL_NOTATION_CONFIG on noodijoonestiku seaded)
var LUCIDE_ICONS = [
  'Music2', 'Clock', 'Hash', 'Type', 'Piano', 'Palette', 'Layout', 'Check', 'Save', 'FolderOpen',
  'Plus', 'Settings', 'Key', 'Repeat', 'Cloud', 'LogOut', 'LogIn', 'UserPlus', 'User', 'CloudUpload', 'CloudDownload', 'FolderPlus', 'ChevronDown',
  'Play', 'Pause', 'Video', 'Eye', 'ArrowDown', 'ArrowRight', 'ArrowUpDown', 'X', 'Printer', 'FileDown',
  'Hand', 'MousePointer', 'Keyboard', 'ExternalLink'
];
var STORAGE_KEY = 'noodimeister-data';
var THEME_STORAGE_KEY = 'noodimeister-theme';
var PROJECT_IO_STORAGE_KEY = 'noodimeister-project-io-prefs';

/** Default: light; user must change color mode themselves. */
function getStoredTheme() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (raw) {
      const o = JSON.parse(raw);
      return {
        mode: o.mode === 'dark' ? 'dark' : 'light',
        primaryColor: ['orange', 'blue', 'green'].includes(o.primaryColor) ? o.primaryColor : 'orange',
      };
    }
  } catch (_) { /* ignore */ }
  return { mode: 'light', primaryColor: 'orange' };
}

function applyThemeToDocument(mode, primaryColor) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.setAttribute('data-primary-color', primaryColor);
}

// Rütmiõppe režiim: Kodály silpide pildid (public/) – kui rütmirežiim on sisse lülitatud, kasutatakse neid faile
var RHYTHM_SYLLABLE_IMAGES = {
  '1/4': '/ta.svg',      // veerandnoot
  '1/8': '/ti-ti.svg',    // kaks kaheksandiknooti
  '1/2': '/ta-a.svg',     // poolnoot
  'rest': '/sh-sh.svg',   // veerandpaus
  '1/16': '/ti-ri-ti-ri.svg',
  '1/1': '/ta-a-a-a.svg',
  '1/32': '/ri.svg'
};

var VALID_DENOMINATORS = [1, 2, 4, 8, 16, 32, 64, 128];
var MAX_NUMERATOR = 99;
var TOOLBOX_ORDER = ['rhythm', 'timeSignature', 'clefs', 'keySignatures', 'transpose', 'pitchInput', 'pianoKeyboard', 'notehead', 'instruments', 'repeatsJumps', 'layout', 'textBox', 'chords'];
var PITCH_TO_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Noodi täis MIDI väärtus (pitch + oktav + accidental), akordi „kõrgeima“ noodi võrdlemiseks. */
function noteToMidi(n) {
  if (!n || n.isRest) return -1;
  return (n.octave + 1) * 12 + (PITCH_TO_SEMI[n.pitch] ?? 0) + (n.accidental ?? 0);
}

/**
 * Viimase sisestus-ghost'i MIDI (helistik + oktav + alteratsioon), et tähekäsk valida oktav MuseScore-stiilis.
 */
function ghostReferenceMidi(keySignature, notationStyle, ghostPitch, ghostOctave, ghostAccidental, ghostAccidentalIsExplicit) {
  const p = ghostPitch || 'C';
  const o = typeof ghostOctave === 'number' ? ghostOctave : 4;
  const refKeyAcc = getAccidentalForPitchInKey(p, keySignature);
  const refAcc = notationStyle === 'FIGURENOTES'
    ? refKeyAcc
    : (ghostAccidentalIsExplicit ? (ghostAccidental ?? 0) : refKeyAcc);
  return toNoteMidi(p, o, refAcc);
}

/**
 * Tähekäsk (ainult traditsiooniline / pedagoogiline noodijoonestik): vali oktav (2–6) lähima MIDI järgi.
 * Figuurnotatsioonis kasutatakse ghost-oktavi — kuju määrab kõrguse konteksti.
 */
function resolveOctaveForPitchLetter(targetPitch, refMidi, keySignature, notationStyle, ghostAccidentalIsExplicit, ghostAccidental) {
  const keyAccNew = getAccidentalForPitchInKey(targetPitch, keySignature);
  const newAcc = notationStyle === 'FIGURENOTES'
    ? keyAccNew
    : (ghostAccidentalIsExplicit ? (ghostAccidental ?? 0) : keyAccNew);
  let reference = refMidi;
  if (reference == null || !Number.isFinite(reference)) {
    const rk = getAccidentalForPitchInKey('C', keySignature);
    reference = toNoteMidi('C', 4, notationStyle === 'FIGURENOTES' ? rk : (ghostAccidentalIsExplicit ? (ghostAccidental ?? 0) : rk));
  }
  if (reference == null) reference = 60;
  let bestOct = 4;
  let bestDist = Infinity;
  let bestMidi = -1;
  for (let o = 2; o <= 6; o++) {
    const m = toNoteMidi(targetPitch, o, newAcc);
    if (m == null) continue;
    const d = Math.abs(m - reference);
    if (d < bestDist || (d === bestDist && m > bestMidi)) {
      bestDist = d;
      bestOct = o;
      bestMidi = m;
    }
  }
  return bestOct;
}

/** Sama loogika mis minMeasuresFromNotes (useMemo) — kasutusel kohe pärast sisestust, enne kui ref uueneb */
function minMeasuresNeededForNotesOnStaves(stavesSnapshot, staffIndexToReplace, replacementNotes, timeSignature, pickupEnabled, pickupQuantity, pickupDuration) {
  let maxEndBeat = 0;
  const list = stavesSnapshot || [];
  for (let si = 0; si < list.length; si++) {
    const arr = si === staffIndexToReplace ? replacementNotes : (list[si]?.notes || []);
    let run = 0;
    for (const n of arr) {
      const beat = typeof n.beat === 'number' ? n.beat : run;
      const dur = Number(n.duration) || 1;
      maxEndBeat = Math.max(maxEndBeat, beat + dur);
      run = beat + dur;
    }
  }
  if (maxEndBeat <= 0) return 1;
  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  let firstMeasureBeats = measureQuarters;
  if (pickupEnabled && pickupQuantity > 0 && pickupDuration) {
    const pickupQuarters = pickupQuantity * durationLabelToQuarterNoteUnits(pickupDuration);
    firstMeasureBeats = Math.max(0.25, Math.min(pickupQuarters, measureQuarters - 0.25));
  }
  if (maxEndBeat <= firstMeasureBeats) return 1;
  const measuresAfterFirst = Math.ceil((maxEndBeat - firstMeasureBeats) / measureQuarters);
  return 1 + measuresAfterFirst;
}

/** Sama loogika mis minMeasuresFromNotes (useMemo) — kasutusel pärast tühja takti eemaldamist, et addedMeasures ei jääks min-ist madalamaks. */
function computeMinMeasuresFromStaves(stavesSnapshot, timeSignature, pickupEnabled, pickupQuantity, pickupDuration) {
  let maxEndBeat = 0;
  for (const staff of stavesSnapshot || []) {
    const arr = staff?.notes || [];
    let run = 0;
    for (const n of arr) {
      const beat = typeof n.beat === 'number' ? n.beat : run;
      const dur = Number(n.duration) || 1;
      maxEndBeat = Math.max(maxEndBeat, beat + dur);
      run = beat + dur;
    }
  }
  if (maxEndBeat <= 0) return 1;
  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  let firstMeasureBeats = measureQuarters;
  if (pickupEnabled && pickupQuantity > 0 && pickupDuration) {
    const pickupQuarters = pickupQuantity * durationLabelToQuarterNoteUnits(pickupDuration);
    firstMeasureBeats = Math.max(0.25, Math.min(pickupQuarters, measureQuarters - 0.25));
  }
  if (maxEndBeat <= firstMeasureBeats) return 1;
  const measuresAfterFirst = Math.ceil((maxEndBeat - firstMeasureBeats) / measureQuarters);
  return 1 + measuresAfterFirst;
}

/** Kas antud taktiga kattub mõni noot/paus ühel noodireal (implitsiitne beatRun nagu minMeasuresFromNotes). */
function measureOverlapsAnyNoteOnStaff(staffNotes, measure) {
  const EPS = 1e-6;
  let beatRun = 0;
  const arr = staffNotes || [];
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    const noteBeat = typeof n.beat === 'number' ? n.beat : beatRun;
    const dur = Number(n.duration) || 1;
    if (noteBeat < measure.endBeat - EPS && noteBeat + dur > measure.startBeat + EPS) return true;
    beatRun = noteBeat + dur;
  }
  return false;
}

function measureHasOverlapAnyStaff(stavesSnapshot, measure) {
  const list = stavesSnapshot || [];
  for (let si = 0; si < list.length; si++) {
    if (measureOverlapsAnyNoteOnStaff(list[si]?.notes || [], measure)) return true;
  }
  return false;
}

/**
 * Eemaldab puhkus, mis jäävad täielikult [start,end) sisse (ei lõhu takti üle ulatuvaid puhkusid).
 * Kasutusel enne tühja takti eemaldamist — muidu teisel real (nt klaveri bass) säiliks maxCursor padding ja minMeasuresFromNotes sunniks taktid tagasi.
 */
function removeRestsFullyContainedInMeasureAllStaves(stavesSnapshot, measure) {
  const EPS = 1e-6;
  const { startBeat, endBeat } = measure;
  let removedAny = false;
  const nextStaves = (stavesSnapshot || []).map((staff) => {
    const arr = staff?.notes || [];
    let beatRun = 0;
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      const noteBeat = typeof n.beat === 'number' ? n.beat : beatRun;
      const dur = Number(n.duration) || 1;
      const overlaps = noteBeat < endBeat - EPS && noteBeat + dur > startBeat + EPS;
      const fullyContained = noteBeat >= startBeat - EPS && noteBeat + dur <= endBeat + EPS;
      beatRun = noteBeat + dur;
      if (overlaps && n.isRest && fullyContained) {
        removedAny = true;
        continue;
      }
      out.push(n);
    }
    return { ...staff, notes: out };
  });
  return { nextStaves, removedAny };
}

/**
 * Eemaldab ajateljelt intervalli [rangeStart, rangeEnd) (beatid) ühe noodirea noodid — nihutab järgnevaid.
 * Kasutusel taktide kustutamisel (mitu reala korraga).
 */
function removeBeatRangeFromStaffNotes(staffNotes, rangeStart, rangeEnd) {
  const EPS = 1e-6;
  const L = rangeEnd - rangeStart;
  if (L <= EPS) return { notes: staffNotes || [], changed: false };
  let beatRun = 0;
  const out = [];
  let changed = false;
  const arr = staffNotes || [];
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    const s = typeof n.beat === 'number' ? n.beat : beatRun;
    const dur = Number(n.duration) || 1;
    const e = s + dur;
    beatRun = e;

    if (e <= rangeStart + EPS) {
      out.push(typeof n.beat === 'number' ? n : { ...n, beat: s });
      continue;
    }
    if (s >= rangeEnd - EPS) {
      out.push({ ...n, beat: s - L });
      changed = true;
      continue;
    }
    changed = true;
    if (s >= rangeStart - EPS && e <= rangeEnd + EPS) continue;
    if (s + EPS < rangeStart && e > rangeStart + EPS && e <= rangeEnd + EPS) {
      const newDur = rangeStart - s;
      if (newDur > EPS) out.push({ ...n, beat: s, duration: newDur });
      continue;
    }
    if (s + EPS < rangeStart && e >= rangeEnd - EPS) {
      const newDur = dur - L;
      if (newDur > EPS) out.push({ ...n, beat: s, duration: newDur });
      continue;
    }
    if (s >= rangeStart - EPS && s < rangeEnd - EPS && e > rangeEnd + EPS) {
      const newDur = e - rangeEnd;
      if (newDur > EPS) out.push({ ...n, beat: rangeStart, duration: newDur });
    }
  }
  return { notes: out, changed };
}

function removeBeatRangeFromChords(chordList, rangeStart, rangeEnd) {
  const EPS = 1e-6;
  const L = rangeEnd - rangeStart;
  if (L <= EPS) return chordList || [];
  const out = [];
  for (const c of chordList || []) {
    const p = Number(c.beatPosition) || 0;
    const dur = Number(c.durationBeats) > 0 ? Number(c.durationBeats) : 1;
    const e = p + dur;
    if (e <= rangeStart + EPS) {
      out.push(c);
      continue;
    }
    if (p >= rangeEnd - EPS) {
      out.push({ ...c, beatPosition: p - L });
      continue;
    }
    if (p >= rangeStart - EPS && e <= rangeEnd + EPS) continue;
    if (p + EPS < rangeStart && e > rangeStart + EPS && e <= rangeEnd + EPS) {
      const newDur = rangeStart - p;
      if (newDur > EPS) out.push({ ...c, beatPosition: p, durationBeats: newDur });
      continue;
    }
    if (p + EPS < rangeStart && e >= rangeEnd - EPS) {
      const newDur = dur - L;
      if (newDur > EPS) out.push({ ...c, beatPosition: p, durationBeats: newDur });
      continue;
    }
    if (p >= rangeStart - EPS && p < rangeEnd - EPS && e > rangeEnd + EPS) {
      const newDur = e - rangeEnd;
      if (newDur > EPS) out.push({ ...c, beatPosition: rangeStart, durationBeats: newDur });
    }
  }
  return out.sort((a, b) => (Number(a.beatPosition) || 0) - (Number(b.beatPosition) || 0));
}

/** Paigutus: lineBreakBefore / pageBreakBefore salvestavad 0-põhise taktiindeksi (vt layout tööriistariba). */
function remapBreakIndicesAfterMeasureDelete(prevArr, startIdx, endIdx) {
  const numDel = endIdx - startIdx + 1;
  if (numDel <= 0 || !Array.isArray(prevArr)) return prevArr || [];
  return prevArr
    .filter((v) => v < startIdx || v > endIdx)
    .map((v) => (v > endIdx ? v - numDel : v));
}

function remapRepeatMarksAfterMeasureDelete(prevMap, startIdx, endIdx) {
  const numDel = endIdx - startIdx + 1;
  if (numDel <= 0 || !prevMap || typeof prevMap !== 'object') return prevMap || {};
  const next = {};
  Object.entries(prevMap).forEach(([k, v]) => {
    const i = Number(k);
    if (!Number.isInteger(i)) return;
    if (i < startIdx) next[i] = v;
    else if (i > endIdx) next[i - numDel] = v;
  });
  return next;
}

function getMeasureIndexForBeatMs(ms, beat, measureLengthQuarterFallback) {
  const EPS = 1e-6;
  if (!Array.isArray(ms) || ms.length === 0) return 0;
  const i = ms.findIndex((m) => beat >= m.startBeat && beat < m.endBeat);
  if (i >= 0) return i;
  const last = ms[ms.length - 1];
  if (beat >= last.startBeat - EPS && beat <= last.endBeat + EPS) return ms.length - 1;
  const span = Number(measureLengthQuarterFallback) || 4;
  return Math.min(Math.max(0, Math.floor((beat || 0) / span)), ms.length - 1);
}

function findFirstNoteIndexInMeasure(notes, measure) {
  const EPS = 1e-6;
  if (!measure || !Array.isArray(notes)) return -1;
  let run = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const b = typeof n.beat === 'number' ? n.beat : run;
    if (b >= measure.endBeat - EPS) break;
    if (b >= measure.startBeat - EPS && b < measure.endBeat - EPS) return i;
    run = b + (Number(n.duration) || 1);
  }
  return -1;
}

var PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };

// Joonestiku/instrumentide konstandid var'iga faili alguses
var INSTRUMENT_CATEGORIES = [
  { id: 'singleStaff', labelKey: 'cat.singleStaff', instruments: ['single-staff-treble', 'single-staff-bass'] },
  { id: 'orffTuned', labelKey: 'cat.orffTuned', instruments: ['boomwhackers', 'handbells'] },
  { id: 'orffMallets', labelKey: 'cat.orffMallets', instruments: ['soprano-xylophone', 'alto-xylophone', 'bass-xylophone', 'soprano-metallophone', 'alto-metallophone', 'bass-metallophone', 'glockenspiel'] },
  { id: 'orffPercussion', labelKey: 'cat.orffPercussion', instruments: ['triangle', 'claves', 'woodblock', 'temple-blocks', 'castanets', 'shakers', 'maracas', 'guiro', 'agogo', 'cowbell', 'cymbals', 'sleighbells', 'djembe', 'cajon'] },
  { id: 'keyboard', labelKey: 'cat.keyboard', instruments: ['piano', 'electric-piano', 'organ', 'harpsichord', 'accordion', 'celesta'] },
  { id: 'stringsPlucked', labelKey: 'cat.stringsPlucked', instruments: ['guitar', 'ukulele-sopran', 'ukulele-tenor', 'ukulele-bariton', 'ukulele-bass'] },
  { id: 'stringsBowed', labelKey: 'cat.stringsBowed', instruments: ['violin', 'viola', 'cello', 'double-bass', 'strings-ensemble'] },
  { id: 'woodwinds', labelKey: 'cat.woodwinds', instruments: ['flute', 'recorder', 'clarinet', 'oboe', 'bassoon'] },
  { id: 'brass', labelKey: 'cat.brass', instruments: ['trumpet', 'trombone', 'tuba', 'french-horn'] },
  { id: 'nonOrchestral', labelKey: 'cat.nonOrchestral', instruments: ['tin-whistle-d', 'tin-whistle-c', 'tin-whistle-bb', 'tin-whistle-a', 'tin-whistle-g', 'tin-whistle-f', 'saxophone', 'xylophone', 'marimba', 'vibraphone'] },
  { id: 'bass', labelKey: 'cat.bass', instruments: ['acoustic-bass', 'electric-bass'] },
  { id: 'synth', labelKey: 'cat.synth', instruments: ['synth-lead', 'synth-pad'] },
  { id: 'other', labelKey: 'cat.other', instruments: ['voice'] }
];
var INSTRUMENT_CONFIG_BASE = {
  'single-staff-treble': { value: 'single-staff-treble', range: 'E3-A7', type: 'standard', defaultClef: 'treble' },
  'single-staff-bass':   { value: 'single-staff-bass', range: 'E2-G4', type: 'standard', defaultClef: 'bass' },
  boomwhackers: { value: 'boomwhackers', range: 'C4-C6', type: 'standard', defaultClef: 'treble', colorSystem: 'chromaNotes' },
  handbells:    { value: 'handbells', range: 'C4-C6', type: 'standard', defaultClef: 'treble', colorSystem: 'schoolHandbells' },
  'soprano-xylophone': { value: 'soprano-xylophone', range: 'C5-A6', type: 'standard', defaultClef: 'treble', family: 'orff-mallet' },
  'alto-xylophone': { value: 'alto-xylophone', range: 'C4-A5', type: 'standard', defaultClef: 'treble', family: 'orff-mallet' },
  'bass-xylophone': { value: 'bass-xylophone', range: 'C3-A4', type: 'standard', defaultClef: 'bass', family: 'orff-mallet' },
  'soprano-metallophone': { value: 'soprano-metallophone', range: 'C5-A6', type: 'standard', defaultClef: 'treble', family: 'orff-mallet' },
  'alto-metallophone': { value: 'alto-metallophone', range: 'C4-A5', type: 'standard', defaultClef: 'treble', family: 'orff-mallet' },
  'bass-metallophone': { value: 'bass-metallophone', range: 'C3-A4', type: 'standard', defaultClef: 'bass', family: 'orff-mallet' },
  triangle: { value: 'triangle', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  claves: { value: 'claves', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  woodblock: { value: 'woodblock', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  'temple-blocks': { value: 'temple-blocks', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  castanets: { value: 'castanets', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  shakers: { value: 'shakers', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  maracas: { value: 'maracas', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  guiro: { value: 'guiro', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  agogo: { value: 'agogo', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  cowbell: { value: 'cowbell', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  cymbals: { value: 'cymbals', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  sleighbells: { value: 'sleighbells', range: 'C5-C5', type: 'standard', defaultClef: 'treble', family: 'orff-percussion' },
  djembe: { value: 'djembe', range: 'C4-C4', type: 'standard', defaultClef: 'bass', family: 'orff-percussion' },
  cajon: { value: 'cajon', range: 'C4-C4', type: 'standard', defaultClef: 'bass', family: 'orff-percussion' },
  'electric-piano': { value: 'electric-piano', range: 'A0-C8', type: 'standard', defaultClef: 'treble' },
  organ:      { value: 'organ', range: 'C2-C6', type: 'figuredBass', defaultClef: 'treble' },
  harpsichord:{ value: 'harpsichord', range: 'F1-F6', type: 'figuredBass', defaultClef: 'treble' },
  accordion:  { value: 'accordion', range: 'F3-C6', type: 'accordion', defaultClef: 'treble' },
  celesta:    { value: 'celesta', range: 'C4-C8', type: 'standard', defaultClef: 'treble' },
  piano:      { value: 'piano', range: 'A0-C8', type: 'grandStaff', defaultClef: 'treble' },
  guitar:     { value: 'guitar', range: 'E2-E6', type: 'tab', strings: 6, tuning: ['E2','A2','D3','G3','B3','E4'], defaultClef: 'treble' },
  'ukulele-sopran': { value: 'ukulele-sopran', range: 'G4-A5', type: 'tab', strings: 4, tuning: ['G4','C4','E4','A4'], defaultClef: 'treble' },
  'ukulele-tenor':  { value: 'ukulele-tenor', range: 'G3-A5', type: 'tab', strings: 4, tuning: ['G3','C4','E4','A4'], defaultClef: 'treble' },
  'ukulele-bariton':{ value: 'ukulele-bariton', range: 'D3-E5', type: 'tab', strings: 4, tuning: ['D3','G3','B3','E4'], defaultClef: 'treble' },
  'ukulele-bass':   { value: 'ukulele-bass', range: 'E2-A4', type: 'tab', strings: 4, tuning: ['E2','A2','D3','G3'], defaultClef: 'treble' },
  violin:     { value: 'violin', range: 'G3-A7', type: 'standard', defaultClef: 'treble' },
  viola:      { value: 'viola', range: 'C3-E6', type: 'standard', defaultClef: 'alto' },
  cello:      { value: 'cello', range: 'C2-A5', type: 'standard', defaultClef: 'bass' },
  'double-bass': { value: 'double-bass', range: 'E1-G4', type: 'standard', defaultClef: 'bass' },
  'strings-ensemble': { value: 'strings-ensemble', range: 'C2-C7', type: 'standard', defaultClef: 'treble' },
  'acoustic-bass': { value: 'acoustic-bass', range: 'E1-G4', type: 'standard', defaultClef: 'bass' },
  'electric-bass': { value: 'electric-bass', range: 'E1-G4', type: 'standard', defaultClef: 'bass' },
  flute:      { value: 'flute', range: 'C4-C7', type: 'wind', fingering: true, defaultClef: 'treble' },
  recorder:   { value: 'recorder', range: 'C5-D6', type: 'wind', fingering: true, defaultClef: 'treble' },
  clarinet:   { value: 'clarinet', range: 'E3-G6', type: 'wind', fingering: true, defaultClef: 'treble' },
  oboe:       { value: 'oboe', range: 'Bb3-A6', type: 'wind', fingering: true, defaultClef: 'treble' },
  bassoon:    { value: 'bassoon', range: 'Bb1-E5', type: 'wind', fingering: true, defaultClef: 'bass' },
  trumpet:    { value: 'trumpet', range: 'F#3-E6', type: 'standard', defaultClef: 'treble' },
  trombone:   { value: 'trombone', range: 'E2-F5', type: 'standard', defaultClef: 'bass' },
  tuba:       { value: 'tuba', range: 'D1-F4', type: 'standard', defaultClef: 'bass' },
  'french-horn': { value: 'french-horn', range: 'B1-F5', type: 'standard', defaultClef: 'treble' },
  'tin-whistle': { value: 'tin-whistle', range: 'D4-C#7', type: 'wind', fingering: true, defaultClef: 'treble' }, // legacy id
  'tin-whistle-d': { value: 'tin-whistle-d', range: 'D4-C#7', type: 'wind', fingering: true, defaultClef: 'treble', whistleKey: 'D' },
  'tin-whistle-c': { value: 'tin-whistle-c', range: 'C5-B6', type: 'wind', fingering: true, defaultClef: 'treble', whistleKey: 'C' },
  'tin-whistle-bb': { value: 'tin-whistle-bb', range: 'Bb4-A6', type: 'wind', fingering: true, defaultClef: 'treble', whistleKey: 'Bb' },
  'tin-whistle-a': { value: 'tin-whistle-a', range: 'A4-G#6', type: 'wind', fingering: true, defaultClef: 'treble', whistleKey: 'A' },
  'tin-whistle-g': { value: 'tin-whistle-g', range: 'G4-F#6', type: 'wind', fingering: true, defaultClef: 'treble', whistleKey: 'G' },
  'tin-whistle-f': { value: 'tin-whistle-f', range: 'F4-E6', type: 'wind', fingering: true, defaultClef: 'treble', whistleKey: 'F' },
  saxophone:  { value: 'saxophone', range: 'Bb2-F5', type: 'wind', fingering: true, defaultClef: 'treble' },
  glockenspiel: { value: 'glockenspiel', range: 'G5-C8', type: 'standard', defaultClef: 'treble' },
  xylophone: { value: 'xylophone', range: 'F3-C7', type: 'standard', defaultClef: 'treble' },
  marimba: { value: 'marimba', range: 'C2-C7', type: 'standard', defaultClef: 'treble' },
  vibraphone: { value: 'vibraphone', range: 'F3-F6', type: 'standard', defaultClef: 'treble' },
  'synth-lead': { value: 'synth-lead', range: 'C2-C7', type: 'standard', defaultClef: 'treble' },
  'synth-pad': { value: 'synth-pad', range: 'C2-C7', type: 'standard', defaultClef: 'treble' },
  voice:      { value: 'voice', range: 'C3-C6', type: 'standard', defaultClef: 'treble' }
};
var INSTRUMENT_I18N_KEYS = {
  'single-staff-treble': 'inst.singleStaffTreble', 'single-staff-bass': 'inst.singleStaffBass',
  boomwhackers: 'inst.boomwhackers',
  handbells: 'inst.handbells',
  'soprano-xylophone': 'inst.sopranoXylophone',
  'alto-xylophone': 'inst.altoXylophone',
  'bass-xylophone': 'inst.bassXylophone',
  'soprano-metallophone': 'inst.sopranoMetallophone',
  'alto-metallophone': 'inst.altoMetallophone',
  'bass-metallophone': 'inst.bassMetallophone',
  triangle: 'inst.triangle',
  claves: 'inst.claves',
  woodblock: 'inst.woodblock',
  'temple-blocks': 'inst.templeBlocks',
  castanets: 'inst.castanets',
  shakers: 'inst.shakers',
  maracas: 'inst.maracas',
  guiro: 'inst.guiro',
  agogo: 'inst.agogo',
  cowbell: 'inst.cowbell',
  cymbals: 'inst.cymbals',
  sleighbells: 'inst.sleighbells',
  djembe: 'inst.djembe',
  cajon: 'inst.cajon',
  organ: 'inst.organ', harpsichord: 'inst.harpsichord', accordion: 'inst.accordion', piano: 'inst.piano',
  'electric-piano': 'inst.electricPiano', celesta: 'inst.celesta',
  guitar: 'inst.guitar', 'ukulele-sopran': 'inst.ukuleleSopran', 'ukulele-tenor': 'inst.ukuleleTenor',
  'ukulele-bariton': 'inst.ukuleleBariton', 'ukulele-bass': 'inst.ukuleleBass',
  violin: 'inst.violin', viola: 'inst.viola', cello: 'inst.cello', 'double-bass': 'inst.doubleBass', 'strings-ensemble': 'inst.stringsEnsemble',
  'acoustic-bass': 'inst.acousticBass', 'electric-bass': 'inst.electricBass',
  flute: 'inst.flute', recorder: 'inst.recorder', clarinet: 'inst.clarinet', oboe: 'inst.oboe', bassoon: 'inst.bassoon',
  trumpet: 'inst.trumpet', trombone: 'inst.trombone', tuba: 'inst.tuba', 'french-horn': 'inst.frenchHorn',
  'tin-whistle': 'inst.tinWhistleD',
  'tin-whistle-d': 'inst.tinWhistleD',
  'tin-whistle-c': 'inst.tinWhistleC',
  'tin-whistle-bb': 'inst.tinWhistleBb',
  'tin-whistle-a': 'inst.tinWhistleA',
  'tin-whistle-g': 'inst.tinWhistleG',
  'tin-whistle-f': 'inst.tinWhistleF',
  saxophone: 'inst.saxophone', glockenspiel: 'inst.glockenspiel', xylophone: 'inst.xylophone',
  marimba: 'inst.marimba', vibraphone: 'inst.vibraphone', 'synth-lead': 'inst.synthLead', 'synth-pad': 'inst.synthPad',
  voice: 'inst.voice'
};
var INSTRUMENT_TO_GM_PROGRAM = {
  'single-staff-treble': 0, 'single-staff-bass': 0,
  boomwhackers: 115, handbells: 14,
  'soprano-xylophone': 13, 'alto-xylophone': 13, 'bass-xylophone': 13,
  'soprano-metallophone': 10, 'alto-metallophone': 10, 'bass-metallophone': 10,
  triangle: 115, claves: 115, woodblock: 115, 'temple-blocks': 115, castanets: 115,
  shakers: 115, maracas: 115, guiro: 115, agogo: 115, cowbell: 115, cymbals: 115, sleighbells: 115,
  djembe: 115, cajon: 115,
  piano: 0, 'electric-piano': 4, organ: 19, harpsichord: 6, accordion: 21, celesta: 8,
  guitar: 24, 'ukulele-sopran': 24, 'ukulele-tenor': 24, 'ukulele-bariton': 24, 'ukulele-bass': 32,
  violin: 40, viola: 41, cello: 42, 'double-bass': 43, 'strings-ensemble': 48, 'acoustic-bass': 32, 'electric-bass': 33,
  flute: 73, recorder: 74, clarinet: 71, oboe: 68, bassoon: 70,
  trumpet: 56, trombone: 57, tuba: 58, 'french-horn': 60,
  'tin-whistle': 73, 'tin-whistle-d': 73, 'tin-whistle-c': 73, 'tin-whistle-bb': 73, 'tin-whistle-a': 73, 'tin-whistle-g': 73, 'tin-whistle-f': 73, saxophone: 65, glockenspiel: 9, xylophone: 13, marimba: 12, vibraphone: 11, 'synth-lead': 80, 'synth-pad': 88, voice: 52
};
var INSTRUMENT_TO_SOUNDFONT_NAME = {
  'single-staff-treble': 'acoustic_grand_piano', 'single-staff-bass': 'acoustic_grand_piano',
  boomwhackers: 'woodblock', handbells: 'tubular_bells',
  'soprano-xylophone': 'xylophone', 'alto-xylophone': 'xylophone', 'bass-xylophone': 'xylophone',
  'soprano-metallophone': 'glockenspiel', 'alto-metallophone': 'glockenspiel', 'bass-metallophone': 'glockenspiel',
  triangle: 'woodblock', claves: 'woodblock', woodblock: 'woodblock', 'temple-blocks': 'woodblock', castanets: 'woodblock',
  shakers: 'woodblock', maracas: 'woodblock', guiro: 'woodblock', agogo: 'woodblock', cowbell: 'woodblock', cymbals: 'woodblock', sleighbells: 'woodblock',
  djembe: 'woodblock', cajon: 'woodblock',
  piano: 'acoustic_grand_piano', 'electric-piano': 'electric_piano_1', organ: 'church_organ', harpsichord: 'harpsichord', accordion: 'accordion', celesta: 'celesta',
  guitar: 'acoustic_guitar_nylon', 'ukulele-sopran': 'acoustic_guitar_nylon', 'ukulele-tenor': 'acoustic_guitar_nylon', 'ukulele-bariton': 'acoustic_guitar_nylon', 'ukulele-bass': 'acoustic_bass',
  violin: 'violin', viola: 'viola', cello: 'cello', 'double-bass': 'contrabass', 'strings-ensemble': 'string_ensemble_1', 'acoustic-bass': 'acoustic_bass', 'electric-bass': 'electric_bass_finger',
  flute: 'flute', recorder: 'recorder', clarinet: 'clarinet', oboe: 'oboe', bassoon: 'bassoon',
  trumpet: 'trumpet', trombone: 'trombone', tuba: 'tuba', 'french-horn': 'french_horn',
  // Tin whistle: GM-s ei ole eraldi häält; kasutame flöödi programmi (73) — lähedasem kui recorder (74).
  'tin-whistle': 'flute', 'tin-whistle-d': 'flute', 'tin-whistle-c': 'flute', 'tin-whistle-bb': 'flute', 'tin-whistle-a': 'flute', 'tin-whistle-g': 'flute', 'tin-whistle-f': 'flute', saxophone: 'alto_sax', glockenspiel: 'glockenspiel', xylophone: 'xylophone', marimba: 'marimba', vibraphone: 'vibraphone', 'synth-lead': 'lead_1_square', 'synth-pad': 'pad_2_warm', voice: 'choir_aahs'
};
// Instrument-specific SoundFont pack overrides (gleitz CDN). Default: FluidR3_GM (iirivile kasutab nüüd sama panka mis flööt).
var INSTRUMENT_SOUNDFONT_PACK = {
};
function soundfontPackForInstrumentId(id) {
  return INSTRUMENT_SOUNDFONT_PACK[id] || 'FluidR3_GM';
}
function soundfontPlayerCacheKey(instrumentId) {
  return String(instrumentId || '') + '\0' + soundfontPackForInstrumentId(instrumentId);
}

// Noodivõtmete SVG path-id (var faili alguses – TDZ/vältimine)
var TREBLE_CLEF_PATH = 'M14 2v2c0 2-1 4-3 5-2 1-4 1-5 0-1-1-1-3 0-4 1-1 2-2 2-3 1-2-1-2-3 0-4 2-1 4-1 6 0 2 1 3 2 4 3 1 2 2 3 2 5 0 2-1 4-3 5-2 1-4 1-6-1-2-2-2-5 0-7 2-2 4-2 7 0 3 2 4 4 4 7 0 2-2 4-4 5-2 1-4 0-5-2-1-2-1-4 0-6 1-2 3-2 5 0 2 2 3 4 3 6 0 1-1 2-2 2-3 0-1-1-1-2 0-2 1 0 2 0 3-1 1-1 2-2 2-4 0-2-1-3-2-4-1-1-3-1-4 0-1 1-1 2 0 3 1 1 2 1 3 0 1-1 2-1 3 0 1 1 2 1 3 0';
var BASS_CLEF_PATH = 'M8 4c0 2 1 3 2 3 1 0 2-1 2-3 0-2-1-3-2-3-1 0-2 1-2 3zm8 0c0 2 1 3 2 3 1 0 2-1 2-3 0-2-1-3-2-3-1 0-2 1-2 3zm-10 4v12c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2-1 0-2 1-2 2zm12 0v12c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2-1 0-2 1-2 2zM10 6c-1 0-2 1-2 2v8c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2zm4 0c-1 0-2 1-2 2v8c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2z';
var ALTO_TENOR_CLEF_PATH = 'M8 4c-2 0-4 2-4 5s2 5 4 5 4-2 4-5-2-5-4-5zm0 6c-1 0-2-1-2-1 0 0 1-1 2-1s2 1 2 1c0 0-1 1-2 1zm8-6c2 0 4 2 4 5s-2 5-4 5-4-2-4-5 2-5 4-5zm0 6c1 0 2-1 2-1 0 0-1-1-2-1s-2 1-2 1c0 0 1 1 2 1z';

// Font options: classic, handwritten, and capitals/display (for figuurnotatsioon / note labels)
var FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia', group: 'classic' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', group: 'classic' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', group: 'classic' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana', group: 'classic' },
  { value: '"Palatino Linotype", "Book Antiqua", Palatino, serif', label: 'Palatino Linotype', group: 'classic' },
  { value: 'Garamond, "Hoefler Text", "Times New Roman", serif', label: 'Garamond', group: 'classic' },
  { value: '"Book Antiqua", Palatino, serif', label: 'Book Antiqua', group: 'classic' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New', group: 'classic' },
  { value: 'system-ui, -apple-system, sans-serif', label: 'System', group: 'classic' },
  { value: 'sans-serif', label: 'Sans-serif', group: 'classic' },
  { value: 'serif', label: 'Serif', group: 'classic' },
  { value: '"Comic Sans MS", "Comic Sans", cursive', label: 'Comic Sans MS', group: 'handwritten' },
  { value: '"Segoe Script", "Brush Script MT", cursive', label: 'Segoe Script', group: 'handwritten' },
  { value: '"Brush Script MT", "Lucida Handwriting", cursive', label: 'Brush Script MT', group: 'handwritten' },
  { value: '"Lucida Handwriting", "Segoe Script", cursive', label: 'Lucida Handwriting', group: 'handwritten' },
  { value: '"Bradley Hand", "Brush Script MT", cursive', label: 'Bradley Hand', group: 'handwritten' },
  { value: 'Mistral, "Lucida Handwriting", cursive', label: 'Mistral', group: 'handwritten' },
  { value: '"Kristen ITC", "Comic Sans MS", cursive', label: 'Kristen ITC', group: 'handwritten' },
  { value: '"Freestyle Script", "Lucida Handwriting", cursive', label: 'Freestyle Script', group: 'handwritten' },
  { value: 'Impact, "Haettenschweiler", "Arial Black", sans-serif', label: 'Impact', group: 'capitals' },
  { value: '"Arial Black", "Arial Bold", Gadget, sans-serif', label: 'Arial Black', group: 'capitals' },
  { value: '"Franklin Gothic Heavy", "Arial Black", sans-serif', label: 'Franklin Gothic Heavy', group: 'capitals' },
  { value: '"Century Gothic", "Century", sans-serif', label: 'Century Gothic', group: 'capitals' },
  { value: '"Trebuchet MS", "Helvetica Neue", sans-serif', label: 'Trebuchet MS', group: 'capitals' },
  { value: 'Haettenschweiler, "Arial Narrow", sans-serif', label: 'Haettenschweiler', group: 'capitals' },
  { value: '"Cooper Black", "Arial Black", sans-serif', label: 'Cooper Black', group: 'capitals' },
  { value: '"Bauhaus 93", "Arial Rounded MT Bold", sans-serif', label: 'Bauhaus 93', group: 'capitals' },
  { value: '"Arial Rounded MT Bold", "Helvetica Rounded", sans-serif', label: 'Arial Rounded MT Bold', group: 'capitals' },
];

function getFontOptionElements(t) {
  const out = [];
  let lastGroup = null;
  FONT_OPTIONS.forEach((opt) => {
    if (opt.group != null && opt.group !== lastGroup) {
      lastGroup = opt.group;
      out.push(<optgroup key={opt.group} label={t('fontGroup.' + opt.group)} />);
    }
    out.push(<option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.label}</option>);
  });
  return out;
}

var PAPER_SIZE_MM = {
  a5: { width: 148, height: 210 },
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
};

var TEMPO_TERMS = [
  { id: 'largo', key: 'tempo.largo', bpm: 40 },
  { id: 'adagio', key: 'tempo.adagio', bpm: 66 },
  { id: 'andante', key: 'tempo.andante', bpm: 76 },
  { id: 'moderato', key: 'tempo.moderato', bpm: 108 },
  { id: 'allegro', key: 'tempo.allegro', bpm: 120 },
  { id: 'vivace', key: 'tempo.vivace', bpm: 144 },
  { id: 'presto', key: 'tempo.presto', bpm: 168 }
];

/** D-tin whistle: holes as top→mouthpiece (aligned with tinWhistleCodeBottomFirstToHolesTopFirst), 1=covered.
 *  Concert pitch names: low octave D4–B4, C5, C#5; overblow register D5–B5 (+). */
var FINGERING_TIN_WHISTLE = {
  D4: [1, 1, 1, 1, 1, 1], E4: [1, 1, 1, 1, 1, 0], 'F#4': [1, 1, 1, 1, 0, 0], G4: [1, 1, 1, 0, 0, 0], A4: [1, 1, 0, 0, 0, 0], B4: [1, 0, 0, 0, 0, 0],
  C5: [0, 1, 1, 0, 0, 0], 'C#5': [0, 0, 0, 0, 0, 0],
  D5: [0, 1, 1, 1, 1, 1], E5: [1, 1, 1, 1, 1, 0], 'F#5': [1, 1, 1, 1, 0, 0], G5: [1, 1, 1, 0, 0, 0], A5: [1, 1, 0, 0, 0, 0], B5: [1, 0, 0, 0, 0, 0],
  C6: [0, 1, 1, 0, 0, 0], 'C#6': [0, 0, 0, 0, 0, 0],
  D6: [0, 1, 1, 1, 1, 1], E6: [1, 1, 1, 1, 1, 0], 'F#6': [1, 1, 1, 1, 0, 0], G6: [1, 1, 1, 0, 0, 0], A6: [1, 1, 0, 0, 0, 0], B6: [1, 0, 0, 0, 0, 0],
};
var FINGERING_RECORDER = {
  'C5': [1,1,1,1,1,1,1], 'D5': [1,1,1,1,1,1,0], 'E5': [1,1,1,1,1,0,0], 'F5': [1,1,1,1,0,0,0], 'G5': [1,1,1,0,0,0,0], 'A5': [1,1,0,0,0,0,0], 'B5': [1,0,0,0,0,0,0], 'C6': [0,0,0,0,0,0,0],
  'D6': [1,1,1,1,1,1,0], 'E6': [1,1,1,1,1,0,0], 'F6': [1,1,1,1,0,0,0], 'G6': [1,1,1,0,0,0,0], 'A6': [1,1,0,0,0,0,0], 'B6': [1,0,0,0,0,0,0], 'C7': [0,0,0,0,0,0,0]
};

function LoggedInUser({ icons, t }) {
  const navigate = useNavigate();
  const store = useNoodimeisterOptional();
  const notationCtx = useNotationOptional();
  /** Täisfunktsioon: sisselogitud + toetus kehtib (või toetuse API pole seadistatud). */
  const hasFullAccess = store?.hasFullAccess ?? authStorage.isLoggedIn();
  const [localUser, setLocalUser] = useState(() => authStorage.getLoggedInUser());
  const user = store ? store.user : localUser;

  const handleLogout = () => {
    if (store) store.logout();
    else {
      authStorage.clearAuth();
      setLocalUser(null);
    }
    navigate('/');
  };

  if (!user?.name && !user?.email) return null;
  const { User: UserIcon, LogOut: LogOutIcon } = icons || {};

  return (
    <div className="flex items-center gap-2 ml-2 pl-4 border-l border-amber-600/50">
      {UserIcon && <UserIcon className="w-4 h-4 text-amber-200" />}
      <button
        type="button"
        onClick={() => navigate('/konto')}
        className="text-sm font-medium text-amber-100 max-w-[120px] truncate hover:underline text-left"
        title={user.email}
      >
        {user.name || user.email}
      </button>
      <button
        type="button"
        onClick={() => navigate('/konto')}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-800/60 text-amber-100 hover:bg-amber-700 hover:text-white transition-colors"
        title={t('user.myAccount')}
      >
        {t('user.myAccount')}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-800/80 text-amber-100 hover:bg-amber-700 hover:text-white transition-colors"
        title={t('user.logoutTitle')}
      >
        {LogOutIcon && <LogOutIcon className="w-3.5 h-3.5" />} {t('user.logout')}
      </button>
    </div>
  );
}

// computeLayout imporditud layout/LayoutManager.js
// RhythmIcon, RhythmPatternIcon from ./toolboxes (same symbols as symbol gallery)

// VALID_DENOMINATORS, MAX_NUMERATOR on faili alguses var'iga
// MeterIcon, PedagogicalMeterIcon imporditud ./toolboxes (TimeSignatureLayout – ühine pedagoogiline variant)

// TREBLE_CLEF_PATH, BASS_CLEF_PATH, ALTO_TENOR_CLEF_PATH on faili alguses var'iga
function ClefIcon(props) {
  var clefType = props.clefType;
  if (clefType === 'do' || clefType === 'jo') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <JoClefSymbol x={2} centerY={12} staffSpacing={4} stroke="currentColor" />
      </svg>
    );
  }
  var paths = {
    treble: <path d={TREBLE_CLEF_PATH} fill="currentColor" transform="scale(0.08) translate(-80,-20)" />,
    bass: <path d={BASS_CLEF_PATH} fill="currentColor" transform="scale(0.35) translate(2,2)" />,
    alto: <path d={ALTO_TENOR_CLEF_PATH} fill="currentColor" transform="scale(0.4) translate(2,2)" />,
    tenor: <path d={ALTO_TENOR_CLEF_PATH} fill="currentColor" transform="scale(0.4) translate(2,2)" />
  };
  var trebleSvg = (
    <path fill="currentColor" d="M16 2.5c-.6 0-1.2.3-1.5.8-.4.6-.4 1.4 0 2 .3.5.9.8 1.5.8.6 0 1.2-.3 1.5-.8.4-.6.4-1.4 0-2-.3-.5-.9-.8-1.5-.8zm-2 4v14.2c0 .5.4.8.8.8.5 0 .8-.4.8-.8V6.5h-1.6zm4 0v14.2c0 .5.4.8.8.8.5 0 .8-.4.8-.8V6.5H18zM12 4c-.5 0-1 .4-1.2 1-.2.5 0 1 .4 1.3.4.2.8.2 1.2 0 .4-.3.6-.8.4-1.3C13 4.4 12.5 4 12 4z"/>
  );
  var bassSvg = (
    <g fill="currentColor">
      <ellipse cx="8" cy="10" rx="1.8" ry="2.2"/>
      <ellipse cx="16" cy="10" rx="1.8" ry="2.2"/>
      <path d="M10 4v16c0 .6.5 1 1 1s1-.4 1-1V4c0-.6-.5-1-1-1s-1 .4-1 1zm4 0v16c0 .6.5 1 1 1s1-.4 1-1V4c0-.6-.5-1-1-1s-1 .4-1 1z"/>
    </g>
  );
  var altoSvg = (
    <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M6 6c-1.5 0-3 1.2-3 3s1.5 3 3 3 3-1.2 3-3-1.5-3-3-3z"/>
      <path d="M18 6c1.5 0 3 1.2 3 3s-1.5 3-3 3-3-1.2-3-3 1.5-3 3-3z"/>
    </g>
  );
  var svgByClef = { treble: trebleSvg, bass: bassSvg, alto: altoSvg, tenor: altoSvg };
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      {svgByClef[clefType] || trebleSvg}
    </svg>
  );
}

// Noodijoonestikul kasutatav võtme sümbol. Must (#000), terav. Viiulivõti: G-joon; bassivõti: F-joon (4. joon), punktid vahedes.
function StaffClefSymbol({ x, y, height, clefType, fill = '#000', staffSpace = 10 }) {
  if (clefType === 'treble') {
    return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
  }
  if (clefType === 'bass') {
    return <BassClefSymbol x={x} y={y} height={height} fill={fill} staffSpace={staffSpace} />;
  }
  if (clefType === 'alto' || clefType === 'tenor') {
    var scale = (height && height > 0) ? height / 24 : 0.4;
    return (
      <g transform={`translate(${x}, ${y}) scale(${scale}) translate(-12, -12)`} fill="none" stroke={fill || '#000'} strokeWidth="1.4" strokeLinecap="round">
        <path d="M7 5.5c-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2S8.8 5.5 7 5.5z"/>
        <path d="M17 5.5c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2-3.2-1.4-3.2-3.2 1.4-3.2 3.2-3.2z"/>
      </g>
    );
  }
  return null;
}

function PitchIcon() {
  return (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="2" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="2" y1="16" x2="22" y2="16" stroke="currentColor" strokeWidth="0.5"/>
    <ellipse cx="12" cy="12" rx="2.5" ry="2" fill="currentColor"/>
    <line x1="14.5" y1="12" x2="14.5" y2="4" stroke="currentColor" strokeWidth="1"/>
  </svg>
  );
}

/** Leland rhythm icon for toolbox button: quarter note. */
function RhythmToolboxButtonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <SmuflGlyph x={12} y={14} glyph={SMUFL_GLYPH.noteQuarterUp} fontSize={20} fill="currentColor" />
    </svg>
  );
}

/** D-major key signature: two sharps (F#, C#) in Leland, typical vertical positions. */
function KeySignatureDmajorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <SmuflGlyph x={8} y={10} glyph={SMUFL_GLYPH.accidentalSharp} fontSize={10} fill="currentColor" />
      <SmuflGlyph x={8} y={16} glyph={SMUFL_GLYPH.accidentalSharp} fontSize={10} fill="currentColor" />
    </svg>
  );
}

/** Notehead toolbox button: four shapes from Leland (x, oval, square, triangle). */
function NoteheadIcon() {
  const fs = 8;
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <SmuflGlyph x={6} y={8} glyph={NOTEHEAD_SHAPE_GLYPH.x} fontSize={fs} fill="currentColor" />
      <SmuflGlyph x={12} y={8} glyph={NOTEHEAD_SHAPE_GLYPH.oval} fontSize={fs} fill="currentColor" />
      <SmuflGlyph x={18} y={8} glyph={NOTEHEAD_SHAPE_GLYPH.square} fontSize={fs} fill="currentColor" />
      <SmuflGlyph x={12} y={18} glyph={NOTEHEAD_SHAPE_GLYPH.triangle} fontSize={fs} fill="currentColor" />
    </svg>
  );
}

function LayoutIcon(props) {
  var staffLines = props.staffLines;
  return (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1"/>
    <line x1="4" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1"/>
    <line x1="4" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="1"/>
    <path d="M16 8 L20 6 L20 10 Z" fill="currentColor"/>
    <path d="M16 16 L20 14 L20 18 Z" fill="currentColor"/>
    <text x="21" y="13" fontSize="6" fill="currentColor">{staffLines}</text>
  </svg>
  );
}

// INSTRUMENT_* on faili alguses var'iga
function getInstrumentConfig(t) {
  return Object.fromEntries(
    Object.entries(INSTRUMENT_CONFIG_BASE).map(([id, cfg]) => [
      id,
      { ...cfg, label: t(INSTRUMENT_I18N_KEYS[id] || id) }
    ])
  );
}

function InstrumentIcon(props) {
  var instrument = props.instrument;
  var icons = {
    piano: <><rect x="4" y="8" width="3" height="10" fill="currentColor"/><rect x="8" y="8" width="3" height="10" fill="currentColor"/><rect x="12" y="8" width="3" height="10" fill="currentColor"/><rect x="16" y="8" width="3" height="10" fill="currentColor"/><rect x="5.5" y="8" width="2" height="6" fill="none" stroke="white" strokeWidth="0.5"/></>,
    organ: <><rect x="4" y="6" width="4" height="12" fill="currentColor"/><rect x="10" y="8" width="4" height="10" fill="currentColor"/><rect x="16" y="10" width="4" height="8" fill="currentColor"/><path d="M6 4 L6 6 M12 6 L12 8 M18 8 L18 10" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    harpsichord: <><rect x="3" y="10" width="18" height="4" rx="1" fill="currentColor"/><path d="M5 10 L5 14 M9 10 L9 14 M13 10 L13 14 M17 10 L17 14 M21 10 L21 14" stroke="white" strokeWidth="0.8" fill="none"/></>,
    accordion: <><rect x="4" y="6" width="6" height="12" rx="1" fill="currentColor"/><rect x="14" y="6" width="6" height="12" rx="1" fill="currentColor"/><path d="M10 9 L14 9 M10 12 L14 12 M10 15 L14 15" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    voice: <><circle cx="12" cy="10" r="4" fill="currentColor"/><path d="M12 14 Q8 16 8 20 L16 20 Q16 16 12 14" fill="currentColor"/></>,
    guitar: <><path d="M6 4 L6 20 M10 6 L10 20 M14 8 L14 20 M18 10 L18 20" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 8 Q12 6 19 10" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    'ukulele-sopran': 'guitar', 'ukulele-tenor': 'guitar', 'ukulele-bariton': 'guitar', 'ukulele-bass': 'guitar',
    violin: <><path d="M8 6 Q8 4 12 4 Q16 4 16 6 L16 20 Q16 22 12 22 Q8 22 8 20 Z" fill="currentColor"/><circle cx="12" cy="8" r="2" fill="none" stroke="white" strokeWidth="0.8"/></>,
    viola: 'violin', cello: 'single-staff-bass', 'double-bass': 'single-staff-bass',
    flute: <><rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="white"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="16" cy="12" r="1" fill="white"/></>,
    'tin-whistle': <><rect x="5" y="10" width="14" height="3" rx="1" fill="currentColor"/><circle cx="8" cy="11.5" r="1" fill="white"/><circle cx="12" cy="11.5" r="1" fill="white"/><circle cx="16" cy="11.5" r="1" fill="white"/></>,
    'tin-whistle-d': 'tin-whistle', 'tin-whistle-c': 'tin-whistle', 'tin-whistle-bb': 'tin-whistle', 'tin-whistle-a': 'tin-whistle', 'tin-whistle-g': 'tin-whistle', 'tin-whistle-f': 'tin-whistle',
    recorder: <><path d="M8 6 L8 18 Q8 20 12 20 Q16 20 16 18 L16 6" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/><circle cx="10" cy="14" r="1.2" fill="currentColor"/></>,
    clarinet: <><rect x="5" y="9" width="14" height="6" rx="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="white"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="16" cy="12" r="1" fill="white"/></>,
    oboe: <><rect x="6" y="10" width="12" height="4" rx="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="white"/><circle cx="15" cy="12" r="1" fill="white"/></>,
    bassoon: <><path d="M10 4 L14 4 L14 20 L10 20 Z" fill="currentColor"/><circle cx="12" cy="8" r="1.2" fill="white"/><circle cx="12" cy="14" r="1.2" fill="white"/></>,
    trumpet: <><path d="M12 4 L14 8 L14 20 L10 20 L10 8 Z" fill="currentColor"/><circle cx="12" cy="6" r="1.5" fill="none" stroke="white" strokeWidth="0.6"/></>,
    trombone: <><path d="M9 6 L9 18 L15 18 L15 6" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M11 8 L13 8 M11 16 L13 16" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    tuba: <><path d="M8 10 Q8 4 12 4 Q16 4 16 10 L16 20 L8 20 Z" fill="currentColor"/><circle cx="12" cy="7" r="1.5" fill="none" stroke="white" strokeWidth="0.6"/></>,
    'french-horn': <><path d="M12 4 Q18 8 18 14 Q18 18 12 20 Q6 18 6 14 Q6 8 12 4" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="10" r="2" fill="currentColor"/></>,
    saxophone: <><path d="M10 5 L10 19 Q10 21 12 21 L14 21 Q16 21 16 19 L16 5" fill="currentColor"/><circle cx="12" cy="9" r="1.2" fill="white"/><circle cx="12" cy="14" r="1.2" fill="white"/></>,
    'single-staff-treble': <><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="0.8"/><text x="12" y="16" textAnchor="middle" fontSize="10" fontFamily="serif" fill="currentColor">𝄞</text></>,
    'single-staff-bass': <><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="0.8"/><text x="12" y="16" textAnchor="middle" fontSize="10" fontFamily="serif" fill="currentColor">𝄢</text></>
  };
  var icon = icons[instrument] || icons[instrument && instrument.startsWith && instrument.startsWith('ukulele') ? 'guitar' : null];
  var fallback = <circle cx="12" cy="12" r="6" fill="currentColor" />;
  return <svg viewBox="0 0 24 24" className="w-5 h-5">{typeof icon === 'string' ? icons[icon] : (icon || fallback)}</svg>;
}

// Akordide ikoon: Dm7
function ChordIcon() {
  return (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor" fontFamily="serif">Dm7</text>
    <ellipse cx="8" cy="10" rx="2.5" ry="2" fill="currentColor"/>
    <ellipse cx="16" cy="10" rx="2.5" ry="2" fill="currentColor"/>
  </svg>
  );
}

// FONT_OPTIONS, TEMPO_TERMS on faili alguses var'iga
const DEFAULT_SHORTCUT_PREFS = {
  // File / app actions
  'app.undo': { code: 'KeyZ', shift: false, alt: false, mod: true },
  'app.save': { code: 'KeyS', shift: false, alt: false, mod: true },
  'app.print': { code: 'KeyP', shift: false, alt: false, mod: true },
  'app.addMeasure': { code: 'KeyB', shift: false, alt: false, mod: true },
  'app.addSongBlock': { code: 'KeyN', shift: false, alt: true, mod: false },
  'app.deleteMeasure': { code: 'Backspace', shift: false, alt: false, mod: true },
  'app.zoomIn': { code: 'Equal', shift: false, alt: false, mod: true },
  'app.zoomOut': { code: 'Minus', shift: false, alt: false, mod: true },
  'app.noteInputToggle': { code: 'KeyN', shift: false, alt: false, mod: false },
  'app.lyricMode': { code: 'KeyL', shift: false, alt: false, mod: false },
  'app.lyricModeMod': { code: 'KeyL', shift: false, alt: false, mod: true },
  'app.cursorRowUpDownMod': { code: 'ArrowUp', shift: false, alt: false, mod: true },
  'app.cursorRowDownMod': { code: 'ArrowDown', shift: false, alt: false, mod: true },
  'app.staffCycleUpAlt': { code: 'ArrowUp', shift: false, alt: false, mod: false, tab: true },
  'app.staffCycleDownAlt': { code: 'ArrowDown', shift: false, alt: false, mod: false, tab: true },
  'app.measureStretchDown': { code: 'BracketLeft', shift: false, alt: true, mod: false },
  'app.measureStretchUp': { code: 'BracketRight', shift: false, alt: true, mod: false },
  'app.copy': { code: 'KeyC', shift: false, alt: false, mod: true },
  'app.paste': { code: 'KeyV', shift: false, alt: false, mod: true },
  'app.clipboardHistory': { code: 'KeyV', shift: true, alt: false, mod: true },
  // Toolbox actions
  'toolbox.rhythm': { code: 'Digit1', shift: true, alt: false, mod: false },
  'toolbox.timeSignature': { code: 'Digit2', shift: true, alt: false, mod: false },
  'toolbox.clefs': { code: 'Digit3', shift: true, alt: false, mod: false },
  'toolbox.keySignatures': { code: 'Digit4', shift: true, alt: false, mod: false },
  'toolbox.pitchInput': { code: 'Digit5', shift: true, alt: false, mod: false },
  'toolbox.notehead': { code: 'Digit6', shift: true, alt: false, mod: false },
  'toolbox.instruments': { code: 'Digit7', shift: true, alt: false, mod: false },
  'toolbox.repeatsJumps': { code: 'Digit8', shift: true, alt: false, mod: false },
  'toolbox.layout': { code: 'Digit9', shift: true, alt: false, mod: false },
  'toolbox.textBox': { code: 'KeyT', shift: true, alt: false, mod: false },
  'toolbox.pianoKeyboard': { code: 'Digit0', shift: true, alt: false, mod: false },
  'toolbox.chords': { code: 'KeyA', shift: false, alt: false, mod: true }, // Ctrl/Cmd + A
};

const SHORTCUT_ACTION_LABELS = {
  'app.undo': 'Undo',
  'app.save': 'Salvesta',
  'app.print': 'Prindi',
  'app.addMeasure': 'Lisa takt',
  'app.addSongBlock': 'Lisa noodistusplokk',
  'app.deleteMeasure': 'Kustuta takt(id)',
  'app.zoomIn': 'Suurenda vaadet',
  'app.zoomOut': 'Vähenda vaadet',
  'app.noteInputToggle': 'N-mode sisse/välja',
  'app.lyricMode': 'Laulusõna reziim (L)',
  'app.lyricModeMod': 'Laulusõna reziim (Ctrl/Cmd+L)',
  'app.cursorRowUpDownMod': 'Rida/partii üles (Ctrl/Cmd+Up)',
  'app.cursorRowDownMod': 'Rida/partii alla (Ctrl/Cmd+Down)',
  'app.staffCycleUpAlt': 'Aktiivne rida üles (Tab+↑)',
  'app.staffCycleDownAlt': 'Aktiivne rida alla (Tab+↓)',
  'app.measureStretchDown': 'Takti laius alla (Alt+[)',
  'app.measureStretchUp': 'Takti laius üles (Alt+])',
  'app.copy': 'Kopeeri',
  'app.paste': 'Kleebi',
  'app.clipboardHistory': 'Lopikelaua ajalugu',
};

function normalizeShortcutPref(pref) {
  if (!pref || typeof pref !== 'object') return null;
  const code = typeof pref.code === 'string' ? pref.code : null;
  if (!code) return null;
  return {
    code,
    shift: !!pref.shift,
    alt: !!pref.alt,
    mod: !!pref.mod,
    tab: !!pref.tab,
  };
}

function formatShortcutLabel(pref) {
  const p = normalizeShortcutPref(pref);
  if (!p) return '';
  const parts = [];
  if (p.mod) parts.push('Ctrl/Cmd');
  if (p.alt) parts.push('Alt');
  if (p.shift) parts.push('Shift');
  if (p.tab) parts.push('Tab');
  let key = p.code;
  if (key.startsWith('Digit')) key = key.replace('Digit', '');
  else if (key.startsWith('Key')) key = key.replace('Key', '');
  else if (key === 'BracketLeft') key = '[';
  else if (key === 'BracketRight') key = ']';
  else if (key === 'ArrowUp') key = '↑';
  else if (key === 'ArrowDown') key = '↓';
  else if (key === 'Backspace') key = 'Backspace';
  parts.push(key);
  return parts.join('+');
}

function shortcutKey(pref) {
  const p = normalizeShortcutPref(pref);
  if (!p) return '';
  return `${p.mod ? 1 : 0}${p.alt ? 1 : 0}${p.shift ? 1 : 0}${p.tab ? 1 : 0}:${p.code}`;
}

function eventToShortcutPref(e) {
  const code = e?.code;
  if (!code) return null;
  // Ignore pure modifiers
  if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'ControlLeft' || code === 'ControlRight' || code === 'MetaLeft' || code === 'MetaRight' || code === 'AltLeft' || code === 'AltRight') {
    return null;
  }
  return {
    code,
    shift: !!e.shiftKey,
    alt: !!e.altKey,
    mod: !!(e.ctrlKey || e.metaKey),
  };
}

function matchesShortcutPref(e, pref, matchCtx) {
  const p = normalizeShortcutPref(pref);
  if (!p || !e) return false;
  if (p.tab && !matchCtx?.tabHeld) return false;
  const modPressed = !!(e.ctrlKey || e.metaKey);
  return e.code === p.code
    && (!!e.shiftKey === !!p.shift)
    && (!!e.altKey === !!p.alt)
    && (modPressed === !!p.mod);
}

function getToolboxes(t, instrumentConfig, shortcutLabels = {}) {
  return {
    rhythm: {
      id: 'rhythm', name: t('toolbox.rhythm'), icon: 'Clock', shortcut: shortcutLabels['toolbox.rhythm'] || 'Shift+1',
      options: [
        { id: '1/32', label: t('note.thirtySecond'), value: '1/32', key: '2', code: 'Digit2' },
        { id: '1/16', label: t('note.sixteenth'), value: '1/16', key: '3', code: 'Digit3' },
        { id: '1/8', label: t('note.eighth'), value: '1/8', key: '4', code: 'Digit4' },
        { id: '1/4', label: t('note.quarter'), value: '1/4', key: '5', code: 'Digit5' },
        { id: '1/2', label: t('note.half'), value: '1/2', key: '6', code: 'Digit6' },
        { id: '1/1', label: t('note.whole'), value: '1/1', key: '7', code: 'Digit7' },
        { id: '2/8', label: t('note.pattern2eighth'), value: '2/8', key: null, code: null },
        { id: '2/8+2/8', label: t('note.patternTwoPlusTwoEighth'), value: '2/8+2/8', key: null, code: null },
        { id: '4/8', label: t('note.patternFourEighthOneBeam'), value: '4/8', key: null, code: null },
        { id: '4/16', label: t('note.pattern4sixteenth'), value: '4/16', key: null, code: null },
        { id: '8/16', label: t('note.pattern8sixteenth'), value: '8/16', key: null, code: null },
        { id: '1/8+2/16', label: t('note.patternEighthTwoSixteenth'), value: '1/8+2/16', key: null, code: null },
        { id: '2/16+1/8', label: t('note.patternTwoSixteenthEighth'), value: '2/16+1/8', key: null, code: null },
        { id: 'triplet-8', label: t('note.tripletEighth'), value: 'triplet-8', key: null, code: null },
        { id: 'triplet-4', label: t('note.tripletQuarter'), value: 'triplet-4', key: null, code: null },
        { id: 'beam-auto', label: t('note.beamAuto'), value: 'beam:auto', key: null, code: null },
        { id: 'beam-2-8', label: t('note.beamGroup2eighth'), value: 'beam:2/8', key: null, code: null },
        { id: 'beam-3-8', label: t('note.beamGroup3eighth'), value: 'beam:3/8', key: null, code: null },
        { id: 'beam-4-8', label: t('note.beamGroup4eighth'), value: 'beam:4/8', key: null, code: null },
        { id: 'beam-3-16', label: t('note.beamGroup3sixteenth'), value: 'beam:3/16', key: null, code: null },
        { id: 'rest', label: t('note.rest'), value: 'rest', key: '0', code: 'Digit0' },
        { id: 'dotted', label: t('note.dotted'), value: 'dotted', key: '.', code: 'Period' }
      ]
    },
    timeSignature: {
      id: 'timeSignature', name: t('toolbox.timeSignature'), icon: 'Hash', shortcut: shortcutLabels['toolbox.timeSignature'] || 'Shift+2',
      options: [
        { id: 'edit', label: t('timesig.edit'), value: 'edit', key: 'E' },
        { id: 'mode-toggle', label: t('timesig.modeToggle'), value: 'mode-toggle', key: 'M' },
        { id: '4/4', label: t('timesig.44'), value: [4, 4], key: '1' },
        { id: '3/4', label: t('timesig.34'), value: [3, 4], key: '2' },
        { id: '2/4', label: t('timesig.24'), value: [2, 4], key: '3' },
        { id: '6/8', label: t('timesig.68'), value: [6, 8], key: '4' },
        { id: '5/4', label: t('timesig.54'), value: [5, 4], key: '5' },
        { id: '7/8', label: t('timesig.78'), value: [7, 8], key: '6' },
        { id: '12/8', label: t('timesig.128'), value: [12, 8], key: '7' }
      ]
    },
    clefs: {
      id: 'clefs', name: t('toolbox.clefs'), icon: 'Type', shortcut: shortcutLabels['toolbox.clefs'] || 'Shift+3',
      options: [
        { id: 'jo', label: t('clef.jo'), value: 'jo', key: '0' },
        { id: 'treble', label: t('clef.treble'), value: 'treble', key: '1' },
        { id: 'bass', label: t('clef.bass'), value: 'bass', key: '2' },
        { id: 'alto', label: t('clef.alto'), value: 'alto', key: '3' }
      ]
    },
    keySignatures: {
      id: 'keySignatures', name: t('toolbox.keySignatures'), icon: 'Key', shortcut: shortcutLabels['toolbox.keySignatures'] || 'Shift+4',
      options: [
        { id: 'key-C', label: t('key.C'), value: 'C', key: '1' },
        { id: 'key-G', label: t('key.G'), value: 'G', key: '2' },
        { id: 'key-D', label: t('key.D'), value: 'D', key: '3' },
        { id: 'key-A', label: t('key.A'), value: 'A', key: '4' },
        { id: 'key-E', label: t('key.E'), value: 'E', key: '5' },
        { id: 'key-B', label: t('key.B'), value: 'B', key: '6' },
        { id: 'key-F', label: t('key.F'), value: 'F', key: '7' },
        { id: 'key-Bb', label: t('key.Bb'), value: 'Bb', key: '8' },
        { id: 'key-Eb', label: t('key.Eb'), value: 'Eb', key: '9' }
      ]
    },
    transpose: {
      id: 'transpose', name: t('toolbox.transpose'), icon: 'ArrowUpDown', shortcut: shortcutLabels['toolbox.transpose'] || 'Shift+9',
      options: [
        { id: 'transpose-C', label: t('key.C'), value: 'C', key: '1' },
        { id: 'transpose-G', label: t('key.G'), value: 'G', key: '2' },
        { id: 'transpose-D', label: t('key.D'), value: 'D', key: '3' },
        { id: 'transpose-A', label: t('key.A'), value: 'A', key: '4' },
        { id: 'transpose-E', label: t('key.E'), value: 'E', key: '5' },
        { id: 'transpose-B', label: t('key.B'), value: 'B', key: '6' },
        { id: 'transpose-F', label: t('key.F'), value: 'F', key: '7' },
        { id: 'transpose-Bb', label: t('key.Bb'), value: 'Bb', key: '8' },
        { id: 'transpose-Eb', label: t('key.Eb'), value: 'Eb', key: '9' }
      ]
    },
    pitchInput: {
      id: 'pitchInput', name: t('toolbox.pitchInput'), icon: 'Piano', shortcut: shortcutLabels['toolbox.pitchInput'] || 'Shift+5',
      options: [
        { id: 'c', label: 'C', value: 'C', key: 'C' },
        { id: 'd', label: 'D', value: 'D', key: 'D' },
        { id: 'e', label: 'E', value: 'E', key: 'E' },
        { id: 'f', label: 'F', value: 'F', key: 'F' },
        { id: 'g', label: 'G', value: 'G', key: 'G' },
        { id: 'a', label: 'A', value: 'A', key: 'A' },
        { id: 'b', label: 'B', value: 'B', key: 'B' }
      ]
    },
    pianoKeyboard: {
      id: 'pianoKeyboard', name: t('toolbox.pianoKeyboard'), icon: 'Piano', shortcut: shortcutLabels['toolbox.pianoKeyboard'] || 'Shift+0',
      options: []
    },
    notehead: {
      id: 'notehead', name: t('toolbox.notehead'), icon: 'Palette', shortcut: shortcutLabels['toolbox.notehead'] || 'Shift+6',
      options: [
        { id: 'shape-oval', label: t('notehead.shapeOval'), value: 'shape:oval', key: null },
        { id: 'shape-x', label: t('notehead.shapeX'), value: 'shape:x', key: null },
        { id: 'shape-square', label: t('notehead.shapeSquare'), value: 'shape:square', key: null },
        { id: 'shape-triangle', label: t('notehead.shapeTriangle'), value: 'shape:triangle', key: null },
        { id: 'shape-emoji', label: t('notehead.shapeEmoji'), value: 'shape:emoji', key: null }
      ]
    },
    instruments: {
      id: 'instruments', name: t('toolbox.instruments'), icon: 'Music2', shortcut: shortcutLabels['toolbox.instruments'] || 'Shift+7',
      options: (() => {
        const opts = [];
        let keyNum = 0;
        INSTRUMENT_CATEGORIES.forEach((cat) => {
          opts.push({ type: 'category', id: cat.id, label: t(cat.labelKey) });
          cat.instruments.forEach((instId) => {
            const cfg = instrumentConfig[instId];
            if (cfg) {
              keyNum++;
              opts.push({
                type: 'option',
                id: instId,
                label: cfg.label,
                value: cfg.value,
                key: String((keyNum % 10) || 10),
                range: cfg.range,
                ...cfg
              });
            }
          });
        });
        return opts;
      })()
    },
    repeatsJumps: {
      id: 'repeatsJumps', name: t('toolbox.repeatsJumps'), icon: 'Repeat', shortcut: shortcutLabels['toolbox.repeatsJumps'] || 'Shift+8',
      options: [
        { type: 'category', id: 'repeat-cat', label: t('repeat.categoryRepeats') || 'Kordused' },
        { type: 'option', id: 'repeat-start', label: t('repeat.start'), value: 'repeatStart', key: '1' },
        { type: 'option', id: 'repeat-end', label: t('repeat.end'), value: 'repeatEnd', key: '2' },
        { type: 'option', id: 'volta-1', label: t('repeat.volta1'), value: 'volta1', key: '3' },
        { type: 'option', id: 'volta-2', label: t('repeat.volta2'), value: 'volta2', key: '4' },
        { type: 'category', id: 'jump-cat', label: t('repeat.categoryJumps') || 'Hüpped' },
        { type: 'option', id: 'segno', label: t('repeat.segno'), value: 'segno', key: '5' },
        { type: 'option', id: 'coda', label: t('repeat.coda'), value: 'coda', key: '6' },
        { type: 'category', id: 'barline-cat', label: t('repeat.categoryBarlines') || 'Taktijooned' },
        { type: 'option', id: 'barline-final', label: t('repeat.barlineFinal'), value: 'barlineFinal', key: '7' }
      ]
    },
    layout: {
      id: 'layout', name: t('toolbox.layout'), icon: 'Layout', shortcut: shortcutLabels['toolbox.layout'] || 'Shift+9',
      options: [
        { id: 'spacing-normal', label: t('layout.spacingNormal'), value: 85, key: '1' },
        { id: 'spacing-loose', label: t('layout.spacingLoose'), value: 120, key: '2' }
      ]
    },
    textBox: {
      id: 'textBox', name: t('toolbox.textBox'), icon: 'Type', shortcut: shortcutLabels['toolbox.textBox'] || 'Shift+T',
      options: [
        { id: 'textBox-free', label: t('textBox.freeText'), value: 'free', key: 'T' },
        ...TEMPO_TERMS.map((term, i) => ({
          id: `tempo-${term.id}`,
          label: t(term.key),
          value: term.id,
          key: String(i + 1),
          bpm: term.bpm
        }))
      ]
    },
    chords: {
      id: 'chords', name: t('toolbox.chords'), icon: 'Music2', shortcut: shortcutLabels['toolbox.chords'] || 'Ctrl/Cmd+A',
      options: [
        { id: 'chord-C', label: 'C', value: 'C' },
        { id: 'chord-D', label: 'D', value: 'D' },
        { id: 'chord-Dm', label: 'Dm', value: 'Dm' },
        { id: 'chord-E', label: 'E', value: 'E' },
        { id: 'chord-Em', label: 'Em', value: 'Em' },
        { id: 'chord-F', label: 'F', value: 'F' },
        { id: 'chord-G', label: 'G', value: 'G' },
        { id: 'chord-Am', label: 'Am', value: 'Am' },
        { id: 'chord-Bdim', label: 'Bdim', value: 'Bdim' },
        { id: 'chord-C7', label: 'C7', value: 'C7' },
        { id: 'chord-G7', label: 'G7', value: 'G7' },
        { id: 'chord-Fmaj7', label: 'Fmaj7', value: 'Fmaj7' },
        { id: 'chord-Am7', label: 'Am7', value: 'Am7' },
        { id: 'chord-custom', label: t('chords.custom'), value: 'custom' }
      ]
    }
  };
}

/** Teksti värv kujundi sees: valge, välja arvatud A (kollane) ja E (hall) – must loetavuse jaoks */
function getFigurenoteTextColor(pitch) {
  return (pitch === 'A' || pitch === 'E') ? '#000000' : '#ffffff';
}

// MIDI ↔ note string ilma react-piano sõltuvuseta (C4 = 60).
var MIDI_PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Standardse 88-klahvilise klaveri MIDI ulatus: A0 = 21, C8 = 108 */
var PIANO_MIDI_MIN = 21;
var PIANO_MIDI_MAX = 108;
function noteStringToMidi(str) {
  const m = String(str).trim().toLowerCase().match(/^([a-g])(#|b)?(\d+)$/);
  if (!m) return 60;
  const pitchIndex = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]];
  const octave = parseInt(m[3], 10);
  const semi = pitchIndex + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (octave + 1) * 12 + ((semi % 12) + 12) % 12;
}
/** MIDI number → lühike nimetus (nt "C3", "F#4") vahemiku kuvamiseks */
function midiToRangeLabel(midi) {
  const n = Number(midi);
  if (!Number.isFinite(n) || n < 0 || n > 127) return 'C4';
  return MIDI_PITCH_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}
function getMidiAttributes(midiNumber) {
  const n = Number(midiNumber);
  if (!Number.isFinite(n) || n < 0 || n > 127) return { pitchName: 'C', octave: 4, isAccidental: false };
  const octave = Math.floor(n / 12) - 1;
  const pitchName = MIDI_PITCH_NAMES[n % 12];
  const isAccidental = [1, 3, 6, 8, 10].includes(n % 12);
  return { pitchName, octave, isAccidental };
}
// PITCH_NAME_TO_NATURAL on faili alguses var'iga
function midiToPitchOctave(midiNumber) {
  const attrs = getMidiAttributes(midiNumber);
  const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
  return { pitch: naturalPitch, octave: attrs.octave, isAccidental: attrs.isAccidental };
}
/** MIDI number → noodivorm (pitch, octave, accidental) transponeerimise tulemuse jaoks */
function midiToNoteWithAccidental(midiNumber) {
  const attrs = getMidiAttributes(midiNumber);
  const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
  const accidental = attrs.pitchName && attrs.pitchName.includes('#') ? 1 : attrs.pitchName && attrs.pitchName.includes('b') ? -1 : 0;
  return { pitch: naturalPitch, octave: attrs.octave, accidental };
}

/** Musta klahvi alteratsioon helistiku järgi: bemolli-helistikud (F, Bb, Eb) → ♭ (-1), muud → ♯ (1). Valge klahv → 0. */
function getAccidentalForPianoKey(midiNumber, keySignature) {
  const attrs = getMidiAttributes(midiNumber);
  if (!attrs.isAccidental) return 0;
  const useFlat = keySignature === 'F' || keySignature === 'Bb' || keySignature === 'Eb';
  return useFlat ? -1 : 1;
}

function resolveSpellingForMidiInKey(midiNumber, keySignature = 'C') {
  const n = Number(midiNumber);
  if (!Number.isFinite(n) || n < 0 || n > 127) return null;
  const midiPc = ((n % 12) + 12) % 12;
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const pitchClass = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const candidates = [null, 0, 1, -1];
  let best = null;
  for (const letter of letters) {
    const keyAcc = getAccidentalForPitchInKey(letter, keySignature);
    for (const explicitAcc of candidates) {
      const effAcc = explicitAcc == null ? keyAcc : explicitAcc;
      const pc = ((pitchClass[letter] + effAcc) % 12 + 12) % 12;
      if (pc !== midiPc) continue;
      const octave = Math.floor((n - pc) / 12) - 1;
      if (!Number.isFinite(octave)) continue;
      const isImplicit = explicitAcc == null;
      const needsNatural = explicitAcc === 0 && keyAcc !== 0;
      const score =
        (isImplicit ? 0 : needsNatural ? 1 : 2) * 10 +
        (letter === 'F' || letter === 'C' ? 0 : 1);
      if (!best || score < best.score) best = { pitch: letter, octave, accidental: explicitAcc, score };
    }
  }
  return best;
}
// FINGERING_TIN_WHISTLE, FINGERING_RECORDER on faili alguses var'iga

/** Lingitud iirivile SVG (A-variant): 50% = vana 200%; igal +5% sammul suureneb diagramm veel. */
function tinWhistleFingeringUiPercentToScale(uiPercent) {
  const p = typeof uiPercent === 'number' && Number.isFinite(uiPercent) ? uiPercent : 50;
  const s = p / 25;
  return Math.max(2, Math.min(20, s));
}

/** Laadimine: uus võti `tinWhistleLinkedFingeringUiPercent`; vana lineaarne % migreeritakse nii, et vana 200% = uus 50%. */
function readTinWhistleFingeringUiPercentFromPersisted(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.tinWhistleLinkedFingeringUiPercent != null) {
    const p = Number(data.tinWhistleLinkedFingeringUiPercent);
    if (!Number.isFinite(p)) return null;
    return Math.round(Math.max(50, Math.min(500, p)));
  }
  if (data.tinWhistleLinkedFingeringScalePercent != null) {
    const pOld = Number(data.tinWhistleLinkedFingeringScalePercent);
    if (!Number.isFinite(pOld)) return null;
    return Math.round(Math.max(50, Math.min(500, 250 - pOld)));
  }
  return null;
}

const CURSOR_SELECTION_NONE = Object.freeze({ kind: 'none' });

function normalizeSelectionModel(model) {
  if (!model || typeof model !== 'object') return CURSOR_SELECTION_NONE;
  if (model.kind === 'note' && Number.isInteger(model.index) && model.index >= 0) return model;
  if (model.kind === 'range' && Number.isInteger(model.anchorIndex) && Number.isInteger(model.focusIndex)) return model;
  if (model.kind === 'measureRange' && Number.isInteger(model.anchorMeasure) && Number.isInteger(model.focusMeasure)) return model;
  return CURSOR_SELECTION_NONE;
}

function selectionToLegacy(selection) {
  const model = normalizeSelectionModel(selection);
  if (model.kind === 'note') {
    return { selectedNoteIndex: model.index, selectionStart: -1, selectionEnd: -1, measureSelection: null };
  }
  if (model.kind === 'range') {
    return {
      selectedNoteIndex: model.focusIndex,
      selectionStart: Math.min(model.anchorIndex, model.focusIndex),
      selectionEnd: Math.max(model.anchorIndex, model.focusIndex),
      measureSelection: null,
    };
  }
  if (model.kind === 'measureRange') {
    return {
      selectedNoteIndex: -1,
      selectionStart: -1,
      selectionEnd: -1,
      measureSelection: {
        start: Math.min(model.anchorMeasure, model.focusMeasure),
        end: Math.max(model.anchorMeasure, model.focusMeasure),
      },
    };
  }
  return { selectedNoteIndex: -1, selectionStart: -1, selectionEnd: -1, measureSelection: null };
}

function legacyToSelection({ selectedNoteIndex, selectionStart, selectionEnd, measureSelection }) {
  if (measureSelection && Number.isInteger(measureSelection.start) && Number.isInteger(measureSelection.end)) {
    return { kind: 'measureRange', anchorMeasure: measureSelection.start, focusMeasure: measureSelection.end };
  }
  if (Number.isInteger(selectionStart) && Number.isInteger(selectionEnd) && selectionStart >= 0 && selectionEnd >= 0) {
    return { kind: 'range', anchorIndex: selectionStart, focusIndex: selectionEnd };
  }
  if (Number.isInteger(selectedNoteIndex) && selectedNoteIndex >= 0) {
    return { kind: 'note', index: selectedNoteIndex };
  }
  return CURSOR_SELECTION_NONE;
}

function cursorSelectionReducer(state, action) {
  switch (action?.type) {
    case 'syncFromLegacy':
      return normalizeSelectionModel(action.selection);
    case 'clear':
      return CURSOR_SELECTION_NONE;
    case 'clickNote':
      return Number.isInteger(action.index) && action.index >= 0 ? { kind: 'note', index: action.index } : CURSOR_SELECTION_NONE;
    case 'startRangeDrag':
      return Number.isInteger(action.index) && action.index >= 0 ? { kind: 'range', anchorIndex: action.index, focusIndex: action.index } : state;
    case 'extendRangeDrag':
      if (state.kind !== 'range') return state;
      if (!Number.isInteger(action.index) || action.index < 0) return state;
      return { ...state, focusIndex: action.index };
    case 'setNoteRange':
      if (!Number.isInteger(action.anchorIndex) || !Number.isInteger(action.focusIndex)) return state;
      return { kind: 'range', anchorIndex: action.anchorIndex, focusIndex: action.focusIndex };
    case 'setMeasureRange':
      if (!Number.isInteger(action.anchorMeasure) || !Number.isInteger(action.focusMeasure)) return state;
      return { kind: 'measureRange', anchorMeasure: action.anchorMeasure, focusMeasure: action.focusMeasure };
    default:
      return state;
  }
}

function NoodiMeisterCore({ icons, demoVisibility = false }) {
  // Ära nõua EMOJIS välja olemasolu — vanad embed'id / tühi window.NOODIMEISTER_CONFIG ei tohi kogu rakendust nullida.
  if (typeof GLOBAL_NOTATION_CONFIG === 'undefined' || !GLOBAL_NOTATION_CONFIG) return null;

  // Kaitse renderdamist: sisselogimise järel anna brauserile 50ms, et konstandid mällu laadida (Safe Initialization)
  const [isReady, setIsReady] = useState(false);
  const [locale, setLocale] = useState(() => {
    try {
      return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch (_) { /* ignore */ }
  }, [locale]);

  useEffect(() => {
    if (typeof GLOBAL_NOTATION_CONFIG === 'undefined' || !GLOBAL_NOTATION_CONFIG) return;
    const t = setTimeout(() => {
      setIsReady(true);
      if (typeof window !== 'undefined') window.NOODIMEISTER_APP_READY = true;
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const t = useMemo(() => createT(locale), [locale]);
  const instrumentConfig = useMemo(() => getInstrumentConfig(t), [t]);
  const notationCtx = useNotationOptional();

  const [shortcutPrefs, setShortcutPrefs] = useState(() => {
    try { return authStorage.getShortcutPrefs ? authStorage.getShortcutPrefs() : {}; } catch { return {}; }
  });
  const effectiveShortcutPrefs = useMemo(() => {
    const merged = { ...DEFAULT_SHORTCUT_PREFS, ...(shortcutPrefs || {}) };
    Object.keys(merged).forEach((k) => {
      const n = normalizeShortcutPref(merged[k]);
      if (!n) delete merged[k]; else merged[k] = n;
    });
    return merged;
  }, [shortcutPrefs]);
  const shortcutLabels = useMemo(() => {
    const out = {};
    Object.keys(DEFAULT_SHORTCUT_PREFS).forEach((k) => {
      out[k] = formatShortcutLabel(effectiveShortcutPrefs[k] || DEFAULT_SHORTCUT_PREFS[k]);
    });
    return out;
  }, [effectiveShortcutPrefs]);
  const toolboxShortcutToId = useMemo(() => {
    const map = Object.create(null);
    const pairs = [
      ['toolbox.rhythm', 'rhythm'], ['toolbox.timeSignature', 'timeSignature'], ['toolbox.clefs', 'clefs'],
      ['toolbox.keySignatures', 'keySignatures'], ['toolbox.pitchInput', 'pitchInput'], ['toolbox.notehead', 'notehead'],
      ['toolbox.instruments', 'instruments'], ['toolbox.repeatsJumps', 'repeatsJumps'], ['toolbox.layout', 'layout'],
      ['toolbox.textBox', 'textBox'], ['toolbox.pianoKeyboard', 'pianoKeyboard'], ['toolbox.chords', 'chords'],
    ];
    pairs.forEach(([actionKey, toolboxId]) => {
      const pref = effectiveShortcutPrefs[actionKey];
      const key = shortcutKey(pref);
      if (key) map[key] = toolboxId;
    });
    return map;
  }, [effectiveShortcutPrefs]);

  const toolboxes = useMemo(() => getToolboxes(t, instrumentConfig, shortcutLabels), [t, instrumentConfig, shortcutLabels]);

  const store = useNoodimeisterOptional();
  const [searchParamsForAccess] = useSearchParams();
  const hasFullAccess = (store?.hasFullAccess ?? authStorage.isLoggedIn()) || !!(searchParamsForAccess && typeof searchParamsForAccess.get === 'function' && searchParamsForAccess.get('fileId'));
  const isMacPlatform = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const platform = String(navigator.platform || '').toUpperCase();
    return platform.includes('MAC');
  }, []);
  const addMeasureShortcutLabel = useMemo(
    () => formatShortcutLabel(effectiveShortcutPrefs['app.addMeasure']) || (isMacPlatform ? 'Cmd+B' : 'Ctrl+B'),
    [effectiveShortcutPrefs, isMacPlatform]
  );
  const addSongBlockShortcutLabel = useMemo(
    () => formatShortcutLabel(effectiveShortcutPrefs['app.addSongBlock']) || 'Alt+N',
    [effectiveShortcutPrefs]
  );

  // JO-võti ja noodigraafika state (GLOBAL_NOTATION_CONFIG on faili alguses)
  const [joClefFocused, setJoClefFocused] = useState(false);
  const [joClefStaffPosition, setJoClefStaffPosition] = useState(DEFAULT_JO_CLEF_STAFF_POSITION);

  // Core state
  const [notationMode, setNotationMode] = useState('traditional');
  const [noteheadShape, setNoteheadShape] = useState('oval'); // 'oval' | 'x' | 'square' | 'triangle' | 'emoji'
  const [noteheadEmoji, setNoteheadEmoji] = useState('♪'); // used when noteheadShape === 'emoji'
  // Kas projekt on loodud pedagoogilise notatsiooni viisardiga (JO-võti, TAB/sõrmitsus, animatsioon jm)?
  const [isPedagogicalProject, setIsPedagogicalProject] = useState(false);
  const [noteInputMode, setNoteInputMode] = useState(false); // default SEL (selection) mode; N = note input
  /** Cursor tool: 'select' = pointer, select notes; 'hand' = grab, pan/drag layout; 'type' = click note to edit lyrics */
  const [cursorTool, setCursorTool] = useState('select');
  const cursorToolRef = useRef(cursorTool);
  cursorToolRef.current = cursorTool;
  const [selectedDuration, setSelectedDuration] = useState('1/4');
  // Tuplet mode: null = normal; { type: 3|5|6|7, inSpaceOf: 2|4 } – triool 3 in 2, kvintool 5 in 4, jne. Aktiveeritakse Cmd/Ctrl+3,5,6,7
  const [tupletMode, setTupletMode] = useState(null);
  const [timeSignature, setTimeSignature] = useState({ beats: 4, beatUnit: 4 });
  const [pixelsPerBeat, setPixelsPerBeat] = useState(85); // laius löögi kohta (px), vaikimisi 85 (vastab noodigraafika vaikimisi suurusele)
  // Cursor time model: cursorPosition is absolute beat/time anchor; selectedDuration is separate input rhythm.
  const [cursorPosition, setCursorPosition] = useState(3);
  /** Cursor row: 0 = melody/top (noodirida), 1 = chord/bottom (akordirida või lugeri rida). Cmd/Ctrl+↑/↓ vahetab; partituuris sama loogika partii vahetamiseks. */
  const [cursorSubRow, setCursorSubRow] = useState(0);
  const [keySignature, setKeySignature] = useState('C');
  const [staffLines, setStaffLines] = useState(5);
  const [notationStyle, setNotationStyle] = useState('TRADITIONAL'); // 'TRADITIONAL' | 'FIGURENOTES' – staff vs grid
  const [instrumentNotationVariant, setInstrumentNotationVariant] = useState('standard'); // 'standard' | 'tab' | 'fingering'
  const [isRest, setIsRest] = useState(false);
  const [isDotted, setIsDotted] = useState(false);
  const [ghostPitch, setGhostPitch] = useState('C');
  const [ghostOctave, setGhostOctave] = useState(4);
  const [ghostAccidental, setGhostAccidental] = useState(0); // 0 = natural, 1 = sharp, -1 = flat (for next note / display)
  /** When false, next traditional insert uses key signature for pitch class (ghost 0 does not force ♮). Alt+arrows set true. */
  const [ghostAccidentalIsExplicit, setGhostAccidentalIsExplicit] = useState(false);
  // Mouse-based insert draft: first click "picks up" a note, second click "drops" it to chosen beat-box.
  // Only used in Figurenotes beat-grid when pitch-input toolbox is active.
  const [mouseInsertDraft, setMouseInsertDraft] = useState(null); // { startBeat, currentBeat, pitch, octave, durationLabel }
  const [activeToolbox, setActiveToolbox] = useState(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  /** Helistikute tööriistakast: täielik ruudustik lahtis / kokku pandud (vähem vertikaalset ruumi). */
  const [keySignaturesListExpanded, setKeySignaturesListExpanded] = useState(true);
  useEffect(() => {
    if (activeToolbox !== 'keySignatures') return;
    const opts = toolboxes.keySignatures?.options;
    if (!opts?.length) return;
    const kIdx = opts.findIndex((o) => o.value === keySignature);
    if (kIdx >= 0) setSelectedOptionIndex(kIdx);
  }, [activeToolbox, keySignature, toolboxes]);
  const [scoreDragOver, setScoreDragOver] = useState(false);
  // Nähtavad tööriistad: millised tööriistakastid on külgribas nähtavad (seotud notatsiooni sisestusmeetodiga)
  const [visibleToolIds, setVisibleToolIds] = useState(() => TOOLBOX_ORDER.slice());
  const [visibleToolsMenuOpen, setVisibleToolsMenuOpen] = useState(false);
  const [toolboxPaletteVisible, setToolboxPaletteVisible] = useState(() => {
    try { return localStorage.getItem('noodimeister-toolbox-palette-visible') !== 'false'; } catch (_) { return true; }
  });
  const setToolboxPaletteVisiblePersist = useCallback((v) => {
    setToolboxPaletteVisible(v);
    try { localStorage.setItem('noodimeister-toolbox-palette-visible', v ? 'true' : 'false'); } catch (_) {}
  }, []);
  const visibleToolsMenuRef = useRef(null);
  const [pianoStripWidth, setPianoStripWidth] = useState(900);
  const pianoStripWrapperRef = useRef(null); // klaviatuuri wrapper – laius mõõdetakse ResizeObserveriga
  const [pianoRangeNumbers, setPianoRangeNumbers] = useState({ first: 48, last: 72 }); // klaviatuuri vahemik MIDI (first, last); piirang 21–108
  const [pianoStripVisible, setPianoStripVisible] = useState(false); // klaviatuuri riba all – nähtav ka siis, kui avatud on Rütm vms
  const N_MODE_PRIMARY_TOOL_IDS = useMemo(() => ['rhythm', 'pitchInput', 'pianoKeyboard', 'chords'], []);
  const PIANO_RANGE_PRESETS = useMemo(() => [
    { id: 'C3-C5', label: 'C3-C5', first: 48, last: 72 },
    { id: 'C2-C5', label: 'C2-C5', first: 36, last: 72 },
    { id: 'C1-C5', label: 'C1-C5', first: 24, last: 72 },
    { id: 'C1-C7', label: 'C1-C7', first: 24, last: 96 },
  ], []);

  // Kiirklahvid: Alt + Nool paremale/vasakule nihutavad klaviatuuri vahemikku ühe oktavi võrra (88-klahvi piirides)
  useEffect(() => {
    if (!pianoStripVisible) return;
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toUpperCase?.();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!e.altKey || e.repeat) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPianoRangeNumbers((prev) => {
          const span = prev.last - prev.first + 1;
          const newFirst = Math.min(prev.first + 12, PIANO_MIDI_MAX - span + 1);
          const newLast = newFirst + span - 1;
          if (newFirst === prev.first) return prev;
          return { first: Math.max(PIANO_MIDI_MIN, newFirst), last: Math.min(PIANO_MIDI_MAX, newLast) };
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPianoRangeNumbers((prev) => {
          const span = prev.last - prev.first + 1;
          const newLast = Math.max(prev.last - 12, PIANO_MIDI_MIN + span - 1);
          const newFirst = newLast - span + 1;
          if (newLast === prev.last) return prev;
          return { first: Math.max(PIANO_MIDI_MIN, newFirst), last: Math.min(PIANO_MIDI_MAX, newLast) };
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pianoStripVisible]);

  // Stage V: Time signature display mode
  const [timeSignatureMode, setTimeSignatureMode] = useState('pedagogical'); // 'classic' or 'pedagogical'
  const [timeSignatureEditField, setTimeSignatureEditField] = useState('numerator'); // 'numerator' or 'denominator'
  const [timeSignatureSize, setTimeSignatureSize] = useState(36); // Time signature font size in figurenotation (12–200), one value per project
  const [pedagogicalTimeSigDenominatorType, setPedagogicalTimeSigDenominatorType] = useState('rhythm'); // 'number' | 'rhythm' | 'instrument' | 'emoji'
  const [pedagogicalTimeSigDenominatorColor, setPedagogicalTimeSigDenominatorColor] = useState('#1a1a1a');
  const [pedagogicalTimeSigDenominatorInstrument, setPedagogicalTimeSigDenominatorInstrument] = useState('handbell'); // handbell | boomwhacker | triangle
  const [pedagogicalTimeSigDenominatorEmoji, setPedagogicalTimeSigDenominatorEmoji] = useState('🥁');

  // Stage V: Selection and editing state
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1);
  const [selectionStart, setSelectionStart] = useState(-1);
  const [selectionEnd, setSelectionEnd] = useState(-1);
  /** SEL: Shift+nool laiendab taktivalikut; Cmd+Backspace kustutab valitud taktid. */
  const [measureSelection, setMeasureSelection] = useState(null); // { start: number, end: number } | null
  const [cursorSelection, dispatchCursorSelection] = useReducer(
    cursorSelectionReducer,
    CURSOR_SELECTION_NONE
  );
  const cursorSelectionRef = useRef(cursorSelection);
  cursorSelectionRef.current = cursorSelection;
  const measureSelectionRef = useRef(null);
  measureSelectionRef.current = measureSelection;
  const deleteMeasuresRangeRef = useRef(() => false);
  const [clipboard, setClipboard] = useState([]);
  const [clipboardHistory, setClipboardHistory] = useState([]); // [{ id, notes, createdAt }]
  const [clipboardHistoryOpen, setClipboardHistoryOpen] = useState(false);
  const [scoreContextMenu, setScoreContextMenu] = useState(null); // { x, y, canCopy, canPaste }
  // Laulusõna ahelrežiim: valitud noodist alates järjest silbitamine; "-" lisab tühiku ja liigub järgmise noodi alla
  const [lyricChainStart, setLyricChainStart] = useState(-1);
  const [lyricChainEnd, setLyricChainEnd] = useState(-1);
  const [lyricChainIndex, setLyricChainIndex] = useState(null); // null = tavarežiim (näita valitud noodi laulusõna)
  /** Which lyric line is being edited: 0 = first (lyric), 1 = second (lyric2). Ctrl+L starts from selected note for current line. */
  const [lyricLineIndex, setLyricLineIndex] = useState(0);
  /** Vertical offset (px) for lyrics line – drag or adjust to move lyrics up/down. */
  const [lyricLineYOffset, setLyricLineYOffset] = useState(0);
  const lyricInputRef = useRef(null);
  /** Viimase figuurnotatsiooni löögikliku beat + aeg, et Cmd+L kasutaks õiget nooti enne Reacti state uuendust. */
  const lastBeatClickForLyricRef = useRef({ beat: null, at: 0 });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const saveToHistoryRef = useRef(null);

  // Rütmi viimane väärtus (ref), et kohe pärast rütmi valimist lisatud noot kasutaks uut rütmi
  const lastDurationRef = useRef(selectedDuration);
  // Pausi sisestus: 0 + rütmiklahv (2–7) → paus vastava vältusega
  const restNextRef = useRef(false);
  /** Taktiruudustiku lõpp (beatides); uuendatakse pärast maxCursorAllowed — setInstrument loeb ref’i (defineeritud enne arvutust). */
  const restPaddingGridEndBeatRef = useRef(0);
  /** N-režiimis: Tab hoos enne noole vajutust — noodirea vahetus Tab+↑/↓ jaoks. */
  const tabStaffCycleHeldRef = useRef(false);
  useEffect(() => {
    lastDurationRef.current = selectedDuration;
  }, [selectedDuration]);

  // N-režiim (noodisisestus): ref, et figuurenotatsiooni löögiklikk ei lisaks nooti, kui kasutaja on SEL-režiimis
  const noteInputModeRef = useRef(noteInputMode);
  // Väldi "kleepuva klahvi" kõrvaltoimet vahetult N -> SEL lülitusel.
  const suppressSelEditUntilRef = useRef(0);
  // Mouse-insert must also be readable in keyboard handler.
  const mouseInsertDraftRef = useRef(mouseInsertDraft);
  useEffect(() => {
    noteInputModeRef.current = noteInputMode;
  }, [noteInputMode]);
  useEffect(() => {
    mouseInsertDraftRef.current = mouseInsertDraft;
  }, [mouseInsertDraft]);

  // Kui valik muutub, lõpeta laulusõna ahelrežiim (välja väärtus vastab taas valitud noodi(de) laulusõnale)
  useEffect(() => {
    setLyricChainIndex(null);
  }, [selectedNoteIndex, selectionStart, selectionEnd, measureSelection]);

  // Domain selection model is synchronized from legacy state so old branches stay compatible during migration.
  useEffect(() => {
    dispatchCursorSelection({
      type: 'syncFromLegacy',
      selection: legacyToSelection({ selectedNoteIndex, selectionStart, selectionEnd, measureSelection }),
    });
  }, [selectedNoteIndex, selectionStart, selectionEnd, measureSelection]);
  const applySelectionModel = useCallback((nextSelection) => {
    const normalized = normalizeSelectionModel(nextSelection);
    dispatchCursorSelection({ type: 'syncFromLegacy', selection: normalized });
    const legacy = selectionToLegacy(normalized);
    setSelectedNoteIndex(legacy.selectedNoteIndex);
    setSelectionStart(legacy.selectionStart);
    setSelectionEnd(legacy.selectionEnd);
    setMeasureSelection(legacy.measureSelection);
  }, []);

  // Paigutus: lehekülje suund, taktide arv rea kohta (0 = automaatne), käsitsi rea- ja lehevahetused
  const [pageOrientation, setPageOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  /** Paper size for print and PDF: A4, A3, or A5. Page setup determines printable view. */
  const [paperSize, setPaperSize] = useState('a4'); // 'a4' | 'a3' | 'a5'
  const [layoutMeasuresPerLine, setLayoutMeasuresPerLine] = useState(4);
  const [layoutLineBreakBefore, setLayoutLineBreakBefore] = useState([]);
  const [measureStretchFactors, setMeasureStretchFactors] = useState([]);
  const [systemYOffsets, setSystemYOffsets] = useState([]);
  const [layoutPageBreakBefore, setLayoutPageBreakBefore] = useState([]);
  /** Extra blank pages appended after the last content page (does not change measure layout). */
  const [layoutExtraPages, setLayoutExtraPages] = useState(0);
  const [layoutSystemGap, setLayoutSystemGap] = useState(15); // noodiridade vahe / staff lines gap (px) – vahe süsteemide vahel
  const [layoutPartsGap, setLayoutPartsGap] = useState(20); // instrumentide vahe / parts gap (px) – vahe kahe partii vahel
  const [layoutPartsGapMm, setLayoutPartsGapMm] = useState(13); // traditsioonivaates: alumine joon -> järgmise rea ülemine joon (mm)
  const [layoutSizeUnit, setLayoutSizeUnit] = useState('mm'); // 'mm' | 'cm' (layout controls display unit)
  const [layoutConnectedBarlines, setLayoutConnectedBarlines] = useState(true); // ühendatud taktijooned partituuris
  const [layoutGlobalSpacingMultiplier, setLayoutGlobalSpacingMultiplier] = useState(1.0); // takti laius / noodigraafika tihedus (0.5–2)
  // Vaade: partituur vs instrumendi part – instrumendi paigutus on sõltumatu partituurist
  const [viewMode, setViewMode] = useState('score'); // 'score' | 'part'
  const [partLayoutMeasuresPerLine, setPartLayoutMeasuresPerLine] = useState(4);
  const [partLayoutLineBreakBefore, setPartLayoutLineBreakBefore] = useState([]);
  const [partLayoutPageBreakBefore, setPartLayoutPageBreakBefore] = useState([]);
  const [partLayoutExtraPages, setPartLayoutExtraPages] = useState(0);
  const [showPageNavigator, setShowPageNavigator] = useState(false);
  /** When true, scale the score so one A4 page fits in the visible area (whole page layout on screen). */
  const [viewFitPage, setViewFitPage] = useState(true);
  /** When true (and viewFitPage on), scale to fit only the notated area instead of full A4 page. */
  const [viewSmartPage, setViewSmartPage] = useState(false);
  /** Zoom for notation area only (1 = 100%); slider, wheel with Ctrl/Cmd, pinch, Cmd/Ctrl+/-. Same scaleFactor for PDF export. */
  const [scoreZoomLevel, setScoreZoomLevel] = useState(1);
  const scoreZoomLevelRef = useRef(1); // always current for PDF export
  useEffect(() => { scoreZoomLevelRef.current = scoreZoomLevel; }, [scoreZoomLevel]);
  const scoreZoomPinchRef = useRef(null); // { initialDistance, initialZoom } for touch pinch
  /** When true, user has clicked/touched the notation frame so pinch and wheel zoom are allowed. */
  const [notationFrameFocused, setNotationFrameFocused] = useState(false);
  const notationFrameFocusedRef = useRef(false);
  const notationZoomAreaRef = useRef(null); // wrapper that contains the score; used to detect "inside notation" for zoom
  const scoreScaledWrapperRef = useRef(null); // div with transform: scale(scoreZoomLevel); used for PDF so export matches view
  const mainRef = useRef(null);
  const mainAreaRef = useRef(null); // used for fit-page scale calculation
  const lastVerticalContentHeightRef = useRef(0);
  const [mainScrollTop, setMainScrollTop] = useState(0);
  const [mainScrollLeft, setMainScrollLeft] = useState(0);
  const [mainContentHeight, setMainContentHeight] = useState(0);
  // Scroll in <main> can fire very frequently; throttle state updates to 1× per animation frame
  // to avoid re-rendering the whole app on every scroll tick.
  const mainScrollPendingRef = useRef({ top: 0, left: 0 });
  const mainScrollRafRef = useRef(0);
  const onMainScroll = useCallback((e) => {
    const el = e?.currentTarget;
    if (!el) return;
    mainScrollPendingRef.current.top = el.scrollTop;
    mainScrollPendingRef.current.left = el.scrollLeft;
    if (mainScrollRafRef.current) return;
    if (typeof requestAnimationFrame === 'undefined') {
      setMainScrollTop(el.scrollTop);
      setMainScrollLeft(el.scrollLeft);
      return;
    }
    mainScrollRafRef.current = requestAnimationFrame(() => {
      mainScrollRafRef.current = 0;
      const { top, left } = mainScrollPendingRef.current || { top: 0, left: 0 };
      setMainScrollTop(top);
      setMainScrollLeft(left);
    });
  }, []);
  useEffect(() => () => {
    if (mainScrollRafRef.current && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(mainScrollRafRef.current);
    }
    mainScrollRafRef.current = 0;
  }, []);

  // Mitmed noodiridad (iga rida = üks instrument oma noodivõtmega). Uue instrumendi valik lisab uue rea.
  const initialStaffNotes = [
    { id: 1, pitch: 'C', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 2, pitch: 'D', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 3, pitch: 'E', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false }
  ];
  // Default: single staff in treble clef (not piano grand staff). Figuurnotatsioon and other notation use treble clef mode.
  const [staves, setStaves] = useState(() => [
    { id: '1', instrumentId: 'single-staff-treble', clefType: 'treble', notes: initialStaffNotes, braceGroupId: undefined, notationMode: 'traditional' }
  ]);
  const [activeStaffIndex, setActiveStaffIndex] = useState(0);
  /** Iga noodirida võib olla vertikaalselt nihutatud (px). Klõps real aktiveerib rea; ↑↓ liigutavad aktiivset rida 1px. */
  const [staffYOffsets, setStaffYOffsets] = useState([]);
  useEffect(() => {
    setStaffYOffsets((prev) => {
      const next = [...prev];
      while (next.length < staves.length) next.push(0);
      return next.length > staves.length ? next.slice(0, staves.length) : next;
    });
  }, [staves.length]);
  /** Nutikas partituuri fookus: õpetaja märgib, millised read on lindistatavas harjutuses aktiivsed. Vaikimisi kõik nähtavad. */
  const [visibleStaves, setVisibleStaves] = useState([]);
  useEffect(() => {
    setVisibleStaves((prev) => {
      const next = [...prev];
      while (next.length < staves.length) next.push(true);
      return next.length > staves.length ? next.slice(0, staves.length) : next;
    });
  }, [staves.length]);
  /** Puhkehetkede sildid: ridade vahetusel või pausi ajal kuvatakse suur tekst (nt "Nüüd loevad ainult poisid!"). */
  const [intermissionLabels, setIntermissionLabels] = useState([]); // { id, startBeat, endBeat, text }
  const [isInstrumentManagerOpen, setIsInstrumentManagerOpen] = useState(false);
  const [instrumentManagerSelectedCatalogId, setInstrumentManagerSelectedCatalogId] = useState(() => INSTRUMENT_CATEGORIES[0]?.id || 'singleStaff');
  const [instrumentManagerSelectedStaffId, setInstrumentManagerSelectedStaffId] = useState(null);
  const [instrumentManagerSelectedStaffIds, setInstrumentManagerSelectedStaffIds] = useState([]);
  const [instrumentPartGroups, setInstrumentPartGroups] = useState([]); // [{ id, name, staffIds[] }]
  const [linkedNotationByStaffId, setLinkedNotationByStaffId] = useState({}); // { [staffId]: boolean }
  /** Iirivile lingitud sõrmestus (SVG): UI 50–200% (50 = suur, suurem % = veel suurem). */
  const [tinWhistleLinkedFingeringScalePercent, setTinWhistleLinkedFingeringScalePercent] = useState(50);
  const [copyInstrumentConfirm, setCopyInstrumentConfirm] = useState(null); // { staffId }
  useEffect(() => {
    if (!staves.length) {
      setInstrumentManagerSelectedStaffId(null);
      setInstrumentManagerSelectedStaffIds([]);
      return;
    }
    setInstrumentManagerSelectedStaffId((prev) => (prev && staves.some((s) => s.id === prev)) ? prev : staves[0].id);
    setInstrumentManagerSelectedStaffIds((prev) => (prev || []).filter((id) => staves.some((s) => s.id === id)));
  }, [staves]);
  useEffect(() => {
    setLinkedNotationByStaffId((prev) => {
      let changed = false;
      const next = {};
      staves.forEach((staff) => {
        const cfg = INSTRUMENT_CONFIG_BASE?.[staff.instrumentId];
        const supportsLinked = cfg?.type === 'tab' || (cfg?.type === 'wind' && cfg?.fingering);
        if (!supportsLinked) return;
        const persisted = prev && Object.prototype.hasOwnProperty.call(prev, staff.id) ? !!prev[staff.id] : true;
        next[staff.id] = persisted;
      });
      const prevKeys = Object.keys(prev || {});
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) changed = true;
      if (!changed) {
        for (let i = 0; i < nextKeys.length; i++) {
          const key = nextKeys[i];
          if (prev[key] !== next[key]) {
            changed = true;
            break;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [staves]);
  // Aktiivse rea noodid ja instrumendid (tuletatud staves[activeStaffIndex]-ist)
  const activeStaff = staves[activeStaffIndex];
  const notes = activeStaff?.notes ?? [];

  // Viimane "turvaline" kursorinoot (beat), mida kasutame tekstirežiimis, kui kursor üritab sattuda suvalisse kohta.
  const lastCursorOnNoteBeatRef = useRef(0);

  // Selection -> cursor projection (single deterministic rule):
  // in SEL mode, note-range focus drives cursor beat; text mode keeps its own focus.
  useEffect(() => {
    if (noteInputMode) return;
    if (cursorTool === 'type') return;
    if (lyricChainIndex !== null) return;
    if (cursorSelection.kind !== 'range') return;
    const lastSelectedIndex = Math.max(cursorSelection.anchorIndex, cursorSelection.focusIndex);
    if (!Number.isInteger(lastSelectedIndex) || lastSelectedIndex < 0 || lastSelectedIndex >= notes.length) return;
    let beat = 0;
    for (let i = 0; i <= lastSelectedIndex; i++) {
      const n = notes[i];
      const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
      const dur = Number(n?.duration) || 1;
      beat = noteBeat + dur;
    }
    setCursorPosition(beat);
  }, [noteInputMode, cursorTool, lyricChainIndex, cursorSelection, notes]);

  const setNotes = useCallback((updater) => {
    setStaves((prev) => {
      const idx = typeof activeStaffIndex === 'number' ? activeStaffIndex : 0;
      if (idx < 0 || idx >= prev.length) return prev;
      const next = prev.slice();
      const staff = next[idx];
      next[idx] = { ...staff, notes: typeof updater === 'function' ? updater(staff.notes) : updater };
      return next;
    });
  }, [activeStaffIndex]);
  const updateNoteTeacherLabel = useCallback((noteIndex, value) => {
    if (saveToHistoryRef.current) saveToHistoryRef.current(notes);
    setNotes((prev) => prev.map((n, i) => (i === noteIndex ? { ...n, teacherLabel: value } : n)));
    dirtyRef.current = true;
  }, [notes]);
  const onNotePitchChange = useCallback((noteIndex, pitch, octave) => {
    if (noteIndex < 0 || noteIndex >= notes.length) return;
    if (saveToHistoryRef.current) saveToHistoryRef.current(notes);
    setNotes((prev) => prev.map((n, i) => (i === noteIndex ? { ...n, pitch, octave, accidental: 0 } : n)));
    dirtyRef.current = true;
  }, [notes, setNotes]);

  const durationLabelToQuarterBeats = useCallback((durationLabel) => {
    const denom = parseInt(String(durationLabel || '1/4').split('/')[1], 10) || 4;
    return 4 / denom;
  }, []);
  const throwCursorModelError = useCallback((code, description, meta = {}) => {
    const payload = { source: 'cursor-time-model', code, description, ...meta };
    console.error('[CursorTimeModelError]', payload);
    throw new Error(`${code}: ${description}`);
  }, []);
  const assertCursorTimeModelInputs = useCallback((source, beat, durationLabel, durationBeats) => {
    if (!Number.isFinite(beat) || beat < 0) {
      throwCursorModelError('CURSOR_BEAT_INVALID', 'Cursor beat must be finite and non-negative.', { source, beat });
    }
    if (typeof durationLabel !== 'string' || !durationLabel.trim()) {
      throwCursorModelError('INPUT_DURATION_LABEL_INVALID', 'Input duration label must be a non-empty string.', { source, durationLabel });
    }
    if (!Number.isFinite(durationBeats) || durationBeats <= 0) {
      throwCursorModelError('INPUT_DURATION_INVALID', 'Input duration must be positive and finite.', {
        source,
        durationLabel,
        durationBeats,
      });
    }
  }, [throwCursorModelError]);
  const assertDeleteReplacementInvariant = useCallback((source, beforeNotes, afterNotes, replacedIndices) => {
    if ((beforeNotes?.length ?? 0) !== (afterNotes?.length ?? 0)) {
      throwCursorModelError('DELETE_REST_SHAPE_MISMATCH', 'Delete-to-rest must preserve note-array length.', {
        source,
        beforeLength: beforeNotes?.length ?? 0,
        afterLength: afterNotes?.length ?? 0,
      });
    }
    (replacedIndices || []).forEach((idx) => {
      const prev = beforeNotes?.[idx];
      const next = afterNotes?.[idx];
      const prevDur = Number(prev?.duration) || 0;
      const nextDur = Number(next?.duration) || 0;
      if (!next || !next.isRest || Math.abs(prevDur - nextDur) > 1e-6) {
        throwCursorModelError('DELETE_REST_DURATION_MISMATCH', 'Delete-to-rest must preserve durations and set rest=true.', {
          source,
          idx,
          prevDuration: prevDur,
          nextDuration: nextDur,
          nextIsRest: !!next?.isRest,
        });
      }
    });
  }, [throwCursorModelError]);

  const noteDurationInQuarterBeats = useCallback((note) => {
    const direct = Number(note?.duration);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const base = durationLabelToQuarterBeats(note?.durationLabel || '1/4');
    return (note?.isDotted ? base * 1.5 : base);
  }, [durationLabelToQuarterBeats]);

  // Resolve explicit beat for each note (used by onNoteBeatChange and addNoteAtCursor; must be defined before first use).
  const notesWithExplicitBeatsEarly = useCallback((noteList) => {
    let runningBeat = 0;
    return (noteList || []).map((n) => {
      const beat = typeof n.beat === 'number' ? n.beat : runningBeat;
      runningBeat = beat + noteDurationInQuarterBeats(n);
      return { ...n, beat };
    });
  }, [noteDurationInQuarterBeats]);

  /** Suurim beat, kuhu noodid ulatuvad (kõigi ridade maksimum) – uute ridade pausitäite jaoks. */
  const getStavesMaxNotesEndBeat = useCallback((staveList) => {
    let maxEnd = 0;
    for (const s of staveList || []) {
      const arr = notesWithExplicitBeatsEarly(s?.notes || []);
      for (const n of arr) {
        const b = Number(n.beat) || 0;
        const dur = noteDurationInQuarterBeats(n);
        maxEnd = Math.max(maxEnd, b + dur);
      }
    }
    return maxEnd;
  }, [notesWithExplicitBeatsEarly, noteDurationInQuarterBeats]);

  /** Hand tool: move note to a new beat. Re-sorts notes by beat. */
  const onNoteBeatChange = useCallback((noteIndex, newBeat) => {
    if (noteIndex < 0 || noteIndex >= notes.length) return;
    const beat = Math.max(0, newBeat);
    if (saveToHistoryRef.current) saveToHistoryRef.current(notes);
    setNotes((prev) => {
      const withNew = prev.map((n, i) => i === noteIndex ? { ...n, beat } : n);
      const withBeats = notesWithExplicitBeatsEarly(withNew);
      return withBeats.sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
    });
    dirtyRef.current = true;
  }, [notes, notesWithExplicitBeatsEarly]);
  const clearAllNoteLabels = useCallback(() => {
    if (saveToHistoryRef.current) saveToHistoryRef.current(notes);
    setNotes((prev) => prev.map((n) => ({ ...n, teacherLabel: '' })));
    dirtyRef.current = true;
  }, [notes]);
  const instrument = activeStaff?.instrumentId ?? 'single-staff-treble';
  const setInstrument = useCallback((instId) => {
    setStaves((prev) => {
      if (typeof GLOBAL_NOTATION_CONFIG === 'undefined' || !GLOBAL_NOTATION_CONFIG || typeof INSTRUMENT_CONFIG_BASE === 'undefined' || !INSTRUMENT_CONFIG_BASE) return prev;
      const idx = typeof activeStaffIndex === 'number' ? activeStaffIndex : 0;
      if (idx < 0 || idx >= prev.length) return prev;
      const cfg = INSTRUMENT_CONFIG_BASE[instId];
      const isGrandStaff = cfg?.type === 'grandStaff';
      const current = prev[idx];
      const inBraceGroup = current.braceGroupId && prev[idx + 1]?.braceGroupId === current.braceGroupId;
      // MuseScore klaverisüsteem: kaks paralleelset noodijoonestikku – ülemine viiulivõti (G), alumine bassivõti (F täpselt 4. joonel), vasakult ühendatud klaveriklambriga (Brace)
      // MuseScore Grand Staff: klaver = viiulivõti (G) + bassivõti (F 4. joonel)
      if (isGrandStaff && instId === 'piano') {
        const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
        const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-a`;
        const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-b`;
        const preservedMode = prev[idx].notationMode ?? 'traditional';
        const trebleNotes = prev[idx].notes ?? [];
        const bassNotes = inBraceGroup
          ? (prev[idx + 1]?.notes ?? [])
          : (() => {
              const span = Math.max(
                getStavesMaxNotesEndBeat([{ notes: trebleNotes }]),
                restPaddingGridEndBeatRef.current || 0
              );
              if (!(span > 1e-6)) return [];
              return fillGapWithRests(0, span).map(({ beat, ...rest }) => rest);
            })();
        const trebleStaff = { id: id1, instrumentId: 'piano', clefType: 'treble', notes: trebleNotes, braceGroupId, notationMode: preservedMode };
        const bassStaff = { id: id2, instrumentId: 'piano', clefType: 'bass', notes: bassNotes, braceGroupId, notationMode: preservedMode };
        if (inBraceGroup) {
          const next = prev.slice(0, idx).concat([trebleStaff, bassStaff], prev.slice(idx + 2));
          return next;
        }
        const next = prev.slice(0, idx).concat([trebleStaff, bassStaff], prev.slice(idx + 1));
        return next;
      }
      if (inBraceGroup) {
        const singleStaff = { ...prev[idx], id: prev[idx].id, instrumentId: instId, clefType: (cfg?.defaultClef) || 'treble', notes: prev[idx].notes, braceGroupId: undefined, notationMode: prev[idx].notationMode ?? 'traditional' };
        const next = prev.slice(0, idx).concat([singleStaff], prev.slice(idx + 2));
        return next;
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], instrumentId: instId, clefType: (cfg?.defaultClef) || 'treble', notationMode: next[idx].notationMode ?? 'traditional' };
      return next;
    });
  }, [activeStaffIndex, getStavesMaxNotesEndBeat]);
  const removeStaff = useCallback(() => {
    const idx = typeof activeStaffIndex === 'number' ? activeStaffIndex : 0;
    if (idx < 0 || idx >= staves.length || staves.length <= 1) return;
    const current = staves[idx];
    const inBraceGroup = current.braceGroupId && staves[idx + 1]?.braceGroupId === current.braceGroupId;
    const nextStaves = inBraceGroup
      ? staves.slice(0, idx).concat(staves.slice(idx + 2))
      : staves.slice(0, idx).concat(staves.slice(idx + 1));
    const nextMaxIndex = nextStaves.length - 1;
    setStaves(nextStaves);
    setActiveStaffIndex((prev) => Math.min(prev, Math.max(0, nextMaxIndex)));
  }, [activeStaffIndex, staves]);
  const normalizeActiveStaffById = useCallback((nextStaves, preferredStaffId) => {
    if (!Array.isArray(nextStaves) || nextStaves.length === 0) return 0;
    const targetId = preferredStaffId || staves[activeStaffIndex]?.id;
    const idx = nextStaves.findIndex((s) => s.id === targetId);
    return idx >= 0 ? idx : Math.min(activeStaffIndex, nextStaves.length - 1);
  }, [activeStaffIndex, staves]);
  const getBraceClusterAtIndex = useCallback((list, idx) => {
    const cur = list?.[idx];
    const braceId = cur?.braceGroupId;
    if (!braceId) return { start: idx, count: 1 };
    const prevSame = idx > 0 && list[idx - 1]?.braceGroupId === braceId;
    const nextSame = idx < list.length - 1 && list[idx + 1]?.braceGroupId === braceId;
    if (prevSame) return { start: idx - 1, count: 2 };
    if (nextSame) return { start: idx, count: 2 };
    return { start: idx, count: 1 };
  }, []);
  const clefType = activeStaff?.clefType ?? 'treble';
  const setClefType = useCallback((clef) => {
    setStaves((prev) => {
      const idx = typeof activeStaffIndex === 'number' ? activeStaffIndex : 0;
      if (idx < 0 || idx >= prev.length) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], clefType: clef };
      return next;
    });
  }, [activeStaffIndex]);

  // Kui režiim vahetub 'traditional' peale ja aktiivne noodivõti on JO, määra automaatselt viiulivõti (treble).
  useEffect(() => {
    if (notationMode !== 'traditional') return;
    const currentClef = activeStaff?.clefType ?? 'treble';
    if (currentClef === 'jo' || currentClef === 'do') {
      setClefType('treble');
    }
  }, [notationMode, activeStaff?.clefType, setClefType]);

  const [saveFeedback, setSaveFeedback] = useState('');
  const [importTimeline, setImportTimeline] = useState(null);
  const [cloudLoadComplete, setCloudLoadComplete] = useState(() => !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fileId')));
  const [addedMeasures, setAddedMeasures] = useState(0);
  /** Jooksiv min taktide arv nootide järgi; addMeasure on defineeritud varem kui useMemo */
  const minMeasuresFromNotesRef = useRef(1);
  const [songTitle, setSongTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [copyrightFooter, setCopyrightFooter] = useState('');
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickupQuantity, setPickupQuantity] = useState(1);
  const [pickupDuration, setPickupDuration] = useState('1/4');
  // Häälestus: võrdlusnoot (nt A3=440 Hz), muudetav seadetest
  const [tuningReferenceNote, setTuningReferenceNote] = useState('A');
  const [tuningReferenceOctave, setTuningReferenceOctave] = useState(3);
  const [tuningReferenceHz, setTuningReferenceHz] = useState(440);
  const [playNoteOnInsert, setPlayNoteOnInsert] = useState(true);
  const [figurenotesSize, setFigurenotesSize] = useState(65); // Noodigraafika suurus (figuurid ja noodid), 12–100 px (vaikimisi 65)
  const [figurenotesStems, setFigurenotesStems] = useState(false); // Figuurnotatsioonis rütmi näitamine noodivartega (vaikimisi välja)
  const [figurenotesChordLineGap, setFigurenotesChordLineGap] = useState(6); // Akordirida figuurnotatsioonis: vahe meloodiareal ja akordirea vahel 0–20 px
  const [figurenotesChordBlocks, setFigurenotesChordBlocks] = useState(false); // Akordirežiim figuurnotatsioonis: värvilised akordiplokid akordireal
  const [figurenotesChordBlocksShowTones, setFigurenotesChordBlocksShowTones] = useState(true); // Akordiplokis: näita lisanoote (noodinimed + värvifiguurid)
  const [figurenotesMelodyShowNoteNames, setFigurenotesMelodyShowNoteNames] = useState(true); // Figuurnotatsioonis meloodiarea nootide peal noodinimed (C, D, E)

  // Hoia rütmiboksi (pixelsPerBeat) laius kooskõlas noodigraafika suurusega – magneetiline seos
  useEffect(() => {
    setPixelsPerBeat((prev) => {
      const target = Math.max(40, Math.min(100, figurenotesSize));
      return target;
    });
  }, [figurenotesSize]);
  const [showBarNumbers, setShowBarNumbers] = useState(true); // Taktide numbrid iga rea alguses noodivõtme kohal
  const [barNumberSize, setBarNumberSize] = useState(11); // Taktinumbri fondi suurus (8–24 px)
  const [showRhythmSyllables, setShowRhythmSyllables] = useState(DEFAULT_SHOW_RHYTHM_SYLLABLES);
  const [showAllNoteLabels, setShowAllNoteLabels] = useState(DEFAULT_SHOW_ALL_NOTE_LABELS);
  const [enableEmojiOverlays, setEnableEmojiOverlays] = useState(DEFAULT_SHOW_EMOJI_OVERLAYS);
  // Relatiivnotatsioon (Kodály): võtmemärk ja traditsiooniline noodivõti on valikulised; JO võti on kohustuslik.
  const [relativeNotationShowKeySignature, setRelativeNotationShowKeySignature] = useState(false);
  const [relativeNotationShowTraditionalClef, setRelativeNotationShowTraditionalClef] = useState(false);
  const [chords, setChords] = useState([]); // { id, beatPosition, chord, figuredBass?, durationBeats? } – traditsiooniline ja figuurnotatsioon
  const [customChordInput, setCustomChordInput] = useState('');
  const [customFiguredBassInput, setCustomFiguredBassInput] = useState('');
  const customChordInputRef = useRef(null);
  // Teksti kasti plugin: vabalt paigutatavad laulutekstid, kommentaarid ja tempo märgid
  const [textBoxes, setTextBoxes] = useState([]); // { id, x, y, text, type?: 'text'|'tempo', tempoBpm?: number, fontSize?: number, columnCount?: number }
  const [selectedTextboxId, setSelectedTextboxId] = useState(null);
  const [textBoxDraftText, setTextBoxDraftText] = useState(''); // vaba tekst enne lisamist
  // Kordusmärgid ja hüpped (Leland SMuFL) – võtmeks takti indeks: repeatStart, repeatEnd, volta1, volta2, segno, coda
  const [measureRepeatMarks, setMeasureRepeatMarks] = useState({});
  const [textBoxTempoBpm, setTextBoxTempoBpm] = useState(''); // BPM tempo kasti jaoks
  // Fondid: dokumendi font (pealkiri, autor, teksti kastid) ja laulutekstide font (noodi all)
  const [documentFontFamily, setDocumentFontFamily] = useState('Georgia, serif');
  const [lyricFontFamily, setLyricFontFamily] = useState('sans-serif');
  const [lyricFontSize, setLyricFontSize] = useState(12); // Lauluteksti fondi suurus (px); määrab ka laulusõnade rea vahe Cmd/Ctrl+L korral
  // Active text line for floating text tool: 'title' | 'author' | 'textbox' | null (textbox uses selectedTextboxId)
  const [activeTextLineType, setActiveTextLineType] = useState(null);
  // Per-line font: title and author (only applied to chosen line)
  const [titleFontSize, setTitleFontSize] = useState(55);
  const [authorFontSize, setAuthorFontSize] = useState(14);
  const [titleFontFamily, setTitleFontFamily] = useState(''); // '' = use documentFontFamily
  const [authorFontFamily, setAuthorFontFamily] = useState('');
  const [titleBold, setTitleBold] = useState(false);
  const [titleItalic, setTitleItalic] = useState(false);
  const [authorBold, setAuthorBold] = useState(false);
  const [authorItalic, setAuthorItalic] = useState(false);
  const [titleAlignment, setTitleAlignment] = useState('center'); // 'left' | 'center' | 'right'
  const [authorAlignment, setAuthorAlignment] = useState('right'); // 'left' | 'center' | 'right'
  const [staffRowAlignment, setStaffRowAlignment] = useState('center'); // 'left' | 'center' | 'right' – figuurnotatsiooni rea joondus
  const titleInputRef = useRef(null);
  const authorInputRef = useRef(null);
  const [textToolPosition, setTextToolPosition] = useState({ top: 0, left: 0 });
  // Pedagoogiline notatsioon: salvestatud heli animeerimine (kursor liigub heli järgi)
  const [pedagogicalAudioUrl, setPedagogicalAudioUrl] = useState(null); // object URL või null
  const [pedagogicalAudioBpm, setPedagogicalAudioBpm] = useState(120);
  const [pedagogicalAudioDuration, setPedagogicalAudioDuration] = useState(0); // sekundites
  const [isPedagogicalAudioPlaying, setIsPedagogicalAudioPlaying] = useState(false);
  const [isScorePlaybackPlaying, setIsScorePlaybackPlaying] = useState(false);
  const [pedagogicalAudioPlaybackRate, setPedagogicalAudioPlaybackRate] = useState(1.0); // 0.5–2.0
  const [pedagogicalAudioCurrentTime, setPedagogicalAudioCurrentTime] = useState(0);
  // Animeeritud notatsioon: nooti lugeva kursori kuju (püstine joon, emoji)
  const [pedagogicalPlayheadStyle, setPedagogicalPlayheadStyle] = useState('line'); // 'line' | 'violin' | 'smiley' | 'custom'
  const [pedagogicalPlayheadEmoji, setPedagogicalPlayheadEmoji] = useState('🎵'); // kasutub kui style === 'custom'; seadetes "Kursori karakter"
  const [pedagogicalPlayheadEmojiSize, setPedagogicalPlayheadEmojiSize] = useState(30); // HEV: 20–60 px (2px smaller default for N cursor)
  const [cursorSizePx, setCursorSizePx] = useState(30); // User setting: cursor/playhead size 1–500 px (used in Settings ruler)
  const [cursorLineStrokeWidth, setCursorLineStrokeWidth] = useState(4); // N-mode / reading cursor line thickness (1–8 px)
  const [pedagogicalPlayheadMovement, setPedagogicalPlayheadMovement] = useState('arch'); // 'arch' (distance-dependent) | 'horizontal'
  const [isExportingAnimation, setIsExportingAnimation] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showPdfExportPreview, setShowPdfExportPreview] = useState(false);
  /** Inline SVG (mitte data: img) — brauserid ei lae SVG @font-face’e pildi kontekstis; SMuFL taktimõõt jääb nähtavaks. */
  const [pdfPreviewPageSvgHtml, setPdfPreviewPageSvgHtml] = useState('');
  const [pdfPreviewSize, setPdfPreviewSize] = useState({ w: 0, h: 0 });
  /** SVG-põhine eksport: täielik score snapshot (sh pageDesign*), et getPageSvgString ei kaotaks tausta. */
  const [pdfPreviewSvgData, setPdfPreviewSvgData] = useState(null);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [pdfPreviewPageIndex, setPdfPreviewPageIndex] = useState(0);
  const pdfPreviewTotalPages = useMemo(() => {
    if (!pdfPreviewSvgData?.contentHeight || !pdfPreviewSvgData?.orientation) return 1;
    const pm = pdfPreviewSvgData.pageMetrics;
    const flow = pdfPreviewSvgData.flowDirection === 'horizontal' ? 'horizontal' : 'vertical';
    const pageExtentPx = pm
      ? (flow === 'horizontal' ? pm.widthPx : pm.heightPx)
      : (pdfPreviewSvgData.orientation === 'landscape' ? 794 : 1123);
    return getPageCount(Number(pdfPreviewSvgData.contentHeight) || pageExtentPx, pageExtentPx);
  }, [pdfPreviewSvgData]);
  const [pdfPreviewZoom, setPdfPreviewZoom] = useState(1);
  const [pdfPreviewCaptureKey, setPdfPreviewCaptureKey] = useState(0);
  const pdfPreviewContainerRef = useRef(null);
  const [pdfExportSaveLocation, setPdfExportSaveLocation] = useState('downloads'); // 'downloads' | 'custom'
  const [pdfExportFileHandle, setPdfExportFileHandle] = useState(null);
  const [pdfExportChosenPath, setPdfExportChosenPath] = useState('');
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const [projectSaveTarget, setProjectSaveTarget] = useState(() => {
    try {
      const raw = localStorage.getItem(PROJECT_IO_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const target = parsed?.saveTarget;
      if (target === 'cloud' || target === 'browser') return target;
    } catch (_) { /* ignore */ }
    return 'cloud';
  });
  const [projectLoadSource, setProjectLoadSource] = useState(() => {
    try {
      const raw = localStorage.getItem(PROJECT_IO_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const source = parsed?.loadSource;
      if (source === 'cloud' || source === 'browser') return source;
    } catch (_) { /* ignore */ }
    return 'cloud';
  });
  const [projectFileHandle, setProjectFileHandle] = useState(null);
  const [projectChosenPath, setProjectChosenPath] = useState('');
  const pedagogicalAudioRef = useRef(null); // HTMLAudioElement
  const pedagogicalPlaybackIntervalRef = useRef(null);
  const scorePlaybackIntervalRef = useRef(null);
  const scorePlaybackLastBeatRef = useRef(0);
  const scorePlaybackStartedAtRef = useRef(0);
  const pedagogicalAudioDataRef = useRef(null); // base64 string (salvestamiseks)
  const pedagogicalAudioUrlRef = useRef(null); // object URL (revoke vahetusel)
  const pedagogicalAudioInputRef = useRef(null);
  const pedagogicalAudioImportInputRef = useRef(null);
  const musicXmlInputRef = useRef(null);
  const pageDesignInputRef = useRef(null);

  // Kasutaja imporditud lehe "frame"/taust (PNG/SVG)
  const [pageDesignDataUrl, setPageDesignDataUrl] = useState(null);
  const [pageDesignOpacity, setPageDesignOpacity] = useState(0.25);
  const [pageDesignFit, setPageDesignFit] = useState('cover'); // 'cover' | 'contain'
  const [pageDesignPositionX, setPageDesignPositionX] = useState(50); // 0–100, backgroundPosition %
  const [pageDesignPositionY, setPageDesignPositionY] = useState(50);
  const [pageDesignCrop, setPageDesignCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 }); // 0–50 % inset per edge
  const pageDesignDragRef = useRef(null); // { active, startX, startY, startPosX, startPosY }
  const pageDesignDimensionsRef = useRef({ pw: 1000, a4: 1414 }); // updated for delta→% conversion
  const bodyOverflowRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDragOffset, setSettingsDragOffset] = useState({ x: 0, y: 0 });
  const settingsDragRef = useRef(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsEditingActionKey, setShortcutsEditingActionKey] = useState(null);
  const [shortcutsDraftPrefs, setShortcutsDraftPrefs] = useState({});
  const [saveCloudDialogOpen, setSaveCloudDialogOpen] = useState(false);
  /** Google Drive: modaalne faililoend (Drive API), mitte Picker / prompt. */
  const [googleLoadPickerOpen, setGoogleLoadPickerOpen] = useState(false);
  const [googleLoadPickerLoading, setGoogleLoadPickerLoading] = useState(false);
  const [googleLoadPickerError, setGoogleLoadPickerError] = useState('');
  const [googleLoadPickerRows, setGoogleLoadPickerRows] = useState([]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerMove = (e) => {
      if (!settingsDragRef.current) return;
      const { startX, startY, originX, originY } = settingsDragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let nextX = originX + dx;
      let nextY = originY + dy;
      const vw = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
      const vh = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;
      const marginX = 40;
      const marginY = 40;
      const minX = -vw / 2 + marginX;
      const maxX = vw / 2 - marginX;
      const minY = -vh / 2 + marginY;
      const maxY = vh / 2 - marginY;
      if (nextX < minX) nextX = minX;
      if (nextX > maxX) nextX = maxX;
      if (nextY < minY) nextY = minY;
      if (nextY > maxY) nextY = maxY;
      setSettingsDragOffset({ x: nextX, y: nextY });
    };
    const onPointerUp = () => {
      settingsDragRef.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (shortcutsOpen) {
      const fresh = authStorage.getShortcutPrefs ? authStorage.getShortcutPrefs() : {};
      const merged = { ...DEFAULT_SHORTCUT_PREFS, ...fresh };
      Object.keys(merged).forEach((k) => {
        const n = normalizeShortcutPref(merged[k]);
        if (!n) delete merged[k]; else merged[k] = n;
      });
      setShortcutsDraftPrefs({ ...merged });
    }
  }, [shortcutsOpen]);

  useEffect(() => {
    if (!shortcutsOpen || !shortcutsEditingActionKey) return;
    const onKeyDown = (e) => {
      const pref = eventToShortcutPref(e);
      if (!pref) return;
      e.preventDefault();
      e.stopPropagation();
      setShortcutsDraftPrefs((prev) => ({ ...prev, [shortcutsEditingActionKey]: pref }));
      setShortcutsEditingActionKey(null);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [shortcutsOpen, shortcutsEditingActionKey]);
  const [themeMode, setThemeMode] = useState(() => getStoredTheme().mode);
  const [themePrimaryColor, setThemePrimaryColor] = useState(() => getStoredTheme().primaryColor);
  const themeColors = useMemo(() => {
    const isDark = themeMode === 'dark';
    return {
      staffLineColor: isDark ? '#ffffff' : '#000000',
      noteFill: isDark ? '#ffffff' : '#1a1a1a',
      textColor: isDark ? '#ffffff' : '#1a1a1a',
      isDark,
    };
  }, [themeMode]);
  /** Noodilehe paber: ei sõltu teemast ega põhivärvist; vaikimisi valge. Kasutaja lehe kujundus (pilt/SVG) renderdatakse eraldi kihina peale. */
  const scorePagePaperBackground = '#ffffff';
  // Rippmenüüd tööriistaribal: 'file' | 'view' | null
  const [headerMenuOpen, setHeaderMenuOpen] = useState(null);
  const [fileSubmenuOpen, setFileSubmenuOpen] = useState(null); // 'exportAnimation' | null
  const [viewSubmenuOpen, setViewSubmenuOpen] = useState(null); // 'orientation' | 'navigator' | 'flow' | null
  const [pageFlowDirection, setPageFlowDirection] = useState('vertical'); // 'vertical' | 'horizontal'
  const headerMenuRef = useRef(null);
  useEffect(() => {
    const closeMenus = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(null);
        setFileSubmenuOpen(null);
        setViewSubmenuOpen(null);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('click', closeMenus);
      return () => document.removeEventListener('click', closeMenus);
    }
  }, [headerMenuOpen]);
  useEffect(() => {
    const closeVisibleTools = (e) => {
      if (visibleToolsMenuRef.current && !visibleToolsMenuRef.current.contains(e.target)) setVisibleToolsMenuOpen(false);
    };
    if (visibleToolsMenuOpen) {
      document.addEventListener('click', closeVisibleTools);
      return () => document.removeEventListener('click', closeVisibleTools);
    }
  }, [visibleToolsMenuOpen]);
  useEffect(() => {
    applyThemeToDocument(themeMode, themePrimaryColor);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: themeMode, primaryColor: themePrimaryColor }));
    } catch (_) { /* ignore */ }
  }, [themeMode, themePrimaryColor]);

  useEffect(() => {
    const updatePianoWidth = () => setPianoStripWidth(Math.min(900, Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 900) - 80)));
    updatePianoWidth();
    window.addEventListener('resize', updatePianoWidth);
    return () => window.removeEventListener('resize', updatePianoWidth);
  }, []);

  // Klaveri riba laius konteineri järgi – tagab klaviatuuri nähtavuse portali avamisel
  useLayoutEffect(() => {
    if (!pianoStripVisible) return;
    const el = pianoStripWrapperRef.current;
    if (!el) return;
    const syncWidth = () => {
      const w = pianoStripWrapperRef.current?.clientWidth;
      if (w && w > 0) setPianoStripWidth(Math.min(900, Math.max(320, w)));
    };
    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pianoStripVisible]);

  const [saveCloudNewFolderName, setSaveCloudNewFolderName] = useState('NoodiMeister');
  const [setupCompleted, setSetupCompleted] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return d.setupCompleted === true;
      }
    } catch (_) { /* ignore */ }
    return false;
  });
  const autoSaveTimeoutRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const dirtyRef = useRef(false);
  const lastPersistedRef = useRef(null);
  const syncChannelRef = useRef(null);
  const syncClientIdRef = useRef((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const syncRevisionRef = useRef(0);
  const syncApplyingRemoteRef = useRef(false);
  const syncLastAppliedRevisionRef = useRef(0);
  const syncBroadcastTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const soundfontCacheRef = useRef(Object.create(null)); // soundfontPlayerCacheKey -> Soundfont player
  const activeSoundfontVoiceRef = useRef(null);
  const activeOscillatorStopRef = useRef(null);
  const activePreviewStopTimeoutRef = useRef(null);
  const lastRemoteCloudChangeNoticeRef = useRef('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNewWorkFlow = (searchParams && typeof searchParams.get === 'function' && searchParams.get('new')) === '1';
  const partStaffId = searchParams && typeof searchParams.get === 'function' ? searchParams.get('staffId') : undefined;
  // Kui fail on avatud pilvest (/app?fileId=...), hoiame meeles, millisest teenusest ja millise fileId-ga, et Cmd/Ctrl+S kirjutaks sama faili üle (mitte ei looks koopiat).
  const [openedCloudFile, setOpenedCloudFile] = useState(null); // { provider: 'google' | 'onedrive', fileId: string }
  /** Minu tööd lehelt "Uus töö selles kaustas": salvesta siia kausta (session, URL-ist saveFolderId & cloud). */
  const [sessionSaveFolderId, setSessionSaveFolderId] = useState(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search);
    const folderId = p.get('saveFolderId');
    const cloud = p.get('cloud');
    if (folderId && (cloud === 'google' || cloud === 'onedrive')) return { folderId, cloud };
    return null;
  });
  const isPartWindow = !!partStaffId;
  const [newWorkSetupOpen, setNewWorkSetupOpen] = useState(false);
  // Uue töö seadistuse vormi väljad (küsitakse enne töö loomist)
  const [wizardNotationMethod, setWizardNotationMethod] = useState('traditional'); // 'traditional' | 'figurenotes' | 'pedagogical'
  const [wizardTimeSignature, setWizardTimeSignature] = useState([4, 4]);
  const [wizardSongTitle, setWizardSongTitle] = useState('');
  const [wizardAuthor, setWizardAuthor] = useState('');
  const [wizardInstrument, setWizardInstrument] = useState('single-staff-treble');
  const [wizardPickupEnabled, setWizardPickupEnabled] = useState(false);
  const [wizardPickupQuantity, setWizardPickupQuantity] = useState(1);
  const [wizardPickupDuration, setWizardPickupDuration] = useState('1/4');
  const [wizardKeySignature, setWizardKeySignature] = useState('C');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    if (bodyOverflowRef.current == null) {
      bodyOverflowRef.current = body.style.overflow || '';
    }
    const hasBlockingModal = newWorkSetupOpen || saveCloudDialogOpen || googleLoadPickerOpen || settingsOpen || shortcutsOpen || showPdfExportPreview || isInstrumentManagerOpen || saveLoadOpen;
    body.style.overflow = hasBlockingModal ? 'hidden' : bodyOverflowRef.current;
    return () => {
      if (body && bodyOverflowRef.current != null) {
        body.style.overflow = bodyOverflowRef.current;
      }
    };
  }, [newWorkSetupOpen, saveCloudDialogOpen, googleLoadPickerOpen, settingsOpen, shortcutsOpen, showPdfExportPreview, isInstrumentManagerOpen, saveLoadOpen]);

  useEffect(() => {
    if (isNewWorkFlow) setNewWorkSetupOpen(true);
  }, [isNewWorkFlow]);

  const partWindowStaffIndices = useMemo(() => {
    if (!partStaffId) return null;
    const idx = staves.findIndex((s) => String(s.id) === String(partStaffId));
    if (idx < 0) return null;
    const braceId = staves[idx]?.braceGroupId;
    if (braceId) {
      const group = staves
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.braceGroupId === braceId)
        .map(({ i }) => i);
      return group.length ? group : [idx];
    }
    return [idx];
  }, [partStaffId, staves]);

  const partWindowTitle = useMemo(() => {
    if (!isPartWindow) return '';
    const idx = partWindowStaffIndices?.[0];
    if (typeof idx !== 'number' || idx < 0) return '';
    const staff = staves[idx];
    if (!staff) return '';
    const explicit = String(staff.name || '').trim();
    if (explicit) return explicit;
    const cfg = instrumentConfig?.[staff.instrumentId];
    return String(cfg?.label || cfg?.name || staff.instrumentId || '').trim();
  }, [isPartWindow, partWindowStaffIndices, staves, instrumentConfig]);

  /** One entry per "part" (single staff or brace group) for "choose part in new window" submenu. */
  const partOptions = useMemo(() => {
    if (!Array.isArray(staves) || staves.length === 0) return [];
    const seen = new Set();
    const result = [];
    staves.forEach((staff) => {
      const key = staff.braceGroupId ?? staff.id;
      if (seen.has(key)) return;
      seen.add(key);
      const firstStaff = staff.braceGroupId
        ? staves.find((s) => s.braceGroupId === staff.braceGroupId)
        : staff;
      const label =
        String(firstStaff?.name || '').trim() ||
        instrumentConfig?.[firstStaff?.instrumentId]?.label ||
        firstStaff?.instrumentId ||
        firstStaff?.id ||
        '';
      result.push({ staffId: firstStaff.id, label: label || String(firstStaff.id) });
    });
    return result;
  }, [staves, instrumentConfig]);

  useEffect(() => {
    if (!isPartWindow) return;
    if (!partWindowStaffIndices || partWindowStaffIndices.length === 0) return;
    setViewMode('part');
    setActiveStaffIndex(partWindowStaffIndices[0]);
    setVisibleStaves((prev) => {
      const next = staves.map((_, i) => partWindowStaffIndices.includes(i));
      const same = Array.isArray(prev) && prev.length === next.length && prev.every((v, i) => !!v === !!next[i]);
      return same ? prev : next;
    });
  }, [isPartWindow, partWindowStaffIndices, staves]);

  // Enne brauseri/lehe sulgemist hoiatab salvestamata muudatuste korral (töö kaotamine)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const applyNewWorkSetup = useCallback(() => {
    // Backward-compatible guard: old state could still contain 'vabanotatsioon'.
    const pedagogical = wizardNotationMethod === 'pedagogical' || wizardNotationMethod === 'vabanotatsioon';
    setIsPedagogicalProject(pedagogical);
    // Pedagoogiline notatsioon kasutab JO võtit (vabanotatsioon) ja võib näidata võtmemärki ning traditsioonilist võtit
    if (pedagogical) {
      setNotationMode('vabanotatsioon');
      setRelativeNotationShowKeySignature(true);
      setRelativeNotationShowTraditionalClef(true);
    } else {
      setNotationMode(wizardNotationMethod);
    }
    setNotationStyle(wizardNotationMethod === 'figurenotes' ? 'FIGURENOTES' : 'TRADITIONAL');
    setTimeSignature({ beats: wizardTimeSignature[0], beatUnit: wizardTimeSignature[1] });
    setKeySignature(wizardKeySignature);
    if (pedagogical) {
      const jp = getTonicStaffPosition(wizardKeySignature);
      if (Number.isFinite(jp)) {
        setJoClefStaffPosition(Math.max(JO_CLEF_POSITION_MIN, Math.min(JO_CLEF_POSITION_MAX, jp)));
      }
    }
    setSongTitle(wizardSongTitle.trim());
    setAuthor(wizardAuthor.trim());
    setInstrument(wizardInstrument);
    const instCfg = instrumentConfig[wizardInstrument];
    if (instCfg?.defaultClef) setClefType(instCfg.defaultClef);
    // Pedagoogilises režiimis eelistame võimalusel TAB-i või sõrmitsuse vaadet
    if (pedagogical && instCfg) {
      if (instCfg.type === 'tab') {
        setInstrumentNotationVariant('tab');
      } else if (instCfg.type === 'wind' && instCfg.fingering) {
        setInstrumentNotationVariant('fingering');
      } else {
        setInstrumentNotationVariant('standard');
      }
    } else {
      setInstrumentNotationVariant('standard');
    }
    setPickupEnabled(wizardPickupEnabled);
    setPickupQuantity(wizardPickupQuantity);
    setPickupDuration(wizardPickupDuration);
    const beatsPerMeasure = wizardTimeSignature[0] * (4 / wizardTimeSignature[1]);
    const quarterCount = Math.max(1, Math.round(beatsPerMeasure * 4));
    const initialNotes = Array.from({ length: quarterCount }, (_, i) => ({
      id: i + 1,
      pitch: 'C',
      octave: 4,
      duration: 1,
      durationLabel: '1/4',
      isDotted: false,
      isRest: true
    }));
    setNotes(initialNotes);
    setCursorPosition(0);
    setAddedMeasures(0);
    setChords([]);
    setFigurenotesChordBlocks(false);
    setFigurenotesChordBlocksShowTones(true);
    setFigurenotesChordLineGap(6);
    setTextBoxes([]);
    setMeasureRepeatMarks({});
    setPageDesignDataUrl(null);
    setPageDesignOpacity(0.25);
    setPageDesignFit('cover');
    setPageDesignPositionX(50);
    setPageDesignPositionY(50);
    setPageDesignCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setHistory([]);
    setHistoryIndex(-1);
    setSetupCompleted(true);
    setNewWorkSetupOpen(false);
    // New work must never stay bound to a previously opened cloud file.
    setOpenedCloudFile(null);
    // Stay on /app (openLocal=1) so AppOrRedirect does not send user back to /tood
    setSearchParams({ local: '1' });
    dirtyRef.current = true;
  }, [wizardNotationMethod, wizardTimeSignature, wizardSongTitle, wizardAuthor, wizardInstrument, wizardPickupEnabled, wizardPickupQuantity, wizardPickupDuration, wizardKeySignature, instrumentConfig]);

  const isLoggedIn = () => authStorage.isLoggedIn();

  const addMeasure = useCallback(() => {
    const minM = minMeasuresFromNotesRef.current || 1;
    let blocked = false;
    setAddedMeasures((prev) => {
      const uncapped = Math.max(1 + (prev || 0), minM);
      const capped = hasFullAccess ? uncapped : Math.min(uncapped, DEMO_MAX_MEASURES);
      if (!hasFullAccess && capped >= DEMO_MAX_MEASURES) {
        blocked = true;
        return prev;
      }
      dirtyRef.current = true;
      // Üks nähtav takt juurde: efektiivne total = max(1+added, min); uus total = vana + 1 → uus added = vana_total
      return uncapped;
    });
    if (blocked) {
      setSaveFeedback(t('demo.maxMeasures'));
      setTimeout(() => setSaveFeedback(''), 3500);
    }
  }, [hasFullAccess, t]);

  const addSongBlock = useCallback(() => {
    const ms = measuresRef.current || [];
    const minM = minMeasuresFromNotesRef.current || 1;
    const oldMeasureCount = Math.max(1, ms.length);
    const nextMeasureIndex = oldMeasureCount;
    let blocked = false;
    setAddedMeasures((prev) => {
      const uncapped = Math.max(1 + (prev || 0), minM);
      const capped = hasFullAccess ? uncapped : Math.min(uncapped, DEMO_MAX_MEASURES);
      if (!hasFullAccess && capped >= DEMO_MAX_MEASURES) {
        blocked = true;
        return prev;
      }
      return uncapped;
    });
    if (blocked) {
      setSaveFeedback(t('demo.maxMeasures'));
      setTimeout(() => setSaveFeedback(''), 3500);
      return;
    }
    dirtyRef.current = true;
    setLayoutLineBreakBefore((prev) => {
      if (prev.includes(nextMeasureIndex)) return prev;
      return [...prev, nextMeasureIndex].sort((a, b) => a - b);
    });
    setPartLayoutLineBreakBefore((prev) => {
      if (prev.includes(nextMeasureIndex)) return prev;
      return [...prev, nextMeasureIndex].sort((a, b) => a - b);
    });
    const lastMeasure = ms.length > 0 ? ms[ms.length - 1] : null;
    const fallbackMeasureSpan = beatsPerMeasureFromTimeSig(timeSignature);
    const measureSpan = lastMeasure ? Math.max(0.5, lastMeasure.endBeat - lastMeasure.startBeat) : fallbackMeasureSpan;
    const startBeat = lastMeasure ? lastMeasure.endBeat : 0;
    const endBeat = startBeat + measureSpan;
    setIntermissionLabels((prev) => {
      const seq = prev.length + 1;
      const blockName = `${t('tool.addSongBlockDefaultTitle')} ${seq}`;
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `song-block-${Date.now()}`;
      return [...prev, { id, startBeat, endBeat, text: blockName }];
    });
    setCursorPosition(startBeat);
  }, [hasFullAccess, timeSignature, t]);

  // Pedagoogiline notatsioon: salvestatud heli laadimine ja taustamängimine (kursor sünkroonis heliga)
  const handlePedagogicalAudioFile = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file || !file.type.startsWith('audio/')) return;
    if (pedagogicalAudioUrlRef.current) {
      URL.revokeObjectURL(pedagogicalAudioUrlRef.current);
      pedagogicalAudioUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
      if (b64) pedagogicalAudioDataRef.current = b64;
      const audio = new Audio(url);
      audio.onloadedmetadata = () => setPedagogicalAudioDuration(audio.duration);
      pedagogicalAudioUrlRef.current = url;
      setPedagogicalAudioUrl(url);
      dirtyRef.current = true;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const clampNumber = (num, min, max) => Math.max(min, Math.min(max, num));

  const handleImportPageDesignFile = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const name = String(file.name || '').toLowerCase();
    const okType = file.type === 'image/png' || file.type === 'image/svg+xml' || name.endsWith('.svg') || name.endsWith('.png');
    if (!okType) {
      setSaveFeedback('Toetatud: PNG või SVG');
      setTimeout(() => setSaveFeedback(''), 2200);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (dataUrl) {
        setPageDesignDataUrl(dataUrl);
        // Imporditud lehe disain: A4 täislehe vaade, vertikaalne voog. Lehe suunda EI muuda –
        // portrait/landscape jääb nii nagu kasutaja valis (faili/Canva ekspordi suund ei mõjuta).
        setPaperSize('a4');
        setPageFlowDirection('vertical');
        setViewSmartPage(false);
        setViewFitPage(true);
        dirtyRef.current = true;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const musicXmlTypeToDurationLabel = (type) => {
    const base = {
      whole: '1/1',
      half: '1/2',
      quarter: '1/4',
      eighth: '1/8',
      '16th': '1/16',
      '32nd': '1/32',
    }[String(type || '').toLowerCase()];
    return base || '1/4';
  };

  const durationLabelToBeatsLocal = (durationLabel) => {
    const map = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 };
    return map[durationLabel] ?? 1;
  };

  const beatsPerMeasureFromTimeSig = (ts) => measureLengthInQuarterBeats(ts);

  const makeId = (prefix) => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const fillGapWithRests = (startBeat, endBeat) => {
    const rests = [];
    let t = startBeat;
    const durationsOrdered = [
      { beats: 4, label: '1/1' },
      { beats: 2, label: '1/2' },
      { beats: 1, label: '1/4' },
      { beats: 0.5, label: '1/8' },
      { beats: 0.25, label: '1/16' },
      { beats: 0.125, label: '1/32' },
    ];
    const remaining = () => endBeat - t;
    while (remaining() > 1e-6) {
      const r = remaining();
      const d = durationsOrdered.find((x) => x.beats <= r + 1e-6) || durationsOrdered[durationsOrdered.length - 1];
      rests.push({
        id: makeId('rest'),
        pitch: 'C',
        octave: 4,
        duration: d.beats,
        durationLabel: d.label,
        isDotted: false,
        isRest: true,
        beat: t,
      });
      t += d.beats;
      if (rests.length > 20000) break;
    }
    return rests;
  };

  /** Täida [0, endBeat) implitsiitse paadijärjestusega (beat-väljad ära, nagu import tail-fix). */
  const restPaddingImplicitFromZeroTo = useCallback((endBeat) => {
    if (!(Number(endBeat) > 1e-6)) return [];
    return fillGapWithRests(0, endBeat).map(({ beat, ...rest }) => rest);
  }, []);

  const normalizeNotesToGlobalTimeline = (notes, totalBeats) => {
    const sorted = [...(notes || [])].sort((a, b) => (Number(a.beat) || 0) - (Number(b.beat) || 0));
    const out = [];
    let cur = 0;
    for (const n of sorted) {
      const b = Number(n.beat) || 0;
      const dur = Number(n.duration) || 0;
      if (b > cur + 1e-6) out.push(...fillGapWithRests(cur, b));
      out.push({ ...n, beat: b });
      cur = Math.max(cur, b + dur);
    }
    if (totalBeats > cur + 1e-6) out.push(...fillGapWithRests(cur, totalBeats));
    // Remove beat property for compatibility (the renderer can handle it, but most editor logic uses implicit order).
    return out.map(({ beat, ...rest }) => rest);
  };

  const parseMusicXmlToOrchestration = (xmlText, fallbackFileName = '') => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) throw new Error('Vigane XML');

    const score = doc.querySelector('score-partwise, score-timewise');
    if (!score) throw new Error('Pole MusicXML (score-partwise)');

    const songTitleRaw =
      doc.querySelector('work work-title')?.textContent ||
      doc.querySelector('movement-title')?.textContent ||
      '';
    const composerRaw =
      doc.querySelector('identification creator[type="composer"]')?.textContent ||
      doc.querySelector('identification creator')?.textContent ||
      '';
    const songTitle = String(songTitleRaw || '').trim() || String(fallbackFileName || '').replace(/\.(musicxml|xml)$/i, '');
    const author = String(composerRaw || '').trim();

    // Global time signature (fallback 4/4). We’ll take the first one found.
    let beats = 4;
    let beatUnit = 4;
    const timeEl = doc.querySelector('attributes time');
    if (timeEl) {
      const b = parseInt(timeEl.querySelector('beats')?.textContent || '4', 10);
      const bt = parseInt(timeEl.querySelector('beat-type')?.textContent || '4', 10);
      if (!Number.isNaN(b) && b > 0) beats = b;
      if (!Number.isNaN(bt) && bt > 0) beatUnit = bt;
    }
    const timeSignature = { beats, beatUnit };
    const beatsPerMeasure = beatsPerMeasureFromTimeSig(timeSignature);

    // Part list to get human-readable names
    const partNameById = {};
    Array.from(doc.querySelectorAll('part-list score-part')).forEach((sp) => {
      const id = sp.getAttribute('id') || '';
      const name = sp.querySelector('part-name')?.textContent || '';
      if (id) partNameById[id] = String(name).trim() || id;
    });

    const parts = Array.from(doc.querySelectorAll('part'));
    if (!parts.length) throw new Error('MusicXML: part puudub');

    const parsedParts = parts.map((partEl, partIndex) => {
      const partId = partEl.getAttribute('id') || `P${partIndex + 1}`;
      const instrumentName = partNameById[partId] || partId;
      let divisionsPerQuarter = 1;
      let usesStaff2 = false;

      // detect staves=2 from attributes
      Array.from(partEl.querySelectorAll('measure')).forEach((m) => {
        const stavesEl = m.querySelector('attributes staves');
        if (stavesEl && String(stavesEl.textContent || '').trim() === '2') usesStaff2 = true;
        const divEl = m.querySelector('attributes divisions');
        if (divEl) {
          const v = parseInt(divEl.textContent || '1', 10);
          if (!Number.isNaN(v) && v > 0) divisionsPerQuarter = v;
        }
      });
      if (partEl.querySelector('note staff')?.textContent?.trim?.() === '2') usesStaff2 = true;

      const staffNotesByStaffNo = { 1: [], 2: [] };
      let globalDivPosByStaff = { 1: 0, 2: 0 };
      let measureIndex = 0;

      const measures = Array.from(partEl.querySelectorAll('measure'));
      measures.forEach((measureEl) => {
        // update divisions if specified in this measure
        const divEl = measureEl.querySelector('attributes divisions');
        if (divEl) {
          const v = parseInt(divEl.textContent || '1', 10);
          if (!Number.isNaN(v) && v > 0) divisionsPerQuarter = v;
        }
        // update time signature if specified in this measure (we still keep global, but can refresh)
        const time = measureEl.querySelector('attributes time');
        if (time) {
          const b = parseInt(time.querySelector('beats')?.textContent || String(beats), 10);
          const bt = parseInt(time.querySelector('beat-type')?.textContent || String(beatUnit), 10);
          if (!Number.isNaN(b) && b > 0) beats = b;
          if (!Number.isNaN(bt) && bt > 0) beatUnit = bt;
        }

        // Reset per-measure cursor for each staff, but keep global position based on measure index.
        const baseBeat = measureIndex * beatsPerMeasure;
        let cursorDivByStaff = { 1: 0, 2: 0 };

        const children = Array.from(measureEl.childNodes).filter((n) => n.nodeType === 1);
        children.forEach((node) => {
          const tag = node.nodeName;
          if (tag === 'note') {
            const voice = node.querySelector('voice')?.textContent?.trim?.();
            if (voice && voice !== '1') return; // keep voice 1 by default
            const staffNoRaw = node.querySelector('staff')?.textContent?.trim?.();
            const staffNo = staffNoRaw === '2' ? 2 : 1;
            if (staffNo === 2) usesStaff2 = true;

            const isChord = !!node.querySelector('chord');
            if (isChord) return;

            const durDiv = parseInt(node.querySelector('duration')?.textContent || '0', 10);
            const type = node.querySelector('type')?.textContent || 'quarter';
            const durationLabel = musicXmlTypeToDurationLabel(type);
            const dots = node.querySelectorAll('dot').length;
            const isDottedLocal = dots > 0;
            const fallbackBeats = durationLabelToBeatsLocal(durationLabel) * (isDottedLocal ? 1.5 : 1);
            const durationBeats = (Number.isFinite(durDiv) && durDiv > 0 && divisionsPerQuarter > 0)
              ? (durDiv / divisionsPerQuarter)
              : fallbackBeats;

            const beatPos = baseBeat + (cursorDivByStaff[staffNo] / divisionsPerQuarter);
            const isRestNode = !!node.querySelector('rest');
            const id = makeId('mx');
            if (isRestNode) {
              staffNotesByStaffNo[staffNo].push({
                id,
                pitch: 'C',
                octave: 4,
                duration: durationBeats,
                durationLabel,
                isDotted: isDottedLocal,
                isRest: true,
                beat: beatPos,
              });
            } else {
              const step = node.querySelector('pitch step')?.textContent || 'C';
              const octave = parseInt(node.querySelector('pitch octave')?.textContent || '4', 10);
              const alter = parseInt(node.querySelector('pitch alter')?.textContent || '0', 10);
              staffNotesByStaffNo[staffNo].push({
                id,
                pitch: String(step || 'C').toUpperCase(),
                octave: Number.isNaN(octave) ? 4 : octave,
                accidental: Number.isNaN(alter) ? 0 : clampNumber(alter, -2, 2),
                duration: durationBeats,
                durationLabel,
                isDotted: isDottedLocal,
                isRest: false,
                beat: beatPos,
              });
            }

            // advance cursor for that staff
            const advanceDiv = (Number.isFinite(durDiv) && durDiv > 0) ? durDiv : Math.round(durationBeats * divisionsPerQuarter);
            cursorDivByStaff[staffNo] += advanceDiv;
            globalDivPosByStaff[staffNo] = Math.max(globalDivPosByStaff[staffNo], measureIndex * beatsPerMeasure * divisionsPerQuarter + cursorDivByStaff[staffNo]);
          } else if (tag === 'forward' || tag === 'backup') {
            const durDiv = parseInt(node.querySelector('duration')?.textContent || '0', 10);
            if (!Number.isFinite(durDiv) || durDiv <= 0) return;
            // forward/backup apply to staff 1 by default (MusicXML), unless we can infer otherwise.
            const staffNo = 1;
            cursorDivByStaff[staffNo] += (tag === 'forward' ? durDiv : -durDiv);
            cursorDivByStaff[staffNo] = Math.max(0, cursorDivByStaff[staffNo]);
          }
        });

        measureIndex += 1;
      });

      const totalBeatsStaff1 = globalDivPosByStaff[1] / divisionsPerQuarter;
      const totalBeatsStaff2 = globalDivPosByStaff[2] / divisionsPerQuarter;
      const totalBeats = Math.max(totalBeatsStaff1, totalBeatsStaff2);

      const normalized1 = normalizeNotesToGlobalTimeline(staffNotesByStaffNo[1], totalBeats);
      const normalized2 = usesStaff2 ? normalizeNotesToGlobalTimeline(staffNotesByStaffNo[2], totalBeats) : [];

      return {
        partId,
        instrumentName,
        usesStaff2,
        notesStaff1: normalized1,
        notesStaff2: normalized2,
      };
    });

    const timeSigOut = { beats, beatUnit };
    return { songTitle, author, timeSignature: timeSigOut, parts: parsedParts };
  };

  const stopPedagogicalPlayback = useCallback(() => {
    if (pedagogicalPlaybackIntervalRef.current) {
      clearInterval(pedagogicalPlaybackIntervalRef.current);
      pedagogicalPlaybackIntervalRef.current = null;
    }
    if (pedagogicalAudioRef.current) {
      pedagogicalAudioRef.current.pause();
      pedagogicalAudioRef.current.currentTime = 0;
      pedagogicalAudioRef.current = null;
    }
    setIsPedagogicalAudioPlaying(false);
    setPedagogicalAudioCurrentTime(0);
  }, []);

  const applyParsedMusicXml = useCallback((parsed) => {
    stopPedagogicalPlayback();
    setTimeSignature(parsed.timeSignature);
    if (parsed.songTitle) setSongTitle(parsed.songTitle);
    if (parsed.author) setAuthor(parsed.author);

    const braceIds = {};
    const newStaves = [];
    parsed.parts.forEach((p) => {
      const safeName = (p.instrumentName || '').toLowerCase();
      const instrumentId =
        safeName.includes('violin') || safeName.includes('viiul') ? 'violin' :
        safeName.includes('voice') || safeName.includes('laul') ? 'voice' :
        safeName.includes('cello') ? 'bass' :
        safeName.includes('piano') || safeName.includes('klaver') ? 'piano' :
        'piano';

      if (p.usesStaff2) {
        const braceGroupId = braceIds[p.partId] || makeId('brace');
        braceIds[p.partId] = braceGroupId;
        newStaves.push({ id: makeId('staff'), instrumentId, clefType: 'treble', notes: p.notesStaff1, braceGroupId, notationMode: notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional', name: p.instrumentName });
        newStaves.push({ id: makeId('staff'), instrumentId, clefType: 'bass', notes: p.notesStaff2, braceGroupId, notationMode: notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional', name: p.instrumentName });
      } else {
        newStaves.push({ id: makeId('staff'), instrumentId, clefType: 'treble', notes: p.notesStaff1, notationMode: notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional', name: p.instrumentName });
      }
    });
    if (newStaves.length > 0) {
      const staffDur = (s) => (s?.notes || []).reduce((acc, n) => acc + (Number(n.duration) || 0), 0);
      const maxBeats = Math.max(0, ...newStaves.map(staffDur));
      const padded = newStaves.map((s) => {
        const cur = staffDur(s);
        if (maxBeats <= cur + 1e-6) return s;
        const tailRests = fillGapWithRests(cur, maxBeats).map(({ beat, ...rest }) => rest);
        return { ...s, notes: [...(s.notes || []), ...tailRests] };
      });
      setStaves(padded);
      setActiveStaffIndex(0);
    }
    setCursorPosition(0);
    setSetupCompleted(true);
    dirtyRef.current = true;
    setSaveFeedback('MusicXML imporditud');
    setTimeout(() => setSaveFeedback(''), 1800);
  }, [notationMode, stopPedagogicalPlayback]);

  const beginImportTimeline = useCallback((type, steps, initialAccuracy = null) => {
    setImportTimeline({
      type,
      steps: Array.isArray(steps) ? steps : [],
      current: 0,
      accuracy: initialAccuracy,
      status: 'running',
      startedAt: Date.now(),
    });
  }, []);

  const advanceImportTimeline = useCallback((stepIndex, nextAccuracy = null) => {
    setImportTimeline((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        current: Math.max(0, Math.min(stepIndex, Math.max(0, prev.steps.length - 1))),
        accuracy: nextAccuracy ?? prev.accuracy,
      };
    });
  }, []);

  const finishImportTimeline = useCallback((ok, nextAccuracy = null) => {
    setImportTimeline((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: ok ? 'done' : 'error',
        current: Math.max(0, prev.steps.length - 1),
        accuracy: nextAccuracy ?? prev.accuracy,
      };
    });
    setTimeout(() => {
      setImportTimeline((prev) => (prev?.status === 'running' ? prev : null));
    }, ok ? 5500 : 7000);
  }, []);

  const handleImportMusicXmlFile = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const name = String(file.name || '').toLowerCase();
    if (!(file.type.includes('xml') || name.endsWith('.xml') || name.endsWith('.musicxml'))) {
      setSaveFeedback('Toetatud: MusicXML (.xml / .musicxml)');
      setTimeout(() => setSaveFeedback(''), 2200);
      e.target.value = '';
      return;
    }
    beginImportTimeline('xml', ['Fail valitud', 'XML loetakse', 'Struktuur parsitakse', 'Noodid kaardistatakse', 'Valmis'], 0.6);
    const reader = new FileReader();
    reader.onloadstart = () => {
      advanceImportTimeline(1, 0.7);
      setSaveFeedback('XML faili lugemine...');
    };
    reader.onload = () => {
      try {
        advanceImportTimeline(2, 0.82);
        const txt = typeof reader.result === 'string' ? reader.result : '';
        const parsed = parseMusicXmlToOrchestration(txt, file?.name || '');
        advanceImportTimeline(3, 0.92);
        applyParsedMusicXml(parsed);
        finishImportTimeline(true, 0.95);
      } catch (err) {
        console.error(err);
        setSaveFeedback('MusicXML import ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 2200);
        finishImportTimeline(false);
      }
    };
    reader.onerror = () => {
      setSaveFeedback('MusicXML faili lugemine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 2200);
      finishImportTimeline(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [applyParsedMusicXml, beginImportTimeline, advanceImportTimeline, finishImportTimeline]);

  // Animatsiooni eksport video failina (MP4 või WebM) – alla laadimine või Google Drive
  const exportAnimationAsVideo = useCallback(async ({ download = false, saveToDrive = false } = {}) => {
    if (!isPedagogicalProject || !scoreContainerRef.current) {
      setSaveFeedback(t('file.exportAnimationNoProject'));
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    const totalBeats = notes.reduce((acc, n) => acc + n.duration, 0);
    const bpm = Math.max(20, Math.min(300, pedagogicalAudioBpm));
    const durationSec = pedagogicalAudioUrl && pedagogicalAudioDuration > 0
      ? pedagogicalAudioDuration
      : totalBeats * 60 / bpm;
    if (durationSec <= 0) {
      setSaveFeedback(t('file.exportAnimationNoContent'));
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    setIsExportingAnimation(true);
    setSaveFeedback(t('file.exportAnimationExporting'));
    stopPedagogicalPlayback();
    setCursorPosition(0);

    const container = scoreContainerRef.current;
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w <= 0 || h <= 0) {
      setIsExportingAnimation(false);
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const fps = 15;
    const stream = canvas.captureStream(fps);

    let audioStream = null;
    let exportAudio = null;
    if (pedagogicalAudioUrl) {
      exportAudio = new Audio(pedagogicalAudioUrl);
      try {
        if (typeof exportAudio.captureStream === 'function') {
          audioStream = exportAudio.captureStream();
        }
      } catch (_) {}
    }
    const combinedStream = audioStream
      ? new MediaStream([...stream.getVideoTracks(), ...audioStream.getAudioTracks()])
      : stream;

    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const ext = mimeType === 'video/mp4' ? 'mp4' : 'webm';
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: audioStream ? 128000 : undefined
    });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start(500);

    const startTime = Date.now();
    exportAudio?.play().catch(() => {});

    const captureFrame = () => {
      if (Date.now() - startTime >= durationSec * 1000 + 500) {
        clearInterval(frameInterval);
        recorder.stop();
        return;
      }
      const elapsed = (Date.now() - startTime) / 1000;
      const beat = (elapsed * bpm) / 60;
      const totalBeatsNow = notes.reduce((acc, n) => acc + n.duration, 0);
      setCursorPosition(Math.max(0, Math.min(totalBeatsNow, beat)));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          html2canvas(container, { scale: 1, useCORS: true, logging: false }).then((captureCanvas) => {
            ctx.drawImage(captureCanvas, 0, 0, w, h);
            const cur = exportCursorRef.current;
            if (cur && cur.emoji) {
              ctx.font = `${cur.size}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(cur.emoji, cur.x, cur.y);
            }
          }).catch(() => {});
        });
      });
    };
    const frameInterval = setInterval(captureFrame, 1000 / fps);
    captureFrame();

    const onStop = async () => {
      clearInterval(frameInterval);
      exportAudio?.pause();
      const blob = new Blob(chunks, { type: mimeType });
      const filename = ((songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || 'animation') + '.' + ext;
      if (download) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setSaveFeedback(t('file.exportAnimationDone'));
      }
      if (saveToDrive) {
        const token = googleDrive.getStoredToken();
        if (!token) {
          setSaveFeedback(t('feedback.loginGoogle'));
        } else {
          setSaveFeedback(t('feedback.saving'));
          try {
            const folderId = await googleDrive.pickFolder(token);
            if (!folderId) { setSaveFeedback(''); setIsExportingAnimation(false); return; }
            await googleDrive.uploadBinaryFileInFolder(token, folderId, filename, blob, 'video/' + ext);
            setSaveFeedback(t('feedback.savedToCloud'));
          } catch (e) {
            setSaveFeedback(e?.message || t('feedback.cloudError'));
          }
          setTimeout(() => setSaveFeedback(''), 2500);
          setIsExportingAnimation(false);
          return;
        }
      }
      setTimeout(() => setSaveFeedback(''), 2500);
      setIsExportingAnimation(false);
    };

    recorder.onstop = onStop;
    setTimeout(() => {
      if (recorder.state === 'recording') {
        clearInterval(frameInterval);
        exportAudio?.pause();
        recorder.stop();
      }
    }, durationSec * 1000 + 1500);
  }, [isPedagogicalProject, notes, pedagogicalAudioUrl, pedagogicalAudioDuration, pedagogicalAudioBpm, songTitle, stopPedagogicalPlayback, t]);

  const printOptionsRef = useRef({ paperSize: 'a4', pageOrientation: 'portrait' });
  const pdfExportOptionsRef = useRef({ pageFlowDirection: 'vertical', pageWidth: LAYOUT.PAGE_WIDTH_PX });
  const exportLayoutSnapshotRef = useRef(null);
  /** Vältib beforeprint → iframe.print() võimalikku enne uuesti käivitumist. */
  const nmBeforePrintIframeBusyRef = useRef(false);

  const buildScoreExportSnapshot = useCallback((containerEl) => {
    if (!containerEl) {
      throw new Error('Export snapshot failed: score container missing');
    }
    const notationSvgElement = exportNotationSvgRef.current || undefined;
    const exportScaleFactor = scoreZoomLevelRef.current * ((viewFitPage || viewSmartPage) ? fitPageScaleRef.current : 1);
    const explicitBounds = exportContentBoundsRef.current || { width: 0, height: 0 };
    return scoreToSvg(containerEl, {
      pageDesignDataUrl: pageDesignDataUrl || null,
      pageDesignOpacity,
      songTitle,
      author,
      footerText: copyrightFooter,
      documentFontFamily,
      titleFontFamily,
      authorFontFamily,
      titleFontSize,
      authorFontSize,
      titleBold,
      titleItalic,
      authorBold,
      authorItalic,
      titleAlignment,
      authorAlignment,
      textBoxes,
      paperSize,
      pageOrientation,
      pageFlowDirection: pdfExportOptionsRef.current?.pageFlowDirection ?? 'vertical',
      notationSvgElement,
      exportScaleFactor,
      contentWidth: explicitBounds.width,
      contentHeight: explicitBounds.height,
      layoutSnapshot: exportLayoutSnapshotRef.current,
    });
  }, [
    pageDesignDataUrl,
    pageDesignOpacity,
    songTitle,
    author,
    copyrightFooter,
    documentFontFamily,
    titleFontFamily,
    authorFontFamily,
    titleFontSize,
    authorFontSize,
    titleBold,
    titleItalic,
    authorBold,
    authorItalic,
    titleAlignment,
    authorAlignment,
    textBoxes,
    pageOrientation,
    paperSize,
    viewFitPage,
    viewSmartPage,
  ]);

  const handlePrint = useCallback(() => {
    setHeaderMenuOpen(null);
    const el = scoreContainerRef?.current;
    if (!el) {
      window.print();
      return;
    }
    try {
      const pageModel = buildScoreExportSnapshot(el);
      const pagesInner = buildNmPrintSvgPagesMarkup(pageModel, { paperSize, pageOrientation });
      const html = buildNmStandalonePrintDocumentHtml(pagesInner, {
        paperSize: pageModel.paperSize || paperSize,
        pageOrientation: pageModel.orientation || pageOrientation,
      });
      runIsolatedPrintFromHtml(html, { blankHostDocument: false });
    } catch (e) {
      try { console.error('[print isolated document failed]', e); } catch (_) {}
      setSaveFeedback(e?.message || t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2500);
    }
  }, [buildScoreExportSnapshot, paperSize, pageOrientation, setSaveFeedback, t]);

  useEffect(() => {
    printOptionsRef.current = { paperSize, pageOrientation };
  }, [paperSize, pageOrientation]);

  useEffect(() => {
    const onBeforePrint = () => {
      if (nmBeforePrintIframeBusyRef.current) return;
      const el = scoreContainerRef?.current;
      if (!el) return;
      // Sama isoleeritud iframe-print mis handlePrint; põhidokument “tühi” (nm-print-svg-mode),
      // et brauseri menüü Print ei peaks näitama SPA DOM-i.
      nmBeforePrintIframeBusyRef.current = true;
      try {
        const pageModel = buildScoreExportSnapshot(el);
        try {
          const snap = pageModel?.layoutSnapshot;
          if (snap && snap.source) console.info('[print layout snapshot]', snap);
        } catch (_) {}
        const pagesInner = buildNmPrintSvgPagesMarkup(pageModel, { paperSize, pageOrientation });
        const html = buildNmStandalonePrintDocumentHtml(pagesInner, {
          paperSize: pageModel.paperSize || paperSize,
          pageOrientation: pageModel.orientation || pageOrientation,
        });
        runIsolatedPrintFromHtml(html, {
          blankHostDocument: true,
          onFinished: () => {
            nmBeforePrintIframeBusyRef.current = false;
          },
        });
      } catch (e) {
        nmBeforePrintIframeBusyRef.current = false;
        try { console.error('[print beforeprint iframe failed]', e); } catch (_) {}
        setSaveFeedback(e?.message || t('feedback.exportFailed'));
        setTimeout(() => setSaveFeedback(''), 2500);
      }
    };
    window.addEventListener('beforeprint', onBeforePrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
    };
  }, [buildScoreExportSnapshot, pageOrientation, paperSize, t]);

  useEffect(() => {
    if (!showPdfExportPreview || !scoreContainerRef?.current) return;
    setPdfPreviewPageSvgHtml('');
    setPdfPreviewSvgData(null);
    setPdfPreviewError('');
    setPdfPreviewPageIndex(0);
    const el = scoreContainerRef.current;
    el.classList.add('noodimeister-export-capture');
    let cancelled = false;
    let retryTimer = null;
    const cleanup = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (el.classList.contains('noodimeister-export-capture')) el.classList.remove('noodimeister-export-capture');
    };
    const runCapture = (attempt = 0) => {
      if (cancelled) return;
      /* Proovime esmalt SVG-põhist eelvaadet (viewBox 0 0 794 1123, vektorid, ilma mastaabikadudeta). */
      try {
        const pageModel = buildScoreExportSnapshot(el);
        try {
          const snap = pageModel?.layoutSnapshot;
          if (snap && snap.source) console.info('[pdf preview layout snapshot]', snap);
        } catch (_) {}
        const { defsString, contentString, orientation, footerText } = pageModel;
        const firstPageSvg = getPageSvgString(defsString, contentString, pageModel, 0, { footerText });
        const smuflCheck = validateSmuflTimeSigExport({ defsString, contentString });
        setPdfPreviewPageSvgHtml(smuflCheck.ok ? firstPageSvg : rewriteSmuflTimeSigDigitsToAscii(firstPageSvg));
        const dims = getScorePageDimensions(orientation, pageModel.paperSize || paperSize);
        setPdfPreviewSize({ w: dims.width, h: dims.height });
        setPdfPreviewSvgData(pageModel);
        setPdfPreviewError('');
        cleanup();
      } catch (e) {
        // Score SVG võib avamise hetkel veel renderduda; proovi lühidalt uuesti enne vea kuvamist.
        if (attempt < 12) {
          retryTimer = setTimeout(() => runCapture(attempt + 1), 120);
          return;
        }
        // Strict mode: no PNG fallback; keep preview/export deterministic with SVG model only.
        cleanup();
        setPdfPreviewPageSvgHtml('');
        setPdfPreviewSize({ w: 0, h: 0 });
        setPdfPreviewSvgData(null);
        try {
          console.error('[PDF preview capture failed]', {
            message: e?.message || String(e),
            attempt,
            pageOrientation,
            viewFitPage,
            viewSmartPage,
            scoreZoomLevel: scoreZoomLevelRef.current,
            fitPageScale: fitPageScaleRef.current,
          });
        } catch (_) { /* ignore logging errors */ }
        const msg = e?.message || t('feedback.exportFailed');
        setPdfPreviewError(msg);
        setSaveFeedback(msg);
        setTimeout(() => setSaveFeedback(''), 2500);
      }
    };
    requestAnimationFrame(() => runCapture());
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [showPdfExportPreview, pdfPreviewCaptureKey, pageOrientation, paperSize, buildScoreExportSnapshot, viewFitPage, viewSmartPage, t]);

  useEffect(() => {
    if (!showPdfExportPreview) return;
    if (!pdfPreviewSvgData?.defsString || !pdfPreviewSvgData?.contentString) return;
    const safeTotal = Math.max(1, pdfPreviewTotalPages || 1);
    const safeIdx = Math.max(0, Math.min(safeTotal - 1, Number(pdfPreviewPageIndex) || 0));
    if (safeIdx !== pdfPreviewPageIndex) {
      setPdfPreviewPageIndex(safeIdx);
      return;
    }
    const { defsString, contentString, footerText } = pdfPreviewSvgData;
    const pageSvg = getPageSvgString(defsString, contentString, pdfPreviewSvgData, safeIdx, { footerText });
    const smuflCheck = validateSmuflTimeSigExport({ defsString, contentString });
    setPdfPreviewPageSvgHtml(smuflCheck.ok ? pageSvg : rewriteSmuflTimeSigDigitsToAscii(pageSvg));
  }, [showPdfExportPreview, pdfPreviewSvgData, pdfPreviewPageIndex, pdfPreviewTotalPages]);

  const handlePdfPreviewFit = useCallback(() => {
    setPdfPreviewZoom(1);
  }, []);

  const handlePdfExportChooseLocation = useCallback(async () => {
    const filename = ((songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || 'score') + '.pdf';
    try {
      if (typeof window.showSaveFilePicker !== 'function') {
        setPdfExportSaveLocation('downloads');
        return;
      }
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      setPdfExportFileHandle(handle);
      setPdfExportChosenPath(handle.name || filename);
      setPdfExportSaveLocation('custom');
    } catch (e) {
      if (e?.name !== 'AbortError') setPdfExportSaveLocation('downloads');
    }
  }, [songTitle, t]);

  const exportToPdf = useCallback(async (saveOptions = {}) => {
    const { fileHandle, usePreviewSvg, previewSvgData } = saveOptions;
    const useSvgExport = Boolean(usePreviewSvg && previewSvgData?.defsString != null && previewSvgData?.contentString != null);
    if (!useSvgExport) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
      return;
    }
    setIsExportingPdf(true);
    setSaveFeedback('PDF…');
    setShowPageNavigator(true);
    await new Promise((r) => setTimeout(r, 150));
    try {
      /* SVG → PDF vektoritega (svg2pdf.js): terav, viewBox sünkroonitud orientationiga (portrait 794×1123, landscape 1123×794). */
      const { defsString, contentString, contentHeight, orientation, footerText, pageMetrics, flowDirection } = previewSvgData;
      let smuflExportOk = true;
      try {
        const smuflCheck = validateSmuflTimeSigExport({ defsString: previewSvgData.defsString, contentString: previewSvgData.contentString });
        smuflExportOk = smuflCheck.ok !== false;
        if (!smuflCheck.ok && smuflCheck.error) console.warn('[PDF export SMuFL preflight]', smuflCheck.error);
      } catch (_) { /* ignore */ }
      const orient = (orientation ?? pageOrientation) === 'landscape' ? 'landscape' : 'portrait';
      const flowDir = flowDirection === 'horizontal' ? 'horizontal' : 'vertical';
      const pageExtentPx = pageMetrics
        ? (flowDir === 'horizontal' ? pageMetrics.widthPx : pageMetrics.heightPx)
        : (orient === 'landscape' ? 794 : 1123);
      const numPages = getPageCount(Number(contentHeight) || pageExtentPx, pageExtentPx);
      const paper = normalizePaperSize(pageMetrics?.paperSize || paperSize);
      const pdf = new jsPDF({ orientation: orient, unit: 'pt', format: paper });
      await registerSmuflFontsForJsPdf(pdf);
      const widthPt = pageMetrics?.widthPt ?? (orient === 'landscape' ? 841.89 : 595.28);
      const heightPt = pageMetrics?.heightPt ?? (orient === 'landscape' ? 595.28 : 841.89);
      for (let p = 0; p < numPages; p++) {
        if (p > 0) pdf.addPage(paper, orient);
        const pageSvgString = getPageSvgString(defsString, contentString, previewSvgData, p, { footerText });
        const exportPageSvg = smuflExportOk ? pageSvgString : rewriteSmuflTimeSigDigitsToAscii(pageSvgString);
        const wrap = document.createElement('div');
        wrap.innerHTML = exportPageSvg;
        const svgEl = wrap.querySelector('svg');
        if (svgEl) {
          await pdf.svg(svgEl, { x: 0, y: 0, width: widthPt, height: heightPt });
        }
      }
      const filename = ((songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || 'score') + '.pdf';
      if (fileHandle && typeof fileHandle.createWritable === 'function') {
        const blob = pdf.output('blob');
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        pdf.save(filename);
      }
      setSaveFeedback('');
    } catch (e) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
    } finally {
      setIsExportingPdf(false);
    }
  }, [songTitle, t, pageOrientation, paperSize]);

  const printPdfBlob = useCallback(async (blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = url;
    document.body.appendChild(iframe);
    const cleanup = () => {
      try { iframe.remove(); } catch (_) {}
      try { URL.revokeObjectURL(url); } catch (_) {}
    };
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus?.();
        iframe.contentWindow?.print?.();
      } finally {
        setTimeout(cleanup, 1500);
      }
    };
  }, []);

  const printFromPdfPreview = useCallback(async () => {
    if (isExportingPdf) return;
    if (!pdfPreviewSvgData?.defsString || !pdfPreviewSvgData?.contentString) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
      return;
    }
    setIsExportingPdf(true);
    setSaveFeedback(t('file.print') || 'Print');
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { defsString, contentString, contentHeight, orientation, footerText, pageMetrics, flowDirection } = pdfPreviewSvgData;
      let smuflPrintOk = true;
      try {
        const smuflCheck = validateSmuflTimeSigExport({ defsString: pdfPreviewSvgData.defsString, contentString: pdfPreviewSvgData.contentString });
        smuflPrintOk = smuflCheck.ok !== false;
        if (!smuflCheck.ok && smuflCheck.error) console.warn('[Print SMuFL preflight]', smuflCheck.error);
      } catch (_) { /* ignore */ }
      const orient = (orientation ?? pageOrientation) === 'landscape' ? 'landscape' : 'portrait';
      const flowDir = flowDirection === 'horizontal' ? 'horizontal' : 'vertical';
      const pageExtentPx = pageMetrics
        ? (flowDir === 'horizontal' ? pageMetrics.widthPx : pageMetrics.heightPx)
        : (orient === 'landscape' ? 794 : 1123);
      const numPages = getPageCount(Number(contentHeight) || pageExtentPx, pageExtentPx);
      const paper = normalizePaperSize(pageMetrics?.paperSize || paperSize);
      const pdf = new jsPDF({ orientation: orient, unit: 'pt', format: paper });
      await registerSmuflFontsForJsPdf(pdf);
      const widthPt = pageMetrics?.widthPt ?? (orient === 'landscape' ? 841.89 : 595.28);
      const heightPt = pageMetrics?.heightPt ?? (orient === 'landscape' ? 595.28 : 841.89);
      for (let p = 0; p < numPages; p++) {
        if (p > 0) pdf.addPage(paper, orient);
        const pageSvgString = getPageSvgString(defsString, contentString, pdfPreviewSvgData, p, { footerText });
        const printPageSvg = smuflPrintOk ? pageSvgString : rewriteSmuflTimeSigDigitsToAscii(pageSvgString);
        const wrap = document.createElement('div');
        wrap.innerHTML = printPageSvg;
        const svgEl = wrap.querySelector('svg');
        if (svgEl) await pdf.svg(svgEl, { x: 0, y: 0, width: widthPt, height: heightPt });
      }
      await printPdfBlob(pdf.output('blob'));
    } catch (_) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
    } finally {
      setIsExportingPdf(false);
      setSaveFeedback('');
    }
  }, [isExportingPdf, pageOrientation, paperSize, pdfPreviewSvgData, printPdfBlob, t]);

  // Build state to persist
  const getPersistedState = useCallback(() => ({
    staves,
    activeStaffIndex,
    staffYOffsets,
    measureStretchFactors: measureStretchFactors?.length ? measureStretchFactors : undefined,
    systemYOffsets: systemYOffsets?.length ? systemYOffsets : undefined,
    timeSignature,
    timeSignatureMode,
    keySignature,
    staffLines,
    notationStyle,
    pixelsPerBeat,
    notationMode,
    instrumentNotationVariant,
    linkedNotationByStaffId: Object.keys(linkedNotationByStaffId || {}).length ? linkedNotationByStaffId : undefined,
    tinWhistleLinkedFingeringUiPercent: tinWhistleLinkedFingeringScalePercent,
    cursorPosition,
    addedMeasures,
    measureRepeatMarks: Object.keys(measureRepeatMarks).length ? measureRepeatMarks : undefined,
    setupCompleted,
    songTitle,
    author,
    copyrightFooter,
    pickupEnabled,
    pickupQuantity,
    pickupDuration,
    pageOrientation,
    paperSize,
    layoutMeasuresPerLine,
    layoutLineBreakBefore,
    layoutPageBreakBefore,
    layoutExtraPages,
    layoutSystemGap,
    layoutPartsGap,
    layoutPartsGapMm,
    layoutSizeUnit,
    layoutConnectedBarlines,
    layoutGlobalSpacingMultiplier,
    viewMode,
    partLayoutMeasuresPerLine,
    partLayoutLineBreakBefore,
    partLayoutPageBreakBefore,
    partLayoutExtraPages,
    showPageNavigator,
    pageFlowDirection,
    viewFitPage,
    viewSmartPage,
    visibleToolIds,
    tuningReferenceNote,
    tuningReferenceOctave,
    tuningReferenceHz,
    playNoteOnInsert,
    figurenotesSize,
    figurenotesStems,
    figurenotesChordLineGap,
    figurenotesChordBlocks,
    figurenotesChordBlocksShowTones,
    figurenotesMelodyShowNoteNames,
    timeSignatureSize,
    pedagogicalTimeSigDenominatorType,
    pedagogicalTimeSigDenominatorColor,
    pedagogicalTimeSigDenominatorInstrument,
    pedagogicalTimeSigDenominatorEmoji,
    showBarNumbers,
    barNumberSize,
    showRhythmSyllables,
    showAllNoteLabels,
    enableEmojiOverlays,
    joClefStaffPosition,
    relativeNotationShowKeySignature,
    relativeNotationShowTraditionalClef,
    isPedagogicalProject,
    pedagogicalAudioBpm,
    pedagogicalAudioPlaybackRate,
    pedagogicalAudioData: pedagogicalAudioDataRef.current || undefined,
    pedagogicalPlayheadStyle,
    pedagogicalPlayheadEmoji,
    pedagogicalPlayheadEmojiSize,
    cursorSizePx,
    cursorLineStrokeWidth,
    pedagogicalPlayheadMovement,
    chords,
    textBoxes,
    documentFontFamily,
    lyricFontFamily,
    titleFontSize,
    authorFontSize,
    titleFontFamily: titleFontFamily || undefined,
    authorFontFamily: authorFontFamily || undefined,
    titleBold,
    titleItalic,
    authorBold,
    authorItalic,
    titleAlignment,
    authorAlignment,
    staffRowAlignment,
    pageDesignDataUrl: pageDesignDataUrl || undefined,
    pageDesignOpacity,
    pageDesignFit,
    pageDesignLayer: 'behind',
    pageDesignPositionX,
    pageDesignPositionY,
    pageDesignCrop,
    visibleStaves: visibleStaves.length === staves.length ? visibleStaves : staves.map(() => true),
    instrumentPartGroups,
    intermissionLabels,
    lyricLineIndex,
    lyricLineYOffset,
    lyricFontSize,
    noteheadShape,
    noteheadEmoji
  }), [staves, activeStaffIndex, staffYOffsets, measureStretchFactors, systemYOffsets, visibleStaves, instrumentPartGroups, intermissionLabels, timeSignature, timeSignatureMode, keySignature, staffLines, notationStyle, pixelsPerBeat, notationMode, instrumentNotationVariant, linkedNotationByStaffId, tinWhistleLinkedFingeringScalePercent, cursorPosition, addedMeasures, measureRepeatMarks, setupCompleted, songTitle, author, pickupEnabled, pickupQuantity, pickupDuration, pageOrientation, paperSize, layoutMeasuresPerLine, layoutLineBreakBefore, layoutPageBreakBefore, layoutExtraPages, layoutSystemGap, layoutPartsGap, layoutPartsGapMm, layoutSizeUnit, layoutConnectedBarlines, layoutGlobalSpacingMultiplier, viewMode, partLayoutMeasuresPerLine, partLayoutLineBreakBefore, partLayoutPageBreakBefore, partLayoutExtraPages, showPageNavigator, pageFlowDirection, viewFitPage, viewSmartPage, visibleToolIds, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, figurenotesChordLineGap, figurenotesChordBlocks, figurenotesChordBlocksShowTones, figurenotesMelodyShowNoteNames, timeSignatureSize, pedagogicalTimeSigDenominatorType, pedagogicalTimeSigDenominatorColor, pedagogicalTimeSigDenominatorInstrument, pedagogicalTimeSigDenominatorEmoji, showBarNumbers, barNumberSize, showRhythmSyllables, showAllNoteLabels, enableEmojiOverlays, joClefStaffPosition, relativeNotationShowKeySignature, relativeNotationShowTraditionalClef, isPedagogicalProject, pedagogicalAudioBpm, pedagogicalAudioPlaybackRate, pedagogicalPlayheadStyle, pedagogicalPlayheadEmoji, pedagogicalPlayheadEmojiSize, cursorLineStrokeWidth, pedagogicalPlayheadMovement, chords, textBoxes, documentFontFamily, lyricFontFamily, titleFontSize, authorFontSize, titleFontFamily, authorFontFamily, titleBold, titleItalic, authorBold, authorItalic, titleAlignment, authorAlignment, staffRowAlignment, pageDesignDataUrl, pageDesignOpacity, pageDesignFit, pageDesignPositionX, pageDesignPositionY, pageDesignCrop, lyricLineIndex, lyricLineYOffset, lyricFontSize, noteheadShape, noteheadEmoji]);

  const saveToStorageSync = useCallback(() => {
    try {
      const state = getPersistedState();
      lastPersistedRef.current = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      dirtyRef.current = false;
    } catch (_) {}
  }, [getPersistedState]);

  const saveToStorage = useCallback(() => {
    try {
      saveToStorageSync();
      setSaveFeedback(t('feedback.saved'));
      setTimeout(() => setSaveFeedback(''), 1800);
    } catch (e) {
      setSaveFeedback(t('feedback.saveError'));
      setTimeout(() => setSaveFeedback(''), 2000);
    }
  }, [saveToStorageSync]);

  const clearDirty = useCallback(() => { dirtyRef.current = false; }, []);

  const handleSaveAndExit = useCallback(() => {
    saveToStorageSync();
    navigate('/tood');
  }, [saveToStorageSync, navigate]);

  // Project file export must use the same canonical snapshot as runtime persistence.
  // This prevents drift where cloud/file exports miss fields that local restore includes.
  const exportScoreToJSON = useCallback(() => {
    const state = getPersistedState();
    return {
      version: 1,
      ...state,
      songTitle: state.songTitle || '',
      author: state.author || '',
      copyrightFooter: state.copyrightFooter || '',
      staves: Array.isArray(state.staves) ? state.staves : [],
      scoreData: Array.isArray(state.staves) && state.staves[0] ? state.staves[0].notes : [],
    };
  }, [getPersistedState]);

  // Download project file (future: replace with upload to Google Drive / OneDrive)
  const downloadProject = useCallback(() => {
    try {
      const data = exportScoreToJSON();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.nm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSaveFeedback(t('feedback.projectSaved'));
      setTimeout(() => setSaveFeedback(''), 1800);
    } catch (e) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
    }
  }, [exportScoreToJSON]);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECT_IO_STORAGE_KEY, JSON.stringify({
        saveTarget: projectSaveTarget,
        loadSource: projectLoadSource,
      }));
    } catch (_) { /* ignore */ }
  }, [projectSaveTarget, projectLoadSource]);

  const saveToDesktop = useCallback(async ({ pickLocation = false } = {}) => {
    try {
      const data = exportScoreToJSON();
      const json = JSON.stringify(data, null, 2);
      const filename = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.nm';
      const canPick = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
      if (!canPick) {
        downloadProject();
        return;
      }
      let handle = projectFileHandle;
      if (!handle || pickLocation) {
        handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'NoodiMeister project', accept: { 'application/json': ['.nm', '.json'] } }],
        });
        setProjectFileHandle(handle);
      }
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      setProjectChosenPath(handle?.name || filename);
      setSaveFeedback('Salvestatud arvutisse!');
      setTimeout(() => setSaveFeedback(''), 2200);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setSaveFeedback(e?.message || 'Arvutisse salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [downloadProject, exportScoreToJSON, projectFileHandle, t]);

  const openProjectFromDesktop = useCallback(async () => {
    try {
      const canPick = typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
      if (!canPick) {
        projectFileInputRef.current?.click();
        return;
      }
      const [fileHandle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'NoodiMeister project', accept: { 'application/json': ['.nm', '.json'] } }],
      });
      if (!fileHandle) return;
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text || '{}');
      if (importProject(data)) {
        setProjectChosenPath(fileHandle?.name || file?.name || '');
      } else {
        setSaveFeedback(t('feedback.invalidProject'));
        setTimeout(() => setSaveFeedback(''), 2000);
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      if (e instanceof SyntaxError) {
        setSaveFeedback(t('feedback.invalidJson'));
        setTimeout(() => setSaveFeedback(''), 2000);
        return;
      }
      setSaveFeedback(e?.message || 'Faili avamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 2500);
    }
  // NOTE: importProject is declared later in this component; avoid TDZ by not
  // referencing it in this dependency array.
  }, [t]);

  // Re-hydrate workspace from JSON (future: can receive from cloud API)
  const importProject = useCallback((data) => {
    if (!data || typeof data !== 'object') return false;
    try {
      if (Array.isArray(data.staves) && data.staves.length > 0) {
        setStaves(data.staves);
        setActiveStaffIndex(typeof data.activeStaffIndex === 'number' ? Math.max(0, Math.min(data.activeStaffIndex, data.staves.length - 1)) : 0);
        if (Array.isArray(data.staffYOffsets)) setStaffYOffsets(data.staffYOffsets);
      if (Array.isArray(data.measureStretchFactors)) setMeasureStretchFactors(data.measureStretchFactors);
      if (Array.isArray(data.systemYOffsets)) setSystemYOffsets(data.systemYOffsets);
      } else {
        const scoreData = data.scoreData ?? data.notes;
        const notesArr = Array.isArray(scoreData) ? scoreData : [];
        const instId = data.instrument || 'single-staff-treble';
        const cfg = INSTRUMENT_CONFIG_BASE[instId];
        if (instId === 'piano' || cfg?.type === 'grandStaff') {
          const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
          const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-a`;
          const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-b`;
          setStaves([
            { id: id1, instrumentId: 'piano', clefType: 'treble', notes: notesArr, braceGroupId, notationMode: data.notationMode ?? 'traditional' },
            { id: id2, instrumentId: 'piano', clefType: 'bass', notes: [], braceGroupId, notationMode: data.notationMode ?? 'traditional' }
          ]);
        } else {
          setStaves([{ id: '1', instrumentId: instId, clefType: (cfg?.defaultClef) || data.clefType || 'treble', notes: notesArr, notationMode: data.notationMode ?? 'traditional' }]);
        }
        setActiveStaffIndex(0);
      }
      if (data.timeSignature) setTimeSignature(data.timeSignature);
      if (data.timeSignatureMode) setTimeSignatureMode(data.timeSignatureMode);
      if (data.keySignature) setKeySignature(data.keySignature);
      if (data.staffLines != null) setStaffLines(data.staffLines);
      if (data.notationStyle) setNotationStyle(data.notationStyle);
      if (data.notationMode) setNotationMode(data.notationMode);
      if (data.noteheadShape) setNoteheadShape(data.noteheadShape);
      if (data.noteheadEmoji != null) setNoteheadEmoji(data.noteheadEmoji);
      if (data.pixelsPerBeat != null) setPixelsPerBeat(data.pixelsPerBeat);
      if (data.figurenotesSize != null) setFigurenotesSize(Math.max(12, Math.min(100, data.figurenotesSize)));
      if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
      if (data.figurenotesChordLineGap != null) setFigurenotesChordLineGap(Math.max(0, Math.min(20, Number(data.figurenotesChordLineGap))));
      if ('figurenotesChordBlocks' in data) setFigurenotesChordBlocks(!!data.figurenotesChordBlocks);
      if ('figurenotesChordBlocksShowTones' in data) setFigurenotesChordBlocksShowTones(!!data.figurenotesChordBlocksShowTones);
      if ('figurenotesMelodyShowNoteNames' in data) setFigurenotesMelodyShowNoteNames(!!data.figurenotesMelodyShowNoteNames);
      if (data.timeSignatureSize != null) setTimeSignatureSize(Math.max(12, Math.min(48, data.timeSignatureSize)));
      if (data.pedagogicalTimeSigDenominatorType) setPedagogicalTimeSigDenominatorType(String(data.pedagogicalTimeSigDenominatorType));
      if (data.pedagogicalTimeSigDenominatorColor) setPedagogicalTimeSigDenominatorColor(String(data.pedagogicalTimeSigDenominatorColor));
      if (data.pedagogicalTimeSigDenominatorInstrument) setPedagogicalTimeSigDenominatorInstrument(String(data.pedagogicalTimeSigDenominatorInstrument));
      if (data.pedagogicalTimeSigDenominatorEmoji != null) setPedagogicalTimeSigDenominatorEmoji(String(data.pedagogicalTimeSigDenominatorEmoji || '🥁'));
      if (data.isPedagogicalProject != null) setIsPedagogicalProject(!!data.isPedagogicalProject);
      if (data.pedagogicalAudioBpm != null) setPedagogicalAudioBpm(Math.max(20, Math.min(300, data.pedagogicalAudioBpm)));
      if (data.pedagogicalAudioPlaybackRate != null) setPedagogicalAudioPlaybackRate(clampNumber(Number(data.pedagogicalAudioPlaybackRate) || 1, 0.5, 2));
      if (data.pedagogicalPlayheadStyle) setPedagogicalPlayheadStyle(data.pedagogicalPlayheadStyle);
      if (data.pedagogicalPlayheadEmoji != null) setPedagogicalPlayheadEmoji(data.pedagogicalPlayheadEmoji);
      if (data.pedagogicalPlayheadEmojiSize != null) setPedagogicalPlayheadEmojiSize(Math.max(20, Math.min(60, data.pedagogicalPlayheadEmojiSize)));
      if (data.cursorSizePx != null) setCursorSizePx(Math.max(1, Math.min(500, data.cursorSizePx)));
      else if (data.pedagogicalPlayheadEmojiSize != null) setCursorSizePx(Math.max(1, Math.min(500, data.pedagogicalPlayheadEmojiSize)));
      if (data.pedagogicalPlayheadMovement === 'arch' || data.pedagogicalPlayheadMovement === 'horizontal') setPedagogicalPlayheadMovement(data.pedagogicalPlayheadMovement);
      if (data.cursorLineStrokeWidth != null) setCursorLineStrokeWidth(Math.max(1, Math.min(8, data.cursorLineStrokeWidth)));
      if (data.pedagogicalAudioData) {
        try {
          const binary = atob(data.pedagogicalAudioData);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          if (pedagogicalAudioUrlRef.current) URL.revokeObjectURL(pedagogicalAudioUrlRef.current);
          pedagogicalAudioUrlRef.current = url;
          pedagogicalAudioDataRef.current = data.pedagogicalAudioData;
          setPedagogicalAudioUrl(url);
          const audio = new Audio(url);
          audio.onloadedmetadata = () => setPedagogicalAudioDuration(audio.duration);
          audio.onerror = () => {};
        } catch (_) { /* ignore */ }
      }
      if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
      if (data.linkedNotationByStaffId && typeof data.linkedNotationByStaffId === 'object') setLinkedNotationByStaffId(data.linkedNotationByStaffId);
      {
        const twUi = readTinWhistleFingeringUiPercentFromPersisted(data);
        if (twUi != null) setTinWhistleLinkedFingeringScalePercent(twUi);
      }
      if (data.cursorPosition != null) setCursorPosition(data.cursorPosition);
      if (data.addedMeasures != null) {
        setAddedMeasures(data.addedMeasures);
      } else {
        // Infer from notes when loading old files that didn't save addedMeasures
        const stavesOrNotes = Array.isArray(data.staves) ? data.staves : [{ notes: Array.isArray(data.notes) ? data.notes : (data.scoreData ?? []) }];
        let maxEndBeat = 0;
        for (const s of stavesOrNotes) {
          const notes = s.notes || [];
          for (const n of notes) {
            const beat = Number(n.beat) || 0;
            const dur = Number(n.duration) || 0;
            if (beat + dur > maxEndBeat) maxEndBeat = beat + dur;
          }
        }
        if (maxEndBeat > 0) {
          const ts = data.timeSignature || { beats: 4, beatUnit: 4 };
          const beatsPerMeasure = Number(ts.beats) || 4;
          const beatUnit = Number(ts.beatUnit) || 4;
          let firstMeasureBeats = beatsPerMeasure;
          if (data.pickupEnabled && data.pickupQuantity && data.pickupDuration) {
            const denom = parseInt(String(data.pickupDuration).split('/')[1], 10) || 4;
            firstMeasureBeats = Math.max(0.25, Math.min((data.pickupQuantity * beatUnit) / denom, beatsPerMeasure - 0.25));
          }
          const beatsAfterFirst = Math.max(0, maxEndBeat - firstMeasureBeats);
          const measuresAfterFirst = Math.ceil(beatsAfterFirst / beatsPerMeasure);
          const inferredAdded = Math.max(0, measuresAfterFirst); // total = 1 + measuresAfterFirst, so addedMeasures = measuresAfterFirst
          setAddedMeasures(inferredAdded);
        }
      }
      if (data.setupCompleted != null) setSetupCompleted(data.setupCompleted);
      if (data.songTitle != null) setSongTitle(data.songTitle);
      if (data.author != null) setAuthor(data.author);
      if (data.copyrightFooter != null) setCopyrightFooter(String(data.copyrightFooter || ''));
      if (data.pickupEnabled != null) setPickupEnabled(data.pickupEnabled);
      if (data.pickupQuantity != null) setPickupQuantity(data.pickupQuantity);
      if (data.pickupDuration != null) setPickupDuration(data.pickupDuration);
      if (data.pageOrientation === 'portrait' || data.pageOrientation === 'landscape') setPageOrientation(data.pageOrientation);
      if (data.paperSize === 'a3' || data.paperSize === 'a4' || data.paperSize === 'a5') setPaperSize(data.paperSize);
      if (data.layoutMeasuresPerLine != null) setLayoutMeasuresPerLine(data.layoutMeasuresPerLine);
      if (Array.isArray(data.layoutLineBreakBefore)) setLayoutLineBreakBefore(data.layoutLineBreakBefore);
      if (Array.isArray(data.layoutPageBreakBefore)) setLayoutPageBreakBefore(data.layoutPageBreakBefore);
      if (data.layoutExtraPages != null) setLayoutExtraPages(Math.max(0, Math.round(Number(data.layoutExtraPages) || 0)));
      if (data.layoutSystemGap != null) setLayoutSystemGap(Math.max(5, Math.min(250, Number(data.layoutSystemGap))));
      if (data.layoutPartsGap != null) setLayoutPartsGap(Math.max(2, Math.min(80, Number(data.layoutPartsGap))));
      if (data.layoutPartsGapMm != null) setLayoutPartsGapMm(Math.max(0, Math.min(100, Number(data.layoutPartsGapMm))));
      if (data.layoutSizeUnit === 'mm' || data.layoutSizeUnit === 'cm') setLayoutSizeUnit(data.layoutSizeUnit);
      if (data.layoutConnectedBarlines != null) setLayoutConnectedBarlines(!!data.layoutConnectedBarlines);
      if (data.layoutGlobalSpacingMultiplier != null) setLayoutGlobalSpacingMultiplier(Math.max(0.5, Math.min(2, Number(data.layoutGlobalSpacingMultiplier) || 1)));
      if (data.viewMode === 'score' || data.viewMode === 'part') setViewMode(data.viewMode);
      if (data.partLayoutMeasuresPerLine != null) setPartLayoutMeasuresPerLine(data.partLayoutMeasuresPerLine);
      if (Array.isArray(data.partLayoutLineBreakBefore)) setPartLayoutLineBreakBefore(data.partLayoutLineBreakBefore);
      if (Array.isArray(data.partLayoutPageBreakBefore)) setPartLayoutPageBreakBefore(data.partLayoutPageBreakBefore);
      if (data.partLayoutExtraPages != null) setPartLayoutExtraPages(Math.max(0, Math.round(Number(data.partLayoutExtraPages) || 0)));
      if (data.showPageNavigator != null) setShowPageNavigator(!!data.showPageNavigator);
      if (data.pageFlowDirection === 'vertical' || data.pageFlowDirection === 'horizontal') setPageFlowDirection(data.pageFlowDirection);
      if (data.viewFitPage != null) setViewFitPage(!!data.viewFitPage);
      if (data.viewSmartPage != null) {
        const smart = !!data.viewSmartPage;
        setViewSmartPage(smart);
        if (smart) setViewFitPage(false);
      }
      if (Array.isArray(data.visibleToolIds) && data.visibleToolIds.length > 0) setVisibleToolIds(data.visibleToolIds);
      if (data.tuningReferenceNote) setTuningReferenceNote(data.tuningReferenceNote);
      if (data.tuningReferenceOctave != null) setTuningReferenceOctave(data.tuningReferenceOctave);
      if (data.tuningReferenceHz != null) setTuningReferenceHz(data.tuningReferenceHz);
      if (data.playNoteOnInsert != null) setPlayNoteOnInsert(data.playNoteOnInsert);
      if (data.showBarNumbers != null) setShowBarNumbers(data.showBarNumbers);
      if (data.barNumberSize != null) setBarNumberSize(Math.max(8, Math.min(24, Number(data.barNumberSize))));
      if (data.showRhythmSyllables != null) setShowRhythmSyllables(data.showRhythmSyllables);
      if (data.showAllNoteLabels != null) setShowAllNoteLabels(data.showAllNoteLabels);
      if (data.enableEmojiOverlays != null) setEnableEmojiOverlays(data.enableEmojiOverlays);
      if (data.joClefStaffPosition != null && typeof data.joClefStaffPosition === 'number') setJoClefStaffPosition(Math.max(JO_CLEF_POSITION_MIN, Math.min(JO_CLEF_POSITION_MAX, data.joClefStaffPosition)));
      else if (data.keySignature) setJoClefStaffPosition(getTonicStaffPosition(data.keySignature));
      if (data.relativeNotationShowKeySignature != null) setRelativeNotationShowKeySignature(data.relativeNotationShowKeySignature);
      if (data.relativeNotationShowTraditionalClef != null) setRelativeNotationShowTraditionalClef(data.relativeNotationShowTraditionalClef);
      if (data.isPedagogicalProject != null) setIsPedagogicalProject(!!data.isPedagogicalProject);
      if (Array.isArray(data.chords)) setChords(normalizeLoadedChords(data.chords));
      if ('pageDesignDataUrl' in data) setPageDesignDataUrl(data.pageDesignDataUrl || null);
      else setPageDesignDataUrl(null);
      if ('pageDesignOpacity' in data) setPageDesignOpacity(clampNumber(Number(data.pageDesignOpacity) || 0.25, 0, 1));
      else setPageDesignOpacity(0.25);
      if (data.pageDesignFit === 'cover' || data.pageDesignFit === 'contain') setPageDesignFit(data.pageDesignFit);
      else setPageDesignFit('cover');
      // pageDesignLayer: alati 'behind' — ignoreeri vanu faile, kus oli 'inFront'
      if (typeof data.pageDesignPositionX === 'number') setPageDesignPositionX(clampNumber(data.pageDesignPositionX, 0, 100));
      else setPageDesignPositionX(50);
      if (typeof data.pageDesignPositionY === 'number') setPageDesignPositionY(clampNumber(data.pageDesignPositionY, 0, 100));
      else setPageDesignPositionY(50);
      if (data.pageDesignCrop && typeof data.pageDesignCrop.top === 'number' && typeof data.pageDesignCrop.right === 'number' && typeof data.pageDesignCrop.bottom === 'number' && typeof data.pageDesignCrop.left === 'number') {
        setPageDesignCrop({
          top: clampNumber(data.pageDesignCrop.top, 0, 50),
          right: clampNumber(data.pageDesignCrop.right, 0, 50),
          bottom: clampNumber(data.pageDesignCrop.bottom, 0, 50),
          left: clampNumber(data.pageDesignCrop.left, 0, 50)
        });
      } else setPageDesignCrop({ top: 0, right: 0, bottom: 0, left: 0 });
      if (Array.isArray(data.textBoxes)) setTextBoxes(data.textBoxes);
      if (Array.isArray(data.visibleStaves)) setVisibleStaves(data.visibleStaves);
      if (Array.isArray(data.instrumentPartGroups)) {
        setInstrumentPartGroups(data.instrumentPartGroups.map((g) => ({
          id: g?.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `grp-${Date.now()}`),
          name: String(g?.name || 'Group'),
          staffIds: Array.isArray(g?.staffIds) ? g.staffIds : [],
        })));
      } else {
        setInstrumentPartGroups([]);
      }
      if (Array.isArray(data.intermissionLabels)) setIntermissionLabels(data.intermissionLabels);
      if (data.documentFontFamily) setDocumentFontFamily(data.documentFontFamily);
      if (data.lyricFontFamily) setLyricFontFamily(data.lyricFontFamily);
      if (typeof data.lyricFontSize === 'number' && data.lyricFontSize >= 1) setLyricFontSize(data.lyricFontSize);
      if (typeof data.titleFontSize === 'number' && data.titleFontSize >= 10 && data.titleFontSize <= 72) setTitleFontSize(data.titleFontSize);
      if (typeof data.authorFontSize === 'number' && data.authorFontSize >= 8 && data.authorFontSize <= 48) setAuthorFontSize(data.authorFontSize);
      if (data.titleFontFamily != null) setTitleFontFamily(data.titleFontFamily || '');
      if (data.authorFontFamily != null) setAuthorFontFamily(data.authorFontFamily || '');
      if (typeof data.titleBold === 'boolean') setTitleBold(data.titleBold);
      if (typeof data.titleItalic === 'boolean') setTitleItalic(data.titleItalic);
      if (typeof data.authorBold === 'boolean') setAuthorBold(data.authorBold);
      if (typeof data.authorItalic === 'boolean') setAuthorItalic(data.authorItalic);
      if (data.titleAlignment === 'left' || data.titleAlignment === 'center' || data.titleAlignment === 'right') setTitleAlignment(data.titleAlignment);
      if (data.authorAlignment === 'left' || data.authorAlignment === 'center' || data.authorAlignment === 'right') setAuthorAlignment(data.authorAlignment);
      if (data.staffRowAlignment === 'left' || data.staffRowAlignment === 'center' || data.staffRowAlignment === 'right') setStaffRowAlignment(data.staffRowAlignment);
      if (data.lyricLineIndex === 0 || data.lyricLineIndex === 1) setLyricLineIndex(data.lyricLineIndex);
      if (typeof data.lyricLineYOffset === 'number') setLyricLineYOffset(Math.max(-40, Math.min(40, data.lyricLineYOffset)));
      clearDirty();
      setSaveFeedback(t('feedback.projectLoaded'));
      setTimeout(() => setSaveFeedback(''), 1800);
      return true;
    } catch (_) {
      return false;
    }
  }, [clearDirty]);

  // Cross-window sync (main score <-> part windows). Two-way, last-write-wins, avoids loops via sourceId+revision.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('noodimeister-sync');
    syncChannelRef.current = ch;
    const onMsg = (ev) => {
      const msg = ev?.data;
      if (!msg || msg.type !== 'state') return;
      if (msg.sourceId === syncClientIdRef.current) return;
      if (typeof msg.revision !== 'number') return;
      if (msg.revision <= syncLastAppliedRevisionRef.current) return;
      syncLastAppliedRevisionRef.current = msg.revision;
      syncApplyingRemoteRef.current = true;
      try {
        importProject(msg.payload);
      } finally {
        setTimeout(() => { syncApplyingRemoteRef.current = false; }, 0);
      }
    };
    ch.addEventListener('message', onMsg);
    return () => {
      try { ch.removeEventListener('message', onMsg); } catch (_) {}
      try { ch.close(); } catch (_) {}
      syncChannelRef.current = null;
    };
  }, [importProject]);

  const sanitizeSyncPayload = useCallback((state) => {
    // Sync should carry musical content + metadata, not per-window UI state.
    const p = { ...(state || {}) };
    delete p.visibleStaves;
    delete p.viewMode;
    delete p.partLayoutMeasuresPerLine;
    delete p.partLayoutLineBreakBefore;
    delete p.partLayoutPageBreakBefore;
    delete p.showPageNavigator;
    delete p.pageFlowDirection;
    delete p.visibleToolIds;
    delete p.toolboxPaletteVisible;
    return p;
  }, []);

  useEffect(() => {
    if (!syncChannelRef.current) return;
    if (syncApplyingRemoteRef.current) return;
    if (syncBroadcastTimeoutRef.current) clearTimeout(syncBroadcastTimeoutRef.current);
    syncBroadcastTimeoutRef.current = setTimeout(() => {
      try {
        if (!syncChannelRef.current) return;
        if (syncApplyingRemoteRef.current) return;
        const raw = getPersistedState();
        const payload = sanitizeSyncPayload(raw);
        const nextRev = (syncRevisionRef.current || 0) + 1;
        syncRevisionRef.current = nextRev;
        syncChannelRef.current.postMessage({
          type: 'state',
          sourceId: syncClientIdRef.current,
          revision: nextRev,
          payload,
        });
      } catch (_) {}
    }, 200);
    return () => {
      if (syncBroadcastTimeoutRef.current) clearTimeout(syncBroadcastTimeoutRef.current);
    };
  }, [getPersistedState, importProject, sanitizeSyncPayload]);

  const handleOpenProjectFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local file open should never keep "overwrite cloud file" binding.
    setOpenedCloudFile(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result ?? '{}');
        if (importProject(data)) {
          if (projectFileInputRef.current) projectFileInputRef.current.value = '';
        } else {
          setSaveFeedback(t('feedback.invalidProject'));
          setTimeout(() => setSaveFeedback(''), 2000);
        }
      } catch (_) {
        setSaveFeedback(t('feedback.invalidJson'));
        setTimeout(() => setSaveFeedback(''), 2000);
      }
    };
    reader.readAsText(file);
  }, [importProject]);

  const loadFromStorage = useCallback(() => {
    try {
      // Loading from browser storage is not a cloud file; avoid accidental overwrite to cloud.
      setOpenedCloudFile(null);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setSaveFeedback('Salvestatud faili pole');
        setTimeout(() => setSaveFeedback(''), 2000);
        return;
      }
      const data = JSON.parse(raw);
      const hasStaves = Array.isArray(data.staves) && data.staves.length > 0;
      const hasNotes = data.notes && Array.isArray(data.notes);
      if (hasStaves || hasNotes) {
        if (hasStaves) {
          setStaves(data.staves);
          setActiveStaffIndex(typeof data.activeStaffIndex === 'number' ? Math.max(0, Math.min(data.activeStaffIndex, data.staves.length - 1)) : 0);
          if (Array.isArray(data.staffYOffsets)) setStaffYOffsets(data.staffYOffsets);
          if (Array.isArray(data.measureStretchFactors)) setMeasureStretchFactors(data.measureStretchFactors);
          if (Array.isArray(data.systemYOffsets)) setSystemYOffsets(data.systemYOffsets);
        } else {
          const instId = data.instrument || 'single-staff-treble';
          const cfg = INSTRUMENT_CONFIG_BASE[instId];
          if (instId === 'piano' || cfg?.type === 'grandStaff') {
            const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
            const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-a`;
            const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-b`;
            const notesArr = Array.isArray(data.notes) ? data.notes : [];
            setStaves([
              { id: id1, instrumentId: 'piano', clefType: 'treble', notes: notesArr, braceGroupId, notationMode: data.notationMode ?? 'traditional' },
              { id: id2, instrumentId: 'piano', clefType: 'bass', notes: [], braceGroupId, notationMode: data.notationMode ?? 'traditional' }
            ]);
          } else {
            setStaves([{ id: '1', instrumentId: instId, clefType: (cfg?.defaultClef) || data.clefType || 'treble', notes: data.notes ?? [], notationMode: data.notationMode ?? 'traditional' }]);
          }
          setActiveStaffIndex(0);
        }
        if (data.timeSignature) setTimeSignature(data.timeSignature);
        if (data.timeSignatureMode) setTimeSignatureMode(data.timeSignatureMode);
        if (data.keySignature) setKeySignature(data.keySignature);
        if (data.staffLines != null) setStaffLines(data.staffLines);
        if (data.notationStyle) setNotationStyle(data.notationStyle);
        else if (data.gridOnlyMode != null) setNotationStyle(data.gridOnlyMode ? 'FIGURENOTES' : 'TRADITIONAL');
        if (data.pixelsPerBeat != null) setPixelsPerBeat(data.pixelsPerBeat);
        if (data.figurenotesSize != null) setFigurenotesSize(Math.max(12, Math.min(100, data.figurenotesSize)));
        if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
      if (data.figurenotesChordLineGap != null) setFigurenotesChordLineGap(Math.max(0, Math.min(20, Number(data.figurenotesChordLineGap))));
      if ('figurenotesChordBlocks' in data) setFigurenotesChordBlocks(!!data.figurenotesChordBlocks);
      if ('figurenotesChordBlocksShowTones' in data) setFigurenotesChordBlocksShowTones(!!data.figurenotesChordBlocksShowTones);
      if ('figurenotesMelodyShowNoteNames' in data) setFigurenotesMelodyShowNoteNames(!!data.figurenotesMelodyShowNoteNames);
      if (data.timeSignatureSize != null) setTimeSignatureSize(Math.max(12, Math.min(48, data.timeSignatureSize)));
      if (data.pedagogicalTimeSigDenominatorType) setPedagogicalTimeSigDenominatorType(String(data.pedagogicalTimeSigDenominatorType));
      if (data.pedagogicalTimeSigDenominatorColor) setPedagogicalTimeSigDenominatorColor(String(data.pedagogicalTimeSigDenominatorColor));
      if (data.pedagogicalTimeSigDenominatorInstrument) setPedagogicalTimeSigDenominatorInstrument(String(data.pedagogicalTimeSigDenominatorInstrument));
      if (data.pedagogicalTimeSigDenominatorEmoji != null) setPedagogicalTimeSigDenominatorEmoji(String(data.pedagogicalTimeSigDenominatorEmoji || '🥁'));
      if (data.notationMode) setNotationMode(data.notationMode);
      if (data.noteheadShape) setNoteheadShape(data.noteheadShape);
      if (data.noteheadEmoji != null) setNoteheadEmoji(data.noteheadEmoji);
      if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
      if (data.linkedNotationByStaffId && typeof data.linkedNotationByStaffId === 'object') setLinkedNotationByStaffId(data.linkedNotationByStaffId);
      {
        const twUi = readTinWhistleFingeringUiPercentFromPersisted(data);
        if (twUi != null) setTinWhistleLinkedFingeringScalePercent(twUi);
      }
      if (data.isPedagogicalProject != null) setIsPedagogicalProject(!!data.isPedagogicalProject);
      if (data.cursorPosition != null) setCursorPosition(data.cursorPosition);
        if (data.addedMeasures != null) setAddedMeasures(data.addedMeasures);
        if (data.measureRepeatMarks != null && typeof data.measureRepeatMarks === 'object') setMeasureRepeatMarks(data.measureRepeatMarks);
        if (data.setupCompleted != null) setSetupCompleted(data.setupCompleted);
        if (data.songTitle != null) setSongTitle(data.songTitle);
        if (data.author != null) setAuthor(data.author);
        if (data.pickupEnabled != null) setPickupEnabled(data.pickupEnabled);
        if (data.pickupQuantity != null) setPickupQuantity(data.pickupQuantity);
        if (data.pickupDuration != null) setPickupDuration(data.pickupDuration);
        else if (data.pickupBeats != null) { setPickupQuantity(data.pickupBeats); setPickupDuration('1/4'); }
        if (data.pageOrientation === 'portrait' || data.pageOrientation === 'landscape') setPageOrientation(data.pageOrientation);
        if (data.paperSize === 'a3' || data.paperSize === 'a4' || data.paperSize === 'a5') setPaperSize(data.paperSize);
        if (data.layoutMeasuresPerLine != null) setLayoutMeasuresPerLine(data.layoutMeasuresPerLine);
        if (Array.isArray(data.layoutLineBreakBefore)) setLayoutLineBreakBefore(data.layoutLineBreakBefore);
        if (Array.isArray(data.layoutPageBreakBefore)) setLayoutPageBreakBefore(data.layoutPageBreakBefore);
        if (data.layoutExtraPages != null) setLayoutExtraPages(Math.max(0, Math.round(Number(data.layoutExtraPages) || 0)));
        if (data.layoutSystemGap != null) setLayoutSystemGap(Math.max(5, Math.min(250, Number(data.layoutSystemGap))));
        if (data.layoutPartsGap != null) setLayoutPartsGap(Math.max(2, Math.min(80, Number(data.layoutPartsGap))));
        if (data.layoutPartsGapMm != null) setLayoutPartsGapMm(Math.max(0, Math.min(100, Number(data.layoutPartsGapMm))));
        if (data.layoutSizeUnit === 'mm' || data.layoutSizeUnit === 'cm') setLayoutSizeUnit(data.layoutSizeUnit);
        if (data.layoutConnectedBarlines != null) setLayoutConnectedBarlines(!!data.layoutConnectedBarlines);
        if (data.layoutGlobalSpacingMultiplier != null) setLayoutGlobalSpacingMultiplier(Math.max(0.5, Math.min(2, Number(data.layoutGlobalSpacingMultiplier) || 1)));
        if (data.viewMode === 'score' || data.viewMode === 'part') setViewMode(data.viewMode);
        if (data.partLayoutMeasuresPerLine != null) setPartLayoutMeasuresPerLine(data.partLayoutMeasuresPerLine);
        if (Array.isArray(data.partLayoutLineBreakBefore)) setPartLayoutLineBreakBefore(data.partLayoutLineBreakBefore);
        if (Array.isArray(data.partLayoutPageBreakBefore)) setPartLayoutPageBreakBefore(data.partLayoutPageBreakBefore);
        if (data.partLayoutExtraPages != null) setPartLayoutExtraPages(Math.max(0, Math.round(Number(data.partLayoutExtraPages) || 0)));
        if (data.showPageNavigator != null) setShowPageNavigator(!!data.showPageNavigator);
        if (data.pageFlowDirection === 'vertical' || data.pageFlowDirection === 'horizontal') setPageFlowDirection(data.pageFlowDirection);
        if (data.viewFitPage != null) setViewFitPage(!!data.viewFitPage);
        if (data.viewSmartPage != null) {
          const smart = !!data.viewSmartPage;
          setViewSmartPage(smart);
          if (smart) setViewFitPage(false);
        }
        if (Array.isArray(data.visibleToolIds) && data.visibleToolIds.length > 0) setVisibleToolIds(data.visibleToolIds);
        if (data.tuningReferenceNote) setTuningReferenceNote(data.tuningReferenceNote);
        if (data.tuningReferenceOctave != null) setTuningReferenceOctave(data.tuningReferenceOctave);
        if (data.tuningReferenceHz != null) setTuningReferenceHz(data.tuningReferenceHz);
        if (data.playNoteOnInsert != null) setPlayNoteOnInsert(data.playNoteOnInsert);
        if (data.showBarNumbers != null) setShowBarNumbers(data.showBarNumbers);
      if (data.barNumberSize != null) setBarNumberSize(Math.max(8, Math.min(24, Number(data.barNumberSize))));
      if (data.showRhythmSyllables != null) setShowRhythmSyllables(data.showRhythmSyllables);
      if (data.showAllNoteLabels != null) setShowAllNoteLabels(data.showAllNoteLabels);
      if (data.enableEmojiOverlays != null) setEnableEmojiOverlays(data.enableEmojiOverlays);
      if (data.joClefStaffPosition != null && typeof data.joClefStaffPosition === 'number') setJoClefStaffPosition(Math.max(JO_CLEF_POSITION_MIN, Math.min(JO_CLEF_POSITION_MAX, data.joClefStaffPosition)));
      else if (data.keySignature) setJoClefStaffPosition(getTonicStaffPosition(data.keySignature));
        if (data.relativeNotationShowKeySignature != null) setRelativeNotationShowKeySignature(data.relativeNotationShowKeySignature);
        if (data.relativeNotationShowTraditionalClef != null) setRelativeNotationShowTraditionalClef(data.relativeNotationShowTraditionalClef);
        if (data.isPedagogicalProject != null) setIsPedagogicalProject(!!data.isPedagogicalProject);
        if (data.pedagogicalAudioBpm != null) setPedagogicalAudioBpm(Math.max(20, Math.min(300, data.pedagogicalAudioBpm)));
        if (data.pedagogicalPlayheadStyle) setPedagogicalPlayheadStyle(data.pedagogicalPlayheadStyle);
        if (data.pedagogicalPlayheadEmoji != null) setPedagogicalPlayheadEmoji(data.pedagogicalPlayheadEmoji);
        if (data.pedagogicalPlayheadEmojiSize != null) setPedagogicalPlayheadEmojiSize(Math.max(20, Math.min(60, data.pedagogicalPlayheadEmojiSize)));
        if (data.cursorSizePx != null) setCursorSizePx(Math.max(1, Math.min(500, data.cursorSizePx)));
        else if (data.pedagogicalPlayheadEmojiSize != null) setCursorSizePx(Math.max(1, Math.min(500, data.pedagogicalPlayheadEmojiSize)));
        if (data.pedagogicalPlayheadMovement === 'arch' || data.pedagogicalPlayheadMovement === 'horizontal') setPedagogicalPlayheadMovement(data.pedagogicalPlayheadMovement);
        if (data.cursorLineStrokeWidth != null) setCursorLineStrokeWidth(Math.max(1, Math.min(8, data.cursorLineStrokeWidth)));
        if (data.pedagogicalAudioData) {
          try {
            const binary = atob(data.pedagogicalAudioData);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            if (pedagogicalAudioUrlRef.current) URL.revokeObjectURL(pedagogicalAudioUrlRef.current);
            pedagogicalAudioUrlRef.current = url;
            pedagogicalAudioDataRef.current = data.pedagogicalAudioData;
            setPedagogicalAudioUrl(url);
            const audio = new Audio(url);
            audio.onloadedmetadata = () => setPedagogicalAudioDuration(audio.duration);
            audio.onerror = () => {};
          } catch (_) { /* ignore */ }
        }
        if (Array.isArray(data.chords)) setChords(normalizeLoadedChords(data.chords));
        if (Array.isArray(data.textBoxes)) setTextBoxes(data.textBoxes);
        if ('pageDesignDataUrl' in data) setPageDesignDataUrl(data.pageDesignDataUrl || null);
        else setPageDesignDataUrl(null);
        if ('pageDesignOpacity' in data) setPageDesignOpacity(clampNumber(Number(data.pageDesignOpacity) || 0.25, 0, 1));
        else setPageDesignOpacity(0.25);
        if (data.pageDesignFit === 'cover' || data.pageDesignFit === 'contain') setPageDesignFit(data.pageDesignFit);
        else setPageDesignFit('cover');
        if (typeof data.pageDesignPositionX === 'number') setPageDesignPositionX(clampNumber(data.pageDesignPositionX, 0, 100));
        else setPageDesignPositionX(50);
        if (typeof data.pageDesignPositionY === 'number') setPageDesignPositionY(clampNumber(data.pageDesignPositionY, 0, 100));
        else setPageDesignPositionY(50);
        if (data.pageDesignCrop && typeof data.pageDesignCrop.top === 'number' && typeof data.pageDesignCrop.right === 'number' && typeof data.pageDesignCrop.bottom === 'number' && typeof data.pageDesignCrop.left === 'number') {
          setPageDesignCrop({ top: clampNumber(data.pageDesignCrop.top, 0, 50), right: clampNumber(data.pageDesignCrop.right, 0, 50), bottom: clampNumber(data.pageDesignCrop.bottom, 0, 50), left: clampNumber(data.pageDesignCrop.left, 0, 50) });
        } else setPageDesignCrop({ top: 0, right: 0, bottom: 0, left: 0 });
        if (Array.isArray(data.visibleStaves)) setVisibleStaves(data.visibleStaves);
        if (Array.isArray(data.instrumentPartGroups)) {
          setInstrumentPartGroups(data.instrumentPartGroups.map((g) => ({
            id: g?.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `grp-${Date.now()}`),
            name: String(g?.name || 'Group'),
            staffIds: Array.isArray(g?.staffIds) ? g.staffIds : [],
          })));
        } else {
          setInstrumentPartGroups([]);
        }
        if (Array.isArray(data.intermissionLabels)) setIntermissionLabels(data.intermissionLabels);
        if (data.documentFontFamily) setDocumentFontFamily(data.documentFontFamily);
        if (data.lyricFontFamily) setLyricFontFamily(data.lyricFontFamily);
        if (typeof data.lyricFontSize === 'number' && data.lyricFontSize >= 1) setLyricFontSize(data.lyricFontSize);
        if (typeof data.titleFontSize === 'number' && data.titleFontSize >= 10 && data.titleFontSize <= 72) setTitleFontSize(data.titleFontSize);
        if (typeof data.authorFontSize === 'number' && data.authorFontSize >= 8 && data.authorFontSize <= 48) setAuthorFontSize(data.authorFontSize);
        if (data.titleFontFamily != null) setTitleFontFamily(data.titleFontFamily || '');
        if (data.authorFontFamily != null) setAuthorFontFamily(data.authorFontFamily || '');
        if (typeof data.titleBold === 'boolean') setTitleBold(data.titleBold);
        if (typeof data.titleItalic === 'boolean') setTitleItalic(data.titleItalic);
        if (typeof data.authorBold === 'boolean') setAuthorBold(data.authorBold);
        if (typeof data.authorItalic === 'boolean') setAuthorItalic(data.authorItalic);
        if (data.titleAlignment === 'left' || data.titleAlignment === 'center' || data.titleAlignment === 'right') setTitleAlignment(data.titleAlignment);
        if (data.authorAlignment === 'left' || data.authorAlignment === 'center' || data.authorAlignment === 'right') setAuthorAlignment(data.authorAlignment);
        if (data.staffRowAlignment === 'left' || data.staffRowAlignment === 'center' || data.staffRowAlignment === 'right') setStaffRowAlignment(data.staffRowAlignment);
        if (data.lyricLineIndex === 0 || data.lyricLineIndex === 1) setLyricLineIndex(data.lyricLineIndex);
        if (typeof data.lyricLineYOffset === 'number') setLyricLineYOffset(Math.max(-40, Math.min(40, data.lyricLineYOffset)));
        clearDirty();
        setSaveFeedback('Laaditud!');
        setTimeout(() => setSaveFeedback(''), 1800);
      }
    } catch (e) {
      setSaveFeedback('Viga laadimisel');
      setTimeout(() => setSaveFeedback(''), 2000);
    }
  }, [clearDirty]);

  const isAuthTokenError = useCallback((err) => {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('token')
      || msg.includes('401')
      || msg.includes('unauthorized')
      || msg.includes('invalid_grant')
      || msg.includes('aegunud');
  }, []);

  // Salvesta pilve: kui on salvestuskaust seadistatud, salvesta otse sinna; vastasel juhul ava dialoog.
  const saveToCloud = useCallback(async () => {
    const run = async (allowTokenRefresh = true) => {
      let token = googleDrive.getStoredToken();
      if (!token && allowTokenRefresh) {
        try {
          token = await refreshGoogleTokenSilently();
        } catch (_) {
          token = null;
        }
      }
      if (!token) {
        setSaveFeedback('Logi sisse Google\'iga (Drive luba)');
        setTimeout(() => setSaveFeedback(''), 3000);
        return;
      }
    const data = exportScoreToJSON();
    const json = JSON.stringify(data, null, 2);
    // Ära salvesta tühja või vigast sisu (vältib faili tühjendamist Drive'is).
    if (!json || json.length < 50 || !Array.isArray(data?.staves) || data.staves.length === 0) {
      setSaveFeedback('Projektisisu puudub või on vigane – salvestamine peatatud');
      setTimeout(() => setSaveFeedback(''), 4000);
      return;
    }
    // Kui fail on avatud Drive'ist (/app?fileId=...), kirjuta sama fileId üle (ei loo koopiat).
    if (openedCloudFile?.provider === 'google' && openedCloudFile.fileId) {
      try {
        setSaveFeedback('Salvestan…');
        const remoteMeta = await googleDrive.getFileMetadata(token, openedCloudFile.fileId);
        const knownModified = String(openedCloudFile.modifiedTime || '');
        const remoteModified = String(remoteMeta?.modifiedTime || '');
        // No-overwrite: if file changed elsewhere after open, write a conflict copy instead of overwriting.
        if (knownModified && remoteModified && knownModified !== remoteModified) {
          const fileNameBase = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled'));
          const conflictName = `${fileNameBase} (conflict-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}).nm`;
          const targetFolderId = (Array.isArray(remoteMeta?.parents) && remoteMeta.parents[0]) || (sessionSaveFolderId?.cloud === 'google' ? sessionSaveFolderId.folderId : null) || authStorage.getGoogleSaveFolderId() || 'root';
          const copyId = await googleDrive.createFileInFolder(token, targetFolderId, conflictName, json);
          if (copyId) {
            const copyMeta = await googleDrive.getFileMetadata(token, copyId).catch(() => null);
            setOpenedCloudFile({ provider: 'google', fileId: copyId, modifiedTime: copyMeta?.modifiedTime || '' });
          }
          setSaveFeedback('Pilvefail muutus mujal – salvestasin konfliktikoopia.');
          setTimeout(() => setSaveFeedback(''), 3500);
          return;
        }
        await googleDrive.updateProjectFile(token, openedCloudFile.fileId, json);
        const freshMeta = await googleDrive.getFileMetadata(token, openedCloudFile.fileId).catch(() => null);
        setOpenedCloudFile({ provider: 'google', fileId: openedCloudFile.fileId, modifiedTime: freshMeta?.modifiedTime || remoteModified || knownModified || '' });
        setSaveFeedback('Salvestatud pilve (sama fail)!');
        setTimeout(() => setSaveFeedback(''), 2500);
      } catch (e) {
        if (allowTokenRefresh && isAuthTokenError(e)) {
          try {
            await refreshGoogleTokenSilently();
            return run(false);
          } catch (_) {}
        }
        setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 3000);
      }
      return;
    }
    // Muidu: salvesta kausta, nagu varem (või küsi kausta).
    const savedFolderId = (sessionSaveFolderId?.cloud === 'google' ? sessionSaveFolderId.folderId : null) || authStorage.getGoogleSaveFolderId();
    if (savedFolderId) {
      try {
        setSaveFeedback('Salvestan…');
        const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.nm';
        const fileId = await googleDrive.createFileInFolder(token, savedFolderId, fileName, json);
        // Mark as opened cloud file so Ctrl/Cmd+S overwrites this file next time (no duplicates).
        if (fileId) {
          const meta = await googleDrive.getFileMetadata(token, fileId).catch(() => null);
          setOpenedCloudFile({ provider: 'google', fileId, modifiedTime: meta?.modifiedTime || '' });
        }
        setSaveFeedback('Salvestatud pilve!');
        setTimeout(() => setSaveFeedback(''), 2500);
      } catch (e) {
        if (allowTokenRefresh && isAuthTokenError(e)) {
          try {
            await refreshGoogleTokenSilently();
            return run(false);
          } catch (_) {}
        }
        setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 3000);
      }
      return;
    }
    setSaveCloudDialogOpen(true);
    };
    return run(true);
  }, [exportScoreToJSON, sessionSaveFolderId, openedCloudFile, t, refreshGoogleTokenSilently, isAuthTokenError]);

  // Vali olemasolev kaust (Picker) ja salvesta sinna. Lisa kaust nimekirja, et järgmine salvestamine kasutaks sama kausta.
  const saveToCloudPickExisting = useCallback(async () => {
    setSaveCloudDialogOpen(false);
    const token = googleDrive.getStoredToken();
    if (!token) return;
    try {
      setSaveFeedback('Vali kaust…');
      const folderId = await googleDrive.pickFolder(token);
      if (!folderId) {
        setSaveFeedback('');
        return;
      }
      setSaveFeedback('Salvestan…');
      const data = exportScoreToJSON();
      const json = JSON.stringify(data, null, 2);
      const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.nm';
      const fileId = await googleDrive.createFileInFolder(token, folderId, fileName, json);
      if (fileId) {
        const meta = await googleDrive.getFileMetadata(token, fileId).catch(() => null);
        setOpenedCloudFile({ provider: 'google', fileId, modifiedTime: meta?.modifiedTime || '' });
      }
      authStorage.addGoogleSaveFolder(folderId, '');
      try { await googleDrive.setSaveFoldersConfig(token, authStorage.getGoogleSaveFolders()); } catch (_) {}
      setSaveFeedback('Salvestatud pilve!');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [exportScoreToJSON]);

  // Loo uus kaust juurkaustas ja salvesta sinna. Lisa kaust nimekirja, et järgmine salvestamine kasutaks sama kausta (vältib topeltkaustu).
  const saveToCloudCreateFolder = useCallback(async () => {
    const token = googleDrive.getStoredToken();
    if (!token) return;
    const name = (saveCloudNewFolderName || 'NoodiMeister').trim();
    if (!name) {
      setSaveFeedback('Sisesta kausta nimi');
      setTimeout(() => setSaveFeedback(''), 2000);
      return;
    }
    try {
      setSaveFeedback('Loon kausta…');
      const folderId = await googleDrive.createFolder(token, 'root', name);
      setSaveFeedback('Salvestan…');
      const data = exportScoreToJSON();
      const json = JSON.stringify(data, null, 2);
      const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.nm';
      const fileId = await googleDrive.createFileInFolder(token, folderId, fileName, json);
      if (fileId) {
        const meta = await googleDrive.getFileMetadata(token, fileId).catch(() => null);
        setOpenedCloudFile({ provider: 'google', fileId, modifiedTime: meta?.modifiedTime || '' });
      }
      authStorage.addGoogleSaveFolder(folderId, name);
      try { await googleDrive.setSaveFoldersConfig(token, authStorage.getGoogleSaveFolders()); } catch (_) {}
      setSaveCloudDialogOpen(false);
      setSaveFeedback('Salvestatud pilve!');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [exportScoreToJSON, saveCloudNewFolderName, t]);

  // Salvesta OneDrive'i (Microsoft): kui fail on avatud pilvest, kirjuta sama fileId üle; muidu uus fail kausta/juurkausta.
  const saveToOneDrive = useCallback(async () => {
    const run = async (allowTokenRefresh = true) => {
      let token = authStorage.getStoredMicrosoftTokenFromAuth();
      if (!token && allowTokenRefresh) {
        try {
          token = await refreshMicrosoftTokenSilently();
        } catch (_) {
          token = null;
        }
      }
      if (!token) {
        setSaveFeedback(t('feedback.loginMicrosoft') || 'Logi sisse Microsoftiga (OneDrive luba)');
        setTimeout(() => setSaveFeedback(''), 3000);
        return;
      }
    const data = exportScoreToJSON();
    const json = JSON.stringify(data, null, 2);
    if (!json || json.length < 50 || !Array.isArray(data?.staves) || data.staves.length === 0) {
      setSaveFeedback('Projektisisu puudub või on vigane – salvestamine peatatud');
      setTimeout(() => setSaveFeedback(''), 4000);
      return;
    }
    if (openedCloudFile?.provider === 'onedrive' && openedCloudFile.fileId) {
      try {
        setSaveFeedback('Salvestan…');
        const knownETag = String(openedCloudFile.eTag || '').trim();
        try {
          await oneDrive.updateFileContent(token, openedCloudFile.fileId, json, 'application/json', knownETag ? { ifMatch: knownETag } : {});
          const freshMeta = await oneDrive.getFileMetadata(token, openedCloudFile.fileId).catch(() => null);
          setOpenedCloudFile({ provider: 'onedrive', fileId: openedCloudFile.fileId, eTag: freshMeta?.eTag || knownETag || '' });
        } catch (e) {
          if (String(e?.message || '').includes('teises seadmes muutunud')) {
            const meta = await oneDrive.getFileMetadata(token, openedCloudFile.fileId).catch(() => null);
            const folderId = meta?.parentId || (sessionSaveFolderId?.cloud === 'onedrive' ? sessionSaveFolderId.folderId : null) || authStorage.getOneDriveSaveFolderId() || 'root';
            const fileNameBase = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled'));
            const conflictName = `${fileNameBase} (conflict-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}).nm`;
            const savedItem = await oneDrive.uploadFileToFolder(token, folderId, conflictName, json, 'application/json');
            if (savedItem?.id) {
              const copyMeta = await oneDrive.getFileMetadata(token, savedItem.id).catch(() => null);
              setOpenedCloudFile({ provider: 'onedrive', fileId: savedItem.id, eTag: copyMeta?.eTag || '' });
            }
            setSaveFeedback('Pilvefail muutus mujal – salvestasin konfliktikoopia.');
            setTimeout(() => setSaveFeedback(''), 3500);
            return;
          }
          throw e;
        }
        setSaveFeedback(t('feedback.savedToCloud') || 'Salvestatud pilve (sama fail)!');
        setTimeout(() => setSaveFeedback(''), 2500);
      } catch (e) {
        if (allowTokenRefresh && isAuthTokenError(e)) {
          try {
            await refreshMicrosoftTokenSilently();
            return run(false);
          } catch (_) {}
        }
        setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 3000);
      }
      return;
    }
    try {
      setSaveFeedback('Salvestan…');
      const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.nm';
      const folderId = (sessionSaveFolderId?.cloud === 'onedrive' ? sessionSaveFolderId.folderId : null) || authStorage.getOneDriveSaveFolderId();
      let savedItem = null;
      if (folderId) {
        savedItem = await oneDrive.uploadFileToFolder(token, folderId, fileName, json, 'application/json');
      } else {
        savedItem = await oneDrive.uploadFileToRoot(token, fileName, json, 'application/json');
      }
      if (savedItem?.id) {
        const meta = await oneDrive.getFileMetadata(token, savedItem.id).catch(() => null);
        setOpenedCloudFile({ provider: 'onedrive', fileId: savedItem.id, eTag: meta?.eTag || '' });
      }
      setSaveFeedback(t('feedback.savedToCloud') || 'Salvestatud pilve!');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      if (allowTokenRefresh && isAuthTokenError(e)) {
        try {
          await refreshMicrosoftTokenSilently();
          return run(false);
        } catch (_) {}
      }
      setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
    };
    return run(true);
  }, [exportScoreToJSON, sessionSaveFolderId, openedCloudFile, t, refreshMicrosoftTokenSilently, isAuthTokenError]);

  const setDocumentNotationMode = useCallback((nextMode) => {
    if (nextMode === 'figurenotes') {
      setNotationStyle('FIGURENOTES');
      setNotationMode('figurenotes');
      return;
    }
    if (nextMode === 'vabanotatsioon') {
      // Pedagogical notation keeps staff rendering in traditional layer.
      setNotationStyle('TRADITIONAL');
      setNotationMode('vabanotatsioon');
      return;
    }
    setNotationStyle('TRADITIONAL');
    setNotationMode('traditional');
  }, []);

  const makeCloudCopy = useCallback(async () => {
    if (!openedCloudFile?.provider || !openedCloudFile?.fileId) {
      setSaveFeedback(t('file.copyError') || 'Koopia tegemine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 2500);
      return;
    }
    const baseName = ((songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || 'score') + '.nm';
    try {
      setSaveFeedback(t('file.copy') || 'Tee koopia');
      if (openedCloudFile.provider === 'google') {
        const token = googleDrive.getStoredToken?.();
        if (!token) throw new Error('Google token puudub');
        const folderId = (sessionSaveFolderId?.cloud === 'google' ? sessionSaveFolderId.folderId : null) || authStorage.getGoogleSaveFolderId() || 'root';
        const created = await googleDrive.copyProjectFile(token, openedCloudFile.fileId, folderId, baseName);
        if (created?.id) setOpenedCloudFile({ provider: 'google', fileId: created.id });
      } else if (openedCloudFile.provider === 'onedrive') {
        const token = authStorage.getStoredMicrosoftTokenFromAuth?.();
        if (!token) throw new Error('OneDrive token puudub');
        const folderId = (sessionSaveFolderId?.cloud === 'onedrive' ? sessionSaveFolderId.folderId : null) || authStorage.getOneDriveSaveFolderId() || 'root';
        const result = await oneDrive.copyProjectFile(token, openedCloudFile.fileId, folderId, baseName);
        if (!result?.ok || !result?.id) throw new Error(result?.error || 'Koopia tegemine ebaõnnestus');
        setOpenedCloudFile({ provider: 'onedrive', fileId: result.id });
      }
      setSaveFeedback((t('file.copy') || 'Tee koopia') + ' ✓');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      setSaveFeedback(e?.message || (t('file.copyError') || 'Koopia tegemine ebaõnnestus'));
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [openedCloudFile, songTitle, t, sessionSaveFolderId]);

  /** Cmd/Ctrl+S: salvesta valitud sihtkohta (Pilv/Arvuti/Brauser). */
  const handleSaveShortcut = useCallback(async () => {
    if (projectSaveTarget === 'browser') {
      saveToStorageSync();
      setSaveFeedback(t('feedback.savedLocalOnly') || 'Salvestatud ainult selles brauseris/seadmes.');
      setTimeout(() => setSaveFeedback(''), 2600);
      return;
    }
    if (!isLoggedIn()) {
      setSaveFeedback('Salvestuskoht on Pilv. Vali konto või muuda salvestuskohta.');
      setTimeout(() => setSaveFeedback(''), 3200);
      return;
    }
    const user = authStorage.getLoggedInUser();
    const provider = user?.provider;
    if (provider === 'google') {
      if (!googleDrive.getStoredToken()) {
        try { await refreshGoogleTokenSilently(); } catch (_) {}
      }
      if (!googleDrive.getStoredToken()) {
        setSaveFeedback(t('feedback.loginGoogle') || 'Logi sisse Google\'iga (Drive luba)');
        setTimeout(() => setSaveFeedback(''), 3200);
        return;
      }
      saveToCloud();
      return;
    }
    if (provider === 'microsoft') {
      if (!authStorage.getStoredMicrosoftTokenFromAuth()) {
        try { await refreshMicrosoftTokenSilently(); } catch (_) {}
      }
      if (!authStorage.getStoredMicrosoftTokenFromAuth()) {
        setSaveFeedback(t('feedback.loginMicrosoft') || 'Logi sisse Microsoftiga (OneDrive luba)');
        setTimeout(() => setSaveFeedback(''), 3200);
        return;
      }
      saveToOneDrive();
      return;
    }
    setSaveFeedback(t('feedback.cloudError') || 'Pilve salvestamine ebaõnnestus');
    setTimeout(() => setSaveFeedback(''), 3200);
  }, [projectSaveTarget, isLoggedIn, saveToStorageSync, saveToCloud, saveToOneDrive, t]);

  const loadGoogleDriveProjectById = useCallback(async (fileId) => {
    const token = googleDrive.getStoredToken?.();
    if (!token || !fileId) return;
    setGoogleLoadPickerOpen(false);
    setGoogleLoadPickerError('');
    try {
      setSaveFeedback(t('feedback.loadingFromCloud') || 'Laadin…');
      const content = await googleDrive.getFileContent(token, fileId);
      const data = JSON.parse(content);
      if (importProject(data)) {
        setSaveFeedback(t('feedback.loadedFromCloud') || 'Laaditud pilvest!');
        setTimeout(() => setSaveFeedback(''), 2500);
        const meta = await googleDrive.getFileMetadata(token, fileId).catch(() => null);
        setOpenedCloudFile({ provider: 'google', fileId, modifiedTime: meta?.modifiedTime || '' });
      } else {
        setSaveFeedback('Vigane projektifail');
        setTimeout(() => setSaveFeedback(''), 2500);
      }
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilvest laadimine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [importProject, t]);

  const openGoogleDriveProjectInNewTab = useCallback((fileId) => {
    openCloudFileInNewBrowserTab(fileId);
    setGoogleLoadPickerOpen(false);
  }, []);

  // Laadi pilvest: Google Drive (modaalne nimekiri) või OneDrive (prompt).
  const loadFromCloud = useCallback(async () => {
    const user = authStorage.getLoggedInUser?.();
    const provider = user?.provider;

    // OneDrive (Microsoft)
    if (provider === 'microsoft') {
      const token = authStorage.getStoredMicrosoftTokenFromAuth?.();
      if (!token) {
        setSaveFeedback('Logi sisse Microsoftiga, et laadida OneDrive\'ist.');
        setTimeout(() => setSaveFeedback(''), 3500);
        return;
      }
      try {
        setSaveFeedback('Laadin OneDrive\'i failide nimekirja…');
        const [rootRes, sharedRes] = await Promise.all([
          oneDrive.listNoodimeisterFilesFromOneDrive(token),
          oneDrive.listNoodimeisterFilesSharedWithMe(token),
        ]);
        const rootFiles = rootRes?.ok ? (rootRes.files || []) : [];
        const sharedFiles = sharedRes?.ok ? (sharedRes.files || []) : [];
        const files = [...rootFiles, ...sharedFiles].filter(Boolean);
        if (!files.length) {
          const msg = rootRes?.ok === false ? (rootRes?.error || 'OneDrive\'is faile ei leitud.') : 'OneDrive\'is NoodiMeisteri faile ei leitud.';
          setSaveFeedback(msg);
          setTimeout(() => setSaveFeedback(''), 3500);
          return;
        }

        // Prompt-based chooser (kiire lahendus; hiljem võib asendada eraldi dialoogiga).
        const maxShow = 25;
        const shown = files.slice(0, maxShow);
        setSaveFeedback('Vali fail…');
        const answer = window.prompt(
          `Vali OneDrive fail (1-${shown.length})` +
          (files.length > shown.length ? ` (näitan esimesed ${shown.length}/${files.length})` : '') +
          ':\n\n' +
          shown.map((f, i) => `${i + 1}. ${f.name}`).join('\n') +
          '\n\nSisesta number ja vajuta OK (Cancel = katkesta).'
        );
        if (!answer) {
          setSaveFeedback('');
          return;
        }
        const idx = Number(answer);
        if (!Number.isFinite(idx) || idx < 1 || idx > shown.length) {
          setSaveFeedback('Vigane valik.');
          setTimeout(() => setSaveFeedback(''), 2500);
          return;
        }
        const picked = shown[idx - 1];
        if (!picked?.id) {
          setSaveFeedback('Vigane failivalik.');
          setTimeout(() => setSaveFeedback(''), 2500);
          return;
        }

        setSaveFeedback('Laadin OneDrive\'ist…');
        const content = await oneDrive.getFileContent(token, picked.id);
        const data = JSON.parse(content);
        if (importProject(data)) {
          setSaveFeedback('Laaditud pilvest!');
          setTimeout(() => setSaveFeedback(''), 2500);
          const meta = await oneDrive.getFileMetadata(token, picked.id).catch(() => null);
          setOpenedCloudFile({ provider: 'onedrive', fileId: picked.id, eTag: meta?.eTag || '' });
        } else {
          setSaveFeedback('Vigane projektifail');
          setTimeout(() => setSaveFeedback(''), 2500);
        }
      } catch (e) {
        setSaveFeedback(e?.message || 'OneDrive\'ist laadimine ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 3500);
      }
      return;
    }

    // Default: Google Drive — rakendusesisene klikitav nimekiri (Drive API).
    const token = googleDrive.getStoredToken?.();
    if (!token) {
      setSaveFeedback(t('feedback.loadFromCloudHint') || 'Logi sisse Google\'iga, et laadida Google Drive\'ist.');
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    setGoogleLoadPickerError('');
    setGoogleLoadPickerRows([]);
    setGoogleLoadPickerOpen(true);
    setGoogleLoadPickerLoading(true);
    try {
      const [owned, shared] = await Promise.all([
        googleDrive.listNoodimeisterFiles(token, { pageSize: 100 }),
        googleDrive.listNoodimeisterFilesSharedWithMe(token),
      ]);
      const byId = new Map();
      for (const f of owned || []) {
        if (f?.id) byId.set(f.id, { ...f, fromShared: false });
      }
      for (const f of shared || []) {
        if (f?.id && !byId.has(f.id)) byId.set(f.id, { ...f, fromShared: true });
      }
      const rows = Array.from(byId.values()).sort((a, b) => {
        const ta = new Date(a.modifiedTime || 0).getTime();
        const tb = new Date(b.modifiedTime || 0).getTime();
        return tb - ta;
      });
      setGoogleLoadPickerRows(rows);
    } catch (e) {
      setGoogleLoadPickerError(e?.message || t('file.loadCloudPickerListError'));
    } finally {
      setGoogleLoadPickerLoading(false);
    }
  }, [t, importProject]);

  const handleLoadBySelectedSource = useCallback(async () => {
    if (projectLoadSource === 'browser') {
      loadFromStorage();
      return;
    }
    await loadFromCloud();
  }, [projectLoadSource, loadFromStorage, loadFromCloud]);

  // Load from localStorage on mount (skip when opening as new work /app?new=1 or /app?fileId=...)
  // Use importProject so both staves and legacy notes format load in full (taktid, lehekülje disain jms).
  useEffect(() => {
    if (demoVisibility) return;
    if (searchParams?.get?.('importMusicXml') === '1') return;
    if (searchParams?.get?.('new') === '1') return;
    if (searchParams?.get?.('fileId')) return; // laaditakse Drive'ist eraldi effect'iga
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const hasStaves = Array.isArray(data.staves) && data.staves.length > 0;
        const hasNotes = data.notes && Array.isArray(data.notes);
        if (hasStaves || hasNotes) {
          // This is a local (browser) restore, not a cloud-opened file.
          setOpenedCloudFile(null);
          importProject(data);
        }
      }
    } catch (_) { /* ignore */ }
  }, [importProject, demoVisibility, searchParams]);

  useEffect(() => {
    if (searchParams?.get?.('importMusicXml') !== '1') return;
    try {
      const raw = sessionStorage.getItem('nm:pending-musicxml-import');
      if (!raw) throw new Error('Import payload puudub');
      const payload = JSON.parse(raw);
      const xmlText = typeof payload?.xmlText === 'string' ? payload.xmlText : '';
      const fileName = typeof payload?.fileName === 'string' ? payload.fileName : '';
      if (!xmlText.trim()) throw new Error('Import payload on tühi');
      const parsed = parseMusicXmlToOrchestration(xmlText, fileName);
      setOpenedCloudFile(null);
      applyParsedMusicXml(parsed);
      sessionStorage.removeItem('nm:pending-musicxml-import');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('importMusicXml');
        return next;
      });
    } catch (err) {
      console.error(err);
      setSaveFeedback('MusicXML import ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [searchParams, setSearchParams, applyParsedMusicXml]);

  useEffect(() => {
    if (searchParams?.get?.('importPdf') !== '1') return;
    try {
      beginImportTimeline('pdf', ['PDF vastu voetud', 'Tekstikiht loetud', 'Sisu analuuesitud', 'Editable mustand loodud', 'Valmis'], 0.55);
      const raw = sessionStorage.getItem('nm:pending-pdf-import');
      const payload = raw ? JSON.parse(raw) : null;
      const report = payload?.report || null;
      const pendingMeta = payload?.pendingImport || null;
      const fileName = String(pendingMeta?.fileName || '').trim();
      if (!report?.ok) throw new Error('PDF import report puudub');
      advanceImportTimeline(1, 0.62);
      advanceImportTimeline(2, report?.confidence?.score || 0.7);

      advanceImportTimeline(3, report?.confidence?.score || 0.74);
      const applied = report?.draftProject ? importProject(report.draftProject) : false;
      const notesCount = report?.draftProject?.staves?.[0]?.notes?.length || 0;
      if (applied) {
        const prefix = fileName ? `PDF "${fileName}"` : 'PDF';
        setSaveFeedback(`${prefix} imporditud muudetava mustandina (${notesCount} nooti). Kontrolli rütmid/hääled.`);
        setTimeout(() => setSaveFeedback(''), 5500);
        finishImportTimeline(true, report?.confidence?.score || 0.78);
      } else {
        setSaveFeedback('PDF import ebaõnnestus: mustandi rakendamine ei õnnestunud');
        setTimeout(() => setSaveFeedback(''), 3500);
        finishImportTimeline(false, report?.confidence?.score || 0.6);
      }

      sessionStorage.removeItem('nm:pending-pdf-import');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('importPdf');
        return next;
      });
    } catch (err) {
      console.error(err);
      setSaveFeedback('PDF importi ei saanud alustada');
      setTimeout(() => setSaveFeedback(''), 3000);
      finishImportTimeline(false);
    }
  }, [searchParams, setSearchParams, importProject, beginImportTimeline, advanceImportTimeline, finishImportTimeline]);

  const demoSeedKeyRef = useRef('');
  useEffect(() => {
    if (!demoVisibility || !isReady) return;
    const styleRaw = (searchParams.get('style') || '').toLowerCase();
    const figurenotes = styleRaw === 'figurenotes' || styleRaw === 'figure';
    const grandStaff = searchParams.get('piano') === '1' || searchParams.get('piano') === 'true';
    const key = `${figurenotes}|${grandStaff}`;
    if (demoSeedKeyRef.current === key) return;
    demoSeedKeyRef.current = key;
    setOpenedCloudFile(null);
    importProject(buildDemoVisibilityProject({ figurenotes, grandStaff: grandStaff && !figurenotes }));
  }, [demoVisibility, isReady, importProject, searchParams]);

  // Load from Google Drive or OneDrive when opening /app?fileId=... [&cloud=onedrive]
  const driveFileId = searchParams?.get?.('fileId');
  const cloudProvider = searchParams?.get?.('cloud');
  const isOneDrive = cloudProvider === 'onedrive';
  useEffect(() => {
    if (!driveFileId) return;
    let cancelled = false;
    setSaveFeedback('Laadin pilvest…');
    const done = () => { if (!cancelled) setCloudLoadComplete(true); };
    const loadFromOneDrive = () => {
      const token = authStorage.getStoredMicrosoftTokenFromAuth();
      if (!token) {
        setSaveFeedback('Logi sisse Microsoftiga, et laadida OneDrive\'ist.');
        setTimeout(() => setSaveFeedback(''), 4000);
        done();
        return;
      }
      oneDrive.getFileContent(token, driveFileId)
        .then(async (content) => {
          if (cancelled) return;
          const data = JSON.parse(content);
          if (importProject(data)) {
            setSaveFeedback('Laaditud!');
            setTimeout(() => setSaveFeedback(''), 2500);
            // Märgi, et praegu avatud fail on OneDrive'i fail – Cmd/Ctrl+S saab selle üle kirjutada sama fileId-ga.
            const meta = await oneDrive.getFileMetadata(token, driveFileId).catch(() => null);
            setOpenedCloudFile({ provider: 'onedrive', fileId: driveFileId, eTag: meta?.eTag || '' });
          } else {
            setSaveFeedback('Vigane projektifail');
            setTimeout(() => setSaveFeedback(''), 3000);
          }
          done();
        })
        .catch((e) => {
          if (!cancelled) {
            setSaveFeedback(e?.message || 'OneDrive\'ist laadimine ebaõnnestus');
            setTimeout(() => setSaveFeedback(''), 4000);
          }
          done();
        });
    };
    const loadFromGoogle = () => {
      const token = googleDrive.getStoredToken();
      if (!token) {
        setSaveFeedback('Logi sisse Google\'iga, et laadida pilvest.');
        setTimeout(() => setSaveFeedback(''), 4000);
        done();
        return;
      }
      googleDrive.getFileContent(token, driveFileId)
        .then(async (content) => {
          if (cancelled) return;
          const data = JSON.parse(content);
          if (importProject(data)) {
            setSaveFeedback('Laaditud!');
            setTimeout(() => setSaveFeedback(''), 2500);
            // Märgi, et praegu avatud fail on Google Drive'i fail – Cmd/Ctrl+S saab selle üle kirjutada sama fileId-ga.
            const meta = await googleDrive.getFileMetadata(token, driveFileId).catch(() => null);
            setOpenedCloudFile({ provider: 'google', fileId: driveFileId, modifiedTime: meta?.modifiedTime || '' });
          } else {
            setSaveFeedback('Vigane projektifail');
            setTimeout(() => setSaveFeedback(''), 3000);
          }
          done();
        })
        .catch((e) => {
          if (!cancelled) {
            setSaveFeedback(e?.message || 'Pilvest laadimine ebaõnnestus');
            setTimeout(() => setSaveFeedback(''), 4000);
          }
          done();
        });
    };
    if (isOneDrive) loadFromOneDrive();
    else loadFromGoogle();
    return () => { cancelled = true; };
  }, [driveFileId, isOneDrive, importProject]);

  // Poll cloud metadata to warn when same file changed on another device.
  // Important: keep local openedCloudFile stamp unchanged, so save logic can still detect conflict.
  useEffect(() => {
    if (!openedCloudFile?.provider || !openedCloudFile?.fileId) return undefined;
    let cancelled = false;
    const checkRemoteChange = async () => {
      if (cancelled || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      try {
        if (openedCloudFile.provider === 'google') {
          const token = googleDrive.getStoredToken();
          if (!token) return;
          const meta = await googleDrive.getFileMetadata(token, openedCloudFile.fileId);
          if (cancelled) return;
          const knownModified = String(openedCloudFile.modifiedTime || '');
          const remoteModified = String(meta?.modifiedTime || '');
          if (knownModified && remoteModified && knownModified !== remoteModified) {
            const noticeKey = `${openedCloudFile.provider}:${openedCloudFile.fileId}:${remoteModified}`;
            if (lastRemoteCloudChangeNoticeRef.current !== noticeKey) {
              lastRemoteCloudChangeNoticeRef.current = noticeKey;
              setSaveFeedback('Pilvefail muutus teises seadmes. Laadi fail uuesti või salvesta koopia.');
              setTimeout(() => setSaveFeedback(''), 5000);
            }
          }
          return;
        }
        if (openedCloudFile.provider === 'onedrive') {
          const token = authStorage.getStoredMicrosoftTokenFromAuth();
          if (!token) return;
          const meta = await oneDrive.getFileMetadata(token, openedCloudFile.fileId);
          if (cancelled) return;
          const knownETag = String(openedCloudFile.eTag || '');
          const remoteETag = String(meta?.eTag || '');
          if (knownETag && remoteETag && knownETag !== remoteETag) {
            const noticeKey = `${openedCloudFile.provider}:${openedCloudFile.fileId}:${remoteETag}`;
            if (lastRemoteCloudChangeNoticeRef.current !== noticeKey) {
              lastRemoteCloudChangeNoticeRef.current = noticeKey;
              setSaveFeedback('Pilvefail muutus teises seadmes. Laadi fail uuesti või salvesta koopia.');
              setTimeout(() => setSaveFeedback(''), 5000);
            }
          }
        }
      } catch (_) {
        // Metadata polling is best-effort only.
      }
    };
    const onVisibilityChange = () => { checkRemoteChange(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(checkRemoteChange, 45_000);
    checkRemoteChange();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [openedCloudFile]);

  // Kohene salvestamine localStorage'i, kui akordiplokkide seaded muutuvad – vältib seadete kaotust kiire värskenduse korral
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getPersistedState()));
    } catch (_) { /* ignore */ }
  }, [figurenotesChordBlocks, figurenotesChordBlocksShowTones, figurenotesMelodyShowNoteNames, figurenotesChordLineGap, getPersistedState]);

  // Auto-save to localStorage when relevant state changes
  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getPersistedState()));
      } catch (_) { /* ignore */ }
      autoSaveTimeoutRef.current = null;
    }, 600);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [staves, activeStaffIndex, timeSignature, timeSignatureMode, keySignature, staffLines, notationStyle, pixelsPerBeat, notationMode, cursorPosition, addedMeasures, setupCompleted, songTitle, author, pickupEnabled, pickupQuantity, pickupDuration, layoutSystemGap, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, figurenotesChordLineGap, figurenotesChordBlocks, figurenotesChordBlocksShowTones, figurenotesMelodyShowNoteNames, timeSignatureSize, showBarNumbers, barNumberSize, joClefStaffPosition, chords, textBoxes, getPersistedState]);

  // Hoiatus ja salvestamine enne sulgemist (tab/akna sulg, värskendus, navigeerimine)
  useEffect(() => {
    lastPersistedRef.current = getPersistedState();
  }, [getPersistedState]);
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirtyRef.current) {
        try {
          const state = getPersistedState();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_) {}
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [getPersistedState]);

  // Cursor clamp is done later (after measures) so last beat of last bar is allowed; no early clamp here

  const durations = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 };
  
  const getEffectiveDuration = (dur) => {
    const base = durations[dur];
    return isDotted ? base * 1.5 : base;
  };

  // Stage V: History management for undo/redo (ref vältib TDZ – saveToHistory kasutatakse updateNoteTeacherLabel/clearAllNoteLabels juba varem)
  const saveToHistory = useCallback((newNotes) => {
    dirtyRef.current = true;
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newNotes)));
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);
  saveToHistoryRef.current = saveToHistory;

  const undo = useCallback(() => {
    if (historyIndex >= 0 && history[historyIndex]) {
      setNotes(JSON.parse(JSON.stringify(history[historyIndex])));
      setHistoryIndex((prev) => prev - 1);
    }
  }, [history, historyIndex]);

  // Get selected notes for range selection
  const getSelectedNotes = useCallback(() => {
    if (selectionStart >= 0 && selectionEnd >= 0) {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      return notes.slice(start, end + 1);
    } else if (selectedNoteIndex >= 0) {
      return [notes[selectedNoteIndex]];
    }
    return [];
  }, [notes, selectedNoteIndex, selectionStart, selectionEnd]);

  // Kopeeri praegune valik lõikelauale (Ctrl/Cmd+C, kontekstimenüü).
  const copySelectionToClipboard = useCallback(() => {
    const selectedNotes = getSelectedNotes();
    if (!selectedNotes.length) return;
    const payload = JSON.parse(JSON.stringify(selectedNotes));
    setClipboard(payload);
    setClipboardHistory((prev) => {
      const entry = {
        id: Date.now() + Math.random(),
        notes: payload,
        createdAt: Date.now()
      };
      const next = [entry, ...prev];
      return next.slice(0, 20);
    });
  }, [getSelectedNotes, setClipboardHistory]);

  // Check if note is in selection range
  const isNoteSelected = useCallback((index) => {
    if (selectionStart >= 0 && selectionEnd >= 0) {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      return index >= start && index <= end;
    }
    return index === selectedNoteIndex;
  }, [selectedNoteIndex, selectionStart, selectionEnd]);

  // Pitch order for pitch-class steps (same octave)
  const pitchOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  /**
   * Change pitch class within the same octave, respecting the key signature (diatonic scale).
   * E.g. in D major: D → E → F# → G → A → B → C# → D. Arrow Up/Down.
   * @param {number} [currentAccidental=0] - -1 = flat, 0 = natural, 1 = sharp
   */
  const shiftPitchClassSameOctave = useCallback((currentPitch, currentOctave, currentAccidental, direction, keySig) => {
    const key = keySig ?? 'C';
    const scale = getDiatonicScaleForKey(key);
    const currentSemi = getPitchSemitone(currentPitch, currentAccidental ?? 0);
    const degreeIndex = scale.findIndex((d) => d.semitone === currentSemi);
    if (degreeIndex < 0) {
      return { pitch: currentPitch, octave: currentOctave, accidental: currentAccidental ?? 0 };
    }
    const newIndex = (degreeIndex + direction + 7) % 7;
    const next = scale[newIndex];
    return { pitch: next.letter, octave: currentOctave, accidental: next.accidental };
  }, []);

  /** Diatonic step (can change octave at B↔C). Used when crossing octave is desired. */
  const shiftPitch = useCallback((currentPitch, currentOctave, direction) => {
    const currentIndex = pitchOrder.indexOf(currentPitch);
    let newIndex = currentIndex + direction;
    let newOctave = currentOctave;

    if (newIndex >= pitchOrder.length) {
      newIndex = 0;
      newOctave = Math.min(currentOctave + 1, 6);
    } else if (newIndex < 0) {
      newIndex = pitchOrder.length - 1;
      newOctave = Math.max(currentOctave - 1, 2);
    }

    return { pitch: pitchOrder[newIndex], octave: newOctave };
  }, []);

  const shiftOctave = useCallback((currentOctave, direction) => {
    return Math.max(2, Math.min(6, currentOctave + direction));
  }, []);

  // Noodi kestus neljandikühikutes (sama mis note.duration; sõltumata taktimõõdu kirjest).
  const durationToBeats = useCallback((durationLabel, isDotted = false) => {
    return durationLabelToQuarterNoteUnits(durationLabel, isDotted);
  }, []);

  // Minimum measures needed so that all notes in staves are visible (laadimise viga: kui addedMeasures puudub/vale, näitame ikkagi kõiki noote).
  const minMeasuresFromNotes = useMemo(
    () => computeMinMeasuresFromStaves(staves, timeSignature, pickupEnabled, pickupQuantity, pickupDuration),
    [staves, timeSignature, pickupEnabled, pickupQuantity, pickupDuration]
  );

  useEffect(() => {
    minMeasuresFromNotesRef.current = minMeasuresFromNotes;
  }, [minMeasuresFromNotes]);

  // Taktimõõdu muutumisel kohanda taktide arvu nii, et taktinumbrid vastaksid uuele taktimõõdule
  // (nt 2/4 → 4/4: sama noodistik = vähem takte, rea esimene taktinumber väheneb).
  useEffect(() => {
    const needed = minMeasuresFromNotes;
    setAddedMeasures((prev) => {
      const currentTotal = 1 + (prev || 0);
      if (currentTotal > needed) return Math.max(0, needed - 1);
      return prev;
    });
  }, [timeSignature?.beats, timeSignature?.beatUnit]);

  // Calculate measures (with optional pickup / eeltakt – exact rhythmic value). Pikkus = max kõigi ridade pikkus.
  const calculateMeasures = useCallback(() => {
    const measureQuarters = measureLengthInQuarterBeats(timeSignature);
    let firstMeasureBeats = measureQuarters;
    if (pickupEnabled && pickupQuantity > 0 && pickupDuration) {
      const onePickupQuarters = durationLabelToQuarterNoteUnits(pickupDuration);
      firstMeasureBeats = pickupQuantity * onePickupQuarters;
      firstMeasureBeats = Math.max(0.25, Math.min(firstMeasureBeats, measureQuarters - 0.25));
    }

    const getMeasureBounds = (measureIndex) => {
      if (measureIndex === 0) {
        return { startBeat: 0, endBeat: firstMeasureBeats, beatCount: firstMeasureBeats };
      }
      const startBeat = firstMeasureBeats + (measureIndex - 1) * measureQuarters;
      return { startBeat, endBeat: startBeat + measureQuarters, beatCount: measureQuarters };
    };

    // User-driven bar count (1 + addedMeasures), but at least minMeasuresFromNotes so laaditud fail näitab alati kõiki noote.
    let totalMeasures = Math.max(1, Math.max(1 + (addedMeasures || 0), minMeasuresFromNotes));
    const applyDemoCap = !hasFullAccess;
    if (applyDemoCap) {
      totalMeasures = Math.min(DEMO_MAX_MEASURES, totalMeasures);
    }
    const measures = [];
    for (let i = 0; i < totalMeasures; i++) {
      const b = getMeasureBounds(i);
      measures.push({ ...b, notes: [] });
    }
    return applyDemoCap ? measures.slice(0, DEMO_MAX_MEASURES) : measures;
  }, [timeSignature, addedMeasures, pickupEnabled, pickupQuantity, pickupDuration, hasFullAccess, minMeasuresFromNotes]);

  /** Viimase takti lõpu beat (sama loogika kui calculateMeasures) — kasutusel N-režiimi automaatse taktide laiendamise jaoks */
  const getScoreEndBeatForLayout = useCallback((addedMeas, minM) => {
    const measureQuarters = measureLengthInQuarterBeats(timeSignature);
    let firstMeasureBeats = measureQuarters;
    if (pickupEnabled && pickupQuantity > 0 && pickupDuration) {
      const onePickupQuarters = durationLabelToQuarterNoteUnits(pickupDuration);
      firstMeasureBeats = pickupQuantity * onePickupQuarters;
      firstMeasureBeats = Math.max(0.25, Math.min(firstMeasureBeats, measureQuarters - 0.25));
    }
    const endBeatForIndex = (measureIndex) => {
      if (measureIndex === 0) return firstMeasureBeats;
      const startBeat = firstMeasureBeats + (measureIndex - 1) * measureQuarters;
      return startBeat + measureQuarters;
    };
    let totalMeasures = Math.max(1, Math.max(1 + (addedMeas || 0), minM));
    if (!hasFullAccess) {
      totalMeasures = Math.min(DEMO_MAX_MEASURES, totalMeasures);
    }
    const idx = Math.max(0, totalMeasures - 1);
    return endBeatForIndex(idx);
  }, [timeSignature, pickupEnabled, pickupQuantity, pickupDuration, hasFullAccess]);

  const maxCursorAllowed = useMemo(() => {
    const ms = calculateMeasures();
    return ms.length ? ms[ms.length - 1].endBeat : 0;
  }, [calculateMeasures]);
  const demoMaxCursor = useMemo(() => {
    const beatsPerMeasure = beatsPerMeasureFromTimeSig(timeSignature);
    const pickupBeats = pickupEnabled
      ? Math.max(0, Math.min(beatsPerMeasure, durationToBeats(pickupDuration) * (pickupQuantity || 0)))
      : beatsPerMeasure;
    return pickupBeats + Math.max(0, DEMO_MAX_MEASURES - 1) * beatsPerMeasure;
  }, [timeSignature, pickupEnabled, pickupDuration, pickupQuantity, durationToBeats]);
  const maxCursor = hasFullAccess ? maxCursorAllowed : Math.min(maxCursorAllowed, demoMaxCursor);
  restPaddingGridEndBeatRef.current = maxCursorAllowed;

  /** N-režiim: autopikendus on lubatud ainult reaalse sisestuse ajal (noot/pattern),
   *  mitte kursori nooleliikumisel.
   *  provisionalMinMeasuresFromNotes = sama renderi noodijärgselt (ref võib olla ühe kaadri võrra vana). */
  const expandScoreForNoteInputAdvance = useCallback((nextBeat, provisionalMinMeasuresFromNotes, trigger = 'note-insert') => {
    if (!noteInputMode) return;
    if (trigger !== 'note-insert' && trigger !== 'pattern-insert') {
      throwCursorModelError('AUTO_EXPAND_TRIGGER_INVALID', 'Auto-expand is only allowed on concrete note/pattern insert actions.', {
        trigger,
        nextBeat,
      });
    }
    const EPS = 1e-6;
    if (nextBeat < maxCursorAllowed - EPS) return;
    if (!hasFullAccess && nextBeat > demoMaxCursor + EPS) return;
    setAddedMeasures((prev) => {
      const refMin = minMeasuresFromNotesRef.current || 1;
      const minM = provisionalMinMeasuresFromNotes != null
        ? Math.max(refMin, provisionalMinMeasuresFromNotes)
        : refMin;
      let a = prev ?? 0;
      let end = getScoreEndBeatForLayout(a, minM);
      let guard = 0;
      while (nextBeat > end - EPS && guard++ < 64) {
        const uncapped = Math.max(1 + a, minM);
        const nextEnd = getScoreEndBeatForLayout(uncapped, minM);
        if (nextEnd <= end + EPS) break;
        a = uncapped;
        end = nextEnd;
      }
      if (a !== (prev ?? 0)) dirtyRef.current = true;
      return a;
    });
  }, [noteInputMode, maxCursorAllowed, hasFullAccess, demoMaxCursor, getScoreEndBeatForLayout]);

  useEffect(() => {
    setCursorPosition(prev => {
      if (prev < 0) return 0;
      if (prev > maxCursor) return maxCursor;
      return prev;
    });
  }, [maxCursor]);

  useEffect(() => {
    const clear = () => { tabStaffCycleHeldRef.current = false; };
    const onKeyUp = (e) => {
      if (e.code === 'Tab') clear();
    };
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const getEffectivePlaybackBpm = useCallback(() => {
    const tempoBox = (textBoxes || []).find((tb) => Number.isFinite(tb?.tempoBpm) && tb.tempoBpm > 0);
    if (tempoBox) return Math.max(20, Math.min(300, Number(tempoBox.tempoBpm) || 120));
    return 120;
  }, [textBoxes]);

  const stopPreviewNote = useCallback(() => {
    if (activePreviewStopTimeoutRef.current) {
      clearTimeout(activePreviewStopTimeoutRef.current);
      activePreviewStopTimeoutRef.current = null;
    }
    if (activeSoundfontVoiceRef.current && typeof activeSoundfontVoiceRef.current.stop === 'function') {
      try { activeSoundfontVoiceRef.current.stop(); } catch (_) {}
    }
    activeSoundfontVoiceRef.current = null;
    if (activeOscillatorStopRef.current) {
      try { activeOscillatorStopRef.current(); } catch (_) {}
    }
    activeOscillatorStopRef.current = null;
  }, []);

  const playPianoNote = useCallback((pitch, octave, semitonesOffset = 0, options = {}) => {
    const durationMs = Math.max(40, Number(options.durationMs) || 280);
    const cutPrevious = options.cutPrevious !== false;
    if (cutPrevious) stopPreviewNote();
    const instrumentId = options.instrumentId || instrument;
    // accidental: -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp. Võtab arvud ja stringid (salvestatud andmed).
    const raw = typeof semitonesOffset === 'number' && Number.isFinite(semitonesOffset)
      ? semitonesOffset
      : (semitonesOffset === true || semitonesOffset === 1 ? 1 : semitonesOffset === -1 ? -1 : Number(semitonesOffset));
    const semi = Number.isFinite(raw) ? Math.max(-2, Math.min(2, Math.round(raw))) : 0;
    const oct = octave ?? 4;
    const baseMidi = pitchOctaveToMidi(pitch, oct);
    if (!Number.isFinite(baseMidi)) return; // vigane pitch/octave – ära mängi, et helimängija ei satuks segadusse
    const midiNote = Math.max(0, Math.min(127, Math.round(baseMidi + semi)));
    const freq = getNoteFrequency(tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, pitch, oct, semi);
    const soundfontName = INSTRUMENT_TO_SOUNDFONT_NAME[instrumentId] || 'acoustic_grand_piano';
    const soundfontPack = soundfontPackForInstrumentId(instrumentId);
    const sfCacheKey = soundfontPlayerCacheKey(instrumentId);
    let ctx = audioContextRef.current;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
      } catch (_) {}
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    const cached = ctx && soundfontCacheRef.current[sfCacheKey];
    if (cached) {
      try {
        const voice = cached.play(midiNote, ctx.currentTime, { duration: durationMs / 1000 });
        activeSoundfontVoiceRef.current = voice || null;
        activePreviewStopTimeoutRef.current = setTimeout(() => {
          if (activeSoundfontVoiceRef.current && typeof activeSoundfontVoiceRef.current.stop === 'function') {
            try { activeSoundfontVoiceRef.current.stop(); } catch (_) {}
          }
          activeSoundfontVoiceRef.current = null;
          activePreviewStopTimeoutRef.current = null;
        }, durationMs + 40);
        return;
      } catch (_) {}
    }
    activeOscillatorStopRef.current = playTone(audioContextRef, freq, durationMs);
    activePreviewStopTimeoutRef.current = setTimeout(() => {
      if (activeOscillatorStopRef.current) {
        try { activeOscillatorStopRef.current(); } catch (_) {}
      }
      activeOscillatorStopRef.current = null;
      activePreviewStopTimeoutRef.current = null;
    }, durationMs + 40);
    if (ctx && !soundfontCacheRef.current[sfCacheKey]) {
      Soundfont.instrument(ctx, soundfontName, { soundfont: soundfontPack })
        .then((player) => {
          soundfontCacheRef.current[sfCacheKey] = player;
        })
        .catch(() => {});
    }
  }, [tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, instrument, stopPreviewNote]);

  const startPedagogicalPlayback = useCallback(() => {
    if (!pedagogicalAudioUrl) return;
    if (pedagogicalPlaybackIntervalRef.current) return;
    const audio = new Audio(pedagogicalAudioUrl);
    audio.playbackRate = clampNumber(Number(pedagogicalAudioPlaybackRate) || 1, 0.5, 2);
    pedagogicalAudioRef.current = audio;
    const bpm = Math.max(20, Math.min(300, pedagogicalAudioBpm));
    pedagogicalLastSnappedBeatRef.current = 0;
    audio.play().then(() => {
      setIsPedagogicalAudioPlaying(true);
      pedagogicalPlaybackIntervalRef.current = setInterval(() => {
        let run = 0;
        const withBeats = (notes || []).map((n) => {
          const beat = typeof n.beat === 'number' ? n.beat : run;
          run = beat + (n.duration ?? 1);
          return { ...n, beat };
        }).sort((a, b) => a.beat - b.beat);
        const totalBeats = run;
        const beat = (audio.currentTime * bpm) / 60;
        let snapped = 0;
        for (const n of withBeats) {
          if (n.beat <= beat) snapped = n.beat;
        }
        const lastSnapped = pedagogicalLastSnappedBeatRef.current;
        for (const n of withBeats) {
          if (n.beat > lastSnapped && n.beat <= beat && !n.isRest) {
            playPianoNote(n.pitch, n.octave ?? 4, n.accidental ?? 0);
          }
        }
        pedagogicalLastSnappedBeatRef.current = snapped;
        setPedagogicalAudioCurrentTime(audio.currentTime || 0);
        setCursorPosition(Math.max(0, Math.min(totalBeats, snapped)));
        if (audio.ended || audio.currentTime >= audio.duration) {
          clearInterval(pedagogicalPlaybackIntervalRef.current);
          pedagogicalPlaybackIntervalRef.current = null;
          setIsPedagogicalAudioPlaying(false);
          setCursorPosition(0);
          setPedagogicalAudioCurrentTime(0);
        }
      }, 50);
    }).catch(() => setIsPedagogicalAudioPlaying(false));
    audio.onended = () => {
      stopPedagogicalPlayback();
      setCursorPosition(0);
    };
  }, [pedagogicalAudioUrl, pedagogicalAudioBpm, notes, stopPedagogicalPlayback, pedagogicalAudioPlaybackRate, playPianoNote]);

  const stopScorePlayback = useCallback((resetCursor = false) => {
    if (scorePlaybackIntervalRef.current) {
      clearInterval(scorePlaybackIntervalRef.current);
      scorePlaybackIntervalRef.current = null;
    }
    setIsScorePlaybackPlaying(false);
    stopPreviewNote();
    if (resetCursor) setCursorPosition(0);
  }, [stopPreviewNote]);

  // Playback vajab repeat-markidega takte enne allpool olevat üldist measuresWithMarks deklaratsiooni.
  // Hoiame eraldi memo, et vältida TDZ (Cannot access 'measuresWithMarks' before initialization).
  const playbackMeasuresWithMarks = useMemo(() => {
    const playbackMeasures = calculateMeasures();
    const normalized = normalizeRepeatMarksMap(measureRepeatMarks, playbackMeasures.length);
    return mergeMeasuresWithRepeatMarks(playbackMeasures, normalized);
  }, [calculateMeasures, measureRepeatMarks]);

  const buildOrchestrationPlaybackNotes = useCallback(() => {
    const allNotes = [];
    for (const staff of staves || []) {
      const instrumentId = staff?.instrumentId || 'single-staff-treble';
      const staffNotes = notesWithExplicitBeatsEarly(staff?.notes || [])
        .map((n) => ({
          ...n,
          beat: Number(n.beat) || 0,
          duration: noteDurationInQuarterBeats(n),
          instrumentId,
        }));
      allNotes.push(...staffNotes);
    }
    return allNotes.sort((a, b) => (a.beat - b.beat));
  }, [staves, notesWithExplicitBeatsEarly, noteDurationInQuarterBeats]);

  const startScorePlayback = useCallback(() => {
    if (scorePlaybackIntervalRef.current) return;
    const withBeats = buildOrchestrationPlaybackNotes();
    if (!withBeats.length) return;
    const { events: playbackEvents, totalBeats } = buildPlaybackNoteEvents(withBeats, playbackMeasuresWithMarks);
    if (!playbackEvents.length || totalBeats <= 0) return;

    const bpm = getEffectivePlaybackBpm();
    const beatMs = 60000 / bpm;
    const startBeat = Math.max(0, Math.min(totalBeats, Number(cursorPosition) || 0));
    scorePlaybackStartedAtRef.current = performance.now() - startBeat * beatMs;
    scorePlaybackLastBeatRef.current = startBeat;
    setIsScorePlaybackPlaying(true);

    scorePlaybackIntervalRef.current = setInterval(() => {
      const now = performance.now();
      const beatNow = Math.max(0, (now - scorePlaybackStartedAtRef.current) / beatMs);
      const prevBeat = scorePlaybackLastBeatRef.current;
      for (const n of playbackEvents) {
        if (!n.isRest && n.playbackBeat > prevBeat && n.playbackBeat <= beatNow) {
          playPianoNote(n.pitch, n.octave ?? 4, n.accidental ?? 0, {
            durationMs: n.duration * beatMs,
            cutPrevious: false,
            instrumentId: n.instrumentId,
          });
        }
      }
      scorePlaybackLastBeatRef.current = beatNow;
      setCursorPosition(Math.min(totalBeats, beatNow));
      if (beatNow >= totalBeats) stopScorePlayback(false);
    }, 25);
  }, [buildOrchestrationPlaybackNotes, playbackMeasuresWithMarks, getEffectivePlaybackBpm, cursorPosition, playPianoNote, stopScorePlayback]);

  const seekPedagogicalAudio = useCallback((deltaSeconds) => {
    if (!pedagogicalAudioUrl) return;
    const audio = pedagogicalAudioRef.current || new Audio(pedagogicalAudioUrl);
    audio.playbackRate = clampNumber(Number(pedagogicalAudioPlaybackRate) || 1, 0.5, 2);
    pedagogicalAudioRef.current = audio;
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (pedagogicalAudioDuration || 0);
    const nextTime = clampNumber((audio.currentTime || 0) + (Number(deltaSeconds) || 0), 0, dur > 0 ? dur : 1e9);
    audio.currentTime = nextTime;
    setPedagogicalAudioCurrentTime(nextTime);
  }, [pedagogicalAudioUrl, pedagogicalAudioDuration, pedagogicalAudioPlaybackRate]);
  useEffect(() => {
    return () => {
      if (pedagogicalPlaybackIntervalRef.current) clearInterval(pedagogicalPlaybackIntervalRef.current);
      if (scorePlaybackIntervalRef.current) clearInterval(scorePlaybackIntervalRef.current);
      if (pedagogicalAudioRef.current) {
        pedagogicalAudioRef.current.pause();
        pedagogicalAudioRef.current = null;
      }
      stopPreviewNote();
      if (pedagogicalAudioUrlRef.current) URL.revokeObjectURL(pedagogicalAudioUrlRef.current);
    };
  }, [stopPreviewNote]);

  // Lisa uus noodirida valitud instrumendiga (noodivõti instrumendi konfiguratsioonist). Igal real oma notationMode (T/F/P).
  const addStaff = useCallback((instId) => {
    const cfg = INSTRUMENT_CONFIG_BASE[instId];
    const clef = (cfg?.defaultClef) || 'treble';
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const staffNotationMode = notationStyle === 'FIGURENOTES' ? 'figurenotes' : notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional';
    setStaves((prev) => {
      const span = Math.max(getStavesMaxNotesEndBeat(prev), maxCursorAllowed);
      const pad = restPaddingImplicitFromZeroTo(span);
      return [...prev, { id, instrumentId: instId, clefType: clef, notes: pad, notationMode: staffNotationMode }];
    });
    setActiveStaffIndex(staves.length);
  }, [notationStyle, notationMode, staves.length, getStavesMaxNotesEndBeat, restPaddingImplicitFromZeroTo, maxCursorAllowed]);

  // Klaveri sisestamine: kaks noodirida (viiulivõti + bassivõti), ühendatud ühe instrumendi süsteemina (sulgega)
  const addPianoStaff = useCallback(() => {
    const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
    const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const staffMode = notationStyle === 'FIGURENOTES' ? 'figurenotes' : notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional';
    setStaves((prev) => {
      const span = Math.max(getStavesMaxNotesEndBeat(prev), maxCursorAllowed);
      const padTreble = restPaddingImplicitFromZeroTo(span);
      const padBass = restPaddingImplicitFromZeroTo(span);
      return [
        ...prev,
        { id: id1, instrumentId: 'piano', clefType: 'treble', notes: padTreble, braceGroupId, notationMode: staffMode },
        { id: id2, instrumentId: 'piano', clefType: 'bass', notes: padBass, braceGroupId, notationMode: staffMode }
      ];
    });
    setActiveStaffIndex(staves.length);
  }, [notationStyle, notationMode, staves.length, getStavesMaxNotesEndBeat, restPaddingImplicitFromZeroTo, maxCursorAllowed]);
  const addInstrumentToScore = useCallback((instId) => {
    if (!instId) return;
    const cfg = instrumentConfig[instId];
    if (instId === 'piano') {
      if (staves.length === 1) {
        setStaves((prev) => {
          const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
          const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-a`;
          const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-b`;
          const staffMode = notationStyle === 'FIGURENOTES' ? 'figurenotes' : notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional';
          const trebleNotes = prev[0]?.notes ?? [];
          const span = Math.max(getStavesMaxNotesEndBeat(prev), maxCursorAllowed);
          const bassPad = restPaddingImplicitFromZeroTo(span);
          return [
            { id: id1, instrumentId: 'piano', clefType: 'treble', notes: trebleNotes, braceGroupId, notationMode: staffMode },
            { id: id2, instrumentId: 'piano', clefType: 'bass', notes: bassPad, braceGroupId, notationMode: staffMode }
          ];
        });
        setVisibleStaves([true, true]);
        setActiveStaffIndex(0);
      } else {
        addPianoStaff();
      }
    } else {
      addStaff(instId);
    }
    if (cfg) {
      if (cfg.type === 'standard' || cfg.type === 'grandStaff' || cfg.type === 'figuredBass' || cfg.type === 'accordion') setInstrumentNotationVariant('standard');
      else if (cfg.type === 'tab') {
        if (instrumentNotationVariant === 'fingering' || instrumentNotationVariant === 'figuredBass') setInstrumentNotationVariant('standard');
      } else if (cfg.type === 'wind') {
        if (instrumentNotationVariant === 'tab' || instrumentNotationVariant === 'figuredBass') setInstrumentNotationVariant('standard');
      }
    }
    dirtyRef.current = true;
  }, [addPianoStaff, addStaff, instrumentConfig, instrumentNotationVariant, notationMode, notationStyle, staves.length, getStavesMaxNotesEndBeat, restPaddingImplicitFromZeroTo, maxCursorAllowed]);
  const reorderStaffById = useCallback((staffId, direction) => {
    if (!staffId || !direction) return;
    setStaves((prev) => {
      const idx = prev.findIndex((s) => s.id === staffId);
      if (idx < 0) return prev;
      const cluster = getBraceClusterAtIndex(prev, idx);
      const target = direction === 'up' ? cluster.start - 1 : cluster.start + cluster.count;
      if (target < 0 || target >= prev.length) return prev;
      const moving = prev.slice(cluster.start, cluster.start + cluster.count);
      const base = prev.slice(0, cluster.start).concat(prev.slice(cluster.start + cluster.count));
      const insertAt = direction === 'up' ? target : Math.max(0, target - cluster.count + 1);
      const next = base.slice(0, insertAt).concat(moving, base.slice(insertAt));
      setVisibleStaves((visPrev) => {
        const vis = Array.isArray(visPrev) ? visPrev.slice(0, prev.length) : prev.map(() => true);
        while (vis.length < prev.length) vis.push(true);
        const movingVis = vis.slice(cluster.start, cluster.start + cluster.count);
        const visBase = vis.slice(0, cluster.start).concat(vis.slice(cluster.start + cluster.count));
        return visBase.slice(0, insertAt).concat(movingVis, visBase.slice(insertAt));
      });
      setActiveStaffIndex(normalizeActiveStaffById(next, staffId));
      return next;
    });
    dirtyRef.current = true;
  }, [getBraceClusterAtIndex, normalizeActiveStaffById]);
  const removeStaffById = useCallback((staffId) => {
    if (!staffId) return;
    setStaves((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((s) => s.id === staffId);
      if (idx < 0) return prev;
      const cluster = getBraceClusterAtIndex(prev, idx);
      const next = prev.slice(0, cluster.start).concat(prev.slice(cluster.start + cluster.count));
      if (next.length === 0) return prev;
      setVisibleStaves((visPrev) => {
        const vis = Array.isArray(visPrev) ? visPrev.slice(0, prev.length) : prev.map(() => true);
        while (vis.length < prev.length) vis.push(true);
        return vis.slice(0, cluster.start).concat(vis.slice(cluster.start + cluster.count));
      });
      setInstrumentPartGroups((groupsPrev) => (groupsPrev || []).map((g) => ({ ...g, staffIds: (g.staffIds || []).filter((id) => next.some((s) => s.id === id)) })).filter((g) => (g.staffIds || []).length > 0));
      setActiveStaffIndex(normalizeActiveStaffById(next, staffId));
      setInstrumentManagerSelectedStaffId(next[Math.min(cluster.start, next.length - 1)]?.id ?? null);
      return next;
    });
    dirtyRef.current = true;
  }, [getBraceClusterAtIndex, normalizeActiveStaffById]);
  const copyStaffById = useCallback((staffId, withNotes) => {
    if (!staffId) return;
    setStaves((prev) => {
      const idx = prev.findIndex((s) => s.id === staffId);
      if (idx < 0) return prev;
      const cluster = getBraceClusterAtIndex(prev, idx);
      const source = prev.slice(cluster.start, cluster.start + cluster.count);
      const newBraceId = source.length > 1 ? ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `brace-${Date.now()}`) : undefined;
      const copies = source.map((s, offset) => {
        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${offset}`;
        return {
          ...s,
          id: newId,
          notes: withNotes ? [...(s.notes || [])] : [],
          braceGroupId: source.length > 1 ? newBraceId : undefined,
        };
      });
      const insertAt = cluster.start + cluster.count;
      const next = prev.slice(0, insertAt).concat(copies, prev.slice(insertAt));
      setVisibleStaves((visPrev) => {
        const vis = Array.isArray(visPrev) ? visPrev.slice(0, prev.length) : prev.map(() => true);
        while (vis.length < prev.length) vis.push(true);
        return vis.slice(0, insertAt).concat(copies.map(() => true), vis.slice(insertAt));
      });
      setActiveStaffIndex(normalizeActiveStaffById(next, copies[0]?.id));
      setInstrumentManagerSelectedStaffId(copies[0]?.id ?? null);
      return next;
    });
    dirtyRef.current = true;
  }, [getBraceClusterAtIndex, normalizeActiveStaffById]);

  // Alias for use in addNoteAtCursor etc. (defined early as notesWithExplicitBeatsEarly to avoid TDZ).
  const notesWithExplicitBeats = notesWithExplicitBeatsEarly;

  // Handle toolbox selection (clickedIndex = option index when clicking, else uses selectedOptionIndex for keyboard).
  // When options.insertAtBeat is set (e.g. from figure-beat click), use it so the writer follows the cursor/click position (avoids stale cursorPosition from async setState).
  const addNoteAtCursor = useCallback((pitch, octave, accidental, options = {}) => {
    const insertBeat = typeof options.insertAtBeat === 'number' ? options.insertAtBeat : cursorPosition;
    const oct = octave ?? ghostOctave;
    // Figuurnotatsioonis kasutaja ei näe võtmemärke – kui accidental pole ette antud, võta helistikust (nt G-duur → F#).
    const keyAccForPitch = getAccidentalForPitchInKey(pitch, keySignature);
    const accResolved = accidental !== undefined
      ? accidental
      : (notationStyle === 'FIGURENOTES'
        ? getAccidentalForPitchInKey(pitch, keySignature)
        : (ghostAccidentalIsExplicit ? ghostAccidental : keyAccForPitch));
    const currentInstrumentId = staves?.[activeStaffIndex]?.instrumentId ?? instrument;
    const currentInstrumentRange = INSTRUMENT_CONFIG_BASE?.[currentInstrumentId]?.range;
    const currentRangeMidi = resolveInstrumentRangeMidi(currentInstrumentId, keySignature, currentInstrumentRange);
    const currentNoteMidi = toNoteMidi(pitch, oct, accResolved);
    const isOutOfRangeInsert = isMidiOutOfInstrumentRange(currentNoteMidi, currentRangeMidi);
    if (isOutOfRangeInsert) {
      const rangeLabel = resolveInstrumentRange(currentInstrumentId, keySignature, currentInstrumentRange);
      const low = Array.isArray(rangeLabel) ? rangeLabel[0] : '?';
      const high = Array.isArray(rangeLabel) ? rangeLabel[1] : '?';
      setSaveFeedback(`${(INSTRUMENT_I18N_KEYS?.[currentInstrumentId] ? t(INSTRUMENT_I18N_KEYS[currentInstrumentId]) : currentInstrumentId) || 'Instrument'}: noot on ulatusest väljas (${low}–${high})`);
      setTimeout(() => setSaveFeedback(''), 2600);
    }
    const durationLabel = lastDurationRef.current ?? selectedDuration;
    let effectiveDuration = getEffectiveDuration(durationLabel);
    let tupletPayload = null;
    if (tupletMode) {
      const base = durations[durationLabel];
      if (base != null) {
        const spaceBeats = base * tupletMode.inSpaceOf;
        effectiveDuration = spaceBeats / tupletMode.type;
        tupletPayload = { type: tupletMode.type, inSpaceOf: tupletMode.inSpaceOf };
      }
    }
    assertCursorTimeModelInputs('addNoteAtCursor', insertBeat, durationLabel, effectiveDuration);
    const accidentalPayload = notationStyle === 'FIGURENOTES'
      ? (accResolved !== 0 ? { accidental: accResolved } : {})
      : (accResolved === keyAccForPitch ? {} : { accidental: accResolved });
    const newNote = {
      id: Date.now(),
      pitch,
      octave: oct,
      duration: effectiveDuration,
      durationLabel,
      beat: insertBeat,
      isDotted: tupletPayload ? false : (options.forceDotted != null ? !!options.forceDotted : isDotted),
      isRest: options.forceRest != null ? !!options.forceRest : isRest,
      lyric: '',
      ...accidentalPayload,
      ...(tupletPayload && { tuplet: tupletPayload })
    };
    const midiForStaff = (oct + 1) * 12 + (PITCH_TO_SEMI[pitch] ?? 0);
    const isGrandStaff = staves.length >= 2 && staves[0].braceGroupId && staves[0].braceGroupId === staves[1]?.braceGroupId;
    // Tavaklaver: noot läheb automaatselt bassi/treblisse MIDI järgi. Figuurnotatsioonis valib kasutaja aktiivse rea
    // (klõps, Cmd/Ctrl+↑↓) — MIDI-jaotus ignoreeriks seda ja paneks nt C4 alati ülemisele reale kuigi kursor on bassil.
    const targetStaffIndex =
      isGrandStaff && notationStyle !== 'FIGURENOTES'
        ? (midiForStaff < 60 ? 1 : 0)
        : activeStaffIndex;

    const insertIntoStaffNotes = (noteList) => {
      const withBeats = notesWithExplicitBeats(noteList);
      const EPS = 1e-6;
      const ndur = (n) => noteDurationInQuarterBeats(n);
      const newEnd = insertBeat + effectiveDuration;

      // Kui kursor on puhkuse sees (mitte täpselt alguses), jaga puhkus: eelnevad pausid + uus + järellüngas pausid.
      let splitRestId = null;
      let splitRestStart = 0;
      let splitRestEnd = 0;
      for (const n of withBeats) {
        if (!n.isRest) continue;
        const nb = n.beat ?? 0;
        const end = nb + ndur(n);
        if (insertBeat > nb + EPS && insertBeat < end - EPS) {
          splitRestId = n.id;
          splitRestStart = nb;
          splitRestEnd = end;
          break;
        }
      }

      const victimsAtStart = withBeats.filter((n) => Math.abs((n.beat ?? 0) - insertBeat) < EPS);
      let victimSpanEnd = insertBeat;
      if (victimsAtStart.length > 0) {
        victimSpanEnd = Math.max(...victimsAtStart.map((n) => (n.beat ?? 0) + ndur(n)));
      }

      const cleaned = withBeats.filter((n) => {
        if (splitRestId != null && n.id === splitRestId) return false;
        const nb = n.beat ?? 0;
        const sameBeat = Math.abs(nb - insertBeat) < EPS;
        if (sameBeat) return false;
        const d = ndur(n);
        const sameDur = Math.abs(d - effectiveDuration) < EPS;
        return !(n.isRest && sameBeat && sameDur);
      });

      const toAdd = [];
      if (splitRestId != null) {
        if (insertBeat > splitRestStart + EPS) {
          toAdd.push(...fillGapWithRests(splitRestStart, insertBeat));
        }
        toAdd.push(newNote);
        if (splitRestEnd > newEnd + EPS) {
          toAdd.push(...fillGapWithRests(newEnd, splitRestEnd));
        }
      } else {
        toAdd.push(newNote);
        // Lühem noot/puhkus asendab pikemat sama algusega: täida ülejäänud auk pausidega (nt 1/16 veerandi asemele → kolm 1/16 pausi).
        if (victimsAtStart.length > 0 && victimSpanEnd > newEnd + EPS) {
          toAdd.push(...fillGapWithRests(newEnd, victimSpanEnd));
        }
      }

      const merged = [...cleaned, ...toAdd].sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
      const totalSpan = merged.reduce((max, n) => Math.max(max, (n.beat ?? 0) + ndur(n)), 0);
      const demoMaxSpanBeats = beatsPerMeasureFromTimeSig(timeSignature) * DEMO_MAX_MEASURES;
      if (!hasFullAccess && totalSpan > demoMaxSpanBeats) {
        setSaveFeedback('Demo: max 8 takti (2 rida). Logi sisse või registreeru, et kirjutada edasi.');
        setTimeout(() => setSaveFeedback(''), 3500);
        return null;
      }
      return merged;
    };

    saveToHistory(notes);
    const sourceNotesForInsert = isGrandStaff && targetStaffIndex !== activeStaffIndex
      ? (staves[targetStaffIndex]?.notes || [])
      : notes;
    const mergedNotes = insertIntoStaffNotes(sourceNotesForInsert);
    if (mergedNotes == null) return;
    if (!mergedNotes.some((n) => Math.abs((Number(n?.beat) || 0) - insertBeat) < 1e-6)) {
      throwCursorModelError('INSERT_RESULT_INVALID', 'Insert result must contain event at cursor beat.', {
        source: 'addNoteAtCursor',
        insertBeat,
        durationLabel,
      });
    }
    if (isGrandStaff && targetStaffIndex !== activeStaffIndex) {
      setStaves((prev) => {
        const next = prev.slice();
        const staff = next[targetStaffIndex];
        next[targetStaffIndex] = { ...staff, notes: mergedNotes };
        return next;
      });
    } else {
      setNotes(mergedNotes);
    }
    const provisionalMin = minMeasuresNeededForNotesOnStaves(
      staves,
      targetStaffIndex,
      mergedNotes,
      timeSignature,
      pickupEnabled,
      pickupQuantity,
      pickupDuration
    );
    const nextBeat = insertBeat + effectiveDuration;
    expandScoreForNoteInputAdvance(nextBeat, provisionalMin, 'note-insert');
    setCursorPosition(nextBeat);
    setGhostPitch(pitch);
    setGhostOctave(oct);
    if (!(options.forceRest != null ? !!options.forceRest : isRest) && playNoteOnInsert && !options.skipPlay) {
      const semitones = accResolved === 1 ? 1 : accResolved === -1 ? -1 : 0;
      playPianoNote(pitch, oct, semitones);
    }
  }, [cursorPosition, selectedDuration, getEffectiveDuration, isDotted, isRest, notes, saveToHistory, ghostOctave, ghostAccidental, ghostAccidentalIsExplicit, playPianoNote, playNoteOnInsert, tupletMode, durations, staves, activeStaffIndex, notesWithExplicitBeats, noteDurationInQuarterBeats, notationStyle, keySignature, instrument, t, noteInputMode, expandScoreForNoteInputAdvance, timeSignature, pickupEnabled, pickupQuantity, pickupDuration, assertCursorTimeModelInputs, throwCursorModelError]);

  // Add a note on top of the note at cursor (chord input). Traditional or Pedagogical only. Shift+Letter.
  const addNoteOnTopOfCursor = useCallback((pitch, octave, accidental, options = {}) => {
    if (notes.length === 0) return;
    const keyAccForChord = getAccidentalForPitchInKey(pitch, keySignature);
    const accResolved = accidental !== undefined ? accidental : (ghostAccidentalIsExplicit ? ghostAccidental : keyAccForChord);
    let beat = 0;
    let anchorIndex = -1;
    let anchorBeat = 0;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
      if (cursorPosition >= noteBeat && cursorPosition < noteBeat + n.duration && !n.isRest) {
        anchorIndex = i;
        anchorBeat = noteBeat;
        break;
      }
      beat = noteBeat + n.duration;
    }
    if (anchorIndex < 0) return;
    const anchor = notes[anchorIndex];
    const oct = octave ?? ghostOctave;
    const chordAccidentalPayload = notationStyle === 'FIGURENOTES'
      ? (accResolved !== 0 ? { accidental: accResolved } : {})
      : (accResolved === keyAccForChord ? {} : { accidental: accResolved });
    const newNote = {
      id: Date.now(),
      pitch,
      octave: oct,
      duration: anchor.duration,
      durationLabel: anchor.durationLabel,
      isDotted: anchor.isDotted,
      isRest: false,
      lyric: '',
      beat: anchorBeat,
      ...chordAccidentalPayload
    };
    saveToHistory(notes);
    setNotes((prev) => {
      const next = [...prev];
      next.splice(anchorIndex + 1, 0, newNote);
      return next;
    });
    setGhostPitch(pitch);
    setGhostOctave(oct);
    if (playNoteOnInsert && !options.skipPlay) {
      const semitones = accResolved === 1 ? 1 : accResolved === -1 ? -1 : 0;
      playPianoNote(pitch, oct, semitones);
    }
  }, [notes, cursorPosition, ghostOctave, ghostAccidental, ghostAccidentalIsExplicit, saveToHistory, setNotes, playPianoNote, playNoteOnInsert, notationStyle, keySignature]);

  const insertPatternAtCursor = useCallback((patternKey) => {
    const pattern = RHYTHM_PATTERN_SEGMENTS[patternKey];
    if (!pattern || !ghostPitch) return;
    const totalDuration = pattern.reduce((s, n) => s + n.duration, 0);
    const startBeat = cursorPosition;
    const beamGroupToken = `${patternKey}-${Date.now()}`;
    const newNotes = pattern.map(({ durationLabel, duration, tuplet, beamGroupId }, i) => {
      const beat = startBeat + pattern.slice(0, i).reduce((s, n) => s + n.duration, 0);
      return ({
        id: Date.now() + i,
        pitch: ghostPitch,
        octave: ghostOctave,
        duration,
        durationLabel,
        beat,
        isDotted: false,
        isRest: isRest,
        lyric: '',
        ...(tuplet && { tuplet }),
        ...(beamGroupId && { beamGroupId: `${beamGroupToken}-${beamGroupId}` })
      });
    });
    const withBeats = notesWithExplicitBeats(notes);
    const EPS = 1e-6;
    let cleaned = withBeats;
    for (const nn of newNotes) {
      cleaned = cleaned.filter((n) => {
        const sameBeat = Math.abs((n.beat ?? 0) - (nn.beat ?? 0)) < EPS;
        const sameDur = Math.abs((n.duration ?? 1) - (nn.duration ?? 1)) < EPS;
        return !(n.isRest && sameBeat && sameDur);
      });
    }
    const mergedPattern = [...cleaned, ...newNotes].sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
    saveToHistory(notes);
    setNotes(mergedPattern);
    const patternEndBeat = startBeat + totalDuration;
    const provisionalMinPat = minMeasuresNeededForNotesOnStaves(
      staves,
      activeStaffIndex,
      mergedPattern,
      timeSignature,
      pickupEnabled,
      pickupQuantity,
      pickupDuration
    );
    expandScoreForNoteInputAdvance(patternEndBeat, provisionalMinPat, 'pattern-insert');
    setCursorPosition(patternEndBeat);
    if (!isRest && playNoteOnInsert) playPianoNote(ghostPitch, ghostOctave);
  }, [ghostPitch, ghostOctave, isRest, notes, saveToHistory, playPianoNote, playNoteOnInsert, cursorPosition, notesWithExplicitBeats, expandScoreForNoteInputAdvance, noteInputMode, staves, activeStaffIndex, timeSignature, pickupEnabled, pickupQuantity, pickupDuration]);

  const applyBeamOverrideAtCursorMeasure = useCallback((overrideValue) => {
    const ms = measuresRef.current;
    if (!Array.isArray(ms) || ms.length === 0) return;
    const idx = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
    const measureQuarters = measureLengthInQuarterBeats(timeSignature);
    const measureIndex = idx >= 0 ? idx : Math.min(Math.max(0, Math.floor((cursorPosition || 0) / measureQuarters)), ms.length - 1);
    const targetMeasure = ms[measureIndex];
    if (!targetMeasure) return;

    const GROUP_SPAN_BY_OVERRIDE = {
      'beam:2/8': 1,
      'beam:3/8': 1.5,
      'beam:4/8': 2,
      'beam:3/16': 0.75,
    };
    const groupSpan = GROUP_SPAN_BY_OVERRIDE[overrideValue];
    const measureStart = targetMeasure.startBeat;
    const measureEnd = targetMeasure.endBeat;
    const EPS = 1e-6;
    const token = `manual-beam-${measureIndex}-${Date.now()}`;

    saveToHistory(notes);
    setNotes((prev) => {
      const withBeats = notesWithExplicitBeats(prev);
      return withBeats.map((n) => {
        const beat = Number(n.beat) || 0;
        if (beat < measureStart - EPS || beat >= measureEnd - EPS) return n;
        if (overrideValue === 'beam:auto') {
          const next = { ...n };
          delete next.beamGroupId;
          return next;
        }
        if (n.isRest || !['1/8', '1/16', '1/32'].includes(n.durationLabel || '')) {
          const next = { ...n };
          delete next.beamGroupId;
          return next;
        }
        if (!groupSpan || groupSpan <= 0) return n;
        const localOffset = Math.max(0, beat - measureStart);
        const groupIndex = Math.floor((localOffset + EPS) / groupSpan);
        return { ...n, beamGroupId: `${token}-${groupIndex}` };
      });
    });
  }, [cursorPosition, notes, notesWithExplicitBeats, saveToHistory, timeSignature]);

  // Akordi lisamise asukoht: kursor (sisestusrežiim) või valitud noodi algus
  const getChordInsertBeat = useCallback(() => {
    if (noteInputMode) return cursorPosition;
    if (selectedNoteIndex >= 0 && selectedNoteIndex < notes.length) {
      return notes.slice(0, selectedNoteIndex).reduce((s, n) => s + n.duration, 0);
    }
    return cursorPosition;
  }, [noteInputMode, cursorPosition, selectedNoteIndex, notes]);

  const normalizeChordHotkey = useCallback((raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    // If contains "+", interpret prefix as type (m/7) and suffix as note name.
    if (s.includes('+')) {
      const [prefixRaw, noteRaw] = s.split('+');
      const type = String(prefixRaw || '').trim().toLowerCase();
      const notePart = String(noteRaw || '').trim();
      if (!notePart) return s;
      const base = notePart.charAt(0).toUpperCase() + notePart.slice(1);
      if (type === 'm') return `${base}m`;
      if (type === '7') return `${base}7`;
      return base;
    }
    // No "+": single-letter note (major) or already formatted chord like Dm, C7, F#m.
    if (/^[a-gA-G]$/.test(s)) {
      return s.toUpperCase();
    }
    if (/^[a-gA-G][#b]?$/.test(s)) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return s;
  }, []);

  const normalizeLoadedChords = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c === 'object')
      .map((c, idx) => {
        const beat = Number(c.beatPosition);
        const durationBeats = Number(c.durationBeats);
        return {
          id: c.id ?? `chord-${Date.now()}-${idx}`,
          beatPosition: Number.isFinite(beat) ? Math.max(0, beat) : 0,
          chord: String(c.chord || '').trim(),
          figuredBass: c.figuredBass ? String(c.figuredBass).trim() : '',
          ...(Number.isFinite(durationBeats) && durationBeats > 0 ? { durationBeats } : {})
        };
      })
      .filter((c) => !!c.chord)
      .sort((a, b) => a.beatPosition - b.beatPosition);
  }, []);

  const addChordAt = useCallback((beatPosition, chordText, figuredBass = '') => {
    if (!chordText || !String(chordText).trim()) return;
    const normalized = normalizeChordHotkey(chordText);
    if (!normalized) return;
    dirtyRef.current = true;
    const durationLabel = lastDurationRef.current ?? selectedDuration ?? '1/4';
    const effectiveDurationBeats = getEffectiveDuration(durationLabel) || 1;
    const effectiveBeatPosition = Math.max(0, Number(beatPosition) || 0);
    const newChord = {
      id: Date.now() + Math.random(),
      beatPosition: effectiveBeatPosition,
      chord: String(normalized).trim(),
      figuredBass: figuredBass ? String(figuredBass).trim() : '',
      durationBeats: Math.max(0.125, effectiveDurationBeats)
    };
    setChords(prev => {
      // Replace exact same beat insert, keep other chord changes in measure.
      const EPS = 1e-6;
      const next = prev.filter((c) => Math.abs((Number(c.beatPosition) || 0) - effectiveBeatPosition) > EPS);
      return [...next, newChord].sort((a, b) => a.beatPosition - b.beatPosition);
    });
  }, [normalizeChordHotkey, selectedDuration, getEffectiveDuration]);

  /** Kohandatud akord: väljad + „Lisa akord“ / Enter. Paleti „Sisesta akord…“ ei lisanud kunagi midagi — see juhatas ainult siia. */
  const submitCustomChordEntry = useCallback(() => {
    const raw = customChordInput.trim();
    if (!raw) {
      setSaveFeedback(t('chords.customEmpty') || 'Sisesta akordi nimetus.');
      setTimeout(() => setSaveFeedback(''), 2800);
      return;
    }
    const chord = normalizeChordHotkey(raw);
    addChordAt(getChordInsertBeat(), chord, customFiguredBassInput);
    setCustomChordInput('');
    setCustomFiguredBassInput('');
    setSaveFeedback(t('chords.addedOk') || 'Akord lisatud.');
    setTimeout(() => setSaveFeedback(''), 2200);
  }, [customChordInput, customFiguredBassInput, t, normalizeChordHotkey, addChordAt, getChordInsertBeat]);

  const NOTE_TO_SEMITONE = useMemo(() => ({
    C: 0, 'B#': 0,
    'C#': 1, Db: 1,
    D: 2,
    'D#': 3, Eb: 3,
    E: 4, Fb: 4,
    F: 5, 'E#': 5,
    'F#': 6, Gb: 6,
    G: 7,
    'G#': 8, Ab: 8,
    A: 9,
    'A#': 10, Bb: 10,
    B: 11, H: 11, Cb: 11,
  }), []);
  const SHARP_NAMES = useMemo(() => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], []);
  const FLAT_NAMES = useMemo(() => ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'], []);
  const FLAT_KEYS = useMemo(() => new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']), []);

  const transposeChordRootToken = useCallback((token, semitones, preferFlats = false) => {
    const m = String(token || '').trim().match(/^([A-Ga-gHh])([#b]?)/);
    if (!m) return token;
    const root = m[1].toUpperCase() === 'H' ? 'B' : m[1].toUpperCase();
    const accidental = m[2] || '';
    const src = `${root}${accidental}`;
    const baseSemi = NOTE_TO_SEMITONE[src];
    if (!Number.isFinite(baseSemi)) return token;
    const nextSemi = ((baseSemi + semitones) % 12 + 12) % 12;
    return (preferFlats ? FLAT_NAMES[nextSemi] : SHARP_NAMES[nextSemi]) || token;
  }, [NOTE_TO_SEMITONE, SHARP_NAMES, FLAT_NAMES]);

  const transposeChordSymbolSemitones = useCallback((chordSymbol, semitones, options = {}) => {
    const s = String(chordSymbol || '').trim();
    if (!s || !Number.isFinite(semitones) || semitones === 0) return s;
    const preferFlats = options.preferFlats === true;
    const m = s.match(/^([A-Ga-gHh])([#b]?)(.*)$/);
    if (!m) return s;
    const originalRootToken = `${m[1]}${m[2] || ''}`;
    const rest = m[3] || '';
    const transposedRoot = transposeChordRootToken(originalRootToken, semitones, preferFlats);
    const slashMatch = rest.match(/\/([A-Ga-gHh][#b]?)/);
    if (!slashMatch) return `${transposedRoot}${rest}`;
    const originalBass = slashMatch[1];
    const transposedBass = transposeChordRootToken(originalBass, semitones, preferFlats);
    return `${transposedRoot}${rest.replace(`/${originalBass}`, `/${transposedBass}`)}`;
  }, [transposeChordRootToken]);

  const transposeChordSymbol = useCallback((chordSymbol, step) => {
    const effectiveStep = Number(step) || 0;
    const preferFlats = FLAT_KEYS.has(keySignature);
    return transposeChordSymbolSemitones(chordSymbol, effectiveStep, { preferFlats });
  }, [transposeChordSymbolSemitones, FLAT_KEYS, keySignature]);

  const getChordAtCursor = useCallback(() => {
    const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
    const cursorMeasureIdx = Math.floor(cursorPosition / beatsPerMeasure);
    const measureStart = cursorMeasureIdx * beatsPerMeasure;
    const measureEnd = measureStart + beatsPerMeasure;
    const inMeasure = chords
      .filter((c) => Number(c.beatPosition) >= measureStart && Number(c.beatPosition) < measureEnd)
      .sort((a, b) => Number(a.beatPosition) - Number(b.beatPosition));
    if (inMeasure.length === 0) return undefined;
    for (let i = 0; i < inMeasure.length; i++) {
      const c = inMeasure[i];
      const start = Number(c.beatPosition) || measureStart;
      const nextStart = i < inMeasure.length - 1 ? (Number(inMeasure[i + 1].beatPosition) || measureEnd) : measureEnd;
      const rawDurationEnd = Number.isFinite(Number(c.durationBeats)) && Number(c.durationBeats) > 0
        ? (start + Number(c.durationBeats))
        : measureEnd;
      const end = Math.max(start, Math.min(rawDurationEnd, nextStart, measureEnd));
      if (cursorPosition >= start && cursorPosition < end) return c;
    }
    return undefined;
  }, [chords, cursorPosition, timeSignature]);

  /** Akordipaleti valik (kas dual-ribal ilma aktiivse „chords“ tööriistata või tavapärane). */
  const applyChordToolboxOptionAtIndex = (optionIndex) => {
    const option = toolboxes.chords?.options?.[optionIndex];
    if (!option) return;
    if (option.value === 'custom') {
      setActiveToolbox('chords');
      setSelectedOptionIndex(optionIndex);
      setTimeout(() => customChordInputRef.current?.focus(), 0);
      return;
    }
    addChordAt(getChordInsertBeat(), option.value, '');
    setActiveToolbox(null);
    setSelectedOptionIndex(0);
  };

  const handleToolboxSelection = (clickedIndex) => {
    if (!activeToolbox) return;
    if (noteInputMode && !N_MODE_PRIMARY_TOOL_IDS.includes(activeToolbox)) {
      setSaveFeedback('N-režiimis on paigutus ja taktimuudatused lukus. Kasuta SEL-režiimi.');
      setTimeout(() => setSaveFeedback(''), 2400);
      setActiveToolbox(null);
      setSelectedOptionIndex(0);
      return;
    }
    const toolbox = toolboxes[activeToolbox];
    if (!toolbox?.options) return;
    const optionIndex = clickedIndex !== undefined ? clickedIndex : selectedOptionIndex;
    const option = toolbox.options[optionIndex];
    if (!option) return;
    if (activeToolbox === 'instruments' && option.type === 'category') return;

    switch (activeToolbox) {
      case 'textBox': {
        // Tekstikasti tööriist peab jääma aktiivseks, et kasutaja saaks skooril klõpsates kasti paigutada.
        // (MuseScore-laadne UX: vali tööriist → klõpsa lehele → tekstiobjekt tekib.)
        setSelectedOptionIndex(optionIndex);
        return; // ära sulge toolbox'i
      }
      case 'rhythm': {
        const selected = getSelectedNotes();
        const hasSelection = selected.length > 0;
        const patternKeys = ['2/8', '2/8+2/8', '4/8', '4/16', '8/16', '1/8+2/16', '2/16+1/8', 'triplet-8', 'triplet-4'];
        if (typeof option.value === 'string' && option.value.startsWith('beam:')) {
          applyBeamOverrideAtCursorMeasure(option.value);
          setActiveToolbox(null);
          setSelectedOptionIndex(0);
          return;
        }
        if (patternKeys.includes(option.value)) {
          if (!noteInputMode) return; // Rütmipatterni sisestus ainult N-režiimis
          insertPatternAtCursor(option.value);
          setActiveToolbox(null);
          setSelectedOptionIndex(0);
          return;
        }
        if (option.value === 'rest') {
          if (hasSelection) {
            saveToHistory(notes);
            setNotes(notes.map((note, i) => {
              const inRange = selectionStart >= 0 && selectionEnd >= 0
                ? (i >= Math.min(selectionStart, selectionEnd) && i <= Math.max(selectionStart, selectionEnd))
                : (i === selectedNoteIndex);
              return inRange ? { ...note, isRest: !note.isRest } : note;
            }));
          } else setIsRest(prev => !prev);
        } else if (option.value === 'dotted') {
          if (hasSelection) {
            saveToHistory(notes);
            setNotes(notes.map((note, i) => {
              const inRange = selectionStart >= 0 && selectionEnd >= 0
                ? (i >= Math.min(selectionStart, selectionEnd) && i <= Math.max(selectionStart, selectionEnd))
                : (i === selectedNoteIndex);
              return inRange ? { ...note, isDotted: !note.isDotted, duration: (durations[note.durationLabel] || 1) * (note.isDotted ? 1 : 1.5) } : note;
            }));
          } else setIsDotted(prev => !prev);
        } else {
          // 1/1, 1/2, 1/4, 1/8, 1/16, 1/32
          lastDurationRef.current = option.value;
          setSelectedDuration(option.value);
          if (hasSelection) {
            const newDurationLabel = option.value;
            const baseDuration = durations[newDurationLabel];
            saveToHistory(notes);
            setNotes(notes.map((note, i) => {
              const inRange = selectionStart >= 0 && selectionEnd >= 0
                ? (i >= Math.min(selectionStart, selectionEnd) && i <= Math.max(selectionStart, selectionEnd))
                : (i === selectedNoteIndex);
              if (!inRange) return note;
              const dotted = note.isDotted;
              return { ...note, durationLabel: newDurationLabel, duration: dotted ? baseDuration * 1.5 : baseDuration, isDotted: dotted };
            }));
          }
        }
        break;
      }
      case 'pitchInput':
        if (noteInputMode && ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(option.value)) {
          if (notationStyle === 'FIGURENOTES') {
            addNoteAtCursor(option.value, ghostOctave);
          } else {
            const refM = ghostReferenceMidi(
              keySignature,
              notationStyle,
              ghostPitch,
              ghostOctave,
              ghostAccidental ?? 0,
              ghostAccidentalIsExplicit
            );
            const octN = resolveOctaveForPitchLetter(
              option.value,
              refM,
              keySignature,
              notationStyle,
              ghostAccidentalIsExplicit,
              ghostAccidental ?? 0
            );
            addNoteAtCursor(option.value, octN);
          }
        }
        break;
      case 'timeSignature':
        if (option.value === 'mode-toggle') {
          setTimeSignatureMode(prev => prev === 'classic' ? 'pedagogical' : 'classic');
        } else if (option.value === 'edit') {
          // Stay in toolbox for editing - don't close
          setTimeSignatureEditField('numerator');
          return; // Don't close toolbox
        } else if (Array.isArray(option.value)) {
          setTimeSignature({ beats: option.value[0], beatUnit: option.value[1] });
        }
        break;
      case 'clefs':
        if (option.value === 'jo') {
          setNotationMode('vabanotatsioon');
        } else {
          setNotationMode('traditional');
          setClefType(option.value);
        }
        break;
      case 'keySignatures': {
        setKeySignature(option.value);
        if (notationMode === 'vabanotatsioon') {
          const jp = getTonicStaffPosition(option.value);
          if (Number.isFinite(jp)) {
            setJoClefStaffPosition(Math.max(JO_CLEF_POSITION_MIN, Math.min(JO_CLEF_POSITION_MAX, jp)));
          }
        }
        break;
      }
      case 'transpose': {
        const targetKey = option.value;
        const fromSemi = KEY_TO_SEMITONE[keySignature] ?? getSemitonesFromKey(keySignature);
        const toSemi = KEY_TO_SEMITONE[targetKey] ?? getSemitonesFromKey(targetKey);
        let semitones = (toSemi - fromSemi) % 12;
        if (semitones < 0) semitones += 12;
        if (semitones !== 0) {
          saveToHistory(notes);
          setNotes(transposeNotes(notes, semitones));
          const preferFlats = FLAT_KEYS.has(targetKey);
          setChords((prev) => prev.map((c) => ({
            ...c,
            chord: transposeChordSymbolSemitones(c.chord, semitones, { preferFlats }),
          })));
          setKeySignature(targetKey);
          if (notationMode === 'vabanotatsioon') {
            const jp = getTonicStaffPosition(targetKey);
            if (Number.isFinite(jp)) {
              setJoClefStaffPosition(Math.max(JO_CLEF_POSITION_MIN, Math.min(JO_CLEF_POSITION_MAX, jp)));
            }
          }
        }
        break;
      }
      case 'notehead':
        if (String(option.value || '').startsWith('shape:')) {
          setNoteheadShape(option.value.slice(7));
        }
        break;
      case 'layout':
        if (option.id.startsWith('spacing-')) setPixelsPerBeat(option.value);
        break;
      case 'instruments': {
        if (option.type === 'category') break;
        setSelectedOptionIndex(optionIndex);
        const instId = option.type === 'option' ? option.value : option.value;
        addInstrumentToScore(instId);
        break;
      }
      case 'repeatsJumps': {
        if (option.type === 'category') break;
        // Apply repeat/jump mark (Leland SMuFL) to the measure containing the anchor beat.
        // UX: if user has selected a note (or a range), anchor to that selection; otherwise anchor to the cursor.
        const ms = measuresRef.current;
        if (ms && ms.length > 0) {
          const getMeasureIndexForBeat = (beat) => {
            const b = typeof beat === 'number' && Number.isFinite(beat) ? beat : 0;
            const i = ms.findIndex((m) => b >= m.startBeat && b < m.endBeat);
            if (i >= 0) return i;
            return Math.min(Math.max(0, Math.floor(b / measureLengthInQuarterBeats(timeSignature))), ms.length - 1);
          };

          const hasRangeSelection = selectionStart >= 0 && selectionEnd >= 0;
          const anchorNoteIndex = hasRangeSelection ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
          const anchorBeat = (anchorNoteIndex >= 0 && notes[anchorNoteIndex])
            ? getBeatAtNoteIndex(notes, anchorNoteIndex)
            : cursorPosition;

          const idx = getMeasureIndexForBeat(anchorBeat);
          setMeasureRepeatMarks((prev) => {
            const normalized = normalizeRepeatMarksMap(prev, ms.length);
            const { nextMap, issues } = applyRepeatMark(normalized, idx, option.value);
            if (issues.length > 0) {
              const first = issues[0];
              setSaveFeedback(first?.message || 'Kordusmärkide kombinatsioon vajab parandamist.');
              setTimeout(() => setSaveFeedback(''), 2800);
            }
            return nextMap;
          });
        }
        setActiveToolbox(null);
        setSelectedOptionIndex(0);
        break;
      }
      case 'chords':
        applyChordToolboxOptionAtIndex(optionIndex);
        return;
    }
    setActiveToolbox(null);
    setSelectedOptionIndex(0);
  };

  // Noot kursori all (rütmi järgi); meloodiareal = kursor lugemisel meloodiareal (mitte akordireal)
  const hasChordRow = notationStyle === 'FIGURENOTES' && figurenotesChordBlocks;
  const cursorOnMelodyRow = !hasChordRow || cursorSubRow === 0;
  /** N + figuurnoti akordirida: lülita tööriistaribal automaatselt akordid ↔ rütm (meloodia tagasi tulles ainult kui just lahkusid akordirealt). */
  const prevCursorSubRowForToolboxRef = useRef(cursorSubRow);
  useEffect(() => {
    const prev = prevCursorSubRowForToolboxRef.current;
    prevCursorSubRowForToolboxRef.current = cursorSubRow;
    if (!noteInputMode || !hasChordRow) return;
    if (cursorSubRow === 1) {
      setActiveToolbox('chords');
      return;
    }
    if (prev === 1 && cursorSubRow === 0) {
      setActiveToolbox((tb) => (tb === 'chords' ? 'rhythm' : tb));
    }
  }, [noteInputMode, hasChordRow, cursorSubRow]);
  const noteIndexAtCursor = useMemo(() => {
    const withBeats = notesWithExplicitBeats(notes);
    // Sort by beat so "read" follows timeline, not array order.
    const sorted = withBeats.map((n, i) => ({ n, i, beat: Number(n.beat) || 0, dur: Number(n.duration) || 1 }))
      .sort((a, b) => a.beat - b.beat);
    const candidates = sorted.filter(({ beat, dur }) => cursorPosition >= beat && cursorPosition < beat + dur);
    if (candidates.length === 0) return -1;
    if (candidates.length === 1) return candidates[0].i;
    let best = candidates[0];
    for (let k = 1; k < candidates.length; k++) {
      if (noteToMidi(candidates[k].n) > noteToMidi(best.n)) best = candidates[k];
    }
    return best.i;
  }, [notes, cursorPosition, notesWithExplicitBeats]);

  /** Noodi alguse löök antud indeksi järgi (SEL-režiimis kursori joondamine klõpsatud nootiga). */
  const getBeatAtNoteIndex = useCallback((noteList, index) => {
    if (index < 0 || index >= (noteList?.length ?? 0)) return 0;
    let beat = 0;
    for (let i = 0; i < noteList.length; i++) {
      const n = noteList[i];
      const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
      if (i === index) return noteBeat;
      beat = noteBeat + (n.duration ?? 1);
    }
    return beat;
  }, []);

  // Hoia meeles viimane noot, mille peal kursor oli (beat). Kasutatakse tekstirežiimis "tagasipõikamiseks", kui kursor kipub suvalisse kohta.
  useEffect(() => {
    if (noteIndexAtCursor < 0) return;
    lastCursorOnNoteBeatRef.current = getBeatAtNoteIndex(notes, noteIndexAtCursor);
  }, [noteIndexAtCursor, notes, getBeatAtNoteIndex]);

  // SEL-kursor ei tohi sundida noodi helesinist kasti "kursori ette":
  // valik jääb kasutaja juhituks (klikiga / vahemikuga), mitte automaatselt cursorPosition järgi.
  useEffect(() => {
    if (noteInputMode) return;
    if (cursorTool === 'select') return;
    // Tekstirežiimis (laulutekst) ja lauluteksti ahelas juhib fookust tekstikursor, mitte luger.
    if (cursorTool === 'type') return;
    if (isPedagogicalAudioPlaying || isExportingAnimation) return;
    // Lauluteksti ahelrežiimis (lyricChain) juhib fookust tekstikursor – ära kirjuta seda üle kursorPosition'i põhjal.
    if (lyricChainIndex !== null) return;
    // Akordireal ära kirjuta valikut üle – kasutaja töötab akordidega, mitte meloodia nootide valikuga.
    if (hasChordRow && cursorSubRow === 1) return;
    if (selectionStart >= 0 || selectionEnd >= 0) return; // range selection hoiab oma loogikat
    if (measureSelection != null) return; // taktivalik (Shift+nooled) — ära kirjuta üle
    if (noteIndexAtCursor < 0) return;
    // Kui kursor on samal beat'il, kus kasutaja juba valis konkreetse noodi (nt akord: mitu nooti sama beat'i peal),
    // siis ära kirjuta valikut "ülemise noodi" peale tagasi – muidu noolega liikumine võib näida kinni jooksvat.
    if (selectedNoteIndex >= 0 && selectedNoteIndex < notes.length) {
      const EPS = 1e-6;
      const selectedBeat = getBeatAtNoteIndex(notes, selectedNoteIndex);
      if (Math.abs((cursorPosition ?? 0) - (selectedBeat ?? 0)) < EPS) return;
    }
    if (selectedNoteIndex === noteIndexAtCursor) return;
    setSelectedNoteIndex(noteIndexAtCursor);
  }, [noteInputMode, cursorTool, isPedagogicalAudioPlaying, isExportingAnimation, lyricChainIndex, hasChordRow, cursorSubRow, selectionStart, selectionEnd, measureSelection, noteIndexAtCursor, selectedNoteIndex, notes, cursorPosition, getBeatAtNoteIndex]);

  /** Noot antud löögil (akordi puhul kõrgeim noteToMidi järgi). Kasutatakse mängimiseks pärast kursori liigutamist. */
  const getNoteAtBeat = useCallback((beat) => {
    const withBeats = notesWithExplicitBeats(notes);
    const sorted = withBeats.map((n, i) => ({ n, i, beat: Number(n.beat) || 0, dur: Number(n.duration) || 1 }))
      .sort((a, b) => a.beat - b.beat);
    const candidates = sorted.filter(({ beat: nb, dur }) => beat >= nb && beat < nb + dur);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].n;
    let best = candidates[0];
    for (let k = 1; k < candidates.length; k++) {
      if (noteToMidi(candidates[k].n) > noteToMidi(best.n)) best = candidates[k];
    }
    return best.n;
  }, [notes, notesWithExplicitBeats]);

  /** Mängib nooti antud löögil, kui seal on noot ja playNoteOnInsert on sisse lülitatud. N- ja SEL-režiim: kursor esitab õige helikõrgust. */
  const playNoteAtBeatIfEnabled = useCallback((beat) => {
    if (!playNoteOnInsert) return;
    const note = getNoteAtBeat(beat);
    if (note && !note.isRest) {
      const bpm = getEffectivePlaybackBpm();
      const beatMs = 60000 / bpm;
      const accPlay = (note.accidental !== undefined && note.accidental !== null)
        ? note.accidental
        : getAccidentalForPitchInKey(note.pitch, keySignature);
      playPianoNote(note.pitch, note.octave ?? 4, accPlay, {
        durationMs: noteDurationInQuarterBeats(note) * beatMs,
        cutPrevious: true,
      });
    }
  }, [playNoteOnInsert, getNoteAtBeat, playPianoNote, getEffectivePlaybackBpm, noteDurationInQuarterBeats, keySignature]);

  // Laulutekst: ära luba kursoril jääda nootide vahele – põrka tagasi viimasele kehtivale noodi beat'ile.
  // NB! N-režiimis peab kursor saama liikuda ka tühjale kohale (noodi sisestus), seega seda kaitset seal ei rakenda.
  useEffect(() => {
    if (isPedagogicalAudioPlaying || isExportingAnimation) return;
    if (!cursorOnMelodyRow) return;
    const inTextMode = cursorTool === 'type' || lyricChainIndex !== null;
    if (!inTextMode) return;
    if (noteIndexAtCursor >= 0) return; // kursor on noodil – kõik korras
    const safeBeat = lastCursorOnNoteBeatRef.current;
    if (!Number.isFinite(safeBeat)) return;
    if (cursorPosition === safeBeat) return;
    setCursorPosition(safeBeat);
  }, [cursorPosition, cursorTool, lyricChainIndex, noteIndexAtCursor, cursorOnMelodyRow, isPedagogicalAudioPlaying, isExportingAnimation, setCursorPosition]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      const modKey = e.metaKey || e.ctrlKey;
      const isDeleteKey = e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Backspace' || e.code === 'Delete';

      // If user is typing in an input/textarea/contenteditable, do NOT globally swallow keystrokes.
      // Otherwise title/author/text fields can appear "disabled", especially if noteInputMode is on.
      const active = document.activeElement;
      const tag = (active?.tagName || '').toLowerCase();
      const isContentEditableNode = !!(
        active?.isContentEditable
        || active?.closest?.('[contenteditable]:not([contenteditable="false"])')
      );
      const isTypingInInput = tag === 'input' || tag === 'textarea' || isContentEditableNode;

      // Stage 1: preflight guards (modal, playback, mode swallowing)
      if (isInstrumentManagerOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setIsInstrumentManagerOpen(false);
          setCopyInstrumentConfirm(null);
        }
        return;
      }
      if (isScorePlaybackPlaying && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.code)) {
        stopScorePlayback(false);
      }

      if (e.code === 'Tab') {
        if (noteInputMode && !isTypingInInput) tabStaffCycleHeldRef.current = true;
        else tabStaffCycleHeldRef.current = false;
      }

      // SEL-mode: brauseri ja süsteemiga seotud võtmed on avatud (kasutaja saab vajadusel teha brauseri/süsteemi toimetusi).
      // N-mode: kursor loeb ainult noodi / laulusõnade / akordi ridu; kõik klahvid blokeeritakse – keskendutakse noodi sisestusele, parandamisele, kustutamisele.
      if (noteInputMode) {
        // But allow normal typing when focus is in a text field.
        if (!isTypingInInput) {
          e.preventDefault();
          e.stopPropagation();
        }
      }

      // Stage 2: shared edit command helpers (selection/cursor delete/replace)
      // Ära püüa klahve, kui kasutaja kirjutab input/textarea väljale (nt pealkiri, autor) – v.a. Ctrl+L laulusõna väljal
      // Abistaja: noodi indeks antud löögil (vajalik, kui kasutaja klõpsas just löögil ja React ei ole veel cursorPosition uuendanud)
      const getNoteIndexForBeat = (beat) => {
        let b = 0;
        const candidates = [];
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          const noteBeat = typeof n.beat === 'number' ? n.beat : b;
          if (beat >= noteBeat && beat < noteBeat + n.duration) candidates.push({ index: i, note: n });
          b = noteBeat + n.duration;
        }
        if (candidates.length === 0) return -1;
        if (candidates.length === 1) return candidates[0].index;
        let best = candidates[0];
        for (let k = 1; k < candidates.length; k++) { if (noteToMidi(candidates[k].note) > noteToMidi(best.note)) best = candidates[k]; }
        return best.index;
      };
      const applyLyricChainAt = (index, beatForCursor = null) => {
        if (index < 0) return;
        if (beatForCursor != null) {
          setCursorPosition(beatForCursor);
          setCursorSubRow(0);
        }
        setSelectedNoteIndex(index);
        setLyricChainStart(index);
        setLyricChainEnd(index);
        setLyricChainIndex(index);
        setTimeout(() => lyricInputRef.current?.focus(), 0);
      };
      // Ctrl+L (Cmd+L): SEL-režiimis püüa ainult siis, kui käivitame laulusõna (meloodiareal, noot kursori all); muul juhul lastakse brauserile (aadressiriba jms)
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.lyricModeMod'])) {
        const recent = lastBeatClickForLyricRef.current;
        const useClickBeat = recent.beat != null && (Date.now() - recent.at) < 600;
        if (useClickBeat) {
          const idx = getNoteIndexForBeat(recent.beat);
          lastBeatClickForLyricRef.current = { beat: null, at: 0 };
          if (idx >= 0) {
            e.preventDefault();
            applyLyricChainAt(idx, recent.beat);
            return;
          }
        }
        if (cursorOnMelodyRow && noteIndexAtCursor >= 0) {
          e.preventDefault();
          applyLyricChainAt(noteIndexAtCursor);
        }
        return;
      }
      // L (ilma modifikaatorita): laulusõna kursori asukohast, kui kursor meloodiareal ja ei kirjuta teises väljas
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.lyricMode']) && !isTypingInInput && cursorOnMelodyRow) {
        const recent = lastBeatClickForLyricRef.current;
        const useClickBeat = recent.beat != null && (Date.now() - recent.at) < 600;
        if (useClickBeat) {
          const idx = getNoteIndexForBeat(recent.beat);
          lastBeatClickForLyricRef.current = { beat: null, at: 0 };
          if (idx >= 0) {
            e.preventDefault();
            applyLyricChainAt(idx, recent.beat);
            return;
          }
        }
        if (noteIndexAtCursor >= 0) {
          e.preventDefault();
          applyLyricChainAt(noteIndexAtCursor);
          return;
        }
      }
      // Undo (Cmd/Ctrl+Z) – tööta ka siis, kui fookus on inputis (nt laulusõna), et notatsiooni saaks tagasi võtta
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.undo'])) {
        e.preventDefault();
        undo();
        return;
      }
      // Cmd/Ctrl+B – lisa takt (luba ka siis, kui fookus on pealkirja/autoriväljal)
      // Muidu jääb mulje, et funktsioon on "välja lülitatud", kui input on kogemata fookuses.
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.addMeasure'])) {
        e.preventDefault();
        addMeasure();
        return;
      }
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.addSongBlock'])) {
        e.preventDefault();
        addSongBlock();
        return;
      }
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.deleteMeasure'])) {
        e.preventDefault();
        deleteMeasuresRangeRef.current();
        return;
      }
      if (isTypingInInput) return;
      if (shortcutsOpen) return;

      // Cmd/Ctrl+S – save: to cloud (Google Drive / OneDrive) when logged in with that provider, otherwise to browser
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.save'])) {
        e.preventDefault();
        handleSaveShortcut();
        return;
      }

      // Cmd/Ctrl+P – open print dialog (notation sheet only, per @media print)
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.print'])) {
        e.preventDefault();
        handlePrint();
        return;
      }

      // Cmd/Ctrl+ / Cmd/Ctrl- – zoom noodiala (ainult noodistus, mitte tööriistad)
      const isZoomInShortcut = matchesShortcutPref(e, effectiveShortcutPrefs['app.zoomIn']) || (matchesShortcutPref(e, { ...effectiveShortcutPrefs['app.zoomIn'], shift: true }) && (e.key === '+' || e.key === '='));
      const isZoomOutShortcut = matchesShortcutPref(e, effectiveShortcutPrefs['app.zoomOut']) || (e.key === '-' && !!(e.ctrlKey || e.metaKey));
      if (isZoomInShortcut || isZoomOutShortcut) {
        e.preventDefault();
        setScoreZoomLevel((prev) => {
          const step = 0.15;
          if (isZoomOutShortcut) return Math.max(SCORE_ZOOM_MIN, Math.round((prev - step) * 100) / 100);
          return Math.min(SCORE_ZOOM_MAX, Math.round((prev + step) * 100) / 100);
        });
        return;
      }

      // Shared helper: apply transform to selected note(s) and save history
      const applyToSelectedNotes = (transform) => {
        const newNotes = [...notes];
        const mergeAt = (i) => {
          const patch = transform(newNotes[i]);
          const merged = { ...newNotes[i], ...patch };
          if (Object.prototype.hasOwnProperty.call(patch, 'accidental') && patch.accidental === undefined) {
            delete merged.accidental;
          }
          newNotes[i] = merged;
        };
        if (selectionStart >= 0 && selectionEnd >= 0) {
          const start = Math.min(selectionStart, selectionEnd);
          const end = Math.max(selectionStart, selectionEnd);
          for (let i = start; i <= end; i++) {
            mergeAt(i);
          }
        } else if (selectedNoteIndex >= 0) {
          mergeAt(selectedNoteIndex);
        }
        saveToHistory(notes);
        setNotes(newNotes);
      };

      // Index of the note that spans the current cursor position. When multiple notes share the same beat (chord),
      // return the UPPER note (highest pitch) so that Arrow Up/Down and Backspace target the top note first.
      const getNoteIndexAtCursor = () => {
        let beat = 0;
        const candidates = [];
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
          if (cursorPosition >= noteBeat && cursorPosition < noteBeat + n.duration) {
            candidates.push({ index: i, note: n, noteBeat });
          }
          beat = noteBeat + n.duration;
        }
        if (candidates.length === 0) return -1;
        if (candidates.length === 1) return candidates[0].index;
        let best = candidates[0];
        for (let k = 1; k < candidates.length; k++) {
          if (noteToMidi(candidates[k].note) > noteToMidi(best.note)) best = candidates[k];
        }
        return best.index;
      };

      const replaceSelectedNotesWithRests = ({ cursorBeat = null, clearSelection = true } = {}) => {
        if (!(selectedNoteIndex >= 0 || (selectionStart >= 0 && selectionEnd >= 0))) return false;
        if (cursorBeat != null && (!Number.isFinite(cursorBeat) || cursorBeat < 0)) {
          throwCursorModelError('DELETE_CURSOR_BEAT_INVALID', 'Selection delete cursorBeat must be finite and non-negative.', {
            source: 'replaceSelectedNotesWithRests',
            cursorBeat,
          });
        }
        const replacedIndices = [];
        const nextNotes = notes.map((note, i) => {
          const inRange = selectionStart >= 0 && selectionEnd >= 0
            ? (i >= Math.min(selectionStart, selectionEnd) && i <= Math.max(selectionStart, selectionEnd))
            : (i === selectedNoteIndex);
          if (!inRange) return note;
          replacedIndices.push(i);
          return {
            id: Date.now() + i,
            pitch: 'C',
            octave: 4,
            duration: note.duration,
            durationLabel: note.durationLabel,
            isDotted: note.isDotted,
            isRest: true,
            beat: typeof note.beat === 'number' ? note.beat : undefined,
            lyric: '',
          };
        });
        assertDeleteReplacementInvariant('replaceSelectedNotesWithRests', notes, nextNotes, replacedIndices);
        saveToHistory(notes);
        setNotes(nextNotes);
        if (typeof cursorBeat === 'number' && Number.isFinite(cursorBeat)) {
          setCursorPosition(Math.max(0, cursorBeat));
        }
        if (clearSelection) {
          applySelectionModel(CURSOR_SELECTION_NONE);
        }
        return true;
      };

      // Teksti kast valitud: Delete/Backspace kustutab kasti
      // Stage 3: global shortcut/domain commands that preempt notation commands.
      if (selectedTextboxId && isDeleteKey) {
        e.preventDefault();
        setTextBoxes(prev => prev.filter(b => b.id !== selectedTextboxId));
        setSelectedTextboxId(null);
        dirtyRef.current = true;
        return;
      }
      if (e.key === 'Escape') setSelectedTextboxId(null);

      // Cmd/Ctrl+↑ = kursor meloodiareale (või eelmine partii); Cmd/Ctrl+↓ = kursor akordireale (või järgmine partii). Kehtib nii N- kui SEL-režiimis.
      if (!noteInputMode && (matchesShortcutPref(e, effectiveShortcutPrefs['app.cursorRowUpDownMod']) || matchesShortcutPref(e, effectiveShortcutPrefs['app.cursorRowDownMod'])) && !e.shiftKey && !e.altKey) {
        const hasChordRow = notationStyle === 'FIGURENOTES' && figurenotesChordBlocks;
        if (e.code === 'ArrowUp') {
          if (hasChordRow && cursorSubRow === 1) {
            e.preventDefault();
            setCursorSubRow(0);
          } else if (activeStaffIndex > 0) {
            e.preventDefault();
            setActiveStaffIndex(activeStaffIndex - 1);
            setCursorSubRow(0);
          }
          return;
        }
        if (e.code === 'ArrowDown') {
          if (hasChordRow && cursorSubRow === 0) {
            e.preventDefault();
            setCursorSubRow(1);
          } else if (activeStaffIndex < staves.length - 1) {
            e.preventDefault();
            setActiveStaffIndex(activeStaffIndex + 1);
            setCursorSubRow(0);
          }
          return;
        }
      }
      // Tab+↑↓ (N-režiim): vaheta aktiivset sisestusrida/instrumentatsiooni rida
      // (Tab hoos; vabastatakse keyup/blur). Vanem salvestatud Alt+nool säilib, kui eelistuses tab: false.
      const staffCycleTabCtx = { tabHeld: tabStaffCycleHeldRef.current };
      if (noteInputMode && (matchesShortcutPref(e, effectiveShortcutPrefs['app.staffCycleUpAlt'], staffCycleTabCtx) || matchesShortcutPref(e, effectiveShortcutPrefs['app.staffCycleDownAlt'], staffCycleTabCtx)) && !e.shiftKey) {
        const hasChordRow = notationStyle === 'FIGURENOTES' && figurenotesChordBlocks;
        if (e.code === 'ArrowUp') {
          let moved = false;
          if (hasChordRow && cursorSubRow === 1) {
            e.preventDefault();
            setCursorSubRow(0);
            moved = true;
          } else if (activeStaffIndex > 0) {
            e.preventDefault();
            setActiveStaffIndex(activeStaffIndex - 1);
            setCursorSubRow(0);
            moved = true;
          }
          if (moved) return;
        }
        if (e.code === 'ArrowDown') {
          let moved = false;
          if (hasChordRow && cursorSubRow === 0) {
            e.preventDefault();
            setCursorSubRow(1);
            moved = true;
          } else if (activeStaffIndex < staves.length - 1) {
            e.preventDefault();
            setActiveStaffIndex(activeStaffIndex + 1);
            setCursorSubRow(0);
            moved = true;
          }
          if (moved) return;
        }
      }

      // Global accidentals: Alt+↑/↓ step chromatic alteration (effective = explicit or key). Toward natural from flats up / sharps down;
      // from natural, up adds # and down adds ♭ (mirror for opposite sides). After step, strip accidental when result matches key; else set explicit (0 = ♮ vs key).
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        const up = e.code === 'ArrowUp';
        const stepEff = (eff) => {
          if (up) {
            if (eff < 0) return eff + 1;
            if (eff === 0) return 1;
            return eff;
          }
          if (eff > 0) return eff - 1;
          if (eff === 0) return -1;
          return eff;
        };
        const playSemi = (eff) => (eff === 1 ? 1 : eff === -1 ? -1 : 0);
        const mapNote = (n) => {
          if (n.isRest) return n;
          const k = getAccidentalForPitchInKey(n.pitch, keySignature);
          const eff = n.accidental !== undefined && n.accidental !== null ? n.accidental : k;
          const newEff = stepEff(eff);
          if (newEff === k) {
            const { accidental: _drop, ...rest } = n;
            return { ...rest, accidental: undefined };
          }
          return { ...n, accidental: newEff };
        };
        const mapSingleNoteForState = (n) => {
          const m = mapNote(n);
          if (m.isRest || m.accidental !== undefined) return m;
          const { accidental: _d, ...clean } = m;
          return clean;
        };
        const hasSelection = selectedNoteIndex >= 0 || (selectionStart >= 0 && selectionEnd >= 0);
        const noteIdxAtCursor = getNoteIndexAtCursor();
        if (hasSelection) {
          applyToSelectedNotes(mapNote);
          const idx = selectedNoteIndex >= 0 ? selectedNoteIndex : Math.min(selectionStart, selectionEnd);
          const note = notes[idx];
          if (note && !note.isRest && playNoteOnInsert) {
            const k = getAccidentalForPitchInKey(note.pitch, keySignature);
            const eff = note.accidental !== undefined && note.accidental !== null ? note.accidental : k;
            playPianoNote(note.pitch, note.octave, playSemi(stepEff(eff)));
          }
        } else if (noteIdxAtCursor >= 0 && noteIdxAtCursor < notes.length) {
          const note = notes[noteIdxAtCursor];
          if (!note.isRest) {
            saveToHistory(notes);
            setNotes((prev) => prev.map((n, i) => (i !== noteIdxAtCursor ? n : mapSingleNoteForState(n))));
            const k = getAccidentalForPitchInKey(note.pitch, keySignature);
            const eff = note.accidental !== undefined && note.accidental !== null ? note.accidental : k;
            if (playNoteOnInsert) playPianoNote(note.pitch, note.octave, playSemi(stepEff(eff)));
          } else {
            const gk = getAccidentalForPitchInKey(ghostPitch, keySignature);
            const geff = ghostAccidentalIsExplicit ? ghostAccidental : gk;
            const gNew = stepEff(geff);
            if (gNew === gk) {
              setGhostAccidentalIsExplicit(false);
              setGhostAccidental(0);
            } else {
              setGhostAccidentalIsExplicit(true);
              setGhostAccidental(gNew);
            }
            if (playNoteOnInsert) playPianoNote(ghostPitch, ghostOctave, playSemi(gNew));
          }
        } else {
          const gk = getAccidentalForPitchInKey(ghostPitch, keySignature);
          const geff = ghostAccidentalIsExplicit ? ghostAccidental : gk;
          const gNew = stepEff(geff);
          if (gNew === gk) {
            setGhostAccidentalIsExplicit(false);
            setGhostAccidental(0);
          } else {
            setGhostAccidentalIsExplicit(true);
            setGhostAccidental(gNew);
          }
          if (playNoteOnInsert) playPianoNote(ghostPitch, ghostOctave, playSemi(gNew));
        }
        return;
      }

      // JO-võti valitud: nooltega ↑↓ võtme nihutamine; noodid transponeeritakse sünkroonis kõigil joonestikel (sh Grand Staff)
      if (joClefFocused) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setJoClefFocused(false);
          return;
        }
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          e.preventDefault();
          const step = e.code === 'ArrowUp' ? 1 : -1;
          const nextPos = Math.max(JO_CLEF_POSITION_MIN, Math.min(JO_CLEF_POSITION_MAX, joClefStaffPosition + step));
          const newKey = getKeyFromStaffPosition(nextPos, keySignature);
          if (newKey !== keySignature) {
            const semitones = (KEY_TO_SEMITONE[newKey] ?? getSemitonesFromKey(newKey)) - (KEY_TO_SEMITONE[keySignature] ?? getSemitonesFromKey(keySignature));
            if (semitones !== 0) {
              saveToHistory(notes);
              setStaves((prev) => prev.map((staff) => ({ ...staff, notes: transposeNotes(staff.notes || [], semitones) })));
              const preferFlats = FLAT_KEYS.has(newKey);
              setChords((prev) => prev.map((c) => ({
                ...c,
                chord: transposeChordSymbolSemitones(c.chord, semitones, { preferFlats }),
              })));
            }
            setKeySignature(newKey);
          }
          setJoClefStaffPosition(nextPos);
          dirtyRef.current = true;
          return;
        }
      }

      // Mouse-based insert draft active: allow octave + duration tweaks and cancel.
      const mouseDraft = mouseInsertDraftRef.current;
      if (mouseDraft && mouseDraft.startBeat != null) {
        // Escape: cancel draft (put the note back down without inserting).
        if (e.code === 'Escape') {
          e.preventDefault();
          setMouseInsertDraft(null);
          return;
        }
        // ArrowUp/ArrowDown: change octave while keeping pitch class.
        if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !e.shiftKey && !modKey) {
          e.preventDefault();
          const delta = e.code === 'ArrowUp' ? 1 : -1;
          const nextOct = Math.max(0, Math.min(8, (mouseDraft.octave ?? ghostOctave ?? 4) + delta));
          setMouseInsertDraft(prev => (prev && prev.startBeat != null ? { ...prev, octave: nextOct } : prev));
          setGhostOctave(nextOct);
          return;
        }
        // Shift+Digit1..Digit5: set duration for the draft note (and sync selectedDuration).
        if (e.shiftKey && !modKey && /^Digit[1-5]$/.test(e.code)) {
          e.preventDefault();
          const map = {
            Digit1: '1/1',
            Digit2: '1/2',
            Digit3: '1/4',
            Digit4: '1/8',
            Digit5: '1/16'
          };
          const durLabel = map[e.code] || '1/4';
          setMouseInsertDraft(prev => (prev && prev.startBeat != null ? { ...prev, durationLabel: durLabel } : prev));
          setSelectedDuration(durLabel);
          return;
        }
        // While a draft is active, let the rest of handler continue (N-mode cursor etc),
        // but mouse click is what finally "drops" the note (handled in onFigureBeatClick).
      }

      // Stage V: Copy (Ctrl+C) – always allowed in selection mode; in Figurenotes view
      // also allow copying while N-mode is ON so users can select & duplicate patterns.
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.copy']) && (!noteInputMode || notationStyle === 'FIGURENOTES')) {
        e.preventDefault();
        copySelectionToClipboard();
        return;
      }

      // Clipboard history palette: Cmd/Ctrl+Shift+V – toggle history panel
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.clipboardHistory'])) {
        e.preventDefault();
        setClipboardHistoryOpen((prev) => !prev);
        return;
      }

      // Stage V: Paste (Ctrl+V)
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.paste']) && clipboard.length > 0) {
        e.preventDefault();
        const insertIndex = noteInputMode ? notes.length : selectedNoteIndex + 1;
        const pastedNotes = clipboard.map(note => ({
          ...note,
          id: Date.now() + Math.random()
        }));
        const clipboardDuration = pastedNotes.reduce((sum, note) => sum + (Number(note.duration) || 1), 0);
        const insertBeat = notes.slice(0, insertIndex).reduce((s, n) => s + (Number(n.duration) || 1), 0);
        const measureQuarters = measureLengthInQuarterBeats(timeSignature);
        let firstMeasureBeats = measureQuarters;
        if (pickupEnabled && pickupQuantity > 0 && pickupDuration) {
          const onePickupQuarters = durationLabelToQuarterNoteUnits(pickupDuration);
          firstMeasureBeats = Math.max(0.25, Math.min(pickupQuantity * onePickupQuarters, measureQuarters - 0.25));
        }
        const totalMeasures = Math.max(1, 1 + (addedMeasures || 0));
        const endBeat = firstMeasureBeats + (totalMeasures - 1) * measureQuarters;
        const availableBeats = Math.max(0, endBeat - insertBeat);
        const needExtraBeats = Math.max(0, clipboardDuration - availableBeats);
        const measuresToAdd = hasFullAccess && needExtraBeats > 0
          ? Math.ceil(needExtraBeats / measureQuarters)
          : 0;
        if (measuresToAdd > 0) setAddedMeasures((prev) => prev + measuresToAdd);
        const newNotes = [...notes];
        newNotes.splice(insertIndex, 0, ...pastedNotes);
        saveToHistory(notes);
        setNotes(newNotes);
        if (noteInputMode) {
          const totalDuration = pastedNotes.reduce((sum, note) => sum + note.duration, 0);
          setCursorPosition(prev => prev + totalDuration);
        }
        return;
      }

      // Cmd+B / Ctrl+B – handled earlier (works even when input has focus)

      // Alt+[ / Alt+{ – vähenda valitud takti laiust (kokkusurumine); Alt+] / Alt+} – suurenda (laiendamine)
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.measureStretchDown']) || matchesShortcutPref(e, effectiveShortcutPrefs['app.measureStretchUp'])) {
        const ms = measuresRef.current;
        if (ms && ms.length > 0) {
          const measureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          const idx = measureIndex >= 0 ? measureIndex : Math.min(cursorPosition > 0 ? Math.floor(cursorPosition / measureLengthInQuarterBeats(timeSignature)) : 0, ms.length - 1);
          const delta = e.code === 'BracketLeft' ? -0.1 : 0.1;
          e.preventDefault();
          dirtyRef.current = true;
          setMeasureStretchFactors((prev) => {
            const next = [...(prev || [])];
            while (next.length <= idx) next.push(1);
            next[idx] = Math.max(0.25, Math.min(4, (next[idx] ?? 1) + delta));
            return next;
          });
        }
        return;
      }

      // Cmd/Ctrl+3,5,6,7 – triool, kvintool, sekstool, septool (rütmivältuse sisse). Töötab alati (ilma rütmipaleti avamiseta).
      if (modKey && !e.shiftKey) {
        const tupletMap = { 'Digit3': { type: 3, inSpaceOf: 2 }, 'Digit5': { type: 5, inSpaceOf: 4 }, 'Digit6': { type: 6, inSpaceOf: 4 }, 'Digit7': { type: 7, inSpaceOf: 4 } };
        if (tupletMap[e.code]) {
          e.preventDefault();
          const next = tupletMap[e.code];
          setTupletMode(prev => (prev && prev.type === next.type ? null : next));
          return;
        }
      }

      // N key toggles note input mode. When entering N mode, keep rhythm+pitch workflow visible.
      if (matchesShortcutPref(e, effectiveShortcutPrefs['app.noteInputToggle'])) {
        e.preventDefault();
        setNoteInputMode(prev => {
          if (prev) {
            suppressSelEditUntilRef.current = Date.now() + 220;
            restNextRef.current = false;
            setSelectedNoteIndex(-1);
            setSelectionStart(-1);
            setSelectionEnd(-1);
            setMeasureSelection(null);
            setPianoStripVisible(false);
            setActiveToolbox(null);
          } else {
            setSelectedNoteIndex(-1);
            setSelectionStart(-1);
            setSelectionEnd(-1);
            setMeasureSelection(null);
            setActiveToolbox('rhythm');
            if (notationStyle === 'TRADITIONAL' || notationMode === 'vabanotatsioon') {
              setPianoStripVisible(true);
            }
            // Noodisisestuse alguspunkt on alati 1. takt, 1. löök.
            // Hoidke ghost kõrgus vaikimisi C4, et käivitumine oleks deterministlik
            // ega sõltuks varasemast valikust/noodiajaloost.
            setGhostPitch('C');
            setGhostOctave(4);
            setCursorPosition(0);
          }
          return !prev;
        });
        return;
      }

      // N-mode Backspace/Delete: kui kursor asub taktis akordireal, võimaldame Backspace/Delete kustutada selle akordi; muul juhul noot või (ainult Backspace) tühi takt / taktikordus
      if (noteInputMode && (e.key === 'Backspace' || e.code === 'Backspace' || e.key === 'Delete' || e.code === 'Delete')) {
        e.preventDefault();
        if (hasChordRow && cursorSubRow === 1) {
          const chordAtCursor = getChordAtCursor();
          if (chordAtCursor) {
            setChords((prev) => prev.filter((c) => c.id !== chordAtCursor.id));
            dirtyRef.current = true;
          }
          return;
        }
        const hasSelectedNotes = selectedNoteIndex >= 0 || (selectionStart >= 0 && selectionEnd >= 0);
        if (hasSelectedNotes) {
          const selStart = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
          let beatAtSelectionStart = 0;
          if (selStart >= 0 && notes[selStart]) {
            let beatProbe = 0;
            for (let i = 0; i <= selStart && i < notes.length; i++) {
              const n = notes[i];
              const noteBeat = typeof n.beat === 'number' ? n.beat : beatProbe;
              if (i === selStart) {
                beatAtSelectionStart = noteBeat;
                break;
              }
              beatProbe = noteBeat + n.duration;
            }
          }
          if (replaceSelectedNotesWithRests({ cursorBeat: beatAtSelectionStart, clearSelection: true })) return;
        }
        const indexAtCursor = getNoteIndexAtCursor();
        if (indexAtCursor >= 0 && notes.length > 0) {
          let beat = 0;
          let deletedNoteBeat = 0;
          for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
            if (i === indexAtCursor) {
              deletedNoteBeat = noteBeat;
              break;
            }
            beat = noteBeat + n.duration;
          }
          const newCursor = deletedNoteBeat;
          const deleted = notes[indexAtCursor];
          assertCursorTimeModelInputs(
            'deleteAtCursorToRest',
            deletedNoteBeat,
            deleted?.durationLabel || '1/4',
            Number(deleted?.duration) || 0
          );
          saveToHistory(notes);
          setNotes((prev) => prev.map((n, i) => {
            if (i !== indexAtCursor) return n;
            return {
              id: Date.now() + i,
              pitch: 'C',
              octave: 4,
              duration: n.duration,
              durationLabel: n.durationLabel,
              isDotted: n.isDotted,
              isRest: true,
              beat: typeof n.beat === 'number' ? n.beat : deletedNoteBeat,
              lyric: ''
            };
          }));
          setCursorPosition(newCursor);
          setSelectionStart(-1);
          setSelectionEnd(-1);
          setSelectedNoteIndex(-1);
          const remaining = notes.map((n, i) => (i === indexAtCursor ? { ...n, isRest: true } : n));
          if (remaining.length > 0) {
            beat = 0;
            const atCursor = [];
            for (let i = 0; i < remaining.length; i++) {
              const n = remaining[i];
              const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
              if (newCursor >= noteBeat && newCursor < noteBeat + n.duration) atCursor.push(n);
              beat = noteBeat + n.duration;
            }
            const prevNote = atCursor.length === 0 ? null : atCursor.length === 1 ? atCursor[0] : atCursor.reduce((a, b) => (noteToMidi(a) >= noteToMidi(b) ? a : b));
            if (prevNote) {
              setGhostPitch(prevNote.pitch);
              setGhostOctave(prevNote.octave);
            }
          }
          return;
        }
        const chordAtCursor = getChordAtCursor();
        if (chordAtCursor) {
          setChords((prev) => prev.filter((c) => c.id !== chordAtCursor.id));
          dirtyRef.current = true;
          return;
        }
        const isBackspace = e.key === 'Backspace' || e.code === 'Backspace';
        const ms = measuresRef.current;
        let removedExcessBar = false;
        if (isBackspace && ms && ms.length > 1) {
          const EPSm = 1e-6;
          let cursorMeasureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          // Kursor võib olla täpselt viimase takti lõpul (endBeat); findIndex jääb siis -1
          if (cursorMeasureIndex < 0 && ms.length > 0) {
            const lastM = ms[ms.length - 1];
            if (cursorPosition >= lastM.startBeat - EPSm && cursorPosition <= lastM.endBeat + EPSm) {
              cursorMeasureIndex = ms.length - 1;
            }
          }
          if (cursorMeasureIndex >= 1) {
            const m = ms[cursorMeasureIndex];
            const { nextStaves, removedAny } = removeRestsFullyContainedInMeasureAllStaves(staves, m);
            if (!measureHasOverlapAnyStaff(nextStaves, m)) {
              saveToHistory(notes);
              if (removedAny) {
                setStaves(nextStaves);
                dirtyRef.current = true;
              }
              const neededAfter = computeMinMeasuresFromStaves(nextStaves, timeSignature, pickupEnabled, pickupQuantity, pickupDuration);
              setAddedMeasures((prev) => {
                const dec = Math.max(0, (prev || 0) - 1);
                return Math.max(dec, Math.max(0, neededAfter - 1));
              });
              const prev = ms[cursorMeasureIndex - 1];
              const oneBeat = oneMetricalBeatInQuarterBeats(timeSignature);
              setCursorPosition(Math.max(prev.startBeat, prev.endBeat - oneBeat));
              removedExcessBar = true;
            }
          }
        }
        if (isBackspace && !removedExcessBar && ms && ms.length > 0) {
          const cursorMeasureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          if (cursorMeasureIndex >= 0 && measureRepeatMarks[cursorMeasureIndex] && Object.keys(measureRepeatMarks[cursorMeasureIndex]).length > 0) {
            setMeasureRepeatMarks((prev) => removeRepeatMark(prev, cursorMeasureIndex));
          }
        }
        return;
      }

      // SEL-režiimis Backspace/Delete: valitud noot/noodid asendatakse sama kestusega pausidega.
      if (!noteInputMode && (e.code === 'Backspace' || e.key === 'Backspace' || e.code === 'Delete') && selectedNoteIndex >= 0) {
        e.preventDefault();
        replaceSelectedNotesWithRests({ clearSelection: true });
        setActiveToolbox(null);
        return;
      }

      // When a note is selected: Arrow Up/Down and duration/letter keys always edit it (even with toolbox open or note input on)
      if (selectedNoteIndex >= 0 && selectedNoteIndex < notes.length && !(!noteInputMode && Date.now() < suppressSelEditUntilRef.current)) {
        const durationMapSel = { 'Digit7': '1/1', 'Digit6': '1/2', 'Digit5': '1/4', 'Digit4': '1/8', 'Digit3': '1/16', 'Digit2': '1/32' };
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          e.preventDefault();
          const dir = e.code === 'ArrowUp' ? 1 : -1;
          const step = e.code === 'ArrowUp' ? 1 : -1;
          const firstIdx = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
          const firstNote = notes[firstIdx];
          // Arrow Up/Down = one note up/down (pitch class in key, same octave). Shift+Arrow = octave change.
          if (e.shiftKey || modKey) {
            applyToSelectedNotes(n => ({ octave: shiftOctave(n.octave, dir) }));
            if (firstNote && !firstNote.isRest && playNoteOnInsert) {
              playPianoNote(firstNote.pitch, shiftOctave(firstNote.octave, dir), firstNote.accidental ?? 0);
            }
          } else {
            applyToSelectedNotes((n) => {
              const next = shiftPitchClassSameOctave(n.pitch, n.octave, n.accidental ?? 0, step, keySignature);
              return { ...next };
            });
            if (firstNote && !firstNote.isRest && playNoteOnInsert) {
              const newNote = shiftPitchClassSameOctave(firstNote.pitch, firstNote.octave, firstNote.accidental ?? 0, step, keySignature);
              playPianoNote(newNote.pitch, newNote.octave, newNote.accidental ?? 0);
            }
          }
          return;
        }
        if (durationMapSel[e.code] && !e.shiftKey && !modKey) {
          e.preventDefault();
          const newDurationLabel = durationMapSel[e.code];
          lastDurationRef.current = newDurationLabel;
          setSelectedDuration(newDurationLabel);
          const baseDuration = durations[newDurationLabel];
          applyToSelectedNotes(n => ({
            ...n,
            durationLabel: newDurationLabel,
            duration: n.isDotted ? baseDuration * 1.5 : baseDuration
          }));
          return;
        }
        const noteLetterSel = e.key?.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetterSel)) {
          e.preventDefault();
          const pitch = noteLetterSel.toUpperCase();
          const durationLabel = lastDurationRef.current ?? selectedDuration;
          const effectiveDuration = getEffectiveDuration(durationLabel);
          const baseDuration = durations[durationLabel];
          const newDuration = isDotted && baseDuration != null ? baseDuration * 1.5 : effectiveDuration;
          const octSel = notationStyle === 'FIGURENOTES'
            ? ghostOctave
            : (() => {
              const firstIdxSel = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
              const refNSel = notes[firstIdxSel];
              const rawMidiSel = refNSel && !refNSel.isRest ? noteToMidi(refNSel) : -1;
              const refMidiSel = rawMidiSel >= 0
                ? rawMidiSel
                : ghostReferenceMidi(
                  keySignature,
                  notationStyle,
                  ghostPitch,
                  ghostOctave,
                  ghostAccidental ?? 0,
                  ghostAccidentalIsExplicit
                );
              return resolveOctaveForPitchLetter(
                pitch,
                refMidiSel,
                keySignature,
                notationStyle,
                ghostAccidentalIsExplicit,
                ghostAccidental ?? 0
              );
            })();
          applyToSelectedNotes(n => ({
            ...n,
            pitch,
            octave: octSel,
            durationLabel,
            duration: newDuration,
            isDotted,
            isRest
          }));
          setGhostPitch(pitch);
          setGhostOctave(octSel);
          return;
        }
      }

      // Toolbox shortcuts (from user prefs or defaults): open toolbox (toggle)
      const key = shortcutKey(eventToShortcutPref(e));
      if (key && toolboxShortcutToId[key]) {
        const newToolbox = toolboxShortcutToId[key];
        e.preventDefault();
        if (noteInputMode && !N_MODE_PRIMARY_TOOL_IDS.includes(newToolbox)) {
          setSaveFeedback('N-režiimis on paigutus ja taktimuudatused lukus. Kasuta SEL-režiimi.');
          setTimeout(() => setSaveFeedback(''), 2400);
          return;
        }
        if (newToolbox === 'instruments') {
          setIsInstrumentManagerOpen((prev) => !prev);
          setCopyInstrumentConfirm(null);
          return;
        }
        const nextTb = activeToolbox === newToolbox ? null : newToolbox;
        setActiveToolbox(nextTb);
        if (nextTb === 'keySignatures') {
          const opts = toolboxes.keySignatures?.options;
          const kIdx = opts?.findIndex((o) => o.value === keySignature) ?? -1;
          setSelectedOptionIndex(kIdx >= 0 ? kIdx : 0);
          setKeySignaturesListExpanded(true);
        } else {
          setSelectedOptionIndex(0);
        }
        return;
      }

      // Aktiveeritud noodirida: ↑↓ liigutavad aktiivset rida 1px (kui noot pole valitud ja mitmel real)
      if (!noteInputMode && selectedNoteIndex < 0 && staves.length > 1 && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        dirtyRef.current = true;
        setStaffYOffsets((prev) => {
          const next = [...prev];
          while (next.length <= activeStaffIndex) next.push(0);
          const delta = e.code === 'ArrowUp' ? -1 : 1;
          next[activeStaffIndex] = (next[activeStaffIndex] || 0) + delta;
          return next;
        });
        return;
      }

      // Noodi sisestusrežiim (N-mode): nooltega kursor, tähtedega noot (ka tööriistakast avatud).
      // Mängib nooti alati pärast lugemist/sisestust (sama voog, mitte useEffect), et helikõrgus oleks õige.
      if (noteInputMode) {
        const EPS = 1e-6;
        const getSortedNoteBeats = () => {
          // Always work off explicit beats and sort by beat to avoid "skipping" when
          // note array order doesn't strictly match time order.
          const withBeats = notesWithExplicitBeats(notes).slice().sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
          return withBeats.map((n) => ({
            start: Number(n.beat) || 0,
            end: (Number(n.beat) || 0) + (Number(n.duration) || 1),
          }));
        };
        const getNoteSpanAtBeat = (beatPos) => {
          // Returns the span [start,end) of the note/rest covering beatPos.
          const spans = getSortedNoteBeats();
          for (let i = 0; i < spans.length; i++) {
            const s = spans[i];
            if (beatPos >= s.start - EPS && beatPos < s.end - EPS) return { start: s.start, end: s.end };
          }
          return null;
        };
        const getNextNoteBoundaryBeat = (dir) => {
          // Liigu järgmise/eelmise noodi algusele (võimaldab lugeda ka 1/8, 1/16 jne rütme).
          // Kui piire ei leita, kukume tagasi "grid" sammule.
          const spans = getSortedNoteBeats();
          let best = null;
          for (let i = 0; i < spans.length; i++) {
            const noteBeat = spans[i].start;
            if (dir > 0) {
              if (noteBeat > cursorPosition + EPS) best = best == null ? noteBeat : Math.min(best, noteBeat);
            } else {
              if (noteBeat < cursorPosition - EPS) best = best == null ? noteBeat : Math.max(best, noteBeat);
            }
          }
          return best;
        };
        const selectedDurStep = Number(durationLabelToQuarterBeats(selectedDuration)) || 1;
        const cursorStep = Math.max(0.125, selectedDurStep);
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          // Ära tee esmalt taktitaseme “teleporti”: muidu kursor hüppab tühja koha (nt kustutatud figuurnoodi) üle
          // ja span/piiriloogika jääb kasutamata.
          if (cursorPosition <= 0 + EPS) {
            setCursorPosition(0);
            playNoteAtBeatIfEnabled(0);
            return;
          }
          const span = getNoteSpanAtBeat(cursorPosition);
          if (span && cursorPosition > span.start + EPS) {
            const newBeat = Math.max(0, span.start);
            setCursorPosition(newBeat);
            playNoteAtBeatIfEnabled(newBeat);
            return;
          }
          const boundary = getNextNoteBoundaryBeat(-1);
          const newBeat = boundary != null ? Math.max(0, boundary) : Math.max(0, cursorPosition - cursorStep);
          setCursorPosition(newBeat);
          playNoteAtBeatIfEnabled(newBeat);
          return;
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (cursorPosition >= maxCursor - EPS) {
            setCursorPosition(maxCursor);
            playNoteAtBeatIfEnabled(maxCursor);
            return;
          }
          const span = getNoteSpanAtBeat(cursorPosition);
          if (span && cursorPosition < span.end - EPS) {
            const newBeat = Math.min(maxCursor, span.end);
            setCursorPosition(newBeat);
            playNoteAtBeatIfEnabled(newBeat);
            return;
          }
          const boundary = getNextNoteBoundaryBeat(1);
          const newBeat = boundary != null
            ? Math.min(maxCursor, boundary)
            : Math.min(maxCursor, cursorPosition + cursorStep);
          setCursorPosition(newBeat);
          playNoteAtBeatIfEnabled(newBeat);
          return;
        }
        if (e.code === 'Home') {
          e.preventDefault();
          const ms = measuresRef.current;
          const idx = ms && ms.length ? ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat) : -1;
          const start = idx >= 0 ? ms[idx].startBeat : 0;
          setCursorPosition(Math.max(0, start));
          playNoteAtBeatIfEnabled(start);
          return;
        }
        if (e.code === 'End') {
          e.preventDefault();
          const ms = measuresRef.current;
          const idx = ms && ms.length ? ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat) : -1;
          const end = idx >= 0 ? ms[idx].endBeat : measureLengthInQuarterBeats(timeSignature);
          const endBeat = Math.min(maxCursor, end > 0 ? Math.max(0, end - cursorStep) : 0);
          setCursorPosition(endBeat);
          playNoteAtBeatIfEnabled(endBeat);
          return;
        }
        // Cursor on a note: Arrow Up/Down = one note up/down (pitch class); Shift+Arrow = octave change. Akordireal (cursorSubRow === 1) mõjutame ainult akordi.
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          if (hasChordRow && cursorSubRow === 1) {
            const chordAtCursor = getChordAtCursor();
            if (chordAtCursor && !e.shiftKey && !modKey) {
              e.preventDefault();
              const dir = e.code === 'ArrowUp' ? 1 : -1;
              const newChordSymbol = transposeChordSymbol(chordAtCursor.chord, dir);
              setChords((prev) => prev.map((c) => c.id === chordAtCursor.id ? { ...c, chord: newChordSymbol } : c));
              dirtyRef.current = true;
            }
            return;
          }
          const noteIdx = getNoteIndexAtCursor();
          if (noteIdx >= 0) {
            e.preventDefault();
            const dir = e.code === 'ArrowUp' ? 1 : -1;
            saveToHistory(notes);
            if (e.shiftKey || modKey) {
              const note = notes[noteIdx];
              const newOctave = shiftOctave(note.octave, dir);
              setNotes(prev => prev.map((n, i) => i === noteIdx ? { ...n, octave: newOctave } : n));
              setGhostPitch(note.pitch);
              setGhostOctave(newOctave);
              if (playNoteOnInsert) playPianoNote(note.pitch, newOctave, note.accidental ?? 0);
            } else {
              const note = notes[noteIdx];
              const updated = shiftPitchClassSameOctave(note.pitch, note.octave, note.accidental ?? 0, dir, keySignature);
              setNotes(prev => prev.map((n, i) => i === noteIdx ? { ...n, ...updated } : n));
              setGhostPitch(updated.pitch);
              setGhostOctave(updated.octave);
              setGhostAccidental(updated.accidental ?? 0);
              if (playNoteOnInsert) playPianoNote(updated.pitch, updated.octave, updated.accidental ?? 0);
            }
            return;
          }
          // Akord kursori taktis (meloodiareal): nool üles/alla muudab akordi nime
          if (!e.shiftKey && !modKey) {
            const chordAtCursor = getChordAtCursor();
            if (chordAtCursor) {
              e.preventDefault();
              const dir = e.code === 'ArrowUp' ? 1 : -1;
              const newChordSymbol = transposeChordSymbol(chordAtCursor.chord, dir);
              setChords((prev) => prev.map((c) => c.id === chordAtCursor.id ? { ...c, chord: newChordSymbol } : c));
              dirtyRef.current = true;
              return;
            }
          }
        }
        // Shift+Arrow Up/Down – oktavi muutmine (ghost note); töötab ka Figuurnotatsioonis ja kui tööriistakast on avatud
        if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && e.shiftKey) {
          e.preventDefault();
          const dir = e.code === 'ArrowUp' ? 1 : -1;
          setGhostOctave(shiftOctave(ghostOctave, dir));
          return;
        }
        const noteLetter = e.key?.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetter)) {
          e.preventDefault();
          // Kursori asukoht loeb: akordireal (cursorSubRow === 1) → akord; meloodiareal → figuurnoot. Akorditööriistakast avatud → akord.
          // Kasuta cursorSubRow prioriteedina (kui kasutaja on akordirea valinud, ei tohi sisestus minna meloodianoodiks).
          const onChordRow = notationStyle === 'FIGURENOTES' && cursorSubRow === 1;
          if (onChordRow || activeToolbox === 'chords') {
            addChordAt(getChordInsertBeat(), noteLetter.toUpperCase(), '');
            return;
          }
          const letterUp = noteLetter.toUpperCase();
          const octForMelody = notationStyle === 'FIGURENOTES'
            ? ghostOctave
            : resolveOctaveForPitchLetter(
              letterUp,
              ghostReferenceMidi(
                keySignature,
                notationStyle,
                ghostPitch,
                ghostOctave,
                ghostAccidental ?? 0,
                ghostAccidentalIsExplicit
              ),
              keySignature,
              notationStyle,
              ghostAccidentalIsExplicit,
              ghostAccidental ?? 0
            );
          addNoteAtCursor(letterUp, octForMelody);
          return;
        }
      }

      // Toolbox navigation
      if (activeToolbox) {
        const toolbox = toolboxes[activeToolbox];
        if (!toolbox) return;
        // Special handling for time signature editing
        if (activeToolbox === 'timeSignature') {
          const currentOption = toolbox.options[selectedOptionIndex];
          
          // If in edit mode, handle arrow keys for value changes
          if (currentOption && currentOption.value === 'edit') {
            if (e.code === 'ArrowUp') {
              e.preventDefault();
              if (timeSignatureEditField === 'numerator') {
                setTimeSignature(prev => ({ 
                  ...prev, 
                  beats: Math.min(prev.beats + 1, MAX_NUMERATOR) 
                }));
              } else {
                const currentIndex = VALID_DENOMINATORS.indexOf(timeSignature.beatUnit);
                const idx = currentIndex < 0 ? 0 : currentIndex;
                if (idx < VALID_DENOMINATORS.length - 1) {
                  setTimeSignature(prev => ({ 
                    ...prev, 
                    beatUnit: VALID_DENOMINATORS[idx + 1]
                  }));
                }
              }
              return;
            }
            
            if (e.code === 'ArrowDown') {
              e.preventDefault();
              if (timeSignatureEditField === 'numerator') {
                setTimeSignature(prev => ({ 
                  ...prev, 
                  beats: Math.max(prev.beats - 1, 1) 
                }));
              } else {
                const currentIndex = VALID_DENOMINATORS.indexOf(timeSignature.beatUnit);
                const idx = currentIndex < 0 ? 0 : currentIndex;
                if (idx > 0) {
                  setTimeSignature(prev => ({ 
                    ...prev, 
                    beatUnit: VALID_DENOMINATORS[idx - 1]
                  }));
                }
              }
              return;
            }
            
            // Tab or Left/Right arrows to switch between numerator and denominator
            if (e.code === 'Tab' || e.code === 'ArrowRight') {
              e.preventDefault();
              setTimeSignatureEditField(prev => 
                prev === 'numerator' ? 'denominator' : 'numerator'
              );
              return;
            }
            
            if (e.code === 'ArrowLeft') {
              e.preventDefault();
              setTimeSignatureEditField(prev => 
                prev === 'denominator' ? 'numerator' : 'denominator'
              );
              return;
            }
          }
        }
        
        if (activeToolbox === 'rhythm') {
          const durationMap = {
            'Digit7': '1/1', 'Digit6': '1/2', 'Digit5': '1/4',
            'Digit4': '1/8', 'Digit3': '1/16', 'Digit2': '1/32'
          };
          if (durationMap[e.code] && !e.shiftKey && !modKey) {
            e.preventDefault();
            const dur = durationMap[e.code];
            if (restNextRef.current) {
              restNextRef.current = false;
              lastDurationRef.current = dur;
              setSelectedDuration(dur);
              setIsRest(true);
              const restIdx = toolbox.options.findIndex(opt => opt.value === 'rest');
              if (restIdx >= 0) setSelectedOptionIndex(restIdx);
              return;
            }
            lastDurationRef.current = dur;
            setSelectedDuration(dur);
            const optionIdx = toolbox.options.findIndex(opt => opt.value === dur);
            if (optionIdx >= 0) setSelectedOptionIndex(optionIdx);
            return;
          }
          if (e.code === 'Digit0' && !e.shiftKey && !modKey) {
            e.preventDefault();
            restNextRef.current = true;
            return;
          }
          if (e.code === 'Period' && !e.shiftKey && !modKey) {
            e.preventDefault();
            setIsDotted(prev => !prev);
            return;
          }
        }

        if (e.key === 'ArrowDown' && !e.shiftKey) {
          e.preventDefault();
          setSelectedOptionIndex(prev => prev < toolbox.options.length - 1 ? prev + 1 : prev);
          return;
        }
        if (e.key === 'ArrowUp' && !e.shiftKey) {
          e.preventDefault();
          setSelectedOptionIndex(prev => prev > 0 ? prev - 1 : prev);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          handleToolboxSelection();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setActiveToolbox(null);
          setSelectedOptionIndex(0);
          return;
        }
      }

      // Stage V: Selection mode (kui N-režiim on VÄLJAS).
      if (!activeToolbox && !noteInputMode) {
        // Vasak/parem: takt-haaval (MuseScore-stiilis); Shift + nool laiendab taktivalikut (Cmd+Backspace kustutab).
        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
          const ms = measuresRef.current;
          if (Array.isArray(ms) && ms.length > 0) {
            e.preventDefault();
            const curIdx = getMeasureIndexForBeatMs(ms, cursorPosition, measureLengthInQuarterBeats(timeSignature));
            // Pointer tool + Shift + ◀/▶: extend note range along the score timeline (matches rhythm toolbox hint / teacher expectation).
            if (e.shiftKey && cursorToolRef.current === 'select') {
              const withBeats = notesWithExplicitBeats(notes);
              const sorted = withBeats.map((n, i) => ({ n, i, beat: Number(n.beat) || 0 }))
                .sort((a, b) => {
                  if (a.beat !== b.beat) return a.beat - b.beat;
                  const ma = noteToMidi(a.n);
                  const mb = noteToMidi(b.n);
                  if (ma !== mb) return ma - mb;
                  return a.i - b.i;
                });
              const order = sorted.map((s) => s.i);
              let noteRangeHandled = false;
              if (order.length > 0) {
                const posOf = (idx) => order.indexOf(idx);
                const dir = e.code === 'ArrowRight' ? 1 : -1;
                const applyNoteRange = (a, b, focusIdx) => {
                  applySelectionModel({ kind: 'range', anchorIndex: a, focusIndex: b });
                  setCursorSubRow(0);
                  const beat = getBeatAtNoteIndex(notes, focusIdx);
                  setCursorPosition(beat);
                  playNoteAtBeatIfEnabled(beat);
                  noteRangeHandled = true;
                };
                if (selectionStart < 0 || selectionEnd < 0) {
                  const baseIdx = selectedNoteIndex >= 0 ? selectedNoteIndex : getNoteIndexAtCursor();
                  if (baseIdx >= 0) {
                    const p = posOf(baseIdx);
                    if (p >= 0) {
                      const q = p + dir;
                      if (q >= 0 && q < order.length) {
                        applyNoteRange(baseIdx, order[q], order[q]);
                      }
                    }
                  }
                } else {
                  const lo = Math.min(selectionStart, selectionEnd);
                  const hi = Math.max(selectionStart, selectionEnd);
                  const pLo = posOf(lo);
                  const pHi = posOf(hi);
                  if (pLo >= 0 && pHi >= 0) {
                    if (dir > 0 && pHi < order.length - 1) {
                      applyNoteRange(lo, order[pHi + 1], order[pHi + 1]);
                    } else if (dir < 0 && pLo > 0) {
                      applyNoteRange(order[pLo - 1], hi, order[pLo - 1]);
                    }
                  }
                }
              }
              if (noteRangeHandled) return;
            }
            applySelectionModel(CURSOR_SELECTION_NONE);
            if (e.shiftKey) {
              const prev = measureSelectionRef.current;
              let nextSel;
              if (e.code === 'ArrowRight') {
                if (!prev) nextSel = { start: curIdx, end: Math.min(curIdx + 1, ms.length - 1) };
                else nextSel = { start: prev.start, end: Math.min(prev.end + 1, ms.length - 1) };
              } else if (!prev) nextSel = { start: Math.max(curIdx - 1, 0), end: curIdx };
              else nextSel = { start: Math.max(prev.start - 1, 0), end: prev.end };
              applySelectionModel({ kind: 'measureRange', anchorMeasure: nextSel.start, focusMeasure: nextSel.end });
              const focusIdx = Math.max(nextSel.start, nextSel.end);
              const focusM = ms[focusIdx] || ms[curIdx];
              setCursorPosition(focusM.startBeat);
              setSelectedNoteIndex(findFirstNoteIndexInMeasure(notes, focusM));
              playNoteAtBeatIfEnabled(focusM.startBeat);
              return;
            }
            const EPS = 1e-6;
            const selectedDurStep = Number(durationLabelToQuarterBeats(selectedDuration)) || 1;
            const cursorStep = Math.max(0.125, selectedDurStep);
            const spans = notesWithExplicitBeats(notes)
              .slice()
              .map((n) => {
                const start = Number(n?.beat) || 0;
                const dur = Number(n?.duration) || 1;
                return { start, end: start + dur };
              })
              .sort((a, b) => a.start - b.start);
            const getNextWrittenBoundary = (dir) => {
              let best = null;
              for (let i = 0; i < spans.length; i += 1) {
                const s = spans[i];
                const candidates = [s.start, s.end];
                for (let c = 0; c < candidates.length; c += 1) {
                  const b = candidates[c];
                  if (dir > 0) {
                    if (b > cursorPosition + EPS) best = best == null ? b : Math.min(best, b);
                  } else if (b < cursorPosition - EPS) {
                    best = best == null ? b : Math.max(best, b);
                  }
                }
              }
              return best;
            };
            const dir = e.code === 'ArrowRight' ? 1 : -1;
            const boundary = getNextWrittenBoundary(dir);
            const stepped = cursorPosition + dir * cursorStep;
            const targetBeat = boundary != null ? boundary : stepped;
            const newBeat = Math.max(0, Math.min(maxCursor, targetBeat));
            setMeasureSelection(null);
            setCursorPosition(newBeat);
            setSelectedNoteIndex(-1);
            playNoteAtBeatIfEnabled(newBeat);
            return;
          }
        }

        // Stage V: Pitch editing – Arrow Up/Down (diatonic), Shift+Arrow or Cmd/Ctrl+Arrow (octave jump) – uses applyToSelectedNotes from top of handler
        const arrowOctave = (e.code === 'ArrowUp' || e.code === 'ArrowDown') && selectedNoteIndex >= 0 && (e.shiftKey || modKey);
        if (arrowOctave) {
          e.preventDefault();
          const dir = e.code === 'ArrowUp' ? 1 : -1;
          applyToSelectedNotes(n => ({ octave: shiftOctave(n.octave, dir) }));
          return;
        }

        if (e.code === 'ArrowUp' && selectedNoteIndex >= 0 && !e.shiftKey && !modKey) {
          e.preventDefault();
          applyToSelectedNotes((n) => shiftPitchClassSameOctave(n.pitch, n.octave, n.accidental ?? 0, 1, keySignature));
          return;
        }

        if (e.code === 'ArrowDown' && selectedNoteIndex >= 0 && !e.shiftKey && !modKey) {
          e.preventDefault();
          applyToSelectedNotes((n) => shiftPitchClassSameOctave(n.pitch, n.octave, n.accidental ?? 0, -1, keySignature));
          return;
        }

        // Stage V: Duration editing (Digits 2-7) – valitud nootidele või ühele noodile
        const durationMap = {
          'Digit7': '1/1', 'Digit6': '1/2', 'Digit5': '1/4',
          'Digit4': '1/8', 'Digit3': '1/16', 'Digit2': '1/32'
        };
        if (durationMap[e.code] && selectedNoteIndex >= 0 && !e.shiftKey && !modKey) {
          e.preventDefault();
          const newDurationLabel = durationMap[e.code];
          lastDurationRef.current = newDurationLabel;
          setSelectedDuration(newDurationLabel);
          const baseDuration = durations[newDurationLabel];
          applyToSelectedNotes(n => ({
            ...n,
            durationLabel: newDurationLabel,
            duration: n.isDotted ? baseDuration * 1.5 : baseDuration
          }));
          return;
        }

        // Valikurežiim: A–G muudab valitud nooti(de) kõla ja rakendab aktiivse rütmi
        const noteLetterSel = e.key?.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetterSel) && selectedNoteIndex >= 0) {
          e.preventDefault();
          const pitch = noteLetterSel.toUpperCase();
          const durationLabel = lastDurationRef.current ?? selectedDuration;
          const effectiveDuration = getEffectiveDuration(durationLabel);
          const baseDuration = durations[durationLabel];
          const newDuration = isDotted && baseDuration != null ? baseDuration * 1.5 : effectiveDuration;
          const octSel2 = notationStyle === 'FIGURENOTES'
            ? ghostOctave
            : (() => {
              const firstIdxSel2 = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
              const refNSel2 = notes[firstIdxSel2];
              const rawMidiSel2 = refNSel2 && !refNSel2.isRest ? noteToMidi(refNSel2) : -1;
              const refMidiSel2 = rawMidiSel2 >= 0
                ? rawMidiSel2
                : ghostReferenceMidi(
                  keySignature,
                  notationStyle,
                  ghostPitch,
                  ghostOctave,
                  ghostAccidental ?? 0,
                  ghostAccidentalIsExplicit
                );
              return resolveOctaveForPitchLetter(
                pitch,
                refMidiSel2,
                keySignature,
                notationStyle,
                ghostAccidentalIsExplicit,
                ghostAccidental ?? 0
              );
            })();
          applyToSelectedNotes(n => ({
            ...n,
            pitch,
            octave: octSel2,
            durationLabel,
            duration: newDuration,
            isDotted,
            isRest
          }));
          setGhostPitch(pitch);
          setGhostOctave(octSel2);
          return;
        }

        // Õpetaja: Delete/Backspace kustutab valitud nooti(de) märgistuse (teacherLabel), mitte nooti ennast
        if ((e.code === 'Backspace' || e.code === 'Delete') && selectedNoteIndex >= 0 && enableEmojiOverlays) {
          const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
          const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
          const indices = Array.from({ length: end - start + 1 }, (_, k) => start + k);
          const hasLabel = indices.some((i) => notes[i] && (notes[i].teacherLabel != null && notes[i].teacherLabel !== ''));
          if (hasLabel && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
            e.preventDefault();
            saveToHistory(notes);
            setNotes((prev) => prev.map((n, i) => (indices.includes(i) ? { ...n, teacherLabel: '' } : n)));
            return;
          }
        }

        // Stage V: Delete selected note(s) – replace with rest(s) of same duration (no shifting)
        if ((e.code === 'Backspace' || e.code === 'Delete') && selectedNoteIndex >= 0) {
          e.preventDefault();
          replaceSelectedNotesWithRests({ clearSelection: true });
          return;
        }
      }

      // Normal input mode (when N is ON) – Ghost note + add
      if (!activeToolbox && noteInputMode) {
        // Arrow Up/Down = one note up/down (pitch class in key). Shift+Arrow = octave change.
        if (e.code === 'ArrowUp' && !e.shiftKey) {
          e.preventDefault();
          const next = shiftPitchClassSameOctave(ghostPitch, ghostOctave, ghostAccidental, 1, keySignature);
          setGhostPitch(next.pitch);
          setGhostOctave(next.octave);
          setGhostAccidental(next.accidental ?? 0);
          setGhostAccidentalIsExplicit(false);
          if (playNoteOnInsert) playPianoNote(next.pitch, next.octave, next.accidental ?? 0);
          return;
        }
        if (e.code === 'ArrowDown' && !e.shiftKey) {
          e.preventDefault();
          const next = shiftPitchClassSameOctave(ghostPitch, ghostOctave, ghostAccidental, -1, keySignature);
          setGhostPitch(next.pitch);
          setGhostOctave(next.octave);
          setGhostAccidental(next.accidental ?? 0);
          setGhostAccidentalIsExplicit(false);
          if (playNoteOnInsert) playPianoNote(next.pitch, next.octave, next.accidental ?? 0);
          return;
        }
        // Shift+Arrow Up/Down – octave jump on ghost note (traditional)
        if (e.code === 'ArrowUp' && e.shiftKey) {
          e.preventDefault();
          const newOct = shiftOctave(ghostOctave, 1);
          setGhostOctave(newOct);
          if (playNoteOnInsert) {
            const keyA = getAccidentalForPitchInKey(ghostPitch, keySignature);
            const eff = ghostAccidentalIsExplicit ? ghostAccidental : keyA;
            playPianoNote(ghostPitch, newOct, eff === 1 ? 1 : eff === -1 ? -1 : 0);
          }
          return;
        }
        if (e.code === 'ArrowDown' && e.shiftKey) {
          e.preventDefault();
          const newOct = shiftOctave(ghostOctave, -1);
          setGhostOctave(newOct);
          if (playNoteOnInsert) {
            const keyA = getAccidentalForPitchInKey(ghostPitch, keySignature);
            const eff = ghostAccidentalIsExplicit ? ghostAccidental : keyA;
            playPianoNote(ghostPitch, newOct, eff === 1 ? 1 : eff === -1 ? -1 : 0);
          }
          return;
        }
        // Duration shortcuts
        const durationMap = {
          'Digit7': '1/1', 'Digit6': '1/2', 'Digit5': '1/4',
          'Digit4': '1/8', 'Digit3': '1/16', 'Digit2': '1/32'
        };
        if (durationMap[e.code] && !e.shiftKey && !modKey) {
          const dur = durationMap[e.code];
          if (restNextRef.current) {
            restNextRef.current = false;
            e.preventDefault();
            const effectiveDuration = getEffectiveDuration(dur);
            // Insert a rest at the cursor beat (replace any placeholder rest),
            // not appended to the end of the note list.
            addNoteAtCursor('C', ghostOctave, 0, { insertAtBeat: cursorPosition, forceRest: true, forceDotted: false, skipPlay: true });
            return;
          }
          lastDurationRef.current = dur;
          setSelectedDuration(dur);
          return;
        }
        if (e.code === 'Digit0' && !e.shiftKey && !modKey) {
          e.preventDefault();
          restNextRef.current = true;
          return;
        }
        if (e.code === 'Period' && !e.shiftKey && !modKey) {
          e.preventDefault();
          setIsDotted(prev => !prev);
          return;
        }

        // Shift+Letter: add note on top of the note at cursor (chord input). Traditional or Pedagogical only.
        const chordNoteLetter = e.key?.toLowerCase();
        const isTraditionalOrPedagogical = notationMode === 'traditional' || notationMode === 'vabanotatsioon';
        if (e.shiftKey && ['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(chordNoteLetter) && isTraditionalOrPedagogical) {
          e.preventDefault();
          addNoteOnTopOfCursor(chordNoteLetter.toUpperCase(), ghostOctave);
          return;
        }

        // Note input (C-G) – sama loogika mis addNoteAtCursor (kursori löök, mitte järjekorra lõppu kleebimine).
        const noteLetter = e.key.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetter)) {
          restNextRef.current = false;
          setGhostAccidentalIsExplicit(false);
          e.preventDefault();
          addNoteAtCursor(noteLetter.toUpperCase(), ghostOctave, undefined, { skipPlay: !playNoteOnInsert });
          return;
        }

        // Backspace in N mode is handled earlier (before convert-selection-to-rest) so delete-at-cursor always works
      }
    };

    // Globaalne window keydown: JO-võti nooltega ↑↓ muudab võtme asukohta ja transponeerib kõik noodid reaalajas (mõlemal joonestikul)
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeToolbox, selectedOptionIndex, handleToolboxSelection, noteInputMode, selectedDuration, isDotted, isRest, notes,
    getEffectiveDuration, selectedNoteIndex, selectionStart, selectionEnd, clipboard, undo, saveToHistory, getSelectedNotes,
    shiftPitchClassSameOctave, shiftOctave, addMeasure, addSongBlock, ghostPitch, ghostOctave, ghostAccidental, ghostAccidentalIsExplicit, playNoteOnInsert, playPianoNote,
    cursorPosition, cursorSubRow, notationStyle, figurenotesChordBlocks, addChordAt, getChordInsertBeat, getChordAtCursor, transposeChordSymbol,
    cursorOnMelodyRow, noteIndexAtCursor, playNoteAtBeatIfEnabled,
    joClefFocused, joClefStaffPosition, keySignature, setNotes, setKeySignature, setStaves, notationMode, addNoteOnTopOfCursor,
    staves, activeStaffIndex, timeSignature, pickupEnabled, pickupQuantity, pickupDuration,
    handleSaveShortcut, handlePrint, addedMeasures, timeSignature, setAddedMeasures, setCursorPosition, measureRepeatMarks, setMeasureRepeatMarks,
    maxCursor, setScoreZoomLevel, durationToBeats, hasFullAccess, pickupEnabled, pickupQuantity, pickupDuration, isScorePlaybackPlaying, stopScorePlayback, isInstrumentManagerOpen,
    effectiveShortcutPrefs,     expandScoreForNoteInputAdvance, addNoteAtCursor,
    notesWithExplicitBeats, getBeatAtNoteIndex, noteToMidi,
  ]);

  // JO-võti: klõps väljaspool võtit lõpetab valiku
  useEffect(() => {
    if (!joClefFocused) return;
    const onMouseDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-jo-clef]')) return;
      setJoClefFocused(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [joClefFocused]);

  const measures = calculateMeasures();
  const measuresRef = useRef(measures);
  measuresRef.current = measures;

  const deleteMeasuresRange = useCallback(() => {
    const ms = measuresRef.current;
    const msel = measureSelectionRef.current;
    if (!Array.isArray(ms) || ms.length <= 1) return false;

    let startIdx;
    let endIdx;
    if (msel && Number.isInteger(msel.start) && Number.isInteger(msel.end)) {
      startIdx = Math.min(msel.start, msel.end);
      endIdx = Math.max(msel.start, msel.end);
    } else {
      const cur = getMeasureIndexForBeatMs(ms, cursorPosition, measureLengthInQuarterBeats(timeSignature));
      startIdx = endIdx = cur;
    }
    if (startIdx < 0 || endIdx >= ms.length || startIdx > endIdx) return false;
    const numDel = endIdx - startIdx + 1;
    if (ms.length - numDel < 1) return false;

    const blockStart = ms[startIdx].startBeat;
    const blockEnd = ms[endIdx].endBeat;

    saveToHistory(notes);
    setStaves((prev) => prev.map((staff) => {
      const { notes: nn } = removeBeatRangeFromStaffNotes(staff.notes || [], blockStart, blockEnd);
      return { ...staff, notes: nn };
    }));
    setChords((prev) => removeBeatRangeFromChords(prev || [], blockStart, blockEnd));
    setAddedMeasures((a) => Math.max(0, (a || 0) - numDel));

    setLayoutLineBreakBefore((prev) => remapBreakIndicesAfterMeasureDelete(prev, startIdx, endIdx));
    setPartLayoutLineBreakBefore((prev) => remapBreakIndicesAfterMeasureDelete(prev, startIdx, endIdx));
    setLayoutPageBreakBefore((prev) => remapBreakIndicesAfterMeasureDelete(prev, startIdx, endIdx));
    setPartLayoutPageBreakBefore((prev) => remapBreakIndicesAfterMeasureDelete(prev, startIdx, endIdx));
    setMeasureStretchFactors((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const next = [...prev];
      next.splice(startIdx, numDel);
      return next;
    });
    setMeasureRepeatMarks((prev) => remapRepeatMarksAfterMeasureDelete(prev, startIdx, endIdx));

    const prevMeasure = startIdx > 0 ? ms[startIdx - 1] : null;
    if (prevMeasure) {
      const oneBeat = oneMetricalBeatInQuarterBeats(timeSignature);
      setCursorPosition(Math.max(prevMeasure.startBeat, prevMeasure.endBeat - oneBeat));
    } else {
      setCursorPosition(0);
    }
    setMeasureSelection(null);
    setSelectionStart(-1);
    setSelectionEnd(-1);
    setSelectedNoteIndex(-1);
    dirtyRef.current = true;
    return true;
  }, [
    cursorPosition,
    notes,
    saveToHistory,
    setStaves,
    setChords,
    setAddedMeasures,
    timeSignature?.beats,
    timeSignature?.beatUnit,
  ]);

  deleteMeasuresRangeRef.current = deleteMeasuresRange;

  const measuresWithMarks = useMemo(() => {
    const normalized = normalizeRepeatMarksMap(measureRepeatMarks, measures.length);
    return mergeMeasuresWithRepeatMarks(measures, normalized);
  }, [measures, measureRepeatMarks]);
  const repeatMarkIssues = useMemo(
    () => validateRepeatMarks(normalizeRepeatMarksMap(measureRepeatMarks, measures.length)),
    [measureRepeatMarks, measures.length]
  );
  // Praeguse vaate paigutus: partituur või instrumendi part (instrumentide paigutus ei mõjuta partituuri)
  const effectiveLayoutMeasuresPerLine = viewMode === 'score' ? layoutMeasuresPerLine : partLayoutMeasuresPerLine;
  const effectiveLayoutLineBreakBefore = viewMode === 'score' ? layoutLineBreakBefore : partLayoutLineBreakBefore;
  const effectiveLayoutPageBreakBefore = viewMode === 'score' ? layoutPageBreakBefore : partLayoutPageBreakBefore;
  const effectiveLayoutExtraPages = viewMode === 'score' ? layoutExtraPages : partLayoutExtraPages;
  const scoreContainerRef = useRef(null);
  const scoreContentRef = useRef(null); // noodiala sisu (pealkiri + SVG); tekstikastid kasutavad scoreContainerRef koordinaate
  const textboxInteractionRef = useRef(null); // { type: 'move'|'resize', id, startX, startY, boxStartX?, boxStartY?, boxStartW?, boxStartH?, handle? }
  const textboxDragStartRef = useRef(null); // { id, startX, startY, boxStartX, boxStartY } – click vs drag
  /** Figuurnoti N-režiimi dual tööriistariba (rütm | akordid): lohistatav vahe vertical splitter. */
  const dualToolboxSplitRowRef = useRef(null);
  const dualToolboxSplitDragRef = useRef(null); // { startX, startRatio, width }
  const dualToolboxSplitFractionRef = useRef(0.52);
  const [dualToolboxRhythmFraction, setDualToolboxRhythmFraction] = useState(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('nm:dualToolboxRhythmFraction') : null;
      const v = parseFloat(raw || '');
      if (Number.isFinite(v) && v >= 0.22 && v <= 0.78) return v;
    } catch (_) { /* ignore */ }
    return 0.52;
  });
  const selectionDragRef = useRef(null); // { startIndex, pointerDown: boolean, shift: boolean }
  const handPanRef = useRef({ active: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 });
  const [isHandPanning, setIsHandPanning] = useState(false);
  const systemsForScoreRef = useRef([]);
  const exportContentBoundsRef = useRef({ width: 0, height: 0 });
  const exportCursorRef = useRef(null); // { x, y, emoji, size } container-relative, for MP4 fillText
  const exportNotationSvgRef = useRef(null); // Direct ref to the visible score SVG used by PDF/print capture.
  /** Lehe laius ja suund sõltuvad ainult rakenduse valikust (Vaade → Lehe suund), mitte seadme ega brauseri ekraani suurusest (iPad, Android, MacBook, PC). */
  /** A4 96 DPI: portrait 794×1123, landscape 1123×794 (suhe 1 : 1.414). */
  const getFullPageLayoutWidth = (orientation) => (orientation === 'landscape' ? LAYOUT.PAGE_HEIGHT_PX : LAYOUT.PAGE_WIDTH_PX);
  const pageWidth = getFullPageLayoutWidth(pageOrientation);
  const [fitPageDisplayWidth, setFitPageDisplayWidth] = useState(() => getFullPageLayoutWidth('portrait'));
  useEffect(() => { setFitPageDisplayWidth(0); }, [pageOrientation]);
  useEffect(() => {
    pdfExportOptionsRef.current = { pageFlowDirection, pageWidth, pageOrientation };
  }, [pageFlowDirection, pageWidth, pageOrientation]);
  const basePageWidth = pageWidth;
  const effectiveLayoutPageWidth = (viewFitPage && !viewSmartPage)
    ? (fitPageDisplayWidth > 0 ? fitPageDisplayWidth : getFullPageLayoutWidth(pageOrientation))
    : basePageWidth;
  const a4HeightRatio = pageOrientation === 'landscape' ? LAYOUT.A4_HEIGHT_RATIO_LANDSCAPE : LAYOUT.A4_HEIGHT_RATIO;
  // A4 page height for layout (no PAGE_WIDTH_MIN fallback so portrait/landscape proportions are exact).
  const a4PageHeightPx = effectiveLayoutPageWidth * a4HeightRatio;
  const paperMm = PAPER_SIZE_MM[paperSize] || PAPER_SIZE_MM.a4;
  const paperWidthMm = pageOrientation === 'landscape' ? paperMm.height : paperMm.width;
  const pxPerMm = paperWidthMm > 0 ? (effectiveLayoutPageWidth / paperWidthMm) : (LAYOUT.PAGE_WIDTH_PX / 210);
  const staffLineSpanPx = getTraditionalStaffLineSpanPx({ staffLines, staffSpace: STAFF_SPACE });
  const traditionalPartsGapPx = getTraditionalInterStaffGapPx({ layoutPartsGapMm, pxPerMm });
  /**
   * Figuurnotatsiooni "fit-to-row" kaitse:
   * Kui kasutaja lukustab nt "4 takti reas", peab ka suur noodigraafika mahtuma lehe piiridesse (portrait/landscape),
   * muidu jookseb viimane takt visuaalselt üle lehe riba.
   *
   * Kui rida on lukustatud (nt 4 takti reas), vähendame vajadusel figuuri suurust automaatselt,
   * et viimane takt ei läheks üle scorepage piiri.
   */
  const figurenotesSizeClamped = Math.max(12, Math.min(100, Number(figurenotesSize) || 65));
  const effectiveFigurenotesSize = (() => {
    // Keep user-selected figure size (with hard safety clamp only).
    return figurenotesSizeClamped;
  })();

  /** Figurenotes row height (beat-box / line) scales with effective notation size so barlines and box match note size. */
  const figurenotesRowHeight = Math.max(FIGURE_ROW_HEIGHT, Math.round(FIGURE_ROW_HEIGHT * effectiveFigurenotesSize / 75));
  /** Chord line in figurenotes: only when user has enabled it in chord toolbox; half height of beat-box + 5px, below melody row; gap 0–20 px. */
  const figurenotesChordLineHeight = Math.round(figurenotesRowHeight / 2) + 5;
  /** Vahe meloodia ja akordirea vahel: kasutaja seade (0–20 px) või vähemalt lauluteksti fondi suuruse suhtes (et tekstid ei jookse kokku). */
  const effectiveChordLineGap = figurenotesChordBlocks
    ? Math.max(figurenotesChordLineGap, Math.min(100, Math.round((lyricFontSize || 12) * 1.8)))
    : 0;
  const figurenotesTotalRowHeight = figurenotesChordBlocks
    ? figurenotesRowHeight + effectiveChordLineGap + figurenotesChordLineHeight
    : figurenotesRowHeight;
  const FOCUS_STAFF_HEIGHT = 280; // Kui osa ridu peidetud, suurendatakse nähtavad read (HEV/solfedž)
  const MULTI_STAFF_COMPACT_HEIGHT = 20; // Traditsiooniline mitme rea partituur: kompaktne vaikimisi vahe
  const visibleStaffCountForLayout = useMemo(() => {
    let count = 0;
    staves.forEach((_, staffIdx) => {
      if (visibleStaves[staffIdx] !== false) count += 1;
    });
    return Math.max(1, count || staves.length || 1);
  }, [staves, visibleStaves]);
  const isTraditionalMultiStaff = notationStyle !== 'FIGURENOTES' && visibleStaffCountForLayout > 1;
  const traditionalPartsGapPxEffective = traditionalPartsGapPx;
  const effectiveLayoutConnectedBarlines = layoutConnectedBarlines || isTraditionalMultiStaff;
  // One authoritative traditional multi-staff step (src/layout/traditionalMultiStaffGeometry.js).
  const traditionalStaffStepPx = getTraditionalStaffStepPx(staffLineSpanPx, traditionalPartsGapPxEffective);
  const traditionalLayoutStaffHeight = getTraditionalLayoutStaffHeightPx({
    stavesCount: staves.length,
    staffLineSpanPx,
    interStaffGapPx: traditionalPartsGapPxEffective,
    getStaffHeight,
  });
  const systemsForScore = useMemo(() => {
    if (notationStyle === 'FIGURENOTES') {
      const figureStaffStep = figurenotesTotalRowHeight + layoutPartsGap;
      const figureSystemCoreHeight = (visibleStaffCountForLayout * figurenotesTotalRowHeight)
        + ((visibleStaffCountForLayout - 1) * layoutPartsGap);
      // Figurenotes multistaff rule: one measure's staves (e.g. piano RH+LH + extra instruments)
      // must stay inside the same system; only full system jumps to the next row.
      const data = { measures, timeSignature, pixelsPerBeat, staffSpacing: figureSystemCoreHeight + layoutSystemGap, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, boxesPerRow: effectiveLayoutMeasuresPerLine || 4, pageWidth: effectiveLayoutPageWidth, pageHeight: a4PageHeightPx, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore, figurenotesSize: effectiveFigurenotesSize };
      const raw = calculateLayout('figure', pageOrientation === 'landscape' ? 'landscape' : 'portrait', data);
      return raw.map((s, i) => ({ ...s, yOffset: s.yOffset + (systemYOffsets[i] ?? 0) }));
    }
    const opts = { measuresPerLine: effectiveLayoutMeasuresPerLine, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore, systemGap: layoutSystemGap, staffCount: staves.length, staffHeight: traditionalLayoutStaffHeight, measureStretchFactors, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, pageHeight: a4PageHeightPx };
    const raw = computeLayout(measures, timeSignature, pixelsPerBeat, effectiveLayoutPageWidth, opts);
    return raw.map((s, i) => ({ ...s, yOffset: s.yOffset + (systemYOffsets[i] ?? 0) }));
  }, [notationStyle, measures, timeSignature, pixelsPerBeat, effectiveLayoutPageWidth, pageOrientation, effectiveLayoutMeasuresPerLine, effectiveLayoutLineBreakBefore, effectiveLayoutPageBreakBefore, layoutSystemGap, layoutGlobalSpacingMultiplier, staves.length, measureStretchFactors, systemYOffsets, a4PageHeightPx, figurenotesTotalRowHeight, figurenotesChordBlocks, layoutPartsGap, visibleStaffCountForLayout, traditionalLayoutStaffHeight]);
  useEffect(() => { systemsForScoreRef.current = systemsForScore; }, [systemsForScore]);
  // Nutikas fookus: ainult valitud read; vähem ridu = suurem rea kõrgus (HEV/solfedž)
  const visibleStaffList = useMemo(() => {
    const list = [];
    staves.forEach((staff, staffIdx) => {
      if (visibleStaves[staffIdx] !== false) list.push({ staff, staffIdx, visibleIndex: list.length });
    });
    return list;
  }, [staves, visibleStaves]);
  const effectiveStaffHeight = notationStyle === 'FIGURENOTES'
    ? figurenotesTotalRowHeight
    : (visibleStaffList.length > 0 && visibleStaffList.length < staves.length
      ? FOCUS_STAFF_HEIGHT
      : ((visibleStaffList.length > 1 || staves.length > 1) ? traditionalStaffStepPx : getStaffHeight()));
  const perStaffRowStep = notationStyle === 'FIGURENOTES'
    ? (effectiveStaffHeight + layoutPartsGap)
    : ((visibleStaffList.length > 1 || staves.length > 1) ? traditionalStaffStepPx : (effectiveStaffHeight + layoutPartsGap));
  const useManualStaffOffsets = notationStyle === 'FIGURENOTES' || visibleStaffCountForLayout <= 1;
  const traditionalVisibleGeometry = useMemo(() => computeTraditionalVisibleStaffGeometry({
    visibleStaffList: visibleStaffList.length > 0
      ? visibleStaffList.map(({ staffIdx, visibleIndex }) => ({ staffIdx, visibleIndex }))
      : staves.map((_, staffIdx) => ({ staffIdx, visibleIndex: staffIdx })),
    staffStepPx: traditionalStaffStepPx,
    interStaffGapPx: traditionalPartsGapPxEffective,
    useManualOffsets: useManualStaffOffsets,
    staffYOffsets,
  }), [visibleStaffList, staves, traditionalStaffStepPx, traditionalPartsGapPxEffective, useManualStaffOffsets, staffYOffsets]);
  /** Pealkiri/autor (pt-6, mb-4, kaks rida) — pole süsteemide lastY sees; zoom/absolute kõrgus peab seda arvestama. */
  const scoreHeadBlockReservePx = notationMode === 'vabanotatsioon' ? 220 : 140;
  const logicalContentHeight = useMemo(() => {
    const entries = visibleStaffList.length > 0
      ? visibleStaffList
      : staves.map((staff, staffIdx) => ({ staff, staffIdx, visibleIndex: staffIdx }));
    const nVis = Math.max(1, entries.length);
    let sumBaseYOffset = 0;
    entries.forEach(({ staffIdx, visibleIndex }) => {
      const staffOffset = useManualStaffOffsets ? (staffYOffsets[staffIdx] ?? 0) : 0;
      sumBaseYOffset += visibleIndex * perStaffRowStep + staffOffset;
    });
    const layoutStaffCount = staves.length || 1;
    if (notationStyle === 'FIGURENOTES') {
      const figureSystemCoreHeight = (nVis * figurenotesTotalRowHeight) + ((nVis - 1) * layoutPartsGap);
      const data = { measures, timeSignature, pixelsPerBeat, staffSpacing: figureSystemCoreHeight + layoutSystemGap, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, boxesPerRow: effectiveLayoutMeasuresPerLine || 4, pageWidth: effectiveLayoutPageWidth, pageHeight: a4PageHeightPx, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore, figurenotesSize: effectiveFigurenotesSize };
      const sys = calculateLayout('figure', pageOrientation === 'landscape' ? 'landscape' : 'portrait', data);
      const lastY = sys.length > 0 ? sys[sys.length - 1].yOffset + (systemYOffsets[sys.length - 1] ?? 0) : 0;
      const maxBaseYOffset = entries.reduce((maxY, { staffIdx, visibleIndex }) => {
        const staffOffset = useManualStaffOffsets ? (staffYOffsets[staffIdx] ?? 0) : 0;
        const y = visibleIndex * perStaffRowStep + staffOffset;
        return Math.max(maxY, y);
      }, 0);
      const totalCore = sys.length > 0 ? lastY + figurenotesTotalRowHeight + 40 : figurenotesTotalRowHeight + 40;
      return scoreHeadBlockReservePx + maxBaseYOffset + totalCore;
    }
    const opts = { measuresPerLine: effectiveLayoutMeasuresPerLine, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore, systemGap: layoutSystemGap, staffCount: layoutStaffCount, measureStretchFactors, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, pageHeight: a4PageHeightPx };
    const sys = computeLayout(measures, timeSignature, pixelsPerBeat, effectiveLayoutPageWidth, opts);
    const lastY = sys.length > 0 ? sys[sys.length - 1].yOffset + (systemYOffsets[sys.length - 1] ?? 0) : 0;
    const perStaffCore = sys.length > 0 ? lastY + layoutStaffCount * getStaffHeight() + 40 : layoutStaffCount * getStaffHeight() + 40;
    return scoreHeadBlockReservePx + nVis * perStaffCore + sumBaseYOffset;
  }, [notationStyle, notationMode, visibleStaffList, staves, effectiveStaffHeight, layoutPartsGap, perStaffRowStep, staffYOffsets, measures, timeSignature, pixelsPerBeat, effectiveLayoutPageWidth, pageOrientation, effectiveLayoutMeasuresPerLine, effectiveLayoutLineBreakBefore, effectiveLayoutPageBreakBefore, layoutSystemGap, layoutGlobalSpacingMultiplier, measureStretchFactors, systemYOffsets, a4PageHeightPx, figurenotesRowHeight, figurenotesTotalRowHeight, figurenotesSize, figurenotesChordBlocks, figurenotesChordLineGap, figurenotesChordLineHeight, scoreHeadBlockReservePx, useManualStaffOffsets]);
  useEffect(() => {
    exportContentBoundsRef.current = { width: basePageWidth, height: logicalContentHeight };
  }, [basePageWidth, logicalContentHeight]);
  const exportLayoutSnapshot = useMemo(() => ({
    source: notationStyle === 'FIGURENOTES' ? 'figurenotes-layout' : 'traditionalMultiStaffGeometry',
    notationStyle,
    staffLineSpanPx,
    interStaffGapPx: traditionalPartsGapPxEffective,
    staffStepPx: traditionalStaffStepPx,
    systemTotalHeightPx: traditionalVisibleGeometry.systemTotalHeightPx,
    visibleStaffCount: visibleStaffList.length > 0 ? visibleStaffList.length : staves.length,
  }), [
    notationStyle,
    staffLineSpanPx,
    traditionalPartsGapPxEffective,
    traditionalStaffStepPx,
    traditionalVisibleGeometry.systemTotalHeightPx,
    visibleStaffList.length,
    staves.length,
  ]);
  useEffect(() => {
    exportLayoutSnapshotRef.current = exportLayoutSnapshot;
  }, [exportLayoutSnapshot]);
  const cursorMeasureIndex = measures.length > 0
    ? (() => {
        const i = measures.findIndex(m => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
        return i >= 0 ? i : Math.max(0, measures.length - 1);
      })()
    : 0;

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const updateHeight = () => { if (el) setMainContentHeight(el.scrollHeight); };
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    updateHeight();
    return () => ro.disconnect();
  }, [measures, layoutMeasuresPerLine, partLayoutMeasuresPerLine, layoutSystemGap, viewMode, pageOrientation, showPageNavigator]);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mainRef.current) setMainContentHeight(mainRef.current.scrollHeight);
      });
    });
    return () => cancelAnimationFrame(t);
  }, [measures, layoutMeasuresPerLine, partLayoutMeasuresPerLine, layoutSystemGap, viewMode, pageOrientation, notes, addedMeasures]);

  // Terve leht: A4 laius + pikkus (210:297 või 297:210). Pikkus = laius × suhe, et üks leht mahuks ekraanile.
  const a4PageHeightVal = effectiveLayoutPageWidth * a4HeightRatio;
  const [fitPageScale, setFitPageScale] = useState(1);
  const fitPageScaleRef = useRef(1);
  useEffect(() => { fitPageScaleRef.current = fitPageScale; }, [fitPageScale]);
  const viewFitOrSmart = viewFitPage || viewSmartPage;
  useEffect(() => {
    if (!viewFitOrSmart) {
      setFitPageScale(1);
      setFitPageDisplayWidth(0);
      return;
    }
    let ro = null;
    let resizeTimeout = null;
    let lateLayoutTimeout = null;
    const updateScale = () => {
      const target = mainRef.current;
      let availW = target?.clientWidth ?? 0;
      let availH = target?.clientHeight ?? 0;
      if (availW <= 0 || availH <= 0) {
        if (viewFitPage && !viewSmartPage && typeof window !== 'undefined') {
          // Fallback: kasuta akent (nt enne kui main on renderdatud või pilvest laadimise ajal)
          availW = window.innerWidth;
          availH = window.innerHeight;
        }
        if (availW <= 0 || availH <= 0) return;
      }
      if (viewFitPage && !viewSmartPage) {
        // MuseScore-style: fixed page size (portrait = tall, landscape = wide), scale so one full page fits in viewport
        const pw = getFullPageLayoutWidth(pageOrientation);
        const ratio = pageOrientation === 'landscape' ? LAYOUT.A4_HEIGHT_RATIO_LANDSCAPE : LAYOUT.A4_HEIGHT_RATIO;
        const pageHeight = pw * ratio;
        setFitPageDisplayWidth(pw);
        setFitPageScale(Math.min(1, availW / pw, availH / pageHeight));
      } else {
        // Tark lehe vaade: ainult noteeritud ala mahub ekraanile
        setFitPageDisplayWidth(0);
        const pw = basePageWidth;
        const contentH = logicalContentHeight || 800;
        const scale = Math.min(1, availW / pw, availH / contentH);
        setFitPageScale(scale);
      }
    };
    const scheduleUpdate = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        updateScale();
      }, 50);
    };
    // Käivita uuesti, kui sisu on valmis (nt pilvest laadimise järel), et mainRef oleks olemas ja mõõdud õiged
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateScale();
        const el = mainRef.current;
        if (el) {
          ro = new ResizeObserver(scheduleUpdate);
          ro.observe(el);
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('resize', scheduleUpdate);
        }
        // Pärast pilvest laadimist layout võib olla alles ehitamas – käivita täislehe arvutus uuesti väikese viivituse järel
        if (cloudLoadComplete && viewFitPage && !viewSmartPage) {
          lateLayoutTimeout = setTimeout(() => {
            updateScale();
          }, 250);
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (lateLayoutTimeout) clearTimeout(lateLayoutTimeout);
      if (ro) ro.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', scheduleUpdate);
      }
    };
  }, [viewFitPage, viewSmartPage, viewFitOrSmart, basePageWidth, logicalContentHeight, cloudLoadComplete, pageOrientation, pageDesignDataUrl]);

  // Zoom noodiala: hiireratas (Ctrl/Cmd), touchpad pinch, iPad pinch, Cmd/Ctrl+/- (handler on klaviatuuril). Only when notation frame has focus (user clicked on score).
  const handleScoreZoomWheel = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && notationFrameFocusedRef.current) {
      e.preventDefault();
      setScoreZoomLevel((prev) => {
        const delta = -e.deltaY * 0.002;
        const next = Math.max(SCORE_ZOOM_MIN, Math.min(SCORE_ZOOM_MAX, prev + delta));
        return Math.round(next * 100) / 100;
      });
    }
  }, []);
  const touchDistance = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  const handleScoreZoomTouchStart = useCallback((e) => {
    if (e.touches.length === 1) setNotationFrameFocused(true); // single touch in notation area = focus for pinch
    if (e.touches.length === 2) {
      scoreZoomPinchRef.current = { initialDistance: touchDistance(e.touches[0], e.touches[1]), initialZoom: scoreZoomLevel };
    }
  }, [scoreZoomLevel]);
  const handleScoreZoomTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && scoreZoomPinchRef.current && notationFrameFocusedRef.current) {
      e.preventDefault();
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const ratio = dist / scoreZoomPinchRef.current.initialDistance;
      const next = Math.max(SCORE_ZOOM_MIN, Math.min(SCORE_ZOOM_MAX, scoreZoomPinchRef.current.initialZoom * ratio));
      setScoreZoomLevel(Math.round(next * 100) / 100);
    }
  }, []);
  const handleScoreZoomTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) scoreZoomPinchRef.current = null;
  }, []);

  useEffect(() => { notationFrameFocusedRef.current = notationFrameFocused; }, [notationFrameFocused]);

  // Pointer down: set notation frame focus when user clicks/taps inside the notation area, clear when outside.
  useEffect(() => {
    const onPointerDown = (e) => {
      const area = notationZoomAreaRef.current;
      if (area && area.contains(e.target)) setNotationFrameFocused(true);
      else setNotationFrameFocused(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  // Document-level wheel (capture) so Mac trackpad pinch is handled when pointer is over notation and notation has focus.
  useEffect(() => {
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const area = notationZoomAreaRef.current;
      if (!area || !area.contains(e.target)) return;
      if (!notationFrameFocusedRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setScoreZoomLevel((prev) => {
        const delta = -e.deltaY * 0.002;
        const next = Math.max(SCORE_ZOOM_MIN, Math.min(SCORE_ZOOM_MAX, prev + delta));
        return Math.round(next * 100) / 100;
      });
    };
    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  const PageSeparatorsOverlay = ({ totalPages, pageWidth, pageHeight, isHorizontal, scrollTop, scrollLeft, viewportW, viewportH, zoom }) => {
    if (!totalPages || totalPages <= 1) return null;
    const safeZoom = Number(zoom) > 0 ? Number(zoom) : 1;
    const vTop = (Number(scrollTop) || 0) / safeZoom;
    const vLeft = (Number(scrollLeft) || 0) / safeZoom;
    const vW = (Number(viewportW) || 0) / safeZoom;
    const vH = (Number(viewportH) || 0) / safeZoom;
    const bufferPages = 2;

    if (isHorizontal) {
      const startPage = Math.max(0, Math.floor(vLeft / pageWidth) - bufferPages);
      const endPage = Math.min(totalPages - 1, Math.ceil((vLeft + vW) / pageWidth) + bufferPages);
      const lines = [];
      for (let p = startPage + 1; p <= endPage; p += 1) {
        lines.push(
          <div key={`sep-v-${p}`} className="nm-page-separator-line-v" style={{ left: p * pageWidth }} />
        );
      }
      return <div aria-hidden="true" className="nm-page-separator-overlay">{lines}</div>;
    }

    const startPage = Math.max(0, Math.floor(vTop / pageHeight) - bufferPages);
    const endPage = Math.min(totalPages - 1, Math.ceil((vTop + vH) / pageHeight) + bufferPages);
    const lines = [];
    for (let p = startPage + 1; p <= endPage; p += 1) {
      lines.push(
        <div key={`sep-h-${p}`} className="nm-page-separator-line-h" style={{ top: p * pageHeight }} />
      );
    }
    return <div aria-hidden="true" className="nm-page-separator-overlay">{lines}</div>;
  };

  // Selection drag (Shift + mouse down and drag across notes) – document-level mouseup ends the drag.
  useEffect(() => {
    const clear = () => {
      if (selectionDragRef.current) selectionDragRef.current = null;
    };
    const onMouseUp = clear;
    const onPointerUp = clear;
    const onBlur = clear;
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerup', onPointerUp);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Hand tool pan: drag on score to scroll main area
  useEffect(() => {
    const onMouseMove = (e) => {
      const r = handPanRef.current;
      if (!r?.active || !mainRef?.current) return;
      mainRef.current.scrollLeft = r.startScrollLeft + (r.startX - e.clientX);
      mainRef.current.scrollTop = r.startScrollTop + (r.startY - e.clientY);
    };
    const onMouseUp = () => {
      handPanRef.current.active = false;
      setIsHandPanning(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const beginSelectionDrag = useCallback((noteIndex, e) => {
    // Allow Shift+drag selection even when N-mode is ON in Figurenotes view,
    // because note input there happens via beat-box clicks rather than arrow keys.
    // With the pointer (select) tool, allow Shift+drag in traditional view too — teachers need range select without turning N off.
    if (noteInputModeRef.current && notationStyle !== 'FIGURENOTES' && cursorToolRef.current !== 'select') return;
    if (!e?.shiftKey) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectionDragRef.current = { startIndex: noteIndex, pointerDown: true, shift: true };
    if (notationStyle !== 'FIGURENOTES') {
      setNoteInputMode(false);
    }
    applySelectionModel({ kind: 'range', anchorIndex: noteIndex, focusIndex: noteIndex });
    // Keep a single truth: selection anchor also sets cursor/playhead.
    setCursorSubRow(0);
    setCursorPosition(getBeatAtNoteIndex(notes, noteIndex));
  }, [notationStyle, getBeatAtNoteIndex, notes, applySelectionModel]);

  const updateSelectionDragHover = useCallback((noteIndex, e) => {
    const drag = selectionDragRef.current;
    if (!drag || !drag.pointerDown || !drag.shift) return;
    // Kui Shift pole enam all (nt kasutaja lasi Shifti lahti enne mouseup'i), lõpeta lohistus,
    // muidu valik "kasvab iseenesest" lihtsalt hiire liikumisel.
    if (e && e.shiftKey === false) {
      selectionDragRef.current = null;
      return;
    }
    e?.stopPropagation?.();
    const current = cursorSelectionRef.current;
    if (current.kind === 'range') {
      applySelectionModel({ kind: 'range', anchorIndex: current.anchorIndex, focusIndex: noteIndex });
    }
    // Keep cursor/playhead synced to the currently hovered end of the selection.
    setCursorSubRow(0);
    setCursorPosition(getBeatAtNoteIndex(notes, noteIndex));
  }, [getBeatAtNoteIndex, notes, applySelectionModel]);

  const handleScoreContentClick = useCallback((e) => {
    if (activeToolbox !== 'textBox') return;
    // Kogu valge noodileht (A4) = scorepage; koordinaadid peavad ühtima tekstikasti overlay’ga (inset scoreContainerRef suhtes).
    const rect = scoreContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `box-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const option = toolboxes.textBox?.options?.[selectedOptionIndex];
    const isTempo = option?.bpm != null || (option?.value && option.value !== 'free');
    const bpm = isTempo && textBoxTempoBpm ? parseInt(textBoxTempoBpm, 10) : option?.bpm;
    const text = isTempo ? (option?.label ?? '') + (bpm ? ` ${bpm} BPM` : '') : (textBoxDraftText || '').trim();
    dirtyRef.current = true;
    setTextBoxes(prev => [...prev, {
      id,
      x,
      y,
      text: text || (isTempo ? option?.label : ''),
      type: isTempo ? 'tempo' : 'text',
      ...(bpm ? { tempoBpm: bpm } : {}),
      fontSize: 14,
      textAlign: 'center',
      width: 200,
      height: 60
    }]);
    if (!isTempo) setTextBoxDraftText('');
    if (isTempo && textBoxTempoBpm) setTextBoxTempoBpm('');
  }, [activeToolbox, selectedOptionIndex, textBoxDraftText, textBoxTempoBpm, toolboxes.textBox?.options]);

  useEffect(() => {
    pageDesignDimensionsRef.current = { pw: effectiveLayoutPageWidth, a4: a4PageHeightVal };
  }, [effectiveLayoutPageWidth, a4PageHeightVal]);

  // Lehe disaini lohistamine (hand tool): lohista taustapilti
  useEffect(() => {
    const onMouseMove = (e) => {
      const d = pageDesignDragRef.current;
      if (!d?.active) return;
      const dim = pageDesignDimensionsRef.current;
      const deltaX = ((e.clientX - d.startX) / (dim.pw || 1)) * 100;
      const deltaY = ((e.clientY - d.startY) / (dim.a4 || 1)) * 100;
      setPageDesignPositionX(clampNumber(d.startPosX + deltaX, 0, 100));
      setPageDesignPositionY(clampNumber(d.startPosY + deltaY, 0, 100));
    };
    const onMouseUp = () => {
      if (pageDesignDragRef.current?.active) {
        pageDesignDragRef.current = null;
        dirtyRef.current = true;
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    dualToolboxSplitFractionRef.current = dualToolboxRhythmFraction;
  }, [dualToolboxRhythmFraction]);

  useEffect(() => {
    const onMove = (e) => {
      const d = dualToolboxSplitDragRef.current;
      if (!d) return;
      const w = d.width;
      if (w <= 10) return;
      const delta = (e.clientX - d.startX) / w;
      const next = Math.min(0.78, Math.max(0.22, d.startRatio + delta));
      dualToolboxSplitFractionRef.current = next;
      setDualToolboxRhythmFraction(next);
    };
    const onUp = () => {
      if (!dualToolboxSplitDragRef.current) return;
      dualToolboxSplitDragRef.current = null;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('nm:dualToolboxRhythmFraction', String(dualToolboxSplitFractionRef.current));
        }
      } catch (_) { /* ignore */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Text box drag (move) and resize: document-level mousemove/mouseup
  useEffect(() => {
    const onMouseMove = (e) => {
      const state = textboxInteractionRef.current;
      const dragStart = textboxDragStartRef.current;
      if (dragStart && !state) {
        const dist = Math.hypot(e.clientX - dragStart.startX, e.clientY - dragStart.startY);
        if (dist > 5) {
          textboxInteractionRef.current = { type: 'move', id: dragStart.id, startX: dragStart.startX, startY: dragStart.startY, boxStartX: dragStart.boxStartX, boxStartY: dragStart.boxStartY };
          textboxDragStartRef.current = null;
        }
      }
      const current = textboxInteractionRef.current;
      if (!current || !scoreContainerRef.current) return;
      if (current.type === 'move') {
        const dx = e.clientX - current.startX;
        const dy = e.clientY - current.startY;
        setTextBoxes((prev) => prev.map((b) => b.id === current.id ? { ...b, x: current.boxStartX + dx, y: current.boxStartY + dy } : b));
      } else if (current.type === 'resize' && current.handle) {
        const dx = e.clientX - current.startX;
        const dy = e.clientY - current.startY;
        const minW = 60;
        const minH = 30;
        let { x, y, width, height } = { x: current.boxStartX, y: current.boxStartY, width: current.boxStartW, height: current.boxStartH };
        switch (current.handle) {
          case 'n':
            y = current.boxStartY + dy;
            height = Math.max(minH, current.boxStartH - dy);
            break;
          case 's':
            height = Math.max(minH, current.boxStartH + dy);
            break;
          case 'e':
            width = Math.max(minW, current.boxStartW + dx);
            break;
          case 'w':
            x = current.boxStartX + dx;
            width = Math.max(minW, current.boxStartW - dx);
            break;
          case 'se':
            width = Math.max(minW, current.boxStartW + dx);
            height = Math.max(minH, current.boxStartH + dy);
            break;
          case 'sw':
            x = current.boxStartX + dx;
            width = Math.max(minW, current.boxStartW - dx);
            height = Math.max(minH, current.boxStartH + dy);
            break;
          case 'ne':
            y = current.boxStartY + dy;
            width = Math.max(minW, current.boxStartW + dx);
            height = Math.max(minH, current.boxStartH - dy);
            break;
          case 'nw':
            x = current.boxStartX + dx;
            y = current.boxStartY + dy;
            width = Math.max(minW, current.boxStartW - dx);
            height = Math.max(minH, current.boxStartH - dy);
            break;
          default:
            break;
        }
        setTextBoxes((prev) => prev.map((b) => b.id === current.id ? { ...b, x, y, width, height } : b));
      }
    };
    const onMouseUp = () => {
      const dragStart = textboxDragStartRef.current;
      if (dragStart && !textboxInteractionRef.current) {
        setSelectedTextboxId(dragStart.id);
        setActiveTextLineType(null);
        textboxDragStartRef.current = null;
      }
      if (textboxInteractionRef.current) {
        textboxInteractionRef.current = null;
        dirtyRef.current = true;
      }
      textboxDragStartRef.current = null;
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Position the floating text tool popup near the active text (title, author, or selected text box)
  const updateTextToolPosition = useCallback(() => {
    const box = selectedTextboxId ? textBoxes.find((b) => b.id === selectedTextboxId) : null;
    if (activeTextLineType === 'title' && titleInputRef.current) {
      const r = titleInputRef.current.getBoundingClientRect();
      setTextToolPosition({ top: r.bottom + 8, left: r.left + (r.width / 2) - 140 });
    } else if (activeTextLineType === 'author' && authorInputRef.current) {
      const r = authorInputRef.current.getBoundingClientRect();
      setTextToolPosition({ top: r.bottom + 8, left: r.left + (r.width / 2) - 140 });
    } else if (box && scoreContainerRef.current) {
      const cr = scoreContainerRef.current.getBoundingClientRect();
      const w = box.width ?? 200;
      const h = box.height ?? 60;
      setTextToolPosition({
        top: cr.top + box.y + h + 8,
        left: cr.left + box.x + Math.max(0, (w / 2) - 140),
      });
    }
  }, [activeTextLineType, selectedTextboxId, textBoxes]);

  useLayoutEffect(() => {
    if (!activeTextLineType && !selectedTextboxId) return;
    updateTextToolPosition();
    const main = mainRef.current;
    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateTextToolPosition();
      });
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    if (main) main.addEventListener('scroll', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      if (main) main.removeEventListener('scroll', onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [activeTextLineType, selectedTextboxId, textBoxes, updateTextToolPosition]);

  // Close text tool when user clicks outside: on score/sheet music or anywhere not on a text line / popup / text box
  useEffect(() => {
    if (!activeTextLineType && !selectedTextboxId) return;
    const onMouseDown = (e) => {
      if (e.target.closest('[data-text-tool-popup]')) return;
      if (titleInputRef.current && titleInputRef.current.contains(e.target)) return;
      if (authorInputRef.current && authorInputRef.current.contains(e.target)) return;
      if (e.target.closest('[data-textbox-id]')) return;
      setActiveTextLineType(null);
      setSelectedTextboxId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [activeTextLineType, selectedTextboxId]);

  const completeSetup = useCallback((style) => {
    setNotationStyle(style);
    setNotationMode(style === 'FIGURENOTES' ? 'figurenotes' : 'traditional');
    if (layoutMeasuresPerLine === 0) setLayoutMeasuresPerLine(4);
    setSetupCompleted(true);
    try {
      const state = getPersistedState();
      state.setupCompleted = true;
      state.notationStyle = style;
      state.notationMode = style === 'FIGURENOTES' ? 'figurenotes' : 'traditional';
      if (layoutMeasuresPerLine === 0) state.layoutMeasuresPerLine = 4;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* ignore */ }
  }, [getPersistedState, layoutMeasuresPerLine]);

  const TIME_SIGNATURE_PRESETS = [
    { label: '4/4', value: [4, 4] },
    { label: '3/4', value: [3, 4] },
    { label: '2/4', value: [2, 4] },
    { label: '6/8', value: [6, 8] },
    { label: '5/4', value: [5, 4] }
  ];

  const waitingForCloud = driveFileId && !cloudLoadComplete;
  if (!isReady) return <div className="loading-screen min-h-screen flex items-center justify-center bg-amber-950 text-amber-100"><span className="animate-pulse">Laen süsteemi...</span></div>;
  if (waitingForCloud) return <div className="loading-screen min-h-screen flex items-center justify-center bg-amber-950 text-amber-100"><span className="animate-pulse">{saveFeedback || 'Laadin pilvest…'}</span></div>;
  if (!icons) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-900/95 text-amber-100">
        {t('loading.tools')}
      </div>
    );
  }
  const { Music2, Clock, Hash, Type, Piano, Palette, Layout, Check, Save, FolderOpen, Plus, Settings, Key, Repeat, Cloud, LogOut, LogIn, UserPlus, User, CloudUpload, CloudDownload, FolderPlus, ChevronDown, Eye, ArrowDown, ArrowRight, Hand, MousePointer, Keyboard, ExternalLink } = icons || {};

  const showFloatingTextTool = (activeTextLineType === 'title' || activeTextLineType === 'author') || selectedTextboxId;
  const activeBox = selectedTextboxId ? textBoxes.find((b) => b.id === selectedTextboxId) : null;
  const floatingTextToolPopup = showFloatingTextTool && createPortal(
    <div
      data-text-tool-popup
      className="fixed z-[100] flex flex-col gap-2 p-3 rounded-xl shadow-xl border-2 border-amber-300 bg-white dark:bg-zinc-900 dark:border-amber-600 w-[280px]"
      style={{ top: textToolPosition.top, left: Math.max(8, textToolPosition.left) }}
      role="dialog"
      aria-label={t('textTool.title')}
    >
      <div className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
        {activeTextLineType === 'title' ? t('textTool.forTitle') : activeTextLineType === 'author' ? t('textTool.forAuthor') : t('textTool.forTextBox')}
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">{t('textTool.font')}</label>
        <select
          value={activeTextLineType === 'title' ? (titleFontFamily || documentFontFamily) : activeTextLineType === 'author' ? (authorFontFamily || documentFontFamily) : (activeBox?.fontFamily || documentFontFamily)}
          onChange={(e) => {
            const v = e.target.value;
            dirtyRef.current = true;
            if (activeTextLineType === 'title') setTitleFontFamily(v);
            else if (activeTextLineType === 'author') setAuthorFontFamily(v);
            else if (activeBox) setTextBoxes((prev) => prev.map((b) => b.id === activeBox.id ? { ...b, fontFamily: v } : b));
          }}
          className="w-full px-2 py-1.5 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-zinc-800 text-amber-900 dark:text-white text-sm"
          style={{ fontFamily: activeTextLineType === 'title' ? (titleFontFamily || documentFontFamily) : activeTextLineType === 'author' ? (authorFontFamily || documentFontFamily) : (activeBox?.fontFamily || documentFontFamily) }}
        >
          {getFontOptionElements(t)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">{t('textTool.fontSize')}</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={activeTextLineType === 'author' ? 8 : 10}
            max={200}
            step={1}
            value={activeTextLineType === 'title' ? titleFontSize : activeTextLineType === 'author' ? authorFontSize : (activeBox?.fontSize ?? 14)}
            onChange={(e) => {
              const minVal = activeTextLineType === 'author' ? 8 : 10;
              const v = Math.max(minVal, Math.min(200, Number(e.target.value)));
              dirtyRef.current = true;
              if (activeTextLineType === 'title') setTitleFontSize(v);
              else if (activeTextLineType === 'author') setAuthorFontSize(v);
              else if (activeBox) setTextBoxes((prev) => prev.map((b) => b.id === activeBox.id ? { ...b, fontSize: v } : b));
            }}
            className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 dark:bg-amber-800 accent-amber-600"
          />
          <span className="text-xs font-medium text-amber-800 dark:text-amber-200 w-8 tabular-nums text-right">
            {activeTextLineType === 'title' ? titleFontSize : activeTextLineType === 'author' ? authorFontSize : (activeBox?.fontSize ?? 14)}
          </span>
        </div>
        {/* Ruler: tick marks for font size */}
        <div className="flex justify-between mt-0.5 px-0.5 text-[9px] text-amber-600 dark:text-amber-400 select-none pointer-events-none">
          {[10, 20, 30, 40, 50, 60, 72, 100, 150, 200]
            .filter((n) => n >= (activeTextLineType === 'author' ? 8 : 10) && n <= 200)
            .map((n) => (
              <span key={n}>{n}</span>
            ))}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mr-1">{t('textTool.style')}</span>
        {['bold', 'italic'].map((style) => {
          const isBold = style === 'bold';
          const active = activeTextLineType === 'title'
            ? (isBold ? titleBold : titleItalic)
            : activeTextLineType === 'author'
              ? (isBold ? authorBold : authorItalic)
              : (activeBox && (isBold ? (activeBox.fontWeight === 'bold') : (activeBox.fontStyle === 'italic')));
          return (
            <button
              key={style}
              type="button"
              onClick={() => {
                dirtyRef.current = true;
                if (activeTextLineType === 'title') {
                  if (isBold) setTitleBold(!titleBold); else setTitleItalic(!titleItalic);
                } else if (activeTextLineType === 'author') {
                  if (isBold) setAuthorBold(!authorBold); else setAuthorItalic(!authorItalic);
                } else if (activeBox) {
                  setTextBoxes((prev) => prev.map((b) => b.id === activeBox.id
                    ? { ...b, [isBold ? 'fontWeight' : 'fontStyle']: active ? '' : (isBold ? 'bold' : 'italic') }
                    : b));
                }
              }}
              className={`px-2 py-1 rounded text-xs font-medium ${active ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-zinc-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-zinc-600'}`}
              style={isBold ? { fontWeight: 'bold' } : { fontStyle: 'italic' }}
              title={isBold ? t('textTool.bold') : t('textTool.italic')}
            >
              {isBold ? 'B' : 'I'}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--bg-color)]">
      {demoVisibility && (
        <div className="flex-shrink-0 z-40 border-b-2 border-amber-400 bg-amber-100 dark:bg-amber-950/90 dark:border-amber-600 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <span className="font-semibold">Demo: noodigraafika nähtavus</span>
          <span className="text-amber-800 dark:text-amber-200/90 mx-2">—</span>
          <span className="font-medium text-amber-900 dark:text-amber-100">Reziimi muutmine asub File menüüs.</span>
        </div>
      )}
      {floatingTextToolPopup}
      {/* New Project Setup Wizard – overlay until mode selected */}
      {!setupCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-950/80 dark:bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border-2 border-amber-200 dark:border-white/20">
            <div className="bg-gradient-to-r from-amber-700 to-amber-600 dark:from-amber-800 dark:to-amber-900 text-white px-8 py-6">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Uus projekt</h1>
              <p className="text-amber-100 text-sm mt-1">Vali notatsiooni stiil ja täida väljad</p>
            </div>
            <div className="p-8 space-y-6 dark:text-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Loo pealkiri</label>
                  <input
                    type="text"
                    value={songTitle}
                    onChange={(e) => { dirtyRef.current = true; setSongTitle(e.target.value); }}
                    placeholder="Nimetu"
                    className="w-full px-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-zinc-900 text-amber-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-amber-500 dark:focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Autor / helilooja</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => { dirtyRef.current = true; setAuthor(e.target.value); }}
                    placeholder="Helilooja nimi"
                    className="w-full px-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-zinc-900 text-amber-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-amber-500 dark:focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Copyright (jalus)</label>
                <input
                  type="text"
                  value={copyrightFooter}
                  onChange={(e) => { dirtyRef.current = true; setCopyrightFooter(e.target.value); }}
                  placeholder="© 2026 Sinu nimi"
                  className="w-full px-4 py-2 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-zinc-900 text-amber-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-amber-500 dark:focus:border-amber-500"
                />
                <p className="text-xs text-amber-700 dark:text-white/70 mt-1">Ilmub igal lehel PDF eelvaates, ekspordis ja printimisel.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Taktimõõt</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TIME_SIGNATURE_PRESETS.map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setTimeSignature({ beats: value[0], beatUnit: value[1] })}
                      className={`px-3 py-1.5 rounded-lg font-medium border-2 transition-colors ${timeSignature.beats === value[0] && timeSignature.beatUnit === value[1] ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-200 text-amber-900 hover:bg-amber-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-amber-800 dark:text-white">Kohandatud:</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_NUMERATOR}
                    value={timeSignature.beats}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(MAX_NUMERATOR, parseInt(e.target.value, 10) || 1));
                      setTimeSignature(prev => ({ ...prev, beats: v }));
                    }}
                    className="w-16 px-2 py-1.5 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-zinc-900 text-amber-900 dark:text-white text-center font-medium"
                  />
                  <span className="text-amber-800 dark:text-white">/</span>
                  <select
                    value={VALID_DENOMINATORS.includes(timeSignature.beatUnit) ? timeSignature.beatUnit : 4}
                    onChange={(e) => setTimeSignature(prev => ({ ...prev, beatUnit: Number(e.target.value) }))}
                    className="px-3 py-1.5 rounded-lg border-2 border-amber-200 dark:border-white/30 bg-amber-50 dark:bg-zinc-900 text-amber-900 dark:text-white font-medium"
                  >
                    {VALID_DENOMINATORS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Taktide paigutus</label>
                <p className="text-sm text-amber-700 dark:text-white/80 mb-2">Mitu takti soovite vaikimisi ühe rea kohta? (Saate hiljem muuta tööriistakastis Paigutus.)</p>
                <div className="flex flex-wrap items-center gap-3">
                  {(pageOrientation === 'landscape' ? [2, 4, 6, 8, 12, 16] : [2, 3, 4, 6, 8]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLayoutMeasuresPerLine(n)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${layoutMeasuresPerLine === n ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                    >
                      {n} takti / rida
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickupEnabled}
                    onChange={(e) => setPickupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-semibold text-amber-900">Eeltakt</span>
                </label>
                {pickupEnabled && (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-amber-900">Kogus:</label>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={pickupQuantity}
                        onChange={(e) => setPickupQuantity(Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 1)))}
                        className="w-14 px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-amber-900">Kestus:</label>
                      <select
                        value={pickupDuration}
                        onChange={(e) => setPickupDuration(e.target.value)}
                        className="px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium"
                      >
                        <option value="1/1">1/1 (täisnoot)</option>
                        <option value="1/2">1/2 (poolnoot)</option>
                        <option value="1/4">1/4 (neljandik)</option>
                        <option value="1/8">1/8 (kaheksandik)</option>
                        <option value="1/16">1/16 (kuueteistkümnendik)</option>
                        <option value="1/32">1/32 (kuuskümnendik)</option>
                      </select>
                    </div>
                    <span className="text-xs text-amber-700">nt. 1 × 1/8 = üks kaheksandiknoot eeltaktis</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => completeSetup('TRADITIONAL')}
                  className="group flex flex-col items-center justify-center p-6 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:shadow-lg transition-all duration-200 text-left"
                >
                  <span className="text-4xl mb-3 opacity-90">𝄞</span>
                  <span className="font-bold text-amber-900 text-lg">Traditsiooniline notatsioon</span>
                  <span className="text-sm text-amber-700 mt-2 text-center">Tavaline 5-realise noodistiku notatsioon.</span>
                </button>
                <button
                  onClick={() => completeSetup('FIGURENOTES')}
                  className="group flex flex-col items-center justify-center p-6 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:shadow-lg transition-all duration-200 text-left"
                >
                  <span className="w-12 h-12 rounded-full bg-amber-400 group-hover:bg-amber-500 mb-3 flex items-center justify-center text-amber-900 font-bold text-lg">C</span>
                  <span className="font-bold text-amber-900 text-lg">Figuurnotatsioon</span>
                  <span className="text-sm text-amber-700 mt-2 text-center">Värvide ja kujundite põhine noodiõppe vaade.</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uue töö seadistuse dialoog – notatsioon, taktimõõt, loo nimi, autor jne */}
      {newWorkSetupOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/70 dark:bg-black/70 backdrop-blur-sm p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-work-dialog-title"
          onClick={() => { setNewWorkSetupOpen(false); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('new'); return next; }); }}
        >
          <div className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border-2 border-amber-200 dark:border-white/20 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h2 id="new-work-dialog-title" className="text-lg font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> Uue töö seadistus</h2>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-amber-900">Täida väljad uue nooditöö jaoks. Kõik vajalikud seaded saad hiljem muuta menüüst Seaded.</p>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-2">Notatsiooni meetod</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'traditional'} onChange={() => setWizardNotationMethod('traditional')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Traditsiooniline notatsioon</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'figurenotes'} onChange={() => setWizardNotationMethod('figurenotes')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Figuurnotatsioon (värvid ja kujundid)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-300 bg-amber-50/60 hover:bg-amber-100 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'pedagogical'} onChange={() => setWizardNotationMethod('pedagogical')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">
                      Pedagoogiline notatsioon
                      <span className="block text-xs font-normal text-amber-800">
                        Kodály JO-võti, TAB / sõrmitsus vaated ja animeeritav materjal salvestatud muusikaga.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">Helistik</label>
                <p className="text-xs text-amber-700 mb-2">
                  {wizardNotationMethod === 'traditional' && 'Traditsioonilises notatsioonis kuvatakse võtmemärgid (♯ diees, ♭ bemoll).'}
                  {wizardNotationMethod === 'figurenotes' && 'Figuurnotatsioonis noodi sisestus reageerib helistikule: dieesiga toonid (nt D-duur F♯, C♯) = diagonaal paremale üles, bemoliga toonid (nt B-duur E♭, B♭) = diagonaal vasakule üles.'}
                  {wizardNotationMethod === 'pedagogical' && 'Pedagoogilises režiimis JO-võti asetatakse notatsioonivaates vastavalt helistiku toonika asukohale.'}
                </p>
                <select
                  value={wizardKeySignature}
                  onChange={(e) => setWizardKeySignature(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                >
                  {['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb'].map((keyVal) => (
                    <option key={keyVal} value={keyVal}>{t('key.' + keyVal)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-2">Taktimõõt</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[[4, 4], [3, 4], [2, 4], [6, 8], [5, 4], [7, 8], [12, 8]].map(([beats, unit]) => {
                    const sel = wizardTimeSignature[0] === beats && wizardTimeSignature[1] === unit;
                    return (
                      <button
                        key={`${beats}/${unit}`}
                        type="button"
                        onClick={() => setWizardTimeSignature([beats, unit])}
                        className={`px-4 py-2 rounded-lg font-medium border-2 transition-colors ${sel ? 'bg-amber-500 border-amber-600 text-white' : 'border-amber-200 text-amber-900 hover:bg-amber-100'}`}
                      >
                        {beats}/{unit}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-amber-800">Kohandatud:</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_NUMERATOR}
                    value={wizardTimeSignature[0]}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(MAX_NUMERATOR, parseInt(e.target.value, 10) || 1));
                      setWizardTimeSignature(prev => [v, prev[1]]);
                    }}
                    className="w-16 px-2 py-1.5 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 text-center font-medium"
                  />
                  <span className="text-amber-800">/</span>
                  <select
                    value={VALID_DENOMINATORS.includes(wizardTimeSignature[1]) ? wizardTimeSignature[1] : 4}
                    onChange={(e) => setWizardTimeSignature(prev => [prev[0], Number(e.target.value)])}
                    className="px-3 py-1.5 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium"
                  >
                    {VALID_DENOMINATORS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">Loo nimi</label>
                <input
                  type="text"
                  value={wizardSongTitle}
                  onChange={(e) => setWizardSongTitle(e.target.value)}
                  placeholder="Nimetu"
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">Autori nimi</label>
                <input
                  type="text"
                  value={wizardAuthor}
                  onChange={(e) => setWizardAuthor(e.target.value)}
                  placeholder="Autor või helilooja"
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">{t('toolbox.instruments')}</label>
                <select
                  value={wizardInstrument}
                  onChange={(e) => setWizardInstrument(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                >
                  {INSTRUMENT_CATEGORIES.map((cat) => (
                    <optgroup key={cat.id} label={t(cat.labelKey)}>
                      {cat.instruments.map((instId) => {
                        const cfg = instrumentConfig[instId];
                        if (!cfg) return null;
                        return <option key={instId} value={instId}>{cfg.label}</option>;
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="border-t border-amber-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={wizardPickupEnabled}
                    onChange={(e) => setWizardPickupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">Eeltakt</span>
                </label>
                {wizardPickupEnabled && (
                  <div className="flex flex-wrap items-center gap-3 ml-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-800">Kogus:</span>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={wizardPickupQuantity}
                        onChange={(e) => setWizardPickupQuantity(Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 1)))}
                        className="w-12 px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-800">Kestus:</span>
                      <select
                        value={wizardPickupDuration}
                        onChange={(e) => setWizardPickupDuration(e.target.value)}
                        className="px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                      >
                        <option value="1/1">1/1</option>
                        <option value="1/2">1/2</option>
                        <option value="1/4">1/4</option>
                        <option value="1/8">1/8</option>
                        <option value="1/16">1/16</option>
                        <option value="1/32">1/32</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 pt-0 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={applyNewWorkSetup}
                className="flex-1 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 transition-colors"
              >
                Loo töö
              </button>
              <button
                type="button"
                onClick={() => { setNewWorkSetupOpen(false); setSearchParams({}); }}
                className="px-4 py-3 rounded-lg border-2 border-amber-300 text-amber-800 font-medium hover:bg-amber-50"
              >
                Tühista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Preview – zoom, ruler, save location */}
      {showPdfExportPreview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowPdfExportPreview(false); setPdfPreviewZoom(1); setPdfPreviewPageSvgHtml(''); setPdfPreviewPageIndex(0); }}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border-2 border-amber-200 dark:border-white/20 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('file.exportPdf')} – {t('file.exportPdfTitle') || 'Preview'}</h2>
              <button type="button" onClick={() => { setShowPdfExportPreview(false); setPdfPreviewZoom(1); setPdfPreviewPageSvgHtml(''); setPdfPreviewPageIndex(0); }} className="text-white/90 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Eksporditud PDF ja trükk on täpselt <strong>A4 (210×297 mm)</strong>. Noodid jäävad selle raami sisse; üle ääre ei lähe ega jää põhjendamatult väikeseks. Kontrolli eelvaates, et sisu sobib.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-amber-900 dark:text-white">Zoom:</span>
                <button type="button" onClick={() => setPdfPreviewZoom(z => Math.max(0.25, z - 0.25))} className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-sm font-medium">−</button>
                <button type="button" onClick={handlePdfPreviewFit} className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-sm font-medium">Mahuta</button>
                <button type="button" onClick={() => setPdfPreviewZoom(z => Math.min(2.5, z + 0.25))} className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-sm font-medium">+</button>
                <label className="flex items-center gap-2">
                  <span className="sr-only">Eelvaate suum protsentides</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={25}
                    max={250}
                    step={1}
                    value={Math.round(pdfPreviewZoom * 100)}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!Number.isFinite(raw)) return;
                      const clamped = Math.max(25, Math.min(250, raw));
                      setPdfPreviewZoom(Math.round((clamped / 100) * 100) / 100);
                    }}
                    className="w-20 px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 text-sm font-medium tabular-nums"
                    aria-label="Eelvaate suum (%)"
                  />
                  <span className="text-sm text-amber-800 dark:text-amber-200">%</span>
                </label>
                <span className="text-sm text-amber-800 dark:text-amber-200 tabular-nums">{Math.round(pdfPreviewZoom * 100)}%</span>
              </div>
              {pdfPreviewSvgData && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-amber-900 dark:text-white">Leht:</span>
                  <button
                    type="button"
                    disabled={pdfPreviewPageIndex <= 0}
                    onClick={() => setPdfPreviewPageIndex((p) => Math.max(0, (Number(p) || 0) - 1))}
                    className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <select
                    value={pdfPreviewPageIndex}
                    onChange={(e) => setPdfPreviewPageIndex(Math.max(0, Number(e.target.value) || 0))}
                    className="px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 text-sm font-medium"
                    aria-label="Vali lehekülg"
                  >
                    {Array.from({ length: Math.max(1, pdfPreviewTotalPages || 1) }, (_, i) => (
                      <option key={i} value={i}>Leht {i + 1} / {Math.max(1, pdfPreviewTotalPages || 1)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pdfPreviewPageIndex >= Math.max(1, (pdfPreviewTotalPages || 1)) - 1}
                    onClick={() => setPdfPreviewPageIndex((p) => Math.min(Math.max(1, (pdfPreviewTotalPages || 1)) - 1, (Number(p) || 0) + 1))}
                    className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-amber-900 dark:text-white self-start">Eelvaade = SVG (sama viewBox ja paberi suurus mis PDF/print; A3/A4/A5 + suund). Eksport vektorina.</span>
                <button type="button" onClick={() => setPdfPreviewCaptureKey(k => k + 1)} className="self-start px-2 py-1 rounded text-sm font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800/50" title="Tee uus pilt noodilehest">Värskenda eelvaadet</button>
                <div
                  ref={pdfPreviewContainerRef}
                  className="relative bg-white dark:bg-gray-100 rounded-sm shadow-lg box-border"
                  style={{
                    width: '100%',
                    maxWidth: getScorePageDimensions(
                      pdfPreviewSvgData?.orientation === 'landscape' ? 'landscape' : pageOrientation,
                      pdfPreviewSvgData?.paperSize || paperSize
                    ).width,
                    aspectRatio: (pdfPreviewSvgData?.orientation === 'landscape' ? 'landscape' : pageOrientation) === 'landscape' ? '297/210' : '210/297',
                    border: '3px solid #b45309',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                  }}
                >
                  {/* Eelvaate zoom: 100% = noodileht täidab raami; <100% vähendab, >100% suurendab (keritav). Programmi zoom ei mõjuta eelvaate sisu (pildistatakse A4 1:1). Üleval joondus = sama mis PDF/jsPDF ja brauseri print (mitte vertikaalne tsentreerimine). */}
                  {pdfPreviewPageSvgHtml ? (
                    <div
                      className="box-border flex-shrink-0 flex items-start justify-start w-full"
                      style={{
                        width: `${pdfPreviewZoom * 100}%`,
                        height: `${pdfPreviewZoom * 100}%`,
                        minWidth: 0,
                        minHeight: 0,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <div
                        key={`pdf-prev-${pdfPreviewPageIndex}-${pdfPreviewCaptureKey}`}
                        className="w-full max-w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:block [&>svg]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: pdfPreviewPageSvgHtml }}
                        aria-label="PDF preview"
                      />
                    </div>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-600 text-sm">
                      {pdfPreviewError ? `Preview error: ${pdfPreviewError}` : 'Loading preview…'}
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-200/95 dark:bg-amber-800/95 text-amber-900 dark:text-amber-100 pointer-events-none" aria-hidden="true">
                    A4 {(pdfPreviewSvgData?.orientation === 'landscape' ? 'landscape' : pageOrientation) === 'landscape' ? '297×210' : '210×297'} mm
                  </span>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-amber-900 dark:text-white block mb-2">Save location:</span>
                <label className="flex items-center gap-2 cursor-pointer mb-1">
                  <input type="radio" name="pdfSaveLocation" checked={pdfExportSaveLocation === 'downloads'} onChange={() => { setPdfExportSaveLocation('downloads'); setPdfExportFileHandle(null); setPdfExportChosenPath(''); }} />
                  <span className="text-sm">Downloads folder (default)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="pdfSaveLocation" checked={pdfExportSaveLocation === 'custom'} onChange={() => {}} />
                  <span className="text-sm">Choose location…</span>
                </label>
                <button type="button" onClick={handlePdfExportChooseLocation} className="mt-2 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 text-sm font-medium border border-amber-300 dark:border-amber-600">
                  {pdfExportChosenPath ? pdfExportChosenPath : 'Pick file (e.g. Desktop)…'}
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-amber-200 dark:border-white/20 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowPdfExportPreview(false); setPdfPreviewZoom(1); setPdfPreviewPageSvgHtml(''); setPdfPreviewPageIndex(0); }} className="px-4 py-2 rounded-lg border-2 border-amber-300 text-amber-800 dark:text-amber-200 font-medium hover:bg-amber-50 dark:hover:bg-amber-900/30">
                Cancel
              </button>
              <button
                type="button"
                disabled={isExportingPdf || !pdfPreviewSvgData}
                onClick={async () => {
                  await printFromPdfPreview();
                  setShowPdfExportPreview(false);
                  setHeaderMenuOpen(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white font-semibold hover:bg-slate-600 disabled:opacity-60"
                title={t('file.printTitle') || 'Open print dialog'}
              >
                {t('file.print') || 'Print'}
              </button>
              <button
                type="button"
                disabled={isExportingPdf || !pdfPreviewSvgData}
                onClick={async () => {
                  const opts = pdfExportSaveLocation === 'custom' && pdfExportFileHandle ? { fileHandle: pdfExportFileHandle } : {};
                  await exportToPdf({
                    ...opts,
                    usePreviewSvg: !!pdfPreviewSvgData,
                    previewSvgData: pdfPreviewSvgData || undefined,
                    usePreviewImage: !pdfPreviewSvgData,
                    previewSize: pdfPreviewSize,
                  });
                  setShowPdfExportPreview(false);
                  setHeaderMenuOpen(null);
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 disabled:opacity-60"
              >
                {isExportingPdf ? 'Exporting…' : t('file.exportPdf')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal – Title, Author, Pickup (post-setup editing) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-4 sm:p-6" onClick={() => setSettingsOpen(false)}>
          <div
            className="bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-sm max-h-[50vh] overflow-hidden border-2 border-amber-200 dark:border-white/20 flex flex-col"
            style={{ transform: `translate(${settingsDragOffset.x}px, ${settingsDragOffset.y}px)` }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between cursor-move select-none"
              onPointerDown={(e) => {
                // Ainult vasak nupp hiirel; puute/pencil puhul nuppu ei kontrolli
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                settingsDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  originX: settingsDragOffset.x,
                  originY: settingsDragOffset.y,
                };
              }}
            >
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Seaded</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-white/90 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 p-4 sm:p-6 space-y-4 dark:text-white overflow-y-auto">
              {/* Teema: põhivärv ja režiim (hele/tume) */}
              <div className="border-b border-amber-200 dark:border-white/20 pb-4">
                <h3 className="text-sm font-bold text-amber-900 dark:text-white mb-2">{t('theme.title')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">{t('theme.primaryColor')}</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'orange', label: t('theme.orange') },
                        { value: 'blue', label: t('theme.blue') },
                        { value: 'green', label: t('theme.green') },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { dirtyRef.current = true; setThemePrimaryColor(opt.value); }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                            themePrimaryColor === opt.value
                              ? 'border-amber-600 bg-amber-100 text-amber-900'
                              : 'border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100'
                          }`}
                          style={themePrimaryColor === opt.value && opt.value === 'orange' ? { borderColor: '#FF8C00', backgroundColor: 'rgba(255,140,0,0.15)' } : themePrimaryColor === opt.value && opt.value === 'blue' ? { borderColor: '#007BFF', backgroundColor: 'rgba(0,123,255,0.15)' } : themePrimaryColor === opt.value && opt.value === 'green' ? { borderColor: '#28A745', backgroundColor: 'rgba(40,167,69,0.15)' } : {}}
                        >
                          <span className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle" style={{
                            backgroundColor: opt.value === 'orange' ? '#FF8C00' : opt.value === 'blue' ? '#007BFF' : '#28A745',
                          }} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">{t('theme.mode')}</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { dirtyRef.current = true; setThemeMode('light'); }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${themeMode === 'light' ? 'bg-amber-600 border-amber-700 text-white' : 'border-amber-200 dark:border-white/30 text-amber-900 dark:text-white bg-amber-50 dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800'}`}
                      >
                        {t('theme.light')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { dirtyRef.current = true; setThemeMode('dark'); }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${themeMode === 'dark' ? 'bg-amber-600 border-amber-700 text-white' : 'border-amber-200 dark:border-white/30 text-amber-900 dark:text-white bg-amber-50 dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800'}`}
                      >
                        {t('theme.dark')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">Loo pealkiri</label>
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => { dirtyRef.current = true; setSongTitle(e.target.value); }}
                  placeholder="Nimetu"
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">Autor / helilooja</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => { dirtyRef.current = true; setAuthor(e.target.value); }}
                  placeholder="Helilooja nimi"
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                />
              </div>
              <div>
                <span className="block text-sm font-semibold text-amber-900 mb-1">{t('layout.titleAlignment')}</span>
                <div className="flex gap-2">
                  {(['left', 'center', 'right']).map((align) => (
                    <button key={align} type="button" onClick={() => { dirtyRef.current = true; setTitleAlignment(align); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${titleAlignment === align ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{align === 'left' ? t('layout.alignLeft') : align === 'center' ? t('layout.alignCenter') : t('layout.alignRight')}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-sm font-semibold text-amber-900 mb-1">{t('layout.authorAlignment')}</span>
                <div className="flex gap-2">
                  {(['left', 'center', 'right']).map((align) => (
                    <button key={align} type="button" onClick={() => { dirtyRef.current = true; setAuthorAlignment(align); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${authorAlignment === align ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{align === 'left' ? t('layout.alignLeft') : align === 'center' ? t('layout.alignCenter') : t('layout.alignRight')}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarNumbers}
                    onChange={(e) => { dirtyRef.current = true; setShowBarNumbers(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">{t('settings.barNumbers')}</span>
                </label>
                {showBarNumbers && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-amber-200">
                    <label htmlFor="bar-number-size" className="text-sm font-semibold text-amber-900 whitespace-nowrap">{t('settings.barNumberSize')}</label>
                    <input
                      id="bar-number-size"
                      type="range"
                      min={8}
                      max={200}
                      value={barNumberSize}
                      onChange={(e) => { dirtyRef.current = true; setBarNumberSize(Math.max(8, Math.min(200, Number(e.target.value)))); }}
                      className="w-24 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                    />
                    <span className="text-xs text-amber-800 w-6 tabular-nums">{barNumberSize}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="notation-number-of-bars" className="text-sm font-semibold text-amber-900 whitespace-nowrap">{t('settings.numberOfBars')}</label>
                <input
                  id="notation-number-of-bars"
                  type="number"
                  min={1}
                  max={64}
                  value={1 + (addedMeasures || 0)}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(64, parseInt(e.target.value, 10) || 1));
                    dirtyRef.current = true;
                    setAddedMeasures(Math.max(0, v - 1));
                  }}
                  className="w-20 px-2 py-1.5 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 text-sm tabular-nums"
                />
                <span className="text-xs text-amber-700">{t('settings.numberOfBarsHint')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRhythmSyllables}
                    onChange={(e) => { dirtyRef.current = true; setShowRhythmSyllables(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">{t('teacher.rhythmSyllables')}</span>
                </label>
              </div>
              <p className="text-xs text-amber-700 -mt-2">{t('teacher.rhythmSyllablesHint')}</p>
              {/* Kursori karakter (õpetaja): emoji sisestusväli + HEV emoji suurus */}
              <div className="border-t border-amber-200 pt-4 mt-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2">{t('settings.cursorCharacter')}</h3>
                <input
                  type="text"
                  value={pedagogicalPlayheadEmoji}
                  onChange={(e) => { dirtyRef.current = true; setPedagogicalPlayheadEmoji(e.target.value.slice(0, 4)); }}
                  placeholder="🎵"
                  className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 text-xl text-center"
                  maxLength={4}
                />
                <p className="text-xs text-amber-700 mt-1">{t('settings.cursorCharacterHint')}</p>
                <div className="flex items-center gap-3 mt-3">
                  <label htmlFor="emoji-size" className="text-sm font-semibold text-amber-900">{t('settings.emojiSize')}</label>
                  <input
                    id="emoji-size"
                    type="range"
                    min={20}
                    max={200}
                    value={pedagogicalPlayheadEmojiSize}
                    onChange={(e) => { dirtyRef.current = true; setPedagogicalPlayheadEmojiSize(Math.max(20, Math.min(200, Number(e.target.value)))); }}
                    className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                  />
                  <span className="text-sm text-amber-800 w-10">{pedagogicalPlayheadEmojiSize} px</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">Suurem suurus aitab vaegnägijatel ja tähelepanuhäiretega õpilastel.</p>
                <div className="flex items-center gap-3 mt-3">
                  <label htmlFor="cursor-size-px" className="text-sm font-semibold text-amber-900 shrink-0">{t('settings.cursorSize')}</label>
                  <input
                    id="cursor-size-px"
                    type="range"
                    min={1}
                    max={100}
                    value={cursorSizePx}
                    onChange={(e) => { dirtyRef.current = true; setCursorSizePx(Math.max(1, Math.min(500, Number(e.target.value)))); }}
                    className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                  />
                  <span className="text-sm text-amber-800 w-12">{cursorSizePx} px</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">N-kursori (lugeja/kirjutaja) suurus 1–500 px.</p>
              </div>
              <div className="border-t border-amber-200 pt-4 mt-4">
                <label className="block text-sm font-semibold text-amber-900 mb-1">{t('layout.pageOrientation')}</label>
                <p className="text-xs text-amber-700 mb-2">{t('layout.pageOrientationHint')}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { dirtyRef.current = true; setPageOrientation('portrait'); }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors flex items-center gap-2 ${pageOrientation === 'portrait' ? 'bg-amber-600 border-amber-700 text-white' : 'border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100'}`}
                  >
                    {t('layout.pageOrientationPortrait')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { dirtyRef.current = true; setPageOrientation('landscape'); }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors flex items-center gap-2 ${pageOrientation === 'landscape' ? 'bg-amber-600 border-amber-700 text-white' : 'border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100'}`}
                  >
                    {t('layout.pageOrientationLandscape')}
                  </button>
                </div>
              </div>
              <div className="border-t border-amber-200 pt-4 mt-4">
                <label className="block text-sm font-semibold text-amber-900 mb-1">{t('layout.paperSize')}</label>
                <p className="text-xs text-amber-700 mb-2">{t('layout.paperSizeHint')}</p>
                <div className="flex flex-wrap gap-2">
                  {(['a3', 'a4', 'a5']).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => { dirtyRef.current = true; setPaperSize(size); }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${paperSize === size ? 'bg-amber-600 border-amber-700 text-white' : 'border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100'}`}
                    >
                      {t(`layout.paperSize${size.toUpperCase()}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-1">{t('layout.measuresPerLine')}</label>
                <p className="text-xs text-amber-700 mb-2">{t('layout.measuresPerLineHint')} {t('layout.measuresPerLineHintOrientation')}</p>
                <div className="flex flex-wrap gap-2">
                  {(pageOrientation === 'landscape' ? [2, 4, 6, 8, 12, 16] : [2, 3, 4, 6, 8]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutMeasuresPerLine : setPartLayoutMeasuresPerLine)(n); }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${effectiveLayoutMeasuresPerLine === n ? 'bg-amber-600 border-amber-700 text-white' : 'border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100'}`}
                    >
                      {n} takti / rida
                    </button>
                  ))}
                </div>
              </div>
              {notationCtx && (
                <div>
                  <label className="block text-sm font-semibold text-amber-900 mb-1">{t('layout.staffSpacing')}</label>
                  <p className="text-xs text-amber-700 mb-2">{t('layout.staffSpacingHint')}</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={60}
                      max={240}
                      step={10}
                      value={notationCtx.staffSpacing ?? 120}
                      onChange={(e) => notationCtx.setStaffSpacing(Number(e.target.value))}
                      className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                    />
                    <span className="text-sm text-amber-800 w-12">{notationCtx.staffSpacing ?? 120} px</span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPageNavigator}
                    onChange={(e) => { dirtyRef.current = true; setShowPageNavigator(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">{t('layout.showPageNavigator')}</span>
                </label>
              </div>
              <p className="text-xs text-amber-700 -mt-2">{t('layout.showPageNavigatorHint')}</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickupEnabled}
                    onChange={(e) => setPickupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">Include Pickup Measure (Eeltakt)</span>
                </label>
                {pickupEnabled && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-800">Kogus:</span>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={pickupQuantity}
                        onChange={(e) => setPickupQuantity(Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 1)))}
                        className="w-12 px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-800">Kestus:</span>
                      <select
                        value={pickupDuration}
                        onChange={(e) => setPickupDuration(e.target.value)}
                        className="px-2 py-1 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                      >
                        <option value="1/1">1/1</option>
                        <option value="1/2">1/2</option>
                        <option value="1/4">1/4</option>
                        <option value="1/8">1/8</option>
                        <option value="1/16">1/16</option>
                        <option value="1/32">1/32</option>
                      </select>
                    </div>
</div>
              )}
              </div>
              {/* Figuurnotatsioon: figuuride suurus (nagu fonti suurus) */}
              <div className="border-t border-amber-200 pt-4 mt-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2">Figuurnotatsioon</h3>
                <p className="text-xs text-amber-700 mb-2">Figuuride (ring, ruut, kolmnurk) suurus noodistikus. Sarnane fonti suuruse seadistamisega.</p>
                <div className="flex items-center gap-3">
                  <label htmlFor="figurenotes-size" className="text-sm font-semibold text-amber-900">Figuuride suurus:</label>
                  <input
                    id="figurenotes-size"
                    type="number"
                    min={12}
                    max={500}
                    step={1}
                    value={figurenotesSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) { dirtyRef.current = true; setFigurenotesSize(Math.max(12, Math.min(100, v))); }
                    }}
                    className="w-16 px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                  />
                  <span className="text-sm text-amber-800">px</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={figurenotesStems}
                    onChange={(e) => { dirtyRef.current = true; setFigurenotesStems(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">Noodivarte režiim (näita rütmi vartega – vars, vibu)</span>
                </label>
                <p className="text-xs text-amber-600 mt-1">Kui see on sisse lülitatud, kuvatakse figuurnoodidel noodivars ja vibu (kaheksandik, kuueteistkümnendik), et rütm oleks selgem. Vaikimisi väljas.</p>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={figurenotesMelodyShowNoteNames}
                    onChange={(e) => { dirtyRef.current = true; setFigurenotesMelodyShowNoteNames(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">{t('figurenotes.melodyShowNoteNames')}</span>
                </label>
                <p className="text-xs text-amber-600 mt-1">{t('figurenotes.melodyShowNoteNamesHint')}</p>
              </div>
              {/* Pedagoogiline notatsioon (Kodály relatiivnotatsioon): JO võti on alati nähtav; võtmemärk ja traditsiooniline võti valikulised */}
              <div className="border-t border-amber-200 pt-4 mt-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2">{t('settings.relativeNotation')}</h3>
                <p className="text-xs text-amber-700 mb-3">{t('settings.relativeNotationHint')}</p>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={relativeNotationShowKeySignature}
                    onChange={(e) => { dirtyRef.current = true; setRelativeNotationShowKeySignature(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">{t('settings.relativeNotationShowKeySignature')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={relativeNotationShowTraditionalClef}
                    onChange={(e) => { dirtyRef.current = true; setRelativeNotationShowTraditionalClef(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">{t('settings.relativeNotationShowTraditionalClef')}</span>
                </label>
              </div>
              {/* Häälestus: võrdlusnoot (nt A3=440 Hz) */}
              <div className="border-t border-amber-200 pt-4 mt-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2">Häälestus (klaveri helid)</h3>
                <p className="text-xs text-amber-700 mb-3">Võrdtempereeritud häälestus. Määra võrdlusnoot ja sagedus (nt A3 = 440 Hz).</p>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playNoteOnInsert}
                      onChange={(e) => { dirtyRef.current = true; setPlayNoteOnInsert(e.target.checked); }}
                      className="w-4 h-4 rounded border-amber-300 text-amber-600"
                    />
                    <span className="text-sm font-semibold text-amber-900">Noodi sisestusheli (mängi heli noodi lisamisel)</span>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-amber-800">Võrdlusnoot:</span>
                    <select
                      value={tuningReferenceNote}
                      onChange={(e) => { dirtyRef.current = true; setTuningReferenceNote(e.target.value); }}
                      className="px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium"
                    >
                      {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <select
                      value={tuningReferenceOctave}
                      onChange={(e) => { dirtyRef.current = true; setTuningReferenceOctave(Number(e.target.value)); }}
                      className="px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium"
                    >
                      {[2, 3, 4, 5].map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <span className="text-sm text-amber-800">=</span>
                    <input
                      type="number"
                      min={200}
                      max={900}
                      step={1}
                      value={tuningReferenceHz}
                      onChange={(e) => { dirtyRef.current = true; const v = parseInt(e.target.value, 10); if (!isNaN(v)) setTuningReferenceHz(Math.max(200, Math.min(900, v))); }}
                      className="w-16 px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                    />
                    <span className="text-sm text-amber-800">Hz</span>
                  </div>
                </div>
              </div>
              {/* Salvestuskeskkond: OneDrive, Google Drive, iCloud, Dropbox */}
              <div className="border-t border-amber-200 pt-4 mt-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <Cloud className="w-4 h-4" /> Salvestuskeskkond
                </h3>
                <p className="text-xs text-amber-700 mb-3">Salvesta või laadi projekti pilve (kasutaja valitud kaust). Lubade küsimine toimub Google sisselogimisel.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-sm font-medium">
                    <Cloud className="w-4 h-4 text-sky-600" /> Google Drive — <span className="font-semibold">aktiivne</span>: kasuta tööriistariba nuppe „Pilve salvesta“ ja „Laadi pilvest“.
                  </div>
                  {['OneDrive', 'iCloud', 'Dropbox'].map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 text-sm font-medium"
                      title="Tulekul"
                    >
                      <Cloud className="w-4 h-4 text-amber-600" /> {name}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2">Logi sisse Google&#39;iga, et saada pilve lugemise/salvestamise luba.</p>
              </div>
              {/* Demo: show Login and Register when not logged in; hide when user is logged in */}
              {!hasFullAccess && !authStorage.isLoggedIn() && (
                <div className="border-t border-amber-200 dark:border-white/20 pt-4 mt-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-900 dark:text-white">{t('demo.loginHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/login"
                      onClick={() => setSettingsOpen(false)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 border border-amber-700 transition-colors"
                    >
                      {LogIn && <LogIn className="w-4 h-4" />}
                      {t('account.logIn')}
                    </Link>
                    <Link
                      to="/registreeru"
                      onClick={() => setSettingsOpen(false)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 dark:bg-zinc-800 text-amber-900 dark:text-white border-2 border-amber-300 dark:border-white/30 hover:bg-amber-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {UserPlus && <UserPlus className="w-4 h-4" />}
                      {t('landing.createAccount')}
                    </Link>
                  </div>
                </div>
              )}
              <button onClick={() => setSettingsOpen(false)} className="w-full py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500">Sulge</button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts modal – File → Shortcuts… */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-6" onClick={() => { setShortcutsOpen(false); setShortcutsEditingActionKey(null); }}>
          <div className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-amber-200 dark:border-white/20 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">{Keyboard && <Keyboard className="w-5 h-5" />} {t('shortcuts.title')}</h2>
              <button type="button" onClick={() => { setShortcutsOpen(false); setShortcutsEditingActionKey(null); }} className="text-white/90 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {!authStorage.isLoggedIn() && (
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">{t('shortcuts.notLoggedIn')}</p>
              )}
              <div className="space-y-2">
                {Object.keys(DEFAULT_SHORTCUT_PREFS).map((actionKey) => {
                  const draft = shortcutsDraftPrefs[actionKey] != null ? shortcutsDraftPrefs[actionKey] : effectiveShortcutPrefs[actionKey];
                  const label = actionKey.startsWith('toolbox.')
                    ? t(actionKey)
                    : (SHORTCUT_ACTION_LABELS[actionKey] || actionKey);
                  const isEditing = shortcutsEditingActionKey === actionKey;
                  return (
                    <div key={actionKey} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-white/20">
                      <span className="text-sm font-medium text-amber-900 dark:text-white truncate">{label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <kbd className="font-mono text-xs px-2 py-1 rounded bg-amber-200 dark:bg-zinc-700 text-amber-900 dark:text-white">
                          {isEditing ? t('shortcuts.pressKeys') : formatShortcutLabel(draft)}
                        </kbd>
                        <button
                          type="button"
                          onClick={() => setShortcutsEditingActionKey(isEditing ? null : actionKey)}
                          className="text-xs font-semibold px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-500"
                        >
                          {t('shortcuts.change')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-amber-200 dark:border-white/20 flex gap-2 justify-end shrink-0">
              <button type="button" onClick={() => { setShortcutsOpen(false); setShortcutsEditingActionKey(null); }} className="px-4 py-2 rounded-lg border-2 border-amber-300 text-amber-900 dark:text-white font-medium hover:bg-amber-100 dark:hover:bg-zinc-800">
                {t('shortcuts.close')}
              </button>
              <button
                type="button"
                disabled={!authStorage.isLoggedIn()}
                onClick={() => {
                  if (!authStorage.isLoggedIn()) return;
                  const toSave = { ...effectiveShortcutPrefs, ...shortcutsDraftPrefs };
                  Object.keys(toSave).forEach((k) => { const n = normalizeShortcutPref(toSave[k]); if (!n) delete toSave[k]; else toSave[k] = n; });
                  authStorage.setShortcutPrefsForCurrentUser(toSave);
                  setShortcutPrefs(toSave);
                  setShortcutsOpen(false);
                  setShortcutsEditingActionKey(null);
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('shortcuts.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pilve salvestamise dialoog: vali kaust või loo uus */}
      {saveCloudDialogOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-6" onClick={() => setSaveCloudDialogOpen(false)}>
          <div className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-sky-200 dark:border-white/20" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><CloudUpload className="w-5 h-5" /> Salvesta Google Drivesse</h2>
              <button onClick={() => setSaveCloudDialogOpen(false)} className="text-white/90 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-amber-900">Vali olemasolev kaust või loo uus kaust ja salvesta sinna projekt.</p>
              <button
                type="button"
                onClick={saveToCloudPickExisting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-sky-300 bg-sky-50 text-sky-800 font-semibold hover:bg-sky-100 hover:border-sky-400 transition-colors"
              >
                <FolderOpen className="w-5 h-5" />
                Vali olemasolev kaust
              </button>
              <div className="border-t border-amber-200 pt-4">
                <p className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <FolderPlus className="w-4 h-4" /> Loo uus kaust
                </p>
                <p className="text-xs text-amber-700 mb-2">Kaust luuakse Google Drive'i juurkausta. Sisesta kausta nimi ja salvesta projekt sinna.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveCloudNewFolderName}
                    onChange={(e) => setSaveCloudNewFolderName(e.target.value)}
                    placeholder="NoodiMeister"
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900"
                  />
                  <button
                    type="button"
                    onClick={saveToCloudCreateFolder}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-500 whitespace-nowrap"
                  >
                    <CloudUpload className="w-4 h-4" /> Loo ja salvesta
                  </button>
                </div>
              </div>
              <button onClick={() => setSaveCloudDialogOpen(false)} className="w-full py-2 rounded-lg bg-amber-200 text-amber-900 font-semibold hover:bg-amber-300">Tühista</button>
            </div>
          </div>
        </div>
      )}

      {googleLoadPickerOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-6"
          onClick={() => { setGoogleLoadPickerOpen(false); setGoogleLoadPickerError(''); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setGoogleLoadPickerOpen(false); setGoogleLoadPickerError(''); } }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-sky-200 dark:border-white/20 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="google-load-picker-title"
            aria-modal="true"
          >
            <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white px-5 py-3 flex items-center justify-between gap-2">
              <h2 id="google-load-picker-title" className="text-base font-bold flex items-center gap-2">
                <CloudDownload className="w-5 h-5 shrink-0" />
                {t('file.loadCloudPickerTitle')}
              </h2>
              <button
                type="button"
                onClick={() => { setGoogleLoadPickerOpen(false); setGoogleLoadPickerError(''); }}
                className="text-white/90 hover:text-white text-2xl leading-none shrink-0"
                aria-label={t('file.loadCloudPickerClose')}
              >
                &times;
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 min-h-0">
              <p className="text-sm text-amber-900 dark:text-amber-100/90">{t('file.loadCloudPickerIntro')}</p>
              {googleLoadPickerLoading && (
                <p className="text-sm text-sky-800 dark:text-sky-200 animate-pulse">{t('file.loadCloudPickerLoading')}</p>
              )}
              {googleLoadPickerError && (
                <p className="text-sm text-red-700 dark:text-red-300">{googleLoadPickerError}</p>
              )}
              {!googleLoadPickerLoading && !googleLoadPickerError && googleLoadPickerRows.length === 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-200/90">{t('file.loadCloudPickerEmpty')}</p>
              )}
              {!googleLoadPickerLoading && googleLoadPickerRows.length > 0 && (() => {
                const dateLocaleTag = locale === 'en' ? 'en-GB' : locale === 'fi' ? 'fi-FI' : 'et-EE';
                return (
                  <ul className="overflow-y-auto max-h-[50vh] border border-amber-200 dark:border-white/15 rounded-lg divide-y divide-amber-100 dark:divide-white/10">
                    {googleLoadPickerRows.map((row) => (
                      <li key={row.id} className="flex items-stretch bg-amber-50/50 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => loadGoogleDriveProjectById(row.id)}
                          className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3 hover:bg-amber-100/90 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset transition-colors"
                        >
                          <AppLogo variant="iconMd" alt="" className="shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-amber-950 dark:text-white truncate" title={row.name}>{row.name}</span>
                            <span className="block text-xs text-amber-700 dark:text-amber-200/80 mt-0.5">
                              {row.modifiedTime
                                ? new Date(row.modifiedTime).toLocaleString(dateLocaleTag, { dateStyle: 'short', timeStyle: 'short' })
                                : '—'}
                              {row.fromShared ? ` · ${t('file.loadCloudPickerShared')}` : ''}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openGoogleDriveProjectInNewTab(row.id); }}
                          className="shrink-0 px-3 flex items-center justify-center border-l border-amber-200/80 dark:border-white/15 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset transition-colors"
                          title={t('file.loadCloudOpenNewTab')}
                          aria-label={t('file.loadCloudOpenNewTab')}
                        >
                          {ExternalLink && <ExternalLink className="w-5 h-5" aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
              <button
                type="button"
                onClick={() => { setGoogleLoadPickerOpen(false); setGoogleLoadPickerError(''); }}
                className="w-full py-2 rounded-lg bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-semibold hover:bg-amber-300 dark:hover:bg-amber-900/60"
              >
                {t('file.loadCloudPickerClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveLoadOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true" aria-label="Salvestus ja laadimine">
          <div className="w-full max-w-2xl rounded-xl border border-slate-500 bg-slate-100 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-300 bg-slate-800 text-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Salvestus ja laadimine</h3>
                <p className="text-xs text-slate-300">Cmd/Ctrl+S salvestab all valitud salvestuskohta.</p>
              </div>
              <button
                type="button"
                onClick={() => setSaveLoadOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
              >
                Sulge
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">Salvestuskoht</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'cloud', label: 'Pilv (Google Drive / OneDrive)' },
                    { id: 'browser', label: 'Brauseri kohalik salvestus' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setProjectSaveTarget(opt.id)}
                      className={`px-3 py-1.5 rounded text-sm font-semibold border ${projectSaveTarget === opt.id ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveShortcut()}
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                  >
                    Salvesta kohe valitud kohta
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">Laadimise allikas</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'cloud', label: 'Pilvest' },
                    { id: 'browser', label: 'Brauseri kohalikust salvestusest' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setProjectLoadSource(opt.id)}
                      className={`px-3 py-1.5 rounded text-sm font-semibold border ${projectLoadSource === opt.id ? 'bg-blue-700 text-white border-blue-800' : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadBySelectedSource()}
                    className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm font-semibold hover:bg-blue-600"
                  >
                    Laadi valitud allikast
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seadete riba + tööriistavalikud magneetiliselt all – sticky üleval */}
      <div className="sticky top-0 z-30 flex flex-col flex-shrink-0 shadow-lg">
      <header className="flex-shrink-0 bg-gradient-to-r from-amber-900 via-orange-800 to-red-900 text-amber-50 dark:bg-black dark:text-white">
          <div className="w-full pl-3 pr-4 py-3 flex flex-col gap-3">
          {/* Rida 1: logo */}
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center text-amber-50 hover:opacity-90 transition-opacity">
              <AppLogo variant="header" alt="NoodiMeister" className="border-amber-600/50 bg-amber-950/50" />
            </Link>
            {isPartWindow && partWindowTitle && (
              <div className="text-sm sm:text-base font-semibold text-amber-100 truncate max-w-[60vw]" title={partWindowTitle}>
                {partWindowTitle}
              </div>
            )}
          </div>
          {/* Rida 2: rippmenüüd ja kõik käsud */}
          <div className="flex flex-wrap items-center gap-2" ref={headerMenuRef}>
              <input ref={musicXmlInputRef} type="file" accept=".xml,.musicxml,application/xml,text/xml" className="hidden" onChange={handleImportMusicXmlFile} />
              <input ref={pageDesignInputRef} type="file" accept=".png,.svg,image/png,image/svg+xml" className="hidden" onChange={handleImportPageDesignFile} />
              <input ref={pedagogicalAudioImportInputRef} type="file" accept="audio/*" className="hidden" onChange={handlePedagogicalAudioFile} />
              <button
                onClick={addMeasure}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 hover:shadow-lg active:scale-[0.98] transition-all duration-200 border border-slate-700/50"
                title={hasFullAccess ? 'Lisa takt (Cmd+B / Ctrl+B)' : t('measure.demoTitle')}
              >
                <Plus className="w-4 h-4" />
                {`Lisa takt (${addMeasureShortcutLabel})`}
              </button>
              <button
                type="button"
                onClick={addSongBlock}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 hover:shadow-lg active:scale-[0.98] transition-all duration-200 border border-slate-700/50"
                title={`${t('tool.addSongBlock')}\n${t('tool.addSongBlock.desc')}\n${t('tool.addSongBlock.shortcut')}: ${addSongBlockShortcutLabel}`}
                aria-label={t('tool.addSongBlock')}
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden xl:inline">{t('tool.addSongBlock')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isScorePlaybackPlaying) stopScorePlayback(false);
                  else startScorePlayback();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 border border-slate-700/50"
                title="Esita nootidest taasesitus"
              >
                {isScorePlaybackPlaying
                  ? (icons?.Pause ? <icons.Pause className="w-4 h-4" /> : null)
                  : (icons?.Play ? <icons.Play className="w-4 h-4" /> : null)}
                {isScorePlaybackPlaying ? 'Paus' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => stopScorePlayback(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 border border-slate-700/50"
                title="Peata ja vii kursor algusesse"
              >
                {icons?.X ? <icons.X className="w-4 h-4" /> : null}
                Stop
              </button>

              {/* Fail – salvestamine ja laadimine */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen(prev => prev === 'file' ? null : 'file')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 border border-slate-700/50"
                  title={t('file.menuTitle')}
                >
                  <Save className="w-4 h-4" />
                  {t('file.menu')}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {headerMenuOpen === 'file' && (
                  <div className="absolute left-0 top-full mt-1 min-w-[200px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(null);
                        setPianoStripVisible(false);
                        setOpenedCloudFile(null);
                        setSearchParams({ new: '1' });
                        setNewWorkSetupOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('file.newWorkTitle')}
                    >
                      <Plus className="w-4 h-4" /> {t('file.newWork')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { setPianoStripVisible(false); setSettingsOpen(true); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Muuda teose andmeid (pealkiri, autor, helistik, taktimoot, eellook)"
                    >
                      <Type className="w-4 h-4" />
                      Teose andmed
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPianoStripVisible(false); setSettingsOpen(true); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Muuda noodigraafika seadeid"
                    >
                      <Layout className="w-4 h-4" />
                      Noodigraafika seaded
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPianoStripVisible(false); setSaveLoadOpen(true); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Salvestus ja laadimine"
                    >
                      <Save className="w-4 h-4" />
                      Salvestus / laadimine
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { saveToStorage(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <Save className="w-4 h-4" /> {t('file.saveBrowser')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPianoStripVisible(false); saveToCloud(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <CloudUpload className="w-4 h-4" /> {t('file.saveCloud')}
                    </button>
                    {openedCloudFile && (
                      <button
                        type="button"
                        onClick={() => { setPianoStripVisible(false); saveToCloud(); setHeaderMenuOpen(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      >
                        <CloudUpload className="w-4 h-4" /> {t('file.overwriteCloud')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { makeCloudCopy(); setHeaderMenuOpen(null); }}
                      disabled={!openedCloudFile?.fileId}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={openedCloudFile?.fileId ? (t('file.copy') || 'Tee koopia') : 'Ava pilvefail, et teha koopia'}
                    >
                      <Save className="w-4 h-4" /> {t('file.copy') || 'Tee koopia'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { loadFromStorage(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <FolderOpen className="w-4 h-4" /> {t('file.loadBrowser')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPianoStripVisible(false); loadFromCloud(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <CloudDownload className="w-4 h-4" /> {t('file.loadCloud')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <div className="px-3 py-1.5 text-xs font-semibold text-amber-200 uppercase tracking-wider">Dokumendi reziim</div>
                    <button
                      type="button"
                      onClick={() => { dirtyRef.current = true; setDocumentNotationMode('traditional'); setHeaderMenuOpen(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${notationMode === 'traditional' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}
                    >
                      Traditsiooniline
                    </button>
                    <button
                      type="button"
                      onClick={() => { dirtyRef.current = true; setDocumentNotationMode('figurenotes'); setHeaderMenuOpen(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${notationMode === 'figurenotes' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}
                    >
                      Figuurnotatsioon
                    </button>
                    <button
                      type="button"
                      onClick={() => { dirtyRef.current = true; setDocumentNotationMode('vabanotatsioon'); setHeaderMenuOpen(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${notationMode === 'vabanotatsioon' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}
                    >
                      Pedagoogiline notatsioon
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { pageDesignInputRef.current?.click(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Impordi lehe taust (PNG/SVG)"
                    >
                      <Layout className="w-4 h-4" /> Import: Lehe disain (PNG/SVG)
                    </button>
                    {pageDesignDataUrl && (
                      <button
                        type="button"
                        onClick={() => { dirtyRef.current = true; setPageDesignDataUrl(null); setHeaderMenuOpen(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                        title={t('layout.pageDesignRemoveHint')}
                      >
                        <Layout className="w-4 h-4" /> {t('layout.pageDesignRemove')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { musicXmlInputRef.current?.click(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Impordi MusicXML"
                    >
                      <Music2 className="w-4 h-4" /> Import: MusicXML (.xml)
                    </button>
                    <button
                      type="button"
                      onClick={() => { pedagogicalAudioImportInputRef.current?.click(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Impordi heli pedagoogikale"
                    >
                      {icons?.Play && <icons.Play className="w-4 h-4" />}
                      Import: Heli pedagoogikale (MP3/WAV)
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { handlePrint(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('file.printTitle')}
                    >
                      {icons?.Printer && <icons.Printer className="w-4 h-4" />}
                      {t('file.print')}
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => { setShowPdfExportPreview(true); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600 disabled:opacity-60"
                      title={t('file.exportPdfTitle')}
                    >
                      {icons?.FileDown && <icons.FileDown className="w-4 h-4" />}
                      {t('file.exportPdf')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    {/* Animatsiooni eksport (video) – ainult pedagoogilise projekti puhul */}
                    {isPedagogicalProject && (
                      <div className="relative" onMouseEnter={() => setFileSubmenuOpen('exportAnimation')} onMouseLeave={() => setFileSubmenuOpen(null)}>
                        <button
                          type="button"
                          disabled={isExportingAnimation}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600 disabled:opacity-60"
                          title={t('file.exportAnimation')}
                        >
                          <span className="flex items-center gap-2">
                            {icons?.Video && <icons.Video className="w-4 h-4" />}
                            {t('file.exportAnimation')}
                          </span>
                          <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                        </button>
                        {fileSubmenuOpen === 'exportAnimation' && (
                          <div className="absolute left-full top-0 ml-0 min-w-[220px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                            <button
                              type="button"
                              disabled={isExportingAnimation}
                              onClick={() => { exportAnimationAsVideo({ download: true }); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600 disabled:opacity-60"
                            >
                              {t('file.exportAnimationDownload')}
                            </button>
                            <button
                              type="button"
                              disabled={isExportingAnimation}
                              onClick={() => { exportAnimationAsVideo({ saveToDrive: true }); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600 disabled:opacity-60"
                            >
                              <CloudUpload className="w-4 h-4" /> {t('file.exportAnimationDrive')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {isPedagogicalProject && <div className="my-1 border-t border-slate-600" />}
                    <button
                      type="button"
                      onClick={() => { setShortcutsOpen(true); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('file.shortcutsTitle')}
                    >
                      <Keyboard className="w-4 h-4" />
                      {t('file.shortcuts')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { navigate('/tood'); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <LogOut className="w-4 h-4" /> {t('file.exit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleSaveAndExit(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <LogOut className="w-4 h-4" /> {t('file.exitAndSave')}
                    </button>
                  </div>
                )}
              </div>

              {/* Vaade – lehekülje suund, navigaator, lehekülgede liikumise suund */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen(prev => prev === 'view' ? null : 'view')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 border border-slate-700/50"
                  title={t('view.menuTitle')}
                >
                  {Eye && <Eye className="w-4 h-4" />}
                  {t('view.menu')}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {headerMenuOpen === 'view' && (
                  <div className="absolute left-0 top-full mt-1 min-w-[240px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                    {/* Partituur vs instrumendi part */}
                    <div className="px-3 py-1.5 text-xs font-semibold text-amber-200 uppercase tracking-wider">{t('view.menuTitle')}</div>
                    <button type="button" onClick={() => { dirtyRef.current = true; setViewMode('score'); setHeaderMenuOpen(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${viewMode === 'score' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`} title={t('view.scoreHint')}>{t('view.score')}</button>
                    <button type="button" onClick={() => { dirtyRef.current = true; setViewMode('part'); setHeaderMenuOpen(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${viewMode === 'part' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`} title={t('view.partHint')}>{t('view.part')}</button>
                    <button
                      type="button"
                      onClick={() => {
                        const staff = staves?.[activeStaffIndex];
                        if (!staff?.id) return;
                        const url = `/part?staffId=${encodeURIComponent(String(staff.id))}`;
                        window.open(url, '_blank', 'noopener');
                        setHeaderMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('view.openPartInNewWindow')}
                    >
                      <ArrowRight className="w-4 h-4" /> {t('view.openPartInNewWindow')}
                    </button>
                    {partOptions.length > 1 && (
                      <div className="relative" onMouseEnter={() => setViewSubmenuOpen('partChoice')} onMouseLeave={() => setViewSubmenuOpen(null)}>
                        <button
                          type="button"
                          onClick={() => setViewSubmenuOpen(prev => prev === 'partChoice' ? null : 'partChoice')}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                          title={t('view.choosePartInNewWindow')}
                        >
                          <span className="flex items-center gap-2">{t('view.choosePartInNewWindow')}</span>
                          <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                        </button>
                        {viewSubmenuOpen === 'partChoice' && (
                          <div className="absolute left-full top-0 ml-0 min-w-[200px] max-h-[60vh] overflow-y-auto py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                            {partOptions.map((opt) => (
                              <button
                                key={opt.staffId}
                                type="button"
                                onClick={() => {
                                  const url = `/part?staffId=${encodeURIComponent(String(opt.staffId))}`;
                                  window.open(url, '_blank', 'noopener');
                                  setHeaderMenuOpen(null);
                                  setViewSubmenuOpen(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600 truncate"
                                title={opt.label}
                              >
                                <ArrowRight className="w-4 h-4 shrink-0" /> {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="my-1 border-t border-slate-600" />
                    {/* Lehekülje suund */}
                    <div className="relative" onMouseEnter={() => setViewSubmenuOpen('orientation')} onMouseLeave={() => setViewSubmenuOpen(null)}>
                      <button
                        type="button"
                        onClick={() => setViewSubmenuOpen(prev => prev === 'orientation' ? null : 'orientation')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                        title={t('layout.pageOrientation')}
                      >
                        <span className="flex items-center gap-2">{t('view.pageOrientation')}</span>
                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                      </button>
                      {viewSubmenuOpen === 'orientation' && (
                        <div className="absolute left-full top-0 ml-0 min-w-[180px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageOrientation('portrait'); setHeaderMenuOpen(null); setViewSubmenuOpen(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${pageOrientation === 'portrait' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}>{t('layout.pageOrientationPortrait')}</button>
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageOrientation('landscape'); setHeaderMenuOpen(null); setViewSubmenuOpen(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${pageOrientation === 'landscape' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}>{t('layout.pageOrientationLandscape')}</button>
                        </div>
                      )}
                    </div>
                    {/* Terve leht: üks A4 täidab ekraani (vertikaal = kõrgus, horisontaal = laius). Tark lehe vaade: ainult noteeritud read. Üks režiim korraga. */}
                    <button
                      type="button"
                      onClick={() => { dirtyRef.current = true; setViewFullSizeA4(false); setViewSmartPage(false); setViewFitPage((prev) => !prev); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('view.fitPageHint')}
                    >
                      <span>{t('view.fitPage')}</span>
                      {viewFitPage && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { dirtyRef.current = true; setViewFitPage(false); setViewFullSizeA4(false); setViewSmartPage((prev) => !prev); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('view.smartPageHint')}
                    >
                      <span>{t('view.smartPage')}</span>
                      {viewSmartPage && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                    {/* Navigaatori seade */}
                    <button
                      type="button"
                      onClick={() => { dirtyRef.current = true; setShowPageNavigator(prev => !prev); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('layout.showPageNavigatorHint')}
                    >
                      <span>{t('view.pageNavigator')}</span>
                      {showPageNavigator && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                    {/* Tööriistakast (palett) – linnuke näitab/peidab külgriba */}
                    <button
                      type="button"
                      onClick={() => { setToolboxPaletteVisiblePersist(!toolboxPaletteVisible); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('view.toolboxPaletteHint')}
                    >
                      <span>{t('view.toolboxPalette')}</span>
                      {toolboxPaletteVisible && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { setHeaderMenuOpen(null); window.location.reload(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('view.reloadApp')}
                    >
                      {t('view.reloadApp')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    {/* Lehekülgede liikumise suund */}
                    <div className="relative" onMouseEnter={() => setViewSubmenuOpen('flow')} onMouseLeave={() => setViewSubmenuOpen(null)}>
                      <button
                        type="button"
                        onClick={() => setViewSubmenuOpen(prev => prev === 'flow' ? null : 'flow')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                        title={t('view.pageFlowHint')}
                      >
                        <span className="flex items-center gap-2">{t('view.pageFlow')}</span>
                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                      </button>
                      {viewSubmenuOpen === 'flow' && (
                        <div className="absolute left-full top-0 ml-0 min-w-[200px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageFlowDirection('vertical'); setHeaderMenuOpen(null); setViewSubmenuOpen(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${pageFlowDirection === 'vertical' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}>{ArrowDown && <ArrowDown className="w-4 h-4" />} {t('view.pageFlowVertical')}</button>
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageFlowDirection('horizontal'); setHeaderMenuOpen(null); setViewSubmenuOpen(null); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${pageFlowDirection === 'horizontal' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}>{ArrowRight && <ArrowRight className="w-4 h-4" />} {t('view.pageFlowHorizontal')}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Seaded – keel ja värvirežiim (hele/tume) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setHeaderMenuOpen(prev => prev === 'settings' ? null : 'settings'); setFileSubmenuOpen(null); setViewSubmenuOpen(null); }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 border border-slate-700/50"
                  title={t('file.settings')}
                >
                  <Settings className="w-4 h-4" />
                  <ChevronDown className="w-4 h-4" />
                </button>
                {headerMenuOpen === 'settings' && (
                  <div className="absolute left-0 top-full mt-1 min-w-[200px] py-2 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                    <div className="px-3 py-1.5 text-xs font-semibold text-amber-200 uppercase tracking-wider">{t('app.language')}</div>
                    <div className="flex gap-0.5 px-2 pb-2">
                      {LOCALES.map(({ code, name }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => { setLocale(code); setHeaderMenuOpen(null); }}
                          className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${locale === code ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}
                          title={name}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-600 my-1" />
                    <div className="px-3 py-1.5 text-xs font-semibold text-amber-200 uppercase tracking-wider">{t('app.theme')}</div>
                    <div className="flex gap-1 px-2">
                      <button
                        type="button"
                        onClick={() => { dirtyRef.current = true; setThemeMode('light'); setHeaderMenuOpen(null); }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${themeMode === 'light' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}
                      >
                        {t('theme.light')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { dirtyRef.current = true; setThemeMode('dark'); setHeaderMenuOpen(null); }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${themeMode === 'dark' ? 'bg-amber-600 text-white' : 'text-amber-50 hover:bg-slate-600'}`}
                      >
                        {t('theme.dark')}
                      </button>
                    </div>
                    <div className="border-t border-slate-600 my-1" />
                    <Link
                      to="/teave"
                      onClick={() => setHeaderMenuOpen(null)}
                      className="mx-2 mt-1 flex items-center justify-between rounded px-2.5 py-2 text-xs font-medium text-amber-50 hover:bg-slate-600 transition-colors"
                      title="About / Teave"
                    >
                      <span>About / Teave</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
              <LoggedInUser icons={icons} t={t} />
            {!hasFullAccess && (
              <Link to="/login" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-700/80 text-amber-100 hover:bg-amber-600 border border-amber-600/50" title={t('demo.loginHint')}>
                {t('demo.badge')}
              </Link>
            )}
            {/* Rütmi indikaator, tagasiside, valik, notatsiooni vahetajad */}
            <div className="flex items-center gap-2 bg-amber-800 dark:bg-black px-3 py-1 rounded shrink-0 text-amber-50">
              <span className="text-xs uppercase tracking-wider">{t('toolbar.rhythm')}:</span>
              {notationStyle === 'FIGURENOTES' ? (
                <FigurenotesBlockIcon duration={selectedDuration} className="w-8 h-5" />
              ) : (
                <RhythmIcon duration={selectedDuration} isDotted={isDotted} isRest={isRest} />
              )}
              {tupletMode && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded bg-amber-600 text-white text-xs font-bold" title={tupletMode.type === 3 ? t('note.triplet') : tupletMode.type === 5 ? t('note.quintuplet') : tupletMode.type === 6 ? t('note.sextuplet') : t('note.septuplet')}>
                  {tupletMode.type}
                </span>
              )}
            </div>
            {saveFeedback && (
              <span className="text-sm font-medium text-amber-200 animate-pulse">{saveFeedback}</span>
            )}
            {importTimeline && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-amber-900/60 border border-amber-600/40 text-amber-100">
                <span className="text-[10px] uppercase tracking-wider">
                  {importTimeline.type === 'pdf' ? 'PDF import' : 'XML import'}
                </span>
                <div className="w-32 h-1.5 rounded bg-amber-950 overflow-hidden">
                  <div
                    className={`h-full ${importTimeline.status === 'error' ? 'bg-red-400' : importTimeline.status === 'done' ? 'bg-emerald-400' : 'bg-amber-300'}`}
                    style={{
                      width: `${Math.max(8, Math.round(((Math.max(0, importTimeline.current) + 1) / Math.max(1, importTimeline.steps?.length || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] whitespace-nowrap">
                  {importTimeline.steps?.[importTimeline.current] || 'Tookorras'}
                </span>
                {typeof importTimeline.accuracy === 'number' && (
                  <span className="text-[10px] whitespace-nowrap">
                    {`~${Math.round(importTimeline.accuracy * 100)}%`}
                  </span>
                )}
              </div>
            )}
            {!saveFeedback && repeatMarkIssues.length > 0 && (
              <span className="text-xs font-medium text-red-200" title="Kordusmärkide konflikt">
                {repeatMarkIssues[0]?.message || 'Kordusmärkide kombinatsioon vajab parandamist.'}
              </span>
            )}
            {!noteInputMode && (selectedNoteIndex >= 0 || (cursorOnMelodyRow && noteIndexAtCursor >= 0)) && (
              <>
                {selectedNoteIndex >= 0 && (
                  <>
                    <div className="flex items-center gap-2 bg-blue-600 px-3 py-1 rounded text-xs">
                      <span className="uppercase tracking-wider">{t('toolbar.selected')}:</span>
                      <span className="font-bold">
                        {selectionStart >= 0 && selectionEnd >= 0 
                          ? `${Math.abs(selectionEnd - selectionStart) + 1} ${t('toolbar.notesCount')}`
                          : t('toolbar.oneNote')}
                      </span>
                    </div>
                    {notationMode === 'vabanotatsioon' && enableEmojiOverlays && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs font-medium text-amber-100 whitespace-nowrap">{t('teacher.noteLabel')}:</label>
                        <input
                          type="text"
                          value={notes[selectedNoteIndex]?.teacherLabel ?? ''}
                          onChange={(e) => updateNoteTeacherLabel(selectedNoteIndex, e.target.value)}
                          onBlur={(e) => { const v = e.target.value; if (v && v.includes(':')) updateNoteTeacherLabel(selectedNoteIndex, expandEmojiShortcuts(v)); }}
                          placeholder=":star: :joy: või vabatekst"
                          className="px-2 py-1 rounded text-sm bg-amber-100 text-amber-900 border border-amber-300 w-32 focus:ring-1 focus:ring-amber-500"
                          title={t('teacher.noteLabelHint')}
                        />
                        {['😊', '⭐', '❤️', '🎵', '✅', '❓', '⬜'].map((emo) => (
                          <button key={emo} type="button" onClick={() => updateNoteTeacherLabel(selectedNoteIndex, (notes[selectedNoteIndex]?.teacherLabel ?? '') + emo)} className="text-lg leading-none p-0.5 rounded hover:bg-amber-200" title={emo}>{emo}</button>
                        ))}
                        <button type="button" onClick={() => updateNoteTeacherLabel(selectedNoteIndex, (notes[selectedNoteIndex]?.teacherLabel ?? '') + '?')} className="text-sm font-bold text-amber-900 px-1.5 py-0.5 rounded hover:bg-amber-200" title={t('teacher.symbolQuestion')}>?</button>
                        <button type="button" onClick={() => updateNoteTeacherLabel(selectedNoteIndex, (notes[selectedNoteIndex]?.teacherLabel ?? '') + '□')} className="text-sm font-bold text-amber-900 px-1 py-0.5 rounded hover:bg-amber-200" title={t('teacher.symbolBox')}>□</button>
                      </div>
                    )}
                  </>
                )}
                {cursorOnMelodyRow && (noteIndexAtCursor >= 0 || selectedNoteIndex >= 0) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-medium text-amber-100 whitespace-nowrap">{t('toolbar.lyricLabel')}:</label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setLyricLineIndex(0)} className={`px-1.5 py-0.5 rounded text-xs font-medium ${lyricLineIndex === 0 ? 'bg-amber-300 text-amber-900' : 'bg-amber-800/50 text-amber-100'}`} title={t('toolbar.lyricLine1')}>{t('toolbar.lyricLine1Short')}</button>
                    <button type="button" onClick={() => setLyricLineIndex(1)} className={`px-1.5 py-0.5 rounded text-xs font-medium ${lyricLineIndex === 1 ? 'bg-amber-300 text-amber-900' : 'bg-amber-800/50 text-amber-100'}`} title={t('toolbar.lyricLine2')}>{t('toolbar.lyricLine2Short')}</button>
                  </div>
                  <input
                    ref={lyricInputRef}
                    type="text"
                    onFocus={() => {
                      // Laulusõnade sisestus: lukusta aktiivne noot ahelrežiimi, et '-' / tühik ei saaks minna "suvalisele" noodile
                      // (vältib sõltuvust cursorPosition/noteIndexAtCursor asünkroonsest uuendusest).
                      const idx = selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor;
                      if (typeof idx === 'number' && idx >= 0 && idx < notes.length) {
                        setLyricChainStart(idx);
                        setLyricChainEnd(Math.max(0, notes.length - 1));
                        setLyricChainIndex(idx);
                        setSelectedNoteIndex(idx);
                        setCursorSubRow(0);
                        setCursorPosition(getBeatAtNoteIndex(notes, idx));
                      }
                    }}
                    onPaste={(e) => {
                      // MuseScore-like "paste lyrics across notes":
                      // split pasted text by whitespace and write tokens to consecutive notes starting from active lyric note.
                      const raw = e.clipboardData?.getData?.('text/plain');
                      if (!raw) return;
                      const startIdx = lyricChainIndex != null
                        ? lyricChainIndex
                        : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor);
                      if (startIdx == null || startIdx < 0 || startIdx >= notes.length) return;
                      e.preventDefault();
                      const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2';
                      // Normalize whitespace, keep hyphens as part of token (e.g. "Tii-").
                      const normalized = String(raw)
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/\t/g, ' ')
                        .trim();
                      if (!normalized) return;
                      // Only take the first line (typical lyrics paste is one line).
                      const firstLine = normalized.split('\n')[0]?.trim() ?? '';
                      if (!firstLine) return;
                      const tokens = firstLine.split(/\s+/).filter(Boolean);
                      if (tokens.length === 0) return;
                      const endIdx = Math.min(notes.length - 1, startIdx + tokens.length - 1);
                      saveToHistory(notes);
                      setNotes((prev) => prev.map((n, i) => {
                        if (i < startIdx || i > endIdx) return n;
                        const t = tokens[i - startIdx] ?? '';
                        return { ...n, [key]: t };
                      }));
                      // Move active lyric cursor to next note after pasted range (or last).
                      const nextIdx = Math.min(notes.length - 1, endIdx + 1);
                      setLyricChainStart(startIdx);
                      setLyricChainEnd(endIdx);
                      setLyricChainIndex(nextIdx);
                      setSelectedNoteIndex(nextIdx);
                      setCursorSubRow(0);
                      setCursorPosition(getBeatAtNoteIndex(notes, nextIdx));
                      setTimeout(() => {
                        lyricInputRef.current?.focus();
                        lyricInputRef.current?.setSelectionRange?.(0, 0);
                      }, 0);
                    }}
                    value={lyricChainIndex !== null
                      ? (lyricLineIndex === 0 ? (notes[lyricChainIndex]?.lyric ?? '') : (notes[lyricChainIndex]?.lyric2 ?? ''))
                      : (() => {
                          const idx = selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor;
                          const n = notes[idx];
                          if (!n) return '';
                          return lyricLineIndex === 0 ? (n.lyric ?? '') : (n.lyric2 ?? '');
                        })()}
                    onChange={(e) => {
                      const val = e.target.value;
                      const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2';
                      if (lyricChainIndex !== null) {
                        setNotes(prev => prev.map((n, i) => i === lyricChainIndex ? { ...n, [key]: val } : n));
                      } else {
                        const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor);
                        const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor);
                        setNotes(prev => prev.map((n, i) => (i >= start && i <= end) ? { ...n, [key]: val } : n));
                      }
                    }}
                    onKeyDown={(e) => {
                      const baseIdx = lyricChainIndex != null
                        ? lyricChainIndex
                        : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor);
                      if (baseIdx == null || baseIdx < 0 || baseIdx >= notes.length) return;
                      const idx = baseIdx;
                      const lastIdx = notes.length > 0 ? notes.length - 1 : 0;
                      const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2';
                      const getVal = (n) => (key === 'lyric' ? (n?.lyric ?? '') : (n?.lyric2 ?? ''));
                      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                      const mod = isMac ? e.metaKey : e.ctrlKey;
                      if (mod && e.shiftKey && e.key === '-') {
                        const currentVal = getVal(notes[idx]);
                        e.preventDefault();
                        setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: currentVal + '_' } : n));
                        return;
                      }
                      if (e.key === '-') {
                        const currentVal = getVal(notes[idx]);
                        e.preventDefault();
                        setNotes(prev => prev.map((n, i) => (i === idx ? { ...n, [key]: currentVal + '-' } : n)));
                        if (idx < lastIdx) {
                          const nextIdx = idx + 1;
                          setLyricChainStart(idx);
                          setLyricChainEnd(lastIdx);
                          setLyricChainIndex(nextIdx);
                          setSelectedNoteIndex(nextIdx);
                          setCursorPosition(getBeatAtNoteIndex(notes, nextIdx));
                          setTimeout(() => { lyricInputRef.current?.setSelectionRange?.(0, 0); }, 0);
                        }
                      } else if (e.key === ' ') {
                        const currentVal = getVal(notes[idx]);
                        e.preventDefault();
                        setNotes(prev => prev.map((n, i) => (i === idx ? { ...n, [key]: currentVal + ' ' } : n)));
                        if (idx < lastIdx) {
                          const nextIdx = idx + 1;
                          setLyricChainStart(idx);
                          setLyricChainEnd(lastIdx);
                          setLyricChainIndex(nextIdx);
                          setSelectedNoteIndex(nextIdx);
                          setCursorPosition(getBeatAtNoteIndex(notes, nextIdx));
                          setTimeout(() => { lyricInputRef.current?.setSelectionRange?.(0, 0); }, 0);
                        }
                      } else if ((e.key === 'ArrowRight' || e.code === 'ArrowRight') && idx < lastIdx) {
                        const input = e.currentTarget;
                        const selStart = typeof input?.selectionStart === 'number' ? input.selectionStart : null;
                        const selEnd = typeof input?.selectionEnd === 'number' ? input.selectionEnd : null;
                        const hasSelection = selStart != null && selEnd != null && selStart !== selEnd;
                        const atEnd = selEnd != null && selEnd >= (input?.value?.length ?? 0);
                        // Kui kursor pole sõna lõpus (või on valik), las ArrowRight liigub tekstis.
                        if (!hasSelection && selStart != null && !atEnd) return;

                        e.preventDefault();
                        e.stopPropagation();
                        const nextIdx = Math.min(idx + 1, lastIdx);
                        setLyricChainStart(lyricChainStart >= 0 ? lyricChainStart : idx);
                        setLyricChainEnd(lastIdx);
                        setLyricChainIndex(nextIdx);
                        setSelectedNoteIndex(nextIdx);
                        setCursorPosition(getBeatAtNoteIndex(notes, nextIdx));
                        setTimeout(() => { lyricInputRef.current?.setSelectionRange?.(0, 0); }, 0);
                      } else if ((e.key === 'ArrowLeft' || e.code === 'ArrowLeft') && idx > 0) {
                        const input = e.currentTarget;
                        const selStart = typeof input?.selectionStart === 'number' ? input.selectionStart : null;
                        const selEnd = typeof input?.selectionEnd === 'number' ? input.selectionEnd : null;
                        const hasSelection = selStart != null && selEnd != null && selStart !== selEnd;
                        const atStart = selStart != null && selStart <= 0;
                        // Kui kursor pole sõna alguses (või on valik), las ArrowLeft liigub tekstis.
                        if (!hasSelection && selEnd != null && !atStart) return;

                        e.preventDefault();
                        e.stopPropagation();
                        const prevIdx = Math.max(idx - 1, 0);
                        setLyricChainStart(lyricChainStart >= 0 ? lyricChainStart : prevIdx);
                        setLyricChainEnd(lastIdx);
                        setLyricChainIndex(prevIdx);
                        setSelectedNoteIndex(prevIdx);
                        setCursorPosition(getBeatAtNoteIndex(notes, prevIdx));
                        setTimeout(() => { lyricInputRef.current?.setSelectionRange?.(0, 0); }, 0);
                      }
                    }}
                    onBlur={() => setLyricChainIndex(null)}
                    placeholder={t('toolbar.lyricPlaceholder')}
                    className="px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 w-28 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    style={{ fontSize: `${Math.max(12, Math.min(72, Number(lyricFontSize) || 12))}px` }}
                    title={t('toolbar.lyricTitle')}
                  />
                  <span className="text-amber-600 text-xs">+</span>
                  <div className="flex gap-0.5" role="group" aria-label={t('toolbar.lyricExprMelisma')}>
                    <button type="button" onClick={() => { const idx = lyricChainIndex !== null ? lyricChainIndex : (selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor)); const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2'; const cur = key === 'lyric' ? (notes[idx]?.lyric ?? '') : (notes[idx]?.lyric2 ?? ''); setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: cur + '_' } : n)); lyricInputRef.current?.focus(); }} className="px-1.5 py-0.5 rounded text-sm bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 border border-amber-600/50" title={t('toolbar.lyricExprMelisma')}>_</button>
                    <button type="button" onClick={() => { const idx = lyricChainIndex !== null ? lyricChainIndex : (selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor)); const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2'; const cur = key === 'lyric' ? (notes[idx]?.lyric ?? '') : (notes[idx]?.lyric2 ?? ''); setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: cur + '\u2014' } : n)); lyricInputRef.current?.focus(); }} className="px-1.5 py-0.5 rounded text-sm bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 border border-amber-600/50" title={t('toolbar.lyricExprDash')}>—</button>
                    <button type="button" onClick={() => { const idx = lyricChainIndex !== null ? lyricChainIndex : (selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor)); const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2'; const cur = key === 'lyric' ? (notes[idx]?.lyric ?? '') : (notes[idx]?.lyric2 ?? ''); setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: cur + '\u00B7' } : n)); lyricInputRef.current?.focus(); }} className="px-1.5 py-0.5 rounded text-sm bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 border border-amber-600/50" title={t('toolbar.lyricExprDot')}>·</button>
                  </div>
                  <label className="text-xs font-medium text-amber-100 whitespace-nowrap">{t('toolbar.lyricLineOffset')}:</label>
                  <input type="number" min={-40} max={40} step={2} value={lyricLineYOffset} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) setLyricLineYOffset(Math.max(-40, Math.min(40, v))); dirtyRef.current = true; }} className="w-14 px-1.5 py-0.5 rounded text-sm bg-amber-100 text-amber-900 border border-amber-300 focus:ring-1 focus:ring-amber-500" title={t('toolbar.lyricLineOffset')} />
                </div>
                )}
              </>
            )}
            <button
              onClick={() => {
                setNoteInputMode(prev => {
                  if (!prev) {
                    setSelectedNoteIndex(-1);
                    setSelectionStart(-1);
                    setSelectionEnd(-1);
                    setMeasureSelection(null);
                    setActiveToolbox('rhythm');
                    if (notationStyle === 'TRADITIONAL' || notationMode === 'vabanotatsioon') {
                      setPianoStripVisible(true);
                    }
                  } else {
                    restNextRef.current = false;
                    setSelectedNoteIndex(-1);
                    setSelectionStart(-1);
                    setSelectionEnd(-1);
                    setMeasureSelection(null);
                    setPianoStripVisible(false);
                    setActiveToolbox(null);
                  }
                  return !prev;
                });
              }}
              className={`px-4 py-2 rounded font-bold transition-all ${
                noteInputMode 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-600 text-gray-100 hover:bg-gray-500'
              }`}
              title={noteInputMode ? t('toolbar.inputMode') : t('toolbar.selectionMode')}
            >
              {noteInputMode ? 'N' : 'SEL'}
            </button>
            {!noteInputMode && (
              <div className="flex gap-0.5 rounded overflow-hidden border border-amber-700/50 bg-amber-900/30" role="group" aria-label={t('toolbar.cursorTools')}>
                <button
                  type="button"
                  onClick={() => setCursorTool('select')}
                  className={`p-2 ${cursorTool === 'select' ? 'bg-amber-200 text-amber-900' : 'text-amber-100 hover:bg-amber-800/50'}`}
                  title={t('toolbar.toolSelect')}
                >
                  {MousePointer ? <MousePointer className="w-4 h-4" /> : <span className="text-xs font-bold">Sel</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setCursorTool('hand')}
                  className={`p-2 ${cursorTool === 'hand' ? 'bg-amber-200 text-amber-900' : 'text-amber-100 hover:bg-amber-800/50'}`}
                  title={t('toolbar.toolHand')}
                >
                  {Hand ? <Hand className="w-4 h-4" /> : <span className="text-xs font-bold">Hand</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setCursorTool('type')}
                  className={`p-2 ${cursorTool === 'type' ? 'bg-amber-200 text-amber-900' : 'text-amber-100 hover:bg-amber-800/50'}`}
                  title={t('toolbar.toolType')}
                >
                  {Type ? <Type className="w-4 h-4" /> : <span className="text-xs font-bold">A</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tööriistavalikud seadete riba all – nähtav kui mõni tööriist on aktiivne või klaviatuuri riba on avatud */}
      {(() => {
        const showTopToolDrawer = noteInputMode || (activeToolbox && toolboxes[activeToolbox]) || (pianoStripVisible && !activeToolbox);
        const isRhythmWideInNMode = noteInputMode && (activeToolbox === 'rhythm' || !activeToolbox);
        const isKeySignaturesToolbox = activeToolbox === 'keySignatures';
        const dualFigurenotesChordStrip =
          noteInputMode &&
          notationStyle === 'FIGURENOTES' &&
          figurenotesChordBlocks &&
          toolboxes.chords &&
          (activeToolbox === 'rhythm' || !activeToolbox);
        const rhythmStripCondition =
          toolboxes.rhythm &&
          (dualFigurenotesChordStrip
            ? activeToolbox === 'rhythm' || !activeToolbox
            : activeToolbox === 'rhythm' || (noteInputMode && activeToolbox !== 'chords'));
        return (
          <div
            className={`flex-shrink-0 flex justify-center border-t-2 border-amber-300 bg-amber-100/80 transition-all duration-200 ease-out origin-top ${
              showTopToolDrawer
                ? isKeySignaturesToolbox
                  ? 'max-h-[min(72vh,30rem)] py-2 opacity-100 translate-y-0'
                  : dualFigurenotesChordStrip
                    ? 'max-h-[min(72vh,30rem)] py-2 opacity-100 translate-y-0'
                    : 'max-h-56 py-2 opacity-100 translate-y-0'
                : 'max-h-0 py-0 opacity-0 -translate-y-2 pointer-events-none'
            }`}
          >
            <div
              className={`px-3 py-2 rounded-lg bg-gradient-to-b from-amber-100 to-amber-50 border border-amber-300 shadow-inner overflow-auto transition-all duration-200 ${
                dualFigurenotesChordStrip
                  ? 'w-full max-w-[min(100vw-2rem,92rem)] max-h-[min(50vh,18rem)] xl:max-h-[min(56vh,22rem)]'
                  : isRhythmWideInNMode
                    ? 'w-[min(100vw-2rem,78rem)] max-h-[7.5rem]'
                    : isKeySignaturesToolbox
                      ? 'w-[min(100vw-2rem,44rem)] max-h-[min(68vh,28rem)]'
                      : 'w-max max-w-[min(100vw-2rem,28rem)] max-h-[7.5rem]'
              }`}
            >
            {rhythmStripCondition ? (() => {
              const rhythmBody = (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mr-1 self-center">{t('toolbox.rhythm')}</span>
                  {toolboxes.rhythm.options.map((option, idx) => {
                    const isActive = (option.value === 'rest' && isRest) || (option.value === 'dotted' && isDotted) || (option.value === selectedDuration && option.value !== 'rest' && option.value !== 'dotted');
                    return (
                      <button
                        key={option.id}
                        type="button"
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'rhythm:' + idx); e.dataTransfer.effectAllowed = 'copy'; e.currentTarget.classList.add('opacity-70'); }}
                        onDragEnd={(e) => e.currentTarget.classList.remove('opacity-70')}
                        onClick={() => handleToolboxSelection(idx)}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-[3rem] transition-all cursor-grab active:cursor-grabbing ${isActive ? 'bg-amber-400 ring-2 shadow-md ring-[var(--primary-color)]' : 'bg-white/80 hover:bg-amber-100 border border-amber-200'}`}
                        title={`${option.label}. Lohistage noodilehele.`}
                      >
                        <span className="flex items-center justify-center gap-0.5 text-amber-900">
                          {notationStyle === 'FIGURENOTES' && ['1/1','1/2','1/4','1/8','1/16','1/32'].includes(option.value) ? (
                            <FigurenotesBlockIcon duration={option.value} className="w-8 h-5" />
                          ) : RHYTHM_SYLLABLE_IMAGES[option.value] ? (
                            <>
                              <img src={RHYTHM_SYLLABLE_IMAGES[option.value]} alt={option.label} className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden'); }} />
                              <span className="hidden"><RhythmIcon duration={option.value} /></span>
                            </>
                          ) : option.value === 'rest' ? <RhythmIcon duration={selectedDuration} isRest={true} /> : option.value === 'dotted' ? <RhythmIcon duration={selectedDuration} isDotted={true} /> : ['2/8','2/8+2/8','4/8','4/16','8/16','1/8+2/16','2/16+1/8','triplet-8','triplet-4','beam:auto','beam:2/8','beam:3/8','beam:4/8','beam:3/16'].includes(option.value) ? <RhythmPatternIcon pattern={option.value} /> : ['1/1','1/2','1/4','1/8','1/16','1/32'].includes(option.value) ? (<><RhythmIcon duration={option.value} /><RhythmIcon duration={option.value} isRest={true} /></>) : null}
                        </span>
                        {option.key != null && <kbd className="text-[10px] font-mono bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">{option.key}</kbd>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-amber-700 text-center">{t('rhythm.restShortcut')}</p>
                {(notationMode === 'traditional' || notationMode === 'vabanotatsioon') && (
                  <p className="text-[10px] text-amber-600 text-center mt-0.5">{t('noteInput.chordHint')}</p>
                )}
                {noteInputMode && toolboxes.pitchInput?.options?.length > 0 && (
                  <div className="pt-1 border-t border-amber-200">
                    <div className="text-[10px] text-amber-700 text-center mb-1">{t('toolbox.pitchInput')}</div>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {toolboxes.pitchInput.options.map((opt) => (
                        <button
                          key={`n-pitch-${opt.id}`}
                          type="button"
                          onClick={() => {
                            if (notationStyle === 'FIGURENOTES') {
                              addNoteAtCursor(opt.value, ghostOctave);
                            } else {
                              const refM = ghostReferenceMidi(
                                keySignature,
                                notationStyle,
                                ghostPitch,
                                ghostOctave,
                                ghostAccidental ?? 0,
                                ghostAccidentalIsExplicit
                              );
                              const octN = resolveOctaveForPitchLetter(
                                opt.value,
                                refM,
                                keySignature,
                                notationStyle,
                                ghostAccidentalIsExplicit,
                                ghostAccidental ?? 0
                              );
                              addNoteAtCursor(opt.value, octN);
                            }
                          }}
                          className="px-2 py-1 rounded bg-white/90 border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-100"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              );
              if (dualFigurenotesChordStrip) {
                const chordOpts = toolboxes.chords?.options ?? [];
                const rFrac = dualToolboxRhythmFraction;
                const chordPresetRow = (
                  <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-start">
                    <span className="mr-1 self-center text-xs font-bold tracking-wider text-amber-800 uppercase">
                      {toolboxes.chords?.name ?? t('toolbox.chords')}
                    </span>
                    {chordOpts.map((option, idx) => {
                      if (option.value === 'custom') return null;
                      const isSel = activeToolbox === 'chords' && selectedOptionIndex === idx;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => applyChordToolboxOptionAtIndex(idx)}
                          className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-left text-sm transition-all ${
                            isSel ? 'border-amber-600 bg-amber-200 ring-2 ring-[var(--primary-color)]' : 'border-amber-200 bg-white/80 hover:bg-amber-100'
                          }`}
                        >
                          <span className="truncate font-medium">{option.label}</span>
                          {option.key != null && (
                            <kbd className="rounded bg-amber-200/80 px-1 font-mono text-[10px] text-amber-900">{option.key}</kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
                return (
                  <div
                    ref={dualToolboxSplitRowRef}
                    className="flex w-full flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0"
                  >
                    <div className="min-w-0 w-full xl:min-h-0" style={{ flex: `${rFrac} 1 0%` }}>
                      {rhythmBody}
                    </div>
                    <div
                      className="hidden xl:flex flex-shrink-0 w-3 min-h-[4rem] select-none items-center justify-center self-stretch cursor-col-resize rounded border border-amber-300/70 bg-amber-200/40 hover:bg-amber-300/55 touch-none mx-1"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('toolbox.dualSplitResize')}
                      title={t('toolbox.dualSplitResize')}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const row = dualToolboxSplitRowRef.current;
                        if (!row) return;
                        dualToolboxSplitDragRef.current = {
                          startX: e.clientX,
                          startRatio: dualToolboxSplitFractionRef.current,
                          width: row.getBoundingClientRect().width,
                        };
                      }}
                    >
                      <span className="pointer-events-none h-12 w-0.5 rounded-full bg-amber-700/60" aria-hidden />
                    </div>
                    <div
                      className="flex min-w-0 w-full flex-col gap-1.5 border-t border-amber-200/80 pt-2 xl:min-h-0 xl:border-t-0 xl:pt-0 xl:pl-1"
                      style={{ flex: `${1 - rFrac} 1 0%` }}
                    >
                      {chordPresetRow}
                    </div>
                  </div>
                );
              }
              return rhythmBody;
            })() : (activeToolbox || pianoStripVisible) && activeToolbox !== 'rhythm' ? (
              <>
                <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{activeToolbox ? toolboxes[activeToolbox]?.name : (toolboxes.pianoKeyboard?.name || t('toolbox.pianoKeyboard'))}</h4>
                {activeToolbox === 'timeSignature' && selectedOptionIndex === 0 && (
                  <div className="mb-3 p-3 bg-white rounded border-2 border-amber-400">
                    <div className="text-center mb-2">
                      <div className="text-xs text-amber-700 uppercase font-bold mb-1">{t('timesig.current')}: {timeSignature.beats}/{timeSignature.beatUnit}</div>
                      <div className="text-xs text-amber-600">{t('timesig.mode')}: {timeSignatureMode === 'pedagogical' ? t('timesig.pedagogical') : t('timesig.classic')}</div>
                    </div>
                    <div className="flex gap-2 items-center justify-center">
                      <div className={`flex flex-col items-center p-2 rounded ${timeSignatureEditField === 'numerator' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <div className="text-xs text-gray-600 mb-1">{t('timesig.beats')}</div>
                        <div className="text-2xl font-bold text-amber-900">{timeSignature.beats}</div>
                        <div className="text-xs text-gray-500 mt-1">↑↓</div>
                      </div>
                      <div className="text-2xl font-bold text-amber-900">/</div>
                      <div className={`flex flex-col items-center p-2 rounded ${timeSignatureEditField === 'denominator' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <div className="text-xs text-gray-600 mb-1">{t('timesig.unit')}</div>
                        <div className="text-2xl font-bold text-amber-900">{timeSignature.beatUnit}</div>
                        <div className="text-xs text-gray-500 mt-1">↑↓</div>
                      </div>
                    </div>
                    <div className="text-xs text-center text-amber-600 mt-2">{t('timesig.tabHint')}</div>
                    {timeSignatureMode === 'pedagogical' && (
                      <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-semibold text-amber-900">
                            {t('timesig.denominatorType')}
                            <select value={pedagogicalTimeSigDenominatorType} onChange={(e) => { dirtyRef.current = true; setPedagogicalTimeSigDenominatorType(e.target.value); }} className="mt-1 w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs">
                              <option value="number">{t('timesig.denominatorType.number')}</option>
                              <option value="rhythm">{t('timesig.denominatorType.rhythm')}</option>
                              <option value="instrument">{t('timesig.denominatorType.instrument')}</option>
                              <option value="emoji">{t('timesig.denominatorType.emoji')}</option>
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-amber-900">
                            {t('timesig.denominatorColor')}
                            <input type="color" value={pedagogicalTimeSigDenominatorColor} onChange={(e) => { dirtyRef.current = true; setPedagogicalTimeSigDenominatorColor(e.target.value); }} className="mt-1 h-8 w-full rounded border border-amber-300 bg-amber-50 px-1" />
                          </label>
                        </div>
                        {pedagogicalTimeSigDenominatorType === 'instrument' && (
                          <label className="block text-xs font-semibold text-amber-900">
                            {t('timesig.denominatorInstrument')}
                            <select value={pedagogicalTimeSigDenominatorInstrument} onChange={(e) => { dirtyRef.current = true; setPedagogicalTimeSigDenominatorInstrument(e.target.value); }} className="mt-1 w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs">
                              <option value="handbell">{t('timesig.instrument.handbell')}</option>
                              <option value="boomwhacker">{t('timesig.instrument.boomwhacker')}</option>
                              <option value="triangle">{t('timesig.instrument.triangle')}</option>
                            </select>
                          </label>
                        )}
                        {pedagogicalTimeSigDenominatorType === 'emoji' && (
                          <label className="block text-xs font-semibold text-amber-900">
                            {t('timesig.denominatorEmoji')}
                            <input type="text" maxLength={4} value={pedagogicalTimeSigDenominatorEmoji} onChange={(e) => { dirtyRef.current = true; setPedagogicalTimeSigDenominatorEmoji(e.target.value || '🥁'); }} className="mt-1 w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm" placeholder="🥁" />
                          </label>
                        )}
                      </div>
                    )}
                    {notationStyle === 'FIGURENOTES' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200">
                        <label htmlFor="timesig-size" className="text-xs font-semibold text-amber-900 shrink-0">{t('timesig.size')}</label>
                        <input
                          id="timesig-size"
                          type="range"
                          min={12}
                          max={200}
                          step={1}
                          value={timeSignatureSize}
                          onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) { dirtyRef.current = true; setTimeSignatureSize(Math.max(12, Math.min(200, v))); } }}
                          className="flex-1 h-2 rounded-lg appearance-none bg-amber-100 accent-amber-600"
                        />
                        <span className="text-xs text-amber-800 w-8">{timeSignatureSize}</span>
                      </div>
                    )}
                  </div>
                )}
                {(activeToolbox === 'pianoKeyboard' || (pianoStripVisible && !activeToolbox)) && <p className="text-xs text-amber-700">{t('layout.keyboardHint')}</p>}
                {activeToolbox === 'chords' && (
                  <div className="mb-3 p-3 bg-white rounded border-2 border-amber-400 space-y-2">
                    <p className="text-xs text-amber-700">{t('chords.hint')} <kbd className="font-mono bg-amber-100 px-1 rounded">Ctrl+A</kbd> / <kbd className="font-mono bg-amber-100 px-1 rounded">Cmd+A</kbd>.</p>
                    <label className="block text-xs font-semibold text-amber-900">{t('chords.customLabel')}</label>
                    <input
                      ref={customChordInputRef}
                      type="text"
                      value={customChordInput}
                      onChange={(e) => setCustomChordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitCustomChordEntry();
                        }
                      }}
                      placeholder={t('chords.customPlaceholder')}
                      className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm"
                    />
                    <label className="block text-xs font-semibold text-amber-900">{t('chords.figuredBass')}</label>
                    <input type="text" value={customFiguredBassInput} onChange={(e) => setCustomFiguredBassInput(e.target.value)} placeholder={t('chords.figuredBassPlaceholder')} className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm" />
                    <button
                      type="button"
                      onClick={submitCustomChordEntry}
                      className="w-full py-1.5 px-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                    >
                      {t('chords.add')}
                    </button>
                    {notationStyle === 'FIGURENOTES' && (
                      <div className="pt-2 mt-2 border-t border-amber-200 space-y-2">
                        <div>
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-900">
                            <input
                              type="checkbox"
                              checked={figurenotesChordBlocks}
                              onChange={(e) => { dirtyRef.current = true; setFigurenotesChordBlocks(e.target.checked); }}
                              className="w-4 h-4 rounded border-amber-300 text-amber-600"
                            />
                            <span>{t('chords.chordBlocks')}</span>
                          </label>
                          <p className="text-[10px] text-amber-600 mt-0.5">{t('chords.chordBlocksHint')}</p>
                        </div>
                        {figurenotesChordBlocks && (
                          <div>
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-900">
                              <input
                                type="checkbox"
                                checked={figurenotesChordBlocksShowTones}
                                onChange={(e) => { dirtyRef.current = true; setFigurenotesChordBlocksShowTones(e.target.checked); }}
                                className="w-4 h-4 rounded border-amber-300 text-amber-600"
                              />
                              <span>{t('chords.chordBlocksShowTones')}</span>
                            </label>
                            <p className="text-[10px] text-amber-600 mt-0.5">{t('chords.chordBlocksShowTonesHint')}</p>
                          </div>
                        )}
                        <div className="pt-2 border-t border-amber-200">
                          <label className="block text-xs font-semibold text-amber-900 mb-1">{t('chords.chordLineGap')}</label>
                          <p className="text-[10px] text-amber-600 mb-1">{t('chords.chordLineGapHint')}</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={20}
                              value={figurenotesChordLineGap}
                              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) { dirtyRef.current = true; setFigurenotesChordLineGap(Math.max(0, Math.min(20, v))); } }}
                              className="flex-1 h-2 rounded-lg appearance-none bg-amber-100 accent-amber-600"
                            />
                            <span className="text-xs text-amber-800 w-8">{figurenotesChordLineGap} px</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeToolbox === 'textBox' && (
                  <div className="mb-3 p-3 bg-white rounded border-2 border-amber-400 space-y-3">
                    <p className="text-xs text-amber-700">{t('textBox.hint')}</p>
                    <div>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">{t('textBox.freeText')}</label>
                      <textarea
                        value={textBoxDraftText}
                        onChange={(e) => setTextBoxDraftText(e.target.value)}
                        placeholder={t('textBox.freeTextPlaceholder')}
                        rows={2}
                        className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm resize-y"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('textBox.tempoSection')}</h4>
                      <p className="text-xs text-amber-600 mb-2">{t('textBox.tempoHint')}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {toolboxes.textBox?.options?.map((option, idx) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleToolboxSelection(idx)}
                            className={`px-2 py-1 rounded text-xs font-medium ${selectedOptionIndex === idx ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-amber-900">{t('tempo.bpm')}</label>
                        <input
                          type="number"
                          min={20}
                          max={300}
                          value={textBoxTempoBpm}
                          onChange={(e) => setTextBoxTempoBpm(e.target.value)}
                          placeholder={t('tempo.bpmPlaceholder')}
                          className="w-16 px-2 py-1 rounded border border-amber-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="pt-2 mt-2 border-t border-amber-200 space-y-2">
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('textBox.documentFont')}</h4>
                      <p className="text-[10px] text-amber-600 mb-1">{t('textBox.documentFontHint')}</p>
                      <select
                        value={documentFontFamily}
                        onChange={(e) => { dirtyRef.current = true; setDocumentFontFamily(e.target.value); }}
                        className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm bg-white text-amber-900"
                        style={{ fontFamily: documentFontFamily }}
                      >
                        {getFontOptionElements(t)}
                      </select>
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-1 mt-2">{t('textBox.lyricFont')}</h4>
                      <p className="text-[10px] text-amber-600 mb-1">{t('textBox.lyricFontHint')}</p>
                      <select
                        value={lyricFontFamily}
                        onChange={(e) => { dirtyRef.current = true; setLyricFontFamily(e.target.value); }}
                        className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm bg-white text-amber-900"
                        style={{ fontFamily: lyricFontFamily }}
                      >
                        {getFontOptionElements(t)}
                      </select>
                      <label className="block text-xs font-semibold text-amber-900 mt-2 mb-0.5">{t('textBox.lyricFontSize')}</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={lyricFontSize}
                        onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v >= 1) { dirtyRef.current = true; setLyricFontSize(v); } }}
                        className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm bg-white text-amber-900"
                        title={t('textBox.lyricFontSizeHint')}
                      />
                    </div>
                    {selectedTextboxId && (
                      <>
                        <div className="pt-2 mt-2 border-t border-amber-200">
                          <label className="block text-xs font-semibold text-amber-900 mb-1">{t('textBox.textAlignment')}</label>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { value: 'left', label: t('textBox.alignLeft') },
                              { value: 'center', label: t('textBox.alignCenter') },
                              { value: 'right', label: t('textBox.alignRight') },
                              { value: 'justify', label: t('textBox.alignJustify') },
                            ].map(({ value, label }) => {
                              const box = textBoxes.find((b) => b.id === selectedTextboxId);
                              const isActive = (box?.textAlign ?? 'center') === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    dirtyRef.current = true;
                                    setTextBoxes((prev) => prev.map((b) => b.id === selectedTextboxId ? { ...b, textAlign: value } : b));
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium ${isActive ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="pt-2 mt-2 border-t border-amber-200">
                          <label className="block text-xs font-semibold text-amber-900 mb-1">{t('textBox.columnCount')}</label>
                          <div className="flex flex-wrap gap-1">
                            {[2, 3, 4, 5].map((count) => {
                              const box = textBoxes.find((b) => b.id === selectedTextboxId);
                              const isActive = Math.max(1, Math.min(5, Math.floor(Number(box?.columnCount) || 1))) === count;
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => {
                                    dirtyRef.current = true;
                                    setTextBoxes((prev) => prev.map((b) => b.id === selectedTextboxId ? { ...b, columnCount: count } : b));
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium ${isActive ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                                >
                                  {count}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-amber-600 mt-1">{t('textBox.columnCountHint')}</p>
                        </div>
                        <p className="text-xs text-amber-600 mt-2">{t('textBox.selected')}: Delete / Backspace {t('textBox.delete')}. {t('textBox.dragResizeHint')}</p>
                      </>
                    )}
                  </div>
                )}
                <div className="flex flex-col items-start gap-0.5">
                  {false && activeToolbox === 'instruments' && (
                    <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-amber-200 w-full">
                      <button
                        type="button"
                        onClick={() => { addStaff('single-staff-treble'); dirtyRef.current = true; }}
                        className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 border border-green-400"
                        title={t('toolbox.addInstrument')}
                      >
                        {t('toolbox.addInstrument')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const opts = toolboxes.instruments?.options ?? [];
                          const opt = opts[selectedOptionIndex]?.type === 'option' ? opts[selectedOptionIndex] : opts.find((o) => o.type === 'option');
                          if (opt?.type === 'option') {
                            setInstrument(opt.value);
                            dirtyRef.current = true;
                          }
                        }}
                        className="px-2 py-1 rounded text-xs font-medium bg-amber-200 text-amber-900 hover:bg-amber-300 border border-amber-400"
                        title={t('inst.replaceStaff')}
                      >
                        {t('inst.replaceStaff')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (staves.length > 1) { removeStaff(); dirtyRef.current = true; } }}
                        disabled={staves.length <= 1}
                        className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 border border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('inst.removeStaff')}
                      >
                        {t('inst.removeStaff')}
                      </button>
                    </div>
                  )}
                  {activeToolbox === 'notehead' && (
                    <div className="mt-3 pt-3 border-t border-amber-200 w-full space-y-3">
                      {noteheadShape === 'emoji' && (
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-amber-900 mb-1">{t('notehead.emojiPlaceholder')}</label>
                          <input
                            type="text"
                            value={noteheadEmoji}
                            onChange={(e) => { dirtyRef.current = true; setNoteheadEmoji(e.target.value || '♪'); }}
                            className="w-full px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-900 text-lg"
                            placeholder="♪ 🎵"
                            maxLength={4}
                          />
                        </div>
                      )}
                      <div className="text-xs font-bold text-amber-900 uppercase">{t('cursor.rulerTitle')}</div>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2">
                          <span className="text-xs font-medium text-amber-900 shrink-0">{t('cursor.lineThickness')}</span>
                          <input
                            type="range"
                            min={1}
                            max={8}
                            step={1}
                            value={cursorLineStrokeWidth}
                            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) { dirtyRef.current = true; setCursorLineStrokeWidth(Math.max(1, Math.min(8, v))); } }}
                            className="flex-1 h-2 rounded-lg appearance-none bg-amber-100 accent-amber-600"
                          />
                          <span className="text-xs text-amber-800 w-6">{cursorLineStrokeWidth} px</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-xs font-medium text-amber-900 shrink-0">{t('cursor.playheadSize')}</span>
                          <input
                            type="range"
                            min={1}
                            max={500}
                            step={2}
                            value={cursorSizePx}
                            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) { dirtyRef.current = true; setCursorSizePx(Math.max(1, Math.min(500, v))); } }}
                            className="flex-1 h-2 rounded-lg appearance-none bg-amber-100 accent-amber-600"
                          />
                          <span className="text-xs text-amber-800 w-10">{cursorSizePx} px</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-amber-600">{t('cursor.rulerHint')}</p>
                      <p className="text-[10px] text-amber-600 mt-1">{t('cursor.nModeKeys')}</p>
                    </div>
                  )}
                  {activeToolbox === 'clefs' && toolboxes.clefs?.options && (
                    <>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('toolbox.clefs')}>
                        {(toolboxes.clefs.options.filter((o) => o.value !== 'jo' || notationMode === 'vabanotatsioon')).map((option) => {
                          const idx = toolboxes.clefs.options.findIndex((opt) => opt.id === option.id);
                          const isClefActive = option.value === 'jo' ? notationMode === 'vabanotatsioon' : notationMode === 'traditional' && option.value === clefType;
                          const boxSize = 56;
                          const center = boxSize / 2;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleToolboxSelection(idx)}
                              aria-pressed={isClefActive}
                              aria-label={option.label}
                              className={`min-w-[56px] min-h-[56px] rounded-lg flex flex-col items-center justify-center gap-0.5 p-2 transition-all border-2 ${isClefActive ? 'border-[var(--primary-color)] bg-amber-100 shadow-md' : 'border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300'}`}
                            >
                              <svg viewBox={`0 0 ${boxSize} ${boxSize}`} className="w-12 h-12 shrink-0 text-amber-900" aria-hidden="true">
                                {option.value === 'jo' && <JoClefSymbol x={8} centerY={center} staffSpacing={6} stroke="currentColor" />}
                                {option.value === 'treble' && <TrebleClefSymbol x={center} y={center} height={36} fill="currentColor" />}
                                {option.value === 'bass' && <BassClefSymbol x={center} y={center} height={28} fill="currentColor" staffSpace={6} />}
                                {option.value === 'alto' && (
                                  <text x={center} y={center + 2} textAnchor="middle" dominantBaseline="middle" fontSize="28" fontFamily="serif" fontWeight="bold" fill="currentColor">C</text>
                                )}
                              </svg>
                              <span className="text-xs font-medium text-amber-900 truncate max-w-full">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {notationMode === 'vabanotatsioon' && (
                        <div className="w-full mt-3 pt-3 border-t border-amber-200">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                              checked={relativeNotationShowTraditionalClef}
                              onChange={(e) => { dirtyRef.current = true; setRelativeNotationShowTraditionalClef(e.target.checked); }}
                            />
                            <span className="text-xs font-medium text-amber-900 leading-snug">{t('toolbox.pedagogicalShowTrebleBassClef')}</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                  {activeToolbox === 'keySignatures' && toolboxes.keySignatures?.options && (
                    <div className="w-full space-y-2">
                      {notationMode === 'vabanotatsioon' && (
                        <div className="pb-2 border-b border-amber-200">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                              checked={relativeNotationShowKeySignature}
                              onChange={(e) => { dirtyRef.current = true; setRelativeNotationShowKeySignature(e.target.checked); }}
                            />
                            <span className="text-xs font-medium text-amber-900 leading-snug">{t('toolbox.pedagogicalShowKeySignatureMarks')}</span>
                          </label>
                        </div>
                      )}
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/90 px-2 py-1.5 text-left hover:bg-amber-50"
                        onClick={() => setKeySignaturesListExpanded((e) => !e)}
                        aria-expanded={keySignaturesListExpanded}
                        title={keySignaturesListExpanded ? t('toolbox.keySignaturesCollapsePicker') : t('toolbox.keySignaturesExpandPicker')}
                      >
                        <span className="text-xs font-semibold text-amber-900">{t('toolbox.keySignaturesPickerLabel')}</span>
                        <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
                          <span className="truncate text-xs font-medium text-amber-800">
                            {toolboxes.keySignatures.options.find((o) => o.value === keySignature)?.label ?? keySignature}
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-amber-700 transition-transform ${keySignaturesListExpanded ? 'rotate-180' : ''}`} aria-hidden />
                        </span>
                      </button>
                      {keySignaturesListExpanded && (
                        <div className="grid w-full grid-cols-3 gap-1.5 sm:grid-cols-4" role="group" aria-label={t('toolbox.keySignaturesPickerLabel')}>
                          {toolboxes.keySignatures.options.map((option, idx) => {
                            const isActive = option.value === keySignature;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => handleToolboxSelection(idx)}
                                className={`flex min-h-[2.25rem] items-center justify-center gap-1 rounded px-2 py-1.5 text-sm transition-all ${
                                  isActive ? 'bg-amber-200 ring-2 ring-[var(--primary-color)]' : 'bg-white/80 hover:bg-amber-100'
                                } border border-amber-200`}
                              >
                                <span className="font-medium text-amber-900">{option.label}</span>
                                {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                                {option.key != null && <kbd className="ml-0.5 rounded bg-amber-200/80 px-1 font-mono text-[10px] text-amber-900">{option.key}</kbd>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {activeToolbox === 'repeatsJumps' && (
                    <p className="text-xs text-amber-700 mt-1 mb-2 px-1" title={t('repeat.hint')}>{t('repeat.hint')}</p>
                  )}
                  {activeToolbox && activeToolbox !== 'pianoKeyboard' && activeToolbox !== 'rhythm' && activeToolbox !== 'textBox' && activeToolbox !== 'clefs' && activeToolbox !== 'instruments' && activeToolbox !== 'keySignatures' && toolboxes[activeToolbox]?.options?.map((option, idx) => {
                    if (activeToolbox === 'chords' && option.value === 'custom') return null;
                    if ((activeToolbox === 'instruments' || activeToolbox === 'repeatsJumps') && option.type === 'category') return <div key={option.id} className="pt-1.5 pb-0.5 px-1.5 text-xs font-bold text-amber-800 uppercase tracking-wide border-b border-amber-200 first:pt-0">{option.label}</div>;
                    const isActive = activeToolbox === 'timeSignature' && option.value === 'mode-toggle' ? false : activeToolbox === 'keySignatures' ? option.value === keySignature : activeToolbox === 'transpose' ? option.value === keySignature : activeToolbox === 'notehead' ? (option.value.startsWith('shape:') ? noteheadShape === option.value.slice(7) : option.value === notationMode) : activeToolbox === 'instruments' ? option.type === 'option' && option.value === instrument : activeToolbox === 'layout' ? (option.value === 'gridOnly' && notationStyle === 'FIGURENOTES') || (option.id === 'staff-5' && notationStyle === 'TRADITIONAL' && staffLines === 5) || (option.id === 'staff-1' && notationStyle === 'TRADITIONAL' && staffLines === 1) || (option.id?.startsWith('spacing-') && pixelsPerBeat === option.value) : selectedOptionIndex === idx;
                    return (
                      <button key={option.id} onClick={() => handleToolboxSelection(idx)} className={`w-fit max-w-full px-2 py-1 rounded text-left text-sm transition-all flex items-center gap-2 flex-wrap ${(['layout', 'keySignatures', 'transpose', 'instruments', 'notehead'].includes(activeToolbox) ? isActive : selectedOptionIndex === idx) ? 'bg-amber-200 border-l-2 border-amber-600' : 'hover:bg-amber-100'}`}>
                        <span className="font-medium truncate">{option.label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {activeToolbox === 'timeSignature' && option.value === 'mode-toggle' && <span className="text-xs text-amber-600">({timeSignatureMode === 'pedagogical' ? t('timesig.pedagogical') : t('timesig.classic')})</span>}
                        {option.key && <span className="text-xs text-amber-600 font-mono shrink-0">({option.key})</span>}
                      </button>
                    );
                  })}
                </div>
                {false && activeToolbox === 'instruments' && (() => {
                  const cfg = instrumentConfig[instrument];
                  if (!cfg || cfg.type === 'standard') return null;
                  if (cfg.type === 'tab') return (<div className="mt-3 pt-3 border-t-2 border-amber-200"><h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('inst.view')}</h4><div className="flex gap-2"><button type="button" onClick={() => setInstrumentNotationVariant('standard')} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'standard' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('inst.staff')}</button><button type="button" onClick={() => setInstrumentNotationVariant('tab')} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'tab' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('inst.tab')}</button></div></div>);
                  if (cfg.type === 'wind' && cfg.fingering) return (<div className="mt-3 pt-3 border-t-2 border-amber-200"><h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('inst.view')}</h4><div className="flex gap-2"><button type="button" onClick={() => setInstrumentNotationVariant('standard')} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'standard' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('inst.staff')}</button><button type="button" onClick={() => setInstrumentNotationVariant('fingering')} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'fingering' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('inst.fingering')}</button></div></div>);
                  if (cfg.type === 'figuredBass') return (<div className="mt-3 pt-3 border-t-2 border-amber-200"><h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('inst.view')}</h4><div className="flex gap-2"><button type="button" onClick={() => setInstrumentNotationVariant('standard')} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'standard' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('inst.staff')}</button><button type="button" onClick={() => setInstrumentNotationVariant('figuredBass')} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'figuredBass' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('inst.figuredBass')}</button></div></div>);
                  return null;
                })()}
                {activeToolbox === 'layout' && (
                  <>
                    <div className="mt-2 mb-2 px-2 py-1.5 rounded bg-amber-100/80 border border-amber-300 text-amber-900 text-xs">
                      {viewMode === 'score' ? t('view.layoutForScore') : t('view.layoutForPart')}
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-amber-200">
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.measuresPerLine')}</h4>
                      <p className="text-xs text-amber-700 mb-2">{t('layout.measuresPerLineHint')}</p>
                      <div className="flex flex-wrap gap-1 mb-3">{(pageOrientation === 'landscape' ? [2, 4, 6, 8, 12, 16] : [2, 3, 4, 6, 8]).map((n) => (
                        <button key={n} type="button" onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutMeasuresPerLine : setPartLayoutMeasuresPerLine)(n); }} className={`px-2 py-1 rounded text-sm font-medium ${effectiveLayoutMeasuresPerLine === n ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{n}</button>
                      ))}</div>
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.partsGap')} (mm/cm/px)</h4>
                        <p className="text-xs text-amber-700 mb-1">{t('layout.partsGapHint')}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] text-amber-700">Mootuhik:</span>
                          <button
                            type="button"
                            onClick={() => { dirtyRef.current = true; setLayoutSizeUnit('mm'); }}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${layoutSizeUnit === 'mm' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            mm
                          </button>
                          <button
                            type="button"
                            onClick={() => { dirtyRef.current = true; setLayoutSizeUnit('cm'); }}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${layoutSizeUnit === 'cm' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            cm
                          </button>
                        </div>
                        {notationStyle === 'FIGURENOTES' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={2}
                              max={80}
                              step={2}
                              value={layoutPartsGap}
                              onChange={(e) => {
                                dirtyRef.current = true;
                                setLayoutPartsGap(Math.max(2, Math.min(80, Number(e.target.value))));
                              }}
                              className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                            />
                            <span className="text-sm font-medium text-amber-900 w-14 tabular-nums">{layoutPartsGap} px</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const stepMm = layoutSizeUnit === 'cm' ? 1 : 0.5;
                                dirtyRef.current = true;
                                setLayoutPartsGapMm((prev) => Math.max(0, Math.min(100, (Number(prev) || 0) - stepMm)));
                              }}
                              className="px-2 py-1 rounded bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200"
                              title="Vahenda vahet"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={layoutSizeUnit === 'cm' ? 0 : 0}
                              max={layoutSizeUnit === 'cm' ? 10 : 100}
                              step={layoutSizeUnit === 'cm' ? 0.1 : 1}
                              value={layoutSizeUnit === 'cm' ? (Math.round((layoutPartsGapMm / 10) * 10) / 10) : (Math.round(layoutPartsGapMm * 10) / 10)}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                if (!Number.isFinite(raw)) return;
                                const mmValue = layoutSizeUnit === 'cm' ? raw * 10 : raw;
                                dirtyRef.current = true;
                                setLayoutPartsGapMm(Math.max(0, Math.min(100, mmValue)));
                              }}
                              className="w-24 px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900 text-sm font-medium tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const stepMm = layoutSizeUnit === 'cm' ? 1 : 0.5;
                                dirtyRef.current = true;
                                setLayoutPartsGapMm((prev) => Math.max(0, Math.min(100, (Number(prev) || 0) + stepMm)));
                              }}
                              className="px-2 py-1 rounded bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200"
                              title="Suurenda vahet"
                            >
                              +
                            </button>
                            <span className="text-sm font-medium text-amber-900">{layoutSizeUnit}</span>
                          </div>
                        )}
                        {notationStyle !== 'FIGURENOTES' && (
                          <p className="text-[11px] text-amber-700 mt-1">
                            Moot: 1. instrumendi alumine joon kuni 2. instrumendi ulemine joon.
                          </p>
                        )}
                      </div>
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.systemGap')} (px)</h4>
                        <p className="text-xs text-amber-700 mb-1">{t('layout.systemGapHint')}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={5}
                            max={200}
                            step={5}
                            value={layoutSystemGap}
                            onChange={(e) => { dirtyRef.current = true; setLayoutSystemGap(Math.max(5, Math.min(250, Number(e.target.value)))); }}
                            className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                          />
                          <span className="text-sm font-medium text-amber-900 w-10 tabular-nums">{layoutSystemGap}</span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={effectiveLayoutConnectedBarlines}
                            disabled={isTraditionalMultiStaff}
                            onChange={(e) => { dirtyRef.current = true; setLayoutConnectedBarlines(e.target.checked); }}
                            className="mt-1 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>
                            <span className="text-sm font-semibold text-amber-900 block">{t('layout.connectedBarlines')}</span>
                            <span className="text-xs text-amber-700">{isTraditionalMultiStaff ? 'Mitme instrumendi traditsioonivaates on ühendatud taktijooned alati sees.' : t('layout.connectedBarlinesHint')}</span>
                          </span>
                        </label>
                      </div>
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.globalSpacing')}</h4>
                        <p className="text-xs text-amber-700 mb-1">{t('layout.globalSpacingHint')}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={12}
                          max={100}
                            step={1}
                            value={figurenotesSize}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) { dirtyRef.current = true; setFigurenotesSize(Math.max(12, Math.min(100, v))); }
                            }}
                            className="w-20 px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                          />
                          <span className="text-sm font-medium text-amber-900">px</span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.pixelsPerBeatLabel')} (px)</h4>
                        <p className="text-xs text-amber-700 mb-1">{t('layout.pixelsPerBeatHint')}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={40}
                          max={500}
                            step={1}
                            value={pixelsPerBeat}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) { dirtyRef.current = true; setPixelsPerBeat(Math.max(40, Math.min(500, v))); }
                            }}
                            className="w-20 px-2 py-1.5 rounded border-2 border-amber-200 bg-amber-50 text-amber-900"
                          />
                          <span className="text-sm font-medium text-amber-900">px</span>
                        </div>
                      </div>
                      {notationStyle === 'FIGURENOTES' && (
                        <div className="mb-4 pt-4 border-t-2 border-amber-200">
                          <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.staffRowAlignment')}</h4>
                          <p className="text-xs text-amber-700 mb-2">{t('layout.staffRowAlignmentHint')}</p>
                          <div className="flex gap-2">
                            {(['left', 'center', 'right']).map((align) => (
                              <button key={align} type="button" onClick={() => { dirtyRef.current = true; setStaffRowAlignment(align); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${staffRowAlignment === align ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{align === 'left' ? t('layout.alignLeft') : align === 'center' ? t('layout.alignCenter') : t('layout.alignRight')}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-amber-700 mb-2 py-1.5 px-2 rounded bg-slate-100 border border-slate-200 text-slate-800">{t('layout.staffSpacerHint')}</p>
                      <p className="text-xs text-amber-700 mb-1">Paigutuse muudatus kehtib kursorit sisaldava takti suhtes. Liigu kursoriga (← →) soovitud takti.</p>
                      <div className="mb-2 px-2 py-1.5 rounded bg-amber-100 border border-amber-200 text-amber-900 text-sm font-medium">{t('layout.cursorInMeasure')}: {cursorMeasureIndex + 1}</div>
                      <div className="mb-2">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.lineBreakSection')}</h4>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { if (cursorMeasureIndex <= 0) return; dirtyRef.current = true; (viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore)((prev) => [...new Set([...prev, cursorMeasureIndex])].sort((a, b) => a - b)); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.nextLine')}</button>
                          <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore)((prev) => prev.filter((i) => i !== cursorMeasureIndex)); }} className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.removeLineBreak')}</button>
                        </div>
                      </div>
                      <div className="mb-2">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.pageBreakSection')}</h4>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { if (cursorMeasureIndex <= 0) return; dirtyRef.current = true; (viewMode === 'score' ? setLayoutPageBreakBefore : setPartLayoutPageBreakBefore)((prev) => [...new Set([...prev, cursorMeasureIndex])].sort((a, b) => a - b)); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.newPage')}</button>
                          <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutPageBreakBefore : setPartLayoutPageBreakBefore)((prev) => prev.filter((i) => i !== cursorMeasureIndex)); }} className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.removePageBreak')}</button>
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 mt-2 mb-1">{t('layout.measureWidthHint')}</p>
                      <div className="mb-2 pt-2 border-t border-amber-200">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">Leheküljed</h4>
                        <p className="text-xs text-amber-700 mb-2">Lisa või eemalda lõppu tühje lehekülgi (sobib tööleheks / tekstikastideks).</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              dirtyRef.current = true;
                              (viewMode === 'score' ? setLayoutExtraPages : setPartLayoutExtraPages)((prev) => Math.max(0, (Number(prev) || 0) + 1));
                            }}
                            className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium"
                          >
                            + Lisa lehekülg
                          </button>
                          <button
                            type="button"
                            disabled={(viewMode === 'score' ? layoutExtraPages : partLayoutExtraPages) <= 0}
                            onClick={() => {
                              dirtyRef.current = true;
                              (viewMode === 'score' ? setLayoutExtraPages : setPartLayoutExtraPages)((prev) => Math.max(0, (Number(prev) || 0) - 1));
                            }}
                            className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            − Eemalda lehekülg
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <button type="button" title={t('layout.compressMeasureShortcut')} onClick={() => { dirtyRef.current = true; setMeasureStretchFactors((prev) => { const next = [...(prev || [])]; while (next.length <= cursorMeasureIndex) next.push(1); next[cursorMeasureIndex] = Math.max(0.25, (next[cursorMeasureIndex] ?? 1) - 0.1); return next; }); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium">{t('layout.compressMeasure')}</button>
                        <button type="button" title={t('layout.stretchMeasureShortcut')} onClick={() => { dirtyRef.current = true; setMeasureStretchFactors((prev) => { const next = [...(prev || [])]; while (next.length <= cursorMeasureIndex) next.push(1); next[cursorMeasureIndex] = Math.min(4, (next[cursorMeasureIndex] ?? 1) + 0.1); return next; }); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium">{t('layout.stretchMeasure')}</button>
                      </div>
                      <button type="button" onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore)([]); (viewMode === 'score' ? setLayoutPageBreakBefore : setPartLayoutPageBreakBefore)([]); (viewMode === 'score' ? setLayoutMeasuresPerLine : setPartLayoutMeasuresPerLine)(0); (viewMode === 'score' ? setLayoutExtraPages : setPartLayoutExtraPages)(0); setMeasureStretchFactors([]); setSystemYOffsets([]); setLayoutSystemGap(15); setLayoutPartsGap(10); setLayoutConnectedBarlines(true); setLayoutGlobalSpacingMultiplier(1); setPixelsPerBeat(85); setFigurenotesSize(85); }} className="mt-3 w-full py-2 px-3 rounded-lg bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200 border border-slate-300" title={t('layout.resetLayoutHint')}>{t('layout.resetLayout')}</button>
                    </div>
                    {pageDesignDataUrl && (
                      <>
                        <div className="mt-4 pt-4 border-t-2 border-amber-200">
                          <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.pageDesignTitle')}</h4>
                          <div className="flex flex-col gap-2">
                            <button type="button" title={t('layout.pageDesignReplaceHint')} onClick={() => { pageDesignInputRef.current?.click(); }} className="w-full py-1.5 px-2 rounded text-sm font-medium bg-amber-100 text-amber-800 hover:bg-amber-200">{t('layout.pageDesignReplace')}</button>
                            <button type="button" title={t('layout.pageDesignRemoveHint')} onClick={() => { dirtyRef.current = true; setPageDesignDataUrl(null); }} className="w-full py-1.5 px-2 rounded text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200">{t('layout.pageDesignRemove')}</button>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-amber-200">
                          <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.pageDesignFitTitle')}</h4>
                          <div className="flex gap-2">
                            <button type="button" title={t('layout.pageDesignFitCoverHint')} onClick={() => { dirtyRef.current = true; setPageDesignFit('cover'); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${pageDesignFit === 'cover' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('layout.pageDesignFitCover')}</button>
                            <button type="button" title={t('layout.pageDesignFitContainHint')} onClick={() => { dirtyRef.current = true; setPageDesignFit('contain'); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${pageDesignFit === 'contain' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('layout.pageDesignFitContain')}</button>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-amber-200">
                          <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.pageDesignPositionTitle')}</h4>
                          <p className="text-xs text-amber-700 mb-2">{t('layout.pageDesignPositionHint')}</p>
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageDesignPositionX(50); setPageDesignPositionY(50); }} className="w-full py-1.5 px-2 rounded text-sm font-medium bg-amber-100 text-amber-800 hover:bg-amber-200">{t('layout.pageDesignPositionReset')}</button>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-amber-200">
                          <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.pageDesignCropTitle')}</h4>
                          <p className="text-xs text-amber-700 mb-2">{t('layout.pageDesignCropHint')}</p>
                          <div className="grid grid-cols-4 gap-1">
                            <input type="number" min={0} max={50} step={1} value={pageDesignCrop.top} onChange={(e) => { dirtyRef.current = true; const v = clampNumber(Number(e.target.value) || 0, 0, 50); setPageDesignCrop((c) => ({ ...c, top: v })); }} className="w-full px-1 py-1 rounded border border-amber-300 text-sm text-center" title="Ülemine %" aria-label="Crop top" />
                            <input type="number" min={0} max={50} step={1} value={pageDesignCrop.right} onChange={(e) => { dirtyRef.current = true; const v = clampNumber(Number(e.target.value) || 0, 0, 50); setPageDesignCrop((c) => ({ ...c, right: v })); }} className="w-full px-1 py-1 rounded border border-amber-300 text-sm text-center" title="Parem %" aria-label="Crop right" />
                            <input type="number" min={0} max={50} step={1} value={pageDesignCrop.bottom} onChange={(e) => { dirtyRef.current = true; const v = clampNumber(Number(e.target.value) || 0, 0, 50); setPageDesignCrop((c) => ({ ...c, bottom: v })); }} className="w-full px-1 py-1 rounded border border-amber-300 text-sm text-center" title="Alumine %" aria-label="Crop bottom" />
                            <input type="number" min={0} max={50} step={1} value={pageDesignCrop.left} onChange={(e) => { dirtyRef.current = true; const v = clampNumber(Number(e.target.value) || 0, 0, 50); setPageDesignCrop((c) => ({ ...c, left: v })); }} className="w-full px-1 py-1 rounded border border-amber-300 text-sm text-center" title="Vasak %" aria-label="Crop left" />
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-amber-200">
                          <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.pageDesignLayerTitle')}</h4>
                          <p className="text-xs text-amber-700 mb-2">{t('layout.pageDesignLayerHint')}</p>
                        </div>
                      </>
                    )}
                    <div className="mt-4 pt-4 border-t-2 border-amber-200">
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.projectFile')}</h4>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={downloadProject} className="w-full py-2 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500">{t('layout.saveProject')}</button>
                        <button type="button" onClick={() => { setPianoStripVisible(false); projectFileInputRef.current?.click(); }} className="w-full py-2 px-3 rounded-lg bg-slate-600 text-white text-sm font-semibold hover:bg-slate-500">{t('layout.openProject')}</button>
                        <input ref={projectFileInputRef} type="file" accept=".json,.nm,application/json" className="hidden" onChange={handleOpenProjectFile} />
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}
            </div>
          </div>
        );
      })()}

      </div>

      {isInstrumentManagerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true" aria-label="Instrument manager">
          <div className="relative w-full max-w-6xl max-h-[86vh] overflow-hidden rounded-xl border border-slate-500 bg-slate-100 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 bg-slate-800 text-slate-100">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Instruments</h3>
                <p className="text-xs text-slate-300">Shift+7 avab/sulgeb. Esc sulgeb.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setIsInstrumentManagerOpen(false); setCopyInstrumentConfirm(null); }} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold">Sulge</button>
                <button
                  type="button"
                  onClick={() => { setIsInstrumentManagerOpen(false); setCopyInstrumentConfirm(null); }}
                  className="p-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
                  title="Sulge (Esc)"
                  aria-label="Sulge instrumentide aken"
                >
                  {icons?.X ? <icons.X className="w-4 h-4" /> : <span className="text-xs font-bold">X</span>}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[calc(86vh-56px)]">
              <section className="border-r border-slate-300 p-4 overflow-auto">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-3">Vasak aken: valik</h4>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {INSTRUMENT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setInstrumentManagerSelectedCatalogId(cat.id)}
                      className={`px-2 py-1 rounded text-xs border ${instrumentManagerSelectedCatalogId === cat.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                    >
                      {t(cat.labelKey)}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {(INSTRUMENT_CATEGORIES.find((c) => c.id === instrumentManagerSelectedCatalogId)?.instruments || []).map((instId) => {
                    const cfg = instrumentConfig[instId];
                    if (!cfg) return null;
                    return (
                      <div key={instId} className="flex items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{cfg.label}</div>
                          <div className="text-[10px] text-slate-500">{cfg.range || '-'}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addInstrumentToScore(instId)}
                          className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                        >
                          Lisa
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="p-4 overflow-auto">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-3">Parem aken: lisatud / kasutusel</h4>
                <div className="space-y-1.5">
                  {staves.map((staff, idx) => {
                    const isSelected = instrumentManagerSelectedStaffId === staff.id;
                    const isChecked = instrumentManagerSelectedStaffIds.includes(staff.id);
                    const braceWithPrev = idx > 0 && staves[idx - 1]?.braceGroupId && staves[idx - 1]?.braceGroupId === staff.braceGroupId;
                    const instLabel = INSTRUMENT_I18N_KEYS?.[staff.instrumentId] ? t(INSTRUMENT_I18N_KEYS[staff.instrumentId]) : (staff.instrumentId || 'Instrument');
                    const staffCfg = instrumentConfig?.[staff.instrumentId];
                    const supportsLinkedNotation = staffCfg?.type === 'tab' || (staffCfg?.type === 'wind' && staffCfg?.fingering);
                    const linkedLabel = staffCfg?.type === 'tab' ? 'Linki TAB rida' : 'Linki sõrmestus';
                    const linkedChecked = !!linkedNotationByStaffId?.[staff.id];
                    return (
                      <div key={staff.id} className={`rounded border px-2 py-1.5 ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setInstrumentManagerSelectedStaffIds((prev) => checked ? Array.from(new Set([...(prev || []), staff.id])) : (prev || []).filter((id) => id !== staff.id));
                              }}
                            />
                            <button type="button" onClick={() => { setInstrumentManagerSelectedStaffId(staff.id); setActiveStaffIndex(idx); }} className="text-left min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{instLabel}{braceWithPrev ? ' (II)' : ''}</div>
                              <div className="text-[10px] text-slate-500">Clef: {staff.clefType} · Notes: {(staff.notes || []).length}</div>
                            </button>
                          </label>
                          {supportsLinkedNotation && (
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={linkedChecked}
                                onChange={(e) => {
                                  const checked = !!e.target.checked;
                                  setLinkedNotationByStaffId((prev) => ({ ...(prev || {}), [staff.id]: checked }));
                                  dirtyRef.current = true;
                                }}
                              />
                              <span>{linkedLabel}</span>
                            </label>
                          )}
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => reorderStaffById(staff.id, 'up')} className="px-2 py-1 rounded border border-slate-300 text-xs hover:bg-slate-100">↑</button>
                            <button type="button" onClick={() => reorderStaffById(staff.id, 'down')} className="px-2 py-1 rounded border border-slate-300 text-xs hover:bg-slate-100">↓</button>
                            <button type="button" onClick={() => setCopyInstrumentConfirm({ staffId: staff.id })} className="px-2 py-1 rounded border border-indigo-300 text-indigo-700 text-xs hover:bg-indigo-50">Kopeeri</button>
                            <button type="button" onClick={() => removeStaffById(staff.id)} disabled={staves.length <= 1} className="px-2 py-1 rounded border border-rose-300 text-rose-700 text-xs hover:bg-rose-50 disabled:opacity-50">Kustuta</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {staves.some((s) => {
                  const id = s?.instrumentId;
                  return id === 'tin-whistle' || (typeof id === 'string' && id.startsWith('tin-whistle-'));
                }) && (
                  <div className="mt-3 rounded border border-slate-300 bg-white px-3 py-2">
                    <label htmlFor="tw-linked-fingering-size" className="block text-xs font-semibold text-slate-800 mb-1">
                      {t('inst.tinWhistleLinkedFingeringSize')}
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="px-2 py-1 rounded border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50"
                        onClick={() => {
                          dirtyRef.current = true;
                          setTinWhistleLinkedFingeringScalePercent((p) => Math.max(50, Math.round(p) - 5));
                        }}
                        aria-label={t('inst.tinWhistleLinkedFingeringSizeDec')}
                      >
                        −
                      </button>
                      <input
                        id="tw-linked-fingering-size"
                        type="number"
                        min={50}
                        max={500}
                        step={1}
                        value={tinWhistleLinkedFingeringScalePercent}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) return;
                          dirtyRef.current = true;
                          setTinWhistleLinkedFingeringScalePercent(Math.round(Math.max(50, Math.min(500, raw))));
                        }}
                        className="w-20 px-2 py-1.5 rounded border border-slate-300 text-slate-900 text-sm font-medium tabular-nums"
                      />
                      <span className="text-xs text-slate-600">%</span>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50"
                        onClick={() => {
                          dirtyRef.current = true;
                          setTinWhistleLinkedFingeringScalePercent((p) => Math.min(500, Math.round(p) + 5));
                        }}
                        aria-label={t('inst.tinWhistleLinkedFingeringSizeInc')}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto px-2 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50"
                        onClick={() => {
                          dirtyRef.current = true;
                          setTinWhistleLinkedFingeringScalePercent(50);
                        }}
                      >
                        {t('inst.tinWhistleLinkedFingeringSizeReset')}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">{t('inst.tinWhistleLinkedFingeringSizeHint')}</p>
                  </div>
                )}
                <div className="mt-3 border-t border-slate-300 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const ids = (instrumentManagerSelectedStaffIds || []).filter((id) => staves.some((s) => s.id === id));
                        if (ids.length < 2) {
                          setSaveFeedback('Vali vähemalt 2 partiid grupi loomiseks.');
                          setTimeout(() => setSaveFeedback(''), 1800);
                          return;
                        }
                        const name = (typeof window !== 'undefined' ? window.prompt('Grupi nimi', `Group ${instrumentPartGroups.length + 1}`) : '') || `Group ${instrumentPartGroups.length + 1}`;
                        const gid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `grp-${Date.now()}`;
                        setInstrumentPartGroups((prev) => [...(prev || []), { id: gid, name, staffIds: ids }]);
                        dirtyRef.current = true;
                      }}
                      className="px-2.5 py-1.5 rounded bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
                    >
                      Loo partii-grupp
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleStaves(staves.map(() => true))}
                      className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-100"
                    >
                      Näita kõiki partiisid
                    </button>
                  </div>
                  {(instrumentPartGroups || []).length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {instrumentPartGroups.map((g) => (
                        <div key={g.id} className="flex items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5">
                          <div className="text-xs text-slate-800 font-medium truncate">{g.name} ({(g.staffIds || []).length})</div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setVisibleStaves(staves.map((s) => (g.staffIds || []).includes(s.id)));
                                dirtyRef.current = true;
                              }}
                              className="px-2 py-1 rounded border border-slate-300 text-xs hover:bg-slate-100"
                            >
                              Ava grupp
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setInstrumentPartGroups((prev) => (prev || []).filter((x) => x.id !== g.id));
                                dirtyRef.current = true;
                              }}
                              className="px-2 py-1 rounded border border-rose-300 text-rose-700 text-xs hover:bg-rose-50"
                            >
                              Kustuta
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
            {copyInstrumentConfirm?.staffId && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center px-4">
                <div className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-4 shadow-xl">
                  <h5 className="text-sm font-bold text-slate-900 mb-2">Kopeeri instrument</h5>
                  <p className="text-xs text-slate-600 mb-3">Kas kopeerida nootidega või ilma nootideta?</p>
                  <div className="flex items-center gap-2 justify-end">
                    <button type="button" onClick={() => setCopyInstrumentConfirm(null)} className="px-2.5 py-1.5 rounded border border-slate-300 text-xs">Loobu</button>
                    <button type="button" onClick={() => { copyStaffById(copyInstrumentConfirm.staffId, false); setCopyInstrumentConfirm(null); }} className="px-2.5 py-1.5 rounded border border-indigo-300 text-indigo-700 text-xs">Ilma nootideta</button>
                    <button type="button" onClick={() => { copyStaffById(copyInstrumentConfirm.staffId, true); setCopyInstrumentConfirm(null); }} className="px-2.5 py-1.5 rounded bg-indigo-600 text-white text-xs">Nootidega</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`flex flex-1 ${pianoStripVisible ? 'pb-36' : ''}`}>
        {/* Left Sidebar - Main Control Center (saab peita X-ga või Vaade → Tööriistakast) */}
        {toolboxPaletteVisible && (
        <aside className="flex-shrink-0 w-72 bg-white dark:bg-black border-r-2 border-amber-200 dark:border-white/20 shadow-xl p-6 overflow-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-amber-600"></span>
                {t('toolbar.palette')}
              </h3>
              <button
                type="button"
                onClick={() => setToolboxPaletteVisiblePersist(false)}
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 hover:text-amber-800 transition-colors"
                title={t('view.toolboxPaletteHint')}
              >
                {icons?.X && <icons.X className="w-5 h-5" />}
              </button>
            </div>

            {/* Nähtavad tööriistad – rippmenüü */}
            <div className="relative mb-3" ref={visibleToolsMenuRef}>
              <button
                type="button"
                onClick={() => setVisibleToolsMenuOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-100 dark:bg-black border border-amber-300 dark:border-white/20 text-amber-900 dark:text-white text-sm font-medium hover:bg-amber-200 dark:hover:bg-white/10"
              >
                <span>{t('toolbar.visibleTools')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${visibleToolsMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {visibleToolsMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 py-2 rounded-lg bg-white dark:bg-black border-2 border-amber-300 dark:border-white/20 shadow-lg z-50 max-h-64 overflow-auto">
                  {TOOLBOX_ORDER.map((id) => {
                    const tb = toolboxes[id];
                    if (!tb) return null;
                    const isVisible = visibleToolIds.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-white/10 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => {
                            setVisibleToolIds(prev =>
                              isVisible ? prev.filter(x => x !== id) : [...prev.filter(x => x !== id), id].sort((a, b) => TOOLBOX_ORDER.indexOf(a) - TOOLBOX_ORDER.indexOf(b))
                            );
                          }}
                          className="rounded border-amber-400"
                        />
                        <span className="text-sm">{tb.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {TOOLBOX_ORDER.filter((id) => visibleToolIds.includes(id)).map((id) => {
              const toolbox = toolboxes[id];
              if (!toolbox) return null;
              const renderIcon = () => {
                switch (id) {
                  case 'rhythm': return notationStyle === 'FIGURENOTES' ? <FigurenotesBlockIcon duration={selectedDuration} className="w-5 h-5" /> : <RhythmToolboxButtonIcon />;
                  case 'timeSignature':
                    return timeSignatureMode === 'pedagogical'
                      ? <PedagogicalMeterIcon beats={timeSignature.beats} beatUnit={timeSignature.beatUnit} />
                      : <MeterIcon beats={timeSignature.beats} beatUnit={timeSignature.beatUnit} />;
                  case 'clefs': return <ClefIcon clefType={notationMode === 'vabanotatsioon' ? 'jo' : clefType} />;
                  case 'keySignatures': return <KeySignatureDmajorIcon />;
                  case 'transpose': {
                    const ArrowUpDown = icons?.ArrowUpDown;
                    return ArrowUpDown ? <ArrowUpDown className="w-5 h-5" /> : <Key className="w-5 h-5" />;
                  }
                  case 'pitchInput': return <PitchIcon />;
                  case 'notehead': return <NoteheadIcon />;
                  case 'layout': return <LayoutIcon staffLines={staffLines} />;
                  case 'instruments': return <InstrumentIcon instrument="violin" />;
                  case 'repeatsJumps': return <Repeat className="w-5 h-5" />;
                  case 'chords': return <ChordIcon />;
                  default: {
                    const Icon = typeof toolbox?.icon === 'string' ? icons?.[toolbox.icon] : toolbox?.icon;
                    return Icon ? <Icon className="w-5 h-5" /> : null;
                  }
                }
              };

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (noteInputMode && !N_MODE_PRIMARY_TOOL_IDS.includes(id)) return;
                    if (id === 'instruments') {
                      setIsInstrumentManagerOpen((prev) => !prev);
                      setCopyInstrumentConfirm(null);
                      return;
                    }
                    if (id === 'pianoKeyboard') {
                      setPianoStripVisible((prev) => {
                        if (!prev) {
                          setActiveToolbox('pianoKeyboard');
                          return true;
                        }
                        setActiveToolbox(null);
                        return false;
                      });
                      setSelectedOptionIndex(0);
                    } else {
                      const nextOpen = activeToolbox === id ? null : id;
                      setActiveToolbox(nextOpen);
                      if (nextOpen === 'keySignatures') {
                        const opts = toolboxes.keySignatures?.options;
                        const kIdx = opts?.findIndex((o) => o.value === keySignature) ?? -1;
                        setSelectedOptionIndex(kIdx >= 0 ? kIdx : 0);
                        setKeySignaturesListExpanded(true);
                      } else {
                        setSelectedOptionIndex(0);
                      }
                    }
                  }}
                  className={`w-full rounded-lg text-left transition-all flex items-center justify-between ${
                    (id === 'pianoKeyboard' ? pianoStripVisible : activeToolbox === id)
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                      : (noteInputMode && !N_MODE_PRIMARY_TOOL_IDS.includes(id))
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                  } ${noteInputMode ? 'p-3' : 'p-2.5'}`}
                  title={noteInputMode && !N_MODE_PRIMARY_TOOL_IDS.includes(id) ? 'N-režiimis on aktiivsed Rhythm, Pitch, Klaviatuur ja Akordid' : undefined}
                >
                  <div className="flex items-center gap-2">
                    {renderIcon()}
                    <span className={`${noteInputMode ? 'text-sm' : 'text-xs'} font-medium`}>{toolbox.name}</span>
                  </div>
                  <span className={`${noteInputMode ? 'text-xs' : 'text-[10px]'} font-mono opacity-75`}>{toolbox.shortcut}</span>
                </button>
              );
            })}

            {activeToolbox && toolboxes[activeToolbox] && (
              <p className="mt-3 text-xs text-amber-600 italic">{t('toolbox.optionsAboveScore')}</p>
            )}

          </div>
        </aside>
        )}

        {/* Main Score Area – A4 proportsioon (laius 800–1000px) */}
        <main
          ref={mainRef}
          className={`main-score-area flex-1 p-8 flex flex-col items-stretch ${pageFlowDirection === 'horizontal' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
          onScroll={onMainScroll}
        >
          {/* Pedagoogiline notatsioon: taustheli ja animeerimine (kursor liigub heli järgi) */}
          {isPedagogicalProject && (
            <div className="flex-shrink-0 mb-4 mx-auto w-full" style={{ maxWidth: 1000 }}>
              <div className="bg-gradient-to-b from-violet-100 to-violet-50 border-2 border-violet-300 rounded-xl shadow-lg p-3">
                <h3 className="text-sm font-bold text-violet-900 uppercase tracking-wider mb-2">{t('pedagogical.audio')}</h3>
                <p className="text-xs text-violet-800 mb-3">{t('pedagogical.audioHint')}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={pedagogicalAudioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handlePedagogicalAudioFile}
                  />
                  <button
                    type="button"
                    onClick={() => pedagogicalAudioInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500"
                  >
                    {t('pedagogical.chooseAudio')}
                  </button>
                  <label className="flex items-center gap-2 text-sm text-violet-900">
                    <span className="font-medium">{t('pedagogical.bpm')}</span>
                    <input
                      type="number"
                      min={20}
                      max={300}
                      value={pedagogicalAudioBpm}
                      onChange={(e) => setPedagogicalAudioBpm(Math.max(20, Math.min(300, parseInt(e.target.value, 10) || 120)))}
                      className="w-16 px-2 py-1.5 rounded border-2 border-violet-200 bg-white text-violet-900 font-medium"
                    />
                  </label>
                  <span className="text-xs text-violet-700" title={t('pedagogical.bpmHint')}>{t('pedagogical.bpmHint')}</span>
                  {pedagogicalAudioUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={isPedagogicalAudioPlaying ? stopPedagogicalPlayback : startPedagogicalPlayback}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                      >
                        {icons?.Play && !isPedagogicalAudioPlaying && <icons.Play className="w-4 h-4" />}
                        {icons?.Pause && isPedagogicalAudioPlaying && <icons.Pause className="w-4 h-4" />}
                        {isPedagogicalAudioPlaying ? t('pedagogical.pause') : t('pedagogical.play')}
                      </button>
                      <span className="text-sm text-violet-800">
                        {t('pedagogical.duration')} {pedagogicalAudioDuration > 0 ? `${Math.floor(pedagogicalAudioDuration / 60)}:${String(Math.floor(pedagogicalAudioDuration % 60)).padStart(2, '0')}` : '—'}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-violet-600 italic">{t('pedagogical.noAudio')}</span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-violet-200">
                  <h4 className="text-xs font-bold text-violet-900 uppercase mb-2">{t('pedagogical.playheadStyle')}</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { value: 'line', label: t('pedagogical.playheadLine') },
                      { value: 'violin', label: '🎻 ' + t('pedagogical.playheadViolin') },
                      { value: 'smiley', label: '😊 ' + t('pedagogical.playheadSmiley') },
                      { value: 'custom', label: t('pedagogical.playheadCustom') }
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setPedagogicalPlayheadStyle(value);
                          if (value === 'line') setPedagogicalPlayheadEmoji('');
                          else if (value === 'violin') setPedagogicalPlayheadEmoji('🎻');
                          else if (value === 'smiley') setPedagogicalPlayheadEmoji('😊');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${pedagogicalPlayheadStyle === value ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-800 hover:bg-violet-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                    {pedagogicalPlayheadStyle === 'custom' && (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={pedagogicalPlayheadEmoji}
                          onChange={(e) => setPedagogicalPlayheadEmoji(e.target.value.slice(0, 4))}
                          placeholder={t('pedagogical.playheadCustomPlaceholder')}
                          title={t('pedagogical.playheadCustomHint')}
                          className="w-20 px-2 py-1 rounded border-2 border-violet-200 bg-white text-violet-900 text-lg text-center"
                          maxLength={4}
                        />
                        <p className="text-xs text-violet-700 max-w-sm">
                          {t('pedagogical.playheadCustomHint')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-violet-200">
                  <h4 className="text-xs font-bold text-violet-900 uppercase mb-2">{t('pedagogical.playheadMovement')}</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { value: 'arch', label: t('pedagogical.playheadMovementArch') },
                      { value: 'horizontal', label: t('pedagogical.playheadMovementHorizontal') }
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPedagogicalPlayheadMovement(value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${pedagogicalPlayheadMovement === value ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-800 hover:bg-violet-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {(() => {
            // IMPORTANT: page count must be derived from logical content height, not scrollHeight.
            // Using scrollHeight creates a feedback loop because we set minHeight based on totalPagesVal.
            const contentHeightForPages = pageFlowDirection === 'horizontal'
              ? (lastVerticalContentHeightRef.current || logicalContentHeight)
              : logicalContentHeight;
            const extraPages = Math.max(0, Number(effectiveLayoutExtraPages) || 0);
            const totalPagesVal = Math.max(1, Math.ceil((contentHeightForPages || logicalContentHeight) / a4PageHeightVal) + extraPages);
            const isHorizontalFlow = pageFlowDirection === 'horizontal';
            const pw = effectiveLayoutPageWidth;
            // Terve leht või tark: kas loogiline kõrgus või tegelik scroll kõrgus
            const contentH = logicalContentHeight || 800;
            const contentHWithExtraPages = isHorizontalFlow ? contentH : Math.max(contentH, totalPagesVal * a4PageHeightVal);
            const baseW = isHorizontalFlow ? totalPagesVal * pw : (viewFitOrSmart ? pw * fitPageScale : pw);
            const baseH = isHorizontalFlow ? a4PageHeightVal : contentHWithExtraPages;
            const handleFitToWidth = () => {
              const viewW = mainRef.current?.clientWidth ?? 800;
              const padding = 32;
              const fitScale = Math.max(SCORE_ZOOM_MIN, Math.min(SCORE_ZOOM_MAX, (viewW - padding) / baseW));
              setScoreZoomLevel(Math.round(fitScale * 100) / 100);
            };
            return (
          <div className="flex flex-col flex-1 min-h-0 w-full">
          <div className="flex items-center gap-3 flex-wrap flex-shrink-0 py-2 px-1 border-b border-amber-200/60 dark:border-white/20">
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Suum:</span>
            <button type="button" onClick={handleFitToWidth} className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-800/60" title="Mahuta noodipaber A4 raami laiusele">Mahuta lehele</button>
            <input type="range" min={SCORE_ZOOM_MIN * 100} max={SCORE_ZOOM_MAX * 100} step="5" value={scoreZoomLevel * 100} onChange={(e) => setScoreZoomLevel(Math.round((Number(e.target.value) / 100) * 100) / 100)} className="w-28 accent-amber-600" aria-label="Noodiala suum" />
            <span className="text-sm text-amber-800 dark:text-amber-200 tabular-nums">{Math.round(scoreZoomLevel * 100)}%</span>
          </div>
          {/* Raam: noodileht ei tohi minna üle eelvaate raamide; viewport lõikab/kerib. */}
          <div className="flex justify-center items-start flex-1 min-h-0 w-full overflow-auto" style={{ display: 'flex', maxWidth: '100%' }}>
          <div
            ref={notationZoomAreaRef}
            style={{ width: baseW * scoreZoomLevel, height: baseH * scoreZoomLevel, flexShrink: 0, minWidth: baseW }}
            onWheel={handleScoreZoomWheel}
            onTouchStart={handleScoreZoomTouchStart}
            onTouchMove={handleScoreZoomTouchMove}
            onTouchEnd={handleScoreZoomTouchEnd}
          >
          <div
            ref={scoreScaledWrapperRef}
            style={{ transform: `scale(${scoreZoomLevel})`, transformOrigin: '0 0', width: baseW, height: baseH }}
          >
          <div
            className={isHorizontalFlow ? 'flex-shrink-0' : ''}
            style={isHorizontalFlow ? { width: totalPagesVal * pw, height: a4PageHeightVal } : undefined}
          >
          {/* Terve leht: A4 täidab vaateakna (scale=1). Tark lehe vaade: skaleerib noteeritud ala. */}
          <div
            ref={viewFitOrSmart ? mainAreaRef : undefined}
            style={viewFitOrSmart ? { position: 'relative', width: pw * fitPageScale, minHeight: contentHWithExtraPages * fitPageScale } : undefined}
          >
            <div
              style={viewFitOrSmart ? { position: 'absolute', left: 0, top: 0, width: pw, height: contentHWithExtraPages, transform: `scale(${fitPageScale})`, transformOrigin: 'top left' } : undefined}
            >
          <div
            ref={scoreContainerRef}
            className={`noodimeister-print-area A4-page-container sheet-music-page print-page-${paperSize}-${pageFlowDirection === 'horizontal' ? 'landscape' : pageOrientation} relative flex-1 transition-colors ${viewFitPage && !viewSmartPage ? 'ml-0' : 'mx-auto'} ${isHorizontalFlow ? '' : 'rounded-lg border-2 border-amber-200 dark:border-white/20'}`}
            style={{
              backgroundColor: scorePagePaperBackground,
              minWidth: LAYOUT.PAGE_WIDTH_MIN,
              /* Fikseeritud lehe laius: ei sõltu seadme/brauseri laiusest (iPad, tahvel, MacBook, PC). */
              ...(viewFitPage && !viewSmartPage ? {} : { width: basePageWidth, maxWidth: basePageWidth }),
              /* Portrait: minHeight ≥ ühe lehe kõrgus (a4PageHeightVal), et kast oleks püstine, mitte laiune. */
              minHeight: isHorizontalFlow ? a4PageHeightVal : Math.max(a4PageHeightVal * totalPagesVal, 500, getStaffHeight() + LAYOUT.SYSTEM_GAP + getStaffHeight() + 120),
              ...(viewFitPage && !viewSmartPage ? { width: pw, boxSizing: 'border-box' } : { boxSizing: 'border-box' }),
              ...(isHorizontalFlow ? { width: totalPagesVal * pw, height: a4PageHeightVal } : {}),
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2');
              const raw = e.dataTransfer.getData('text/plain') || '';
              const match = raw.match(/^rhythm:(\d+)$/);
              if (!match) return;
              const optionIndex = parseInt(match[1], 10);
              if (!Number.isNaN(optionIndex) && toolboxes.rhythm?.options?.[optionIndex]) handleToolboxSelection(optionIndex);
            }}
            onMouseDown={(e) => {
              if (activeToolbox !== 'textBox' || e.button !== 0) return;
              const t = e.target;
              if (typeof t?.closest === 'function') {
                if (t.closest('input, textarea, select, button, label, a[href]')) return;
                if (t.closest('[data-textbox-id]') || t.closest('[data-resize-handle]')) return;
                if (t.closest('.staff-spacer-handle')) return;
              }
              e.preventDefault();
              e.stopPropagation();
              handleScoreContentClick(e);
            }}
          >
              <PageSeparatorsOverlay
                totalPages={totalPagesVal}
                pageWidth={pw}
                pageHeight={a4PageHeightVal}
                isHorizontal={isHorizontalFlow}
                scrollTop={mainScrollTop}
                scrollLeft={mainScrollLeft}
                viewportW={mainRef.current?.clientWidth ?? 0}
                viewportH={mainRef.current?.clientHeight ?? 0}
                zoom={scoreZoomLevel}
              />
              {/* A4 trim caption: kasutaja näeb, et noodipaberi ala = trüki/PDF piir (ei ületa, ei jää väikeseks). */}
              <span data-export-ignore className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium bg-amber-100/90 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 pointer-events-none select-none print:hidden" aria-hidden="true" title="Trükkimise ja PDF ekspordi piir = A4 (210×297 mm)">
                A4 {pageOrientation === 'landscape' ? '297×210' : '210×297'} mm
              </span>
              {/* Lehekülje nurganupud: lisa/eemalda lõppu tühi lehekülg */}
              <div data-export-ignore className="absolute inset-0 print:hidden pointer-events-none" aria-hidden="true">
                {(() => {
                  const extra = Math.max(0, Number(effectiveLayoutExtraPages) || 0);
                  const canRemove = extra > 0;
                  const onAdd = () => {
                    dirtyRef.current = true;
                    (viewMode === 'score' ? setLayoutExtraPages : setPartLayoutExtraPages)((prev) => Math.max(0, (Number(prev) || 0) + 1));
                  };
                  const onRemove = () => {
                    dirtyRef.current = true;
                    (viewMode === 'score' ? setLayoutExtraPages : setPartLayoutExtraPages)((prev) => Math.max(0, (Number(prev) || 0) - 1));
                  };
                  const pageIndex = Math.max(0, (Number(totalPagesVal) || 1) - 1);
                  const left = (isHorizontalFlow ? pageIndex * pw : 0) + pw - 58;
                  const top = (isHorizontalFlow ? 0 : pageIndex * a4PageHeightVal) + 10;
                  return (
                    <div style={{ position: 'absolute', left, top, display: 'flex', gap: 6, pointerEvents: 'auto' }}>
                      <button type="button" onClick={onAdd} className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-sm hover:bg-amber-200 font-bold leading-none" title="Lisa lehekülg">+</button>
                      <button type="button" onClick={onRemove} disabled={!canRemove} className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-sm hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold leading-none" title="Eemalda viimane lehekülg">−</button>
                    </div>
                  );
                })()}
              </div>
              <div className="noodimeister-print-scaler">
              {pageDesignDataUrl && (() => {
                const pos = `${pageDesignPositionX}% ${pageDesignPositionY}%`;
                const hasCrop = pageDesignCrop.top > 0 || pageDesignCrop.right > 0 || pageDesignCrop.bottom > 0 || pageDesignCrop.left > 0;
                const clipStyle = hasCrop ? { clipPath: `inset(${pageDesignCrop.top}% ${pageDesignCrop.right}% ${pageDesignCrop.bottom}% ${pageDesignCrop.left}%)` } : {};
                const tileStyle = { backgroundRepeat: 'no-repeat', backgroundPosition: pos };
                const designWrapperStyle = {
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  zIndex: 0,
                  pointerEvents: 'none',
                };
                if (isHorizontalFlow) {
                  return (
                    <div aria-hidden="true" className="absolute inset-0" style={designWrapperStyle}>
                      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${pageDesignDataUrl})`, backgroundRepeat: 'repeat-x', backgroundPosition: pos, backgroundSize: `${pw}px ${a4PageHeightVal}px`, opacity: clampNumber(Number(pageDesignOpacity) || 0.25, 0, 1), ...clipStyle }} />
                    </div>
                  );
                }
                const numPagesVertical = totalPagesVal;
                if (numPagesVertical <= 0) return null;
                if ((pageDesignFit === 'cover' || pageDesignFit === 'contain') && numPagesVertical >= 1) {
                  return (
                    <div aria-hidden="true" className="absolute inset-0" style={designWrapperStyle}>
                      {Array.from({ length: numPagesVertical }, (_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 right-0 pointer-events-none"
                          style={{
                            top: i * a4PageHeightVal,
                            width: pw,
                            height: a4PageHeightVal,
                            backgroundImage: `url(${pageDesignDataUrl})`,
                            backgroundSize: pageDesignFit === 'cover' ? 'cover' : 'contain',
                            backgroundPosition: pos,
                            ...tileStyle,
                            opacity: clampNumber(Number(pageDesignOpacity) || 0.25, 0, 1),
                            ...clipStyle,
                          }}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <div aria-hidden="true" className="absolute inset-0" style={designWrapperStyle}>
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${pageDesignDataUrl})`, backgroundRepeat: 'repeat-y', backgroundPosition: pos, backgroundSize: `${pw}px ${a4PageHeightVal}px`, opacity: clampNumber(Number(pageDesignOpacity) || 0.25, 0, 1), ...clipStyle }} />
                  </div>
                );
              })()}
              <div
                ref={scoreContentRef}
                className="relative"
                style={{ zIndex: 1, cursor: cursorTool === 'hand' ? (isHandPanning ? 'grabbing' : 'grab') : undefined }}
                onMouseDown={(e) => {
                  // Tekstikasti paigutus: scoreContainerRef (terve valge leht), mitte ainult see div — vt onMouseDown noodilehel.
                  if (cursorTool === 'hand' && pageDesignDataUrl && e.altKey && e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    pageDesignDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPosX: pageDesignPositionX, startPosY: pageDesignPositionY };
                    dirtyRef.current = true;
                    return;
                  }
                  if (cursorTool === 'hand' && e.button === 0 && mainRef?.current) {
                    e.preventDefault();
                    setIsHandPanning(true);
                    handPanRef.current = {
                      active: true,
                      startX: e.clientX,
                      startY: e.clientY,
                      startScrollLeft: mainRef.current.scrollLeft,
                      startScrollTop: mainRef.current.scrollTop
                    };
                  }
                }}
                onContextMenu={(e) => {
                  // Avatud kontekstimenüü: kopeeri / kleebi / tühista valik.
                  // Töötame ainult SEL-režiimis (noteInputModeRef.current === false),
                  // et mitte segada N-režiimi noodisisestust — välja arvatud valikutööriist + Shift-valik.
                  if (noteInputModeRef.current && notationStyle !== 'FIGURENOTES' && cursorToolRef.current !== 'select') return;
                  e.preventDefault();
                  const hasSelection = selectedNoteIndex >= 0 || (selectionStart >= 0 && selectionEnd >= 0);
                  const hasClipboard = clipboard && clipboard.length > 0;
                  setScoreContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    canCopy: hasSelection,
                    canPaste: hasClipboard
                  });
                }}
                role="presentation"
              >
              {/* Pealkiri muudetav otse lehel; pt-6 tagab, et pealkirja ei lõigata eksporti/trüki ülaosast. data-score-export-header: scoreToSvg mõõdab alumist serva, et mitte liita topelt pealkirjakõrgust PDF/trüki Y-nihkesse. */}
              <div
                data-score-export-header
                className="pt-6 mb-4"
                style={isHorizontalFlow ? { width: effectiveLayoutPageWidth, flexShrink: 0 } : undefined}
              >
                <input
                  ref={titleInputRef}
                  type="text"
                  value={songTitle}
                  onChange={(e) => { dirtyRef.current = true; setSongTitle(e.target.value); }}
                  onFocus={() => { setActiveTextLineType('title'); setSelectedTextboxId(null); }}
                  placeholder="Nimetu"
                  className={`w-full text-amber-900 dark:text-white bg-transparent border-0 border-b-2 border-transparent hover:border-amber-300 dark:hover:border-white/30 focus:border-amber-500 dark:focus:border-amber-500 focus:outline-none focus:ring-0 py-0 ${titleAlignment === 'left' ? 'text-left' : titleAlignment === 'right' ? 'text-right' : 'text-center'}`}
                  style={{
                    fontFamily: titleFontFamily || documentFontFamily,
                    fontSize: titleFontSize,
                    fontWeight: titleBold ? 'bold' : undefined,
                    fontStyle: titleItalic ? 'italic' : undefined,
                  }}
                  title={t('score.titleTitle')}
                />
                <input
                  ref={authorInputRef}
                  type="text"
                  value={author}
                  onChange={(e) => { dirtyRef.current = true; setAuthor(e.target.value); }}
                  onFocus={() => { setActiveTextLineType('author'); setSelectedTextboxId(null); }}
                  placeholder={t('score.authorPlaceholder') || 'Autor'}
                  className={`w-full text-amber-700 dark:text-white/80 bg-transparent border-0 border-b border-transparent hover:border-amber-300 dark:hover:border-white/30 focus:border-amber-500 dark:focus:border-amber-500 focus:outline-none focus:ring-0 py-0 mt-1 text-sm ${authorAlignment === 'left' ? 'text-left' : authorAlignment === 'right' ? 'text-right' : 'text-center'}`}
                  style={{
                    fontFamily: authorFontFamily || documentFontFamily,
                    fontSize: authorFontSize,
                    fontWeight: authorBold ? 'bold' : undefined,
                    fontStyle: authorItalic ? 'italic' : undefined,
                  }}
                  title={t('textBox.documentFontHint')}
                />
              </div>
              {/* Õpetaja režiimi tööriistariba (pedagoogiline notatsioon); data-score-export-chrome — PDF/trükk ei joonista seda, kõrgus eemaldatakse noodile vertikaalsest nihkest. */}
              {notationMode === 'vabanotatsioon' && (
                <div data-score-export-chrome className="mb-3 flex flex-wrap items-center gap-3 px-2 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Õpetaja</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showAllNoteLabels} onChange={(e) => { dirtyRef.current = true; setShowAllNoteLabels(e.target.checked); }} className="rounded border-amber-400 text-amber-600" />
                    <span className="text-sm text-amber-900">{t('teacher.showAllLabels')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enableEmojiOverlays} onChange={(e) => { dirtyRef.current = true; setEnableEmojiOverlays(e.target.checked); }} className="rounded border-amber-400 text-amber-600" />
                    <span className="text-sm text-amber-900">{t('teacher.enableEmojiOverlays')}</span>
                  </label>
                  <button type="button" onClick={() => { clearAllNoteLabels(); }} className="px-2 py-1 rounded text-sm bg-amber-200 text-amber-900 hover:bg-amber-300 border border-amber-300">
                    {t('teacher.clearAllAnnotations')}
                  </button>
                  {pedagogicalAudioUrl && (
                    <div className="flex flex-wrap items-center gap-2 border-l border-amber-300 pl-3">
                      <span className="text-xs font-semibold text-amber-800">{t('pedagogical.audio')}:</span>
                      <button
                        type="button"
                        onClick={isPedagogicalAudioPlaying ? stopPedagogicalPlayback : startPedagogicalPlayback}
                        className="px-2 py-1 rounded text-sm bg-violet-600 text-white hover:bg-violet-500"
                      >
                        {icons?.Play && !isPedagogicalAudioPlaying && <icons.Play className="w-4 h-4 inline-block mr-1" />}
                        {icons?.Pause && isPedagogicalAudioPlaying && <icons.Pause className="w-4 h-4 inline-block mr-1" />}
                        {isPedagogicalAudioPlaying ? t('pedagogical.pause') : t('pedagogical.play')}
                      </button>
                      <button
                        type="button"
                        onClick={() => stopPedagogicalPlayback()}
                        className="px-2 py-1 rounded text-sm bg-slate-200 text-slate-900 hover:bg-slate-300 border border-slate-300"
                      >
                        Stop
                      </button>
                      <button type="button" onClick={() => seekPedagogicalAudio(-5)} className="px-2 py-1 rounded text-sm bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200">-5s</button>
                      <button type="button" onClick={() => seekPedagogicalAudio(5)} className="px-2 py-1 rounded text-sm bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200">+5s</button>
                      <label className="flex items-center gap-2">
                        <span className="text-xs text-amber-800">Tempo</span>
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.05}
                          value={pedagogicalAudioPlaybackRate}
                          onChange={(e) => {
                            const v = clampNumber(Number(e.target.value) || 1, 0.5, 2);
                            setPedagogicalAudioPlaybackRate(v);
                            dirtyRef.current = true;
                            if (pedagogicalAudioRef.current) pedagogicalAudioRef.current.playbackRate = v;
                          }}
                        />
                        <span className="text-xs text-amber-800 w-10">{Math.round(pedagogicalAudioPlaybackRate * 100)}%</span>
                      </label>
                      <span className="text-xs text-amber-700">
                        {Math.floor(pedagogicalAudioCurrentTime)}s / {Math.floor(pedagogicalAudioDuration || 0)}s
                      </span>
                    </div>
                  )}
                  {staves.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 border-l border-amber-300 pl-3">
                      <span className="text-xs font-semibold text-amber-800">{t('teacher.showStaves')}:</span>
                      <span className="text-xs text-amber-700 hidden sm:inline">{t('teacher.showStavesHint')}</span>
                      {staves.map((_, i) => (
                        <label key={i} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleStaves[i] !== false}
                            onChange={(e) => {
                              dirtyRef.current = true;
                              setVisibleStaves((prev) => {
                                const next = [...(prev.length === staves.length ? prev : staves.map(() => true))];
                                next[i] = e.target.checked;
                                if (!next[i] && activeStaffIndex === i) setActiveStaffIndex(Math.max(0, i - 1));
                                return next;
                              });
                            }}
                            className="rounded border-amber-400 text-amber-600"
                          />
                          <span className="text-sm text-amber-900">{i + 1}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-start gap-2 border-l border-amber-300 pl-3">
                    <span className="text-xs font-semibold text-amber-800">{t('teacher.intermissionLabels')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        dirtyRef.current = true;
                        const totalBeats = Math.max(0, ...staves.map((s) => s.notes.reduce((a, n) => a + n.duration, 0)));
                        setIntermissionLabels((prev) => [...prev, { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `int-${Date.now()}`, startBeat: Math.max(0, totalBeats - 4), endBeat: totalBeats + 2, text: t('intermission.placeholder') }]);
                      }}
                      className="px-2 py-1 rounded text-sm bg-amber-200 text-amber-900 hover:bg-amber-300 border border-amber-300"
                    >
                      {t('teacher.addIntermission')}
                    </button>
                    {intermissionLabels.length > 0 && (
                      <div className="flex flex-col gap-1.5 w-full max-w-md">
                        {intermissionLabels.map((lab) => (
                          <div key={lab.id} className="flex flex-wrap items-center gap-2 p-2 rounded bg-amber-100/80 border border-amber-200">
                            <input type="number" min={0} step={0.5} value={lab.startBeat} onChange={(e) => { dirtyRef.current = true; setIntermissionLabels((prev) => prev.map((l) => l.id === lab.id ? { ...l, startBeat: Number(e.target.value) || 0 } : l)); }} className="w-14 rounded border border-amber-400 px-1 text-xs" title={t('intermission.startBeat')} />
                            <span className="text-amber-700">–</span>
                            <input type="number" min={0} step={0.5} value={lab.endBeat} onChange={(e) => { dirtyRef.current = true; setIntermissionLabels((prev) => prev.map((l) => l.id === lab.id ? { ...l, endBeat: Number(e.target.value) || 0 } : l)); }} className="w-14 rounded border border-amber-400 px-1 text-xs" title={t('intermission.endBeat')} />
                            <input type="text" value={lab.text} onChange={(e) => { dirtyRef.current = true; setIntermissionLabels((prev) => prev.map((l) => l.id === lab.id ? { ...l, text: e.target.value } : l)); }} placeholder={t('intermission.placeholder')} className="flex-1 min-w-[8rem] rounded border border-amber-400 px-2 py-0.5 text-sm" />
                            <button type="button" onClick={() => { dirtyRef.current = true; setIntermissionLabels((prev) => prev.filter((l) => l.id !== lab.id)); }} className="text-red-600 hover:text-red-700 font-bold text-lg leading-none" title={t('teacher.clearAllAnnotations')}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
            </div>
          )}
          {(() => {
            // Mouse-based note input is only allowed when N-mode is ON
            // and the active toolbox is the pitch-input toolbox.
            const mousePitchInputEnabled = noteInputMode && activeToolbox === 'pitchInput';
            const staffEntries = visibleStaffList.length > 0
              ? visibleStaffList
              : staves.map((staff, i) => ({ staff, staffIdx: i, visibleIndex: i }));
            const renderTraditionalAsCombinedSystem = notationStyle !== 'FIGURENOTES' && staffEntries.length > 1;
            /** Figuurnotatsioon: mitu nähtavat rida (nt klaver G+F, mitu pilli) ühes SVG-s — sama orchestration reegel mis traditsioonil combined. */
            const renderFigurenotesAsCombinedSystem = notationStyle === 'FIGURENOTES' && staffEntries.length > 1;
            const buildMeasuresForStaffNotes = (noteList) => {
              const out = (measuresWithMarks || []).map((m) => ({ ...m, notes: [] }));
              let beat = 0;
              (noteList || []).forEach((note) => {
                const noteBeat = typeof note.beat === 'number' ? note.beat : beat;
                const idx = (out || []).findIndex((m) => noteBeat >= m.startBeat && noteBeat < m.endBeat);
                if (idx >= 0) out[idx].notes.push({ ...note, beat: noteBeat });
                beat = noteBeat + (Number(note.duration) || 1);
              });
              return out;
            };
            const traditionalSystemInstruments = renderTraditionalAsCombinedSystem
              ? staffEntries.map(({ staff }, idx) => ({
                id: staff.id,
                instrumentId: staff.instrumentId,
                name: String(
                  staff.name
                  || instrumentConfig?.[staff.instrumentId]?.label
                  || (INSTRUMENT_I18N_KEYS?.[staff.instrumentId] ? t(INSTRUMENT_I18N_KEYS[staff.instrumentId]) : `Instrument ${idx + 1}`)
                ),
                clef: staff.clefType,
              }))
              : null;
            const traditionalSystemMeasuresByInstrument = renderTraditionalAsCombinedSystem
              ? staffEntries.reduce((acc, { staff }) => {
                acc[staff.id] = buildMeasuresForStaffNotes(staff.notes);
                return acc;
              }, {})
              : null;
            const figurenotesCombinedInstruments = renderFigurenotesAsCombinedSystem
              ? staffEntries.map(({ staff }, idx) => ({
                id: staff.id,
                instrumentId: staff.instrumentId,
                name: String(
                  staff.name
                  || instrumentConfig?.[staff.instrumentId]?.label
                  || (INSTRUMENT_I18N_KEYS?.[staff.instrumentId] ? t(INSTRUMENT_I18N_KEYS[staff.instrumentId]) : `Instrument ${idx + 1}`)
                ),
                clef: staff.clefType,
              }))
              : null;
            const figurenotesCombinedMeasuresByInstrument = renderFigurenotesAsCombinedSystem
              ? staffEntries.reduce((acc, { staff }) => {
                acc[staff.id] = buildMeasuresForStaffNotes(staff.notes);
                return acc;
              }, {})
              : null;
            const combinedSystemInstruments = traditionalSystemInstruments || figurenotesCombinedInstruments;
            const combinedSystemMeasuresByInstrument = traditionalSystemMeasuresByInstrument || figurenotesCombinedMeasuresByInstrument;
            const combinedActiveRowIndex = (renderTraditionalAsCombinedSystem || renderFigurenotesAsCombinedSystem)
              ? Math.max(0, staffEntries.findIndex(({ staffIdx }) => staffIdx === activeStaffIndex))
              : 0;
            const combinedCursorRowOffsetPx = (renderTraditionalAsCombinedSystem || renderFigurenotesAsCombinedSystem)
              ? combinedActiveRowIndex * effectiveStaffHeight
              : 0;
            // Aktiivne laulusõnade noot: kui ahel on käimas, kasutame lyricChainIndex; muidu valitud nooti või kursorit.
            const lyricActiveNoteIndex = cursorOnMelodyRow
              ? (lyricChainIndex ?? (selectedNoteIndex >= 0 ? selectedNoteIndex : noteIndexAtCursor))
              : null;
            const activeStaffEntryForCombined = (renderTraditionalAsCombinedSystem || renderFigurenotesAsCombinedSystem)
              ? (staffEntries.find(({ staffIdx: si }) => si === activeStaffIndex) ?? staffEntries[0])
              : null;
            return staffEntries.map(({ staff, staffIdx, visibleIndex }) => {
              if ((renderTraditionalAsCombinedSystem || renderFigurenotesAsCombinedSystem) && visibleIndex > 0) return null;
              const isFirstInBraceGroup = staff.braceGroupId && staves[staffIdx + 1]?.braceGroupId === staff.braceGroupId;
              const braceGroupSize = isFirstInBraceGroup ? 2 : 0;
              const partsGap = layoutPartsGap;
              const fallbackStaffOffset = useManualStaffOffsets ? (staffYOffsets[staffIdx] ?? 0) : 0;
              const baseYOffset = traditionalVisibleGeometry.baseYOffsetByStaffIdx?.[staffIdx]
                ?? (visibleIndex * perStaffRowStep + fallbackStaffOffset);
              const isFirstVisible = visibleIndex === 0;
              const staffCfg = instrumentConfig?.[staff.instrumentId];
              const staffSupportsLinkedNotation = staffCfg?.type === 'tab' || (staffCfg?.type === 'wind' && staffCfg?.fingering);
              const shouldLinkNotationRow = staffSupportsLinkedNotation && !!linkedNotationByStaffId?.[staff.id];
              const staffNotationVariant = shouldLinkNotationRow ? (staffCfg?.type === 'tab' ? 'tab' : 'fingering') : 'standard';
              return (
                <Timeline
                  key={staff.id}
                  measures={measuresWithMarks}
                  pageWidth={effectiveLayoutPageWidth}
                  pageOrientation={pageOrientation}
                  physicalPageGapPx={3}
                  disablePhysicalPageGaps={showPdfExportPreview}
                  hideCursorOverlay={showPdfExportPreview || isExportingPdf}
                  timeSignature={timeSignature}
                  timeSignatureMode={timeSignatureMode}
                  pixelsPerBeat={pixelsPerBeat}
                  cursorPosition={cursorPosition}
                  notationMode={notationMode}
                  staffLines={staffLines}
                  clefType={staff.clefType}
                  keySignature={keySignature}
                  isFirstInBraceGroup={isFirstInBraceGroup}
                  braceGroupSize={braceGroupSize}
                  relativeNotationShowKeySignature={relativeNotationShowKeySignature}
                  relativeNotationShowTraditionalClef={relativeNotationShowTraditionalClef}
                  onJoClefPositionChange={notationMode === 'vabanotatsioon' ? (newKey) => {
                    dirtyRef.current = true;
                    const fromSemi = KEY_TO_SEMITONE[keySignature] ?? getSemitonesFromKey(keySignature);
                    const toSemi = KEY_TO_SEMITONE[newKey] ?? getSemitonesFromKey(newKey);
                    let semitones = (toSemi - fromSemi) % 12;
                    if (semitones < 0) semitones += 12;
                    if (semitones !== 0) {
                      saveToHistory(notes);
                      setNotes(transposeNotes(notes, semitones));
                      const preferFlats = FLAT_KEYS.has(newKey);
                      setChords((prev) => prev.map((c) => ({
                        ...c,
                        chord: transposeChordSymbolSemitones(c.chord, semitones, { preferFlats }),
                      })));
                    }
                    setKeySignature(newKey);
                    setJoClefStaffPosition(getTonicStaffPosition(newKey));
                  } : undefined}
                  joClefStaffPosition={joClefStaffPosition}
                  joClefFocused={joClefFocused}
                  onJoClefFocus={notationMode === 'vabanotatsioon' ? setJoClefFocused : undefined}
                  instrument={staff.instrumentId}
                  instrumentNotationVariant={staffNotationVariant}
                  instrumentConfig={instrumentConfig}
                  isDotted={isDotted}
                  isRest={isRest}
                  selectedDuration={selectedDuration}
                  noteInputMode={noteInputMode}
                  selectedNoteIndex={staffIdx === activeStaffIndex ? selectedNoteIndex : -1}
                  isNoteSelected={renderFigurenotesAsCombinedSystem
                    ? (index, row) => {
                      const r = staffEntries[row];
                      if (!r || r.staffIdx !== activeStaffIndex) return false;
                      return isNoteSelected(index);
                    }
                    : isNoteSelected}
                  notes={staff.notes}
                  onStaffAddNote={staffIdx === activeStaffIndex && mousePitchInputEnabled ? addNoteAtCursor : undefined}
                  onNoteClick={renderFigurenotesAsCombinedSystem
                    ? (index, row) => {
                      const r = staffEntries[row];
                      if (r && r.staffIdx !== activeStaffIndex) {
                        setActiveStaffIndex(r.staffIdx);
                        setCursorSubRow(0);
                        return;
                      }
                      const noteList = staves[activeStaffIndex]?.notes ?? [];
                      const beat = getBeatAtNoteIndex(noteList, index);
                      lastBeatClickForLyricRef.current = { beat, at: Date.now() };
                      if (noteInputMode) {
                        applySelectionModel(CURSOR_SELECTION_NONE);
                        setCursorSubRow(0);
                        setCursorPosition(beat);
                        const clicked = noteList[index];
                        if (clicked && !clicked.isRest) {
                          setGhostPitch(clicked.pitch);
                          setGhostOctave(typeof clicked.octave === 'number' ? clicked.octave : 4);
                          if (clicked.accidental !== undefined && clicked.accidental !== null) {
                            setGhostAccidentalIsExplicit(true);
                            setGhostAccidental(clicked.accidental);
                          } else {
                            setGhostAccidentalIsExplicit(false);
                            setGhostAccidental(0);
                          }
                        }
                        if (cursorTool === 'type') {
                          setLyricChainStart(index);
                          setLyricChainEnd(index);
                          setLyricChainIndex(index);
                          setTimeout(() => lyricInputRef.current?.focus(), 0);
                        }
                        return;
                      }
                      applySelectionModel({ kind: 'note', index });
                      setCursorSubRow(0);
                      setCursorPosition(beat);
                      if (cursorTool === 'type') {
                        setLyricChainStart(index);
                        setLyricChainEnd(index);
                        setLyricChainIndex(index);
                        setTimeout(() => lyricInputRef.current?.focus(), 0);
                      }
                    }
                    : (staffIdx === activeStaffIndex ? (index) => {
                      const beat = getBeatAtNoteIndex(notes, index);
                      lastBeatClickForLyricRef.current = { beat, at: Date.now() }; // Cmd+L kasutab seda enne Reacti cursorPosition uuendust
                      if (noteInputMode) {
                        applySelectionModel(CURSOR_SELECTION_NONE);
                        setCursorSubRow(0);
                        setCursorPosition(beat);
                        const clicked = notes[index];
                        if (clicked && !clicked.isRest) {
                          setGhostPitch(clicked.pitch);
                          setGhostOctave(typeof clicked.octave === 'number' ? clicked.octave : 4);
                          if (clicked.accidental !== undefined && clicked.accidental !== null) {
                            setGhostAccidentalIsExplicit(true);
                            setGhostAccidental(clicked.accidental);
                          } else {
                            setGhostAccidentalIsExplicit(false);
                            setGhostAccidental(0);
                          }
                        }
                        if (cursorTool === 'type') {
                          setLyricChainStart(index);
                          setLyricChainEnd(index);
                          setLyricChainIndex(index);
                          setTimeout(() => lyricInputRef.current?.focus(), 0);
                        }
                        return;
                      }
                      applySelectionModel({ kind: 'note', index });
                      setCursorSubRow(0); // Laulusõnade režiim: kursor alati meloodiareal
                      setCursorPosition(beat); // Üks kursor: kursor joondatud klõpsatud noodi algusega
                      if (cursorTool === 'type') {
                        setLyricChainStart(index);
                        setLyricChainEnd(index);
                        setLyricChainIndex(index);
                        setTimeout(() => lyricInputRef.current?.focus(), 0);
                      }
                    } : () => { setActiveStaffIndex(staffIdx); setCursorSubRow(0); })}
                  onNoteMouseDown={renderFigurenotesAsCombinedSystem
                    ? (index, e, row) => {
                      const r = staffEntries[row];
                      if (!r || r.staffIdx !== activeStaffIndex) return;
                      beginSelectionDrag(index, e);
                    }
                    : (staffIdx === activeStaffIndex ? beginSelectionDrag : undefined)}
                  onNoteMouseEnter={renderFigurenotesAsCombinedSystem
                    ? (index, e, row) => {
                      const r = staffEntries[row];
                      if (!r || r.staffIdx !== activeStaffIndex) return;
                      updateSelectionDragHover(index, e);
                    }
                    : (staffIdx === activeStaffIndex ? updateSelectionDragHover : undefined)}
                  onNotePitchChange={(staffIdx === activeStaffIndex || renderFigurenotesAsCombinedSystem) ? onNotePitchChange : undefined}
                  onNoteBeatChange={(staffIdx === activeStaffIndex || renderFigurenotesAsCombinedSystem) ? onNoteBeatChange : undefined}
                  canHandDragNotes={cursorTool === 'hand'}
                  ghostPitch={ghostPitch}
                  ghostOctave={ghostOctave}
                  ghostAccidental={ghostAccidental}
                  ghostAccidentalIsExplicit={ghostAccidentalIsExplicit}
                  onFigureBeatClick={notationStyle === 'FIGURENOTES' && (renderFigurenotesAsCombinedSystem || staffIdx === activeStaffIndex)
                    ? (beatPosition, meta) => {
                        if (renderFigurenotesAsCombinedSystem && meta?.staffRowIndex != null) {
                          const r = staffEntries[meta.staffRowIndex];
                          if (r && r.staffIdx !== activeStaffIndex) {
                            setActiveStaffIndex(r.staffIdx);
                            setCursorPosition(beatPosition);
                            setCursorSubRow(0);
                            lastBeatClickForLyricRef.current = { beat: beatPosition, at: Date.now() };
                            return;
                          }
                        } else if (!renderFigurenotesAsCombinedSystem && staffIdx !== activeStaffIndex) {
                          return;
                        }
                        setCursorPosition(beatPosition);
                        setCursorSubRow(0);
                        lastBeatClickForLyricRef.current = { beat: beatPosition, at: Date.now() };
                        const draft = mouseInsertDraftRef.current;
                        // Mängi noot kursori kohal (N- ja SEL-režiim), kui liigutame ainult kursorit (mitte teise klõpsuga noodit).
                        if (!draft || !draft.startBeat) playNoteAtBeatIfEnabled(beatPosition);
                        if (!mousePitchInputEnabled || !noteInputModeRef.current) return;
                        // First click: pick up a draft note (no insertion yet).
                        if (!draft || !draft.startBeat) {
                          const pitch = ghostPitch || 'C';
                          const octave = typeof ghostOctave === 'number' ? ghostOctave : 4;
                          setMouseInsertDraft({
                            startBeat: beatPosition,
                            currentBeat: beatPosition,
                            pitch,
                            octave,
                            durationLabel: selectedDuration || '1/4'
                          });
                          setGhostPitch(pitch);
                          setGhostOctave(octave);
                          return;
                        }
                        // Second click: drop the note at chosen beat.
                        const beat = beatPosition != null ? beatPosition : draft.currentBeat || draft.startBeat;
                        const pitch = draft.pitch || ghostPitch || 'C';
                        const octave = typeof draft.octave === 'number' ? draft.octave : (ghostOctave ?? 4);
                        const durLabel = draft.durationLabel || selectedDuration || '1/4';
                        addNoteAtCursor(pitch, octave, undefined, { insertAtBeat: beat, overrideDurationLabel: durLabel });
                        try {
                          const step = durationLabelToQuarterNoteUnits(durLabel);
                          setCursorPosition(Math.max(0, beat + (Number.isFinite(step) ? step : 1)));
                        } catch (_) {
                          setCursorPosition(Math.max(0, beat));
                        }
                        setGhostPitch(pitch);
                        setGhostOctave(octave);
                        setMouseInsertDraft(null);
                      }
                    : undefined}
                  onChordLineMouseMove={notationStyle === 'FIGURENOTES' && figurenotesChordBlocks && (staffIdx === activeStaffIndex || renderFigurenotesAsCombinedSystem) ? (beat) => { setCursorPosition(beat); setCursorSubRow(1); } : undefined}
                  onChordLineClick={notationStyle === 'FIGURENOTES' && figurenotesChordBlocks && (staffIdx === activeStaffIndex || renderFigurenotesAsCombinedSystem) ? (beat) => { const b = Math.max(0, beat); setCursorPosition(b); setCursorSubRow(1); playNoteAtBeatIfEnabled(b); } : undefined}
                  activeLyricNoteIndex={staffIdx === activeStaffIndex ? lyricActiveNoteIndex : null}
                  notationStyle={notationStyle}
                  layoutMeasuresPerLine={effectiveLayoutMeasuresPerLine}
                  layoutLineBreakBefore={effectiveLayoutLineBreakBefore}
                  layoutPageBreakBefore={effectiveLayoutPageBreakBefore}
                  layoutSystemGap={layoutSystemGap}
                  layoutPartsGap={layoutPartsGap}
                  layoutConnectedBarlines={effectiveLayoutConnectedBarlines}
                  staffRowAlignment={staffRowAlignment}
                  staffIndexInScore={visibleIndex}
                  systemTotalHeight={notationStyle === 'FIGURENOTES'
                    ? getTraditionalSystemTotalHeightPx(
                      visibleStaffList.length > 0 ? visibleStaffList.length : staves.length,
                      perStaffRowStep,
                      layoutPartsGap,
                    )
                    : traditionalVisibleGeometry.systemTotalHeightPx}
                  layoutGlobalSpacingMultiplier={layoutGlobalSpacingMultiplier}
                  showLayoutBreakIcons={false}
                  showStaffSpacerHandles={!isExportingPdf && !showPdfExportPreview}
                  onSystemYOffsetChange={isFirstVisible ? (systemIndex, deltaY) => {
                    dirtyRef.current = true;
                    setSystemYOffsets((prev) => {
                      const next = [...(prev || [])];
                      while (next.length <= systemIndex) next.push(0);
                      next[systemIndex] = (next[systemIndex] ?? 0) + deltaY;
                      return next;
                    });
                  } : undefined}
                  onToggleLineBreakAfter={(measureIndex) => {
                    dirtyRef.current = true;
                    const setter = viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore;
                    setter((prev) => {
                      const next = measureIndex + 1;
                      if (prev.includes(next)) return prev.filter((i) => i !== next);
                      return [...prev, next].sort((a, b) => a - b);
                    });
                  }}
                  onRemoveRepeatMark={(measureIndex, markType) => {
                    dirtyRef.current = true;
                    setMeasureRepeatMarks((prev) => removeRepeatMark(prev, measureIndex, markType));
                  }}
                  systems={systemsForScore}
                  baseYOffset={baseYOffset}
                  isActiveStaff={staffIdx === activeStaffIndex || renderTraditionalAsCombinedSystem || renderFigurenotesAsCombinedSystem}
                  combinedCursorRowOffsetPx={combinedCursorRowOffsetPx}
                  cursorStaffClefType={activeStaffEntryForCombined ? activeStaffEntryForCombined.staff.clefType : undefined}
                  linkedNotationByStaffId={linkedNotationByStaffId}
                  tinWhistleLinkedFingeringScale={tinWhistleFingeringUiPercentToScale(tinWhistleLinkedFingeringScalePercent)}
                  staffCount={visibleStaffList.length > 0 ? visibleStaffList.length : staves.length}
                  staffHeight={effectiveStaffHeight}
                  showBarNumbers={showBarNumbers}
                  barNumberSize={barNumberSize}
                  showRhythmSyllables={showRhythmSyllables}
                  showAllNoteLabels={showAllNoteLabels}
                  enableEmojiOverlays={enableEmojiOverlays}
                  noteheadShape={noteheadShape}
                  noteheadEmoji={noteheadEmoji}
                  onNoteTeacherLabelChange={staffIdx === activeStaffIndex ? updateNoteTeacherLabel : undefined}
                  onNoteLabelClick={staffIdx === activeStaffIndex ? (index) => {
                    setSelectedNoteIndex(index);
                    setSelectionStart(-1);
                    setSelectionEnd(-1);
                    setCursorSubRow(0);
                    setCursorPosition(getBeatAtNoteIndex(notes, index));
                  } : undefined}
                  translateLabel={t}
                  chords={chords}
                  figurenotesSize={effectiveFigurenotesSize}
                  figurenotesStems={figurenotesStems}
                  figurenotesChordLineGap={figurenotesChordBlocks ? effectiveChordLineGap : 0}
                  figurenotesChordBlocks={figurenotesChordBlocks}
                  figurenotesChordBlocksShowTones={figurenotesChordBlocksShowTones}
                  figurenotesMelodyShowNoteNames={figurenotesMelodyShowNoteNames}
                  figurenotesRowHeight={figurenotesRowHeight}
                  figurenotesChordLineHeight={figurenotesChordBlocks ? figurenotesChordLineHeight : 0}
                  timeSignatureSize={timeSignatureSize}
                  pedagogicalTimeSigDenominatorType={pedagogicalTimeSigDenominatorType}
                  pedagogicalTimeSigDenominatorColor={pedagogicalTimeSigDenominatorColor}
                  pedagogicalTimeSigDenominatorInstrument={pedagogicalTimeSigDenominatorInstrument}
                  pedagogicalTimeSigDenominatorEmoji={pedagogicalTimeSigDenominatorEmoji}
                  themeColors={themeColors}
                  pedagogicalPlayheadStyle={pedagogicalPlayheadStyle}
                  pedagogicalPlayheadEmoji={pedagogicalPlayheadEmoji}
                  pedagogicalPlayheadEmojiSize={pedagogicalPlayheadEmojiSize}
                  cursorSizePx={cursorSizePx}
                  cursorLineStrokeWidth={cursorLineStrokeWidth}
                  cursorSubRow={cursorSubRow}
                  pedagogicalPlayheadMovement={pedagogicalPlayheadMovement}
                  isPedagogicalAudioPlaying={isPedagogicalAudioPlaying}
                  isExportingAnimation={isExportingAnimation}
                  exportCursorRef={isFirstVisible ? exportCursorRef : undefined}
                  exportNotationSvgRef={isFirstVisible ? exportNotationSvgRef : undefined}
                  scoreContainerRef={isFirstVisible ? scoreContainerRef : undefined}
                  multiStaffInstruments={combinedSystemInstruments}
                  multiStaffMeasuresByInstrument={combinedSystemMeasuresByInstrument}
                  combinedActiveStaffRowIndex={combinedActiveRowIndex}
                  pageFlowDirection={pageFlowDirection}
                  lyricFontFamily={lyricFontFamily}
                  lyricFontSize={lyricFontSize}
                  lyricLineYOffset={lyricLineYOffset}
                />
              );
            });
          })()}
          </div>
          {/* Puhkehetkede sildid: täislehe overlay ainult taasesitusel/animatsioonil — mitte tavalises redigeerimises (muidu katab noodid; pointer-events-none laseb klikid läbi → “nähtamatu aga töötav”). */}
          {intermissionLabels.some((lab) => cursorPosition >= lab.startBeat && cursorPosition < lab.endBeat) && (isPedagogicalAudioPlaying || isExportingAnimation) && !showPdfExportPreview && !isExportingPdf && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-amber-50/95 z-10" aria-hidden="true">
              <p className="text-2xl sm:text-4xl font-bold text-center text-amber-900 px-4 py-6 max-w-2xl" style={{ fontFamily: documentFontFamily }}>
                {intermissionLabels.find((lab) => cursorPosition >= lab.startBeat && cursorPosition < lab.endBeat)?.text || ''}
              </p>
            </div>
          )}
          {/* Teksti kastid overlay – peab olema kõrgemal kui scoreContentRef (z-index1), muidu figuurnoodi SVG neelab klõpsud ja kaste ei saa valida. */}
          <div className="absolute inset-0 z-[2] pointer-events-none" aria-hidden="true">
            {textBoxes.map((box) => {
              const w = box.width ?? 200;
              const h = box.height ?? 60;
              const align = box.textAlign ?? 'center';
              const columnCount = Math.max(1, Math.min(5, Math.floor(Number(box.columnCount) || 1)));
              const isSelected = selectedTextboxId === box.id;
              return (
                <div
                  key={box.id}
                  data-textbox-id={box.id}
                  className="pointer-events-auto absolute px-2 py-1 rounded border-2 bg-white/95 shadow text-amber-900 text-sm select-none whitespace-pre-wrap break-words overflow-hidden flex flex-col"
                  style={{
                    left: box.x,
                    top: box.y,
                    width: w,
                    height: h,
                    fontSize: box.fontSize || 14,
                    fontFamily: box.fontFamily || documentFontFamily,
                    fontWeight: box.fontWeight || undefined,
                    fontStyle: box.fontStyle || undefined,
                    borderColor: isSelected ? 'rgb(217 119 6)' : 'rgb(253 230 138)',
                    textAlign: align,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    if (e.target.closest('button') || e.target.closest('[data-resize-handle]')) return;
                    e.stopPropagation();
                    textboxDragStartRef.current = { id: box.id, startX: e.clientX, startY: e.clientY, boxStartX: box.x, boxStartY: box.y };
                  }}
                >
                  <div className="flex-1 flex items-start justify-between gap-1 min-h-0" style={{ textAlign: align }}>
                    <span
                      className="flex-1 min-w-0 block h-full overflow-hidden whitespace-pre-wrap break-words"
                      style={{
                        textAlign: align,
                        columnCount: columnCount > 1 ? columnCount : undefined,
                        columnGap: columnCount > 1 ? '16px' : undefined,
                        columnFill: columnCount > 1 ? 'auto' : undefined,
                      }}
                    >
                      {box.text}
                    </span>
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); dirtyRef.current = true; setTextBoxes(prev => prev.filter(b => b.id !== box.id)); setSelectedTextboxId(null); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="flex-shrink-0 text-red-600 hover:text-red-700 font-bold"
                          title={t('textBox.delete')}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                  {isSelected && (
                    <>
                      {(['n', 'e', 's', 'w']).map((handle) => {
                        const edgeStyle = {
                          n: { top: -5, left: 10, right: 10, height: 10, cursor: 'ns-resize' },
                          s: { bottom: -5, left: 10, right: 10, height: 10, cursor: 'ns-resize' },
                          e: { right: -5, top: 10, bottom: 10, width: 10, cursor: 'ew-resize' },
                          w: { left: -5, top: 10, bottom: 10, width: 10, cursor: 'ew-resize' },
                        }[handle];
                        return (
                          <div
                            key={`edge-${handle}`}
                            data-resize-handle
                            className="absolute z-10 rounded-sm bg-amber-500/35 hover:bg-amber-500/55"
                            style={edgeStyle}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              textboxDragStartRef.current = null;
                              textboxInteractionRef.current = {
                                type: 'resize',
                                id: box.id,
                                startX: e.clientX,
                                startY: e.clientY,
                                boxStartX: box.x,
                                boxStartY: box.y,
                                boxStartW: w,
                                boxStartH: h,
                                handle,
                              };
                            }}
                          />
                        );
                      })}
                      {['nw', 'ne', 'sw', 'se'].map((handle) => {
                        const pos = { nw: { top: -2, left: -2 }, ne: { top: -2, right: -2 }, sw: { bottom: -2, left: -2 }, se: { bottom: -2, right: -2 } }[handle];
                        const cursor = (handle === 'nw' || handle === 'se') ? 'nwse-resize' : 'nesw-resize';
                        return (
                          <div
                            key={handle}
                            data-resize-handle
                            className="absolute w-3 h-3 bg-amber-600 rounded-sm border border-amber-800 z-10"
                            style={{ ...pos, cursor }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              textboxDragStartRef.current = null;
                              textboxInteractionRef.current = {
                                type: 'resize',
                                id: box.id,
                                startX: e.clientX,
                                startY: e.clientY,
                                boxStartX: box.x,
                                boxStartY: box.y,
                                boxStartW: w,
                                boxStartH: h,
                                handle,
                              };
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
            );
          })()}
        </main>

        {/* Lehekülgede / ekraani vaate navigaator – kui dokument on pikem kui üks A4 leht */}
        {showPageNavigator && (lastVerticalContentHeightRef.current > 0 || logicalContentHeight > 0) && (() => {
          const a4PageHeight = a4PageHeightVal;
          const a4PageWidth = effectiveLayoutPageWidth;
          const contentH = pageFlowDirection === 'horizontal' ? (lastVerticalContentHeightRef.current || logicalContentHeight) : logicalContentHeight;
          const totalPages = Math.max(1, Math.ceil((contentH || logicalContentHeight) / a4PageHeight));
          if (totalPages <= 1) return null;
          const isHorizontalFlow = pageFlowDirection === 'horizontal';
          const pageStepV = viewFitOrSmart ? a4PageHeight * fitPageScale : a4PageHeight;
          const pageStepH = viewFitOrSmart ? a4PageWidth * fitPageScale : a4PageWidth;
          const currentPage = isHorizontalFlow
            ? Math.min(totalPages, Math.max(1, Math.floor(mainScrollLeft / pageStepH) + 1))
            : Math.min(totalPages, Math.max(1, Math.floor(mainScrollTop / pageStepV) + 1));
          const scrollToPage = (p) => {
            if (!mainRef.current) return;
            if (isHorizontalFlow) mainRef.current.scrollTo({ left: (p - 1) * pageStepH, behavior: 'smooth' });
            else mainRef.current.scrollTo({ top: (p - 1) * pageStepV, behavior: 'smooth' });
          };
          return (
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 py-2 px-2 bg-white/95 dark:bg-black/95 backdrop-blur rounded-xl border-2 border-amber-200 dark:border-white/20 shadow-lg">
              <span className="text-xs font-semibold text-amber-800 px-1 mb-1">{t('layout.pageNavigatorTitle')}</span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => scrollToPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === p ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                  title={t('layout.pageNavigatorGoTo').replace('{{page}}', String(p))}
                >
                  {p}
                </button>
              ))}
              <span className="text-xs text-amber-600 px-1 mt-1">{currentPage} / {totalPages}</span>
            </div>
          );
        })()}

        {/* Klaveri klaviatuur – täisfunktsionaalne interaktiivne klaver (vähemalt 2 oktaavi), heli + MIDI */}
        {pianoStripVisible && typeof document !== 'undefined' && createPortal(
          (() => {
            const firstNote = pianoRangeNumbers.first;
            const lastNote = pianoRangeNumbers.last;
            const activePresetId = PIANO_RANGE_PRESETS.find((p) => p.first === firstNote && p.last === lastNote)?.id ?? null;
            const rangeLabel = activePresetId ?? `${midiToRangeLabel(firstNote)}–${midiToRangeLabel(lastNote)}`;
            const handleNotePlay = (midiNumber) => {
              /* N-režiim: MIDI klaviatuur reageerib noodi sisestusele (noot lisatakse kursori juurde). SEL-režiim: mitte. */
              if (!noteInputMode) return;
              const resolved = resolveSpellingForMidiInKey(midiNumber, keySignature);
              const { pitch, octave } = resolved || midiToPitchOctave(midiNumber);
              const accidental = resolved ? resolved.accidental : getAccidentalForPianoKey(midiNumber, keySignature);
              setGhostPitch(pitch);
              setGhostOctave(octave);
              addNoteAtCursor(pitch, octave, accidental, { skipPlay: true });
            };
            return (
              <div className="fixed bottom-0 left-0 right-0 z-[100] min-h-[140px] bg-gradient-to-t from-amber-100 to-amber-50 border-t-2 border-amber-300 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] py-3 px-4" style={{ isolation: 'isolate' }}>
                <div className="mx-auto max-w-4xl" style={{ minHeight: 120 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                        {t('toolbox.pianoKeyboard')}
                      </span>
                      <span className="text-xs text-amber-600">({t('midi.mouseKeyboardHint') || 'Hiirega või arvutiklahvidega mängi noote. Noot ilmub noodijoonestikule.'}) Alt+←/→ nihutab vahemikku.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-amber-700 font-medium">{t('layout.range') || 'Vahemik'}:</span>
                        {PIANO_RANGE_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPianoRangeNumbers({ first: preset.first, last: preset.last })}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activePresetId === preset.id ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        {!activePresetId && (
                          <span className="text-xs text-amber-700 font-medium">{rangeLabel}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPianoStripVisible(false); setActiveToolbox(null); }}
                        className="px-2 py-1 rounded text-xs font-medium bg-amber-200/80 text-amber-900 hover:bg-amber-300 border border-amber-300"
                        title={t('midi.closePiano') || 'Sulge klaviatuur'}
                      >
                        {t('midi.closePianoShort') || 'Sulge'}
                      </button>
                    </div>
                  </div>
                  <div ref={pianoStripWrapperRef} className="NoodiMeisterPianoWrapper" style={{ width: '100%', minHeight: 100, height: 100 }}>
                    <InteractivePiano
                      firstNote={firstNote}
                      lastNote={lastNote}
                      width={pianoStripWidth}
                      height={100}
                      showMidiSelect={true}
                      onNotePlay={handleNotePlay}
                      figurenotesColors={notationStyle === 'FIGURENOTES' ? FIGURENOTES_COLORS : null}
                      getKeyColor={notationMode === 'vabanotatsioon'
                        ? (pitch, oct) => {
                          const cfg = instrumentConfig?.[instrument];
                          if (cfg?.colorSystem === 'chromaNotes') return getChromaNotesColor(pitch, 0);
                          if (cfg?.colorSystem === 'schoolHandbells') return getSchoolHandbellColor(pitch, 0);
                          return getPedagogicalSymbol(keySignature, joClefStaffPosition, pitch, oct).color;
                        }
                        : null}
                      keySignature={keySignature}
                      keyboardPlaysPiano={pianoStripVisible && (notationStyle === 'FIGURENOTES' || notationMode === 'vabanotatsioon')}
                      ignoreKeyboardWhenModalOpen={newWorkSetupOpen || saveCloudDialogOpen || googleLoadPickerOpen || settingsOpen || shortcutsOpen || showPdfExportPreview || isInstrumentManagerOpen}
                    />
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}
      </div>
    </div>
  );
}

// Pitch/octave ↔ MIDI (C4 = 60, C0 = 12). getMidiAttributes / noteStringToMidi.
function pitchOctaveToMidi(pitch, octave) {
  const semi = PITCH_TO_SEMI[pitch] ?? 0;
  const oct = Number(octave);
  if (!Number.isFinite(oct)) return 60;
  return (oct + 1) * 12 + semi;
}

/** Transponeerib kõik noodid etteantud pooltoonide võrra. Pausid jäävad muutmata. */
// transposeNotes imporditud musical/transpose.js

function tuningStringToMidi(s) {
  const m = s.match(/^([A-G])(#|b)?(\d+)$/i);
  if (!m) return 0;
  let semi = PITCH_TO_SEMI[m[1].toUpperCase()] ?? 0;
  if (m[2] === '#') semi++; else if (m[2] === 'b') semi--;
  return (parseInt(m[3], 10) + 1) * 12 + semi;
}

// Häälestus: võrdtempereeritud sagedus noodist (pitch, octave). refNote/refOctave/refHz = võrdlusnoot (nt A3=440).
function getNoteFrequency(refNote, refOctave, refHz, pitch, octave, semitonesOffset = 0) {
  const refSemi = PITCH_TO_SEMI[refNote] ?? 9;
  const noteSemi = PITCH_TO_SEMI[pitch] ?? 0;
  const semitones = (octave - refOctave) * 12 + (noteSemi - refSemi) + semitonesOffset;
  return refHz * Math.pow(2, semitones / 12);
}

// Ühe noodi lühike heli Web Audio API-ga (kutsuda kasutajategevuse kontekstis).
function playTone(audioContextRef, frequency, durationMs = 280) {
  try {
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
    }
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationMs / 1000);
    return () => {
      try { osc.stop(); } catch (_) {}
    };
  } catch (_) { /* ignore */ }
  return null;
}

// For TAB: given pitch+octave and tuning array (low to high), return { stringIndex (0=low), fret } with lowest fret preferred.
function pitchToTab(pitch, octave, tuning) {
  const noteMidi = pitchOctaveToMidi(pitch, octave);
  let best = { stringIndex: 0, fret: 24 };
  for (let i = 0; i < tuning.length; i++) {
    const stringMidi = tuningStringToMidi(tuning[i]);
    const fret = noteMidi - stringMidi;
    if (fret >= 0 && fret <= 24 && fret < best.fret) best = { stringIndex: i, fret };
  }
  return best;
}

// Tin whistle (D) and recorder (soprano C) fingering. (FINGERING_* on defineeritud üleval.)
function getFingeringForNote(pitch, octave, instrumentId) {
  const key = pitch + octave;
  if (instrumentId === 'tin-whistle' || String(instrumentId || '').startsWith('tin-whistle-')) return FINGERING_TIN_WHISTLE[key];
  if (instrumentId === 'recorder') return FINGERING_RECORDER[key];
  if (instrumentId === 'flute') return null; // optional: add flute chart later
  return null;
}

// Timeline Component – multi-system layout (VexFlow loogika). (PAGE_BREAK_GAP on defineeritud üleval.)
function Timeline({ measures, timeSignature, timeSignatureMode, pixelsPerBeat, pageWidth, cursorPosition, notationMode, staffLines, clefType, keySignature = 'C', relativeNotationShowKeySignature = false, relativeNotationShowTraditionalClef = false, onJoClefPositionChange, joClefFocused = false, onJoClefFocus, instrument = 'single-staff-treble', instrumentNotationVariant = 'standard', instrumentConfig = {}, showBarNumbers = true, barNumberSize = 11, showRhythmSyllables = false, joClefStaffPosition: joClefStaffPositionProp, showAllNoteLabels = false, enableEmojiOverlays = true, noteheadShape = 'oval', noteheadEmoji = '♪', onNoteTeacherLabelChange, onNoteLabelClick, chords = [], isDotted, isRest, selectedDuration, noteInputMode, selectedNoteIndex, isNoteSelected, notes: allNotes, onStaffAddNote, onNoteClick, onNoteMouseDown, onNoteMouseEnter, onNotePitchChange, onNoteBeatChange, canHandDragNotes = false, ghostPitch, ghostOctave, ghostAccidental = 0, ghostAccidentalIsExplicit = false, onFigureBeatClick, onChordLineMouseMove, onChordLineClick, notationStyle, layoutMeasuresPerLine = 4, layoutLineBreakBefore = [], layoutPageBreakBefore = [], layoutSystemGap = 120, layoutPartsGap, layoutConnectedBarlines = false, staffRowAlignment = 'center', staffIndexInScore = 0, systemTotalHeight, layoutGlobalSpacingMultiplier = 1, systems: systemsProp, baseYOffset = 0, isActiveStaff = true, staffCount = 1, staffHeight: staffHeightProp, figurenotesSize = 16, figurenotesStems = false, figurenotesChordLineGap = 6, figurenotesChordBlocks = false, figurenotesChordBlocksShowTones = true, figurenotesMelodyShowNoteNames = true, figurenotesRowHeight: figurenotesRowHeightProp, figurenotesChordLineHeight: figurenotesChordLineHeightProp, timeSignatureSize = 16, pedagogicalTimeSigDenominatorType = 'rhythm', pedagogicalTimeSigDenominatorColor = '#1a1a1a', pedagogicalTimeSigDenominatorInstrument = 'handbell', pedagogicalTimeSigDenominatorEmoji = '🥁', themeColors: themeColorsProp, pedagogicalPlayheadStyle = 'line', pedagogicalPlayheadEmoji = '🎵', pedagogicalPlayheadEmojiSize = 32, cursorSizePx, cursorLineStrokeWidth = 4, cursorSubRow = 0, pedagogicalPlayheadMovement = 'arch', isPedagogicalAudioPlaying = false, isExportingAnimation = false, exportCursorRef, scoreContainerRef, pageFlowDirection = 'vertical', pageOrientation = 'portrait', isFirstInBraceGroup = false, braceGroupSize = 0, lyricFontFamily = 'sans-serif', lyricFontSize = 12, lyricLineYOffset = 0, translateLabel, showLayoutBreakIcons = false, showStaffSpacerHandles = false, onSystemYOffsetChange, onToggleLineBreakAfter, onRemoveRepeatMark, activeLyricNoteIndex = null, physicalPageGapPx = 3, disablePhysicalPageGaps = false, hideCursorOverlay = false, exportNotationSvgRef = null, multiStaffInstruments = null, multiStaffMeasuresByInstrument = null, combinedCursorRowOffsetPx = 0, combinedActiveStaffRowIndex = 0, cursorStaffClefType = null, tinWhistleLinkedFingeringScale = 1, linkedNotationByStaffId = null }) {
  const themeColors = themeColorsProp || { staffLineColor: '#000', noteFill: '#1a1a1a', textColor: '#1a1a1a', isDark: false };
  const safeKey = keySignature ?? 'C';
  // Alati lõplik number (mitte NaN) — varajane `return null` enne hookide kasutamist rikkus Reacti hookide reeglid ja võis jätta noodiala tühjaks.
  const joClefStaffPosition = (() => {
    if (typeof joClefStaffPositionProp === 'number' && Number.isFinite(joClefStaffPositionProp)) return joClefStaffPositionProp;
    const t = getTonicStaffPosition(safeKey);
    return Number.isFinite(t) ? t : getTonicStaffPosition('C');
  })();
  const isFigurenotesMode = notationStyle === 'FIGURENOTES';
  /** x / ruut / kolmnurk on figuurnotatsiooni värvikujud (tööriistariba seis); klassikaline joonestik kasutab alati ovaali (Leland). */
  const traditionalStaffNoteheadShape =
    noteheadShape === 'x' || noteheadShape === 'square' || noteheadShape === 'triangle' ? 'oval' : noteheadShape;
  const instCfg = instrumentConfig[instrument];
  const isTabMode = instCfg?.type === 'tab' && instrumentNotationVariant === 'tab';
  const isFingeringMode = instCfg?.type === 'wind' && instCfg?.fingering && instrumentNotationVariant === 'fingering';
  const tabStrings = isTabMode && instCfg?.strings ? instCfg.strings : 0;
  const tabTuning = isTabMode && instCfg?.tuning ? instCfg.tuning : [];

  const timelineHeight = staffHeightProp ?? getStaffHeight();
  const barLineWidth = isFigurenotesMode ? Math.max(2, Math.round(5 * figurenotesSize / 75)) : 2;
  /** Cursor/playhead line inset so it aligns with beat-box (scaled with Noodigraafika suurus in figurenotes). */
  // In figurenotes with chord blocks: cursor line spans melody + chord row so it’s visible on both; otherwise melody/staff only.
  const cursorRowHeight = isFigurenotesMode && (figurenotesRowHeightProp != null && figurenotesRowHeightProp > 0)
    ? figurenotesRowHeightProp
    : timelineHeight;
  const cursorInset = isFigurenotesMode
    ? Math.max(8, Math.min(20, Math.round(cursorRowHeight * 0.1)))
    : 5;
  const chordExtension = isFigurenotesMode && figurenotesChordBlocks && (figurenotesChordLineHeightProp ?? 0) > 0
    ? figurenotesChordLineGap + figurenotesChordLineHeightProp
    : 0;
  const cursorBottomInset = isFigurenotesMode && chordExtension > 0 ? Math.max(2, Math.round(cursorRowHeight * 0.05)) : cursorInset;
  const chordRowInset = Math.max(2, Math.round((figurenotesChordLineHeightProp ?? 0) * 0.1));
  // cursorSubRow: 0 = meloodiarida, 1 = akordirida (lugeri/kuulaja rida). Cmd/Ctrl+↑/↓ vahetab.
  const useChordRowCursor = isFigurenotesMode && figurenotesChordBlocks && chordExtension > 0 && cursorSubRow === 1;
  const cursorY1 = useChordRowCursor
    ? cursorRowHeight + figurenotesChordLineGap + chordRowInset
    : cursorInset;
  const cursorY2 = useChordRowCursor
    ? cursorRowHeight + figurenotesChordLineGap + (figurenotesChordLineHeightProp ?? 0) - chordRowInset
    : (chordExtension > 0 ? cursorRowHeight - cursorInset : cursorRowHeight + chordExtension - cursorBottomInset);
  const crOff = (typeof combinedCursorRowOffsetPx === 'number' && Number.isFinite(combinedCursorRowOffsetPx) && combinedCursorRowOffsetPx > 0)
    ? combinedCursorRowOffsetPx
    : 0;
  const BEAT_BOX_STROKE = '#b0b0b0';
  const renderStaffCount = isFigurenotesMode ? (staffCount || 1) : 1;
  const layoutOptions = {
    measuresPerLine: layoutMeasuresPerLine,
    lineBreakBefore: layoutLineBreakBefore,
    pageBreakBefore: layoutPageBreakBefore,
    systemGap: layoutSystemGap,
    staffCount: renderStaffCount,
    globalSpacingMultiplier: layoutGlobalSpacingMultiplier,
    ...(isFigurenotesMode ? {} : { marginLeft: LAYOUT.CONTENT_LEFT_TRADITIONAL }),
  };
  const systemsComputed = systemsProp ?? computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth || LAYOUT.PAGE_WIDTH_MIN, layoutOptions);
  const systems = systemsComputed.map((s) => ({ ...s, yOffset: s.yOffset + baseYOffset }));
  const notesByMeasure = React.useMemo(() => {
    const out = (measures || []).map(() => []);
    let beat = 0;
    (allNotes || []).forEach((note) => {
      const noteBeat = typeof note.beat === 'number' ? note.beat : beat;
      const idx = (measures || []).findIndex((m) => noteBeat >= m.startBeat && noteBeat < m.endBeat);
      if (idx >= 0) out[idx].push({ ...note, beat: noteBeat });
      beat = noteBeat + note.duration;
    });
    return out;
  }, [measures, allNotes]);

  const durationLabelToNoteSymbolType = (dur) => {
    const map = { '1/1': 'whole', '1/2': 'half', '1/4': 'quarter', '1/8': 'eighth', '1/16': 'sixteenth', '1/32': 'thirtySecond' };
    return map[dur] || 'quarter';
  };
  const effectiveMeasures = React.useMemo(() => (measures || []).map((m, i) => ({ ...m, notes: notesByMeasure[i] || [] })), [measures, notesByMeasure]);
  const timelineSvgRef = useRef(null);
  const [staffSpacerDrag, setStaffSpacerDrag] = React.useState({ systemIndex: null, startClientY: 0, cumulativeDelta: 0 });
  // SVG viewBox height must include baseYOffset: each staff Timeline shifts systems down by
  // visibleIndex * (staffHeight + gap) + staffYOffsets[i]. Omitting it made the SVG too short;
  // .sheet-music-page overflow:hidden then clipped notation (title/inputs above still visible).
  const lastSystemLayoutY = systemsComputed.length > 0 ? systemsComputed[systemsComputed.length - 1].yOffset : 0;
  // Mitme eraldi Timeline/SVG korral (üks partii = üks SVG) ei tohi esimese rea SVG kõrgust
  // arvutada kogu süsteemi systemTotalHeight järgi: see jätab tühja vertikaalse riba,
  // sest teised read on eraldi DOM-is allpool (kasutaja näeb "vale vahet" isegi kui mm=0).
  const splitMultiStaffTraditional = !isFigurenotesMode && (staffCount || 0) > 1;
  const isFigureCombinedSystem = isFigurenotesMode && Array.isArray(multiStaffInstruments) && multiStaffInstruments.length > 1;
  const connectedSystemSpan = (!isFigurenotesMode
    && layoutConnectedBarlines
    && staffIndexInScore === 0
    && Number.isFinite(systemTotalHeight)
    && systemTotalHeight > 0
    && !splitMultiStaffTraditional)
    ? systemTotalHeight
    : (isFigureCombinedSystem
      ? getTraditionalSystemTotalHeightPx(multiStaffInstruments.length, timelineHeight + (layoutPartsGap ?? 0), layoutPartsGap ?? 0)
      : (isFigurenotesMode ? timelineHeight : (renderStaffCount * timelineHeight)));
  // Important: traditional score renders one Timeline per staff.
  // Fixed tail padding here created an artificial inter-staff gap even when gap=0.
  const timelineTailPadding = (!isFigurenotesMode && renderStaffCount === 1) ? 0 : 40;
  const contentExtentBelowLayout = systemsComputed.length > 0
    ? lastSystemLayoutY + connectedSystemSpan + timelineTailPadding
    : connectedSystemSpan + timelineTailPadding;
  const safeBaseYOffset = Number.isFinite(baseYOffset) ? baseYOffset : 0;
  const totalHeightLogical = safeBaseYOffset + contentExtentBelowLayout;
  const isHorizontal = pageFlowDirection === 'horizontal';
  const a4Ratio = pageOrientation === 'landscape' ? LAYOUT.A4_HEIGHT_RATIO_LANDSCAPE : LAYOUT.A4_HEIGHT_RATIO;
  const a4PageHeight = (pageWidth || LAYOUT.PAGE_WIDTH_MIN) * a4Ratio;
  const totalPages = Math.max(1, Math.ceil(totalHeightLogical / a4PageHeight));
  // Screen-only "physical page gaps" like MuseScore/Docs (keeps logical layout & export intact).
  const pageGapPx = (!disablePhysicalPageGaps && !isHorizontal) ? Math.max(0, Number(physicalPageGapPx) || 0) : 0;
  const systemsForDisplay = pageGapPx > 0
    ? systems.map((sys) => {
        const pageIndex = Math.max(0, Math.floor((sys.yOffset || 0) / a4PageHeight));
        return { ...sys, yOffset: (sys.yOffset || 0) + pageIndex * pageGapPx };
      })
    : systems;
  const totalHeight = pageGapPx > 0 ? (totalHeightLogical + Math.max(0, totalPages - 1) * pageGapPx) : totalHeightLogical;
  const centerY = timelineHeight / 2;
  const pw = pageWidth || LAYOUT.PAGE_WIDTH_MIN;
  const marginLeft = isFigurenotesMode && systemsComputed.length > 0
    ? (() => {
        const rowWidth = (systemsComputed[0].measureWidths ?? []).reduce((a, b) => a + b, 0);
        if (staffRowAlignment === 'left') return LAYOUT.MARGIN_LEFT;
        if (staffRowAlignment === 'right') return Math.max(LAYOUT.MARGIN_LEFT, Math.round(pw - rowWidth - LAYOUT.MARGIN_RIGHT));
        const centered = Math.round((pw - rowWidth) / 2);
        return Math.max(LAYOUT.MARGIN_LEFT, centered);
      })()
    : LAYOUT.MARGIN_LEFT;

  const spacing = STAFF_SPACE;
  const getStaffLinePositions = () => {
    if (isTabMode && tabStrings >= 1) {
      const tabSpace = 12;
      const startY = centerY - (tabStrings - 1) * tabSpace / 2;
      return Array.from({ length: tabStrings }, (_, i) => startY + i * tabSpace);
    }
    return getStaffLinePositionsFromConstants(centerY, staffLines, spacing);
  };

  const staffLinePositions = getStaffLinePositions();
  const middleLineY = isTabMode ? centerY : getMiddleStaffLineY(centerY, staffLines, spacing);

  const staffSpacerDragRef = useRef(staffSpacerDrag);
  staffSpacerDragRef.current = staffSpacerDrag;
  React.useEffect(() => {
    if (staffSpacerDrag.systemIndex == null || typeof onSystemYOffsetChange !== 'function') return;
    const onMove = (e) => {
      const cur = staffSpacerDragRef.current;
      if (cur.systemIndex == null) return;
      const delta = e.clientY - cur.startClientY;
      if (Math.abs(delta) >= 0.5) {
        onSystemYOffsetChange(cur.systemIndex, delta);
        setStaffSpacerDrag((prev) => ({ ...prev, startClientY: e.clientY, cumulativeDelta: (prev.cumulativeDelta || 0) + delta }));
      }
    };
    const onUp = () => setStaffSpacerDrag({ systemIndex: null, startClientY: 0, cumulativeDelta: 0 });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [staffSpacerDrag.systemIndex, onSystemYOffsetChange]);

  if (typeof GLOBAL_NOTATION_CONFIG === 'undefined' || !GLOBAL_NOTATION_CONFIG) return null;

  // Helistiku toonika (I aste) noodijoonestiku positsiooni jaoks: [pitch, octave]. Kõik helistikud.
  const KEY_TONIC_FOR_STAFF = { C: ['C', 4], G: ['G', 4], D: ['D', 4], A: ['A', 4], E: ['E', 4], B: ['B', 4], F: ['F', 4], Bb: ['B', 4], Eb: ['E', 4] };
  // JO-võtme lohistamisel: (pitch, octave) → helistik (looduslikud astmed C,D,E,F,G,A,B).
  const STAFF_PITCH_TO_KEY = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' };

  // JO-võti on rakenduse nullpunkt: noteY = joKeyY + relativeIntervalOffset (StaffConstants.getVerticalPositionFromJoAnchor).
  const joKeyY = getYFromStaffPosition(joClefStaffPosition, centerY, 5, spacing);
  const notationClefForPitch = cursorStaffClefType || clefType;
  const effectiveClefForPitch = notationMode === 'vabanotatsioon' ? 'jo' : notationClefForPitch;
  const getPitchY = (pitch, octave) => {
    if (staffLines !== 5) return centerY;
    if (notationMode === 'vabanotatsioon') {
      return getVerticalPositionFromJoAnchor(joKeyY, pitch, octave, keySignature, spacing);
    }
    return getVerticalPosition(pitch, octave, effectiveClefForPitch, {
      centerY,
      staffSpace: spacing,
      keySignature,
    });
  };

  // Map staff Y position to pitch (pöördväärtus getPitchY-st). JO-režiimis: getPitchFromJoClick(joKeyY ankur).
  const getPitchFromY = (clickY, clefOverride = null) => {
    if (staffLines !== 5 || !onStaffAddNote) return null;
    if (notationMode === 'vabanotatsioon') {
      return getPitchFromJoClick(clickY, joKeyY, keySignature, spacing);
    }
    const clefMap = clefOverride || notationClefForPitch;
    const bottomY = centerY + spacing * 2;
    const relToPitch = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const index = Math.round((bottomY - clickY) * 2 / spacing);
    if (clefMap === 'treble') {
      const x = index + 2;
      const q = Math.floor(x / 7);
      const r = ((x % 7) + 7) % 7;
      const octave = 4 + q;
      const pitch = relToPitch[r];
      return { pitch, octave };
    }
    const x = index + 4;
    const q = Math.floor(x / 7);
    const r = ((x % 7) + 7) % 7;
    const octave = 3 + q;
    const pitch = relToPitch[r];
    return { pitch, octave };
  };

  const handleStaffClick = (e) => {
    if (!noteInputMode || !onStaffAddNote) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = e.clientY ?? (e.changedTouches?.[0]?.clientY) ?? (e.touches?.[0]?.clientY);
    if (clientY == null) return;
    const clickY = clientY - rect.top;
    const multiTradRows = Array.isArray(multiStaffInstruments) && multiStaffInstruments.length > 1 && notationStyle !== 'FIGURENOTES';
    const tradRowCount = multiTradRows ? multiStaffInstruments.length : 1;
    for (const sys of systems) {
      const staffTop = sys.yOffset;
      const staffBottom = sys.yOffset + timelineHeight * tradRowCount;
      if (clickY >= staffTop - 15 && clickY <= staffBottom + 15) {
        let localY = clickY - sys.yOffset;
        let clickClef = notationClefForPitch;
        if (multiTradRows) {
          const ri = Math.min(tradRowCount - 1, Math.max(0, Math.floor(localY / timelineHeight)));
          localY -= ri * timelineHeight;
          clickClef = multiStaffInstruments[ri]?.clef || clefType;
        }
        const pitchInfo = getPitchFromY(localY, clickClef);
        const clickMargin = 15;
        const ledgerMargin = staffLines === 5 ? 10 * 2 : 0;
        if (pitchInfo && localY >= staffLinePositions[0] - clickMargin && localY <= staffLinePositions[staffLinePositions.length - 1] + clickMargin + ledgerMargin) {
          if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault?.();
          onStaffAddNote(pitchInfo.pitch, pitchInfo.octave);
        }
        break;
      }
    }
  };

  // Render time signature (classic or pedagogical)
  const renderTimeSignature = () => {
    const x = 45;
    const y = centerY;

    if (timeSignatureMode === 'pedagogical') {
      // Pedagogical mode: numerator as number, denominator as note symbol
      // Noodivars noodipeast vasakult alla (lihtsustatud taktimõõdu reegel)
      const stemX = x - 4;
      const getNoteSymbolForDenominator = () => {
        const noteY = y + 18;
        const noteX = x;
        
        switch(timeSignature.beatUnit) {
          case 1: // Whole note
            return (
              <ellipse cx={noteX} cy={noteY} rx="5" ry="3" fill="none" stroke={themeColors.textColor} strokeWidth="1.5"/>
            );
          case 2: // Half note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="none" stroke={themeColors.textColor} strokeWidth="1.5"/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke={themeColors.textColor} strokeWidth="1.5"/>
              </>
            );
          case 4: // Quarter note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill={themeColors.noteFill}/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke={themeColors.textColor} strokeWidth="1.5"/>
              </>
            );
          case 8: // Eighth note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill={themeColors.noteFill}/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke={themeColors.textColor} strokeWidth="1.5"/>
                <path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15}`} fill={themeColors.noteFill}/>
              </>
            );
          case 16: // Sixteenth note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill={themeColors.noteFill}/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke={themeColors.textColor} strokeWidth="1.5"/>
                <path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15} M ${stemX} ${noteY + 17} Q ${stemX - 6} ${noteY + 15} ${stemX} ${noteY + 12}`} fill={themeColors.noteFill}/>
              </>
            );
          default:
            return <text x={noteX} y={noteY + 20} textAnchor="middle" fontSize="16" fontWeight="bold" fill={themeColors.textColor}>{timeSignature.beatUnit}</text>;
        }
      };

      return (
        <g>
          <text x={x} y={y - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill={themeColors.textColor}>
            {timeSignature.beats}
          </text>
          <line x1={x - 10} y1={y + 2} x2={x + 10} y2={y + 2} stroke={themeColors.textColor} strokeWidth="1.5"/>
          {getNoteSymbolForDenominator()}
        </g>
      );
    } else {
      // Classic mode: both as numbers
      return (
        <g>
          <text x={x} y={y - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill={themeColors.textColor}>
            {timeSignature.beats}
          </text>
          <line x1={x - 10} y1={y + 2} x2={x + 10} y2={y + 2} stroke={themeColors.textColor} strokeWidth="1.5"/>
          <text x={x} y={y + 20} textAnchor="middle" fontSize="18" fontWeight="bold" fill={themeColors.textColor}>
            {timeSignature.beatUnit}
          </text>
        </g>
      );
    }
  };

  // Standard (traditional) rest symbols – staff position centerY
  const renderStandardRest = (note, x, restY) => {
    const dur = note.durationLabel || '1/4';
    const scale = 0.9;
    const w = 8 * scale;
    const h = 3 * scale;
    if (dur === '1/1') {
      return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill={themeColors.noteFill}/>;
    }
    if (dur === '1/2') {
      return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill={themeColors.noteFill}/>;
    }
    if (dur === '1/4') {
      return <path d={`M ${x} ${restY - 10} Q ${x + 6} ${restY - 4} ${x} ${restY} Q ${x - 6} ${restY + 4} ${x} ${restY + 10}`} stroke={themeColors.noteFill} strokeWidth="1.8" fill="none"/>;
    }
    if (dur === '1/8') {
      return (
        <g stroke={themeColors.noteFill} fill={themeColors.noteFill} strokeWidth="1.2">
          <circle cx={x} cy={restY - 4} r="2"/>
          <path d={`M ${x} ${restY - 2} Q ${x - 6} ${restY} ${x} ${restY + 6}`} fill="none" strokeWidth="1.5"/>
        </g>
      );
    }
    if (dur === '1/16') {
      return (
        <g stroke={themeColors.noteFill} fill={themeColors.noteFill} strokeWidth="1.2">
          <circle cx={x} cy={restY - 6} r="1.8"/>
          <circle cx={x} cy={restY} r="1.8"/>
          <path d={`M ${x} ${restY + 2} Q ${x - 5} ${restY + 4} ${x} ${restY + 10}`} fill="none" strokeWidth="1.5"/>
        </g>
      );
    }
    if (dur === '1/32') {
      return (
        <g stroke={themeColors.noteFill} fill={themeColors.noteFill} strokeWidth="1.1">
          <circle cx={x} cy={restY - 8} r="1.5"/>
          <circle cx={x} cy={restY - 2} r="1.5"/>
          <circle cx={x} cy={restY + 4} r="1.5"/>
          <path d={`M ${x} ${restY + 6} Q ${x - 4} ${restY + 8} ${x} ${restY + 12}`} fill="none" strokeWidth="1.3"/>
        </g>
      );
    }
    return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill={themeColors.noteFill}/>;
  };

  // Figurenotes rendering function (size from figurenotesSize setting); kujund = getFigureSymbol(pitch, octave)
  const renderFigurenote = (note, x, y, noteIndex) => {
    const { shape } = getFigureSymbol(note.pitch, note.octave);
    const size = figurenotesSize;
    const isSelected = isNoteSelected(noteIndex);
    const dur = note.durationLabel || '1/4';
    const drawStem = figurenotesStems && dur !== '1/1';
    const stemLength = 26;
    const stemX = x + size / 2 + 1;
    const stemY1 = y;
    const stemY2 = y - stemLength;

    const textColor = getFigurenoteTextColor(note.pitch);
    const shapeElement = (() => {
      const r = size / 2;
      const strokeShape = isSelected ? '#2563eb' : (themeColors.isDark ? '#ffffff' : '#000');
      const strokeWShape = isSelected ? 3 : (themeColors.isDark ? 2.5 : 2);
      if (shape === 'none') {
        return (
          <rect x={x - r} y={y - r} width={size} height={size} fill="none" stroke={strokeShape} strokeWidth={strokeWShape} strokeDasharray="2 2" opacity={0.6} />
        );
      }
      const style = getFigureStyle(note.pitch, note.octave);
      const shapePaths = getShapePathsByOctave(note.octave);
      const svgX = x - size / 2;
      const svgY = y - size / 2;
      return (
        <svg
          x={svgX}
          y={svgY}
          width={size}
          height={size}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible' }}
        >
          {shapePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={style.fill}
              stroke={isSelected ? '#2563eb' : style.stroke}
              strokeWidth={isSelected ? 3 : style.strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      );
    })();

    const pad = Math.max(4, size * 0.25);
    const tailLength = (dur === '1/1') ? Math.max(20, size * 1.4) : (dur === '1/2') ? Math.max(12, size * 0.85) : 0;
    const selectionHeight = size * 2.5 + tailLength;
    return (
      <g>
        {shapeElement}
        {/* Noodi nimi kujundi sees: JO, LE, MI (Kodály solfeeg) */}
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={textColor} fontSize={Math.max(8, size * 0.5)} fontWeight="bold">
          {getJoName(note.pitch, note.octave, keySignature)}
        </text>
        {/* Pikkade nootide (1/2, 1/1) alumine saba – visuaalselt näitab noodi pikkust */}
        {tailLength > 0 && (
          <line
            x1={x}
            y1={y + size / 2}
            x2={x}
            y2={y + size / 2 + tailLength}
            stroke={themeColors.noteFill}
            strokeWidth={Math.max(2, size * 0.14)}
            strokeLinecap="round"
          />
        )}
        {/* Noodivarte režiim: vars ja vibud (lühikestel nootidel) */}
        {drawStem && (
          <g stroke={themeColors.noteFill} fill={themeColors.noteFill} strokeWidth="1.8">
            <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} />
            {dur === '1/8' && (
              <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill={themeColors.noteFill} />
            )}
            {dur === '1/16' && (
              <>
                <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill={themeColors.noteFill} />
                <path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill={themeColors.noteFill} />
              </>
            )}
            {dur === '1/32' && (
              <>
                <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill={themeColors.noteFill} />
                <path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill={themeColors.noteFill} />
                <path d={`M ${stemX} ${stemY2 + 12} Q ${stemX + 8} ${stemY2 + 16} ${stemX} ${stemY2 + 20}`} fill={themeColors.noteFill} />
              </>
            )}
          </g>
        )}
        {/* Alteratsiooninool: ♯ = nool paremale üles (↗), ♭ = nool vasakule üles (↖). Gap figuuri ja noole vahel 0,5 px. */}
        {(note.accidental === 1 || note.accidental === -1) && (() => {
          const arrowLen = 28 / Math.SQRT2;
          const head = Math.max(3, size * 0.14);
          const strokeW = Math.max(2.5, size * 0.07);
          const gap = 0;
          const arrowY = y - size / 2 - gap - arrowLen / 2;
          const stroke = '#1a1a1a';
          if (note.accidental === 1) {
            const tipX = x + arrowLen / 2;
            const tipY = arrowY - arrowLen / 2;
            return (
              <g stroke={stroke} fill={stroke} strokeWidth={strokeW} strokeLinecap="butt" strokeLinejoin="miter">
                <line x1={x - arrowLen / 2} y1={arrowY + arrowLen / 2} x2={tipX} y2={tipY} />
                <polygon points={`${tipX},${tipY} ${tipX - head},${tipY} ${tipX},${tipY + head}`} />
              </g>
            );
          }
          const tipX = x - arrowLen / 2;
          const tipY = arrowY - arrowLen / 2;
          return (
            <g stroke={stroke} fill={stroke} strokeWidth={strokeW} strokeLinecap="butt" strokeLinejoin="miter">
              <line x1={x + arrowLen / 2} y1={arrowY + arrowLen / 2} x2={tipX} y2={tipY} />
              <polygon points={`${tipX},${tipY} ${tipX + head},${tipY} ${tipX},${tipY + head}`} />
            </g>
          );
        })()}
        {/* Selection glow effect (klass: PDF/print eemaldab) */}
        {isSelected && (
          <g className="nm-note-selection-glow">
            <circle
              cx={x}
              cy={y}
              r={size / 2 + 4}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              opacity="0.5"
            >
              <animate
                attributeName="opacity"
                values="0.5;0.2;0.5"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}
      </g>
    );
  };

  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
  const getSystemTotalBeats = (sys) => sys.measureIndices.reduce((sum, i) => sum + (effectiveMeasures[i]?.beatCount ?? beatsPerMeasure), 0);
  const findCursorSystem = () => {
    let beatAcc = 0;
    for (let s = 0; s < systems.length; s++) {
      const sys = systems[s];
      const beatsInSys = getSystemTotalBeats(sys);
      if (cursorPosition >= beatAcc && cursorPosition < beatAcc + beatsInSys)
        return { system: sys, localBeat: cursorPosition - beatAcc };
      beatAcc += beatsInSys;
    }
    return systems.length > 0 ? { system: systems[0], localBeat: cursorPosition } : null;
  };
  const cursorInfo = findCursorSystem();
  const cursorSlotCenterX = cursorInfo ? (() => {
    const sys = cursorInfo.system;
    const widths = sys.measureWidths ?? sys.measureIndices.map(() => sys.measureWidth ?? beatsPerMeasure * 80);
    let beatLeft = cursorInfo.localBeat;
    for (let j = 0; j < sys.measureIndices.length; j++) {
      const m = effectiveMeasures[sys.measureIndices[j]];
      const beatCount = m?.beatCount ?? beatsPerMeasure;
      const mw = widths[j] ?? 80 * beatCount;
      const beatWidth = mw / beatCount;
      if (beatLeft < beatCount)
        return marginLeft + widths.slice(0, j).reduce((a, b) => a + b, 0) + (beatLeft + 0.5) * beatWidth;
      beatLeft -= beatCount;
    }
    const j = Math.max(0, sys.measureIndices.length - 1);
    const x = marginLeft + widths.slice(0, j + 1).reduce((a, b) => a + b, 0) - (widths[j] ?? 0) * 0.5;
    return Number.isFinite(x) ? x : marginLeft + 50;
  })() : null;
  const cursorSlotCenterXValid = cursorSlotCenterX != null && Number.isFinite(cursorSlotCenterX);

  // Ühtne valikukast (esimese kuni viimase valitud löögi vahel) – ainult siis, kui ajajoon on aktiivne staff.
  const selectionHighlightRect = (() => {
    if (hideCursorOverlay) return null;
    if (!isActiveStaff) return null;
    if (!Array.isArray(allNotes) || allNotes.length === 0) return null;
    // Leia globaalne valik (kasutame sama loogikat, mida isNoteSelected).
    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < allNotes.length; i += 1) {
      if (isNoteSelected(i)) {
        if (firstIdx === -1) firstIdx = i;
        lastIdx = i;
      }
    }
    if (firstIdx < 0 || lastIdx < firstIdx) return null;
    // Arvuta valiku alg- ja lõpp-löök.
    let beat = 0;
    let startBeat = 0;
    let endBeat = 0;
    for (let i = 0; i < allNotes.length; i += 1) {
      const n = allNotes[i];
      const dur = Number(n?.duration) || 1;
      if (i === firstIdx) startBeat = beat;
      if (i === lastIdx) endBeat = beat + dur;
      beat += dur;
    }
    if (endBeat <= startBeat) return null;
    // Leia süsteem ja x-koordinaadid.
    let beatAcc = 0;
    for (let s = 0; s < systems.length; s += 1) {
      const sys = systems[s];
      const beatsInSys = getSystemTotalBeats(sys);
      const sysStartBeat = beatAcc;
      const sysEndBeat = beatAcc + beatsInSys;
      const selStart = Math.max(startBeat, sysStartBeat);
      const selEnd = Math.min(endBeat, sysEndBeat);
      if (selEnd <= selStart) {
        beatAcc += beatsInSys;
        continue;
      }
      const widths = sys.measureWidths ?? sys.measureIndices.map(() => sys.measureWidth ?? beatsPerMeasure * 80);
      let localStart = selStart - sysStartBeat;
      let localEnd = selEnd - sysStartBeat;
      let xStart = marginLeft;
      let xEnd = marginLeft;
      for (let j = 0; j < sys.measureIndices.length; j += 1) {
        const m = effectiveMeasures[sys.measureIndices[j]];
        const beatCount = m?.beatCount ?? beatsPerMeasure;
        const mw = widths[j] ?? 80 * beatCount;
        const beatWidth = mw / beatCount;
        if (localStart > 0) {
          const step = Math.min(localStart, beatCount);
          xStart += step * beatWidth;
          localStart -= step;
        }
        if (localEnd > 0) {
          const step = Math.min(localEnd, beatCount);
          xEnd += step * beatWidth;
          localEnd -= step;
        }
        if (localStart <= 0 && localEnd <= 0) break;
      }
      const yTop = sys.yOffset + cursorInset;
      const selHeight = isFigureCombinedSystem
        ? getTraditionalSystemTotalHeightPx(multiStaffInstruments.length, timelineHeight + (layoutPartsGap ?? 0), layoutPartsGap ?? 0) - cursorInset - cursorBottomInset
        : (cursorRowHeight + chordExtension - cursorInset - cursorBottomInset);
      return (
        <rect
          key={`sel-${s}`}
          className="nm-selection-highlight"
          x={xStart}
          y={yTop}
          width={Math.max(2, xEnd - xStart)}
          height={Math.max(4, selHeight)}
          fill="#bfdbfe"
          opacity="0.35"
          rx="4"
        />
      );
    }
    return null;
  })();

  const svgWidth = isHorizontal ? totalPages * (pageWidth || LAYOUT.PAGE_WIDTH_MIN) : '100%';
  const svgHeight = isHorizontal ? a4PageHeight : totalHeight;
  var viewBoxW = typeof svgWidth === 'number' ? svgWidth : (pageWidth || LAYOUT.PAGE_WIDTH_MIN);
  var viewBoxH = typeof svgHeight === 'number' ? svgHeight : totalHeight;

  return (
    <svg
      ref={(node) => {
        timelineSvgRef.current = node;
        if (exportNotationSvgRef && typeof exportNotationSvgRef === 'object') {
          exportNotationSvgRef.current = node;
        }
      }}
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
      preserveAspectRatio="xMidYMin meet"
      className={`overflow-visible ${noteInputMode ? 'cursor-pointer' : ''}`}
      onClick={handleStaffClick}
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') handleStaffClick(e); }}
      style={isHorizontal ? { display: 'block', minWidth: svgWidth } : undefined}
    >
      {selectionHighlightRect}
      {/* No canvas/SVG background: paper style comes from the score container (CSS) like Docs/MuseScore */}
      {isFigurenotesMode ? (
        <FigurenotesView
          systems={systemsForDisplay}
          effectiveMeasures={effectiveMeasures}
          marginLeft={marginLeft}
          timelineHeight={figurenotesRowHeightProp ?? timelineHeight}
          selectedDuration={selectedDuration}
          chordLineGap={figurenotesChordBlocks ? figurenotesChordLineGap : 0}
          chordLineHeight={figurenotesChordBlocks ? (figurenotesChordLineHeightProp ?? Math.round((figurenotesRowHeightProp ?? timelineHeight) / 2)) : 0}
          chordBlocksEnabled={figurenotesChordBlocks}
          chordBlocksShowTones={figurenotesChordBlocksShowTones}
          showMelodyNoteNames={figurenotesMelodyShowNoteNames}
          pageWidth={pageWidth || LAYOUT.PAGE_WIDTH_MIN}
          timeSignature={timeSignature}
          timeSignatureMode={timeSignatureMode}
          layoutLineBreakBefore={layoutLineBreakBefore}
          showLayoutBreakIcons={showLayoutBreakIcons}
          onToggleLineBreakAfter={onToggleLineBreakAfter}
          translateLabel={translateLabel}
          showBarNumbers={showBarNumbers}
          barNumberSize={barNumberSize}
          chords={chords}
          figurenotesSize={figurenotesSize}
          figurenotesStems={figurenotesStems}
          timeSignatureSize={timeSignatureSize}
          keySignature={safeKey}
          isNoteSelected={isNoteSelected}
          onNoteClick={onNoteClick}
          onNoteMouseDown={onNoteMouseDown}
          onNoteMouseEnter={onNoteMouseEnter}
          onNoteBeatChange={onNoteBeatChange}
          canHandDragNotes={canHandDragNotes}
          timelineSvgRef={timelineSvgRef}
          onBeatSlotClick={onFigureBeatClick}
          onChordLineMouseMove={onChordLineMouseMove}
          onChordLineClick={onChordLineClick}
          showRhythmSyllables={showRhythmSyllables}
          lyricFontFamily={lyricFontFamily}
          lyricFontSize={lyricFontSize}
          lyricLineYOffset={lyricLineYOffset}
          isHorizontal={isHorizontal}
          a4PageHeight={a4PageHeight}
          pageFlowDirection={pageFlowDirection}
          figureBaseWidth={FIGURE_BASE_WIDTH * (layoutGlobalSpacingMultiplier ?? 1)}
          showStaffSpacerHandles={showStaffSpacerHandles && typeof onSystemYOffsetChange === 'function'}
          onStaffSpacerMouseDown={typeof onSystemYOffsetChange === 'function' ? (systemIndex) => (e) => { e.stopPropagation(); setStaffSpacerDrag({ systemIndex, startClientY: e.clientY, cumulativeDelta: 0 }); } : undefined}
          themeColors={themeColors}
          instruments={Array.isArray(multiStaffInstruments) && multiStaffInstruments.length > 1 ? multiStaffInstruments : []}
          effectiveMeasuresPerInstrument={multiStaffMeasuresByInstrument || {}}
          figurenotesCombinedRowStepPx={timelineHeight + (layoutPartsGap ?? 0)}
          figurenotesCombinedActiveStaffRowIndex={combinedActiveStaffRowIndex}
        />
      ) : (
        <TraditionalNotationView
          systems={systemsForDisplay}
          effectiveMeasures={effectiveMeasures}
          instruments={Array.isArray(multiStaffInstruments) ? multiStaffInstruments : []}
          effectiveMeasuresPerInstrument={multiStaffMeasuresByInstrument || {}}
          marginLeft={marginLeft}
          timelineHeight={timelineHeight}
          pageWidth={pageWidth || LAYOUT.PAGE_WIDTH_MIN}
          timeSignature={timeSignature}
          timeSignatureMode={timeSignatureMode}
          pedagogicalTimeSigDenominatorType={pedagogicalTimeSigDenominatorType}
          pedagogicalTimeSigDenominatorColor={pedagogicalTimeSigDenominatorColor}
          pedagogicalTimeSigDenominatorInstrument={pedagogicalTimeSigDenominatorInstrument}
          pedagogicalTimeSigDenominatorEmoji={pedagogicalTimeSigDenominatorEmoji}
          staffLines={staffLines}
          clefType={clefType}
          keySignature={safeKey}
          notationMode={notationMode}
          joClefStaffPosition={joClefStaffPosition}
          relativeNotationShowKeySignature={relativeNotationShowKeySignature}
          relativeNotationShowTraditionalClef={relativeNotationShowTraditionalClef}
          onJoClefPositionChange={onJoClefPositionChange}
          joClefFocused={joClefFocused}
          onJoClefFocus={onJoClefFocus}
          layoutLineBreakBefore={layoutLineBreakBefore}
          showLayoutBreakIcons={showLayoutBreakIcons}
          onToggleLineBreakAfter={onToggleLineBreakAfter}
          translateLabel={translateLabel}
          showBarNumbers={showBarNumbers}
          barNumberSize={barNumberSize}
          showRhythmSyllables={showRhythmSyllables}
          showAllNoteLabels={showAllNoteLabels}
          enableEmojiOverlays={enableEmojiOverlays}
          noteheadShape={traditionalStaffNoteheadShape}
          noteheadEmoji={noteheadEmoji}
          chords={chords}
          isNoteSelected={isNoteSelected}
          onNoteClick={onNoteClick}
          onNoteMouseDown={onNoteMouseDown}
          onNoteMouseEnter={onNoteMouseEnter}
          onNotePitchChange={onNotePitchChange}
          onNoteBeatChange={onNoteBeatChange}
          canHandDragNotes={canHandDragNotes}
          getPitchY={getPitchY}
          getPitchFromY={getPitchFromY}
          timelineSvgRef={timelineSvgRef}
          isFirstInBraceGroup={isFirstInBraceGroup}
          braceGroupSize={braceGroupSize}
          lyricFontFamily={lyricFontFamily}
          lyricFontSize={lyricFontSize}
          lyricLineYOffset={lyricLineYOffset}
          isHorizontal={isHorizontal}
          a4PageHeight={a4PageHeight}
          getStaffHeight={getStaffHeight}
          showStaffSpacerHandles={showStaffSpacerHandles && typeof onSystemYOffsetChange === 'function'}
          onStaffSpacerMouseDown={typeof onSystemYOffsetChange === 'function' ? (systemIndex) => (e) => { e.stopPropagation(); setStaffSpacerDrag({ systemIndex, startClientY: e.clientY, cumulativeDelta: 0 }); } : undefined}
          themeColors={themeColors}
          instrument={instrument}
          instrumentRange={instCfg?.range}
          instrumentNotationVariant={instrumentNotationVariant}
          instrumentConfig={instrumentConfig}
          linkedNotationByStaffId={linkedNotationByStaffId}
          tinWhistleLinkedFingeringScale={tinWhistleLinkedFingeringScale}
          connectedBarlines={layoutConnectedBarlines && staffCount > 1}
          staffIndexInScore={staffIndexInScore}
          systemTotalHeight={systemTotalHeight}
          onRemoveRepeatMark={onRemoveRepeatMark}
        />
      )}


  {/* Cursor + Ghost note / kleepimise kursor: nähtav noodisisestusrežiimis,
          pedagoogilisel taasesitusel/ekspordil ning SEL-režiimis (ka ilma valitud noodita). */}
      {(noteInputMode || isPedagogicalAudioPlaying || isExportingAnimation || !noteInputMode) && cursorInfo && (!isFigurenotesMode || isActiveStaff) && (() => {
        const cursorX = (cursorSlotCenterX != null && Number.isFinite(cursorSlotCenterX)) ? cursorSlotCenterX : (marginLeft + 40);
        const cursorChar = (pedagogicalPlayheadEmoji || '').trim();
        const isSelectionCursor = !noteInputMode && !isPedagogicalAudioPlaying && !isExportingAnimation;
        const showLine = isSelectionCursor || cursorChar === '';
        const displayEmoji = isSelectionCursor ? '' : (cursorChar || '🎵');
        const emojiSizePx = Math.max(1, Math.min(500, cursorSizePx ?? pedagogicalPlayheadEmojiSize));
        const beatProgress = cursorPosition % 1;
        const BASE_JUMP = 14;
        const distanceToNextNote = (() => {
          let beat = 0;
          const list = allNotes || [];
          for (let i = 0; i < list.length; i++) {
            const n = list[i];
            const noteStart = typeof n.beat === 'number' ? n.beat : beat;
            const noteEnd = noteStart + (n.duration ?? 1);
            if (cursorPosition >= noteStart && cursorPosition < noteEnd) return Math.max(0.25, noteEnd - cursorPosition);
            if (noteStart > cursorPosition) return noteStart - cursorPosition;
            beat = noteEnd;
          }
          const totalBeats = list.reduce((acc, n) => acc + (n.duration ?? 1), 0);
          return Math.max(0.25, totalBeats - cursorPosition);
        })();
        const jumpAmplitude = pedagogicalPlayheadMovement === 'horizontal' ? 0 : Math.min(BASE_JUMP, BASE_JUMP * Math.min(distanceToNextNote, 2) / 2);
        const baseY = centerY + crOff - emojiSizePx / 2;
        const emojiCenterY = baseY - jumpAmplitude * Math.abs(Math.sin(Math.PI * beatProgress));
        const cursorEmojiY = cursorInfo.system.yOffset + emojiCenterY;
        if (exportCursorRef) {
          if (showLine) exportCursorRef.current = null;
          else if (scoreContainerRef?.current && timelineSvgRef?.current) {
            const svgR = timelineSvgRef.current.getBoundingClientRect();
            const containerR = scoreContainerRef.current.getBoundingClientRect();
            exportCursorRef.current = {
              x: cursorX + svgR.left - containerR.left,
              y: cursorInfo.system.yOffset + emojiCenterY + svgR.top - containerR.top,
              emoji: displayEmoji,
              size: emojiSizePx
            };
          }
        }
        if (hideCursorOverlay) return null;
        return (
        <g className="nm-cursor">
          {showLine ? (
            <line
              x1={cursorX}
              y1={cursorInfo.system.yOffset + cursorY1 + crOff}
              x2={cursorX}
              y2={cursorInfo.system.yOffset + cursorY2 + crOff}
              stroke="#2563eb"
              strokeWidth={cursorLineStrokeWidth}
              opacity="0.8"
            >
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
            </line>
          ) : (
            <>
              <line
                x1={cursorX}
                y1={cursorInfo.system.yOffset + cursorY1 + crOff}
                x2={cursorX}
                y2={cursorInfo.system.yOffset + cursorY2 + crOff}
                stroke="#2563eb"
                strokeWidth={Math.max(1, Math.round(cursorLineStrokeWidth * 0.6))}
                opacity="0.4"
              />
              <text
                x={cursorX}
                y={cursorEmojiY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={emojiSizePx}
                fontFamily="sans-serif"
              >
                {displayEmoji}
                {isPedagogicalAudioPlaying && <animate attributeName="opacity" values="1;0.75;1" dur="0.6s" repeatCount="indefinite" />}
              </text>
            </>
          )}
          {noteInputMode && isRest ? (
            isFigurenotesMode
              ? (() => {
                  const sys = cursorInfo.system;
                  const zSize = Math.max(10, Math.min(80, emojiSizePx * 0.6));
                  return <text x={cursorX} y={cursorInfo.system.yOffset + centerY + crOff + zSize * 0.2} textAnchor="middle" fontSize={zSize} fontWeight="bold" fill="#dc2626" fontFamily="serif">Z</text>;
                })()
              : (() => {
                  const restY = cursorInfo.system.yOffset + centerY + crOff;
                  const x = cursorX;
                  const scale = 0.9;
                  const w = 8 * scale, h = 3 * scale;
                  const dur = (typeof selectedDuration === 'string' ? selectedDuration : null) || '1/4';
                  if (dur === '1/1' || dur === '1/2') return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#dc2626"/>;
                  if (dur === '1/4') return <path d={`M ${x} ${restY - 10} Q ${x + 6} ${restY - 4} ${x} ${restY} Q ${x - 6} ${restY + 4} ${x} ${restY + 10}`} stroke="#dc2626" strokeWidth="1.8" fill="none"/>;
                  if (dur === '1/8') return <g stroke="#dc2626" fill="#dc2626"><circle cx={x} cy={restY - 4} r="2"/><path d={`M ${x} ${restY - 2} Q ${x - 6} ${restY} ${x} ${restY + 6}`} fill="none" strokeWidth="1.5"/></g>;
                  if (dur === '1/16') return <g stroke="#dc2626" fill="#dc2626"><circle cx={x} cy={restY - 6} r="1.8"/><circle cx={x} cy={restY} r="1.8"/><path d={`M ${x} ${restY + 2} Q ${x - 5} ${restY + 4} ${x} ${restY + 10}`} fill="none" strokeWidth="1.5"/></g>;
                  if (dur === '1/32') return <g stroke="#dc2626" fill="#dc2626"><circle cx={x} cy={restY - 8} r="1.5"/><circle cx={x} cy={restY - 2} r="1.5"/><circle cx={x} cy={restY + 4} r="1.5"/><path d={`M ${x} ${restY + 6} Q ${x - 4} ${restY + 8} ${x} ${restY + 12}`} fill="none" strokeWidth="1.3"/></g>;
                  return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#dc2626"/>;
                })()
          ) : noteInputMode && ghostPitch && ghostOctave ? (
            (() => {
              const cx = cursorX;
              const pitchY = getPitchY(ghostPitch, ghostOctave);
              const cy = cursorInfo.system.yOffset + (notationMode === 'figurenotes' ? centerY + crOff : pitchY + crOff);
              const stemUp = pitchY > middleLineY;
              if (notationMode === 'figurenotes') {
                const { shape } = getFigureSymbol(ghostPitch, ghostOctave);
                const size = Math.max(8, Math.min(150, emojiSizePx));
                const r = size / 2;
                let el;
                if (shape === 'none') {
                  el = <rect x={cx - r} y={cy - r} width={size} height={size} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="2 2" opacity="0.9" />;
                } else {
                  const style = getFigureStyle(ghostPitch, ghostOctave);
                  const shapePaths = getShapePathsByOctave(ghostOctave);
                  const svgX = cx - size / 2;
                  const svgY = cy - size / 2;
                  el = (
                    <g>
                      <svg
                        x={svgX}
                        y={svgY}
                        width={size}
                        height={size}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="xMidYMid meet"
                        style={{ overflow: 'visible' }}
                      >
                        {shapePaths.map((d, i) => (
                          <path
                            key={i}
                            d={d}
                            fill={style.fill}
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </svg>
                      <rect
                        x={cx - r}
                        y={cy - r}
                        width={size}
                        height={size}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2"
                        opacity="0.9"
                      />
                    </g>
                  );
                }
                return (
                  <g opacity="0.9">
                    {el}
                    {isDotted && ghostPitch && (
                      <g>
                        <animate attributeName="opacity" values="1;0.55;1" dur="0.8s" repeatCount="indefinite" />
                        <SmuflGlyph
                          x={getAugmentationDotXFromNoteCenter(cx, spacing)}
                          y={cursorInfo.system.yOffset + centerY + crOff}
                          glyph={SMUFL_GLYPH.augmentationDot}
                          fontSize={getGlyphFontSize(spacing)}
                          fill="#f59e0b"
                          dominantBaseline="central"
                        />
                      </g>
                    )}
                  </g>
                );
              }
              if (notationMode === 'traditional') {
                const rx = getNoteheadRx(spacing);
                const stemX = stemUp ? cx + rx : cx - rx;
                const ghostStemLen = getStemLength(spacing);
                const stemY2 = stemUp ? cy - ghostStemLen : cy + ghostStemLen;
                const ledgerHalfWidth = getLedgerHalfWidth(spacing);
                const sysY = cursorInfo.system.yOffset;
                const firstLineY = staffLinePositions[0];
                const lastLineY = staffLinePositions[staffLinePositions.length - 1];
                const { above: nLedgerAbove, below: nLedgerBelow } = staffLines === 5
                  ? getLedgerLineCountExact(pitchY, firstLineY, lastLineY, spacing)
                  : { above: 0, below: 0 };
                const gKeyAcc = getAccidentalForPitchInKey(ghostPitch, safeKey);
                const showGhostAcc = ghostAccidentalIsExplicit && (ghostAccidental === 1 || ghostAccidental === -1 || (ghostAccidental === 0 && gKeyAcc !== 0));
                const ghostAccChar = ghostAccidental === 1 ? '♯' : ghostAccidental === -1 ? '♭' : '♮';
                return (
                  <g opacity="0.85">
                    {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                      <line key={`ghost-ledger-above-${i}`} x1={cx - ledgerHalfWidth} y1={sysY + crOff + firstLineY - (i + 1) * spacing} x2={cx + ledgerHalfWidth} y2={sysY + crOff + firstLineY - (i + 1) * spacing} stroke={themeColors.staffLineColor} strokeWidth="1.5" />
                    ))}
                    {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                      <line key={`ghost-ledger-below-${i}`} x1={cx - ledgerHalfWidth} y1={sysY + crOff + lastLineY + (i + 1) * spacing} x2={cx + ledgerHalfWidth} y2={sysY + crOff + lastLineY + (i + 1) * spacing} stroke={themeColors.staffLineColor} strokeWidth="1.5" />
                    ))}
                    {showGhostAcc && (
                      <text x={cx - (rx + spacing * 0.5)} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.round(spacing * 1.4)} fill={themeColors.noteFill} fontFamily="serif">{ghostAccChar}</text>
                    )}
                    <NoteHead cx={cx} cy={cy} staffSpace={spacing} filled stemUp={stemUp} selected fill={themeColors.noteFill} />
                    <line x1={stemX} y1={cy} x2={stemX} y2={stemY2} stroke={themeColors.noteFill} strokeWidth="1.5"/>
                    {isDotted && (
                      <g>
                        <animate attributeName="opacity" values="1;0.55;1" dur="0.8s" repeatCount="indefinite" />
                        <SmuflGlyph
                          x={getAugmentationDotXFromNoteCenter(cx, spacing)}
                          y={cursorInfo.system.yOffset + crOff + getAugmentationDotCenterPitchY(pitchY, firstLineY, spacing)}
                          glyph={SMUFL_GLYPH.augmentationDot}
                          fontSize={getGlyphFontSize(spacing)}
                          fill="#f59e0b"
                          dominantBaseline="central"
                        />
                      </g>
                    )}
                  </g>
                );
              }
              const stemX = stemUp ? cx + 10 : cx - 10;
              const stemY2 = stemUp ? cy - 24 : cy + 24;
              const pKeyAcc = getAccidentalForPitchInKey(ghostPitch, safeKey);
              const accSuffix = !ghostAccidentalIsExplicit ? '' : (ghostAccidental === 1 ? '♯' : ghostAccidental === -1 ? '♭' : (ghostAccidental === 0 && pKeyAcc !== 0 ? '♮' : ''));
              return <g opacity="0.85"><circle cx={cx} cy={cy} r="9" fill="none" stroke={themeColors.textColor}/><text x={cx} y={cy+3} textAnchor="middle" fontSize="11" fontWeight="bold" fill={themeColors.textColor}>{ghostPitch}{accSuffix}</text><line x1={stemX} y1={cy} x2={stemX} y2={stemY2} stroke={themeColors.textColor} strokeWidth="1.5"/></g>;
            })()
          ) : (
            <circle cx={cursorX} cy={cursorInfo.system.yOffset + centerY + crOff} r="6" fill="#2563eb" stroke="white" strokeWidth="2">
              <animate attributeName="r" values="6;8;6" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
        );
      })()}
    </svg>
  );
}

// Error Boundary: tööriista sisu – kui viga, punane kast (vältib tühjade muutujatega töötamist)
class AppRunErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div
          className="loading-screen"
          style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '2px solid #dc2626',
            padding: 24,
            margin: 24,
            borderRadius: 8,
            fontFamily: 'sans-serif',
          }}
        >
          <strong>Viga rakenduse käivitamisel:</strong> {msg}
        </div>
      );
    }
    return this.props.children;
  }
}

function NoodiMeister({ demoVisibility = false }) {
  const [icons, setIcons] = useState(null);
  useEffect(() => {
    import('lucide-react').then((mod) => {
      const obj = {};
      LUCIDE_ICONS.forEach((name) => { obj[name] = mod[name]; });
      setIcons(obj);
    });
  }, []);
  if (!icons) {
    return <div className="loading-screen">Laen Noodimeistrit…</div>;
  }
  return (
    <AppRunErrorBoundary>
      <NoodiMeisterCore icons={icons} demoVisibility={demoVisibility} />
    </AppRunErrorBoundary>
  );
}

export default NoodiMeister;