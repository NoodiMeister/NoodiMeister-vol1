import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Piano, KeyboardShortcuts, MidiNumbers } from 'react-piano';
import 'react-piano/dist/styles.css';
import './piano-overrides.css';
import * as googleDrive from './services/googleDrive';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, createT } from './i18n';

// Ikoonid laetakse dünaamiliselt, et vältida "Cannot access 'Tt' before initialization" (lucide-react bundle)
const LUCIDE_ICONS = [
  'Music2', 'Clock', 'Hash', 'Type', 'Piano', 'Palette', 'Layout', 'Check', 'Save', 'FolderOpen',
  'Plus', 'Settings', 'Key', 'Repeat', 'Cloud', 'LogOut', 'User', 'CloudUpload', 'CloudDownload', 'FolderPlus', 'ChevronDown'
];

const STORAGE_KEY = 'noodimeister-data';

function LoggedInUser({ icons, t }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('noodimeister-logged-in');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('noodimeister-logged-in');
    localStorage.removeItem('noodimeister-google-token');
    localStorage.removeItem('noodimeister-google-token-expiry');
    setUser(null);
    navigate('/');
  };

  if (!user?.name && !user?.email) return null;
  const { User: UserIcon, LogOut: LogOutIcon } = icons || {};

  return (
    <div className="flex items-center gap-2 ml-2 pl-4 border-l border-amber-600/50">
      {UserIcon && <UserIcon className="w-4 h-4 text-amber-200" />}
      <span className="text-sm font-medium text-amber-100 max-w-[120px] truncate" title={user.email}>
        {user.name || user.email}
      </span>
      <button
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-800/80 text-amber-100 hover:bg-amber-700 hover:text-white transition-colors"
        title={t('user.logoutTitle')}
      >
        {LogOutIcon && <LogOutIcon className="w-3.5 h-3.5" />} {t('user.logout')}
      </button>
    </div>
  );
}

// Layout engine – A4 proportion, automaatne reavahetus (VexFlow loogika)
const LAYOUT = {
  PAGE_WIDTH_MIN: 800,
  PAGE_WIDTH_MAX: 1000,
  STAFF_HEIGHT: 140,
  SYSTEM_GAP: 120,
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 40,
  CLEF_WIDTH: 45
};

// Demo versioon: registreerimata kasutaja saab kuni 2 rida (8 takti)
const DEMO_MAX_BEATS = 8;
const DEMO_MAX_MEASURES = 2;

// Arvuta süsteemid (read) – iga rida = eraldi Stave; toetab eeltakti, taktide arv rea kohta ja käsitsi rea/lehevahetused
function computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, layoutOptions = {}) {
  const w = Number(pageWidth) || LAYOUT.PAGE_WIDTH_MIN;
  const availableWidth = Math.max(200, w - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT);
  const beatsPerMeasure = timeSignature.beats;
  const {
    measuresPerLine = 0,
    lineBreakBefore = [],
    pageBreakBefore = []
  } = layoutOptions;
  const lineSet = new Set(Array.isArray(lineBreakBefore) ? lineBreakBefore : []);
  const pageSet = new Set(Array.isArray(pageBreakBefore) ? pageBreakBefore : []);

  const buildSystem = (rowIndices, systemIndex, nextPageBreak) => {
    if (rowIndices.length === 0) return null;
    const totalBeatCount = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
    const pixelsPerBeatForRow = availableWidth / totalBeatCount;
    const measureWidths = rowIndices.map(i => (measures[i].beatCount ?? beatsPerMeasure) * pixelsPerBeatForRow);
    return {
      systemIndex,
      measureIndices: rowIndices,
      measureWidths,
      yOffset: 0, // filled below
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: measureWidths[0],
      pageBreakBefore: !!nextPageBreak
    };
  };

  // Kasutaja paigutus (taktide arv rea kohta või käsitsi rea/lehevahetused)
  if (measuresPerLine > 0 || lineSet.size > 0 || pageSet.size > 0) {
    const systems = [];
    let currentRow = [];
    let nextPageBreak = false;
    let yAcc = 0;
    const PAGE_GAP = 80; // lisavahe uue lehe alguses

    for (let i = 0; i < measures.length; i++) {
      const forceLine = lineSet.has(i);
      const forcePage = pageSet.has(i);
      const forceBreak = forceLine || forcePage || (measuresPerLine > 0 && currentRow.length >= measuresPerLine && currentRow.length > 0);
      if (forceBreak && currentRow.length > 0) {
        const sys = buildSystem([...currentRow], systems.length, nextPageBreak);
        if (sys) {
          sys.yOffset = yAcc;
          yAcc += LAYOUT.STAFF_HEIGHT + LAYOUT.SYSTEM_GAP;
          if (nextPageBreak) {
            yAcc += PAGE_GAP;
            nextPageBreak = false;
          }
          systems.push(sys);
        }
        currentRow = [];
      }
      if (forcePage) nextPageBreak = true;
      currentRow.push(i);
    }
    if (currentRow.length > 0) {
      const sys = buildSystem(currentRow, systems.length, nextPageBreak);
      if (sys) {
        sys.yOffset = yAcc;
        systems.push(sys);
      }
    }
    if (systems.length === 0) {
      systems.push({
        systemIndex: 0,
        measureIndices: [],
        measureWidths: [],
        yOffset: 0,
        pixelsPerBeat,
        measureWidth: beatsPerMeasure * pixelsPerBeat,
        pageBreakBefore: false
      });
    }
    return systems;
  }

  // Automaatne paigutus (vanem loogika – täidab rea laiuse järgi)
  const systems = [];
  let measureIdx = 0;
  let systemIndex = 0;
  while (measureIdx < measures.length) {
    let totalBeatCount = 0;
    const rowIndices = [];
    while (measureIdx + rowIndices.length < measures.length) {
      const nextIdx = measureIdx + rowIndices.length;
      const nextBeatCount = measures[nextIdx].beatCount ?? beatsPerMeasure;
      const wouldBeTotal = totalBeatCount + nextBeatCount;
      const wouldBePixelsPerBeat = availableWidth / wouldBeTotal;
      const nextMeasureWidth = nextBeatCount * wouldBePixelsPerBeat;
      if (rowIndices.length > 0 && nextMeasureWidth < 24) break;
      rowIndices.push(nextIdx);
      totalBeatCount = wouldBeTotal;
    }
    if (rowIndices.length === 0) {
      rowIndices.push(measureIdx);
      totalBeatCount = measures[measureIdx].beatCount ?? beatsPerMeasure;
    }
    const pixelsPerBeatForRow = availableWidth / totalBeatCount;
    const measureWidths = rowIndices.map(i => (measures[i].beatCount ?? beatsPerMeasure) * pixelsPerBeatForRow);
    systems.push({
      systemIndex,
      measureIndices: rowIndices,
      measureWidths,
      yOffset: systemIndex * (LAYOUT.STAFF_HEIGHT + LAYOUT.SYSTEM_GAP),
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: measureWidths[0],
      pageBreakBefore: false
    });
    measureIdx += rowIndices.length;
    systemIndex++;
  }
  if (systems.length === 0) {
    systems.push({
      systemIndex: 0,
      measureIndices: [],
      measureWidths: [],
      yOffset: 0,
      pixelsPerBeat,
      measureWidth: beatsPerMeasure * pixelsPerBeat,
      pageBreakBefore: false
    });
  }
  return systems;
}

// Dynamic Icon Components – MuseScore-style note/rest shapes per duration
const RhythmIcon = ({ duration, isDotted = false, isRest = false }) => {
  const d = duration && (duration === 'rest' || duration === 'dotted' ? '1/4' : duration);
  if (isRest) {
    // Pausid: tervikpaus (riba), poolik (riba), veerand (s-kujuline), kaheksandik (vibu+pea), kuueteistkümnendik (kaks)
    const restIcons = {
      '1/1': <rect x="6" y="10" width="12" height="4" rx="0.5" fill="currentColor"/>,
      '1/2': <rect x="6" y="11" width="12" height="3" rx="0.5" fill="currentColor"/>,
      '1/4': <path d="M14 5 Q16 8 13 10 L13 14 Q15 16 12 19 Q10 18 12 14 L12 10 Q9 8 11 5 Z" fill="currentColor"/>,
      '1/8': <g fill="currentColor"><ellipse cx="10" cy="10" rx="2.5" ry="2"/><path d="M10 12 L10 20 Q12 19 10 17" stroke="currentColor" strokeWidth="1.2" fill="none"/></g>,
      '1/16': <g fill="currentColor"><ellipse cx="10" cy="8" rx="2.5" ry="2"/><ellipse cx="10" cy="14" rx="2.5" ry="2"/><path d="M10 16 L10 22 Q12 21 10 19" stroke="currentColor" strokeWidth="1.2" fill="none"/></g>
    };
    return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">{restIcons[d] || restIcons['1/4']}</svg>;
  }
  // Noodid: terviknoot (ovaal, varrast pole), poolik (tühi ovaal + vars), veerand (täidetud + vars), 8/16 (vibu(d))
  const dot = isDotted ? <circle cx="18" cy="16" r="1.5" fill="currentColor"/> : null;
  const noteIcons = {
    '1/1': <><ellipse cx="12" cy="14" rx="5" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>{dot}</>,
    '1/2': <><ellipse cx="10" cy="16" rx="4" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="14" y1="16" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5"/>{dot}</>,
    '1/4': <><ellipse cx="10" cy="16" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="16" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5"/>{dot}</>,
    '1/8': <><ellipse cx="10" cy="16" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="16" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5"/><path d="M14 2 Q18 4 14 6" fill="currentColor"/>{dot}</>,
    '1/16': <><ellipse cx="10" cy="16" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="16" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5"/><path d="M14 2 Q18 4 14 6 M14 4 Q18 6 14 8" fill="currentColor"/>{dot}</>
  };
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">{noteIcons[d] || noteIcons['1/4']}</svg>;
};

const MeterIcon = ({ beats, beatUnit }) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <text x="12" y="10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
    <text x="12" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beatUnit}</text>
  </svg>
);

// Pedagogical Time Signature Component - shows note symbol for denominator
const PedagogicalMeterIcon = ({ beats, beatUnit }) => {
  // Map denominator to note symbol
  const getNoteSymbol = () => {
    switch(beatUnit) {
      case 1: // Whole note
        return <ellipse cx="12" cy="18" rx="4" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1"/>;
      case 2: // Half note
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
          </>
        );
      case 4: // Quarter note (most common)
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
          </>
        );
      case 8: // Eighth note
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
            <path d="M15 24 Q18 23 15 21" fill="currentColor"/>
          </>
        );
      case 16: // Sixteenth note
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
            <path d="M15 24 Q18 23 15 21 M15 22 Q18 21 15 19" fill="currentColor"/>
          </>
        );
      default:
        return <text x="12" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beatUnit}</text>;
    }
  };

  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <text x="12" y="10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      {getNoteSymbol()}
    </svg>
  );
};

const ClefIcon = ({ clefType }) => {
  const clefs = {
    treble: '𝄞', bass: '𝄢', alto: '𝄡', tenor: '𝄡'
  };
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <text x="12" y="18" textAnchor="middle" fontSize="20" fontFamily="serif" fill="currentColor">{clefs[clefType]}</text>
    </svg>
  );
};

const PitchIcon = () => (
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

const NoteheadIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <ellipse cx="6" cy="12" rx="2" ry="1.5" fill="currentColor"/>
    <path d="M12 10 L12 14 L14 12 Z" fill="currentColor"/>
    <circle cx="19" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const LayoutIcon = ({ staffLines }) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1"/>
    <line x1="4" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1"/>
    <line x1="4" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="1"/>
    <path d="M16 8 L20 6 L20 10 Z" fill="currentColor"/>
    <path d="M16 16 L20 14 L20 18 Z" fill="currentColor"/>
    <text x="21" y="13" fontSize="6" fill="currentColor">{staffLines}</text>
  </svg>
);

// Instrument categories for toolbox and wizard (order + grouping)
const INSTRUMENT_CATEGORIES = [
  { id: 'keyboard', labelKey: 'cat.keyboard', instruments: ['organ', 'harpsichord', 'accordion', 'piano'] },
  { id: 'stringsPlucked', labelKey: 'cat.stringsPlucked', instruments: ['guitar', 'ukulele-sopran', 'ukulele-tenor', 'ukulele-bariton', 'ukulele-bass'] },
  { id: 'stringsBowed', labelKey: 'cat.stringsBowed', instruments: ['violin', 'viola', 'cello', 'double-bass'] },
  { id: 'woodwinds', labelKey: 'cat.woodwinds', instruments: ['flute', 'recorder', 'clarinet', 'oboe', 'bassoon'] },
  { id: 'brass', labelKey: 'cat.brass', instruments: ['trumpet', 'trombone', 'tuba', 'french-horn'] },
  { id: 'nonOrchestral', labelKey: 'cat.nonOrchestral', instruments: ['tin-whistle', 'saxophone'] },
  { id: 'other', labelKey: 'cat.other', instruments: ['voice'] }
];

// Instrument metadata: type 'standard' | 'tab' | 'wind' | 'figuredBass' | 'accordion' | 'grandStaff'
const INSTRUMENT_CONFIG_BASE = {
  // Klahvpillid
  organ:      { value: 'organ', range: 'C2-C6', type: 'figuredBass' },
  harpsichord:{ value: 'harpsichord', range: 'F1-F6', type: 'figuredBass' },
  accordion:  { value: 'accordion', range: 'F3-C6', type: 'accordion' },
  piano:      { value: 'piano', range: 'A0-C8', type: 'grandStaff' },
  // Näppekeelpillid
  guitar:     { value: 'guitar', range: 'E2-E6', type: 'tab', strings: 6, tuning: ['E2','A2','D3','G3','B3','E4'] },
  'ukulele-sopran': { value: 'ukulele-sopran', range: 'G4-A5', type: 'tab', strings: 4, tuning: ['G4','C4','E4','A4'] },
  'ukulele-tenor':  { value: 'ukulele-tenor', range: 'G3-A5', type: 'tab', strings: 4, tuning: ['G3','C4','E4','A4'] },
  'ukulele-bariton':{ value: 'ukulele-bariton', range: 'D3-E5', type: 'tab', strings: 4, tuning: ['D3','G3','B3','E4'] },
  'ukulele-bass':   { value: 'ukulele-bass', range: 'E2-A4', type: 'tab', strings: 4, tuning: ['E2','A2','D3','G3'] },
  // Poogenkeelpillid
  violin:     { value: 'violin', range: 'G3-A7', type: 'standard' },
  viola:      { value: 'viola', range: 'C3-E6', type: 'standard' },
  cello:      { value: 'cello', range: 'C2-A5', type: 'standard' },
  'double-bass': { value: 'double-bass', range: 'E1-G4', type: 'standard' },
  // Puupuhkpillid
  flute:      { value: 'flute', range: 'C4-C7', type: 'wind', fingering: true },
  recorder:   { value: 'recorder', range: 'C5-D6', type: 'wind', fingering: true },
  clarinet:   { value: 'clarinet', range: 'E3-G6', type: 'wind', fingering: true },
  oboe:       { value: 'oboe', range: 'Bb3-A6', type: 'wind', fingering: true },
  bassoon:    { value: 'bassoon', range: 'Bb1-E5', type: 'wind', fingering: true },
  // Vaskpuhkpillid
  trumpet:    { value: 'trumpet', range: 'F#3-E6', type: 'standard' },
  trombone:   { value: 'trombone', range: 'E2-F5', type: 'standard' },
  tuba:       { value: 'tuba', range: 'D1-F4', type: 'standard' },
  'french-horn': { value: 'french-horn', range: 'B1-F5', type: 'standard' },
  // Mitte orkestri
  'tin-whistle': { value: 'tin-whistle', range: 'D5-C#7', type: 'wind', fingering: true },
  saxophone:  { value: 'saxophone', range: 'Bb2-F5', type: 'wind', fingering: true },
  // Muud
  voice:      { value: 'voice', range: 'C3-C6', type: 'standard' }
};
const INSTRUMENT_I18N_KEYS = {
  organ: 'inst.organ', harpsichord: 'inst.harpsichord', accordion: 'inst.accordion', piano: 'inst.piano',
  guitar: 'inst.guitar', 'ukulele-sopran': 'inst.ukuleleSopran', 'ukulele-tenor': 'inst.ukuleleTenor',
  'ukulele-bariton': 'inst.ukuleleBariton', 'ukulele-bass': 'inst.ukuleleBass',
  violin: 'inst.violin', viola: 'inst.viola', cello: 'inst.cello', 'double-bass': 'inst.doubleBass',
  flute: 'inst.flute', recorder: 'inst.recorder', clarinet: 'inst.clarinet', oboe: 'inst.oboe', bassoon: 'inst.bassoon',
  trumpet: 'inst.trumpet', trombone: 'inst.trombone', tuba: 'inst.tuba', 'french-horn': 'inst.frenchHorn',
  'tin-whistle': 'inst.tinWhistle', saxophone: 'inst.saxophone', voice: 'inst.voice'
};
function getInstrumentConfig(t) {
  return Object.fromEntries(
    Object.entries(INSTRUMENT_CONFIG_BASE).map(([id, cfg]) => [
      id,
      { ...cfg, label: t(INSTRUMENT_I18N_KEYS[id] || id) }
    ])
  );
}

