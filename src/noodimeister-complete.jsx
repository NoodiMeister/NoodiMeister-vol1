// Version 1.0.5 - Final Graphics Fix
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { InteractivePiano } from './piano';
import * as googleDrive from './services/googleDrive';
import * as oneDrive from './services/oneDrive';
import * as authStorage from './services/authStorage';
import { JoClefSymbol, TrebleClefSymbol, BassClefSymbol } from './components/ClefSymbols';
import { AppLogo } from './components/AppLogo';
import { NoteHead } from './components/NoteHead';
import { NoteSymbol } from './notation/NoteSymbols';
import {
  STAFF_SPACE,
  getStaffLinePositions as getStaffLinePositionsFromConstants,
  getVerticalPosition,
  getLedgerLineCountExact,
  getNoteheadRx,
  getNoteheadRy,
  getLedgerHalfWidth,
  getTonicStaffPosition,
  getKeyFromStaffPosition,
  getYFromStaffPosition,
  getVerticalPositionFromJoAnchor,
  getPitchFromJoClick,
} from './notation/StaffConstants';
import { getRhythmSyllableForNote } from './notation/rhythmSyllables';
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
} from './utils/notationConstants';
import { FIGURENOTES_COLORS, getFigureSymbol } from './utils/figurenotes';
import { getOctave2CrossStyle } from './constants/FigureNotesLibrary';
import { getPedagogicalSymbol } from './notation/PedagogicalLogic';
import { FigurenotesBlockIcon, RhythmIcon, RhythmPatternIcon } from './toolboxes';
import { SmuflGlyph } from './notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH, NOTEHEAD_SHAPE_GLYPH } from './notation/smufl/glyphs';
import { FigurenotesView } from './views/FigurenotesView';
import { TraditionalNotationView } from './views/TraditionalNotationView';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, createT } from './i18n';
import { computeLayout, getStaffHeight, LAYOUT, PAGE_BREAK_GAP } from './layout/LayoutManager';
import { FIGURE_BASE_WIDTH, FIGURE_ROW_HEIGHT, calculateLayout } from './layout/LayoutEngine';
import { transposeNotes } from './musical/transpose';
import { useNoodimeisterOptional } from './store/NoodimeisterContext';
import { useNotationOptional } from './store/NotationContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Soundfont from 'soundfont-player';

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
var DEMO_MAX_BEATS = 8;
var DEMO_MAX_MEASURES = 2;
var KEY_ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb'];

// Graafika ja app konstandid var'iga faili alguses (GLOBAL_NOTATION_CONFIG on noodijoonestiku seaded)
var LUCIDE_ICONS = [
  'Music2', 'Clock', 'Hash', 'Type', 'Piano', 'Palette', 'Layout', 'Check', 'Save', 'FolderOpen',
  'Plus', 'Settings', 'Key', 'Repeat', 'Cloud', 'LogOut', 'LogIn', 'UserPlus', 'User', 'CloudUpload', 'CloudDownload', 'FolderPlus', 'ChevronDown',
  'Play', 'Pause', 'Video', 'Eye', 'ArrowDown', 'ArrowRight', 'ArrowUpDown', 'X', 'Printer', 'FileDown',
  'Hand', 'MousePointer'
];
var STORAGE_KEY = 'noodimeister-data';
var THEME_STORAGE_KEY = 'noodimeister-theme';

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
var PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };

// Joonestiku/instrumentide konstandid var'iga faili alguses
var INSTRUMENT_CATEGORIES = [
  { id: 'singleStaff', labelKey: 'cat.singleStaff', instruments: ['single-staff-treble', 'single-staff-bass'] },
  { id: 'keyboard', labelKey: 'cat.keyboard', instruments: ['piano', 'organ', 'harpsichord', 'accordion'] },
  { id: 'stringsPlucked', labelKey: 'cat.stringsPlucked', instruments: ['guitar', 'ukulele-sopran', 'ukulele-tenor', 'ukulele-bariton', 'ukulele-bass'] },
  { id: 'stringsBowed', labelKey: 'cat.stringsBowed', instruments: ['violin', 'viola', 'cello', 'double-bass'] },
  { id: 'woodwinds', labelKey: 'cat.woodwinds', instruments: ['flute', 'recorder', 'clarinet', 'oboe', 'bassoon'] },
  { id: 'brass', labelKey: 'cat.brass', instruments: ['trumpet', 'trombone', 'tuba', 'french-horn'] },
  { id: 'nonOrchestral', labelKey: 'cat.nonOrchestral', instruments: ['tin-whistle', 'saxophone'] },
  { id: 'other', labelKey: 'cat.other', instruments: ['voice'] }
];
var INSTRUMENT_CONFIG_BASE = {
  'single-staff-treble': { value: 'single-staff-treble', range: 'E3-A7', type: 'standard', defaultClef: 'treble' },
  'single-staff-bass':   { value: 'single-staff-bass', range: 'E2-G4', type: 'standard', defaultClef: 'bass' },
  organ:      { value: 'organ', range: 'C2-C6', type: 'figuredBass', defaultClef: 'treble' },
  harpsichord:{ value: 'harpsichord', range: 'F1-F6', type: 'figuredBass', defaultClef: 'treble' },
  accordion:  { value: 'accordion', range: 'F3-C6', type: 'accordion', defaultClef: 'treble' },
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
  flute:      { value: 'flute', range: 'C4-C7', type: 'wind', fingering: true, defaultClef: 'treble' },
  recorder:   { value: 'recorder', range: 'C5-D6', type: 'wind', fingering: true, defaultClef: 'treble' },
  clarinet:   { value: 'clarinet', range: 'E3-G6', type: 'wind', fingering: true, defaultClef: 'treble' },
  oboe:       { value: 'oboe', range: 'Bb3-A6', type: 'wind', fingering: true, defaultClef: 'treble' },
  bassoon:    { value: 'bassoon', range: 'Bb1-E5', type: 'wind', fingering: true, defaultClef: 'bass' },
  trumpet:    { value: 'trumpet', range: 'F#3-E6', type: 'standard', defaultClef: 'treble' },
  trombone:   { value: 'trombone', range: 'E2-F5', type: 'standard', defaultClef: 'bass' },
  tuba:       { value: 'tuba', range: 'D1-F4', type: 'standard', defaultClef: 'bass' },
  'french-horn': { value: 'french-horn', range: 'B1-F5', type: 'standard', defaultClef: 'treble' },
  'tin-whistle': { value: 'tin-whistle', range: 'D5-C#7', type: 'wind', fingering: true, defaultClef: 'treble' },
  saxophone:  { value: 'saxophone', range: 'Bb2-F5', type: 'wind', fingering: true, defaultClef: 'treble' },
  voice:      { value: 'voice', range: 'C3-C6', type: 'standard', defaultClef: 'treble' }
};
var INSTRUMENT_I18N_KEYS = {
  'single-staff-treble': 'inst.singleStaffTreble', 'single-staff-bass': 'inst.singleStaffBass',
  organ: 'inst.organ', harpsichord: 'inst.harpsichord', accordion: 'inst.accordion', piano: 'inst.piano',
  guitar: 'inst.guitar', 'ukulele-sopran': 'inst.ukuleleSopran', 'ukulele-tenor': 'inst.ukuleleTenor',
  'ukulele-bariton': 'inst.ukuleleBariton', 'ukulele-bass': 'inst.ukuleleBass',
  violin: 'inst.violin', viola: 'inst.viola', cello: 'inst.cello', 'double-bass': 'inst.doubleBass',
  flute: 'inst.flute', recorder: 'inst.recorder', clarinet: 'inst.clarinet', oboe: 'inst.oboe', bassoon: 'inst.bassoon',
  trumpet: 'inst.trumpet', trombone: 'inst.trombone', tuba: 'inst.tuba', 'french-horn': 'inst.frenchHorn',
  'tin-whistle': 'inst.tinWhistle', saxophone: 'inst.saxophone', voice: 'inst.voice'
};
var INSTRUMENT_TO_GM_PROGRAM = {
  'single-staff-treble': 0, 'single-staff-bass': 0,
  piano: 0, organ: 19, harpsichord: 6, accordion: 21,
  guitar: 24, 'ukulele-sopran': 24, 'ukulele-tenor': 24, 'ukulele-bariton': 24, 'ukulele-bass': 32,
  violin: 40, viola: 41, cello: 42, 'double-bass': 43,
  flute: 73, recorder: 74, clarinet: 71, oboe: 68, bassoon: 70,
  trumpet: 56, trombone: 57, tuba: 58, 'french-horn': 60,
  'tin-whistle': 75, saxophone: 65, voice: 52
};
var INSTRUMENT_TO_SOUNDFONT_NAME = {
  'single-staff-treble': 'acoustic_grand_piano', 'single-staff-bass': 'acoustic_grand_piano',
  piano: 'acoustic_grand_piano', organ: 'church_organ', harpsichord: 'harpsichord', accordion: 'accordion',
  guitar: 'acoustic_guitar_nylon', 'ukulele-sopran': 'acoustic_guitar_nylon', 'ukulele-tenor': 'acoustic_guitar_nylon', 'ukulele-bariton': 'acoustic_guitar_nylon', 'ukulele-bass': 'acoustic_bass',
  violin: 'violin', viola: 'viola', cello: 'cello', 'double-bass': 'contrabass',
  flute: 'flute', recorder: 'recorder', clarinet: 'clarinet', oboe: 'oboe', bassoon: 'bassoon',
  trumpet: 'trumpet', trombone: 'trombone', tuba: 'tuba', 'french-horn': 'french_horn',
  'tin-whistle': 'whistle', saxophone: 'alto_sax', voice: 'choir_aahs'
};

// Noodivõtmete SVG path-id (var faili alguses – TDZ/vältimine)
var TREBLE_CLEF_PATH = 'M14 2v2c0 2-1 4-3 5-2 1-4 1-5 0-1-1-1-3 0-4 1-1 2-2 2-3 1-2-1-2-3 0-4 2-1 4-1 6 0 2 1 3 2 4 3 1 2 2 3 2 5 0 2-1 4-3 5-2 1-4 1-6-1-2-2-2-5 0-7 2-2 4-2 7 0 3 2 4 4 4 7 0 2-2 4-4 5-2 1-4 0-5-2-1-2-1-4 0-6 1-2 3-2 5 0 2 2 3 4 3 6 0 1-1 2-2 2-3 0-1-1-1-2 0-2 1 0 2 0 3-1 1-1 2-2 2-4 0-2-1-3-2-4-1-1-3-1-4 0-1 1-1 2 0 3 1 1 2 1 3 0 1-1 2-1 3 0 1 1 2 1 3 0';
var BASS_CLEF_PATH = 'M8 4c0 2 1 3 2 3 1 0 2-1 2-3 0-2-1-3-2-3-1 0-2 1-2 3zm8 0c0 2 1 3 2 3 1 0 2-1 2-3 0-2-1-3-2-3-1 0-2 1-2 3zm-10 4v12c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2-1 0-2 1-2 2zm12 0v12c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2-1 0-2 1-2 2zM10 6c-1 0-2 1-2 2v8c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2zm4 0c-1 0-2 1-2 2v8c0 1 1 2 2 2 1 0 2-1 2-2V8c0-1-1-2-2-2z';
var ALTO_TENOR_CLEF_PATH = 'M8 4c-2 0-4 2-4 5s2 5 4 5 4-2 4-5-2-5-4-5zm0 6c-1 0-2-1-2-1 0 0 1-1 2-1s2 1 2 1c0 0-1 1-2 1zm8-6c2 0 4 2 4 5s-2 5-4 5-4-2-4-5 2-5 4-5zm0 6c1 0 2-1 2-1 0 0-1-1-2-1s-2 1-2 1c0 0 1 1 2 1z';

// Rütmipatternite ikoonid (JSX) – var faili alguses
var RHYTHM_PATTERN_ICONS = {
  '2/8': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <ellipse cx="6" cy="17" rx="2.2" ry="1.8" fill="currentColor"/><ellipse cx="18" cy="17" rx="2.2" ry="1.8" fill="currentColor"/>
      <line x1="7.5" y1="17" x2="7.5" y2="5" strokeWidth="1.2"/><line x1="16.5" y1="17" x2="16.5" y2="5" strokeWidth="1.2"/>
      <line x1="5" y1="5" x2="19" y2="5" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  '4/16': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      {[4, 8, 14, 20].map((cx, i) => <ellipse key={i} cx={cx} cy="17" rx="1.8" ry="1.5" fill="currentColor"/>)}
      {[5, 11, 17, 23].map((x, i) => <line key={i} x1={x} y1="17" x2={x} y2="3" strokeWidth="1.1"/>)}
      <line x1="3" y1="3" x2="21" y2="3" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="3" y1="4.5" x2="21" y2="4.5" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  '8/16': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1">
      {[2.5, 5.5, 8.5, 11.5, 14.5, 17.5, 20.5, 23.5].map((cx, i) => <ellipse key={i} cx={cx} cy="17" rx="1.4" ry="1.2" fill="currentColor"/>)}
      {[3.5, 6.5, 9.5, 12.5, 15.5, 18.5, 21.5].map((x, i) => <line key={i} x1={x} y1="17" x2={x} y2="2" strokeWidth="1"/>)}
      <line x1="1" y1="2" x2="23" y2="2" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="1" y1="3.5" x2="23" y2="3.5" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  ),
  '1/8+2/16': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="2.2" ry="1.8" fill="currentColor"/><ellipse cx="12" cy="17" rx="1.8" ry="1.5" fill="currentColor"/><ellipse cx="19" cy="17" rx="1.8" ry="1.5" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="5" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="3" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="3" strokeWidth="1.1"/>
      <line x1="4" y1="5" x2="20" y2="5" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="10" y1="3" x2="19" y2="3" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  '2/16+1/8': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="1.8" ry="1.5" fill="currentColor"/><ellipse cx="12" cy="17" rx="1.8" ry="1.5" fill="currentColor"/><ellipse cx="19" cy="17" rx="2.2" ry="1.8" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="3" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="3" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="5" strokeWidth="1.1"/>
      <line x1="4" y1="3" x2="20" y2="3" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="5" y1="5" x2="19" y2="5" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  'triplet': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="2" ry="1.6" fill="currentColor"/><ellipse cx="12" cy="17" rx="2" ry="1.6" fill="currentColor"/><ellipse cx="19" cy="17" rx="2" ry="1.6" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="5" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="5" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="5" strokeWidth="1.1"/>
      <line x1="4" y1="5" x2="20" y2="5" strokeWidth="1.3" strokeLinecap="round"/>
      <text x="12" y="2" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor">3</text>
    </svg>
  ),
  'triplet-8': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="2" ry="1.6" fill="currentColor"/><ellipse cx="12" cy="17" rx="2" ry="1.6" fill="currentColor"/><ellipse cx="19" cy="17" rx="2" ry="1.6" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="5" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="5" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="5" strokeWidth="1.1"/>
      <line x1="4" y1="5" x2="20" y2="5" strokeWidth="1.3" strokeLinecap="round"/>
      <text x="12" y="2" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor">3</text>
    </svg>
  ),
  'triplet-4': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="2.2" ry="1.8" fill="currentColor"/><ellipse cx="12" cy="17" rx="2.2" ry="1.8" fill="currentColor"/><ellipse cx="19" cy="17" rx="2.2" ry="1.8" fill="currentColor"/>
      <line x1="7" y1="17" x2="7" y2="5" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="5" strokeWidth="1.1"/><line x1="17" y1="17" x2="17" y2="5" strokeWidth="1.1"/>
      <line x1="4" y1="5" x2="20" y2="5" strokeWidth="1.3" strokeLinecap="round"/>
      <text x="12" y="2" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor">3</text>
    </svg>
  )
};

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

var TEMPO_TERMS = [
  { id: 'largo', key: 'tempo.largo', bpm: 40 },
  { id: 'adagio', key: 'tempo.adagio', bpm: 66 },
  { id: 'andante', key: 'tempo.andante', bpm: 76 },
  { id: 'moderato', key: 'tempo.moderato', bpm: 108 },
  { id: 'allegro', key: 'tempo.allegro', bpm: 120 },
  { id: 'vivace', key: 'tempo.vivace', bpm: 144 },
  { id: 'presto', key: 'tempo.presto', bpm: 168 }
];

var FINGERING_TIN_WHISTLE = {
  'D5': [1,1,1,1,1,1], 'E5': [0,1,1,1,1,1], 'F#5': [0,0,1,1,1,1], 'G5': [0,0,0,1,1,1], 'A5': [0,0,0,0,1,1], 'B5': [0,0,0,0,0,1], 'C#6': [0,0,0,0,0,0],
  'D6': [1,1,1,1,1,1], 'E6': [0,1,1,1,1,1], 'F#6': [0,0,1,1,1,1], 'G6': [0,0,0,1,1,1], 'A6': [0,0,0,0,1,1], 'B6': [0,0,0,0,0,1], 'C#7': [0,0,0,0,0,0]
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
function MeterIcon(props) {
  var beats = props.beats, beatUnit = props.beatUnit;
  return (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <text x="12" y="10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
    <text x="12" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beatUnit}</text>
  </svg>
  );
}