const InstrumentIcon = ({ instrument }) => {
  const icons = {
    piano: <><rect x="4" y="8" width="3" height="10" fill="currentColor"/><rect x="8" y="8" width="3" height="10" fill="currentColor"/><rect x="12" y="8" width="3" height="10" fill="currentColor"/><rect x="16" y="8" width="3" height="10" fill="currentColor"/><rect x="5.5" y="8" width="2" height="6" fill="none" stroke="white" strokeWidth="0.5"/></>,
    organ: <><rect x="4" y="6" width="4" height="12" fill="currentColor"/><rect x="10" y="8" width="4" height="10" fill="currentColor"/><rect x="16" y="10" width="4" height="8" fill="currentColor"/><path d="M6 4 L6 6 M12 6 L12 8 M18 8 L18 10" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    harpsichord: <><rect x="3" y="10" width="18" height="4" rx="1" fill="currentColor"/><path d="M5 10 L5 14 M9 10 L9 14 M13 10 L13 14 M17 10 L17 14 M21 10 L21 14" stroke="white" strokeWidth="0.8" fill="none"/></>,
    accordion: <><rect x="4" y="6" width="6" height="12" rx="1" fill="currentColor"/><rect x="14" y="6" width="6" height="12" rx="1" fill="currentColor"/><path d="M10 9 L14 9 M10 12 L14 12 M10 15 L14 15" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    voice: <><circle cx="12" cy="10" r="4" fill="currentColor"/><path d="M12 14 Q8 16 8 20 L16 20 Q16 16 12 14" fill="currentColor"/></>,
    guitar: <><path d="M6 4 L6 20 M10 6 L10 20 M14 8 L14 20 M18 10 L18 20" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 8 Q12 6 19 10" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    'ukulele-sopran': 'guitar', 'ukulele-tenor': 'guitar', 'ukulele-bariton': 'guitar', 'ukulele-bass': 'guitar',
    violin: <><path d="M8 6 Q8 4 12 4 Q16 4 16 6 L16 20 Q16 22 12 22 Q8 22 8 20 Z" fill="currentColor"/><circle cx="12" cy="8" r="2" fill="none" stroke="white" strokeWidth="0.8"/></>,
    viola: 'violin', cello: 'violin', 'double-bass': 'violin',
    flute: <><rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="white"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="16" cy="12" r="1" fill="white"/></>,
    'tin-whistle': <><rect x="5" y="10" width="14" height="3" rx="1" fill="currentColor"/><circle cx="8" cy="11.5" r="1" fill="white"/><circle cx="12" cy="11.5" r="1" fill="white"/><circle cx="16" cy="11.5" r="1" fill="white"/></>,
    recorder: <><path d="M8 6 L8 18 Q8 20 12 20 Q16 20 16 18 L16 6" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/><circle cx="10" cy="14" r="1.2" fill="currentColor"/></>,
    clarinet: <><rect x="5" y="9" width="14" height="6" rx="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="white"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="16" cy="12" r="1" fill="white"/></>,
    oboe: <><rect x="6" y="10" width="12" height="4" rx="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="white"/><circle cx="15" cy="12" r="1" fill="white"/></>,
    bassoon: <><path d="M10 4 L14 4 L14 20 L10 20 Z" fill="currentColor"/><circle cx="12" cy="8" r="1.2" fill="white"/><circle cx="12" cy="14" r="1.2" fill="white"/></>,
    trumpet: <><path d="M12 4 L14 8 L14 20 L10 20 L10 8 Z" fill="currentColor"/><circle cx="12" cy="6" r="1.5" fill="none" stroke="white" strokeWidth="0.6"/></>,
    trombone: <><path d="M9 6 L9 18 L15 18 L15 6" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M11 8 L13 8 M11 16 L13 16" stroke="currentColor" strokeWidth="1" fill="none"/></>,
    tuba: <><path d="M8 10 Q8 4 12 4 Q16 4 16 10 L16 20 L8 20 Z" fill="currentColor"/><circle cx="12" cy="7" r="1.5" fill="none" stroke="white" strokeWidth="0.6"/></>,
    'french-horn': <><path d="M12 4 Q18 8 18 14 Q18 18 12 20 Q6 18 6 14 Q6 8 12 4" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="10" r="2" fill="currentColor"/></>,
    saxophone: <><path d="M10 5 L10 19 Q10 21 12 21 L14 21 Q16 21 16 19 L16 5" fill="currentColor"/><circle cx="12" cy="9" r="1.2" fill="white"/><circle cx="12" cy="14" r="1.2" fill="white"/></>
  };
  const icon = icons[instrument] || icons[instrument?.startsWith('ukulele') ? 'guitar' : null];
  const fallback = <circle cx="12" cy="12" r="6" fill="currentColor" />;
  return <svg viewBox="0 0 24 24" className="w-5 h-5">{typeof icon === 'string' ? icons[icon] : (icon || fallback)}</svg>;
};

// Akordide ikoon (traditsiooniline sümbol)
const ChordIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <text x="12" y="16" textAnchor="middle" fontSize="14" fontWeight="bold" fill="currentColor" fontFamily="serif">C</text>
    <ellipse cx="8" cy="10" rx="2.5" ry="2" fill="currentColor"/>
    <ellipse cx="16" cy="10" rx="2.5" ry="2" fill="currentColor"/>
  </svg>
);

// Toolbox definitions – tõlgitud getToolboxes(t, instrumentConfig)
const TOOLBOX_ORDER = ['rhythm', 'timeSignature', 'clefs', 'keySignatures', 'pitchInput', 'pianoKeyboard', 'notehead', 'instruments', 'repeatsJumps', 'layout', 'chords'];