// Pedagogical Time Signature Component - shows note symbol for denominator
function PedagogicalMeterIcon(props) {
  var beats = props.beats, beatUnit = props.beatUnit;
  function getNoteSymbol() {
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
}

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
function getToolboxes(t, instrumentConfig) {
  return {
    rhythm: {
      id: 'rhythm', name: t('toolbox.rhythm'), icon: 'Clock', shortcut: 'Shift+1',
      options: [
        { id: '1/32', label: t('note.thirtySecond'), value: '1/32', key: '2', code: 'Digit2' },
        { id: '1/16', label: t('note.sixteenth'), value: '1/16', key: '3', code: 'Digit3' },
        { id: '1/8', label: t('note.eighth'), value: '1/8', key: '4', code: 'Digit4' },
        { id: '1/4', label: t('note.quarter'), value: '1/4', key: '5', code: 'Digit5' },
        { id: '1/2', label: t('note.half'), value: '1/2', key: '6', code: 'Digit6' },
        { id: '1/1', label: t('note.whole'), value: '1/1', key: '7', code: 'Digit7' },
        { id: '2/8', label: t('note.pattern2eighth'), value: '2/8', key: null, code: null },
        { id: '4/16', label: t('note.pattern4sixteenth'), value: '4/16', key: null, code: null },
        { id: '8/16', label: t('note.pattern8sixteenth'), value: '8/16', key: null, code: null },
        { id: '1/8+2/16', label: t('note.patternEighthTwoSixteenth'), value: '1/8+2/16', key: null, code: null },
        { id: '2/16+1/8', label: t('note.patternTwoSixteenthEighth'), value: '2/16+1/8', key: null, code: null },
        { id: 'triplet-8', label: t('note.tripletEighth'), value: 'triplet-8', key: null, code: null },
        { id: 'triplet-4', label: t('note.tripletQuarter'), value: 'triplet-4', key: null, code: null },
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
        { id: 'jo', label: t('clef.jo'), value: 'jo', key: '0' },
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
    transpose: {
      id: 'transpose', name: t('toolbox.transpose'), icon: 'ArrowUpDown', shortcut: 'Shift+9',
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
        { id: 'solfege', label: t('notehead.solfege'), value: 'vabanotatsioon', key: '3' },
        { id: 'shape-oval', label: t('notehead.shapeOval'), value: 'shape:oval', key: null },
        { id: 'shape-x', label: t('notehead.shapeX'), value: 'shape:x', key: null },
        { id: 'shape-square', label: t('notehead.shapeSquare'), value: 'shape:square', key: null },
        { id: 'shape-triangle', label: t('notehead.shapeTriangle'), value: 'shape:triangle', key: null },
        { id: 'shape-emoji', label: t('notehead.shapeEmoji'), value: 'shape:emoji', key: null }
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
        { id: 'spacing-normal', label: t('layout.spacingNormal'), value: 75, key: '3' },
        { id: 'spacing-loose', label: t('layout.spacingLoose'), value: 120, key: '4' }
      ]
    },
    textBox: {
      id: 'textBox', name: t('toolbox.textBox'), icon: 'Type', shortcut: 'Shift+T',
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
// FINGERING_TIN_WHISTLE, FINGERING_RECORDER on faili alguses var'iga
function NoodiMeisterCore({ icons }) {
  if (typeof GLOBAL_NOTATION_CONFIG === 'undefined' || !GLOBAL_NOTATION_CONFIG || GLOBAL_NOTATION_CONFIG.EMOJIS === undefined) return null;

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
  const toolboxes = useMemo(() => getToolboxes(t, instrumentConfig), [t, instrumentConfig]);

  const store = useNoodimeisterOptional();
  const hasFullAccess = store?.hasFullAccess ?? authStorage.isLoggedIn();

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
  const [selectedDuration, setSelectedDuration] = useState('1/4');
  // Tuplet mode: null = normal; { type: 3|5|6|7, inSpaceOf: 2|4 } – triool 3 in 2, kvintool 5 in 4, jne. Aktiveeritakse Cmd/Ctrl+3,5,6,7
  const [tupletMode, setTupletMode] = useState(null);
  const [timeSignature, setTimeSignature] = useState({ beats: 4, beatUnit: 4 });
  const [pixelsPerBeat, setPixelsPerBeat] = useState(75); // laius löögi kohta (px), vaikimisi 75 (vastab noodigraafika vaikimisi suurusele)
  const [cursorPosition, setCursorPosition] = useState(3);
  const [keySignature, setKeySignature] = useState('C');
  const [staffLines, setStaffLines] = useState(5);
  const [notationStyle, setNotationStyle] = useState('TRADITIONAL'); // 'TRADITIONAL' | 'FIGURENOTES' – staff vs grid
  const [instrumentNotationVariant, setInstrumentNotationVariant] = useState('standard'); // 'standard' | 'tab' | 'fingering'
  const [isRest, setIsRest] = useState(false);
  const [isDotted, setIsDotted] = useState(false);
  const [ghostPitch, setGhostPitch] = useState('C');
  const [ghostOctave, setGhostOctave] = useState(4);
  const [ghostAccidental, setGhostAccidental] = useState(0); // 0 = natural, 1 = sharp, -1 = flat (for next note / display)
  const [activeToolbox, setActiveToolbox] = useState(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
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
  const [timeSignatureSize, setTimeSignatureSize] = useState(16); // Time signature font size in figurenotation (12–48), one value per project

  // Stage V: Selection and editing state
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1);
  const [selectionStart, setSelectionStart] = useState(-1);
  const [selectionEnd, setSelectionEnd] = useState(-1);
  const [clipboard, setClipboard] = useState([]);
  const [clipboardHistory, setClipboardHistory] = useState([]); // [{ id, notes, createdAt }]
  const [clipboardHistoryOpen, setClipboardHistoryOpen] = useState(false);
  // Laulusõna ahelrežiim: valitud noodist alates järjest silbitamine; "-" lisab tühiku ja liigub järgmise noodi alla
  const [lyricChainStart, setLyricChainStart] = useState(-1);
  const [lyricChainEnd, setLyricChainEnd] = useState(-1);
  const [lyricChainIndex, setLyricChainIndex] = useState(null); // null = tavarežiim (näita valitud noodi laulusõna)
  /** Which lyric line is being edited: 0 = first (lyric), 1 = second (lyric2). Ctrl+L starts from selected note for current line. */
  const [lyricLineIndex, setLyricLineIndex] = useState(0);
  /** Vertical offset (px) for lyrics line – drag or adjust to move lyrics up/down. */
  const [lyricLineYOffset, setLyricLineYOffset] = useState(0);
  const lyricInputRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const saveToHistoryRef = useRef(null);

  // Rütmi viimane väärtus (ref), et kohe pärast rütmi valimist lisatud noot kasutaks uut rütmi
  const lastDurationRef = useRef(selectedDuration);
  // Pausi sisestus: 0 + rütmiklahv (2–7) → paus vastava vältusega
  const restNextRef = useRef(false);
  useEffect(() => {
    lastDurationRef.current = selectedDuration;
  }, [selectedDuration]);

  // N-režiim (noodisisestus): ref, et figuurenotatsiooni löögiklikk ei lisaks nooti, kui kasutaja on SEL-režiimis
  const noteInputModeRef = useRef(noteInputMode);
  useEffect(() => {
    noteInputModeRef.current = noteInputMode;
  }, [noteInputMode]);

  // Kui valik muutub, lõpeta laulusõna ahelrežiim (välja väärtus vastab taas valitud noodi(de) laulusõnale)
  useEffect(() => {
    setLyricChainIndex(null);
  }, [selectedNoteIndex, selectionStart, selectionEnd]);

  // Paigutus: lehekülje suund, taktide arv rea kohta (0 = automaatne), käsitsi rea- ja lehevahetused
  const [pageOrientation, setPageOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  /** Paper size for print and PDF: A4, A3, or A5. Page setup determines printable view. */
  const [paperSize, setPaperSize] = useState('a4'); // 'a4' | 'a3' | 'a5'
  const [layoutMeasuresPerLine, setLayoutMeasuresPerLine] = useState(4);
  const [layoutLineBreakBefore, setLayoutLineBreakBefore] = useState([]);
  const [measureStretchFactors, setMeasureStretchFactors] = useState([]);
  const [systemYOffsets, setSystemYOffsets] = useState([]);
  const [layoutPageBreakBefore, setLayoutPageBreakBefore] = useState([]);
  const [layoutSystemGap, setLayoutSystemGap] = useState(15); // noodiridade vahe / staff lines gap (px) – vahe süsteemide vahel
  const [layoutPartsGap, setLayoutPartsGap] = useState(10); // instrumentide vahe / parts gap (px) – vahe kahe partii vahel
  const [layoutConnectedBarlines, setLayoutConnectedBarlines] = useState(true); // ühendatud taktijooned partituuris
  const [layoutGlobalSpacingMultiplier, setLayoutGlobalSpacingMultiplier] = useState(1.0); // takti laius / noodigraafika tihedus (0.5–2)
  // Vaade: partituur vs instrumendi part – instrumendi paigutus on sõltumatu partituurist
  const [viewMode, setViewMode] = useState('score'); // 'score' | 'part'
  const [partLayoutMeasuresPerLine, setPartLayoutMeasuresPerLine] = useState(4);
  const [partLayoutLineBreakBefore, setPartLayoutLineBreakBefore] = useState([]);
  const [partLayoutPageBreakBefore, setPartLayoutPageBreakBefore] = useState([]);
  const [showPageNavigator, setShowPageNavigator] = useState(false);
  /** When true, scale the score so one A4 page fits in the visible area (whole page layout on screen). */
  const [viewFitPage, setViewFitPage] = useState(false);
  const mainRef = useRef(null);
  const mainAreaRef = useRef(null); // used for fit-page scale calculation
  const lastVerticalContentHeightRef = useRef(0);
  const [mainScrollTop, setMainScrollTop] = useState(0);
  const [mainScrollLeft, setMainScrollLeft] = useState(0);
  const [mainContentHeight, setMainContentHeight] = useState(0);

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
  // Aktiivse rea noodid ja instrumendid (tuletatud staves[activeStaffIndex]-ist)
  const activeStaff = staves[activeStaffIndex];
  const notes = activeStaff?.notes ?? [];
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

  // Resolve explicit beat for each note (used by onNoteBeatChange and addNoteAtCursor; must be defined before first use).
  const notesWithExplicitBeatsEarly = useCallback((noteList) => {
    let runningBeat = 0;
    return (noteList || []).map((n) => {
      const beat = typeof n.beat === 'number' ? n.beat : runningBeat;
      runningBeat = beat + (n.duration ?? 1);
      return { ...n, beat };
    });
  }, []);

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
        const trebleStaff = { id: id1, instrumentId: 'piano', clefType: 'treble', notes: inBraceGroup ? prev[idx].notes : [], braceGroupId, notationMode: preservedMode };
        const bassStaff = { id: id2, instrumentId: 'piano', clefType: 'bass', notes: inBraceGroup ? prev[idx + 1].notes : [], braceGroupId, notationMode: preservedMode };
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
  }, [activeStaffIndex]);
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
  const [figurenotesSize, setFigurenotesSize] = useState(75); // Noodigraafika suurus (figuurid ja noodid), 12–500 px (vaikimisi 75)
  const [figurenotesStems, setFigurenotesStems] = useState(false); // Figuurnotatsioonis rütmi näitamine noodivartega (vaikimisi välja)
  const [figurenotesChordLineGap, setFigurenotesChordLineGap] = useState(6); // Akordirida figuurnotatsioonis: vahe meloodiareal ja akordirea vahel 0–20 px
  const [figurenotesChordBlocks, setFigurenotesChordBlocks] = useState(false); // Akordirežiim figuurnotatsioonis: värvilised akordiplokid akordireal

  // Hoia rütmiboksi (pixelsPerBeat) laius kooskõlas noodigraafika suurusega – magneetiline seos
  useEffect(() => {
    setPixelsPerBeat((prev) => {
      const target = Math.max(40, Math.min(500, figurenotesSize));
      return target;
    });
  }, [figurenotesSize]);
  const [showBarNumbers, setShowBarNumbers] = useState(true); // Taktide numbrid iga rea alguses noodivõtme kohal
  const [barNumberSize, setBarNumberSize] = useState(11); // Taktinumbri fondi suurus (8–24 px)
  const [showRhythmSyllables, setShowRhythmSyllables] = useState(DEFAULT_SHOW_RHYTHM_SYLLABLES);
  const [showAllNoteLabels, setShowAllNoteLabels] = useState(DEFAULT_SHOW_ALL_NOTE_LABELS);
  const [enableEmojiOverlays, setEnableEmojiOverlays] = useState(DEFAULT_SHOW_EMOJI_OVERLAYS);
  // Relatiivnotatsioon (Kodály): võtmemärk ja traditsiooniline noodivõti on valikulised; Do (Jo) võti on kohustuslik.
  const [relativeNotationShowKeySignature, setRelativeNotationShowKeySignature] = useState(false);
  const [relativeNotationShowTraditionalClef, setRelativeNotationShowTraditionalClef] = useState(false);
  const [chords, setChords] = useState([]); // { id, beatPosition, chord, figuredBass? } – traditsiooniline ja figuurnotatsioon
  const [customChordInput, setCustomChordInput] = useState('');
  const [customFiguredBassInput, setCustomFiguredBassInput] = useState('');
  // Teksti kasti plugin: vabalt paigutatavad laulutekstid, kommentaarid ja tempo märgid
  const [textBoxes, setTextBoxes] = useState([]); // { id, x, y, text, type?: 'text'|'tempo', tempoBpm?: number, fontSize?: number }
  const [selectedTextboxId, setSelectedTextboxId] = useState(null);
  const [textBoxDraftText, setTextBoxDraftText] = useState(''); // vaba tekst enne lisamist
  // Kordusmärgid ja hüpped (Leland SMuFL) – võtmeks takti indeks: repeatStart, repeatEnd, volta1, volta2, segno, coda
  const [measureRepeatMarks, setMeasureRepeatMarks] = useState({});
  const [textBoxTempoBpm, setTextBoxTempoBpm] = useState(''); // BPM tempo kasti jaoks
  // Fondid: dokumendi font (pealkiri, autor, teksti kastid) ja laulutekstide font (noodi all)
  const [documentFontFamily, setDocumentFontFamily] = useState('Georgia, serif');
  const [lyricFontFamily, setLyricFontFamily] = useState('sans-serif');
  // Active text line for floating text tool: 'title' | 'author' | 'textbox' | null (textbox uses selectedTextboxId)
  const [activeTextLineType, setActiveTextLineType] = useState(null);
  // Per-line font: title and author (only applied to chosen line)
  const [titleFontSize, setTitleFontSize] = useState(28);
  const [authorFontSize, setAuthorFontSize] = useState(14);
  const [titleFontFamily, setTitleFontFamily] = useState(''); // '' = use documentFontFamily
  const [authorFontFamily, setAuthorFontFamily] = useState('');
  const [titleBold, setTitleBold] = useState(false);
  const [titleItalic, setTitleItalic] = useState(false);
  const [authorBold, setAuthorBold] = useState(false);
  const [authorItalic, setAuthorItalic] = useState(false);
  const titleInputRef = useRef(null);
  const authorInputRef = useRef(null);
  const [textToolPosition, setTextToolPosition] = useState({ top: 0, left: 0 });
  // Pedagoogiline notatsioon: salvestatud heli animeerimine (kursor liigub heli järgi)
  const [pedagogicalAudioUrl, setPedagogicalAudioUrl] = useState(null); // object URL või null
  const [pedagogicalAudioBpm, setPedagogicalAudioBpm] = useState(120);
  const [pedagogicalAudioDuration, setPedagogicalAudioDuration] = useState(0); // sekundites
  const [isPedagogicalAudioPlaying, setIsPedagogicalAudioPlaying] = useState(false);
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
  const pedagogicalAudioRef = useRef(null); // HTMLAudioElement
  const pedagogicalPlaybackIntervalRef = useRef(null);
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
  const [pageDesignLayer, setPageDesignLayer] = useState('behind'); // 'behind' = background behind notation (default); 'inFront' = background covers notation
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveCloudDialogOpen, setSaveCloudDialogOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => getStoredTheme().mode);
  const [themePrimaryColor, setThemePrimaryColor] = useState(() => getStoredTheme().primaryColor);
  const themeColors = useMemo(() => {
    const isDark = themeMode === 'dark';
    return {
      staffLineColor: isDark ? '#ffffff' : '#000000',
      noteFill: isDark ? '#ffffff' : '#1a1a1a',
      textColor: isDark ? '#ffffff' : '#1a1a1a',
      scoreBg: isDark ? '#0a0a0a' : '#fffbf0',
      isDark,
    };
  }, [themeMode]);
  // Rippmenüüd tööriistaribal: 'file' | 'view' | null (Seaded on Faili all)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(null);
  const [fileSubmenuOpen, setFileSubmenuOpen] = useState(null); // 'seaded' | 'exportAnimation' | null
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
  const soundfontCacheRef = useRef(Object.create(null)); // instrumentId -> Soundfont player (MuseScore-style GM)
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNewWorkFlow = searchParams.get('new') === '1';
  const partStaffId = searchParams.get('staffId');
  const isPartWindow = !!partStaffId;
  const [newWorkSetupOpen, setNewWorkSetupOpen] = useState(false);
  // Uue töö seadistuse vormi väljad (küsitakse enne töö loomist)
  const [wizardNotationMethod, setWizardNotationMethod] = useState('traditional'); // 'traditional' | 'figurenotes' | 'vabanotatsioon' | 'pedagogical'
  const [wizardTimeSignature, setWizardTimeSignature] = useState([4, 4]);
  const [wizardSongTitle, setWizardSongTitle] = useState('');
  const [wizardAuthor, setWizardAuthor] = useState('');
  const [wizardInstrument, setWizardInstrument] = useState('single-staff-treble');
  const [wizardPickupEnabled, setWizardPickupEnabled] = useState(false);
  const [wizardPickupQuantity, setWizardPickupQuantity] = useState(1);
  const [wizardPickupDuration, setWizardPickupDuration] = useState('1/4');

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
    const pedagogical = wizardNotationMethod === 'pedagogical';
    setIsPedagogicalProject(pedagogical);
    // Pedagoogiline notatsioon kasutab JO/Do võtit (vabanotatsioon) ja võib näidata võtmemärki ning traditsioonilist võtit
    if (pedagogical) {
      setNotationMode('vabanotatsioon');
      setRelativeNotationShowKeySignature(true);
      setRelativeNotationShowTraditionalClef(true);
    } else {
      setNotationMode(wizardNotationMethod);
    }
    setNotationStyle(wizardNotationMethod === 'figurenotes' ? 'FIGURENOTES' : 'TRADITIONAL');
    setTimeSignature({ beats: wizardTimeSignature[0], beatUnit: wizardTimeSignature[1] });
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
    setHistory([]);
    setHistoryIndex(-1);
    setSetupCompleted(true);
    setNewWorkSetupOpen(false);
    // Stay on /app (openLocal=1) so AppOrRedirect does not send user back to /tood
    setSearchParams({ local: '1' });
    dirtyRef.current = true;
  }, [wizardNotationMethod, wizardTimeSignature, wizardSongTitle, wizardAuthor, wizardInstrument, wizardPickupEnabled, wizardPickupQuantity, wizardPickupDuration, instrumentConfig]);

  const isLoggedIn = () => authStorage.isLoggedIn();

  const addMeasure = useCallback(() => {
    if (!hasFullAccess) {
      setSaveFeedback(t('demo.maxMeasures'));
      setTimeout(() => setSaveFeedback(''), 3500);
      return;
    }
    dirtyRef.current = true;
    setAddedMeasures(prev => prev + 1);
  }, [hasFullAccess]);

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

  const beatsPerMeasureFromTimeSig = (ts) => {
    const beats = Number(ts?.beats) || 4;
    const beatUnit = Number(ts?.beatUnit) || 4;
    // Internal unit in this editor is quarter=1. MusicXML divisions are also per quarter.
    // Measure length in quarters = beats * (4/beatUnit). (If beatUnit is missing, defaults to 4/4.)
    return beats * (4 / beatUnit);
  };

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
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const txt = typeof reader.result === 'string' ? reader.result : '';
        const parsed = parseMusicXmlToOrchestration(txt, file?.name || '');
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
      } catch (err) {
        console.error(err);
        setSaveFeedback('MusicXML import ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 2200);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [notationMode, stopPedagogicalPlayback]);

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

  const handlePrint = useCallback(() => {
    setHeaderMenuOpen(null);
    window.print();
  }, []);

  const pdfExportOptionsRef = useRef({ pageFlowDirection: 'vertical', pageWidth: LAYOUT.PAGE_WIDTH_MIN });

  const exportToPdf = useCallback(async () => {
    const container = scoreContainerRef?.current;
    if (!container) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
      return;
    }
    setIsExportingPdf(true);
    setSaveFeedback('PDF…');
    setShowPageNavigator(true);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
      });
      const scale = 2;
      const { pageFlowDirection: flowDir, pageWidth: pw } = pdfExportOptionsRef.current;
      const isHorizontalFlow = flowDir === 'horizontal';
      const pdfOrientation = isHorizontalFlow ? 'landscape' : pageOrientation;
      const pdf = new jsPDF({
        orientation: pdfOrientation,
        unit: 'mm',
        format: paperSize,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      if (isHorizontalFlow) {
        const pageWidthPx = pw || LAYOUT.PAGE_WIDTH_MIN;
        const a4PageHeightPx = pageWidthPx * LAYOUT.A4_HEIGHT_RATIO;
        const totalPages = Math.max(1, Math.round(container.scrollWidth / pageWidthPx));
        for (let p = 0; p < totalPages; p++) {
          const srcX = p * pageWidthPx * scale;
          const sliceW = Math.round(pageWidthPx * scale);
          const sliceH = Math.round(a4PageHeightPx * scale);
          if (srcX + sliceW > canvas.width || sliceH > canvas.height) continue;
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = sliceW;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext('2d');
          ctx.drawImage(canvas, srcX, 0, sliceW, sliceH, 0, 0, sliceW, sliceH);
          const sliceData = sliceCanvas.toDataURL('image/png');
          const drawW = Math.min(pageW, pageH * (sliceW / sliceH));
          const drawH = Math.min(pageH, pageW * (sliceH / sliceW));
          if (p > 0) pdf.addPage(paperSize, pdfOrientation);
          pdf.addImage(sliceData, 'PNG', 0, 0, drawW, drawH);
        }
      } else {
        const systems = systemsForScoreRef.current || [];
        const pageStarts = [0, ...systems.filter((s) => s.pageBreakBefore).map((s) => s.yOffset)];
        const totalContentHeight = container.scrollHeight;
        if (pageStarts.length >= 2) {
          for (let p = 0; p < pageStarts.length; p++) {
            const startPx = pageStarts[p];
            const endPx = p < pageStarts.length - 1 ? pageStarts[p + 1] : totalContentHeight;
            const sliceHeightPx = endPx - startPx;
            if (sliceHeightPx <= 0) continue;
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.round(sliceHeightPx * scale);
            const ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, startPx * scale, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
            const sliceData = sliceCanvas.toDataURL('image/png');
            const sliceImgW = sliceCanvas.width;
            const sliceImgH = sliceCanvas.height;
            const drawW = Math.min(pageW, pageH * (sliceImgW / sliceImgH));
            const drawH = Math.min(pageH, pageW * (sliceImgH / sliceImgW));
            if (p > 0) pdf.addPage(paperSize, pdfOrientation);
            pdf.addImage(sliceData, 'PNG', 0, 0, drawW, drawH);
          }
        } else {
          const imgData = canvas.toDataURL('image/png');
          const imgW = pageW;
          const imgH = (canvas.height * imgW) / canvas.width;
          let heightLeft = imgH;
          let position = 0;
          pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0) {
            pdf.addPage(paperSize, pdfOrientation);
            position = -(pageH * (pdf.internal.getNumberOfPages() - 1));
            pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
            heightLeft -= pageH;
          }
        }
      }
      const filename = ((songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || 'score') + '.pdf';
      pdf.save(filename);
      setSaveFeedback('');
    } catch (e) {
      setSaveFeedback(t('feedback.exportFailed'));
      setTimeout(() => setSaveFeedback(''), 2000);
    } finally {
      setIsExportingPdf(false);
    }
  }, [songTitle, t, pageOrientation, paperSize]);

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
    cursorPosition,
    addedMeasures,
    measureRepeatMarks: Object.keys(measureRepeatMarks).length ? measureRepeatMarks : undefined,
    setupCompleted,
    songTitle,
    author,
    pickupEnabled,
    pickupQuantity,
    pickupDuration,
    pageOrientation,
    paperSize,
    layoutMeasuresPerLine,
    layoutLineBreakBefore,
    layoutPageBreakBefore,
    layoutSystemGap,
    layoutPartsGap,
    layoutConnectedBarlines,
    layoutGlobalSpacingMultiplier,
    viewMode,
    partLayoutMeasuresPerLine,
    partLayoutLineBreakBefore,
    partLayoutPageBreakBefore,
    showPageNavigator,
    pageFlowDirection,
    visibleToolIds,
    tuningReferenceNote,
    tuningReferenceOctave,
    tuningReferenceHz,
    playNoteOnInsert,
    figurenotesSize,
    figurenotesStems,
    figurenotesChordLineGap,
    figurenotesChordBlocks,
    timeSignatureSize,
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
    pageDesignDataUrl: pageDesignDataUrl || undefined,
    pageDesignOpacity,
    pageDesignFit,
    pageDesignLayer,
    visibleStaves: visibleStaves.length === staves.length ? visibleStaves : staves.map(() => true),
    intermissionLabels,
    lyricLineIndex,
    lyricLineYOffset,
    noteheadShape,
    noteheadEmoji
  }), [staves, activeStaffIndex, staffYOffsets, measureStretchFactors, systemYOffsets, visibleStaves, intermissionLabels, timeSignature, timeSignatureMode, keySignature, staffLines, notationStyle, pixelsPerBeat, notationMode, instrumentNotationVariant, cursorPosition, addedMeasures, measureRepeatMarks, setupCompleted, songTitle, author, pickupEnabled, pickupQuantity, pickupDuration, pageOrientation, paperSize, layoutMeasuresPerLine, layoutLineBreakBefore, layoutPageBreakBefore, layoutSystemGap, layoutPartsGap, layoutConnectedBarlines, layoutGlobalSpacingMultiplier, viewMode, partLayoutMeasuresPerLine, partLayoutLineBreakBefore, partLayoutPageBreakBefore, showPageNavigator, pageFlowDirection, visibleToolIds, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, figurenotesChordLineGap, figurenotesChordBlocks, timeSignatureSize, showBarNumbers, barNumberSize, showRhythmSyllables, showAllNoteLabels, enableEmojiOverlays, joClefStaffPosition, relativeNotationShowKeySignature, relativeNotationShowTraditionalClef, isPedagogicalProject, pedagogicalAudioBpm, pedagogicalAudioPlaybackRate, pedagogicalPlayheadStyle, pedagogicalPlayheadEmoji, pedagogicalPlayheadEmojiSize, cursorLineStrokeWidth, pedagogicalPlayheadMovement, chords, textBoxes, documentFontFamily, lyricFontFamily, titleFontSize, authorFontSize, titleFontFamily, authorFontFamily, titleBold, titleItalic, authorBold, authorItalic, pageDesignDataUrl, pageDesignOpacity, pageDesignFit, pageDesignLayer, lyricLineIndex, lyricLineYOffset, noteheadShape, noteheadEmoji]);

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
    isPedagogicalProject,
    timeSignature,
    timeSignatureMode,
    keySignature,
    staffLines,
    pixelsPerBeat,
    instrumentNotationVariant,
    pickupEnabled,
    pickupQuantity,
    pickupDuration,
    setupCompleted,
    cursorPosition,
    addedMeasures,
    pageOrientation,
    layoutMeasuresPerLine,
    layoutLineBreakBefore,
    layoutPageBreakBefore,
    layoutSystemGap,
    viewMode,
    partLayoutMeasuresPerLine,
    partLayoutLineBreakBefore,
    partLayoutPageBreakBefore,
    showPageNavigator,
    pageFlowDirection,
    visibleToolIds,
    tuningReferenceNote,
    tuningReferenceOctave,
    tuningReferenceHz,
    playNoteOnInsert,
    figurenotesSize,
    figurenotesStems,
    figurenotesChordLineGap,
    timeSignatureSize,
    showBarNumbers,
    barNumberSize,
    showRhythmSyllables,
    showAllNoteLabels,
    enableEmojiOverlays,
    joClefStaffPosition,
    relativeNotationShowKeySignature,
    relativeNotationShowTraditionalClef,
    pedagogicalAudioBpm,
    pedagogicalAudioPlaybackRate,
    pedagogicalAudioData: pedagogicalAudioDataRef.current || undefined,
    pedagogicalPlayheadStyle,
    pedagogicalPlayheadEmoji,
    pedagogicalPlayheadEmojiSize,
    cursorLineStrokeWidth,
    pedagogicalPlayheadMovement,
    staves,
    activeStaffIndex,
    staffYOffsets,
    measureStretchFactors: measureStretchFactors?.length ? measureStretchFactors : undefined,
    systemYOffsets: systemYOffsets?.length ? systemYOffsets : undefined,
    scoreData: staves[0]?.notes,
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
    pageDesignDataUrl: pageDesignDataUrl || undefined,
    pageDesignOpacity,
    pageDesignFit,
    pageDesignLayer,
    visibleStaves: visibleStaves.length === staves.length ? visibleStaves : staves.map(() => true),
    intermissionLabels
  }), [songTitle, author, notationStyle, notationMode, isPedagogicalProject, timeSignature, timeSignatureMode, keySignature, staffLines, pixelsPerBeat, instrumentNotationVariant, pickupEnabled, pickupQuantity, pickupDuration, setupCompleted, cursorPosition, addedMeasures, pageOrientation, paperSize, layoutMeasuresPerLine, layoutLineBreakBefore, layoutPageBreakBefore, layoutSystemGap, layoutPartsGap, layoutConnectedBarlines, layoutGlobalSpacingMultiplier, viewMode, partLayoutMeasuresPerLine, partLayoutLineBreakBefore, partLayoutPageBreakBefore, showPageNavigator, pageFlowDirection, visibleToolIds, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, figurenotesChordLineGap, timeSignatureSize, showBarNumbers, barNumberSize, showRhythmSyllables, showAllNoteLabels, enableEmojiOverlays, joClefStaffPosition, relativeNotationShowKeySignature, relativeNotationShowTraditionalClef, pedagogicalAudioBpm, pedagogicalAudioPlaybackRate, pedagogicalPlayheadStyle, pedagogicalPlayheadEmoji, pedagogicalPlayheadEmojiSize, cursorLineStrokeWidth, pedagogicalPlayheadMovement, staves, activeStaffIndex, staffYOffsets, measureStretchFactors, systemYOffsets, visibleStaves, intermissionLabels, chords, textBoxes, documentFontFamily, lyricFontFamily, titleFontSize, authorFontSize, titleFontFamily, authorFontFamily, titleBold, titleItalic, authorBold, authorItalic, pageDesignDataUrl, pageDesignOpacity, pageDesignFit, pageDesignLayer]);

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
      if (data.figurenotesSize != null) setFigurenotesSize(Math.max(12, Math.min(500, data.figurenotesSize)));
      if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
      if (data.figurenotesChordLineGap != null) setFigurenotesChordLineGap(Math.max(0, Math.min(20, Number(data.figurenotesChordLineGap))));
      if (data.figurenotesChordBlocks != null) setFigurenotesChordBlocks(!!data.figurenotesChordBlocks);
      if (data.timeSignatureSize != null) setTimeSignatureSize(Math.max(12, Math.min(48, data.timeSignatureSize)));
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
      if (data.cursorPosition != null) setCursorPosition(data.cursorPosition);
      if (data.addedMeasures != null) setAddedMeasures(data.addedMeasures);
      if (data.setupCompleted != null) setSetupCompleted(data.setupCompleted);
      if (data.songTitle != null) setSongTitle(data.songTitle);
      if (data.author != null) setAuthor(data.author);
      if (data.pickupEnabled != null) setPickupEnabled(data.pickupEnabled);
      if (data.pickupQuantity != null) setPickupQuantity(data.pickupQuantity);
      if (data.pickupDuration != null) setPickupDuration(data.pickupDuration);
      if (data.pageOrientation === 'portrait' || data.pageOrientation === 'landscape') setPageOrientation(data.pageOrientation);
      if (data.paperSize === 'a3' || data.paperSize === 'a4' || data.paperSize === 'a5') setPaperSize(data.paperSize);
      if (data.layoutMeasuresPerLine != null) setLayoutMeasuresPerLine(data.layoutMeasuresPerLine);
      if (Array.isArray(data.layoutLineBreakBefore)) setLayoutLineBreakBefore(data.layoutLineBreakBefore);
      if (Array.isArray(data.layoutPageBreakBefore)) setLayoutPageBreakBefore(data.layoutPageBreakBefore);
      if (data.layoutSystemGap != null) setLayoutSystemGap(Math.max(5, Math.min(250, Number(data.layoutSystemGap))));
      if (data.layoutPartsGap != null) setLayoutPartsGap(Math.max(2, Math.min(80, Number(data.layoutPartsGap))));
      if (data.layoutConnectedBarlines != null) setLayoutConnectedBarlines(!!data.layoutConnectedBarlines);
      if (data.layoutGlobalSpacingMultiplier != null) setLayoutGlobalSpacingMultiplier(Math.max(0.5, Math.min(2, Number(data.layoutGlobalSpacingMultiplier) || 1)));
      if (data.viewMode === 'score' || data.viewMode === 'part') setViewMode(data.viewMode);
      if (data.partLayoutMeasuresPerLine != null) setPartLayoutMeasuresPerLine(data.partLayoutMeasuresPerLine);
      if (Array.isArray(data.partLayoutLineBreakBefore)) setPartLayoutLineBreakBefore(data.partLayoutLineBreakBefore);
      if (Array.isArray(data.partLayoutPageBreakBefore)) setPartLayoutPageBreakBefore(data.partLayoutPageBreakBefore);
      if (data.showPageNavigator != null) setShowPageNavigator(!!data.showPageNavigator);
      if (data.pageFlowDirection === 'vertical' || data.pageFlowDirection === 'horizontal') setPageFlowDirection(data.pageFlowDirection);
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
      if (Array.isArray(data.chords)) setChords(data.chords);
      if (data.pageDesignDataUrl != null) setPageDesignDataUrl(data.pageDesignDataUrl || null);
      if (data.pageDesignOpacity != null) setPageDesignOpacity(clampNumber(Number(data.pageDesignOpacity) || 0.25, 0, 1));
      if (data.pageDesignFit === 'cover' || data.pageDesignFit === 'contain') setPageDesignFit(data.pageDesignFit);
      if (data.pageDesignLayer === 'behind' || data.pageDesignLayer === 'inFront') setPageDesignLayer(data.pageDesignLayer);
      if (Array.isArray(data.textBoxes)) setTextBoxes(data.textBoxes);
      if (Array.isArray(data.visibleStaves)) setVisibleStaves(data.visibleStaves);
      if (Array.isArray(data.intermissionLabels)) setIntermissionLabels(data.intermissionLabels);
      if (data.documentFontFamily) setDocumentFontFamily(data.documentFontFamily);
      if (data.lyricFontFamily) setLyricFontFamily(data.lyricFontFamily);
      if (typeof data.titleFontSize === 'number' && data.titleFontSize >= 10 && data.titleFontSize <= 72) setTitleFontSize(data.titleFontSize);
      if (typeof data.authorFontSize === 'number' && data.authorFontSize >= 8 && data.authorFontSize <= 48) setAuthorFontSize(data.authorFontSize);
      if (data.titleFontFamily != null) setTitleFontFamily(data.titleFontFamily || '');
      if (data.authorFontFamily != null) setAuthorFontFamily(data.authorFontFamily || '');
      if (typeof data.titleBold === 'boolean') setTitleBold(data.titleBold);
      if (typeof data.titleItalic === 'boolean') setTitleItalic(data.titleItalic);
      if (typeof data.authorBold === 'boolean') setAuthorBold(data.authorBold);
      if (typeof data.authorItalic === 'boolean') setAuthorItalic(data.authorItalic);
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
        if (data.figurenotesSize != null) setFigurenotesSize(Math.max(12, Math.min(500, data.figurenotesSize)));
        if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
        if (data.figurenotesChordLineGap != null) setFigurenotesChordLineGap(Math.max(0, Math.min(20, Number(data.figurenotesChordLineGap))));
        if (data.figurenotesChordBlocks != null) setFigurenotesChordBlocks(!!data.figurenotesChordBlocks);
        if (data.timeSignatureSize != null) setTimeSignatureSize(Math.max(12, Math.min(48, data.timeSignatureSize)));
        if (data.notationMode) setNotationMode(data.notationMode);
        if (data.noteheadShape) setNoteheadShape(data.noteheadShape);
        if (data.noteheadEmoji != null) setNoteheadEmoji(data.noteheadEmoji);
        if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
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
        if (data.layoutSystemGap != null) setLayoutSystemGap(Math.max(5, Math.min(250, Number(data.layoutSystemGap))));
        if (data.layoutPartsGap != null) setLayoutPartsGap(Math.max(2, Math.min(80, Number(data.layoutPartsGap))));
        if (data.layoutConnectedBarlines != null) setLayoutConnectedBarlines(!!data.layoutConnectedBarlines);
        if (data.layoutGlobalSpacingMultiplier != null) setLayoutGlobalSpacingMultiplier(Math.max(0.5, Math.min(2, Number(data.layoutGlobalSpacingMultiplier) || 1)));
        if (data.viewMode === 'score' || data.viewMode === 'part') setViewMode(data.viewMode);
        if (data.partLayoutMeasuresPerLine != null) setPartLayoutMeasuresPerLine(data.partLayoutMeasuresPerLine);
        if (Array.isArray(data.partLayoutLineBreakBefore)) setPartLayoutLineBreakBefore(data.partLayoutLineBreakBefore);
        if (Array.isArray(data.partLayoutPageBreakBefore)) setPartLayoutPageBreakBefore(data.partLayoutPageBreakBefore);
        if (data.showPageNavigator != null) setShowPageNavigator(!!data.showPageNavigator);
        if (data.pageFlowDirection === 'vertical' || data.pageFlowDirection === 'horizontal') setPageFlowDirection(data.pageFlowDirection);
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
        if (Array.isArray(data.chords)) setChords(data.chords);
        if (Array.isArray(data.textBoxes)) setTextBoxes(data.textBoxes);
        if (data.pageDesignDataUrl != null) setPageDesignDataUrl(data.pageDesignDataUrl || null);
        if (data.pageDesignOpacity != null) setPageDesignOpacity(clampNumber(Number(data.pageDesignOpacity) || 0.25, 0, 1));
        if (data.pageDesignFit === 'cover' || data.pageDesignFit === 'contain') setPageDesignFit(data.pageDesignFit);
        if (data.pageDesignLayer === 'behind' || data.pageDesignLayer === 'inFront') setPageDesignLayer(data.pageDesignLayer);
        if (Array.isArray(data.visibleStaves)) setVisibleStaves(data.visibleStaves);
        if (Array.isArray(data.intermissionLabels)) setIntermissionLabels(data.intermissionLabels);
        if (data.documentFontFamily) setDocumentFontFamily(data.documentFontFamily);
        if (data.lyricFontFamily) setLyricFontFamily(data.lyricFontFamily);
        if (typeof data.titleFontSize === 'number' && data.titleFontSize >= 10 && data.titleFontSize <= 72) setTitleFontSize(data.titleFontSize);
        if (typeof data.authorFontSize === 'number' && data.authorFontSize >= 8 && data.authorFontSize <= 48) setAuthorFontSize(data.authorFontSize);
        if (data.titleFontFamily != null) setTitleFontFamily(data.titleFontFamily || '');
        if (data.authorFontFamily != null) setAuthorFontFamily(data.authorFontFamily || '');
        if (typeof data.titleBold === 'boolean') setTitleBold(data.titleBold);
        if (typeof data.titleItalic === 'boolean') setTitleItalic(data.titleItalic);
        if (typeof data.authorBold === 'boolean') setAuthorBold(data.authorBold);
        if (typeof data.authorItalic === 'boolean') setAuthorItalic(data.authorItalic);
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

  // Salvesta pilve: kui on salvestuskaust seadistatud, salvesta otse sinna; vastasel juhul ava dialoog.
  const saveToCloud = useCallback(async () => {
    const token = googleDrive.getStoredToken();
    if (!token) {
      setSaveFeedback('Logi sisse Google\'iga (Drive luba)');
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    const savedFolderId = authStorage.getGoogleSaveFolderId();
    if (savedFolderId) {
      try {
        setSaveFeedback('Salvestan…');
        const data = exportScoreToJSON();
        const json = JSON.stringify(data, null, 2);
        const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.noodimeister';
        await googleDrive.createFileInFolder(token, savedFolderId, fileName, json);
        setSaveFeedback('Salvestatud pilve!');
        setTimeout(() => setSaveFeedback(''), 2500);
      } catch (e) {
        setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
        setTimeout(() => setSaveFeedback(''), 3000);
      }
      return;
    }
    setSaveCloudDialogOpen(true);
  }, [exportScoreToJSON]);

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

  // Salvesta OneDrive'i (Microsoft): kasuta seadistatud salvestuskausta või juurkausta.
  const saveToOneDrive = useCallback(async () => {
    const token = authStorage.getStoredMicrosoftTokenFromAuth();
    if (!token) {
      setSaveFeedback(t('feedback.loginMicrosoft') || 'Logi sisse Microsoftiga (OneDrive luba)');
      setTimeout(() => setSaveFeedback(''), 3000);
      return;
    }
    try {
      setSaveFeedback('Salvestan…');
      const data = exportScoreToJSON();
      const json = JSON.stringify(data, null, 2);
      const fileName = ((data.songTitle || t('common.untitled')).replace(/\s+/g, '-').replace(/[^\w\-.]/g, '') || t('common.untitled')) + '.noodimeister';
      const folderId = authStorage.getOneDriveSaveFolderId();
      if (folderId) {
        await oneDrive.uploadFileToFolder(token, folderId, fileName, json, 'application/json');
      } else {
        await oneDrive.uploadFileToRoot(token, fileName, json, 'application/json');
      }
      setSaveFeedback(t('feedback.savedToCloud') || 'Salvestatud pilve!');
      setTimeout(() => setSaveFeedback(''), 2500);
    } catch (e) {
      setSaveFeedback(e?.message || 'Pilve salvestamine ebaõnnestus');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
  }, [exportScoreToJSON]);

  /** Cmd/Ctrl+S: save to browser if not logged in; otherwise save to the provider's cloud (Google Drive, OneDrive, or browser for Apple). */
  const handleSaveShortcut = useCallback(() => {
    if (!isLoggedIn()) {
      saveToStorage();
      return;
    }
    const user = authStorage.getLoggedInUser();
    const provider = user?.provider;
    if (provider === 'google' && googleDrive.getStoredToken()) {
      saveToCloud();
      return;
    }
    if (provider === 'microsoft' && authStorage.getStoredMicrosoftTokenFromAuth()) {
      saveToOneDrive();
      return;
    }
    if (provider === 'apple') {
      saveToStorage();
      setSaveFeedback(t('feedback.saved') || 'Salvestatud!');
      setTimeout(() => setSaveFeedback(''), 1800);
      return;
    }
    saveToStorage();
  }, [isLoggedIn, saveToStorage, saveToCloud, saveToOneDrive]);

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
          if (data.figurenotesSize != null) setFigurenotesSize(Math.max(12, Math.min(500, data.figurenotesSize)));
          if (data.figurenotesStems != null) setFigurenotesStems(!!data.figurenotesStems);
          if (data.figurenotesChordLineGap != null) setFigurenotesChordLineGap(Math.max(0, Math.min(20, Number(data.figurenotesChordLineGap))));
          if (data.figurenotesChordBlocks != null) setFigurenotesChordBlocks(!!data.figurenotesChordBlocks);
          if (data.timeSignatureSize != null) setTimeSignatureSize(Math.max(12, Math.min(48, data.timeSignatureSize)));
          if (data.notationMode) setNotationMode(data.notationMode);
          if (data.noteheadShape) setNoteheadShape(data.noteheadShape);
          if (data.noteheadEmoji != null) setNoteheadEmoji(data.noteheadEmoji);
          if (data.instrument) setInstrument(data.instrument);
          if (data.instrumentNotationVariant) setInstrumentNotationVariant(data.instrumentNotationVariant);
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
          if (data.layoutSystemGap != null) setLayoutSystemGap(Math.max(5, Math.min(250, Number(data.layoutSystemGap))));
          if (data.layoutPartsGap != null) setLayoutPartsGap(Math.max(2, Math.min(80, Number(data.layoutPartsGap))));
          if (data.layoutConnectedBarlines != null) setLayoutConnectedBarlines(!!data.layoutConnectedBarlines);
          if (data.viewMode === 'score' || data.viewMode === 'part') setViewMode(data.viewMode);
          if (data.partLayoutMeasuresPerLine != null) setPartLayoutMeasuresPerLine(data.partLayoutMeasuresPerLine);
          if (Array.isArray(data.partLayoutLineBreakBefore)) setPartLayoutLineBreakBefore(data.partLayoutLineBreakBefore);
          if (Array.isArray(data.partLayoutPageBreakBefore)) setPartLayoutPageBreakBefore(data.partLayoutPageBreakBefore);
          if (data.showPageNavigator != null) setShowPageNavigator(!!data.showPageNavigator);
          if (data.pageFlowDirection === 'vertical' || data.pageFlowDirection === 'horizontal') setPageFlowDirection(data.pageFlowDirection);
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
        if (Array.isArray(data.textBoxes)) setTextBoxes(data.textBoxes);
        if (data.documentFontFamily) setDocumentFontFamily(data.documentFontFamily);
        if (data.lyricFontFamily) setLyricFontFamily(data.lyricFontFamily);
        if (typeof data.titleFontSize === 'number' && data.titleFontSize >= 10 && data.titleFontSize <= 72) setTitleFontSize(data.titleFontSize);
        if (typeof data.authorFontSize === 'number' && data.authorFontSize >= 8 && data.authorFontSize <= 48) setAuthorFontSize(data.authorFontSize);
        if (data.titleFontFamily != null) setTitleFontFamily(data.titleFontFamily || '');
        if (data.authorFontFamily != null) setAuthorFontFamily(data.authorFontFamily || '');
        if (typeof data.titleBold === 'boolean') setTitleBold(data.titleBold);
        if (typeof data.titleItalic === 'boolean') setTitleItalic(data.titleItalic);
        if (typeof data.authorBold === 'boolean') setAuthorBold(data.authorBold);
        if (typeof data.authorItalic === 'boolean') setAuthorItalic(data.authorItalic);
          if (data.lyricLineIndex === 0 || data.lyricLineIndex === 1) setLyricLineIndex(data.lyricLineIndex);
          if (typeof data.lyricLineYOffset === 'number') setLyricLineYOffset(Math.max(-40, Math.min(40, data.lyricLineYOffset)));
        }
      }
    } catch (_) { /* ignore */ }
  }, []);

  // Load from Google Drive or OneDrive when opening /app?fileId=... [&cloud=onedrive]
  const driveFileId = searchParams.get('fileId');
  const cloudProvider = searchParams.get('cloud');
  const isOneDrive = cloudProvider === 'onedrive';
  useEffect(() => {
    if (!driveFileId) return;
    let cancelled = false;
    setSaveFeedback('Laadin pilvest…');
    const loadFromOneDrive = () => {
      const token = authStorage.getStoredMicrosoftTokenFromAuth();
      if (!token) {
        setSaveFeedback('Logi sisse Microsoftiga, et laadida OneDrive\'ist.');
        setTimeout(() => setSaveFeedback(''), 4000);
        return;
      }
      oneDrive.getFileContent(token, driveFileId)
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
            setSaveFeedback(e?.message || 'OneDrive\'ist laadimine ebaõnnestus');
            setTimeout(() => setSaveFeedback(''), 4000);
          }
        });
    };
    const loadFromGoogle = () => {
      const token = googleDrive.getStoredToken();
      if (!token) {
        setSaveFeedback('Logi sisse Google\'iga, et laadida pilvest.');
        setTimeout(() => setSaveFeedback(''), 4000);
        return;
      }
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
    };
    if (isOneDrive) loadFromOneDrive();
    else loadFromGoogle();
    return () => { cancelled = true; };
  }, [driveFileId, isOneDrive, importProject]);

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
  }, [staves, activeStaffIndex, timeSignature, timeSignatureMode, keySignature, staffLines, notationStyle, pixelsPerBeat, notationMode, cursorPosition, addedMeasures, setupCompleted, songTitle, author, pickupEnabled, pickupQuantity, pickupDuration, layoutSystemGap, tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, playNoteOnInsert, figurenotesSize, figurenotesStems, figurenotesChordLineGap, figurenotesChordBlocks, timeSignatureSize, showBarNumbers, barNumberSize, joClefStaffPosition, chords, textBoxes, getPersistedState]);

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

  // Pickup: convert duration label to beats (relative to time sig beat unit). E.g. 4/4 + 1/8 → 0.5 beats.
  const durationToBeats = useCallback((durationLabel, beatUnit) => {
    const denom = parseInt(String(durationLabel).split('/')[1], 10) || 4;
    return beatUnit / denom;
  }, []);

  // Calculate measures (with optional pickup / eeltakt – exact rhythmic value). Pikkus = max kõigi ridade pikkus.
  const calculateMeasures = useCallback(() => {
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

    // Bar count is user-driven only: 1 initial bar + bars added via Cmd+B. Do not auto-create bars from note content.
    let totalMeasures = Math.max(1, 1 + (addedMeasures || 0));
    if (!hasFullAccess) {
      totalMeasures = Math.min(DEMO_MAX_MEASURES, totalMeasures);
    }
    const measures = [];
    for (let i = 0; i < totalMeasures; i++) {
      const b = getMeasureBounds(i);
      measures.push({ ...b, notes: [] });
    }
    return !hasFullAccess ? measures.slice(0, DEMO_MAX_MEASURES) : measures;
  }, [timeSignature, addedMeasures, pickupEnabled, pickupQuantity, pickupDuration, durationToBeats, hasFullAccess]);

  const maxCursorAllowed = useMemo(() => {
    const ms = calculateMeasures();
    return ms.length ? ms[ms.length - 1].endBeat : 0;
  }, [calculateMeasures]);
  const maxCursor = hasFullAccess ? maxCursorAllowed : Math.min(maxCursorAllowed, DEMO_MAX_BEATS);
  useEffect(() => {
    setCursorPosition(prev => {
      if (prev < 0) return 0;
      if (prev > maxCursor) return maxCursor;
      return prev;
    });
  }, [maxCursor]);

  const playPianoNote = useCallback((pitch, octave, semitonesOffset = 0) => {
    const semi = semitonesOffset === true || semitonesOffset === 1 ? 1 : semitonesOffset === -1 ? -1 : 0;
    const oct = octave ?? 4;
    const freq = getNoteFrequency(tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, pitch, oct, semi);
    const midiNote = Math.max(0, Math.min(127, pitchOctaveToMidi(pitch, oct) + semi));
    const soundfontName = INSTRUMENT_TO_SOUNDFONT_NAME[instrument] || 'acoustic_grand_piano';
    let ctx = audioContextRef.current;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
      } catch (_) {}
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    const cached = ctx && soundfontCacheRef.current[instrument];
    if (cached) {
      try {
        cached.play(midiNote, ctx.currentTime, { duration: 0.28 });
        return;
      } catch (_) {}
    }
    playTone(audioContextRef, freq);
    if (ctx && !soundfontCacheRef.current[instrument]) {
      Soundfont.instrument(ctx, soundfontName, { soundfont: 'FluidR3_GM' })
        .then((player) => {
          soundfontCacheRef.current[instrument] = player;
        })
        .catch(() => {});
    }
  }, [tuningReferenceNote, tuningReferenceOctave, tuningReferenceHz, instrument]);

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
      if (pedagogicalAudioRef.current) {
        pedagogicalAudioRef.current.pause();
        pedagogicalAudioRef.current = null;
      }
      if (pedagogicalAudioUrlRef.current) URL.revokeObjectURL(pedagogicalAudioUrlRef.current);
    };
  }, []);

  // Lisa uus noodirida valitud instrumendiga (noodivõti instrumendi konfiguratsioonist). Igal real oma notationMode (T/F/P).
  const addStaff = useCallback((instId) => {
    const cfg = INSTRUMENT_CONFIG_BASE[instId];
    const clef = (cfg?.defaultClef) || 'treble';
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const staffNotationMode = notationStyle === 'FIGURENOTES' ? 'figurenotes' : notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional';
    setStaves((prev) => [...prev, { id, instrumentId: instId, clefType: clef, notes: [], notationMode: staffNotationMode }]);
    setActiveStaffIndex(staves.length);
  }, [notationStyle, notationMode, staves.length]);

  // Klaveri sisestamine: kaks noodirida (viiulivõti + bassivõti), ühendatud ühe instrumendi süsteemina (sulgega)
  const addPianoStaff = useCallback(() => {
    const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
    const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const staffMode = notationStyle === 'FIGURENOTES' ? 'figurenotes' : notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional';
    setStaves((prev) => [
      ...prev,
      { id: id1, instrumentId: 'piano', clefType: 'treble', notes: [], braceGroupId, notationMode: staffMode },
      { id: id2, instrumentId: 'piano', clefType: 'bass', notes: [], braceGroupId, notationMode: staffMode }
    ]);
    setActiveStaffIndex(staves.length);
  }, [notationStyle, notationMode, staves.length]);

  // Alias for use in addNoteAtCursor etc. (defined early as notesWithExplicitBeatsEarly to avoid TDZ).
  const notesWithExplicitBeats = notesWithExplicitBeatsEarly;

  // Handle toolbox selection (clickedIndex = option index when clicking, else uses selectedOptionIndex for keyboard).
  // When options.insertAtBeat is set (e.g. from figure-beat click), use it so the writer follows the cursor/click position (avoids stale cursorPosition from async setState).
  const addNoteAtCursor = useCallback((pitch, octave, accidental, options = {}) => {
    const insertBeat = typeof options.insertAtBeat === 'number' ? options.insertAtBeat : cursorPosition;
    const oct = octave ?? ghostOctave;
    const acc = accidental !== undefined ? accidental : ghostAccidental;
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
    const newNote = {
      id: Date.now(),
      pitch,
      octave: oct,
      duration: effectiveDuration,
      durationLabel,
      beat: insertBeat,
      isDotted: tupletPayload ? false : isDotted,
      isRest: isRest,
      lyric: '',
      ...(acc !== 0 && { accidental: acc }),
      ...(tupletPayload && { tuplet: tupletPayload })
    };
    const midiForStaff = (oct + 1) * 12 + (PITCH_TO_SEMI[pitch] ?? 0);
    const isGrandStaff = staves.length >= 2 && staves[0].braceGroupId && staves[0].braceGroupId === staves[1]?.braceGroupId;
    const targetStaffIndex = isGrandStaff ? (midiForStaff < 60 ? 1 : 0) : activeStaffIndex;

    const insertIntoStaffNotes = (noteList) => {
      const withBeats = notesWithExplicitBeats(noteList);
      const merged = [...withBeats, newNote].sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
      const totalSpan = merged.reduce((max, n) => Math.max(max, (n.beat ?? 0) + (n.duration ?? 1)), 0);
      if (!hasFullAccess && totalSpan > DEMO_MAX_BEATS) {
        setSaveFeedback('Demo: max 8 takti (2 rida). Logi sisse või registreeru, et kirjutada edasi.');
        setTimeout(() => setSaveFeedback(''), 3500);
        return null;
      }
      return merged;
    };

    saveToHistory(notes);
    if (isGrandStaff && targetStaffIndex !== activeStaffIndex) {
      setStaves((prev) => {
        const next = prev.slice();
        const staff = next[targetStaffIndex];
        const newNotes = insertIntoStaffNotes(staff.notes || []);
        if (newNotes == null) return prev;
        next[targetStaffIndex] = { ...staff, notes: newNotes };
        return next;
      });
    } else {
      const newNotes = insertIntoStaffNotes(notes);
      if (newNotes == null) return;
      setNotes(newNotes);
    }
    setCursorPosition(insertBeat + effectiveDuration);
    setGhostPitch(pitch);
    setGhostOctave(oct);
    if (!isRest && playNoteOnInsert && !options.skipPlay) {
      const semitones = acc === 1 ? 1 : acc === -1 ? -1 : 0;
      playPianoNote(pitch, oct, semitones);
    }
  }, [cursorPosition, selectedDuration, getEffectiveDuration, isDotted, isRest, notes, saveToHistory, ghostOctave, ghostAccidental, playPianoNote, playNoteOnInsert, tupletMode, durations, staves, activeStaffIndex, notesWithExplicitBeats]);

  // Add a note on top of the note at cursor (chord input). Traditional or Pedagogical only. Shift+Letter.
  const addNoteOnTopOfCursor = useCallback((pitch, octave, accidental, options = {}) => {
    if (notes.length === 0) return;
    const acc = accidental !== undefined ? accidental : ghostAccidental;
    let beat = 0;
    let anchorIndex = -1;
    let anchorBeat = 0;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
      if (cursorPosition >= noteBeat && cursorPosition <= noteBeat + n.duration && !n.isRest) {
        anchorIndex = i;
        anchorBeat = noteBeat;
        break;
      }
      beat = noteBeat + n.duration;
    }
    if (anchorIndex < 0) return;
    const anchor = notes[anchorIndex];
    const oct = octave ?? ghostOctave;
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
      ...(acc !== 0 && { accidental: acc })
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
      const semitones = acc === 1 ? 1 : acc === -1 ? -1 : 0;
      playPianoNote(pitch, oct, semitones);
    }
  }, [notes, cursorPosition, ghostOctave, ghostAccidental, saveToHistory, setNotes, playPianoNote, playNoteOnInsert]);

  // Liitrütmimustrid: iga element { durationLabel, duration, tuplet? }
  const RHYTHM_PATTERN_NOTES = useMemo(() => {
    const triplet32 = { type: 3, inSpaceOf: 2 };
    return {
      '2/8': [{ durationLabel: '1/8', duration: 0.5 }, { durationLabel: '1/8', duration: 0.5 }],
      '4/16': Array(4).fill({ durationLabel: '1/16', duration: 0.25 }),
      '8/16': Array(8).fill({ durationLabel: '1/16', duration: 0.25 }),
      '1/8+2/16': [{ durationLabel: '1/8', duration: 0.5 }, { durationLabel: '1/16', duration: 0.25 }, { durationLabel: '1/16', duration: 0.25 }],
      '2/16+1/8': [{ durationLabel: '1/16', duration: 0.25 }, { durationLabel: '1/16', duration: 0.25 }, { durationLabel: '1/8', duration: 0.5 }],
      // Irregular (triplet) patterns in 4/4: two variations
      'triplet-8': Array(3).fill({ durationLabel: '1/8', duration: 1 / 3, tuplet: triplet32 }),
      'triplet-4': Array(3).fill({ durationLabel: '1/4', duration: 2 / 3, tuplet: triplet32 })
    };
  }, []);

  const insertPatternAtCursor = useCallback((patternKey) => {
    const pattern = RHYTHM_PATTERN_NOTES[patternKey];
    if (!pattern || !ghostPitch) return;
    const totalBeatsNow = notes.reduce((acc, n) => acc + n.duration, 0);
    const totalDuration = pattern.reduce((s, n) => s + n.duration, 0);
    if (!hasFullAccess && totalBeatsNow + totalDuration > DEMO_MAX_BEATS) return;
    const newNotes = pattern.map(({ durationLabel, duration, tuplet }, i) => ({
      id: Date.now() + i,
      pitch: ghostPitch,
      octave: ghostOctave,
      duration,
      durationLabel,
      isDotted: false,
      isRest: isRest,
      lyric: '',
      ...(tuplet && { tuplet })
    }));
    saveToHistory(notes);
    setNotes(prev => [...prev, ...newNotes]);
    setCursorPosition(prev => prev + totalDuration);
    if (!isRest && playNoteOnInsert) playPianoNote(ghostPitch, ghostOctave);
  }, [RHYTHM_PATTERN_NOTES, ghostPitch, ghostOctave, isRest, notes, saveToHistory, playPianoNote, playNoteOnInsert]);

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

  const addChordAt = useCallback((beatPosition, chordText, figuredBass = '') => {
    if (!chordText || !String(chordText).trim()) return;
    const normalized = normalizeChordHotkey(chordText);
    if (!normalized) return;
    dirtyRef.current = true;
    const newChord = {
      id: Date.now() + Math.random(),
      beatPosition,
      chord: String(normalized).trim(),
      figuredBass: figuredBass ? String(figuredBass).trim() : ''
    };
    setChords(prev => [...prev, newChord].sort((a, b) => a.beatPosition - b.beatPosition));
  }, [normalizeChordHotkey]);

  const handleToolboxSelection = useCallback((clickedIndex) => {
    if (!activeToolbox) return;
    const toolbox = toolboxes[activeToolbox];
    if (!toolbox?.options) return;
    const optionIndex = clickedIndex !== undefined ? clickedIndex : selectedOptionIndex;
    const option = toolbox.options[optionIndex];
    if (!option) return;
    if (activeToolbox === 'instruments' && option.type === 'category') return;

    switch (activeToolbox) {
      case 'rhythm': {
        const selected = getSelectedNotes();
        const hasSelection = selected.length > 0;
        const patternKeys = ['2/8', '4/16', '8/16', '1/8+2/16', '2/16+1/8', 'triplet-8', 'triplet-4'];
        if (patternKeys.includes(option.value)) {
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
        if (option.value === 'jo') {
          setNotationMode('vabanotatsioon');
        } else {
          setNotationMode('traditional');
          setClefType(option.value);
        }
        break;
      case 'keySignatures':
        setKeySignature(option.value);
        break;
      case 'transpose': {
        const targetKey = option.value;
        const fromSemi = KEY_TO_SEMITONE[keySignature] ?? getSemitonesFromKey(keySignature);
        const toSemi = KEY_TO_SEMITONE[targetKey] ?? getSemitonesFromKey(targetKey);
        let semitones = (toSemi - fromSemi) % 12;
        if (semitones < 0) semitones += 12;
        if (semitones !== 0) {
          saveToHistory(notes);
          setNotes(transposeNotes(notes, semitones));
          setKeySignature(targetKey);
        }
        break;
      }
      case 'notehead':
        if (option.value.startsWith('shape:')) {
          setNoteheadShape(option.value.slice(7));
        } else {
          setNotationMode(option.value);
        }
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
        if (option.type === 'category') break;
        setSelectedOptionIndex(optionIndex);
        const instId = option.type === 'option' ? option.value : option.value;
        const cfg = instrumentConfig[instId];
        // Klaver: alati kaks paralleelset rida (viiulivõti üleval, bassivõti all); teised instrumendid: lisa üks uus rida
        if (instId === 'piano') {
          if (staves.length === 1) {
            setStaves((prev) => {
              const braceGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `piano-${Date.now()}`;
              const id1 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-a`;
              const id2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-b`;
              const staffMode = notationStyle === 'FIGURENOTES' ? 'figurenotes' : notationMode === 'vabanotatsioon' ? 'pedagogical' : 'traditional';
              return [
                { id: id1, instrumentId: 'piano', clefType: 'treble', notes: prev[0]?.notes ?? [], braceGroupId, notationMode: staffMode },
                { id: id2, instrumentId: 'piano', clefType: 'bass', notes: [], braceGroupId, notationMode: staffMode }
              ];
            });
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
        break;
      }
      case 'repeatsJumps': {
        // Apply repeat/jump mark (Leland SMuFL) to the measure containing the cursor
        const ms = measuresRef.current;
        if (ms && ms.length > 0) {
          const cursorMeasureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          const idx = cursorMeasureIndex >= 0 ? cursorMeasureIndex : Math.min(Math.max(0, Math.floor(cursorPosition / (timeSignature?.beats || 4))), ms.length - 1);
          setMeasureRepeatMarks((prev) => ({ ...prev, [idx]: { ...(prev[idx] || {}), [option.value]: true } }));
        }
        setActiveToolbox(null);
        setSelectedOptionIndex(0);
        break;
      }
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
  }, [activeToolbox, selectedOptionIndex, noteInputMode, addNoteAtCursor, ghostOctave, instrumentNotationVariant, addChordAt, getChordInsertBeat, getSelectedNotes, notes, keySignature, setNotes, saveToHistory, selectedNoteIndex, selectionStart, selectionEnd, durations, insertPatternAtCursor, addStaff, addPianoStaff, instrumentConfig, setNotationMode, setClefType, staves.length, notationStyle, notationMode, cursorPosition, timeSignature]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ära püüa klahve, kui kasutaja kirjutab input/textarea väljale (nt pealkiri, autor) – v.a. Ctrl+L laulusõna väljal
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();
      const isTypingInInput = tag === 'input' || tag === 'textarea' || (active?.getAttribute?.('contenteditable') === 'true');
      // Ctrl+L (Cmd+L) or L alone: start lyric entry from selected note – focus lyric field and enable chain (L only when not typing in another input)
      if (e.code === 'KeyL' && selectedNoteIndex >= 0 && (modKey || !isTypingInInput)) {
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

      // Cmd/Ctrl+S – save: to cloud (Google Drive / OneDrive) when logged in with that provider, otherwise to browser
      if (modKey && e.code === 'KeyS') {
        e.preventDefault();
        handleSaveShortcut();
        return;
      }

      // Cmd/Ctrl+P – open print dialog (notation sheet only, per @media print)
      if (modKey && e.code === 'KeyP') {
        e.preventDefault();
        handlePrint();
        return;
      }

      // Shared helper: apply transform to selected note(s) and save history
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

      // Index of the note that spans the current cursor position. When multiple notes share the same beat (chord),
      // return the UPPER note (highest pitch) so that Arrow Up/Down and Backspace target the top note first.
      const getNoteIndexAtCursor = () => {
        let beat = 0;
        const candidates = [];
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
          if (cursorPosition >= noteBeat && cursorPosition <= noteBeat + n.duration) {
            candidates.push({ index: i, note: n, noteBeat });
          }
          beat = noteBeat + n.duration;
        }
        if (candidates.length === 0) return -1;
        if (candidates.length === 1) return candidates[0].index;
        const midi = (n) => (n.octave + 1) * 12 + (PITCH_TO_SEMI[n.pitch] ?? 0);
        let best = candidates[0];
        for (let k = 1; k < candidates.length; k++) {
          if (midi(candidates[k].note) > midi(best.note)) best = candidates[k];
        }
        return best.index;
      };

      // Teksti kast valitud: Delete/Backspace kustutab kasti
      if (selectedTextboxId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        setTextBoxes(prev => prev.filter(b => b.id !== selectedTextboxId));
        setSelectedTextboxId(null);
        dirtyRef.current = true;
        return;
      }
      if (e.key === 'Escape') setSelectedTextboxId(null);

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
          const newKey = getKeyFromStaffPosition(nextPos);
          if (newKey !== keySignature) {
            const semitones = (KEY_TO_SEMITONE[newKey] ?? getSemitonesFromKey(newKey)) - (KEY_TO_SEMITONE[keySignature] ?? getSemitonesFromKey(keySignature));
            if (semitones !== 0) {
              saveToHistory(notes);
              setStaves((prev) => prev.map((staff) => ({ ...staff, notes: transposeNotes(staff.notes || [], semitones) })));
            }
            setKeySignature(newKey);
          }
          setJoClefStaffPosition(nextPos);
          dirtyRef.current = true;
          return;
        }
      }

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
        }
        return;
      }

      // Clipboard history palette: Cmd/Ctrl+Shift+V – toggle history panel
      if (modKey && e.shiftKey && e.code === 'KeyV') {
        e.preventDefault();
        setClipboardHistoryOpen((prev) => !prev);
        return;
      }

      // Stage V: Paste (Ctrl+V)
      if (modKey && e.code === 'KeyV' && !e.shiftKey && clipboard.length > 0) {
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

      // Alt+[ / Alt+{ – vähenda valitud takti laiust (kokkusurumine); Alt+] / Alt+} – suurenda (laiendamine)
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        const ms = measuresRef.current;
        if (ms && ms.length > 0) {
          const measureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          const idx = measureIndex >= 0 ? measureIndex : Math.min(cursorPosition > 0 ? Math.floor(cursorPosition / (timeSignature?.beats || 4)) : 0, ms.length - 1);
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

      // Cmd+A / Ctrl+A – ava Akordid tööriistakast (akordi lisamiseks)
      if (modKey && e.code === 'KeyA') {
        e.preventDefault();
        setActiveToolbox(activeToolbox === 'chords' ? null : 'chords');
        setSelectedOptionIndex(0);
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

      // N key toggles note input mode. When entering N mode, clear selection so cursor/ghost keys work (no stuck state).
      if (e.code === 'KeyN' && !e.shiftKey && !modKey) {
        e.preventDefault();
        setNoteInputMode(prev => {
          if (prev) {
            setSelectedNoteIndex(-1);
            setSelectionStart(-1);
            setSelectionEnd(-1);
          } else {
            setSelectedNoteIndex(-1);
            setSelectionStart(-1);
            setSelectionEnd(-1);
            if (selectedNoteIndex >= 0 && notes[selectedNoteIndex]) {
              const n = notes[selectedNoteIndex];
              setGhostPitch(n.pitch);
              setGhostOctave(n.octave);
            } else if (notes.length > 0) {
              const last = notes[notes.length - 1];
              setGhostPitch(last.pitch);
              setGhostOctave(last.octave);
            }
          }
          return !prev;
        });
        return;
      }

      // N-mode Backspace: delete note at cursor (or empty bar) first – so it always works instead of converting selection to rest
      if (noteInputMode && (e.key === 'Backspace' || e.code === 'Backspace')) {
        e.preventDefault();
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
          saveToHistory(notes);
          setNotes(prev => prev.filter((_, i) => i !== indexAtCursor));
          setCursorPosition(newCursor);
          setSelectionStart(-1);
          setSelectionEnd(-1);
          setSelectedNoteIndex(-1);
          const remaining = notes.filter((_, i) => i !== indexAtCursor);
          if (remaining.length > 0) {
            beat = 0;
            const atCursor = [];
            for (let i = 0; i < remaining.length; i++) {
              const n = remaining[i];
              const noteBeat = typeof n.beat === 'number' ? n.beat : beat;
              if (newCursor >= noteBeat && newCursor <= noteBeat + n.duration) atCursor.push(n);
              beat = noteBeat + n.duration;
            }
            const prevNote = atCursor.length === 0 ? null : atCursor.length === 1 ? atCursor[0] : atCursor.reduce((a, b) => ((a.octave + 1) * 12 + (PITCH_TO_SEMI[a.pitch] ?? 0)) >= ((b.octave + 1) * 12 + (PITCH_TO_SEMI[b.pitch] ?? 0)) ? a : b);
            if (prevNote) {
              setGhostPitch(prevNote.pitch);
              setGhostOctave(prevNote.octave);
            }
          }
          return;
        }
        const ms = measuresRef.current;
        let removedExcessBar = false;
        if (ms && ms.length > 1) {
          const cursorMeasureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          if (cursorMeasureIndex >= 1) {
            const m = ms[cursorMeasureIndex];
            let beatRun = 0;
            const hasNoteInBar = notes.some((n) => {
              const noteBeat = typeof n.beat === 'number' ? n.beat : beatRun;
              const inBar = noteBeat < m.endBeat && noteBeat + n.duration > m.startBeat;
              beatRun = noteBeat + n.duration;
              return inBar;
            });
            if (!hasNoteInBar) {
              saveToHistory(notes);
              setAddedMeasures((a) => Math.max(0, (a || 0) - 1));
              const prev = ms[cursorMeasureIndex - 1];
              const oneBeat = (prev.beatCount || timeSignature?.beats || 4) / (timeSignature?.beatUnit || 4);
              setCursorPosition(Math.max(prev.startBeat, prev.endBeat - oneBeat));
              removedExcessBar = true;
            }
          }
        }
        if (!removedExcessBar && ms && ms.length > 0) {
          const cursorMeasureIndex = ms.findIndex((m) => cursorPosition >= m.startBeat && cursorPosition < m.endBeat);
          if (cursorMeasureIndex >= 0 && measureRepeatMarks[cursorMeasureIndex] && Object.keys(measureRepeatMarks[cursorMeasureIndex]).length > 0) {
            setMeasureRepeatMarks((prev) => {
              const next = { ...prev };
              delete next[cursorMeasureIndex];
              return next;
            });
          }
        }
        return;
      }

      // Backspace/Delete kustutab valitud nooti(d) alati, kui midagi on valitud (sõltumata tööriistakastist või režiimist) – mitte N-režiimis
      if (!noteInputMode && (e.code === 'Backspace' || e.key === 'Backspace' || e.code === 'Delete') && selectedNoteIndex >= 0) {
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
        setSelectedNoteIndex(-1);
        setActiveToolbox(null);
        return;
      }

      // When a note is selected: Arrow Up/Down and duration/letter keys always edit it (even with toolbox open or note input on)
      if (selectedNoteIndex >= 0 && selectedNoteIndex < notes.length) {
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
        if (durationMapSel[e.code]) {
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
          applyToSelectedNotes(n => ({
            ...n,
            pitch,
            octave: ghostOctave,
            durationLabel,
            duration: newDuration,
            isDotted,
            isRest
          }));
          setGhostPitch(pitch);
          setGhostOctave(ghostOctave);
          return;
        }
      }

      // Shift+1..9, Shift+T: open toolbox (toggle: same shortcut closes or keeps focused)
      if (e.shiftKey && !modKey) {
        const toolboxMap = {
          'Digit1': 'rhythm', 'Digit2': 'timeSignature', 'Digit3': 'clefs',
          'Digit4': 'keySignatures', 'Digit5': 'pitchInput', 'Digit6': 'notehead',
          'Digit7': 'instruments', 'Digit8': 'repeatsJumps', 'Digit9': 'layout',
          'KeyT': 'textBox'
        };
        if (toolboxMap[e.code]) {
          e.preventDefault();
          const newToolbox = toolboxMap[e.code];
          setActiveToolbox(activeToolbox === newToolbox ? null : newToolbox);
          setSelectedOptionIndex(0);
          return;
        }
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

      // Noodi sisestusrežiim: nooltedega kursor, tähtedega noot (ka tööriistakast avatud)
      if (noteInputMode) {
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
        // Cursor on a note: Arrow Up/Down = one note up/down (pitch class); Shift+Arrow = octave change
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
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

      // Stage V: Selection mode (when N is OFF)
      if (!activeToolbox && !noteInputMode) {
        // If nothing is selected yet, initialize selection to the first/last note so Shift+Arrow can't create invalid (-1) ranges.
        const ensureSelectedIndex = (fallback) => {
          if (notes.length <= 0) return -1;
          if (selectedNoteIndex >= 0) return selectedNoteIndex;
          const idx = Math.max(0, Math.min(fallback, notes.length - 1));
          setSelectedNoteIndex(idx);
          return idx;
        };
        // Arrow navigation
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (e.shiftKey) {
            // Range selection
            const baseIdx = ensureSelectedIndex(0);
            if (baseIdx < 0) return;
            if (selectionStart < 0) {
              setSelectionStart(baseIdx);
              setSelectionEnd(Math.min(baseIdx + 1, notes.length - 1));
              setSelectedNoteIndex(Math.min(baseIdx + 1, notes.length - 1));
            } else {
              setSelectionEnd(prev => Math.min(prev + 1, notes.length - 1));
              setSelectedNoteIndex(prev => Math.min(prev + 1, notes.length - 1));
            }
          } else {
            // Single selection
            setSelectionStart(-1);
            setSelectionEnd(-1);
            const baseIdx = ensureSelectedIndex(-1);
            if (baseIdx < 0) return;
            setSelectedNoteIndex(prev => Math.min((prev >= 0 ? prev : baseIdx) + 1, notes.length - 1));
          }
          return;
        }

        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (e.shiftKey) {
            // Range selection
            const baseIdx = ensureSelectedIndex(notes.length - 1);
            if (baseIdx < 0) return;
            if (selectionStart < 0) {
              setSelectionStart(baseIdx);
              setSelectionEnd(Math.max(baseIdx - 1, 0));
              setSelectedNoteIndex(Math.max(baseIdx - 1, 0));
            } else {
              setSelectionEnd(prev => Math.max(prev - 1, 0));
              setSelectedNoteIndex(prev => Math.max(prev - 1, 0));
            }
          } else {
            // Single selection
            setSelectionStart(-1);
            setSelectionEnd(-1);
            const baseIdx = ensureSelectedIndex(0);
            if (baseIdx < 0) return;
            setSelectedNoteIndex(prev => Math.max((prev >= 0 ? prev : baseIdx) - 1, 0));
          }
          return;
        }

        // Option/Alt+ArrowUp = sharp, Option/Alt+ArrowDown = flat (selected note(s) or ghost for next note); play changed note
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
          e.preventDefault();
          const acc = e.code === 'ArrowUp' ? 1 : -1;
          const hasSelection = selectedNoteIndex >= 0 || (selectionStart >= 0 && selectionEnd >= 0);
          if (hasSelection) {
            applyToSelectedNotes((n) => ({ ...n, accidental: acc }));
            const idx = selectedNoteIndex >= 0 ? selectedNoteIndex : Math.min(selectionStart, selectionEnd);
            const note = notes[idx];
            if (note && !note.isRest && playNoteOnInsert) {
              playPianoNote(note.pitch, note.octave, acc);
            }
          } else {
            setGhostAccidental(acc);
            if (playNoteOnInsert) playPianoNote(ghostPitch, ghostOctave, acc);
          }
          return;
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
        if (durationMap[e.code] && selectedNoteIndex >= 0) {
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
          applyToSelectedNotes(n => ({
            ...n,
            pitch,
            octave: ghostOctave,
            durationLabel,
            duration: newDuration,
            isDotted,
            isRest
          }));
          setGhostPitch(pitch);
          setGhostOctave(ghostOctave);
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
        // Arrow Up/Down = one note up/down (pitch class in key). Shift+Arrow = octave change.
        if (e.code === 'ArrowUp' && !e.shiftKey) {
          e.preventDefault();
          const next = shiftPitchClassSameOctave(ghostPitch, ghostOctave, ghostAccidental, 1, keySignature);
          setGhostPitch(next.pitch);
          setGhostOctave(next.octave);
          setGhostAccidental(next.accidental ?? 0);
          if (playNoteOnInsert) playPianoNote(next.pitch, next.octave, next.accidental ?? 0);
          return;
        }
        if (e.code === 'ArrowDown' && !e.shiftKey) {
          e.preventDefault();
          const next = shiftPitchClassSameOctave(ghostPitch, ghostOctave, ghostAccidental, -1, keySignature);
          setGhostPitch(next.pitch);
          setGhostOctave(next.octave);
          setGhostAccidental(next.accidental ?? 0);
          if (playNoteOnInsert) playPianoNote(next.pitch, next.octave, next.accidental ?? 0);
          return;
        }
        // Shift+Arrow Up/Down – octave jump on ghost note (traditional)
        if (e.code === 'ArrowUp' && e.shiftKey) {
          e.preventDefault();
          const newOct = shiftOctave(ghostOctave, 1);
          setGhostOctave(newOct);
          if (playNoteOnInsert) playPianoNote(ghostPitch, newOct, 0);
          return;
        }
        if (e.code === 'ArrowDown' && e.shiftKey) {
          e.preventDefault();
          const newOct = shiftOctave(ghostOctave, -1);
          setGhostOctave(newOct);
          if (playNoteOnInsert) playPianoNote(ghostPitch, newOct, 0);
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
            const totalBeatsNow = notes.reduce((acc, n) => acc + n.duration, 0);
            const effectiveDuration = getEffectiveDuration(dur);
            if (!hasFullAccess && totalBeatsNow + effectiveDuration > DEMO_MAX_BEATS) {
              setSaveFeedback('Demo: max 8 takti (2 rida). Logi sisse või registreeru, et kirjutada edasi.');
              setTimeout(() => setSaveFeedback(''), 3500);
              return;
            }
            const newNote = {
              id: Date.now(),
              pitch: 'C',
              octave: ghostOctave,
              duration: effectiveDuration,
              durationLabel: dur,
              isDotted: false,
              isRest: true,
              lyric: ''
            };
            saveToHistory(notes);
            setNotes(prev => [...prev, newNote]);
            setCursorPosition(prev => prev + effectiveDuration);
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

        // Note input (C-G) – kasuta globaalset aktiivset rütmi (lastDurationRef), et rütmipaneelist valimine kehtiks kohe
        const noteLetter = e.key.toLowerCase();
        if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(noteLetter)) {
          restNextRef.current = false;
          const durationLabel = lastDurationRef.current ?? selectedDuration;
          const effectiveDuration = getEffectiveDuration(durationLabel);
          const pitch = noteLetter.toUpperCase();
          const newNote = {
            id: Date.now(),
            pitch,
            octave: ghostOctave,
            duration: effectiveDuration,
            durationLabel,
            isDotted: isDotted,
            isRest: isRest
          };
          saveToHistory(notes);
          setNotes(prev => [...prev, newNote]);
          setCursorPosition(prev => prev + effectiveDuration);
          setGhostPitch(pitch);
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
    shiftPitchClassSameOctave, shiftOctave, addMeasure, ghostPitch, ghostOctave, ghostAccidental, playNoteOnInsert, playPianoNote,
    cursorPosition, joClefFocused, joClefStaffPosition, keySignature, setNotes, setKeySignature, notationMode, addNoteOnTopOfCursor,
    handleSaveShortcut, handlePrint, addedMeasures, timeSignature, setAddedMeasures, setCursorPosition, measureRepeatMarks, setMeasureRepeatMarks,
    maxCursor
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
  const measuresWithMarks = useMemo(() => measures.map((m, i) => ({ ...m, ...(measureRepeatMarks[i] || {}) })), [measures, measureRepeatMarks]);
  // Praeguse vaate paigutus: partituur või instrumendi part (instrumentide paigutus ei mõjuta partituuri)
  const effectiveLayoutMeasuresPerLine = viewMode === 'score' ? layoutMeasuresPerLine : partLayoutMeasuresPerLine;
  const effectiveLayoutLineBreakBefore = viewMode === 'score' ? layoutLineBreakBefore : partLayoutLineBreakBefore;
  const effectiveLayoutPageBreakBefore = viewMode === 'score' ? layoutPageBreakBefore : partLayoutPageBreakBefore;
  const scoreContainerRef = useRef(null);
  const scoreContentRef = useRef(null); // div that has handleScoreContentClick – for drag coordinate conversion
  const textboxInteractionRef = useRef(null); // { type: 'move'|'resize', id, startX, startY, boxStartX?, boxStartY?, boxStartW?, boxStartH?, handle? }
  const textboxDragStartRef = useRef(null); // { id, startX, startY, boxStartX, boxStartY } – click vs drag
  const selectionDragRef = useRef(null); // { startIndex, pointerDown: boolean, shift: boolean }
  const handPanRef = useRef({ active: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 });
  const [isHandPanning, setIsHandPanning] = useState(false);
  const systemsForScoreRef = useRef([]);
  const exportCursorRef = useRef(null); // { x, y, emoji, size } container-relative, for MP4 fillText
  const [pageWidth, setPageWidth] = useState(LAYOUT.PAGE_WIDTH_MIN);
  const effectivePageWidthMax = pageOrientation === 'landscape' ? LAYOUT.PAGE_WIDTH_MAX_LANDSCAPE : LAYOUT.PAGE_WIDTH_MAX;
  useEffect(() => {
    const el = scoreContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPageWidth(Math.max(LAYOUT.PAGE_WIDTH_MIN, Math.min(effectivePageWidthMax, w)));
    });
    ro.observe(el);
    setPageWidth(Math.max(LAYOUT.PAGE_WIDTH_MIN, Math.min(effectivePageWidthMax, el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, [pageOrientation, effectivePageWidthMax]);
  useEffect(() => {
    pdfExportOptionsRef.current = { pageFlowDirection, pageWidth };
  }, [pageFlowDirection, pageWidth]);
  const a4PageHeightPx = (pageWidth || LAYOUT.PAGE_WIDTH_MIN) * LAYOUT.A4_HEIGHT_RATIO;
  /** Figurenotes row height (beat-box / line) scales with Noodigraafika suurus so barlines and box match note size. */
  const figurenotesRowHeight = Math.max(FIGURE_ROW_HEIGHT, Math.round(FIGURE_ROW_HEIGHT * figurenotesSize / 75));
  /** Chord line in figurenotes: only when user has enabled it in chord toolbox; half height of beat-box, below melody row; gap 0–20 px. */
  const figurenotesChordLineHeight = Math.round(figurenotesRowHeight / 2);
  const figurenotesTotalRowHeight = figurenotesChordBlocks
    ? figurenotesRowHeight + figurenotesChordLineGap + figurenotesChordLineHeight
    : figurenotesRowHeight;
  const logicalContentHeight = useMemo(() => {
    if (notationStyle === 'FIGURENOTES') {
      const data = { measures, timeSignature, pixelsPerBeat, staffSpacing: figurenotesTotalRowHeight + layoutSystemGap, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, boxesPerRow: effectiveLayoutMeasuresPerLine || 4, pageWidth: pageWidth || LAYOUT.PAGE_WIDTH_MIN, pageHeight: a4PageHeightPx, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore };
      const sys = calculateLayout('figure', pageOrientation === 'landscape' ? 'landscape' : 'portrait', data);
      const lastY = sys.length > 0 ? sys[sys.length - 1].yOffset + (systemYOffsets[sys.length - 1] ?? 0) : 0;
      return sys.length > 0 ? lastY + figurenotesTotalRowHeight + 40 : figurenotesTotalRowHeight + 40;
    }
    const opts = { measuresPerLine: effectiveLayoutMeasuresPerLine, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore, systemGap: layoutSystemGap, staffCount: staves.length, measureStretchFactors, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, pageHeight: a4PageHeightPx };
    const sys = computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth || LAYOUT.PAGE_WIDTH_MIN, opts);
    const n = staves.length || 1;
    const lastY = sys.length > 0 ? sys[sys.length - 1].yOffset + (systemYOffsets[sys.length - 1] ?? 0) : 0;
    return sys.length > 0 ? lastY + n * getStaffHeight() + 40 : n * getStaffHeight() + 40;
  }, [notationStyle, measures, timeSignature, pixelsPerBeat, pageWidth, pageOrientation, effectiveLayoutMeasuresPerLine, effectiveLayoutLineBreakBefore, effectiveLayoutPageBreakBefore, layoutSystemGap, layoutGlobalSpacingMultiplier, staves.length, measureStretchFactors, systemYOffsets, a4PageHeightPx, figurenotesRowHeight, figurenotesTotalRowHeight, figurenotesSize, figurenotesChordBlocks, figurenotesChordLineGap, figurenotesChordLineHeight]);
  const systemsForScore = useMemo(() => {
    if (notationStyle === 'FIGURENOTES') {
      const data = { measures, timeSignature, pixelsPerBeat, staffSpacing: figurenotesTotalRowHeight + layoutSystemGap, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, boxesPerRow: effectiveLayoutMeasuresPerLine || 4, pageWidth: pageWidth || LAYOUT.PAGE_WIDTH_MIN, pageHeight: a4PageHeightPx, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore };
      const raw = calculateLayout('figure', pageOrientation === 'landscape' ? 'landscape' : 'portrait', data);
      return raw.map((s, i) => ({ ...s, yOffset: s.yOffset + (systemYOffsets[i] ?? 0) }));
    }
    const opts = { measuresPerLine: effectiveLayoutMeasuresPerLine, lineBreakBefore: effectiveLayoutLineBreakBefore, pageBreakBefore: effectiveLayoutPageBreakBefore, systemGap: layoutSystemGap, staffCount: staves.length, measureStretchFactors, globalSpacingMultiplier: layoutGlobalSpacingMultiplier, pageHeight: a4PageHeightPx };
    const raw = computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth || LAYOUT.PAGE_WIDTH_MIN, opts);
    return raw.map((s, i) => ({ ...s, yOffset: s.yOffset + (systemYOffsets[i] ?? 0) }));
  }, [notationStyle, measures, timeSignature, pixelsPerBeat, pageWidth, pageOrientation, effectiveLayoutMeasuresPerLine, effectiveLayoutLineBreakBefore, effectiveLayoutPageBreakBefore, layoutSystemGap, layoutGlobalSpacingMultiplier, staves.length, measureStretchFactors, systemYOffsets, a4PageHeightPx, figurenotesTotalRowHeight, figurenotesChordBlocks]);
  useEffect(() => { systemsForScoreRef.current = systemsForScore; }, [systemsForScore]);
  // Nutikas fookus: ainult valitud read; vähem ridu = suurem rea kõrgus (HEV/solfedž)
  const visibleStaffList = useMemo(() => {
    const list = [];
    staves.forEach((staff, staffIdx) => {
      if (visibleStaves[staffIdx] !== false) list.push({ staff, staffIdx, visibleIndex: list.length });
    });
    return list;
  }, [staves, visibleStaves]);
  const FOCUS_STAFF_HEIGHT = 280; // Kui osa ridu peidetud, suurendatakse nähtavad read (HEV/solfedž)
  const effectiveStaffHeight = notationStyle === 'FIGURENOTES'
    ? figurenotesTotalRowHeight
    : (visibleStaffList.length > 0 && visibleStaffList.length < staves.length
      ? FOCUS_STAFF_HEIGHT
      : getStaffHeight());
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

  // Fit-page scale: so one A4 page fits in the visible main area (do not scale above 1)
  const a4PageHeightVal = (pageWidth || LAYOUT.PAGE_WIDTH_MIN) * LAYOUT.A4_HEIGHT_RATIO;
  const [fitPageScale, setFitPageScale] = useState(1);
  useEffect(() => {
    if (!viewFitPage) {
      setFitPageScale(1);
      return;
    }
    let ro = null;
    const updateScale = () => {
      const target = mainRef.current;
      if (!target) return;
      const pw = pageWidth || LAYOUT.PAGE_WIDTH_MIN;
      const a4H = pw * LAYOUT.A4_HEIGHT_RATIO;
      const availW = target.clientWidth;
      const availH = target.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const scale = Math.min(1, availW / pw, availH / a4H);
      setFitPageScale(scale);
    };
    const raf = requestAnimationFrame(() => {
      updateScale();
      const el = mainRef.current;
      if (el) {
        ro = new ResizeObserver(updateScale);
        ro.observe(el);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, [viewFitPage, pageWidth]);

  // Selection drag (Shift + mouse down and drag across notes) – document-level mouseup ends the drag.
  useEffect(() => {
    const onMouseUp = () => {
      if (selectionDragRef.current) selectionDragRef.current = null;
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
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
    if (noteInputModeRef.current) return;
    if (!e?.shiftKey) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selectionDragRef.current = { startIndex: noteIndex, pointerDown: true, shift: true };
    setNoteInputMode(false);
    setSelectedNoteIndex(noteIndex);
    setSelectionStart(noteIndex);
    setSelectionEnd(noteIndex);
  }, []);

  const updateSelectionDragHover = useCallback((noteIndex, e) => {
    const drag = selectionDragRef.current;
    if (!drag || !drag.pointerDown || !drag.shift) return;
    e?.stopPropagation?.();
    setSelectedNoteIndex(noteIndex);
    setSelectionEnd(noteIndex);
  }, []);

  const handleScoreContentClick = useCallback((e) => {
    if (activeToolbox !== 'textBox') return;
    const rect = e.currentTarget.getBoundingClientRect();
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
      if (!current || !scoreContentRef.current) return;
      if (current.type === 'move') {
        const dx = e.clientX - current.startX;
        const dy = e.clientY - current.startY;
        setTextBoxes((prev) => prev.map((b) => b.id === current.id ? { ...b, x: current.boxStartX + dx, y: current.boxStartY + dy } : b));
      } else if (current.type === 'resize' && current.handle) {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        const minW = 60;
        const minH = 30;
        let { x, y, width, height } = { x: current.boxStartX, y: current.boxStartY, width: current.boxStartW, height: current.boxStartH };
        switch (current.handle) {
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
    const onScrollOrResize = () => updateTextToolPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    if (main) main.addEventListener('scroll', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      if (main) main.removeEventListener('scroll', onScrollOrResize);
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

  if (!isReady) return <div className="loading-screen min-h-screen flex items-center justify-center bg-amber-950 text-amber-100"><span className="animate-pulse">Laen süsteemi...</span></div>;
  if (!icons) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-900/95 text-amber-100">
        {t('loading.tools')}
      </div>
    );
  }
  const { Music2, Clock, Hash, Type, Piano, Palette, Layout, Check, Save, FolderOpen, Plus, Settings, Key, Repeat, Cloud, LogOut, LogIn, UserPlus, User, CloudUpload, CloudDownload, FolderPlus, ChevronDown, Eye, ArrowDown, ArrowRight, Hand, MousePointer } = icons || {};

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
            max={activeTextLineType === 'title' ? 72 : activeTextLineType === 'author' ? 48 : 72}
            step={1}
            value={activeTextLineType === 'title' ? titleFontSize : activeTextLineType === 'author' ? authorFontSize : (activeBox?.fontSize ?? 14)}
            onChange={(e) => {
              const v = Math.max(activeTextLineType === 'author' ? 8 : 10, Math.min(activeTextLineType === 'title' ? 72 : activeTextLineType === 'author' ? 48 : 72, Number(e.target.value)));
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
          {[10, 20, 30, 40, 50, 60, 72].filter((n) => n >= (activeTextLineType === 'author' ? 8 : 10) && n <= (activeTextLineType === 'title' ? 72 : activeTextLineType === 'author' ? 48 : 72)).map((n) => (
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
                    <span className="font-medium text-amber-900">Traditsiooniline noodistik</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'figurenotes'} onChange={() => setWizardNotationMethod('figurenotes')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Figuurnotatsioon (värvid ja kujundid)</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 hover:bg-amber-50 cursor-pointer">
                    <input type="radio" name="wizardNotation" checked={wizardNotationMethod === 'vabanotatsioon'} onChange={() => setWizardNotationMethod('vabanotatsioon')} className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Pedagoogiline notatsioon (solfeeg)</span>
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

      {/* Settings modal – Title, Author, Pickup (post-setup editing) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-6" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white dark:bg-black rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-amber-200 dark:border-white/20" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Seaded</h2>
              <button onClick={() => setSettingsOpen(false)} className="text-white/90 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4 dark:text-white">
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
                      max={24}
                      value={barNumberSize}
                      onChange={(e) => { dirtyRef.current = true; setBarNumberSize(Math.max(8, Math.min(24, Number(e.target.value)))); }}
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
                    max={60}
                    value={pedagogicalPlayheadEmojiSize}
                    onChange={(e) => { dirtyRef.current = true; setPedagogicalPlayheadEmojiSize(Math.max(20, Math.min(60, Number(e.target.value)))); }}
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
                    max={500}
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
                  {[2, 3, 4, 6, 8].map((n) => (
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
                      if (!isNaN(v)) { dirtyRef.current = true; setFigurenotesSize(Math.max(12, Math.min(500, v))); }
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
              {/* Pedagoogiline notatsioon (Kodály relatiivnotatsioon): Do (Jo) võti on alati nähtav; võtmemärk ja traditsiooniline võti valikulised */}
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
                        setPianoStripVisible(false);
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
                      onClick={() => { setPianoStripVisible(false); saveToCloud(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <CloudUpload className="w-4 h-4" /> {t('file.saveCloud')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPianoStripVisible(false); loadFromCloud(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                    >
                      <CloudDownload className="w-4 h-4" /> {t('file.loadCloud')}
                    </button>
                    <div className="my-1 border-t border-slate-600" />
                    {/* Import – visible above Print */}
                    <button
                      type="button"
                      onClick={() => { pageDesignInputRef.current?.click(); setHeaderMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title="Impordi lehe taust (PNG/SVG)"
                    >
                      <Layout className="w-4 h-4" /> Import: Lehe disain (PNG/SVG)
                    </button>
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
                      onClick={() => { exportToPdf(); setHeaderMenuOpen(null); }}
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
                            onClick={() => { setPianoStripVisible(false); setSettingsOpen(true); setHeaderMenuOpen(null); setFileSubmenuOpen(null); }}
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
                    {/* Terve lehekülg ekraanile (paigutus) */}
                    <button
                      type="button"
                      onClick={() => { setViewFitPage((prev) => !prev); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
                      title={t('view.fitPageHint')}
                    >
                      <span>{t('view.fitPage')}</span>
                      {viewFitPage && <Check className="w-4 h-4 text-amber-400" />}
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
                          {code.toUpperCase()}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-medium text-amber-100 whitespace-nowrap">{t('toolbar.lyricLabel')}:</label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setLyricLineIndex(0)} className={`px-1.5 py-0.5 rounded text-xs font-medium ${lyricLineIndex === 0 ? 'bg-amber-300 text-amber-900' : 'bg-amber-800/50 text-amber-100'}`} title={t('toolbar.lyricLine1')}>{t('toolbar.lyricLine1Short')}</button>
                    <button type="button" onClick={() => setLyricLineIndex(1)} className={`px-1.5 py-0.5 rounded text-xs font-medium ${lyricLineIndex === 1 ? 'bg-amber-300 text-amber-900' : 'bg-amber-800/50 text-amber-100'}`} title={t('toolbar.lyricLine2')}>{t('toolbar.lyricLine2Short')}</button>
                  </div>
                  <input
                    ref={lyricInputRef}
                    type="text"
                    value={lyricChainIndex !== null
                      ? (lyricLineIndex === 0 ? (notes[lyricChainIndex]?.lyric ?? '') : (notes[lyricChainIndex]?.lyric2 ?? ''))
                      : (() => {
                          const idx = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
                          const n = notes[idx];
                          if (!n) return '';
                          return lyricLineIndex === 0 ? (n.lyric ?? '') : (n.lyric2 ?? '');
                        })()}
                    onChange={(e) => {
                      const val = e.target.value;
                      const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2';
                      if (lyricChainIndex !== null) {
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => i === lyricChainIndex ? { ...n, [key]: val } : n));
                      } else {
                        const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
                        const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => (i >= start && i <= end) ? { ...n, [key]: val } : n));
                      }
                    }}
                    onKeyDown={(e) => {
                      const start = selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex;
                      const end = selectionStart >= 0 && selectionEnd >= 0 ? Math.max(selectionStart, selectionEnd) : selectedNoteIndex;
                      const idx = lyricChainIndex !== null ? lyricChainIndex : start;
                      const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2';
                      const getVal = (n) => (key === 'lyric' ? (n?.lyric ?? '') : (n?.lyric2 ?? ''));
                      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                      const mod = isMac ? e.metaKey : e.ctrlKey;
                      if (mod && e.shiftKey && e.key === '-') {
                        const currentVal = getVal(notes[idx]);
                        e.preventDefault();
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: currentVal + '_' } : n));
                        return;
                      }
                      if (e.key === '-') {
                        const currentVal = getVal(notes[idx]);
                        e.preventDefault();
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: currentVal + '-' } : n));
                        if (idx < end) {
                          if (lyricChainIndex === null) { setLyricChainStart(start); setLyricChainEnd(end); }
                          setLyricChainIndex(idx + 1);
                          setSelectedNoteIndex(idx + 1);
                        }
                      } else if (e.key === ' ') {
                        const currentVal = getVal(notes[idx]);
                        e.preventDefault();
                        saveToHistory(notes);
                        setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: currentVal + ' ' } : n));
                        if (idx < end) {
                          if (lyricChainIndex === null) { setLyricChainStart(start); setLyricChainEnd(end); }
                          setLyricChainIndex(idx + 1);
                          setSelectedNoteIndex(idx + 1);
                        }
                      } else if (e.key === 'ArrowRight' && (lyricChainIndex !== null || (start <= end && idx < end))) {
                        e.preventDefault();
                        const nextIdx = lyricChainIndex !== null ? Math.min(lyricChainIndex + 1, notes.length - 1) : Math.min(idx + 1, end, notes.length - 1);
                        setLyricChainIndex(nextIdx);
                        setSelectedNoteIndex(nextIdx);
                        if (lyricChainStart < 0) { setLyricChainStart(start); setLyricChainEnd(end); }
                      } else if (e.key === 'ArrowLeft' && (lyricChainIndex !== null || (start <= end && idx > start))) {
                        e.preventDefault();
                        const prevIdx = lyricChainIndex !== null ? Math.max(lyricChainIndex - 1, 0) : Math.max(idx - 1, start, 0);
                        setLyricChainIndex(prevIdx);
                        setSelectedNoteIndex(prevIdx);
                        if (lyricChainStart < 0) { setLyricChainStart(start); setLyricChainEnd(end); }
                      }
                    }}
                    onBlur={() => setLyricChainIndex(null)}
                    placeholder={t('toolbar.lyricPlaceholder')}
                    className="px-2 py-1 rounded text-sm bg-amber-100 text-amber-900 border border-amber-300 w-28 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    title={t('toolbar.lyricTitle')}
                  />
                  <span className="text-amber-600 text-xs">+</span>
                  <div className="flex gap-0.5" role="group" aria-label={t('toolbar.lyricExprMelisma')}>
                    <button type="button" onClick={() => { const idx = lyricChainIndex !== null ? lyricChainIndex : (selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex); const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2'; const cur = key === 'lyric' ? (notes[idx]?.lyric ?? '') : (notes[idx]?.lyric2 ?? ''); saveToHistory(notes); setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: cur + '_' } : n)); lyricInputRef.current?.focus(); }} className="px-1.5 py-0.5 rounded text-sm bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 border border-amber-600/50" title={t('toolbar.lyricExprMelisma')}>_</button>
                    <button type="button" onClick={() => { const idx = lyricChainIndex !== null ? lyricChainIndex : (selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex); const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2'; const cur = key === 'lyric' ? (notes[idx]?.lyric ?? '') : (notes[idx]?.lyric2 ?? ''); saveToHistory(notes); setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: cur + '\u2014' } : n)); lyricInputRef.current?.focus(); }} className="px-1.5 py-0.5 rounded text-sm bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 border border-amber-600/50" title={t('toolbar.lyricExprDash')}>—</button>
                    <button type="button" onClick={() => { const idx = lyricChainIndex !== null ? lyricChainIndex : (selectionStart >= 0 && selectionEnd >= 0 ? Math.min(selectionStart, selectionEnd) : selectedNoteIndex); const key = lyricLineIndex === 0 ? 'lyric' : 'lyric2'; const cur = key === 'lyric' ? (notes[idx]?.lyric ?? '') : (notes[idx]?.lyric2 ?? ''); saveToHistory(notes); setNotes(prev => prev.map((n, i) => i === idx ? { ...n, [key]: cur + '\u00B7' } : n)); lyricInputRef.current?.focus(); }} className="px-1.5 py-0.5 rounded text-sm bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 border border-amber-600/50" title={t('toolbar.lyricExprDot')}>·</button>
                  </div>
                  <label className="text-xs font-medium text-amber-100 whitespace-nowrap">{t('toolbar.lyricLineOffset')}:</label>
                  <input type="number" min={-40} max={40} step={2} value={lyricLineYOffset} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) setLyricLineYOffset(Math.max(-40, Math.min(40, v))); dirtyRef.current = true; }} className="w-14 px-1.5 py-0.5 rounded text-sm bg-amber-100 text-amber-900 border border-amber-300 focus:ring-1 focus:ring-amber-500" title={t('toolbar.lyricLineOffset')} />
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
              onClick={() => {
                setNoteInputMode(prev => {
                  if (!prev) {
                    setSelectedNoteIndex(-1);
                    setSelectionStart(-1);
                    setSelectionEnd(-1);
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
      {(activeToolbox && toolboxes[activeToolbox]) || (pianoStripVisible && !activeToolbox) ? (
        <div className="flex-shrink-0 flex justify-center border-t-2 border-amber-300 bg-amber-100/80 py-2">
          <div className="w-max max-w-[min(100vw-2rem,28rem)] px-3 py-2 rounded-lg bg-gradient-to-b from-amber-100 to-amber-50 border border-amber-300 shadow-inner overflow-auto max-h-[7.5rem]">
            {activeToolbox === 'rhythm' && toolboxes.rhythm ? (
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
                          ) : option.value === 'rest' ? <RhythmIcon duration={selectedDuration} isRest={true} /> : option.value === 'dotted' ? <RhythmIcon duration={selectedDuration} isDotted={true} /> : ['2/8','4/16','8/16','1/8+2/16','2/16+1/8','triplet-8','triplet-4'].includes(option.value) ? <RhythmPatternIcon pattern={option.value} /> : ['1/1','1/2','1/4','1/8','1/16','1/32'].includes(option.value) ? (<><RhythmIcon duration={option.value} /><RhythmIcon duration={option.value} isRest={true} /></>) : null}
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
              </div>
            ) : (activeToolbox || pianoStripVisible) && activeToolbox !== 'rhythm' ? (
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
                    {notationStyle === 'FIGURENOTES' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200">
                        <label htmlFor="timesig-size" className="text-xs font-semibold text-amber-900 shrink-0">{t('timesig.size')}</label>
                        <input
                          id="timesig-size"
                          type="range"
                          min={12}
                          max={48}
                          step={1}
                          value={timeSignatureSize}
                          onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) { dirtyRef.current = true; setTimeSignatureSize(Math.max(12, Math.min(48, v))); } }}
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
                    <input type="text" value={customChordInput} onChange={(e) => setCustomChordInput(e.target.value)} placeholder={t('chords.customPlaceholder')} className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm" />
                    <label className="block text-xs font-semibold text-amber-900">{t('chords.figuredBass')}</label>
                    <input type="text" value={customFiguredBassInput} onChange={(e) => setCustomFiguredBassInput(e.target.value)} placeholder={t('chords.figuredBassPlaceholder')} className="w-full px-2 py-1.5 rounded border border-amber-300 text-sm" />
                    <button
                      type="button"
                      onClick={() => {
                        const raw = customChordInput.trim();
                        if (!raw) return;
                        const chord = normalizeChordHotkey(raw);
                        addChordAt(getChordInsertBeat(), chord, customFiguredBassInput);
                        setCustomChordInput('');
                        setCustomFiguredBassInput('');
                      }}
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
                        <p className="text-xs text-amber-600 mt-2">{t('textBox.selected')}: Delete / Backspace {t('textBox.delete')}. {t('textBox.dragResizeHint')}</p>
                      </>
                    )}
                  </div>
                )}
                <div className="flex flex-col items-start gap-0.5">
                  {activeToolbox === 'instruments' && (
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
                      <span className="text-xs text-amber-800 font-medium ml-1">{t('inst.notationMode')}:</span>
                      {['traditional', 'figurenotes', 'pedagogical'].map((mode) => {
                        const isActive = (activeStaff?.notationMode ?? 'traditional') === mode;
                        const label = mode === 'traditional' ? t('inst.modeT') : mode === 'figurenotes' ? t('inst.modeF') : t('inst.modeP');
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setStaves((prev) => prev.map((s, i) => i === activeStaffIndex ? { ...s, notationMode: mode } : s));
                              setNotationStyle(mode === 'figurenotes' ? 'FIGURENOTES' : 'TRADITIONAL');
                              setNotationMode(mode === 'pedagogical' ? 'vabanotatsioon' : mode === 'figurenotes' ? 'figurenotes' : 'traditional');
                              dirtyRef.current = true;
                            }}
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${isActive ? 'bg-amber-400 text-amber-900 ring-1 ring-amber-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'} border border-amber-300`}
                            title={label}
                          >
                            {mode === 'traditional' ? 'T' : mode === 'figurenotes' ? 'F' : 'P'}
                          </button>
                        );
                      })}
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
                    </div>
                  )}
                  {activeToolbox === 'clefs' && toolboxes.clefs?.options && (
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
                  )}
                  {activeToolbox === 'repeatsJumps' && (
                    <p className="text-xs text-amber-700 mt-1 mb-2 px-1" title={t('repeat.hint')}>{t('repeat.hint')}</p>
                  )}
                  {activeToolbox && activeToolbox !== 'pianoKeyboard' && activeToolbox !== 'rhythm' && activeToolbox !== 'textBox' && activeToolbox !== 'clefs' && toolboxes[activeToolbox]?.options?.map((option, idx) => {
                    if (activeToolbox === 'instruments' && option.type === 'category') return <div key={option.id} className="pt-1.5 pb-0.5 px-1.5 text-xs font-bold text-amber-800 uppercase tracking-wide border-b border-amber-200 first:pt-0">{option.label}</div>;
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
                {activeToolbox === 'instruments' && (() => {
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
                      <div className="flex flex-wrap gap-1 mb-3">{[2, 3, 4, 6, 8].map((n) => (
                        <button key={n} type="button" onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutMeasuresPerLine : setPartLayoutMeasuresPerLine)(n); }} className={`px-2 py-1 rounded text-sm font-medium ${effectiveLayoutMeasuresPerLine === n ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{n}</button>
                      ))}</div>
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-1">{t('layout.partsGap')} (px)</h4>
                        <p className="text-xs text-amber-700 mb-1">{t('layout.partsGapHint')}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={2}
                            max={80}
                            step={2}
                            value={layoutPartsGap}
                            onChange={(e) => { dirtyRef.current = true; setLayoutPartsGap(Math.max(2, Math.min(80, Number(e.target.value)))); }}
                            className="flex-1 h-2 rounded-lg appearance-none bg-amber-200 accent-amber-600"
                          />
                          <span className="text-sm font-medium text-amber-900 w-10 tabular-nums">{layoutPartsGap}</span>
                        </div>
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
                            checked={layoutConnectedBarlines}
                            onChange={(e) => { dirtyRef.current = true; setLayoutConnectedBarlines(e.target.checked); }}
                            className="mt-1 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>
                            <span className="text-sm font-semibold text-amber-900 block">{t('layout.connectedBarlines')}</span>
                            <span className="text-xs text-amber-700">{t('layout.connectedBarlinesHint')}</span>
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
                          max={500}
                            step={1}
                            value={figurenotesSize}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) { dirtyRef.current = true; setFigurenotesSize(Math.max(12, Math.min(500, v))); }
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
                      <p className="text-xs text-amber-700 mb-2 py-1.5 px-2 rounded bg-slate-100 border border-slate-200 text-slate-800">{t('layout.staffSpacerHint')}</p>
                      <p className="text-xs text-amber-700 mb-1">Paigutuse muudatus kehtib kursorit sisaldava takti suhtes. Liigu kursoriga (← →) soovitud takti.</p>
                      <div className="mb-2 px-2 py-1.5 rounded bg-amber-100 border border-amber-200 text-amber-900 text-sm font-medium">{t('layout.cursorInMeasure')}: {cursorMeasureIndex + 1}</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { if (cursorMeasureIndex <= 0) return; dirtyRef.current = true; (viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore)((prev) => [...new Set([...prev, cursorMeasureIndex])].sort((a, b) => a - b)); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.nextLine')}</button>
                        <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { if (cursorMeasureIndex <= 0) return; dirtyRef.current = true; (viewMode === 'score' ? setLayoutPageBreakBefore : setPartLayoutPageBreakBefore)((prev) => [...new Set([...prev, cursorMeasureIndex])].sort((a, b) => a - b)); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.newPage')}</button>
                        <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore)((prev) => prev.filter((i) => i !== cursorMeasureIndex)); }} className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.removeLineBreak')}</button>
                        <button type="button" disabled={cursorMeasureIndex <= 0} onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutPageBreakBefore : setPartLayoutPageBreakBefore)((prev) => prev.filter((i) => i !== cursorMeasureIndex)); }} className="py-1.5 px-2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('layout.removePageBreak')}</button>
                      </div>
                      <p className="text-xs text-amber-700 mt-2 mb-1">{t('layout.measureWidthHint')}</p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <button type="button" title={t('layout.compressMeasureShortcut')} onClick={() => { dirtyRef.current = true; setMeasureStretchFactors((prev) => { const next = [...(prev || [])]; while (next.length <= cursorMeasureIndex) next.push(1); next[cursorMeasureIndex] = Math.max(0.25, (next[cursorMeasureIndex] ?? 1) - 0.1); return next; }); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium">{t('layout.compressMeasure')}</button>
                        <button type="button" title={t('layout.stretchMeasureShortcut')} onClick={() => { dirtyRef.current = true; setMeasureStretchFactors((prev) => { const next = [...(prev || [])]; while (next.length <= cursorMeasureIndex) next.push(1); next[cursorMeasureIndex] = Math.min(4, (next[cursorMeasureIndex] ?? 1) + 0.1); return next; }); }} className="py-1.5 px-2 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium">{t('layout.stretchMeasure')}</button>
                      </div>
                      <button type="button" onClick={() => { dirtyRef.current = true; (viewMode === 'score' ? setLayoutLineBreakBefore : setPartLayoutLineBreakBefore)([]); (viewMode === 'score' ? setLayoutPageBreakBefore : setPartLayoutPageBreakBefore)([]); (viewMode === 'score' ? setLayoutMeasuresPerLine : setPartLayoutMeasuresPerLine)(0); setMeasureStretchFactors([]); setSystemYOffsets([]); setLayoutSystemGap(15); setLayoutPartsGap(10); setLayoutConnectedBarlines(true); setLayoutGlobalSpacingMultiplier(1); setPixelsPerBeat(75); }} className="mt-3 w-full py-2 px-3 rounded-lg bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200 border border-slate-300" title={t('layout.resetLayoutHint')}>{t('layout.resetLayout')}</button>
                    </div>
                    {pageDesignDataUrl && (
                      <div className="mt-4 pt-4 border-t-2 border-amber-200">
                        <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.pageDesignLayerTitle')}</h4>
                        <p className="text-xs text-amber-700 mb-2">{t('layout.pageDesignLayerHint')}</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageDesignLayer('behind'); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${pageDesignLayer === 'behind' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('layout.pageDesignLayerBehind')}</button>
                          <button type="button" onClick={() => { dirtyRef.current = true; setPageDesignLayer('inFront'); }} className={`flex-1 py-1.5 px-2 rounded text-sm font-medium ${pageDesignLayer === 'inFront' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{t('layout.pageDesignLayerInFront')}</button>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t-2 border-amber-200">
                      <h4 className="text-xs font-bold text-amber-900 uppercase mb-2">{t('layout.projectFile')}</h4>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={downloadProject} className="w-full py-2 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500">{t('layout.saveProject')}</button>
                        <button type="button" onClick={() => { setPianoStripVisible(false); projectFileInputRef.current?.click(); }} className="w-full py-2 px-3 rounded-lg bg-slate-600 text-white text-sm font-semibold hover:bg-slate-500">{t('layout.openProject')}</button>
                        <input ref={projectFileInputRef} type="file" accept=".json,.noodimeister,application/json" className="hidden" onChange={handleOpenProjectFile} />
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      </div>

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
                    if (id === 'pianoKeyboard') {
                      setPianoStripVisible((prev) => {
                        if (!prev) {
                          setActiveToolbox('pianoKeyboard');
                          return true;
                        }
                        setActiveToolbox(null);
                        return false;
                      });
                    } else {
                      setActiveToolbox(activeToolbox === id ? null : id);
                    }
                    setSelectedOptionIndex(0);
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                    (id === 'pianoKeyboard' ? pianoStripVisible : activeToolbox === id)
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
          onScroll={(e) => { setMainScrollTop(e.target.scrollTop); setMainScrollLeft(e.target.scrollLeft); }}
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
            const a4PageHeightVal = (pageWidth || LAYOUT.PAGE_WIDTH_MIN) * LAYOUT.A4_HEIGHT_RATIO;
            const contentHeightForPages = pageFlowDirection === 'horizontal' ? (lastVerticalContentHeightRef.current || logicalContentHeight) : mainContentHeight;
            const totalPagesVal = Math.max(1, Math.ceil((contentHeightForPages || logicalContentHeight) / a4PageHeightVal));
            const isHorizontalFlow = pageFlowDirection === 'horizontal';
            // When viewFitPage, use logical height so wrapper size is stable (mainContentHeight becomes scaled after first paint)
            const contentH = viewFitPage ? (logicalContentHeight || 800) : (mainContentHeight || logicalContentHeight || 800);
            const pw = pageWidth || LAYOUT.PAGE_WIDTH_MIN;
            return (
          <div
            className={isHorizontalFlow ? 'flex-shrink-0' : ''}
            style={isHorizontalFlow ? { width: totalPagesVal * pw, height: a4PageHeightVal } : undefined}
          >
          {/* When viewFitPage: scale so one A4 page fits in viewport; wrapper sets scroll size, inner applies scale */}
          <div
            ref={viewFitPage ? mainAreaRef : undefined}
            style={viewFitPage ? { position: 'relative', width: pw * fitPageScale, minHeight: contentH * fitPageScale } : undefined}
          >
            <div
              style={viewFitPage ? { position: 'absolute', left: 0, top: 0, width: pw, height: contentH, transform: `scale(${fitPageScale})`, transformOrigin: 'top left' } : undefined}
            >
          <div
            ref={scoreContainerRef}
            className={`noodimeister-print-area print-page-${paperSize}-${pageFlowDirection === 'horizontal' ? 'landscape' : pageOrientation} relative mx-auto p-8 flex-1 transition-colors ${isHorizontalFlow ? '' : 'rounded-lg shadow-lg border-2 border-amber-200 dark:border-white/20'}`}
            style={{
              backgroundColor: themeColors.scoreBg,
              minWidth: LAYOUT.PAGE_WIDTH_MIN,
              maxWidth: pageOrientation === 'landscape' ? LAYOUT.PAGE_WIDTH_MAX_LANDSCAPE : LAYOUT.PAGE_WIDTH_MAX,
              minHeight: Math.max(500, getStaffHeight() + LAYOUT.SYSTEM_GAP + getStaffHeight() + 120),
              ...(isHorizontalFlow ? { width: totalPagesVal * (pageWidth || LAYOUT.PAGE_WIDTH_MIN), height: a4PageHeightVal } : {})
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
          >
              {pageDesignDataUrl && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    zIndex: pageDesignLayer === 'inFront' ? 1 : 0,
                    backgroundImage: `url(${pageDesignDataUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: pageDesignFit === 'contain' ? 'contain' : 'cover',
                    opacity: clampNumber(Number(pageDesignOpacity) || 0.25, 0, 1),
                  }}
                />
              )}
              <div
                ref={scoreContentRef}
                className="relative"
                style={{ zIndex: pageDesignLayer === 'inFront' ? 0 : 1, cursor: cursorTool === 'hand' ? (isHandPanning ? 'grabbing' : 'grab') : undefined }}
                onClick={handleScoreContentClick}
                onMouseDown={(e) => {
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
                  // Right-click paste in SEL mode (selection mode).
                  if (noteInputModeRef.current) return;
                  if (!clipboard || clipboard.length <= 0) return;
                  e.preventDefault();
                  const insertBase = selectedNoteIndex >= 0 ? selectedNoteIndex : -1;
                  const insertIndex = Math.max(0, Math.min(notes.length, insertBase + 1));
                  const pastedNotes = clipboard.map(note => ({ ...note, id: Date.now() + Math.random() }));
                  const newNotes = [...notes];
                  newNotes.splice(insertIndex, 0, ...pastedNotes);
                  saveToHistory(notes);
                  setNotes(newNotes);
                }}
                role="presentation"
              >
              {/* Pealkiri muudetav otse lehel (nagu Google Docs); horizontal: constrained to first page width so title is centered on first page */}
              <div
                className="mb-4"
                style={isHorizontalFlow ? { width: pageWidth || LAYOUT.PAGE_WIDTH_MIN, flexShrink: 0 } : undefined}
              >
                <input
                  ref={titleInputRef}
                  type="text"
                  value={songTitle}
                  onChange={(e) => { dirtyRef.current = true; setSongTitle(e.target.value); }}
                  onFocus={() => { setActiveTextLineType('title'); setSelectedTextboxId(null); }}
                  onBlur={() => setActiveTextLineType((prev) => (prev === 'title' ? null : prev))}
                  placeholder="Nimetu"
                  className="w-full text-center text-amber-900 dark:text-white bg-transparent border-0 border-b-2 border-transparent hover:border-amber-300 dark:hover:border-white/30 focus:border-amber-500 dark:focus:border-amber-500 focus:outline-none focus:ring-0 py-0"
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
                  onBlur={() => setActiveTextLineType((prev) => (prev === 'author' ? null : prev))}
                  placeholder={t('score.authorPlaceholder') || 'Autor'}
                  className="w-full text-right text-amber-700 dark:text-white/80 bg-transparent border-0 border-b border-transparent hover:border-amber-300 dark:hover:border-white/30 focus:border-amber-500 dark:focus:border-amber-500 focus:outline-none focus:ring-0 py-0 mt-1 text-sm"
                  style={{
                    fontFamily: authorFontFamily || documentFontFamily,
                    fontSize: authorFontSize,
                    fontWeight: authorBold ? 'bold' : undefined,
                    fontStyle: authorItalic ? 'italic' : undefined,
                  }}
                  title={t('textBox.documentFontHint')}
                />
              </div>
              {/* Õpetaja režiimi tööriistariba (pedagoogiline notatsioon) */}
              {notationMode === 'vabanotatsioon' && (
                <div className="mb-3 flex flex-wrap items-center gap-3 px-2 py-2 rounded-lg bg-amber-50 border border-amber-200">
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
              {(visibleStaffList.length > 0 ? visibleStaffList : staves.map((staff, i) => ({ staff, staffIdx: i, visibleIndex: i }))).map(({ staff, staffIdx, visibleIndex }) => {
                const isFirstInBraceGroup = staff.braceGroupId && staves[staffIdx + 1]?.braceGroupId === staff.braceGroupId;
                const braceGroupSize = isFirstInBraceGroup ? 2 : 0;
                const partsGap = layoutPartsGap;
                const baseYOffset = visibleIndex * (effectiveStaffHeight + partsGap) + (staffYOffsets[staffIdx] ?? 0);
                const isFirstVisible = visibleIndex === 0;
                return (
                <Timeline
                  key={staff.id}
                  measures={measuresWithMarks}
                  pageWidth={pageWidth}
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
                    }
                    setKeySignature(newKey);
                    setJoClefStaffPosition(getTonicStaffPosition(newKey));
                  } : undefined}
                  joClefStaffPosition={joClefStaffPosition}
                  joClefFocused={joClefFocused}
                  onJoClefFocus={notationMode === 'vabanotatsioon' ? setJoClefFocused : undefined}
                  instrument={staff.instrumentId}
                  instrumentNotationVariant={instrumentNotationVariant}
                  instrumentConfig={instrumentConfig}
                  isDotted={isDotted}
                  isRest={isRest}
                  selectedDuration={selectedDuration}
                  noteInputMode={noteInputMode}
                  selectedNoteIndex={staffIdx === activeStaffIndex ? selectedNoteIndex : -1}
                  isNoteSelected={isNoteSelected}
                  notes={staff.notes}
                  onStaffAddNote={staffIdx === activeStaffIndex ? addNoteAtCursor : undefined}
                  onNoteClick={staffIdx === activeStaffIndex ? (index) => {
                    setSelectedNoteIndex(index);
                    setSelectionStart(-1);
                    setSelectionEnd(-1);
                    setNoteInputMode(false);
                    if (cursorTool === 'type') {
                      setLyricChainStart(index);
                      setLyricChainEnd(index);
                      setLyricChainIndex(index);
                      setTimeout(() => lyricInputRef.current?.focus(), 0);
                    }
                  } : () => setActiveStaffIndex(staffIdx)}
                  onNoteMouseDown={staffIdx === activeStaffIndex ? beginSelectionDrag : undefined}
                  onNoteMouseEnter={staffIdx === activeStaffIndex ? updateSelectionDragHover : undefined}
                  onNotePitchChange={staffIdx === activeStaffIndex ? onNotePitchChange : undefined}
                  onNoteBeatChange={staffIdx === activeStaffIndex ? onNoteBeatChange : undefined}
                  canHandDragNotes={cursorTool === 'hand'}
                  ghostPitch={ghostPitch}
                  ghostOctave={ghostOctave}
                  onFigureBeatClick={notationStyle === 'FIGURENOTES' && staffIdx === activeStaffIndex ? (beatPosition) => {
                    if (!noteInputModeRef.current) return;
                    addNoteAtCursor(ghostPitch || 'C', ghostOctave ?? 4, undefined, { insertAtBeat: beatPosition });
                  } : undefined}
                  onChordLineMouseMove={notationStyle === 'FIGURENOTES' && figurenotesChordBlocks && staffIdx === activeStaffIndex ? setCursorPosition : undefined}
                  notationStyle={notationStyle}
                  layoutMeasuresPerLine={effectiveLayoutMeasuresPerLine}
                  layoutLineBreakBefore={effectiveLayoutLineBreakBefore}
                  layoutPageBreakBefore={effectiveLayoutPageBreakBefore}
                  layoutSystemGap={layoutSystemGap}
                  layoutPartsGap={layoutPartsGap}
                  layoutConnectedBarlines={layoutConnectedBarlines}
                  staffIndexInScore={visibleIndex}
                  systemTotalHeight={((visibleStaffList.length > 0 ? visibleStaffList.length : staves.length) * (effectiveStaffHeight + layoutPartsGap)) - layoutPartsGap}
                  layoutGlobalSpacingMultiplier={layoutGlobalSpacingMultiplier}
                  showLayoutBreakIcons={false}
                  showStaffSpacerHandles={true}
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
                  systems={systemsForScore}
                  baseYOffset={baseYOffset}
                  isActiveStaff={staffIdx === activeStaffIndex}
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
                  onNoteLabelClick={staffIdx === activeStaffIndex ? (index) => { setSelectedNoteIndex(index); setSelectionStart(-1); setSelectionEnd(-1); } : undefined}
                  translateLabel={t}
                  chords={chords}
                  figurenotesSize={figurenotesSize}
                  figurenotesStems={figurenotesStems}
                  figurenotesChordLineGap={figurenotesChordBlocks ? figurenotesChordLineGap : 0}
                  figurenotesChordBlocks={figurenotesChordBlocks}
                  figurenotesRowHeight={figurenotesRowHeight}
                  figurenotesChordLineHeight={figurenotesChordBlocks ? figurenotesChordLineHeight : 0}
                  timeSignatureSize={timeSignatureSize}
                  themeColors={themeColors}
                  pedagogicalPlayheadStyle={pedagogicalPlayheadStyle}
                  pedagogicalPlayheadEmoji={pedagogicalPlayheadEmoji}
                  pedagogicalPlayheadEmojiSize={pedagogicalPlayheadEmojiSize}
                  cursorSizePx={cursorSizePx}
                  cursorLineStrokeWidth={cursorLineStrokeWidth}
                  pedagogicalPlayheadMovement={pedagogicalPlayheadMovement}
                  isPedagogicalAudioPlaying={isPedagogicalAudioPlaying}
                  isExportingAnimation={isExportingAnimation}
                  exportCursorRef={isFirstVisible ? exportCursorRef : undefined}
                  scoreContainerRef={isFirstVisible ? scoreContainerRef : undefined}
                  pageFlowDirection={pageFlowDirection}
                  lyricFontFamily={lyricFontFamily}
                  lyricLineYOffset={lyricLineYOffset}
                />
              );})}
          </div>
          {/* Puhkehetkede sildid: suur tekst, kui kursor on antud löökide vahel (video/animatsioon) */}
          {intermissionLabels.some((lab) => cursorPosition >= lab.startBeat && cursorPosition < lab.endBeat) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-amber-50/95 z-10" aria-hidden="true">
              <p className="text-2xl sm:text-4xl font-bold text-center text-amber-900 px-4 py-6 max-w-2xl" style={{ fontFamily: documentFontFamily }}>
                {intermissionLabels.find((lab) => cursorPosition >= lab.startBeat && cursorPosition < lab.endBeat)?.text || ''}
              </p>
            </div>
          )}
          {/* Teksti kastid overlay – vabalt paigutatavad laulutekstid, kommentaarid ja tempo */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {textBoxes.map((box) => {
              const w = box.width ?? 200;
              const h = box.height ?? 60;
              const align = box.textAlign ?? 'center';
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
                    <span className="flex-1 min-w-0 block" style={{ textAlign: align }}>{box.text}</span>
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
            );
          })()}
        </main>

        {/* Lehekülgede / ekraani vaate navigaator – kui dokument on pikem kui üks A4 leht */}
        {showPageNavigator && (mainContentHeight > 0 || lastVerticalContentHeightRef.current > 0 || logicalContentHeight > 0) && (() => {
          const a4PageHeight = (pageWidth || LAYOUT.PAGE_WIDTH_MIN) * LAYOUT.A4_HEIGHT_RATIO;
          const a4PageWidth = pageWidth || LAYOUT.PAGE_WIDTH_MIN;
          const contentH = pageFlowDirection === 'horizontal' ? (lastVerticalContentHeightRef.current || logicalContentHeight) : mainContentHeight;
          const totalPages = Math.max(1, Math.ceil((contentH || logicalContentHeight) / a4PageHeight));
          if (totalPages <= 1) return null;
          const isHorizontalFlow = pageFlowDirection === 'horizontal';
          const pageStepV = viewFitPage ? a4PageHeight * fitPageScale : a4PageHeight;
          const pageStepH = viewFitPage ? a4PageWidth * fitPageScale : a4PageWidth;
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
              const { pitch, octave } = midiToPitchOctave(midiNumber);
              const accidental = getAccidentalForPianoKey(midiNumber, keySignature);
              setGhostPitch(pitch);
              setGhostOctave(octave);
              if (noteInputMode) addNoteAtCursor(pitch, octave, accidental, { skipPlay: true });
              /* Heli teeb InteractivePiano (Oscillator); noot lisatakse massiivi ja joonestik uuendub */
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
                      getKeyColor={notationMode === 'vabanotatsioon' ? (pitch, oct) => getPedagogicalSymbol(keySignature, joClefStaffPosition, pitch, oct).color : null}
                      keySignature={keySignature}
                      keyboardPlaysPiano={pianoStripVisible && (notationStyle === 'FIGURENOTES' || notationMode === 'vabanotatsioon')}
                      ignoreKeyboardWhenModalOpen={newWorkSetupOpen || saveCloudDialogOpen || settingsOpen}
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
function Timeline({ measures, timeSignature, timeSignatureMode, pixelsPerBeat, pageWidth, cursorPosition, notationMode, staffLines, clefType, keySignature = 'C', relativeNotationShowKeySignature = false, relativeNotationShowTraditionalClef = false, onJoClefPositionChange, joClefFocused = false, onJoClefFocus, instrument = 'single-staff-treble', instrumentNotationVariant = 'standard', instrumentConfig = {}, showBarNumbers = true, barNumberSize = 11, showRhythmSyllables = false, joClefStaffPosition: joClefStaffPositionProp, showAllNoteLabels = false, enableEmojiOverlays = true, noteheadShape = 'oval', noteheadEmoji = '♪', onNoteTeacherLabelChange, onNoteLabelClick, chords = [], isDotted, isRest, selectedDuration, noteInputMode, selectedNoteIndex, isNoteSelected, notes: allNotes, onStaffAddNote, onNoteClick, onNoteMouseDown, onNoteMouseEnter, onNotePitchChange, onNoteBeatChange, canHandDragNotes = false, ghostPitch, ghostOctave, onFigureBeatClick, onChordLineMouseMove, notationStyle, layoutMeasuresPerLine = 4, layoutLineBreakBefore = [], layoutPageBreakBefore = [], layoutSystemGap = 120, layoutPartsGap, layoutConnectedBarlines = false, staffIndexInScore = 0, systemTotalHeight, layoutGlobalSpacingMultiplier = 1, systems: systemsProp, baseYOffset = 0, isActiveStaff = true, staffCount = 1, staffHeight: staffHeightProp, figurenotesSize = 16, figurenotesStems = false, figurenotesChordLineGap = 6, figurenotesChordBlocks = false, figurenotesRowHeight: figurenotesRowHeightProp, figurenotesChordLineHeight: figurenotesChordLineHeightProp, timeSignatureSize = 16, themeColors: themeColorsProp, pedagogicalPlayheadStyle = 'line', pedagogicalPlayheadEmoji = '🎵', pedagogicalPlayheadEmojiSize = 32, cursorSizePx, cursorLineStrokeWidth = 4, pedagogicalPlayheadMovement = 'arch', isPedagogicalAudioPlaying = false, isExportingAnimation = false, exportCursorRef, scoreContainerRef, pageFlowDirection = 'vertical', isFirstInBraceGroup = false, braceGroupSize = 0, lyricFontFamily = 'sans-serif', lyricLineYOffset = 0, translateLabel, showLayoutBreakIcons = false, showStaffSpacerHandles = false, onSystemYOffsetChange, onToggleLineBreakAfter }) {
  if (typeof GLOBAL_NOTATION_CONFIG === 'undefined' || !GLOBAL_NOTATION_CONFIG || GLOBAL_NOTATION_CONFIG.EMOJIS === false) return null;
  const themeColors = themeColorsProp || { staffLineColor: '#000', noteFill: '#1a1a1a', textColor: '#1a1a1a', scoreBg: '#fffbf0', isDark: false };
  const safeKey = keySignature ?? 'C';
  const joClefStaffPosition = typeof joClefStaffPositionProp === 'number' ? joClefStaffPositionProp : getTonicStaffPosition(safeKey);
  if (typeof joClefStaffPosition !== 'number') return null;
  const isFigurenotesMode = notationStyle === 'FIGURENOTES';
  const instCfg = instrumentConfig[instrument];
  const isTabMode = instCfg?.type === 'tab' && instrumentNotationVariant === 'tab';
  const isFingeringMode = instCfg?.type === 'wind' && instCfg?.fingering && instrumentNotationVariant === 'fingering';
  const tabStrings = isTabMode && instCfg?.strings ? instCfg.strings : 0;
  const tabTuning = isTabMode && instCfg?.tuning ? instCfg.tuning : [];

  const timelineHeight = staffHeightProp ?? getStaffHeight();
  const barLineWidth = isFigurenotesMode ? Math.max(2, Math.round(5 * figurenotesSize / 75)) : 2;
  /** Cursor/playhead line inset so it aligns with beat-box (scaled with Noodigraafika suurus in figurenotes). */
  // Keep cursor line strictly between staff/beat-box lines (no overlap on top or bottom). In figurenotes use melody row only (not chord line).
  const cursorRowHeight = isFigurenotesMode && (figurenotesRowHeightProp != null && figurenotesRowHeightProp > 0)
    ? figurenotesRowHeightProp
    : timelineHeight;
  const cursorInset = isFigurenotesMode
    ? Math.max(8, Math.min(20, Math.round(cursorRowHeight * 0.1)))
    : 5;
  const cursorY2 = cursorRowHeight - cursorInset;
  const BEAT_BOX_STROKE = '#b0b0b0';
  const layoutOptions = {
    measuresPerLine: layoutMeasuresPerLine,
    lineBreakBefore: layoutLineBreakBefore,
    pageBreakBefore: layoutPageBreakBefore,
    systemGap: layoutSystemGap,
    staffCount,
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
  const totalHeight = systemsComputed.length > 0
    ? systemsComputed[systemsComputed.length - 1].yOffset + (staffCount || 1) * timelineHeight + 40
    : (staffCount || 1) * timelineHeight + 40;
  const isHorizontal = pageFlowDirection === 'horizontal';
  const a4PageHeight = (pageWidth || LAYOUT.PAGE_WIDTH_MIN) * LAYOUT.A4_HEIGHT_RATIO;
  const totalPages = Math.max(1, Math.ceil(totalHeight / a4PageHeight));
  const centerY = timelineHeight / 2;
  const marginLeft = LAYOUT.MARGIN_LEFT;

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
  const middleLineY = centerY; // B4 treble / D3 bass

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

  // Helistiku toonika (I aste) noodijoonestiku positsiooni jaoks: [pitch, octave]. Kõik helistikud.
  const KEY_TONIC_FOR_STAFF = { C: ['C', 4], G: ['G', 4], D: ['D', 4], A: ['A', 4], E: ['E', 4], B: ['B', 4], F: ['F', 4], Bb: ['B', 4], Eb: ['E', 4] };
  // JO-võtme lohistamisel: (pitch, octave) → helistik (looduslikud astmed C,D,E,F,G,A,B).
  const STAFF_PITCH_TO_KEY = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' };

  // JO-võti on rakenduse nullpunkt: noteY = joKeyY + relativeIntervalOffset (StaffConstants.getVerticalPositionFromJoAnchor).
  const joKeyY = getYFromStaffPosition(joClefStaffPosition, centerY, 5, spacing);
  const effectiveClefForPitch = notationMode === 'vabanotatsioon' ? 'jo' : clefType;
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
  const getPitchFromY = (clickY) => {
    if (staffLines !== 5 || !onStaffAddNote) return null;
    if (notationMode === 'vabanotatsioon') {
      return getPitchFromJoClick(clickY, joKeyY, keySignature, spacing);
    }
    const bottomY = centerY + spacing * 2;
    const relToPitch = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const index = Math.round((bottomY - clickY) * 2 / spacing);
    if (clefType === 'treble') {
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
    for (const sys of systems) {
      const staffTop = sys.yOffset;
      const staffBottom = sys.yOffset + timelineHeight;
      if (clickY >= staffTop - 15 && clickY <= staffBottom + 15) {
        const localY = clickY - sys.yOffset;
        const pitchInfo = getPitchFromY(localY);
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
    const { color, shape } = getFigureSymbol(note.pitch, note.octave);
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
      const strokeW = Math.max(2, size * 0.38);
      const strokeShape = isSelected ? '#2563eb' : (themeColors.isDark ? '#ffffff' : '#000');
      const strokeWShape = isSelected ? 3 : (themeColors.isDark ? 2.5 : 2);
      if (shape === 'none') {
        return (
          <rect x={x - r} y={y - r} width={size} height={size} fill="none" stroke={strokeShape} strokeWidth={strokeWShape} strokeDasharray="2 2" opacity={0.6} />
        );
      }
      if (shape === 'cross') {
        const crossStyle = getOctave2CrossStyle(note.pitch);
        const crossStrokeW = crossStyle.strokeWidth ? Math.max(0.5, size * 0.02) : 0;
        const x0 = x - r, x1 = x - 0.8 * r, x2 = x - 0.68 * r, x3 = x + 0.68 * r, x4 = x + 0.8 * r, x5 = x + r;
        const y0 = y - r, y1 = y - 0.8 * r, y2 = y - 0.68 * r, y3 = y + 0.68 * r, y4 = y + 0.8 * r, y5 = y + r;
        return (
          <g>
            <path d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} L${x4} ${y4} L${x5} ${y3} L${x0} ${y2} Z`} fill={crossStyle.fill} stroke={crossStyle.stroke} strokeWidth={crossStrokeW} />
            <path d={`M${x4} ${y1} L${x3} ${y2} L${x2} ${y3} L${x1} ${y4} L${x0} ${y3} L${x5} ${y2} Z`} fill={crossStyle.fill} stroke={crossStyle.stroke} strokeWidth={crossStrokeW} />
            <rect x={x - r} y={y - r} width={size} height={size} fill="none" stroke={strokeShape} strokeWidth={strokeWShape} />
          </g>
        );
      }
      if (shape === 'circle') {
        return (
          <circle cx={x} cy={y} r={r} fill={color} stroke={strokeShape} strokeWidth={strokeWShape} />
        );
      }
      if (shape === 'square') {
        return (
          <rect x={x - r} y={y - r} width={size} height={size} fill={color} stroke={strokeShape} strokeWidth={strokeWShape} />
        );
      }
      if (shape === 'triangle') {
        const h = size * 0.866;
        return (
          <path
            d={`M ${x} ${y - h / 2} L ${x + size / 2} ${y + h / 2} L ${x - size / 2} ${y + h / 2} Z`}
            fill={color}
            stroke={strokeShape}
            strokeWidth={strokeWShape}
          />
        );
      }
      if (shape === 'triangleDown') {
        const h = size * 0.866;
        return (
          <path
            d={`M ${x} ${y + h / 2} L ${x + size / 2} ${y - h / 2} L ${x - size / 2} ${y - h / 2} Z`}
            fill={color}
            stroke={strokeShape}
            strokeWidth={strokeWShape}
          />
        );
      }
      return null;
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
        {/* Alteratsiooninool: ♯ = nool paremale üles (↗), ♭ = nool vasakule üles (↖). Skaleeritud figurenotesSize-ga, et oleks nähtav ka suurendatud režiimis. */}
        {(note.accidental === 1 || note.accidental === -1) && (() => {
          const arrowY = y - size / 2 - Math.max(8, figurenotesSize * 0.4);
          const arrowLen = Math.max(14, figurenotesSize * 0.85);
          const head = Math.max(5, figurenotesSize * 0.32);
          const strokeW = Math.max(1.5, figurenotesSize * 0.1);
          const stroke = '#1a1a1a';
          if (note.accidental === 1) {
            return (
              <g stroke={stroke} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
                <line x1={x - arrowLen / 2} y1={arrowY + arrowLen / 2} x2={x + arrowLen / 2} y2={arrowY - arrowLen / 2} />
                <path d={`M ${x + arrowLen / 2} ${arrowY - arrowLen / 2} L ${x + arrowLen / 2 - head} ${arrowY - arrowLen / 2 + head * 0.6} M ${x + arrowLen / 2} ${arrowY - arrowLen / 2} L ${x + arrowLen / 2 - head * 0.6} ${arrowY - arrowLen / 2 + head}`} />
              </g>
            );
          }
          return (
            <g stroke={stroke} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
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
  const getSystemTotalBeats = (sys) => sys.measureIndices.reduce((sum, i) => sum + (effectiveMeasures[i].beatCount ?? beatsPerMeasure), 0);
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
      const beatCount = m.beatCount ?? beatsPerMeasure;
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

  const svgWidth = isHorizontal ? totalPages * (pageWidth || LAYOUT.PAGE_WIDTH_MIN) : '100%';
  const svgHeight = isHorizontal ? a4PageHeight : totalHeight;
  var viewBoxW = typeof svgWidth === 'number' ? svgWidth : (pageWidth || LAYOUT.PAGE_WIDTH_MIN);
  var viewBoxH = typeof svgHeight === 'number' ? svgHeight : totalHeight;

  return (
    <svg
      ref={timelineSvgRef}
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
      preserveAspectRatio="xMidYMin meet"
      className={`overflow-visible ${noteInputMode ? 'cursor-pointer' : ''}`}
      onClick={handleStaffClick}
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') handleStaffClick(e); }}
      style={isHorizontal ? { display: 'block', minWidth: svgWidth } : undefined}
    >
      {/* No canvas/SVG background: paper style comes from the score container (CSS) like Docs/MuseScore */}
      {isFigurenotesMode ? (
        <FigurenotesView
          systems={systems}
          effectiveMeasures={effectiveMeasures}
          marginLeft={marginLeft}
          timelineHeight={figurenotesRowHeightProp ?? timelineHeight}
          chordLineGap={figurenotesChordBlocks ? figurenotesChordLineGap : 0}
          chordLineHeight={figurenotesChordBlocks ? (figurenotesChordLineHeightProp ?? Math.round((figurenotesRowHeightProp ?? timelineHeight) / 2)) : 0}
          chordBlocksEnabled={figurenotesChordBlocks}
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
          showRhythmSyllables={showRhythmSyllables}
          lyricFontFamily={lyricFontFamily}
          lyricLineYOffset={lyricLineYOffset}
          isHorizontal={isHorizontal}
          a4PageHeight={a4PageHeight}
          pageFlowDirection={pageFlowDirection}
          figureBaseWidth={FIGURE_BASE_WIDTH * (layoutGlobalSpacingMultiplier ?? 1)}
          showStaffSpacerHandles={showStaffSpacerHandles && typeof onSystemYOffsetChange === 'function'}
          onStaffSpacerMouseDown={typeof onSystemYOffsetChange === 'function' ? (systemIndex) => (e) => { e.stopPropagation(); setStaffSpacerDrag({ systemIndex, startClientY: e.clientY, cumulativeDelta: 0 }); } : undefined}
          themeColors={themeColors}
        />
      ) : (
        <TraditionalNotationView
          systems={systems}
          effectiveMeasures={effectiveMeasures}
          marginLeft={marginLeft}
          timelineHeight={timelineHeight}
          pageWidth={pageWidth || LAYOUT.PAGE_WIDTH_MIN}
          timeSignature={timeSignature}
          timeSignatureMode={timeSignatureMode}
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
          noteheadShape={noteheadShape}
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
          lyricLineYOffset={lyricLineYOffset}
          isHorizontal={isHorizontal}
          a4PageHeight={a4PageHeight}
          getStaffHeight={getStaffHeight}
          showStaffSpacerHandles={showStaffSpacerHandles && typeof onSystemYOffsetChange === 'function'}
          onStaffSpacerMouseDown={typeof onSystemYOffsetChange === 'function' ? (systemIndex) => (e) => { e.stopPropagation(); setStaffSpacerDrag({ systemIndex, startClientY: e.clientY, cumulativeDelta: 0 }); } : undefined}
          themeColors={themeColors}
          instrument={instrument}
          instrumentNotationVariant={instrumentNotationVariant}
          connectedBarlines={layoutConnectedBarlines && staffCount > 1}
          staffIndexInScore={staffIndexInScore}
          systemTotalHeight={systemTotalHeight}
        />
      )}


      {/* Cursor + Ghost note: visible in note input mode, or when pedagogical playback/export. Always show when we have cursorInfo; use fallback X if slot X is invalid so the cursor is never missing in N mode. */}
      {(noteInputMode || isPedagogicalAudioPlaying || isExportingAnimation) && cursorInfo && (!isFigurenotesMode || isActiveStaff) && (() => {
        const cursorX = (cursorSlotCenterX != null && Number.isFinite(cursorSlotCenterX)) ? cursorSlotCenterX : (marginLeft + 40);
        const cursorChar = (pedagogicalPlayheadEmoji || '').trim();
        const showLine = cursorChar === '';
        const displayEmoji = cursorChar || '🎵';
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
        const baseY = centerY - emojiSizePx / 2;
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
        return (
        <g>
          {showLine ? (
            <line
              x1={cursorX}
              y1={cursorInfo.system.yOffset + cursorInset}
              x2={cursorX}
              y2={cursorInfo.system.yOffset + cursorY2}
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
                y1={cursorInfo.system.yOffset + cursorInset}
                x2={cursorX}
                y2={cursorInfo.system.yOffset + cursorY2}
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
                  return <text x={cursorX} y={cursorInfo.system.yOffset + centerY + zSize * 0.2} textAnchor="middle" fontSize={zSize} fontWeight="bold" fill="#dc2626" fontFamily="serif">Z</text>;
                })()
              : (() => {
                  const restY = cursorInfo.system.yOffset + centerY;
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
              const cy = cursorInfo.system.yOffset + (notationMode === 'figurenotes' ? centerY : pitchY);
              const stemUp = pitchY > middleLineY;
              if (notationMode === 'figurenotes') {
                const { color, shape } = getFigureSymbol(ghostPitch, ghostOctave);
                const size = Math.max(8, Math.min(150, emojiSizePx));
                const r = size / 2;
                const strokeW = Math.max(2, size * 0.38);
                let el;
                if (shape === 'none') {
                  el = <rect x={cx - r} y={cy - r} width={size} height={size} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="2 2" opacity="0.9" />;
                } else if (shape === 'cross') {
                  const crossStyle = getOctave2CrossStyle(ghostPitch);
                  const crossStrokeW = crossStyle.strokeWidth ? Math.max(0.5, size * 0.02) : 0;
                  const x0 = cx - r, x1 = cx - 0.8 * r, x2 = cx - 0.68 * r, x3 = cx + 0.68 * r, x4 = cx + 0.8 * r, x5 = cx + r;
                  const y0 = cy - r, y1 = cy - 0.8 * r, y2 = cy - 0.68 * r, y3 = cy + 0.68 * r, y4 = cy + 0.8 * r, y5 = cy + r;
                  el = (
                    <g>
                      <path d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} L${x4} ${y4} L${x5} ${y3} L${x0} ${y2} Z`} fill={crossStyle.fill} stroke={crossStyle.stroke} strokeWidth={crossStrokeW} />
                      <path d={`M${x4} ${y1} L${x3} ${y2} L${x2} ${y3} L${x1} ${y4} L${x0} ${y3} L${x5} ${y2} Z`} fill={crossStyle.fill} stroke={crossStyle.stroke} strokeWidth={crossStrokeW} />
                      <rect x={cx - r} y={cy - r} width={size} height={size} fill="none" stroke="#2563eb" strokeWidth="2" />
                    </g>
                  );
                } else if (shape === 'square') {
                  el = <rect x={cx - r} y={cy - r} width={size} height={size} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9" />;
                } else if (shape === 'triangle') {
                  const h = size * 0.866;
                  el = <path d={`M ${cx} ${cy - h/2} L ${cx + size/2} ${cy + h/2} L ${cx - size/2} ${cy + h/2} Z`} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9" />;
                } else if (shape === 'triangleDown') {
                  const h = size * 0.866;
                  el = <path d={`M ${cx} ${cy + h/2} L ${cx + size/2} ${cy - h/2} L ${cx - size/2} ${cy - h/2} Z`} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9" />;
                } else {
                  el = <circle cx={cx} cy={cy} r={r} fill={color} stroke="#2563eb" strokeWidth="2" opacity="0.9" />;
                }
                return <g opacity="0.9">{el}</g>;
              }
              if (notationMode === 'traditional') {
                const rx = getNoteheadRx(spacing);
                const stemX = stemUp ? cx + rx : cx - rx;
                const stemY2 = stemUp ? cy - 28 : cy + 28;
                const ledgerHalfWidth = getLedgerHalfWidth(spacing);
                const sysY = cursorInfo.system.yOffset;
                const firstLineY = staffLinePositions[0];
                const lastLineY = staffLinePositions[staffLinePositions.length - 1];
                const { above: nLedgerAbove, below: nLedgerBelow } = staffLines === 5
                  ? getLedgerLineCountExact(pitchY, firstLineY, lastLineY, spacing)
                  : { above: 0, below: 0 };
                return (
                  <g opacity="0.85">
                    {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                      <line key={`ghost-ledger-above-${i}`} x1={cx - ledgerHalfWidth} y1={sysY + firstLineY - (i + 1) * spacing} x2={cx + ledgerHalfWidth} y2={sysY + firstLineY - (i + 1) * spacing} stroke={themeColors.staffLineColor} strokeWidth="1.5" />
                    ))}
                    {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                      <line key={`ghost-ledger-below-${i}`} x1={cx - ledgerHalfWidth} y1={sysY + lastLineY + (i + 1) * spacing} x2={cx + ledgerHalfWidth} y2={sysY + lastLineY + (i + 1) * spacing} stroke={themeColors.staffLineColor} strokeWidth="1.5" />
                    ))}
                    <NoteHead cx={cx} cy={cy} staffSpace={spacing} filled stemUp={stemUp} selected fill={themeColors.noteFill} />
                    <line x1={stemX} y1={cy} x2={stemX} y2={stemY2} stroke={themeColors.noteFill} strokeWidth="1.5"/>
                  </g>
                );
              }
              const stemX = stemUp ? cx + 10 : cx - 10;
              const stemY2 = stemUp ? cy - 24 : cy + 24;
              return <g opacity="0.85"><circle cx={cx} cy={cy} r="9" fill="none" stroke={themeColors.textColor}/><text x={cx} y={cy+3} textAnchor="middle" fontSize="11" fontWeight="bold" fill={themeColors.textColor}>{ghostPitch}</text><line x1={stemX} y1={cy} x2={stemX} y2={stemY2} stroke={themeColors.textColor} strokeWidth="1.5"/></g>;
            })()
          ) : (
            <circle cx={cursorX} cy={cursorInfo.system.yOffset + centerY} r="6" fill="#2563eb" stroke="white" strokeWidth="2">
              <animate attributeName="r" values="6;8;6" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
          {isDotted && !isRest && ghostPitch && (
            <circle cx={cursorX + 12} cy={cursorInfo.system.yOffset + (notationMode === 'figurenotes' ? centerY : getPitchY(ghostPitch, ghostOctave))} r="3" fill="#f59e0b" stroke="white" strokeWidth="1">
              <animate attributeName="opacity" values="1;0.5;1" dur="0.8s" repeatCount="indefinite" />
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

function NoodiMeister() {
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
      <NoodiMeisterCore icons={icons} />
    </AppRunErrorBoundary>
  );
}

export default NoodiMeister;