function getToolboxes(t, instrumentConfig) {
  return {
    rhythm: {
      id: 'rhythm', name: t('toolbox.rhythm'), icon: 'Clock', shortcut: 'Shift+1',
      options: [
        { id: '1/1', label: t('note.whole'), value: '1/1', key: '7', code: 'Digit7' },
        { id: '1/2', label: t('note.half'), value: '1/2', key: '6', code: 'Digit6' },
        { id: '1/4', label: t('note.quarter'), value: '1/4', key: '5', code: 'Digit5' },
        { id: '1/8', label: t('note.eighth'), value: '1/8', key: '4', code: 'Digit4' },
        { id: '1/16', label: t('note.sixteenth'), value: '1/16', key: '3', code: 'Digit3' },
        { id: 'rest', label: t('note.rest'), value: 'rest', key: '0', code: 'Digit0' },
        { id: 'dotted', label: t('note.dotted'), value: 'dotted', key: '.', code: 'Period' }
      ]
    },
    timeSignature: {
      id: 'timeSignature', name: t('toolbox.timeSignature'), icon: 'Hash', shortcut: 'Shift+2',
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
      id: 'clefs', name: t('toolbox.clefs'), icon: 'Type', shortcut: 'Shift+3',
      options: [
        { id: 'treble', label: t('clef.treble'), value: 'treble', key: '1' },
        { id: 'bass', label: t('clef.bass'), value: 'bass', key: '2' },
        { id: 'alto', label: t('clef.alto'), value: 'alto', key: '3' }
      ]
    },
    keySignatures: {
      id: 'keySignatures', name: t('toolbox.keySignatures'), icon: 'Key', shortcut: 'Shift+4',
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
    pitchInput: {
      id: 'pitchInput', name: t('toolbox.pitchInput'), icon: 'Piano', shortcut: 'Shift+5',
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
      id: 'pianoKeyboard', name: t('toolbox.pianoKeyboard'), icon: 'Piano', shortcut: 'Shift+0',
      options: []
    },
    notehead: {
      id: 'notehead', name: t('toolbox.notehead'), icon: 'Palette', shortcut: 'Shift+6',
      options: [
        { id: 'traditional', label: t('notehead.traditional'), value: 'traditional', key: '1' },
        { id: 'figurenotes', label: t('notehead.figurenotes'), value: 'figurenotes', key: '2' },
        { id: 'solfege', label: t('notehead.solfege'), value: 'vabanotatsioon', key: '3' }
      ]
    },
    instruments: {
      id: 'instruments', name: t('toolbox.instruments'), icon: 'Music2', shortcut: 'Shift+7',
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
      id: 'repeatsJumps', name: t('toolbox.repeatsJumps'), icon: 'Repeat', shortcut: 'Shift+8',
      options: [
        { id: 'repeat-start', label: t('repeat.start'), value: 'repeatStart', key: '1' },
        { id: 'repeat-end', label: t('repeat.end'), value: 'repeatEnd', key: '2' },
        { id: 'volta-1', label: t('repeat.volta1'), value: 'volta1', key: '3' },
        { id: 'volta-2', label: t('repeat.volta2'), value: 'volta2', key: '4' },
        { id: 'segno', label: t('repeat.segno'), value: 'segno', key: '5' },
        { id: 'coda', label: t('repeat.coda'), value: 'coda', key: '6' }
      ]
    },
    layout: {
      id: 'layout', name: t('toolbox.layout'), icon: 'Layout', shortcut: 'Shift+9',
      options: [
        { id: 'staff-5', label: t('layout.staff5'), value: 5, key: '1' },
        { id: 'staff-1', label: t('layout.staff1'), value: 1, key: '2' },
        { id: 'grid-only', label: t('layout.gridOnly'), value: 'gridOnly', key: 'G' },
        { id: 'spacing-normal', label: t('layout.spacingNormal'), value: 80, key: '3' },
        { id: 'spacing-loose', label: t('layout.spacingLoose'), value: 120, key: '4' }
      ]
    },
    chords: {
      id: 'chords', name: t('toolbox.chords'), icon: 'Music2', shortcut: 'Ctrl+A',
      options: [
        { id: 'chord-C', label: 'C', value: 'C' },
        { id: 'chord-Dm', label: 'Dm', value: 'Dm' },
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

// Figurenotes color and shape mappings
const FIGURENOTES_COLORS = {
  'C': '#EF4444', 'D': '#92400E', 'E': '#6B7280', 'F': '#3B82F6',
  'G': '#000000', 'A': '#EAB308', 'B': '#10B981'
};

const FIGURENOTES_SHAPES = {
  3: 'square', 4: 'circle', 5: 'triangle'
};

// Pitch/octave ↔ MIDI; fingering; timeline – defineeritud enne NoodiMeisterit, et vältida TDZ minifitseerimisel
const PITCH_TO_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PAGE_BREAK_GAP = 80;
// MIDI → noodinimi + oktaav (react-piano); looduslik noot sisestamiseks (C#, Db → C, D jne)
const PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };
function midiToPitchOctave(midiNumber) {
  try {
    const attrs = MidiNumbers.getAttributes(midiNumber);
    const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
    return { pitch: naturalPitch, octave: attrs.octave, isAccidental: attrs.isAccidental };
  } catch {
    return { pitch: 'C', octave: 4, isAccidental: false };
  }
}
const FINGERING_TIN_WHISTLE = {
  'D5': [1,1,1,1,1,1], 'E5': [0,1,1,1,1,1], 'F#5': [0,0,1,1,1,1], 'G5': [0,0,0,1,1,1], 'A5': [0,0,0,0,1,1], 'B5': [0,0,0,0,0,1], 'C#6': [0,0,0,0,0,0],
  'D6': [1,1,1,1,1,1], 'E6': [0,1,1,1,1,1], 'F#6': [0,0,1,1,1,1], 'G6': [0,0,0,1,1,1], 'A6': [0,0,0,0,1,1], 'B6': [0,0,0,0,0,1], 'C#7': [0,0,0,0,0,0]
};
const FINGERING_RECORDER = {
  'C5': [1,1,1,1,1,1,1], 'D5': [1,1,1,1,1,1,0], 'E5': [1,1,1,1,1,0,0], 'F5': [1,1,1,1,0,0,0], 'G5': [1,1,1,0,0,0,0], 'A5': [1,1,0,0,0,0,0], 'B5': [1,0,0,0,0,0,0], 'C6': [0,0,0,0,0,0,0],
  'D6': [1,1,1,1,1,1,0], 'E6': [1,1,1,1,1,0,0], 'F6': [1,1,1,1,0,0,0], 'G6': [1,1,1,0,0,0,0], 'A6': [1,1,0,0,0,0,0], 'B6': [1,0,0,0,0,0,0], 'C7': [0,0,0,0,0,0,0]
};

const NoodiMeisterCore = ({ icons }) => {
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

  const t = useMemo(() => createT(locale), [locale]);
  const instrumentConfig = useMemo(() => getInstrumentConfig(t), [t]);
  const toolboxes = useMemo(() => getToolboxes(t, instrumentConfig), [t, instrumentConfig]);

  // Core state
  const [notationMode, setNotationMode] = useState('traditional');
  const [noteInputMode, setNoteInputMode] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState('1/4');
  const [timeSignature, setTimeSignature] = useState({ beats: 4, beatUnit: 4 });
  const [pixelsPerBeat, setPixelsPerBeat] = useState(80);
  const [cursorPosition, setCursorPosition] = useState(3);
  const [clefType, setClefType] = useState('treble');
  const [keySignature, setKeySignature] = useState('C');
  const [staffLines, setStaffLines] = useState(5);
  const [notationStyle, setNotationStyle] = useState('TRADITIONAL'); // 'TRADITIONAL' | 'FIGURENOTES' – staff vs grid
  const [instrument, setInstrument] = useState('piano');
  const [instrumentNotationVariant, setInstrumentNotationVariant] = useState('standard'); // 'standard' | 'tab' | 'fingering'
  const [isRest, setIsRest] = useState(false);
  const [isDotted, setIsDotted] = useState(false);
  const [ghostPitch, setGhostPitch] = useState('C');
  const [ghostOctave, setGhostOctave] = useState(4);
  const [activeToolbox, setActiveToolbox] = useState(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  // Nähtavad tööriistad: millised tööriistakastid on külgribas nähtavad (seotud notatsiooni sisestusmeetodiga)
  const [visibleToolIds, setVisibleToolIds] = useState(() => TOOLBOX_ORDER.slice());
  const [visibleToolsMenuOpen, setVisibleToolsMenuOpen] = useState(false);
  const visibleToolsMenuRef = useRef(null);

  // Stage V: Time signature display mode
  const [timeSignatureMode, setTimeSignatureMode] = useState('pedagogical'); // 'classic' or 'pedagogical'
  const [timeSignatureEditField, setTimeSignatureEditField] = useState('numerator'); // 'numerator' or 'denominator'

  // Stage V: Selection and editing state
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1);
  const [selectionStart, setSelectionStart] = useState(-1);
  const [selectionEnd, setSelectionEnd] = useState(-1);
  const [clipboard, setClipboard] = useState([]);
  // Laulusõna ahelrežiim: valitud noodist alates järjest silbitamine; "-" lisab tühiku ja liigub järgmise noodi alla
  const [lyricChainStart, setLyricChainStart] = useState(-1);
  const [lyricChainEnd, setLyricChainEnd] = useState(-1);
  const [lyricChainIndex, setLyricChainIndex] = useState(null); // null = tavarežiim (näita valitud noodi laulusõna)
  const lyricInputRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Rütmi viimane väärtus (ref), et kohe pärast rütmi valimist lisatud noot kasutaks uut rütmi
  const lastDurationRef = useRef(selectedDuration);
  useEffect(() => {
    lastDurationRef.current = selectedDuration;
  }, [selectedDuration]);

  // Kui valik muutub, lõpeta laulusõna ahelrežiim (välja väärtus vastab taas valitud noodi(de) laulusõnale)
  useEffect(() => {
    setLyricChainIndex(null);
  }, [selectedNoteIndex, selectionStart, selectionEnd]);

  // Paigutus: taktide arv rea kohta (0 = automaatne), käsitsi rea- ja lehevahetused
  const [layoutMeasuresPerLine, setLayoutMeasuresPerLine] = useState(0);
  const [layoutLineBreakBefore, setLayoutLineBreakBefore] = useState([]);
  const [layoutPageBreakBefore, setLayoutPageBreakBefore] = useState([]);

  // Initialize with sample notes: C4, D4, E4 (overridden by localStorage if present)
  const [notes, setNotes] = useState([
    { id: 1, pitch: 'C', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 2, pitch: 'D', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false },
    { id: 3, pitch: 'E', octave: 4, duration: 1, durationLabel: '1/4', isDotted: false, isRest: false }
  ]);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [addedMeasures, setAddedMeasures] = useState(0);
  const [songTitle, setSongTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickupQuantity, setPickupQuantity] = useState(1);
  const [pickupDuration, setPickupDuration] = useState('1/4');
  // Häälestus: võrdlusnoot (nt A3=440 Hz), muudetav seadetest
  const [tuningReferenceNote, setTuningReferenceNote] = useState('A');
  const [tuningReferenceOctave, setTuningReferenceOctave] = useState(3);
  const [tuningReferenceHz, setTuningReferenceHz] = useState(440);
  const [playNoteOnInsert, setPlayNoteOnInsert] = useState(true);
  const [figurenotesSize, setFigurenotesSize] = useState(16); // Figuurnotatsiooni figuuride suurus (nagu fonti suurus), 10–32
  const [figurenotesStems, setFigurenotesStems] = useState(false); // Figuurnotatsioonis rütmi näitamine noodivartega (vaikimisi välja)
  const [showBarNumbers, setShowBarNumbers] = useState(true); // Taktide numbrid iga rea alguses noodivõtme kohal
  const [chords, setChords] = useState([]); // { id, beatPosition, chord, figuredBass? } – traditsiooniline ja figuurnotatsioon
  const [customChordInput, setCustomChordInput] = useState('');
  const [customFiguredBassInput, setCustomFiguredBassInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveCloudDialogOpen, setSaveCloudDialogOpen] = useState(false);
  // Rippmenüüd tööriistaribal: 'file' | null (Seaded on Faili all)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(null);
  const [fileSubmenuOpen, setFileSubmenuOpen] = useState(null); // 'seaded' | null
  const headerMenuRef = useRef(null);
  useEffect(() => {
    const closeMenus = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(null);
        setFileSubmenuOpen(null);
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
  const audioContextRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNewWorkFlow = searchParams.get('new') === '1';
  const [newWorkSetupOpen, setNewWorkSetupOpen] = useState(false);
  // Uue töö seadistuse vormi väljad (küsitakse enne töö loomist)
  const [wizardNotationMethod, setWizardNotationMethod] = useState('traditional'); // 'traditional' | 'figurenotes' | 'vabanotatsioon'
  const [wizardTimeSignature, setWizardTimeSignature] = useState([4, 4]);
  const [wizardSongTitle, setWizardSongTitle] = useState('');
  const [wizardAuthor, setWizardAuthor] = useState('');
  const [wizardInstrument, setWizardInstrument] = useState('piano');
  const [wizardPickupEnabled, setWizardPickupEnabled] = useState(false);
  const [wizardPickupQuantity, setWizardPickupQuantity] = useState(1);
  const [wizardPickupDuration, setWizardPickupDuration] = useState('1/4');

  useEffect(() => {
    if (isNewWorkFlow) setNewWorkSetupOpen(true);
  }, [isNewWorkFlow]);

  const applyNewWorkSetup = useCallback(() => {
    setNotationMode(wizardNotationMethod);
    setNotationStyle(wizardNotationMethod === 'figurenotes' ? 'FIGURENOTES' : 'TRADITIONAL');
    setTimeSignature({ beats: wizardTimeSignature[0], beatUnit: wizardTimeSignature[1] });
    setSongTitle(wizardSongTitle.trim());
    setAuthor(wizardAuthor.trim());
    setInstrument(wizardInstrument);
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
    setHistory([]);
    setHistoryIndex(-1);
    setSetupCompleted(true);
    setNewWorkSetupOpen(false);
    setSearchParams({});
    dirtyRef.current = true;
  }, [wizardNotationMethod, wizardTimeSignature, wizardSongTitle, wizardAuthor, wizardInstrument, wizardPickupEnabled, wizardPickupQuantity, wizardPickupDuration]);

  const isLoggedIn = () => {
    try {
      return !!localStorage.getItem('noodimeister-logged-in');
    } catch {
      return false;
    }
  };

  const addMeasure = useCallback(() => {
    if (!isLoggedIn()) {
      setSaveFeedback(t('demo.maxMeasures'));
      setTimeout(() => setSaveFeedback(''), 3500);
      return;
    }
    dirtyRef.current = true;
    setAddedMeasures(prev => prev + 1);
  }, []);

  // Build state to persist
  const getPersistedState = useCallback(() => ({
    notes,
    timeSignature,
    timeSignatureMode,
    clefType,
    keySignature,
    staffLines,
    notationStyle,
    pixelsPerBeat,
    notationMode,
    instrument,
    instrumentNotationVariant,
    cursorPosition,
    addedMeasures,
    setupCompleted,
    songTitle,
    author,
    pickupEnabled,
    pickupQuantity,
    pickupDuration,
    layoutMeasuresPerLine,
    layoutLineBreakBefore,
    layoutPageBreakBefore,
    visibleToolIds,
    tuningReferenceNote,
    tuningReferenceOctave,
    tuningReferenceHz,
    playNoteOnInsert,
    figurenotesSize,
    figurenotesStems,
    showBarNumbers,
    chords
  }), [notes, timeSignature, timeSignatureMode, clefType, keySignature, staffLines, notationStyle, pixelsPerBeat, notationMode, instrument, instrumentNotationVariant, cursorPosition, addedMeasures, setupCompleted, songTitle, author, pickupEnabled, pickupQuantity, pickupDuration, layoutMeasuresPerLine, layoutLineBreakBefore, layoutPageBreakBefore, visibleToolIds, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, showBarNumbers, chords]);

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

  // Project file export – single JSON object (future: can send to cloud API)
  const exportScoreToJSON = useCallback(() => ({
    version: 1,
    songTitle: songTitle || '',
    author: author || '',
    notationStyle,
    notationMode,
    timeSignature,
    timeSignatureMode,
    clefType,
    keySignature,
    staffLines,
    pixelsPerBeat,
    instrument,
    instrumentNotationVariant,
    pickupEnabled,
    pickupQuantity,
    pickupDuration,
    setupCompleted,
    cursorPosition,
    addedMeasures,
    layoutMeasuresPerLine,
    layoutLineBreakBefore,
    layoutPageBreakBefore,
    visibleToolIds,
    tuningReferenceNote,
    tuningReferenceOctave,
    tuningReferenceHz,
    playNoteOnInsert,
    figurenotesSize,
    figurenotesStems,
    showBarNumbers,
    scoreData: notes,
    chords
  }), [songTitle, author, notationStyle, notationMode, timeSignature, timeSignatureMode, clefType, keySignature, staffLines, pixelsPerBeat, instrument, instrumentNotationVariant, pickupEnabled, pickupQuantity, pickupDuration, setupCompleted, cursorPosition, addedMeasures, layoutMeasuresPerLine, layoutLineBreakBefore, layoutPageBreakBefore, visibleToolIds, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, showBarNumbers, notes, chords]);

  // Download project file (future: replace with upload to Google Drive / OneDrive)
  const downloadProject = useCallback(() => {
    try {
      const data = exportScoreToJSON();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.noodimeister';
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

  // Re-hydrate workspace from JSON (future: can receive from cloud API)
  const importProject = useCallback((data) => {
    if (!data || typeof data !== 'object') return false;
    const scoreData = data.scoreData ?? data.notes;
    if (!Array.isArray(scoreData)) return false;
    try {
      setNotes(scoreData);
      if (data.timeSignature) setTimeSignature(data.timeSignature);
      if (data.timeSignatureMode) setTimeSignatureMode(data.timeSignatureMode);
      if (data.clefType) setClefType(data.clefType);
      if (data.keySignature) setKeySignature(data.keySignature);
      if (data.staffLines != null) setStaffLines(data.staffLines);
      if (data.notationStyle) setNotationStyle(data.notationStyle);
      if (data.notationMode) setNotationMode(data.notationMode);
      if (data.pixelsPerBeat != null) setPixelsPerBeat(data.pixelsPerBeat);
      if (data.figurenotesSize != null) setFigurenotesSize(Math.max(10, Math.min(32, data.figurenotesSize)));
      if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
      if (data.instrument) setInstrument(data.instrument);
      if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
      if (data.cursorPosition != null) setCursorPosition(data.cursorPosition);
      if (data.addedMeasures != null) setAddedMeasures(data.addedMeasures);
      if (data.setupCompleted != null) setSetupCompleted(data.setupCompleted);
      if (data.songTitle != null) setSongTitle(data.songTitle);
      if (data.author != null) setAuthor(data.author);
      if (data.pickupEnabled != null) setPickupEnabled(data.pickupEnabled);
      if (data.pickupQuantity != null) setPickupQuantity(data.pickupQuantity);
      if (data.pickupDuration != null) setPickupDuration(data.pickupDuration);
      if (data.layoutMeasuresPerLine != null) setLayoutMeasuresPerLine(data.layoutMeasuresPerLine);
      if (Array.isArray(data.layoutLineBreakBefore)) setLayoutLineBreakBefore(data.layoutLineBreakBefore);
      if (Array.isArray(data.layoutPageBreakBefore)) setLayoutPageBreakBefore(data.layoutPageBreakBefore);
      if (Array.isArray(data.visibleToolIds) && data.visibleToolIds.length > 0) setVisibleToolIds(data.visibleToolIds);
      if (data.tuningReferenceNote) setTuningReferenceNote(data.tuningReferenceNote);
      if (data.tuningReferenceOctave != null) setTuningReferenceOctave(data.tuningReferenceOctave);
      if (data.tuningReferenceHz != null) setTuningReferenceHz(data.tuningReferenceHz);
      if (data.playNoteOnInsert != null) setPlayNoteOnInsert(data.playNoteOnInsert);
      if (data.showBarNumbers != null) setShowBarNumbers(data.showBarNumbers);
      if (Array.isArray(data.chords)) setChords(data.chords);
      clearDirty();
      setSaveFeedback(t('feedback.projectLoaded'));
      setTimeout(() => setSaveFeedback(''), 1800);
      return true;
    } catch (_) {
      return false;
    }
  }, [clearDirty]);

  const handleOpenProjectFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setSaveFeedback('Salvestatud faili pole');
        setTimeout(() => setSaveFeedback(''), 2000);
        return;
      }
      const data = JSON.parse(raw);
      if (data.notes && Array.isArray(data.notes)) {
        setNotes(data.notes);
        if (data.timeSignature) setTimeSignature(data.timeSignature);
        if (data.timeSignatureMode) setTimeSignatureMode(data.timeSignatureMode);
        if (data.clefType) setClefType(data.clefType);
        if (data.keySignature) setKeySignature(data.keySignature);
        if (data.staffLines != null) setStaffLines(data.staffLines);
        if (data.notationStyle) setNotationStyle(data.notationStyle);
        else if (data.gridOnlyMode != null) setNotationStyle(data.gridOnlyMode ? 'FIGURENOTES' : 'TRADITIONAL');
        if (data.pixelsPerBeat != null) setPixelsPerBeat(data.pixelsPerBeat);
        if (data.figurenotesSize != null) setFigurenotesSize(Math.max(10, Math.min(32, data.figurenotesSize)));
        if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
        if (data.notationMode) setNotationMode(data.notationMode);
        if (data.instrument) setInstrument(data.instrument);
        if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
        if (data.cursorPosition != null) setCursorPosition(data.cursorPosition);
        if (data.addedMeasures != null) setAddedMeasures(data.addedMeasures);
        if (data.setupCompleted != null) setSetupCompleted(data.setupCompleted);
        if (data.songTitle != null) setSongTitle(data.songTitle);
        if (data.author != null) setAuthor(data.author);
        if (data.pickupEnabled != null) setPickupEnabled(data.pickupEnabled);
        if (data.pickupQuantity != null) setPickupQuantity(data.pickupQuantity);
        if (data.pickupDuration != null) setPickupDuration(data.pickupDuration);
        else if (data.pickupBeats != null) { setPickupQuantity(data.pickupBeats); setPickupDuration('1/4'); }
        if (data.layoutMeasuresPerLine != null) setLayoutMeasuresPerLine(data.layoutMeasuresPerLine);
        if (Array.isArray(data.layoutLineBreakBefore)) setLayoutLineBreakBefore(data.layoutLineBreakBefore);
        if (Array.isArray(data.layoutPageBreakBefore)) setLayoutPageBreakBefore(data.layoutPageBreakBefore);
        if (Array.isArray(data.visibleToolIds) && data.visibleToolIds.length > 0) setVisibleToolIds(data.visibleToolIds);
        if (data.tuningReferenceNote) setTuningReferenceNote(data.tuningReferenceNote);
        if (data.tuningReferenceOctave != null) setTuningReferenceOctave(data.tuningReferenceOctave);
        if (data.tuningReferenceHz != null) setTuningReferenceHz(data.tuningReferenceHz);
        if (data.playNoteOnInsert != null) setPlayNoteOnInsert(data.playNoteOnInsert);
        if (data.showBarNumbers != null) setShowBarNumbers(data.showBarNumbers);
        if (Array.isArray(data.chords)) setChords(data.chords);
        clearDirty();
        setSaveFeedback('Laaditud!');
        setTimeout(() => setSaveFeedback(''), 1800);
      }
    } catch (e) {
      setSaveFeedback('Viga laadimisel');
      setTimeout(() => setSaveFeedback(''), 2000);
    }
  }, [clearDirty]);

  // Salvesta pilve: ava dialoog (vali kaust või loo uus).
  const saveToCloud = useCallback(() => {
    const token = googleDrive.getStoredToken();
    if (!token) {
      setSaveFeedback('Logi sisse Google\'iga (Drive luba)');
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    setSaveCloudDialogOpen(true);
  }, []);

  // Vali olemasolev kaust (Picker) ja salvesta sinna.
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
      const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.noodimeister';
      await googleDrive.createFileInFolder(token, folderId, fileName, json);
      setSaveFeedback('Salvestatud pilve!');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [exportScoreToJSON]);

  // Loo uus kaust juurkaustas ja salvesta sinna.
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
      const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.noodimeister';
      await googleDrive.createFileInFolder(token, folderId, fileName, json);
      setSaveCloudDialogOpen(false);
      setSaveFeedback('Salvestatud pilve!');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [exportScoreToJSON, saveCloudNewFolderName]);

  // Laadi pilvest (Google Drive): vali fail, lae sisu.
  const loadFromCloud = useCallback(async () => {
    const token = googleDrive.getStoredToken();
    if (!token) {
      setSaveFeedback('Logi sisse Google\'iga (Drive luba)');
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    try {
      setSaveFeedback('Vali fail…');
      const fileId = await googleDrive.pickFile(token);
      if (!fileId) {
        setSaveFeedback('');
        return;
      }
      setSaveFeedback('Laadin…');
      const content = await googleDrive.getFileContent(token, fileId);
      const data = JSON.parse(content);
      if (importProject(data)) {
        setSaveFeedback('Laaditud pilvest!');
        setTimeout(() => setSaveFeedback(''), 2500);
      } else {
        setSaveFeedback('Vigane projektifail');
        setTimeout(() => setSaveFeedback(''), 2500);
      }
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilvest laadimine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [importProject]);

  // Load from localStorage on mount (skip when opening as new work /app?new=1 or /app?fileId=...)
  useEffect(() => {
    if (searchParams.get('new') === '1') return;
    if (searchParams.get('fileId')) return; // laaditakse Drive'ist eraldi effect'iga
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.notes && Array.isArray(data.notes) && data.notes.length > 0) {
          setNotes(data.notes);
          if (data.timeSignature) setTimeSignature(data.timeSignature);
          if (data.timeSignatureMode) setTimeSignatureMode(data.timeSignatureMode);
          if (data.clefType) setClefType(data.clefType);
          if (data.keySignature) setKeySignature(data.keySignature);
          if (data.staffLines != null) setStaffLines(data.staffLines);
          if (data.notationStyle) setNotationStyle(data.notationStyle);
          else if (data.gridOnlyMode != null) setNotationStyle(data.gridOnlyMode ? 'FIGURENOTES' : 'TRADITIONAL');
          if (data.pixelsPerBeat != null) setPixelsPerBeat(data.pixelsPerBeat);
          if (data.figurenotesSize != null) setFigurenotesSize(Math.max(10, Math.min(32, data.figurenotesSize)));
          if (data.notationMode) setNotationMode(data.notationMode);
          if (data.instrument) setInstrument(data.instrument);
          if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
          if (data.cursorPosition != null) setCursorPosition(data.cursorPosition);
          if (data.addedMeasures != null) setAddedMeasures(data.addedMeasures);
          if (data.setupCompleted != null) setSetupCompleted(data.setupCompleted);
          if (data.songTitle != null) setSongTitle(data.songTitle);
          if (data.author != null) setAuthor(data.author);
          if (data.pickupEnabled != null) setPickupEnabled(data.pickupEnabled);
          if (data.pickupQuantity != null) setPickupQuantity(data.pickupQuantity);
          if (data.pickupDuration != null) setPickupDuration(data.pickupDuration);
          else if (data.pickupBeats != null) { setPickupQuantity(data.pickupBeats); setPickupDuration('1/4'); }
          if (data.layoutMeasuresPerLine != null) setLayoutMeasuresPerLine(data.layoutMeasuresPerLine);
          if (Array.isArray(data.layoutLineBreakBefore)) setLayoutLineBreakBefore(data.layoutLineBreakBefore);
          if (Array.isArray(data.layoutPageBreakBefore)) setLayoutPageBreakBefore(data.layoutPageBreakBefore);
          if (Array.isArray(data.visibleToolIds) && data.visibleToolIds.length > 0) setVisibleToolIds(data.visibleToolIds);
          if (data.tuningReferenceNote) setTuningReferenceNote(data.tuningReferenceNote);
          if (data.tuningReferenceOctave != null) setTuningReferenceOctave(data.tuningReferenceOctave);
          if (data.tuningReferenceHz != null) setTuningReferenceHz(data.tuningReferenceHz);
          if (data.playNoteOnInsert != null) setPlayNoteOnInsert(data.playNoteOnInsert);
          if (data.showBarNumbers != null) setShowBarNumbers(data.showBarNumbers);
        }
      }
    } catch (_) { /* ignore */ }
  }, []);

  // Load from Google Drive when opening /app?fileId=...
  const driveFileId = searchParams.get('fileId');
  useEffect(() => {
    if (!driveFileId) return;
    const token = googleDrive.getStoredToken();
    if (!token) {
      setSaveFeedback('Logi sisse Google\'iga, et laadida pilvest.');
      setTimeout(() => setSaveFeedback(''), 4000);
      return;
    }
    let cancelled = false;
    setSaveFeedback('Laadin pilvest…');
    googleDrive.getFileContent(token, driveFileId)
      .then((content) => {
        if (cancelled) return;
        const data = JSON.parse(content);
        if (importProject(data)) {
          setSaveFeedback('Laaditud!');
          setTimeout(() => setSaveFeedback(''), 2500);
        } else {
          setSaveFeedback('Vigane projektifail');
          setTimeout(() => setSaveFeedback(''), 3000);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSaveFeedback(e?.message || 'Pilvest laadimine ebaõnnestus');
          setTimeout(() => setSaveFeedback(''), 4000);
        }
      });
    return () => { cancelled = true; };
  }, [driveFileId, importProject]);

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
  }, [notes, timeSignature, timeSignatureMode, clefType, keySignature, staffLines, notationStyle, pixelsPerBeat, notationMode, instrument, cursorPosition, addedMeasures, setupCompleted, songTitle, author, pickupEnabled, pickupQuantity, pickupDuration, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, showBarNumbers, chords, getPersistedState]);

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

  // Rütmi (takti) vahetusel: kursor jääb kehtivasse vahemikku (MuseScore-sarnane käitumine); demo puhul max 8 takti
  useEffect(() => {
    const totalBeats = notes.reduce((acc, n) => acc + n.duration, 0);
    const maxCursor = isLoggedIn() ? totalBeats : Math.min(totalBeats, DEMO_MAX_BEATS);
    setCursorPosition(prev => Math.max(0, Math.min(prev, maxCursor)));
  }, [timeSignature.beats, timeSignature.beatUnit, notes]);

  const durations = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25 };
  
  const getEffectiveDuration = (dur) => {
    const base = durations[dur];
    return isDotted ? base * 1.5 : base;
  };

  // Stage V: History management for undo/redo
  const saveToHistory = useCallback((newNotes) => {
    dirtyRef.current = true;
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newNotes)));
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setNotes(JSON.parse(JSON.stringify(history[historyIndex - 1])));
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

  // Check if note is in selection range
  const isNoteSelected = useCallback((index) => {
    if (selectionStart >= 0 && selectionEnd >= 0) {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      return index >= start && index <= end;
    }
    return index === selectedNoteIndex;
  }, [selectedNoteIndex, selectionStart, selectionEnd]);

  // Pitch shifting helper (diatonic step)
  const pitchOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
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

  // Pickup: convert duration label to beats (relative to time sig beat unit). E.g. 4/4 + 1/8 → 0.5 beats.
  const durationToBeats = useCallback((durationLabel, beatUnit) => {
    const denom = parseInt(String(durationLabel).split('/')[1], 10) || 4;
    return beatUnit / denom;
  }, []);

  // Calculate measures (with optional pickup / eeltakt – exact rhythmic value)
  const calculateMeasures = useCallback(() => {
    const measures = [];
    let currentBeat = 0;
    const beatsPerMeasure = timeSignature.beats;
    const beatUnit = timeSignature.beatUnit;
    let firstMeasureBeats = beatsPerMeasure;
    if (pickupEnabled && pickupQuantity > 0 && pickupDuration) {
      const oneUnitBeats = durationToBeats(pickupDuration, beatUnit);
      firstMeasureBeats = pickupQuantity * oneUnitBeats;
      firstMeasureBeats = Math.max(0.25, Math.min(firstMeasureBeats, beatsPerMeasure - 0.25));
    }

    const getMeasureBounds = (measureIndex) => {
      if (measureIndex === 0) {
        return { startBeat: 0, endBeat: firstMeasureBeats, beatCount: firstMeasureBeats };
      }
      const startBeat = firstMeasureBeats + (measureIndex - 1) * beatsPerMeasure;
      return { startBeat, endBeat: startBeat + beatsPerMeasure, beatCount: beatsPerMeasure };
    };

    notes.forEach(note => {
      let measureIndex = 0;
      let { endBeat } = getMeasureBounds(0);
      while (currentBeat >= endBeat) {
        measureIndex++;
        const b = getMeasureBounds(measureIndex);
        endBeat = b.endBeat;
      }
      const b = getMeasureBounds(measureIndex);
      if (!measures[measureIndex]) {
        measures[measureIndex] = { ...b, notes: [] };
      }
      measures[measureIndex].notes.push({ ...note, beat: currentBeat });
      currentBeat += note.duration;
    });

    let totalMeasures = Math.max(4, measures.length + 1) + addedMeasures;
    if (!isLoggedIn()) {
      totalMeasures = Math.min(DEMO_MAX_MEASURES, totalMeasures);
    }
    for (let i = 0; i < totalMeasures; i++) {
      if (!measures[i]) {
        const b = getMeasureBounds(i);
        measures[i] = { ...b, notes: [] };
      }
    }
    return !isLoggedIn() ? measures.slice(0, DEMO_MAX_MEASURES) : measures;
  }, [notes, timeSignature, addedMeasures, pickupEnabled, pickupQuantity, pickupDuration, durationToBeats]);

  const playPianoNote = useCallback((pitch, octave, semitonesOffset = 0) => {
    const semi = semitonesOffset === true || semitonesOffset === 1 ? 1 : semitonesOffset === -1 ? -1 : 0;
    const freq = getNoteFrequency(tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, pitch, octave, semi);
    playTone(audioContextRef, freq);
  }, [tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz]);

  // Handle toolbox selection (clickedIndex = option index when clicking, else uses selectedOptionIndex for keyboard)
  const addNoteAtCursor = useCallback((pitch, octave, accidental = 0) => {
    const totalBeatsNow = notes.reduce((acc, n) => acc + n.duration, 0);
    const oct = octave ?? ghostOctave;
    const durationLabel = lastDurationRef.current ?? selectedDuration;
    const effectiveDuration = getEffectiveDuration(durationLabel);
    if (!isLoggedIn() && totalBeatsNow + effectiveDuration > DEMO_MAX_BEATS) {
      setSaveFeedback('Demo: max 8 takti (2 rida). Logi sisse või registreeru, et kirjutada edasi.');
      setTimeout(() => setSaveFeedback(''), 3500);
      return;
    }
    const newNote = {
      id: Date.now(),
      pitch,
      octave: oct,
      duration: effectiveDuration,
      durationLabel,
      isDotted: isDotted,
      isRest: isRest,
      lyric: '',
      ...(accidental !== 0 && { accidental })
    };
    saveToHistory(notes);
    setNotes(prev => [...prev, newNote]);
    setCursorPosition(prev => prev + effectiveDuration);
    setGhostPitch(pitch);
    setGhostOctave(oct);
    if (!isRest && playNoteOnInsert) {
      const semitones = accidental === 1 ? 1 : accidental === -1 ? -1 : 0;
      playPianoNote(pitch, oct, semitones);
    }
  }, [selectedDuration, getEffectiveDuration, isDotted, isRest, notes, saveToHistory, ghostOctave, playPianoNote, playNoteOnInsert]);

  // Akordi lisamise asukoht: kursor (sisestusrežiim) või valitud noodi algus
  const getChordInsertBeat = useCallback(() => {
    if (noteInputMode) return cursorPosition;
    if (selectedNoteIndex >= 0 && selectedNoteIndex < notes.length) {
      return notes.slice(0, selectedNoteIndex).reduce((s, n) => s + n.duration, 0);
    }
    return cursorPosition;
  }, [noteInputMode, cursorPosition, selectedNoteIndex, notes]);

  const addChordAt = useCallback((beatPosition, chordText, figuredBass = '') => {
    if (!chordText || !String(chordText).trim()) return;
    dirtyRef.current = true;
    const newChord = {
      id: Date.now() + Math.random(),
      beatPosition,
      chord: String(chordText).trim(),
      figuredBass: figuredBass ? String(figuredBass).trim() : ''
    };
    setChords(prev => [...prev, newChord].sort((a, b) => a.beatPosition - b.beatPosition));
  }, []);

  const handleToolboxSelection = useCallback((clickedIndex) => {
    if (!activeToolbox) return;
    const toolbox = toolboxes[activeToolbox];
    if (!toolbox?.options) return;
    const optionIndex = clickedIndex !== undefined ? clickedIndex : selectedOptionIndex;
    const option = toolbox.options[optionIndex];
    if (!option) return;
    if (activeToolbox === 'instruments' && option.type === 'category') return;

    switch (activeToolbox) {
      case 'rhythm':
        if (option.value === 'rest') setIsRest(prev => !prev);
        else if (option.value === 'dotted') setIsDotted(prev => !prev);
        else {
          lastDurationRef.current = option.value;
          setSelectedDuration(option.value);
        }
        break;
      case 'pitchInput':
        if (noteInputMode && ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(option.value)) {
          addNoteAtCursor(option.value, ghostOctave);
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
        setClefType(option.value);
        break;
      case 'keySignatures':
        setKeySignature(option.value);
        break;
      case 'notehead':
        setNotationMode(option.value);
        break;
      case 'layout':
        if (option.id.startsWith('staff-')) {
          setStaffLines(option.value);
          setNotationStyle('TRADITIONAL');
        } else if (option.value === 'gridOnly') {
          setNotationStyle('FIGURENOTES');
          setStaffLines(5);
        } else if (option.id.startsWith('spacing-')) setPixelsPerBeat(option.value);
        break;
      case 'instruments': {
        const instId = option.type === 'option' ? option.value : option.value;
        const cfg = instrumentConfig[instId];
        setInstrument(instId);
        if (cfg) {
          if (cfg.type === 'standard' || cfg.type === 'grandStaff' || cfg.type === 'figuredBass' || cfg.type === 'accordion') setInstrumentNotationVariant('standard');
          else if (cfg.type === 'tab') {
            if (instrumentNotationVariant === 'fingering' || instrumentNotationVariant === 'figuredBass') setInstrumentNotationVariant('standard');
          } else if (cfg.type === 'wind') {
            if (instrumentNotationVariant === 'tab' || instrumentNotationVariant === 'figuredBass') setInstrumentNotationVariant('standard');
          }
        }
        break;
      }
      case 'repeatsJumps':
        // Placeholder: repeat/jump signs – state can be extended later
        break;
      case 'chords':
        if (option.value !== 'custom') {
          addChordAt(getChordInsertBeat(), option.value, '');
          setActiveToolbox(null);
          setSelectedOptionIndex(0);
        }
        // 'custom' jätab paneeli lahti; akord sisestatakse väljade kaudu
        return;
    }
    setActiveToolbox(null);
    setSelectedOptionIndex(0);
  }, [activeToolbox, selectedOptionIndex, noteInputMode, addNoteAtCursor, ghostOctave, instrumentNotationVariant, addChordAt, getChordInsertBeat]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ära püüa klahve, kui kasutaja kirjutab input/textarea väljale (nt pealkiri, autor) – v.a. Ctrl+L laulusõna väljal
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();
      const isTypingInInput = tag === 'input' || tag === 'textarea' || (active?.getAttribute?.('contenteditable') === 'true');
      // Ctrl+L (Cmd+L): alusta laulusõna sisestamist valitud noodist – fokusseeri laulusõna väli ja lülita ahelrežiim sisse (töötab ka teiste väljade puhul)
      if (modKey && e.code === 'KeyL' && selectedNoteIndex >= 0) {
        e.preventDefault();
        const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
        const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
        setLyricChainStart(start);
        setLyricChainEnd(end);
        setLyricChainIndex(start);
        setTimeout(() => lyricInputRef.current?.focus(), 0);
        return;
      }
      if (isTypingInInput) return;

      // Stage V: Undo (Ctrl+Z)
      if (modKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Stage V: Copy (Ctrl+C)
      if (modKey && e.code === 'KeyC' && !noteInputMode) {
        e.preventDefault();
        const selectedNotes = getSelectedNotes();
        if (selectedNotes.length > 0) {
          setClipboard(JSON.parse(JSON.stringify(selectedNotes)));
        }
        return;
      }

      // Stage V: Paste (Ctrl+V)
      if (modKey && e.code === 'KeyV' && clipboard.length > 0) {
        e.preventDefault();
        const newNotes = [...notes];
        const insertIndex = noteInputMode ? notes.length : selectedNoteIndex + 1;
        const pastedNotes = clipboard.map(note => ({
          ...note,
          id: Date.now() + Math.random()
        }));
        newNotes.splice(insertIndex, 0, ...pastedNotes);
        saveToHistory(notes);
        setNotes(newNotes);
        
        // Update cursor if in input mode
        if (noteInputMode) {
          const totalDuration = pastedNotes.reduce((sum, note) => sum + note.duration, 0);
          setCursorPosition(prev => prev + totalDuration);
        }
        return;
      }

      // Ctrl+7 / Ctrl+8 – Global Notation Style (staff vs grid)
      const notationMod = e.metaKey || e.ctrlKey;
      if (notationMod && e.code === 'Digit7') {
        e.preventDefault();
        setNotationStyle('TRADITIONAL');
        setNotationMode('traditional');
        return;
      }
      if (notationMod && e.code === 'Digit8') {
        e.preventDefault();
        setNotationStyle('FIGURENOTES');
        setNotationMode('figurenotes');
        return;
      }
      if (notationMod && e.code === 'Digit9') {
        e.preventDefault();
        setNotationMode('vabanotatsioon');
        return;
      }

      // Cmd+B / Ctrl+B – lisa takt
      if (notationMod && e.code === 'KeyB') {
        e.preventDefault();
        addMeasure();
        return;
      }

      // Cmd+A / Ctrl+A – ava Akordid tööriistakast (akordi lisamiseks)
      if (modKey && e.code === 'KeyA') {
        e.preventDefault();
        setActiveToolbox(activeToolbox === 'chords' ? null : 'chords');
        setSelectedOptionIndex(0);
        return;
      }

      // N key toggles note input mode
      if (e.code === 'KeyN' && !e.shiftKey && !modKey) {
        e.preventDefault();
        setNoteInputMode(prev => {
          if (prev) {
            setSelectedNoteIndex(-1);
            setSelectionStart(-1);
            setSelectionEnd(-1);
          } else if (selectedNoteIndex >= 0 && notes[selectedNoteIndex]) {
            const n = notes[selectedNoteIndex];
            setGhostPitch(n.pitch);
            setGhostOctave(n.octave);
          } else if (notes.length > 0) {
            const last = notes[notes.length - 1];
            setGhostPitch(last.pitch);
            setGhostOctave(last.octave);
          }
          return !prev;
        });
        return;
      }

      // Shift+1..9: open toolbox (toggle: same shortcut closes or keeps focused)
      if (e.shiftKey && !modKey) {
        const toolboxMap = {
          'Digit1': 'rhythm', 'Digit2': 'timeSignature', 'Digit3': 'clefs',
          'Digit4': 'keySignatures', 'Digit5': 'pitchInput', 'Digit6': 'notehead',
          'Digit7': 'instruments', 'Digit8': 'repeatsJumps', 'Digit9': 'layout'
        };
        if (toolboxMap[e.code]) {
          e.preventDefault();
          const newToolbox = toolboxMap[e.code];
          setActiveToolbox(activeToolbox === newToolbox ? null : newToolbox);
          setSelectedOptionIndex(0);
          return;
        }
      }

      // Noodi sisestusrežiim: nooltedega kursor, tähtedega noot (ka tööriistakast avatud)
      if (noteInputMode) {
        const totalBeats = notes.reduce((acc, n) => acc + n.duration, 0);
        const maxCursor = isLoggedIn() ? totalBeats : Math.min(totalBeats, DEMO_MAX_BEATS);
        const cursorStep = e.shiftKey ? 0.25 : 1;
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          setCursorPosition(prev => Math.max(0, prev - cursorStep));
          return;
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          setCursorPosition(prev => Math.min(maxCursor, prev + cursorStep));
          return;
        }
        const noteLetter = e.key?.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetter)) {
          e.preventDefault();
          addNoteAtCursor(noteLetter.toUpperCase(), ghostOctave);
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
                  beats: Math.min(prev.beats + 1, 16) 
                }));
              } else {
                // Denominator can only be 1, 2, 4, 8, 16
                const validDenominators = [1, 2, 4, 8, 16];
                const currentIndex = validDenominators.indexOf(timeSignature.beatUnit);
                if (currentIndex < validDenominators.length - 1) {
                  setTimeSignature(prev => ({ 
                    ...prev, 
                    beatUnit: validDenominators[currentIndex + 1]
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
                const validDenominators = [1, 2, 4, 8, 16];
                const currentIndex = validDenominators.indexOf(timeSignature.beatUnit);
                if (currentIndex > 0) {
                  setTimeSignature(prev => ({ 
                    ...prev, 
                    beatUnit: validDenominators[currentIndex - 1]
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
            'Digit4': '1/8', 'Digit3': '1/16'
          };
          if (durationMap[e.code] && !e.shiftKey && !modKey) {
            e.preventDefault();
            const dur = durationMap[e.code];
            lastDurationRef.current = dur;
            setSelectedDuration(dur);
            const optionIdx = toolbox.options.findIndex(opt => opt.value === dur);
            if (optionIdx >= 0) setSelectedOptionIndex(optionIdx);
            return;
          }
          if (e.code === 'Digit0' && !e.shiftKey && !modKey) {
            e.preventDefault();
            setIsRest(prev => !prev);
            return;
          }
          if (e.code === 'Period' && !e.shiftKey && !modKey) {
            e.preventDefault();
            setIsDotted(prev => !prev);
            return;
          }
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedOptionIndex(prev => prev < toolbox.options.length - 1 ? prev + 1 : prev);
          return;
        }
        if (e.key === 'ArrowUp') {
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

      // Stage V: Selection mode (when N is OFF)
      if (!activeToolbox && !noteInputMode) {
        // Arrow navigation
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (e.shiftKey) {
            // Range selection
            if (selectionStart < 0) {
              setSelectionStart(selectedNoteIndex);
              setSelectionEnd(Math.min(selectedNoteIndex + 1, notes.length - 1));
              setSelectedNoteIndex(Math.min(selectedNoteIndex + 1, notes.length - 1));
            } else {
              setSelectionEnd(prev => Math.min(prev + 1, notes.length - 1));
              setSelectedNoteIndex(prev => Math.min(prev + 1, notes.length - 1));
            }
          } else {
            // Single selection
            setSelectionStart(-1);
            setSelectionEnd(-1);
            setSelectedNoteIndex(prev => Math.min(prev + 1, notes.length - 1));
          }
          return;
        }

        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (e.shiftKey) {
            // Range selection
            if (selectionStart < 0) {
              setSelectionStart(selectedNoteIndex);
              setSelectionEnd(Math.max(selectedNoteIndex - 1, 0));
              setSelectedNoteIndex(Math.max(selectedNoteIndex - 1, 0));
            } else {
              setSelectionEnd(prev => Math.max(prev - 1, 0));
              setSelectedNoteIndex(prev => Math.max(prev - 1, 0));
            }
          } else {
            // Single selection
            setSelectionStart(-1);
            setSelectionEnd(-1);
            setSelectedNoteIndex(prev => Math.max(prev - 1, 0));
          }
          return;
        }

        // Stage V: Pitch editing – Arrow Up/Down (diatonic), Shift+Arrow (octave jump)
        const applyToSelectedNotes = (transform) => {
          const newNotes = [...notes];
          if (selectionStart >= 0 && selectionEnd >= 0) {
            const start = Math.min(selectionStart, selectionEnd);
            const end = Math.max(selectionStart, selectionEnd);
            for (let i = start; i <= end; i++) {
              newNotes[i] = { ...newNotes[i], ...transform(newNotes[i]) };
            }
          } else if (selectedNoteIndex >= 0) {
            newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], ...transform(newNotes[selectedNoteIndex]) };
          }
          saveToHistory(notes);
          setNotes(newNotes);
        };

        if (e.code === 'ArrowUp' && selectedNoteIndex >= 0 && !e.shiftKey) {
          e.preventDefault();
          applyToSelectedNotes(n => ({ ...shiftPitch(n.pitch, n.octave, 1), accidental: 0 }));
          return;
        }

        if (e.code === 'ArrowDown' && selectedNoteIndex >= 0 && !e.shiftKey) {
          e.preventDefault();
          applyToSelectedNotes(n => ({ ...shiftPitch(n.pitch, n.octave, -1), accidental: 0 }));
          return;
        }

        if (e.code === 'ArrowUp' && selectedNoteIndex >= 0 && e.shiftKey) {
          e.preventDefault();
          applyToSelectedNotes(n => ({ octave: shiftOctave(n.octave, 1) }));
          return;
        }

        if (e.code === 'ArrowDown' && selectedNoteIndex >= 0 && e.shiftKey) {
          e.preventDefault();
          applyToSelectedNotes(n => ({ octave: shiftOctave(n.octave, -1) }));
          return;
        }

        // Stage V: Duration editing (Digits 3-7)
        const durationMap = {
          'Digit7': '1/1', 'Digit6': '1/2', 'Digit5': '1/4',
          'Digit4': '1/8', 'Digit3': '1/16'
        };
        if (durationMap[e.code] && selectedNoteIndex >= 0) {
          e.preventDefault();
          const newNotes = [...notes];
          const newDurationLabel = durationMap[e.code];
          const newDuration = durations[newDurationLabel];
          newNotes[selectedNoteIndex] = {
            ...newNotes[selectedNoteIndex],
            duration: newDuration,
            durationLabel: newDurationLabel
          };
          saveToHistory(notes);
          setNotes(newNotes);
          return;
        }

        // Stage V: Delete selected note(s) – replace with rest(s) of same duration (no shifting)
        if ((e.code === 'Backspace' || e.code === 'Delete') && selectedNoteIndex >= 0) {
          e.preventDefault();
          const newNotes = notes.map((note, i) => {
            const inRange = selectionStart >= 0 && selectionEnd >= 0
              ? (i >= Math.min(selectionStart, selectionEnd) && i <= Math.max(selectionStart, selectionEnd))
              : (i === selectedNoteIndex);
            if (!inRange) return note;
            return {
              id: Date.now() + i,
              pitch: 'C',
              octave: 4,
              duration: note.duration,
              durationLabel: note.durationLabel,
              isDotted: note.isDotted,
              isRest: true
            };
          });
          saveToHistory(notes);
          setNotes(newNotes);
          setSelectionStart(-1);
          setSelectionEnd(-1);
          return;
        }
      }

      // Normal input mode (when N is ON) – Ghost note + add
      if (!activeToolbox && noteInputMode) {
        // Arrow Up/Down – diatonic step on ghost note
        if (e.code === 'ArrowUp' && !e.shiftKey) {
          e.preventDefault();
          const { pitch, octave } = shiftPitch(ghostPitch, ghostOctave, 1);
          setGhostPitch(pitch);
          setGhostOctave(octave);
          return;
        }
        if (e.code === 'ArrowDown' && !e.shiftKey) {
          e.preventDefault();
          const { pitch, octave } = shiftPitch(ghostPitch, ghostOctave, -1);
          setGhostPitch(pitch);
          setGhostOctave(octave);
          return;
        }
        // Shift+Arrow Up/Down – octave jump on ghost note
        if (e.code === 'ArrowUp' && e.shiftKey) {
          e.preventDefault();
          setGhostOctave(shiftOctave(ghostOctave, 1));
          return;
        }
        if (e.code === 'ArrowDown' && e.shiftKey) {
          e.preventDefault();
          setGhostOctave(shiftOctave(ghostOctave, -1));
          return;
        }
        // Duration shortcuts
        const durationMap = {
          'Digit7': '1/1', 'Digit6': '1/2', 'Digit5': '1/4',
          'Digit4': '1/8', 'Digit3': '1/16'
        };
        if (durationMap[e.code] && !e.shiftKey && !modKey) {
          const dur = durationMap[e.code];
          lastDurationRef.current = dur;
          setSelectedDuration(dur);
          return;
        }
        if (e.code === 'Digit0' && !e.shiftKey && !modKey) {
          e.preventDefault();
          setIsRest(prev => !prev);
          return;
        }
        if (e.code === 'Period' && !e.shiftKey && !modKey) {
          e.preventDefault();
          setIsDotted(prev => !prev);
          return;
        }

        // Note input (C-G)
        const noteLetter = e.key.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetter)) {
          const effectiveDuration = getEffectiveDuration(selectedDuration);
          const pitch = noteLetter.toUpperCase();
          const newNote = {
            id: Date.now(),
            pitch,
            octave: ghostOctave,
            duration: effectiveDuration,
            durationLabel: selectedDuration,
            isDotted: isDotted,
            isRest: isRest
          };
          saveToHistory(notes);
          setNotes(prev => [...prev, newNote]);
          setCursorPosition(prev => prev + effectiveDuration);
          setGhostPitch(pitch);
        }

        // Backspace in input mode: kustuta viimane noot, kursor liigub eelmise (allesjäänud) noodi juurde
        if (e.key === 'Backspace' && notes.length > 0) {
          e.preventDefault();
          const lastNote = notes[notes.length - 1];
          saveToHistory(notes);
          setNotes(prev => prev.slice(0, -1));
          setCursorPosition(prev => Math.max(0, prev - lastNote.duration));
          const remaining = notes.slice(0, -1);
          if (remaining.length > 0) {
            const prevNote = remaining[remaining.length - 1];
            setGhostPitch(prevNote.pitch);
            setGhostOctave(prevNote.octave);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeToolbox, selectedOptionIndex, handleToolboxSelection, noteInputMode, selectedDuration, isDotted, isRest, notes, getEffectiveDuration, selectedNoteIndex, selectionStart, selectionEnd, clipboard, undo, saveToHistory, getSelectedNotes, shiftPitch, shiftOctave, addMeasure, ghostPitch, ghostOctave]);

  const measures = calculateMeasures();
  const cursorMeasureIndex = measures.length > 0
    ? (() => {
        const i = measures.findIndex(m => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
        return i >= 0 ? i : Math.max(0, measures.length - 1);
      })()
    : 0;
  const scoreContainerRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(LAYOUT.PAGE_WIDTH_MIN);
  useEffect(() => {
    const el = scoreContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPageWidth(Math.max(LAYOUT.PAGE_WIDTH_MIN, Math.min(LAYOUT.PAGE_WIDTH_MAX, w)));
    });
    ro.observe(el);
    setPageWidth(Math.max(LAYOUT.PAGE_WIDTH_MIN, Math.min(LAYOUT.PAGE_WIDTH_MAX, el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);

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

  const TIME_SIGNATURE_OPTIONS = [
    { label: '4/4', value: [4, 4] },
    { label: '3/4', value: [3, 4] },
    { label: '2/4', value: [2, 4] },
    { label: '6/8', value: [6, 8] },
    { label: '5/4', value: [5, 4] }
  ];

  if (!icons) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-900/95 text-amber-100">
        {t('loading.tools')}
      </div>
    );
  }
  const { Music2, Clock, Hash, Type, Piano, Palette, Layout, Check, Save, FolderOpen, Plus, Settings, Key, Repeat, Cloud, LogOut, User, CloudUpload, CloudDownload, FolderPlus, ChevronDown } = icons;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 50%, #fdba74 100%)' }}>
      {/* New Project Setup Wizard – overlay until mode selected */}
      {!setupCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-950/80 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border-2 border-amber-200">
            <div className="bg-gradient-to-r from-amber-700 to-amber-600 text-white px-8 py-6">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Uus projekt</h1>
              <p className="text-amber-100 text-sm mt-1">Vali notatsiooni stiil ja täida väljad</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-amber-900 mb-2">Loo pealkiri</label>
                  <input
                    type="text"
                    value={songTitle}
                    onChange={(e) => { dirtyRef.current = true; setSongTitle(e.target.value); }}
                    placeholder="Nimetu"
                    className="w-full px-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-amber-900 mb-2">Autor / helilooja</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => { dirtyRef.current = true; setAuthor(e.target.value); }}
                    placeholder="Helilooja nimi"
                    className="w-full px-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-2">Taktimõõt</label>
                <select
                  value={`${timeSignature.beats}/${timeSignature.beatUnit}`}
                  onChange={(e) => {
                    const [beats, beatUnit] = e.target.value.split('/').map(Number);
                    setTimeSignature({ beats, beatUnit });
                  }}
                  className="w-full px-4 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-900 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {TIME_SIGNATURE_OPTIONS.map(({ label, value }) => (
                    <option key={label} value={`${value[0]}/${value[1]}`}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-2">Taktide paigutus</label>
                <p className="text-sm text-amber-700 mb-2">Mitu takti soovite vaikimisi ühe rea kohta? (Saate hiljem muuta tööriistakastis Paigutus.)</p>
                <div className="flex flex-wrap items-center gap-3">
                  {[2, 3, 4, 6, 8].map((n) => (
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
                  <span className="font-bold text-amber-900 text-lg">Traditsiooniline noodijoonestik</span>
                  <span className="text-sm text-amber-700 mt-2 text-center">Tavaline 5-realise noodistiku notatsioon.</span>
                </button>
                <button
                  onClick={() => completeSetup('FIGURENOTES')}
                  className="group flex flex-col items-center justify-center p-6 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:shadow-lg transition-all duration-200 text-left"
                >
                  <span className="w-12 h-12 rounded-full bg-amber-400 group-hover:bg-amber-500 mb-3 flex items-center justify-center text-amber-900 font-bold text-lg">C</span>
                  <span className="font-bold text-amber-900 text-lg">Figuurnoodid (võre)</span>
                  <span className="text-sm text-amber-700 mt-2 text-center">Värvide ja kujundite põhine võre algajatele.</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uue töö seadistuse dialoog – notatsioon, taktimõõt, loo nimi, autor jne */}
      {newWorkSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-950/70 backdrop-blur-sm p-6" onClick={() => {}}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border-2 border-amber-200 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> Uue töö seadistus</h2>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-amber-900">Täida väljad uue nooditöö jaoks. Kõik vajalikud seaded saad hiljem muuta menüüst Seaded.</p>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-2">Notatsiooni meetod</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'traditional'} onChange={() => setWizardNotationMethod('traditional')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Traditsiooniline noodistik</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'figurenotes'} onChange={() => setWizardNotationMethod('figurenotes')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Figuurnotatsioon (värvid ja kujundid)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'vabanotatsioon'} onChange={() => setWizardNotationMethod('vabanotatsioon')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Vabanotatsioon (solfeeg)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-2">Taktimõõt</label>
                <div className="flex flex-wrap gap-2">
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

      {/* Settings modal – Title, Author, Pickup (post-setup editing) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-amber-950/60 backdrop-blur-sm p-6" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-amber-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Seaded</h2>
              <button onClick={() => setSettingsOpen(false)} className="text-white/90 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
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
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarNumbers}
                    onChange={(e) => { dirtyRef.current = true; setShowBarNumbers(e.target.checked); }}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600"
                  />
                  <span className="text-sm font-semibold text-amber-900">Taktiloendur (näita taktinumbreid iga rea alguses; maha võtmise korral takte ei loendata)</span>
                </label>
              </div>
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
                    min={10}
                    max={32}
                    value={figurenotesSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) { dirtyRef.current = true; setFigurenotesSize(Math.max(10, Math.min(32, v))); }
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
              <button onClick={() => setSettingsOpen(false)} className="w-full py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500">Sulge</button>
            </div>
          </div>
        </div>
      )}

      {/* Pilve salvestamise dialoog: vali kaust või loo uus */}
      {saveCloudDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-amber-950/60 backdrop-blur-sm p-6" onClick={() => setSaveCloudDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-sky-200" onClick={e => e.stopPropagation()}>
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

      {/* Minimal Top Bar – rida 1: logo; rida 2: rippmenüüd ja kõik käsud */}
      <header className="flex-shrink-0 bg-gradient-to-r from-amber-900 via-orange-800 to-red-900 text-amber-50 shadow-lg">
        <div className="w-full pl-3 pr-4 py-3 flex flex-col gap-3">
          {/* Rida 1: ainult logo */}
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-amber-50 hover:text-white transition-colors">
              <Music2 className="w-6 h-6" />
              <span className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>NoodiMeister</span>
            </Link>
          </div>
          {/* Rida 2: rippmenüüd ja kõik käsud */}
          <div className="flex flex-wrap items-center gap-2" ref={headerMenuRef}>
              <button
                onClick={addMeasure}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 hover:shadow-lg active:scale-[0.98] transition-all duration-200 border border-slate-700/50"
                title={isLoggedIn() ? 'Lisa takt (Cmd+B / Ctrl+B)' : 'Demo: max 2 rida. Logi sisse rohkemaks.'}
              >
                <Plus className="w-4 h-4" />
                Lisa takt (Cmd+B)
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
                        const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
                        const path = base.replace(/\/$/, '') + '/app?new=1';
                        window.open(`${window.location.origin}${path}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Ava uus töö teises aknas (sama kasutaja)"
                    >
                      <Plus className="w-4 h-4" /> {t('file.newWork')}
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
                      onClick={() => { loadFromStorage(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <FolderOpen className="w-4 h-4" /> {t('file.loadBrowser')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    <button
                      type="button"
                      onClick={() => { saveToCloud(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <CloudUpload className="w-4 h-4" /> {t('file.saveCloud')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { loadFromCloud(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <CloudDownload className="w-4 h-4" /> {t('file.loadCloud')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    {/* Seaded – alammenüü: pealkiri, autor, eeltakt */}
                    <div className="relative" onMouseEnter={() => setFileSubmenuOpen('seaded')} onMouseLeave={() => setFileSubmenuOpen(null)}>
                      <button
                        type="button"
                        onClick={() => setFileSubmenuOpen(prev => prev === 'seaded' ? null : 'seaded')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                        title={t('file.settingsTitle')}
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          {t('file.settings')}
                        </span>
                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                      </button>
                      {fileSubmenuOpen === 'seaded' && (
                        <div className="absolute left-full top-0 ml-0 min-w-[220px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50">
                          <button
                            type="button"
                            onClick={() => { setSettingsOpen(true); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                          >
                            <Settings className="w-4 h-4" /> {t('file.settingsSub')}
                          </button>
                        </div>
                      )}
                    </div>
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

              {/* Keelevalik */}
              <div className="flex items-center gap-0.5 rounded-lg overflow-hidden border border-amber-600/50 bg-amber-900/40">
                {LOCALES.map(({ code, name }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${locale === code ? 'bg-amber-600 text-white' : 'text-amber-200 hover:bg-amber-800/60'}`}
                    title={name}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              <LoggedInUser icons={icons} t={t} />
            {!isLoggedIn() && (
              <Link to="/login" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-700/80 text-amber-100 hover:bg-amber-600 border border-amber-600/50" title={t('demo.loginHint')}>
                {t('demo.badge')}
              </Link>
            )}
            {/* Rütmi indikaator, tagasiside, valik, notatsiooni vahetajad */}
            <div className="flex items-center gap-2 bg-amber-800 px-3 py-1 rounded shrink-0">
              <span className="text-xs uppercase tracking-wider">{t('toolbar.rhythm')}:</span>
              <RhythmIcon duration={selectedDuration} isDotted={isDotted} isRest={isRest} />
            </div>
            {saveFeedback && (
              <span className="text-sm font-medium text-amber-200 animate-pulse">{saveFeedback}</span>
            )}
            {!noteInputMode && selectedNoteIndex >= 0 && (
              <>
                <div className="flex items-center gap-2 bg-blue-600 px-3 py-1 rounded text-xs">
                  <span className="uppercase tracking-wider">{t('toolbar.selected')}:</span>
                  <span className="font-bold">
                    {selectionStart >= 0 && selectionEnd >= 0 
                      ? `${Math.abs(selectionEnd - selectionStart) + 1} ${t('toolbar.notesCount')}`
                      : t('toolbar.oneNote')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-amber-100 whitespace-nowrap">{t('toolbar.lyricLabel')}:</label>
                  <input
                    ref={lyricInputRef}
                    type="text"
                    value={lyricChainIndex !== null
                      ? (notes[lyricChainIndex]?.lyric ?? '')
                      : (() => {
                          const idx = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
                          const n = notes[idx];
                          return n ? (n.lyric ?? '') : '';
                        })()}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (lyricChainIndex !== null) {
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => i === lyricChainIndex ? { ...n, lyric: val } : n));
                      } else {
                        const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
                        const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => (i >= start && i <= end) ? { ...n, lyric: val } : n));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === '-') {
                        const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
                        const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
                        const idx = lyricChainIndex !== null ? lyricChainIndex : start;
                        const currentVal = notes[idx]?.lyric ?? '';
                        e.preventDefault();
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => i === idx ? { ...n, lyric: currentVal + '-' } : n));
                        if (idx < end) {
                          if (lyricChainIndex === null) { setLyricChainStart(start); setLyricChainEnd(end); }
                          setLyricChainIndex(idx + 1);
                        }
                      }
                    }}
                    onBlur={() => setLyricChainIndex(null)}
                    placeholder={t('toolbar.lyricPlaceholder')}
                    className="px-2 py-1 rounded text-sm bg-amber-100 text-amber-900 border border-amber-300 w-28 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    title={t('toolbar.lyricTitle')}
                  />
                </div>
              </>
            )}
            {/* Global Notation Style: Staff vs Grid (Ctrl+7 / Ctrl+8) */}
            <div className="flex gap-1 bg-amber-900/30 rounded-lg p-1" title={t('toolbar.staffGridTitle')}>
              <button
                onClick={() => { setNotationStyle('TRADITIONAL'); setNotationMode('traditional'); }}
                className={`px-2 py-1 rounded text-xs font-medium ${notationStyle === 'TRADITIONAL' ? 'bg-amber-200 text-amber-900' : 'text-amber-100 hover:bg-amber-800/50'}`}
              >
                {t('toolbar.staff')}
              </button>
              <button
                onClick={() => { setNotationStyle('FIGURENOTES'); setNotationMode('figurenotes'); }}
                className={`px-2 py-1 rounded text-xs font-medium ${notationStyle === 'FIGURENOTES' ? 'bg-amber-200 text-amber-900' : 'text-amber-100 hover:bg-amber-800/50'}`}
              >
                {t('toolbar.grid')}
              </button>
            </div>
            {/* Notation mode tabs (notehead style) */}
            <div className="flex gap-1 bg-amber-900/50 rounded-lg p-1">
              {[
                { id: 'traditional', label: t('toolbar.traditional') },
                { id: 'figurenotes', label: t('toolbar.figurenotes') },
                { id: 'vabanotatsioon', label: t('toolbar.vabanotatsioon') }
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setNotationMode(id)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                    notationMode === id
                      ? 'bg-amber-100 text-amber-900 shadow'
                      : 'text-amber-100 hover:bg-amber-800/50 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setNoteInputMode(prev => !prev)}
              className={`px-4 py-2 rounded font-bold transition-all ${
                noteInputMode 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-600 text-gray-100 hover:bg-gray-500'
              }`}
              title={noteInputMode ? t('toolbar.inputMode') : t('toolbar.selectionMode')}
            >
              {noteInputMode ? 'N' : 'SEL'}
            </button>
          </div>
        </div>
      </header>

      <div className={`flex flex-1 ${activeToolbox === 'pianoKeyboard' ? 'pb-36' : ''}`}>
        {/* Left Sidebar - Main Control Center */}
        <aside className="flex-shrink-0 w-72 bg-white border-r-2 border-amber-200 shadow-xl p-6 overflow-auto">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-600"></span>
              {t('toolbar.palette')}
            </h3>

            {/* Nähtavad tööriistad – rippmenüü */}
            <div className="relative mb-3" ref={visibleToolsMenuRef}>
              <button
                type="button"
                onClick={() => setVisibleToolsMenuOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-sm font-medium hover:bg-amber-200"
              >
                <span>{t('toolbar.visibleTools')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${visibleToolsMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {visibleToolsMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 py-2 rounded-lg bg-white border-2 border-amber-300 shadow-lg z-50 max-h-64 overflow-auto">
                  {TOOLBOX_ORDER.map((id) => {
                    const tb = toolboxes[id];
                    if (!tb) return null;
                    const isVisible = visibleToolIds.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-amber-50 cursor-pointer">
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
                  case 'rhythm': return <RhythmIcon duration={selectedDuration} isDotted={isDotted} isRest={isRest} />;
                  case 'timeSignature':
                    return timeSignatureMode === 'pedagogical'
                      ? <PedagogicalMeterIcon beats={timeSignature.beats} beatUnit={timeSignature.beatUnit} />
                      : <MeterIcon beats={timeSignature.beats} beatUnit={timeSignature.beatUnit} />;
                  case 'clefs': return <ClefIcon clefType={clefType} />;
                  case 'keySignatures': return <Key className="w-5 h-5" />;
                  case 'pitchInput': return <PitchIcon />;
                  case 'notehead': return <NoteheadIcon />;
                  case 'layout': return <LayoutIcon staffLines={staffLines} />;
                  case 'instruments': return <InstrumentIcon instrument={instrument} />;
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
                    setActiveToolbox(activeToolbox === id ? null : id);
                    setSelectedOptionIndex(0);
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                    activeToolbox === id
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {renderIcon()}
                    <span className="text-sm font-medium">{toolbox.name}</span>
                  </div>
                  <span className="text-xs font-mono opacity-75">{toolbox.shortcut}</span>
                </button>
              );
            })}

            {/* Active Toolbox Panel */}
            {activeToolbox && toolboxes[activeToolbox] && (
              <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">
                  {toolboxes[activeToolbox].name}
                </h4>
                
                {/* Special UI for Time Signature Editing */}
                {activeToolbox === 'timeSignature' && selectedOptionIndex === 0 && (
                  <div className="mb-3 p-3 bg-white rounded border-2 border-amber-400">
                    <div className="text-center mb-2">
                      <div className="text-xs text-amber-700 uppercase font-bold mb-1">
                        {t('timesig.current')}: {timeSignature.beats}/{timeSignature.beatUnit}
                      </div>
                      <div className="text-xs text-amber-600">
                        {t('timesig.mode')}: {timeSignatureMode === 'pedagogical' ? t('timesig.pedagogical') : t('timesig.classic')}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 items-center justify-center">
                      <div className={`flex flex-col items-center p-2 rounded ${
                        timeSignatureEditField === 'numerator' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'
                      }`}>
                        <div className="text-xs text-gray-600 mb-1">{t('timesig.beats')}</div>
                        <div className="text-2xl font-bold text-amber-900">{timeSignature.beats}</div>
                        <div className="text-xs text-gray-500 mt-1">↑↓</div>
                      </div>
                      
                      <div className="text-2xl font-bold text-amber-900">/</div>
                      
                      <div className={`flex flex-col items-center p-2 rounded ${
                        timeSignatureEditField === 'denominator' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'
                      }`}>
                        <div className="text-xs text-gray-600 mb-1">{t('timesig.unit')}</div>
                        <div className="text-2xl font-bold text-amber-900">{timeSignature.beatUnit}</div>
                        <div className="text-xs text-gray-500 mt-1">↑↓</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-center text-amber-600 mt-2">
                      {t('timesig.tabHint')}
                    </div>
                  </div>
                )}

                {/* Klaveri klaviatuur – kuvatakse lehe all; liigub lehekülge kerides kaasa */}
                {activeToolbox === 'pianoKeyboard' && (
                  <p className="text-xs text-amber-700">
                    {t('layout.keyboardHint')}
                  </p>
                )}

                {/* Akordid: kohandatud akord ja figuurnoodid (figuurnotatsioon) */}
                {activeToolbox === 'chords' && (
                  <div className="mb-3 p-3 bg-white rounded border-2 border-amber-400 space-y-2">
                    <p className="text-xs text-amber-700">
                      {t('chords.hint')} <kbd className="font-mono bg-amber-100 px-1 rounded">Ctrl+A</kbd> / <kbd className="font-mono bg-amber-100 px-1 rounded">Cmd+A</kbd>.
                    </p>
                    <label className="block text-xs font-semibold text-amber-900">{t('chords.customLabel')}</label>
                    <input
                      type="text"
                      value={customChordInput}
                      onChange={(e) => setCustomChordInput(e.target.value)}
                      placeholder={t('chords.customPlaceholder')}
                      className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm"
                    />
                    <label className="block text-xs font-semibold text-amber-900">{t('chords.figuredBass')}</label>
                    <input
                      type="text"
                      value={customFiguredBassInput}
                      onChange={(e) => setCustomFiguredBassInput(e.target.value)}
                      placeholder={t('chords.figuredBassPlaceholder')}
                      className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const chord = customChordInput.trim();
                        if (chord) {
                          addChordAt(getChordInsertBeat(), chord, customFiguredBassInput);
                          setCustomChordInput('');
                          setCustomFiguredBassInput('');
                        }
                      }}
                      className="w-full py-1.5 px-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                    >
                      {t('chords.add')}
                    </button>
                  </div>
                )}
                
                <div className="space-y-1">
                  {activeToolbox !== 'pianoKeyboard' && toolboxes[activeToolbox]?.options?.map((option, idx) => {
                    if (activeToolbox === 'instruments' && option.type === 'category') {
                      return (
                        <div key={option.id} className="pt-2 pb-0.5 px-2 text-xs font-bold text-amber-800 uppercase tracking-wide border-b border-amber-200 first:pt-0">
                          {option.label}
                        </div>
                      );
                    }
                    const isActive = activeToolbox === 'rhythm'
                      ? (option.value === 'rest' && isRest) ||
                        (option.value === 'dotted' && isDotted) ||
                        (option.value === selectedDuration && option.value !== 'rest' && option.value !== 'dotted')
                      : activeToolbox === 'timeSignature' && option.value === 'mode-toggle'
                      ? false
                      : activeToolbox === 'clefs'
                      ? option.value === clefType
                      : activeToolbox === 'keySignatures'
                      ? option.value === keySignature
                      : activeToolbox === 'notehead'
                      ? option.value === notationMode
                      : activeToolbox === 'instruments'
                      ? option.type === 'option' && option.value === instrument
                      : activeToolbox === 'layout'
                      ? (option.value === 'gridOnly' && notationStyle === 'FIGURENOTES') ||
                        (option.id === 'staff-5' && notationStyle === 'TRADITIONAL' && staffLines === 5) ||
                        (option.id === 'staff-1' && notationStyle === 'TRADITIONAL' && staffLines === 1) ||
                        (option.id?.startsWith('spacing-') && pixelsPerBeat === option.value)
                      : selectedOptionIndex === idx;

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleToolboxSelection(idx)}
                        className={`w-full p-2 rounded text-left text-sm transition-all ${
                          (['layout', 'keySignatures', 'instruments', 'clefs', 'notehead'].includes(activeToolbox) ? isActive : selectedOptionIndex === idx)
                            ? 'bg-amber-200 border-l-2 border-amber-600'
                            : 'hover:bg-amber-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {activeToolbox === 'rhythm' && (option.value === 'rest' || option.value === 'dotted'
                              ? (option.value === 'rest' ? <RhythmIcon duration={selectedDuration} isRest={true} /> : <RhythmIcon duration={selectedDuration} isDotted={true} />)
                              : ['1/1','1/2','1/4','1/8','1/16'].includes(option.value) && <RhythmIcon duration={option.value} />)}
                            <span className="font-medium">{option.label}</span>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                          {activeToolbox === 'timeSignature' && option.value === 'mode-toggle' && (
                            <span className="text-xs text-amber-600">
                              ({timeSignatureMode === 'pedagogical' ? t('timesig.pedagogical') : t('timesig.classic')})
                            </span>
                          )}
                        </div>
                        {option.key && (
                          <span className="text-xs text-amber-600 font-mono">({option.key})</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Instruments: linked TAB / Fingering variant when applicable */}
                {activeToolbox === 'instruments' && (() => {
                  const cfg = instrumentConfig[instrument];
                  if (!cfg || cfg.type === 'standard') return null;
                  if (cfg.type === 'tab') {
                    return (
                      <div className="mt-3 pt-3 border-t-2 border-amber-200">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('inst.view')}</h4>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setInstrumentNotationVariant('standard')}
                            className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'standard' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {t('inst.staff')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInstrumentNotationVariant('tab')}
                            className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'tab' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {t('inst.tab')}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (cfg.type === 'wind' && cfg.fingering) {
                    return (
                      <div className="mt-3 pt-3 border-t-2 border-amber-200">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('inst.view')}</h4>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setInstrumentNotationVariant('standard')}
                            className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'standard' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {t('inst.staff')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInstrumentNotationVariant('fingering')}
                            className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'fingering' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {t('inst.fingering')}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (cfg.type === 'figuredBass') {
                    return (
                      <div className="mt-3 pt-3 border-t-2 border-amber-200">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('inst.view')}</h4>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setInstrumentNotationVariant('standard')}
                            className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'standard' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {t('inst.staff')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInstrumentNotationVariant('figuredBass')}
                            className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${instrumentNotationVariant === 'figuredBass' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                          >
                            {t('inst.figuredBass')}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Layout toolbox: Taktide paigutus + Project file */}
                {activeToolbox === 'layout' && (
                  <>
                  <div className="mt-4 pt-4 border-t-2 border-amber-200">
                    <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.measuresPerLine')}</h4>
                    <p className="text-xs text-amber-700 mb-2">{t('layout.measuresPerLineHint')}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {[2, 3, 4, 6, 8].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setLayoutMeasuresPerLine(n)}
                          className={`px-2 py-1 rounded text-sm font-medium ${layoutMeasuresPerLine === n ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-amber-700 mb-1">Paigutuse muudatus kehtib kursorit sisaldava takti suhtes. Liigu kursoriga (← →) soovitud takti.</p>
                    <div className="mb-2 px-2 py-1.5 rounded bg-amber-100 border border-amber-200 text-amber-900 text-sm font-medium">
                      {t('layout.cursorInMeasure')}: {cursorMeasureIndex + 1}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <button
                        type="button"
                        disabled={cursorMeasureIndex <= 0}
                        onClick={() => {
                          if (cursorMeasureIndex <= 0) return;
                          setLayoutLineBreakBefore((prev) => [...new Set([...prev, cursorMeasureIndex])].sort((a, b) => a - b));
                        }}
                        className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('layout.nextLine')}
                      </button>
                      <button
                        type="button"
                        disabled={cursorMeasureIndex <= 0}
                        onClick={() => {
                          if (cursorMeasureIndex <= 0) return;
                          setLayoutPageBreakBefore((prev) => [...new Set([...prev, cursorMeasureIndex])].sort((a, b) => a - b));
                        }}
                        className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('layout.newPage')}
                      </button>
                      <button
                        type="button"
                        disabled={cursorMeasureIndex <= 0}
                        onClick={() => setLayoutLineBreakBefore((prev) => prev.filter((i) => i !== cursorMeasureIndex))}
                        className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('layout.removeLineBreak')}
                      </button>
                      <button
                        type="button"
                        disabled={cursorMeasureIndex <= 0}
                        onClick={() => setLayoutPageBreakBefore((prev) => prev.filter((i) => i !== cursorMeasureIndex))}
                        className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('layout.removePageBreak')}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t-2 border-amber-200">
                    <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.projectFile')}</h4>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={downloadProject}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                      >
                        {t('layout.saveProject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => projectFileInputRef.current?.click()}
                        className="w-full py-2 px-3 rounded-lg bg-slate-600 text-white text-sm font-semibold hover:bg-slate-500"
                      >
                        {t('layout.openProject')}
                      </button>
                      <input
                        ref={projectFileInputRef}
                        type="file"
                        accept=".json,.noodimeister,application/json"
                        className="hidden"
                        onChange={handleOpenProjectFile}
                      />
                    </div>
                  </div>
                  </>
                )}
              </div>
            )}

          </div>
        </aside>

        {/* Main Score Area – A4 proportsioon (laius 800–1000px) */}
        <main className="flex-1 p-8 overflow-auto">
          <div ref={scoreContainerRef} className="mx-auto bg-white rounded-lg shadow-lg border-2 border-amber-200 p-8" style={{ maxWidth: 1000, minHeight: 400 }}>
              {/* Pealkiri muudetav otse lehel (nagu Google Docs); failinimi = pealkiri salvestamisel */}
              <div className="mb-4">
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => { dirtyRef.current = true; setSongTitle(e.target.value); }}
                  placeholder="Nimetu"
                  className="w-full text-2xl sm:text-3xl font-bold text-center text-amber-900 bg-transparent border-0 border-b-2 border-transparent hover:border-amber-300 focus:border-amber-500 focus:outline-none focus:ring-0 py-0"
                  style={{ fontFamily: 'Georgia, serif' }}
                  title="Pealkiri: muuda siin. Salvestamisel kasutatakse seda faili nimena (nagu Google Docs)."
                />
                {author && (
                  <p className="text-sm text-amber-700 text-right mt-1">{author}</p>
                )}
              </div>
              <Timeline
                measures={measures}
                pageWidth={pageWidth}
                timeSignature={timeSignature}
                timeSignatureMode={timeSignatureMode}
                pixelsPerBeat={pixelsPerBeat}
                cursorPosition={cursorPosition}
                notationMode={notationMode}
                staffLines={staffLines}
                clefType={clefType}
                instrument={instrument}
                instrumentNotationVariant={instrumentNotationVariant}
                isDotted={isDotted}
                isRest={isRest}
                selectedDuration={selectedDuration}
                noteInputMode={noteInputMode}
                selectedNoteIndex={selectedNoteIndex}
                isNoteSelected={isNoteSelected}
                notes={notes}
                onStaffAddNote={addNoteAtCursor}
                ghostPitch={ghostPitch}
                ghostOctave={ghostOctave}
                notationStyle={notationStyle}
                layoutMeasuresPerLine={layoutMeasuresPerLine}
                layoutLineBreakBefore={layoutLineBreakBefore}
                layoutPageBreakBefore={layoutPageBreakBefore}
                figurenotesSize={figurenotesSize}
                figurenotesStems={figurenotesStems}
              />
          </div>
        </main>

        {/* Klaveri klaviatuur – react-piano mudel; fikseeritud all, lehekülge kerides kaasa */}
        {activeToolbox === 'pianoKeyboard' && (() => {
          const firstNote = MidiNumbers.fromNote('c3');
          const lastNote = MidiNumbers.fromNote('c5');
          const noteRange = { first: firstNote, last: lastNote };
          const keyboardShortcuts = KeyboardShortcuts.create({
            firstNote,
            lastNote,
            keyboardConfig: KeyboardShortcuts.HOME_ROW
          });
          return (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-amber-100 to-amber-50 border-t-2 border-amber-300 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] py-3 px-4">
              <div className="mx-auto max-w-4xl">
                <Piano
                  className="NoodiMeisterPiano"
                  noteRange={noteRange}
                  playNote={(midiNumber) => {
                    const { pitch, octave, isAccidental } = midiToPitchOctave(midiNumber);
                    const attrs = MidiNumbers.getAttributes(midiNumber);
                    const accidental = attrs.pitchName && attrs.pitchName.includes('#') ? 1 : attrs.pitchName && attrs.pitchName.includes('b') ? -1 : 0;
                    setGhostPitch(pitch);
                    setGhostOctave(octave);
                    if (noteInputMode) addNoteAtCursor(pitch, octave, accidental);
                    else playPianoNote(pitch, octave, isAccidental ? 1 : 0);
                  }}
                  stopNote={() => {}}
                  width={Math.min(900, typeof window !== 'undefined' ? window.innerWidth - 80 : 900)}
                  keyboardShortcuts={keyboardShortcuts}
                  activeNotes={[pitchOctaveToMidi(ghostPitch, ghostOctave)]}
                  renderNoteLabel={({ midiNumber, isActive, isAccidental }) => {
                    const { pitch, octave } = midiToPitchOctave(midiNumber);
                    if (notationMode === 'traditional') {
                      return (
                        <span>
                          {MidiNumbers.getAttributes(midiNumber).pitchName}{octave}
                        </span>
                      );
                    }
                    const color = FIGURENOTES_COLORS[pitch] || '#666';
                    const shape = FIGURENOTES_SHAPES[octave] === 'square' ? '□' : FIGURENOTES_SHAPES[octave] === 'circle' ? '○' : '△';
                    return (
                      <span
                        className="inline-block w-4 h-4 rounded border border-amber-800 flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: color, color: octave === 3 ? '#fff' : '#000' }}
                        title={`${pitch} ${FIGURENOTES_SHAPES[octave] || ''}`}
                      >
                        {shape}
                      </span>
                    );
                  }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// Pitch/octave ↔ MIDI (C4 = 60). Tuning string "E2" → midi. (PITCH_TO_SEMI on defineeritud üleval.)
function pitchOctaveToMidi(pitch, octave) {
  return (octave + 1) * 12 + (PITCH_TO_SEMI[pitch] ?? 0);
}
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
  } catch (_) { /* ignore */ }
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
  if (instrumentId === 'tin-whistle') return FINGERING_TIN_WHISTLE[key];
  if (instrumentId === 'recorder') return FINGERING_RECORDER[key];
  if (instrumentId === 'flute') return null; // optional: add flute chart later
  return null;
}

// Timeline Component – multi-system layout (VexFlow loogika). (PAGE_BREAK_GAP on defineeritud üleval.)
function Timeline({ measures, timeSignature, timeSignatureMode, pixelsPerBeat, pageWidth, cursorPosition, notationMode, staffLines, clefType, instrument = 'piano', instrumentNotationVariant = 'standard', isDotted, isRest, selectedDuration, noteInputMode, selectedNoteIndex, isNoteSelected, notes: allNotes, onStaffAddNote, ghostPitch, ghostOctave, notationStyle, layoutMeasuresPerLine = 4, layoutLineBreakBefore = [], layoutPageBreakBefore = [], figurenotesSize = 16, figurenotesStems = false }) {
  const isFigurenotesMode = notationStyle === 'FIGURENOTES';
  const instCfg = instrumentConfig[instrument];
  const isTabMode = instCfg?.type === 'tab' && instrumentNotationVariant === 'tab';
  const isFingeringMode = instCfg?.type === 'wind' && instCfg?.fingering && instrumentNotationVariant === 'fingering';
  const tabStrings = isTabMode && instCfg?.strings ? instCfg.strings : 0;
  const tabTuning = isTabMode && instCfg?.tuning ? instCfg.tuning : [];

  const barLineWidth = isFigurenotesMode ? 5 : 2;
  const BEAT_BOX_STROKE = '#b0b0b0';
  const layoutOptions = { measuresPerLine: layoutMeasuresPerLine, lineBreakBefore: layoutLineBreakBefore, pageBreakBefore: layoutPageBreakBefore };
  const systems = computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth || LAYOUT.PAGE_WIDTH_MIN, layoutOptions);
  const totalHeight = systems.length > 0
    ? systems[systems.length - 1].yOffset + LAYOUT.STAFF_HEIGHT + 40
    : LAYOUT.STAFF_HEIGHT + 40;
  const timelineHeight = LAYOUT.STAFF_HEIGHT;
  const centerY = timelineHeight / 2;
  const marginLeft = LAYOUT.MARGIN_LEFT;

  const getStaffLinePositions = () => {
    if (isTabMode && tabStrings >= 1) {
      const spacing = 12;
      const startY = centerY - (tabStrings - 1) * spacing / 2;
      return Array.from({ length: tabStrings }, (_, i) => startY + i * spacing);
    }
    if (staffLines === 1) return [centerY];
    if (staffLines === 5) {
      const spacing = 10;
      const startY = centerY - (spacing * 2);
      return Array.from({ length: 5 }, (_, i) => startY + i * spacing);
    }
    return [centerY];
  };

  const staffLinePositions = getStaffLinePositions();
  const spacing = 10;
  const middleLineY = centerY; // B4 treble / D3 bass

  // Pitch+octave → staff Y. Treble: E4=bottom line. Stem: üleval → vars alla; allpool → vars üles.
  const getPitchY = (pitch, octave) => {
    if (staffLines !== 5) return centerY;
    const rel = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    if (clefType === 'treble') {
      const bottomY = centerY + spacing * 2;
      const index = (octave - 4) * 7 + rel[pitch] - 2;
      return bottomY - index * (spacing / 2);
    }
    const bottomY = centerY + spacing * 2;
    const index = (octave - 3) * 7 + rel[pitch] - 4;
    return bottomY - index * (spacing / 2);
  };

  // Map staff Y position to pitch. Treble: F5 (ülemine joon) kuni E4 (alumine joon); D4 = esimese joone all, C4 = esimesel abijoonel.
  const getPitchFromY = (clickY) => {
    if (staffLines !== 5 || !onStaffAddNote) return null;
    const spacing = 10;
    const startY = centerY - spacing * 2;
    const pitches = [
      { y: startY, pitch: 'F', octave: 5 },
      { y: startY + spacing/2, pitch: 'E', octave: 5 },
      { y: startY + spacing, pitch: 'D', octave: 5 },
      { y: startY + spacing*1.5, pitch: 'C', octave: 5 },
      { y: startY + spacing*2, pitch: 'B', octave: 4 },
      { y: startY + spacing*2.5, pitch: 'A', octave: 4 },
      { y: startY + spacing*3, pitch: 'G', octave: 4 },
      { y: startY + spacing*3.5, pitch: 'F', octave: 4 },
      { y: startY + spacing*4, pitch: 'E', octave: 4 },
      { y: startY + spacing*4.5, pitch: 'D', octave: 4 },
      { y: startY + spacing*5, pitch: 'C', octave: 4 }
    ];
    let nearest = pitches[0];
    let minDist = Math.abs(clickY - pitches[0].y);
    for (const p of pitches) {
      const d = Math.abs(clickY - p.y);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest;
  };

  const handleStaffClick = (e) => {
    if (!noteInputMode || !onStaffAddNote) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    for (const sys of systems) {
      const staffTop = sys.yOffset;
      const staffBottom = sys.yOffset + timelineHeight;
      if (clickY >= staffTop - 15 && clickY <= staffBottom + 15) {
        const localY = clickY - sys.yOffset;
        const pitchInfo = getPitchFromY(localY);
        const clickMargin = 15;
        const ledgerMargin = staffLines === 5 ? 10 * 2 : 0;
        if (pitchInfo && localY >= staffLinePositions[0] - clickMargin && localY <= staffLinePositions[staffLinePositions.length - 1] + clickMargin + ledgerMargin) {
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
              <ellipse cx={noteX} cy={noteY} rx="5" ry="3" fill="none" stroke="#333" strokeWidth="1.5"/>
            );
          case 2: // Half note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="none" stroke="#333" strokeWidth="1.5"/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5"/>
              </>
            );
          case 4: // Quarter note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333"/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5"/>
              </>
            );
          case 8: // Eighth note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333"/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5"/>
                <path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15}`} fill="#333"/>
              </>
            );
          case 16: // Sixteenth note
            return (
              <>
                <ellipse cx={noteX} cy={noteY} rx="4" ry="2.5" fill="#333"/>
                <line x1={stemX} y1={noteY} x2={stemX} y2={noteY + 20} stroke="#333" strokeWidth="1.5"/>
                <path d={`M ${stemX} ${noteY + 20} Q ${stemX - 6} ${noteY + 18} ${stemX} ${noteY + 15} M ${stemX} ${noteY + 17} Q ${stemX - 6} ${noteY + 15} ${stemX} ${noteY + 12}`} fill="#333"/>
              </>
            );
          default:
            return <text x={noteX} y={noteY + 20} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">{timeSignature.beatUnit}</text>;
        }
      };

      return (
        <g>
          <text x={x} y={y - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">
            {timeSignature.beats}
          </text>
          <line x1={x - 10} y1={y + 2} x2={x + 10} y2={y + 2} stroke="#333" strokeWidth="1.5"/>
          {getNoteSymbolForDenominator()}
        </g>
      );
    } else {
      // Classic mode: both as numbers
      return (
        <g>
          <text x={x} y={y - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">
            {timeSignature.beats}
          </text>
          <line x1={x - 10} y1={y + 2} x2={x + 10} y2={y + 2} stroke="#333" strokeWidth="1.5"/>
          <text x={x} y={y + 20} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">
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
      return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#1a1a1a"/>;
    }
    if (dur === '1/2') {
      return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#1a1a1a"/>;
    }
    if (dur === '1/4') {
      return <path d={`M ${x} ${restY - 10} Q ${x + 6} ${restY - 4} ${x} ${restY} Q ${x - 6} ${restY + 4} ${x} ${restY + 10}`} stroke="#1a1a1a" strokeWidth="1.8" fill="none"/>;
    }
    if (dur === '1/8') {
      return (
        <g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.2">
          <circle cx={x} cy={restY - 4} r="2"/>
          <path d={`M ${x} ${restY - 2} Q ${x - 6} ${restY} ${x} ${restY + 6}`} fill="none" strokeWidth="1.5"/>
        </g>
      );
    }
    if (dur === '1/16') {
      return (
        <g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.2">
          <circle cx={x} cy={restY - 6} r="1.8"/>
          <circle cx={x} cy={restY} r="1.8"/>
          <path d={`M ${x} ${restY + 2} Q ${x - 5} ${restY + 4} ${x} ${restY + 10}`} fill="none" strokeWidth="1.5"/>
        </g>
      );
    }
    return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#1a1a1a"/>;
  };

  // Figurenotes rendering function (size from figurenotesSize setting)
  const renderFigurenote = (note, x, y, noteIndex) => {
    const color = FIGURENOTES_COLORS[note.pitch] || '#000000';
    const shape = FIGURENOTES_SHAPES[note.octave] || 'circle';
    const size = figurenotesSize;
    const isSelected = isNoteSelected(noteIndex);
    const dur = note.durationLabel || '1/4';
    const drawStem = figurenotesStems && dur !== '1/1';
    const stemLength = 26;
    const stemX = x + size / 2 + 1;
    const stemY1 = y;
    const stemY2 = y - stemLength;

    const shapeElement = (() => {
      if (shape === 'circle') {
        return (
          <circle
            cx={x}
            cy={y}
            r={size / 2}
            fill={color}
            stroke={isSelected ? "#2563eb" : "#000"}
            strokeWidth={isSelected ? "3" : "2"}
          />
        );
      } else if (shape === 'square') {
        return (
          <rect
            x={x - size / 2}
            y={y - size / 2}
            width={size}
            height={size}
            fill={color}
            stroke={isSelected ? "#2563eb" : "#000"}
            strokeWidth={isSelected ? "3" : "2"}
          />
        );
      } else if (shape === 'triangle') {
        const h = size * 0.866;
        return (
          <path
            d={`M ${x} ${y - h / 2} L ${x + size / 2} ${y + h / 2} L ${x - size / 2} ${y + h / 2} Z`}
            fill={color}
            stroke={isSelected ? "#2563eb" : "#000"}
            strokeWidth={isSelected ? "3" : "2"}
          />
        );
      }
    })();

    const pad = Math.max(4, size * 0.25);
    const tailLength = (dur === '1/1') ? Math.max(20, size * 1.4) : (dur === '1/2') ? Math.max(12, size * 0.85) : 0;
    const selectionHeight = size * 2.5 + tailLength;
    return (
      <g>
        {/* Selection highlight background */}
        {isSelected && (
          <rect
            x={x - size - pad * 0.5}
            y={y - size * 1.25}
            width={size * 2 + pad}
            height={selectionHeight}
            fill="#93c5fd"
            opacity="0.3"
            rx="4"
          />
        )}
        {shapeElement}
        {/* Pikkade nootide (1/2, 1/1) alumine saba – visuaalselt näitab noodi pikkust */}
        {tailLength > 0 && (
          <line
            x1={x}
            y1={y + size / 2}
            x2={x}
            y2={y + size / 2 + tailLength}
            stroke="#1a1a1a"
            strokeWidth={Math.max(2, size * 0.14)}
            strokeLinecap="round"
          />
        )}
        {/* Noodivarte režiim: vars ja vibud (lühikestel nootidel) */}
        {drawStem && (
          <g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.8">
            <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} />
            {dur === '1/8' && (
              <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" />
            )}
            {dur === '1/16' && (
              <>
                <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" />
                <path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill="#1a1a1a" />
              </>
            )}
          </g>
        )}
        {/* Alteratsiooninool figuuri kohal: kõrgendamine (♯) = nool paremale üles (↗), madaldamine (♭) = nool vasakule üles (↖) */}
        {(note.accidental === 1 || note.accidental === -1) && (() => {
          const arrowY = y - size / 2 - 10;
          const arrowLen = 14;
          const head = 5;
          const stroke = '#1a1a1a';
          if (note.accidental === 1) {
            return (
              <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1={x - arrowLen / 2} y1={arrowY + arrowLen / 2} x2={x + arrowLen / 2} y2={arrowY - arrowLen / 2} />
                <path d={`M ${x + arrowLen / 2} ${arrowY - arrowLen / 2} L ${x + arrowLen / 2 - head} ${arrowY - arrowLen / 2 + head * 0.6} M ${x + arrowLen / 2} ${arrowY - arrowLen / 2} L ${x + arrowLen / 2 - head * 0.6} ${arrowY - arrowLen / 2 + head}`} />
              </g>
            );
          }
          return (
            <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1={x + arrowLen / 2} y1={arrowY + arrowLen / 2} x2={x - arrowLen / 2} y2={arrowY - arrowLen / 2} />
              <path d={`M ${x - arrowLen / 2} ${arrowY - arrowLen / 2} L ${x - arrowLen / 2 + head} ${arrowY - arrowLen / 2 + head * 0.6} M ${x - arrowLen / 2} ${arrowY - arrowLen / 2} L ${x - arrowLen / 2 + head * 0.6} ${arrowY - arrowLen / 2 + head}`} />
            </g>
          );
        })()}
        {/* Selection glow effect */}
        {isSelected && (
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
        )}
      </g>
    );
  };

  const beatsPerMeasure = timeSignature.beats;
  const getSystemTotalBeats = (sys) => sys.measureIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
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
      const m = measures[sys.measureIndices[j]];
      const beatCount = m.beatCount ?? beatsPerMeasure;
      const mw = widths[j] ?? 80 * beatCount;
      const beatWidth = mw / beatCount;
      if (beatLeft < beatCount)
        return marginLeft + widths.slice(0, j).reduce((a, b) => a + b, 0) + (beatLeft + 0.5) * beatWidth;
      beatLeft -= beatCount;
    }
    const j = Math.max(0, sys.measureIndices.length - 1);
    return marginLeft + widths.slice(0, j + 1).reduce((a, b) => a + b, 0) - (widths[j] ?? 0) * 0.5;
  })() : null;

  return (
    <svg
      width="100%"
      height={totalHeight}
      className={`overflow-visible ${noteInputMode ? 'cursor-pointer' : ''}`}
      onClick={handleStaffClick}
    >
      <rect width="100%" height={totalHeight} fill="#fffbf0" pointerEvents={noteInputMode ? 'auto' : 'none'} />

      {systems.map((sys) => (
        <g key={sys.systemIndex}>
          {sys.pageBreakBefore && (
            <line x1={0} y1={sys.yOffset - PAGE_BREAK_GAP / 2} x2={pageWidth || LAYOUT.PAGE_WIDTH_MIN} y2={sys.yOffset - PAGE_BREAK_GAP / 2} stroke="#c4b896" strokeWidth={1} strokeDasharray="4 4" />
          )}
          {isFigurenotesMode ? (
            /* FIGURENOTES: drawRhythmGrid() – no staff, grid only */
            null
          ) : (
            /* TRADITIONAL: drawStaffLines() */
            <>
              {staffLinePositions.map((y, index) => (
                <line
                  key={`staff-${sys.systemIndex}-${index}`}
                  x1={0}
                  y1={sys.yOffset + y}
                  x2={marginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
                  y2={sys.yOffset + y}
                  stroke="#333"
                  strokeWidth="1.5"
                />
              ))}
              {isTabMode ? (
                <text x={18} y={sys.yOffset + centerY + 6} fontSize="14" fontWeight="bold" fill="#333">TAB</text>
              ) : staffLines === 5 ? (
                (() => {
                  const clefChar = clefType === 'treble' ? '𝄞' : clefType === 'bass' ? '𝄢' : '𝄡';
                  const clefX = 12;
                  const clefFontSize = 44;
                  const trebleGLine = staffLinePositions[3];
                  const bassFLine = staffLinePositions[1];
                  const clefY = clefType === 'treble' ? sys.yOffset + trebleGLine : clefType === 'bass' ? sys.yOffset + bassFLine : sys.yOffset + centerY;
                  return (
                    <text
                      x={clefX}
                      y={clefY}
                      fontSize={clefFontSize}
                      fontFamily="serif"
                      fill="#333"
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      {clefChar}
                    </text>
                  );
                })()
              ) : null}
            </>
          )}
          {/* Taktide numbrid: iga rea alguses noodivõtme kohal (traditsiooniline ja figuurnotatsioon) */}
          {showBarNumbers && sys.measureIndices.length > 0 && (
            <text
              x={20}
              y={sys.yOffset + (isFigurenotesMode ? 12 : staffLinePositions[0] - 14)}
              fontSize="14"
              fontWeight="bold"
              fill="#555"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              {sys.measureIndices[0] + 1}
            </text>
          )}

          {sys.systemIndex === 0 && (
            <g transform={`translate(0, ${sys.yOffset})`}>{renderTimeSignature()}</g>
          )}

          {/* Measures: FIGURENOTES = rhythm grid + thick bar lines; TRADITIONAL = thin bar lines only */}
          {sys.measureIndices.map((measureIdx, j) => {
            const measure = measures[measureIdx];
            const measureWidths = sys.measureWidths ?? sys.measureIndices.map(() => sys.measureWidth ?? timeSignature.beats * 80);
            const measureWidth = measureWidths[j] ?? (sys.measureWidth ?? timeSignature.beats * 80);
            const measureX = marginLeft + measureWidths.slice(0, j).reduce((a, b) => a + b, 0);
            const beatsInMeasure = measure.beatCount ?? timeSignature.beats;
            const beatWidth = measureWidth / beatsInMeasure;

            const getSlotsPerBeat = (beatIndex) => {
              const beatStart = measure.startBeat + beatIndex;
              const beatEnd = beatStart + 1;
              const notesInBeat = measure.notes.filter(n => n.beat >= beatStart && n.beat < beatEnd);
              if (notesInBeat.length === 0) return 1;
              const minDur = Math.min(...notesInBeat.map(n => n.duration));
              return Math.max(1, Math.round(1 / minDur));
            };

            const getNoteSlotCenterX = (note) => {
              const beatInMeasure = note.beat - measure.startBeat;
              const beatIndex = Math.floor(beatInMeasure);
              const posInBeat = beatInMeasure - beatIndex;
              const slotsPerBeat = getSlotsPerBeat(beatIndex);
              const slotIndex = Math.min(Math.floor(posInBeat * slotsPerBeat), slotsPerBeat - 1);
              const slotCenter = (slotIndex + 0.5) / slotsPerBeat;
              return measureX + (beatIndex + slotCenter) * beatWidth;
            };

            const getRestBoxWidth = (note) => {
              const beatInMeasure = note.beat - measure.startBeat;
              const beatIndex = Math.floor(beatInMeasure);
              const slotsPerBeat = getSlotsPerBeat(beatIndex);
              return beatWidth / slotsPerBeat;
            };

            return (
          <g key={measureIdx}>
            {isFigurenotesMode && (
              <>
                {Array.from({ length: Math.max(1, Math.ceil(beatsInMeasure)) }, (_, b) => {
                  const numBoxes = Math.max(1, Math.ceil(beatsInMeasure));
                  const boxWidth = measureWidth / numBoxes;
                  return (
                    <rect
                      key={`beat-${b}`}
                      x={measureX + b * boxWidth}
                      y={sys.yOffset + 10}
                      width={boxWidth}
                      height={timelineHeight - 20}
                      fill="transparent"
                      stroke={BEAT_BOX_STROKE}
                      strokeWidth="1"
                    />
                  );
                })}
              </>
            )}

            {/* Iga rea esimese takti ees taktijooni ei joonistata (traditsiooniline ja figuurnotatsioon) */}
            {j !== 0 && (
              <line x1={measureX} y1={sys.yOffset + (isFigurenotesMode ? 5 : staffLinePositions[0])} x2={measureX} y2={sys.yOffset + (isFigurenotesMode ? timelineHeight - 5 : staffLinePositions[staffLinePositions.length - 1])} stroke="#1a1a1a" strokeWidth={barLineWidth} />
            )}
            {measureIdx === sys.measureIndices[sys.measureIndices.length - 1] && (
              <line x1={measureX + measureWidth} y1={sys.yOffset + (isFigurenotesMode ? 5 : staffLinePositions[0])} x2={measureX + measureWidth} y2={sys.yOffset + (isFigurenotesMode ? timelineHeight - 5 : staffLinePositions[staffLinePositions.length - 1])} stroke="#1a1a1a" strokeWidth={barLineWidth} />
            )}

            {/* Akordid: traditsiooniline sümbol (ja valikuline figuurnotatsioon) noodijoonestiku või võrgu kohal */}
            {chords.filter(c => c.beatPosition >= measure.startBeat && c.beatPosition < measure.endBeat).map((chord) => {
              const chordX = measureX + (chord.beatPosition - measure.startBeat) * beatWidth;
              const chordY = sys.yOffset + (isFigurenotesMode ? 8 : staffLinePositions[0] - 18);
              return (
                <g key={chord.id}>
                  <text
                    x={chordX}
                    y={chordY}
                    textAnchor="start"
                    fontSize="14"
                    fontWeight="bold"
                    fill="#1a1a1a"
                    fontFamily="sans-serif"
                  >
                    {chord.chord}
                  </text>
                  {chord.figuredBass && (
                    <text
                      x={chordX}
                      y={chordY + 14}
                      textAnchor="start"
                      fontSize="11"
                      fill="#555"
                      fontFamily="serif"
                    >
                      {chord.figuredBass}
                    </text>
                  )}
                </g>
              );
            })}

            {measure.notes.map((note, noteIdx) => {
              const noteX = getNoteSlotCenterX(note);
              let globalNoteIndex = 0;
              for (let i = 0; i < measureIdx; i++) {
                globalNoteIndex += measures[i].notes.length;
              }
              globalNoteIndex += noteIdx;
              const pitchY = getPitchY(note.pitch, note.octave);
              const noteY = sys.yOffset + (notationMode === 'figurenotes' ? centerY : pitchY);
              const stemUp = pitchY > middleLineY;

              if (note.isRest) {
                if (isFigurenotesMode && !figurenotesStems) {
                  const boxW = getRestBoxWidth(note);
                  const zSize = Math.min(boxW * 0.55, 26);
                  return (
                    <g key={noteIdx}>
                      <text x={noteX} y={sys.yOffset + centerY + zSize * 0.2} textAnchor="middle" fontSize={zSize} fontWeight="bold" fill="#1a1a1a" fontFamily="serif">Z</text>
                    </g>
                  );
                }
                if (isFigurenotesMode && figurenotesStems) {
                  return (
                    <g key={noteIdx}>
                      {renderStandardRest(note, noteX, sys.yOffset + centerY)}
                    </g>
                  );
                }
                return (
                  <g key={noteIdx}>
                    {renderStandardRest(note, noteX, sys.yOffset + centerY)}
                  </g>
                );
              }

              if (isTabMode && tabTuning.length > 0) {
                const { stringIndex, fret } = pitchToTab(note.pitch, note.octave, tabTuning);
                const lineY = staffLinePositions[stringIndex];
                const isSelected = isNoteSelected(globalNoteIndex);
                return (
                  <g key={noteIdx}>
                    {isSelected && (
                      <rect x={noteX - 14} y={sys.yOffset + lineY - 12} width={28} height={24} fill="#93c5fd" opacity="0.3" rx="4" />
                    )}
                    <text x={noteX} y={sys.yOffset + lineY + 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1a1a1a">{fret}</text>
                  </g>
                );
              }

              if (notationMode === 'figurenotes') {
                const labelFontSize = Math.max(8, Math.round(figurenotesSize * 0.625));
                const dur = note.durationLabel || '1/4';
                const tailLen = (dur === '1/1') ? Math.max(20, figurenotesSize * 1.4) : (dur === '1/2') ? Math.max(12, figurenotesSize * 0.85) : 0;
                const labelY = noteY + figurenotesSize * 0.5 + labelFontSize + tailLen;
                return (
                  <g key={noteIdx}>
                    {renderFigurenote(note, noteX, noteY, globalNoteIndex)}
                    <text
                      x={noteX}
                      y={labelY}
                      textAnchor="middle"
                      fontSize={labelFontSize}
                      fill="#333"
                      fontWeight="bold"
                    >
                      {note.pitch}
                    </text>
                    {(note.lyric != null && String(note.lyric).trim() !== '') && (
                      <text
                        x={noteX}
                        y={labelY + 14}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#333"
                        fontFamily="sans-serif"
                      >
                        {note.lyric}
                      </text>
                    )}
                  </g>
                );
              } else if (notationMode === 'traditional') {
                const isSelected = isNoteSelected(globalNoteIndex);
                const noteheadRx = 7;
                const noteheadRy = 5;
                const stemX = stemUp ? noteX + noteheadRx : noteX - noteheadRx;
                const stemY2 = stemUp ? noteY - 32 : noteY + 32;
                const fingering = isFingeringMode ? getFingeringForNote(note.pitch, note.octave, instrument) : null;
                const fingerY = noteY + (stemUp ? 38 : 42);
                const ledgerHalfWidth = 14;
                // Traditsiooniline notatsioon: abijooned ainult JOONTE positsioonidel (samm = spacing), mitte iga pool sammu
                const lastLineY = staffLinePositions[staffLinePositions.length - 1];
                const firstLineY = staffLinePositions[0];
                const nLedgerAbove = staffLines === 5 && pitchY < firstLineY
                  ? Math.floor((firstLineY - pitchY) / spacing)
                  : 0;
                const nLedgerBelow = staffLines === 5 && pitchY > lastLineY
                  ? Math.floor((pitchY - lastLineY) / spacing)
                  : 0;
                return (
                  <g key={noteIdx}>
                    {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                      <line
                        key={`ledger-above-${i}`}
                        x1={noteX - ledgerHalfWidth}
                        y1={sys.yOffset + firstLineY - (i + 1) * spacing}
                        x2={noteX + ledgerHalfWidth}
                        y2={sys.yOffset + firstLineY - (i + 1) * spacing}
                        stroke="#333"
                        strokeWidth="1.5"
                      />
                    ))}
                    {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                      <line
                        key={`ledger-below-${i}`}
                        x1={noteX - ledgerHalfWidth}
                        y1={sys.yOffset + lastLineY + (i + 1) * spacing}
                        x2={noteX + ledgerHalfWidth}
                        y2={sys.yOffset + lastLineY + (i + 1) * spacing}
                        stroke="#333"
                        strokeWidth="1.5"
                      />
                    ))}
                    {isSelected && (
                      <rect
                        x={noteX - 18}
                        y={noteY - 22}
                        width={36}
                        height={fingering ? 62 : 44}
                        fill="#93c5fd"
                        opacity="0.3"
                        rx="4"
                      />
                    )}
                    <ellipse 
                      cx={noteX} 
                      cy={noteY} 
                      rx={noteheadRx} 
                      ry={noteheadRy} 
                      fill="#1a1a1a"
                      stroke={isSelected ? "#2563eb" : "none"}
                      strokeWidth={isSelected ? "2" : "0"}
                    />
                    <line 
                      x1={stemX} 
                      y1={noteY} 
                      x2={stemX} 
                      y2={stemY2} 
                      stroke="#1a1a1a" 
                      strokeWidth="1.5" 
                    />
                    {fingering && fingering.length > 0 && (
                      <g transform={`translate(${noteX - (fingering.length * 5)}, ${fingerY})`}>
                        {fingering.map((closed, i) => (
                          <circle key={i} cx={i * 10 + 5} cy={0} r={4} fill={closed ? '#1a1a1a' : 'none'} stroke="#333" strokeWidth="1" />
                        ))}
                      </g>
                    )}
                    {(note.lyric != null && String(note.lyric).trim() !== '') && (
                      <text
                        x={noteX}
                        y={sys.yOffset + staffLinePositions[staffLinePositions.length - 1] + 18}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#333"
                        fontFamily="sans-serif"
                      >
                        {note.lyric}
                      </text>
                    )}
                  </g>
                );
              } else {
                const isSelected = isNoteSelected(globalNoteIndex);
                const stemX = stemUp ? noteX + 10 : noteX - 10;
                const stemY2 = stemUp ? noteY - 28 : noteY + 28;
                return (
                  <g key={noteIdx}>
                    {isSelected && (
                      <rect
                        x={noteX - 18}
                        y={noteY - 22}
                        width={36}
                        height={44}
                        fill="#93c5fd"
                        opacity="0.3"
                        rx="4"
                      />
                    )}
                    <circle
                      cx={noteX}
                      cy={noteY}
                      r="10"
                      fill="none"
                      stroke="#333"
                      strokeWidth="2"
                    />
                    <text
                      x={noteX}
                      y={noteY + 4}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="bold"
                      fill="#333"
                    >
                      {note.pitch}
                    </text>
                    <line 
                      x1={stemX} 
                      y1={noteY} 
                      x2={stemX} 
                      y2={stemY2} 
                      stroke="#333" 
                      strokeWidth="1.5" 
                    />
                  </g>
                );
              }
            })}
          </g>
            );
          })}

          {/* Final barline – only in TRADITIONAL (FIGURENOTES already has thick bar at measure end) */}
            {!isFigurenotesMode && (
            <line
              x1={marginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
              y1={sys.yOffset + staffLinePositions[0] - 5}
              x2={marginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
              y2={sys.yOffset + staffLinePositions[staffLinePositions.length - 1] + 5}
              stroke="#333"
              strokeWidth="2"
            />
          )}
        </g>
      ))}

      {/* Cursor + Ghost note (only visible when note input mode is ON) – slot center */}
      {noteInputMode && cursorInfo && cursorSlotCenterX != null && (
        <g>
          <line
            x1={cursorSlotCenterX}
            y1={cursorInfo.system.yOffset + 5}
            x2={cursorSlotCenterX}
            y2={cursorInfo.system.yOffset + timelineHeight - 5}
            stroke="#2563eb"
            strokeWidth="3"
            opacity="0.8"
          >
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
          </line>
          {isRest ? (
            isFigurenotesMode
              ? (() => {
                  const sys = cursorInfo.system;
                  const widths = sys.measureWidths ?? [sys.measureWidth ?? timeSignature.beats * 80];
                  const beatW = (widths[0] ?? sys.measureWidth) / (timeSignature.beats || 1);
                  const zSize = Math.min(beatW * 0.55, 26);
                  return <text x={cursorSlotCenterX} y={cursorInfo.system.yOffset + centerY + zSize * 0.2} textAnchor="middle" fontSize={zSize} fontWeight="bold" fill="#dc2626" fontFamily="serif">Z</text>;
                })()
              : (() => {
                  const restY = cursorInfo.system.yOffset + centerY;
                  const x = cursorSlotCenterX;
                  const scale = 0.9;
                  const w = 8 * scale, h = 3 * scale;
                  const dur = (typeof selectedDuration === 'string' ? selectedDuration : null) || '1/4';
                  if (dur === '1/1' || dur === '1/2') return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#dc2626"/>;
                  if (dur === '1/4') return <path d={`M ${x} ${restY - 10} Q ${x + 6} ${restY - 4} ${x} ${restY} Q ${x - 6} ${restY + 4} ${x} ${restY + 10}`} stroke="#dc2626" strokeWidth="1.8" fill="none"/>;
                  if (dur === '1/8') return <g stroke="#dc2626" fill="#dc2626"><circle cx={x} cy={restY - 4} r="2"/><path d={`M ${x} ${restY - 2} Q ${x - 6} ${restY} ${x} ${restY + 6}`} fill="none" strokeWidth="1.5"/></g>;
                  if (dur === '1/16') return <g stroke="#dc2626" fill="#dc2626"><circle cx={x} cy={restY - 6} r="1.8"/><circle cx={x} cy={restY} r="1.8"/><path d={`M ${x} ${restY + 2} Q ${x - 5} ${restY + 4} ${x} ${restY + 10}`} fill="none" strokeWidth="1.5"/></g>;
                  return <rect x={x - w/2} y={restY - h/2} width={w} height={h} fill="#dc2626"/>;
                })()
          ) : ghostPitch && ghostOctave ? (
            (() => {
              const cx = cursorSlotCenterX;
              const pitchY = getPitchY(ghostPitch, ghostOctave);
              const cy = cursorInfo.system.yOffset + (notationMode === 'figurenotes' ? centerY : pitchY);
              const stemUp = pitchY > middleLineY;
              if (notationMode === 'figurenotes') {
                const color = FIGURENOTES_COLORS[ghostPitch] || '#000';
                const shape = FIGURENOTES_SHAPES[ghostOctave] || 'circle';
                const size = figurenotesSize;
                const el = shape === 'square' ? <rect x={cx - size/2} y={cy - size/2} width={size} height={size} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9"/> :
                  shape === 'triangle' ? <path d={`M ${cx} ${cy - size*0.43} L ${cx + size/2} ${cy + size/2} L ${cx - size/2} ${cy + size/2} Z`} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9"/> :
                  <circle cx={cx} cy={cy} r={size/2} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9"/>;
                return <g opacity="0.9">{el}</g>;
              }
              if (notationMode === 'traditional') {
                const rx = 6; const ry = 4;
                const stemX = stemUp ? cx + rx : cx - rx;
                const stemY2 = stemUp ? cy - 28 : cy + 28;
                const ledgerHalfWidth = 14;
                const sysY = cursorInfo.system.yOffset;
                const firstLineY = staffLinePositions[0];
                const lastLineY = staffLinePositions[staffLinePositions.length - 1];
                const nLedgerAbove = staffLines === 5 && pitchY < firstLineY ? Math.floor((firstLineY - pitchY) / spacing) : 0;
                const nLedgerBelow = staffLines === 5 && pitchY > lastLineY ? Math.floor((pitchY - lastLineY) / spacing) : 0;
                return (
                  <g opacity="0.85">
                    {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                      <line key={`ghost-ledger-above-${i}`} x1={cx - ledgerHalfWidth} y1={sysY + firstLineY - (i + 1) * spacing} x2={cx + ledgerHalfWidth} y2={sysY + firstLineY - (i + 1) * spacing} stroke="#333" strokeWidth="1.5" />
                    ))}
                    {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                      <line key={`ghost-ledger-below-${i}`} x1={cx - ledgerHalfWidth} y1={sysY + lastLineY + (i + 1) * spacing} x2={cx + ledgerHalfWidth} y2={sysY + lastLineY + (i + 1) * spacing} stroke="#333" strokeWidth="1.5" />
                    ))}
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#1a1a1a" stroke="#2563eb" strokeWidth="2"/>
                    <line x1={stemX} y1={cy} x2={stemX} y2={stemY2} stroke="#1a1a1a" strokeWidth="1.5"/>
                  </g>
                );
              }
              const stemX = stemUp ? cx + 10 : cx - 10;
              const stemY2 = stemUp ? cy - 24 : cy + 24;
              return <g opacity="0.85"><circle cx={cx} cy={cy} r="9" fill="none" stroke="#333"/><text x={cx} y={cy+3} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#333">{ghostPitch}</text><line x1={stemX} y1={cy} x2={stemX} y2={stemY2} stroke="#333" strokeWidth="1.5"/></g>;
            })()
          ) : (
            <circle cx={cursorSlotCenterX} cy={cursorInfo.system.yOffset + centerY} r="6" fill="#2563eb" stroke="white" strokeWidth="2">
              <animate attributeName="r" values="6;8;6" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
          {isDotted && !isRest && ghostPitch && (
            <circle cx={cursorSlotCenterX + 12} cy={cursorInfo.system.yOffset + (notationMode === 'figurenotes' ? centerY : getPitchY(ghostPitch, ghostOctave))} r="3" fill="#f59e0b" stroke="white" strokeWidth="1">
              <animate attributeName="opacity" values="1;0.5;1" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      )}
    </svg>
  );
}

function NoodiMeister() {
  const [icons, setIcons] = useState(null);
  useEffect(() => {
    import('lucide-react').then((mod) => {
      const obj = {};
      LUCIDE_ICONS.forEach((name) => { obj[name] = mod[name]; });
      setIcons(obj);
    });
  }, []);
  return <NoodiMeisterCore icons={icons} />;
}

export default NoodiMeister;