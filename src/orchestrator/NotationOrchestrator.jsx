/**
 * KESKNE MOOTOR (Orchestrator).
 * Importib kõik notatsiooni- ja tööriistamoodulid ning ühendab sündmuste ahela:
 * PianoKeyboard vajutus → PitchInputLogic → NotationContext.addNote → vaated värskenduvad.
 * RhythmToolbox valikud → NotationContext (selectedRhythm, isDotted, isRest) → NoteSymbols.
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// —— Store & context ——
import { NotationProvider, useNotation, DURATIONS, getEffectiveDuration, INSTRUMENT_PRESETS } from '../store/NotationContext';

// —— Pitch input (klahv → kõrgus) ——
import { getPitchFromMidi } from '../musical/PitchInputLogic';

// —— Tööriistakastid (rütm, taktimõõt, võtmed) ——
import { RhythmPatternIcon } from '../toolboxes/rhythmToolbox';
import { ClefIcon } from '../toolboxes/clefsToolbox';
import { MeterIcon, PedagogicalMeterIcon } from '../toolboxes/timeSignatureToolbox';

// —— Notatsioon: sümbolid ja vaated ——
import { NoteSymbol } from '../notation/NoteSymbols';
import RestSymbol from '../notation/RestSymbols';
import { TraditionalNotationView } from '../views/TraditionalNotationView';
import { FigurenotesView } from '../views/FigurenotesView';
import { computeLayout, getStaffHeight, LAYOUT, PAGE_BREAK_GAP } from '../layout/LayoutManager';
import { computeScaleForA4, FIGURE_BASE_WIDTH, PAGE_DIMENSIONS } from '../layout/LayoutEngine';
import {
  getStaffLinePositions,
  getYFromStaffPosition,
  getVerticalPosition,
  getTonicStaffPosition,
} from '../notation/StaffConstants';
import { computeBeamGroups, computeBeamGeometry } from '../notation/BeamCalculation';

// —— Komponendid ——
import { PianoKeyboard, PianoSection, InteractivePiano } from '../components/PianoKeyboard';
import { JoClefSymbol, TrebleClefSymbol, BassClefSymbol } from '../components/ClefSymbols';

// —— Muusika & utils ——
import { transposeNotes } from '../musical/transpose';
import { getJoName } from '../notation/joNames';
import { FIGURENOTES_COLORS, getFigureSymbol } from '../utils/figurenotes';
import { getRhythmSyllableForNote } from '../notation/rhythmSyllables';
import {
  DEFAULT_JO_CLEF_STAFF_POSITION,
  JO_CLEF_POSITION_MIN,
  JO_CLEF_POSITION_MAX,
  KEY_TO_SEMITONE,
} from '../utils/notationConstants';

// —— Re-eksport: ühtne entry point kõigile moodulitele (15+ faili) ——
export {
  NotationProvider,
  useNotation,
  getPitchFromMidi,
  RhythmIcon,
  RhythmPatternIcon,
  ClefIcon,
  MeterIcon,
  PedagogicalMeterIcon,
  NoteSymbol,
  RestSymbol,
  TraditionalNotationView,
  FigurenotesView,
  computeLayout,
  getStaffHeight,
  LAYOUT,
  PAGE_BREAK_GAP,
  PianoKeyboard,
  PianoSection,
  InteractivePiano,
  JoClefSymbol,
  TrebleClefSymbol,
  BassClefSymbol,
  transposeNotes,
  getJoName,
  FIGURENOTES_COLORS,
  getFigureSymbol,
  getRhythmSyllableForNote,
  getStaffLinePositions,
  getYFromStaffPosition,
  getVerticalPosition,
  getTonicStaffPosition,
  computeBeamGroups,
  computeBeamGeometry,
  DEFAULT_JO_CLEF_STAFF_POSITION,
  JO_CLEF_POSITION_MIN,
  JO_CLEF_POSITION_MAX,
  KEY_TO_SEMITONE,
  DURATIONS,
  getEffectiveDuration,
};

const PAGE_WIDTH_DEFAULT = 800;
const PIXELS_PER_BEAT = 80;

/** Ühest noodide massiivist ja taktimõõdust ehitab mõõdud ja notesByMeasure. Igale noodile lisatakse beat (absoluutne takti aeg). */
function buildMeasuresFromNotes(notes, timeSignature) {
  const beatsPerMeasure = timeSignature?.beats ?? 4;
  const totalBeats = (notes || []).reduce((acc, n) => acc + n.duration, 0);
  const measureCount = Math.max(1, Math.ceil(totalBeats / beatsPerMeasure));
  const measures = [];
  for (let i = 0; i < measureCount; i++) {
    const startBeat = i * beatsPerMeasure;
    measures.push({
      startBeat,
      endBeat: startBeat + beatsPerMeasure,
      beatCount: beatsPerMeasure,
      notes: [],
    });
  }
  const notesByMeasure = measures.map(() => []);
  let beat = 0;
  (notes || []).forEach((note) => {
    const noteBeat = beat;
    const measureIndex = Math.min(Math.floor(noteBeat / beatsPerMeasure), measures.length - 1);
    if (measureIndex >= 0 && notesByMeasure[measureIndex]) {
      notesByMeasure[measureIndex].push({ ...note, beat: noteBeat });
    }
    beat += note.duration;
  });
  const effectiveMeasures = measures.map((m, i) => ({ ...m, notes: notesByMeasure[i] || [] }));
  return { measures, effectiveMeasures };
}

/** Kõikide instrumentide noodid: ühine taktide ahel, iga instrumendi effectiveMeasures eraldi. */
function buildMeasuresFromInstruments(instruments, timeSignature) {
  const beatsPerMeasure = timeSignature?.beats ?? 4;
  const totalBeats = (instruments || []).reduce((acc, inst) => {
    const sum = (inst.notes || []).reduce((s, n) => s + n.duration, 0);
    return Math.max(acc, sum);
  }, 0);
  const measureCount = Math.max(1, Math.ceil(totalBeats / beatsPerMeasure));
  const measures = [];
  for (let i = 0; i < measureCount; i++) {
    const startBeat = i * beatsPerMeasure;
    measures.push({
      startBeat,
      endBeat: startBeat + beatsPerMeasure,
      beatCount: beatsPerMeasure,
      notes: [],
    });
  }
  const effectiveMeasuresPerInstrument = {};
  (instruments || []).forEach((inst) => {
    const { effectiveMeasures } = buildMeasuresFromNotes(inst.notes || [], timeSignature);
    const padded = measures.map((m, i) => ({ ...m, notes: effectiveMeasures[i]?.notes ?? [] }));
    effectiveMeasuresPerInstrument[inst.id] = padded;
  });
  return { measures, effectiveMeasuresPerInstrument };
}

/**
 * Sündmuste ahel: klaviatuuri klahv → kõrgus → noot konteksti → vaade uuendub.
 */
function usePianoToNotationHandler() {
  const { keySignature, addNote, setGhostPitch, setGhostOctave } = useNotation();
  return useCallback(
    (midiNumber) => {
      const { pitch, octave, accidental } = getPitchFromMidi(midiNumber, keySignature);
      setGhostPitch(pitch);
      setGhostOctave(octave);
      addNote(pitch, octave, accidental, { skipPlay: true });
    },
    [keySignature, addNote, setGhostPitch, setGhostOctave]
  );
}

/**
 * Rütmitööriistakast: valikud lähevad mootorisse (NotationContext), sealt edasi NoteSymbols sümboliteni.
 */
function RhythmToolbar({ t = (k) => k }) {
  const {
    selectedRhythm,
    setSelectedRhythm,
    isDotted,
    setIsDotted,
    isRest,
    setIsRest,
  } = useNotation();

  const durationOptions = [
    { value: '1/1', keyHint: '1', label: t('note.whole') || 'Terve' },
    { value: '1/2', keyHint: '2', label: t('note.half') || 'Pool' },
    { value: '1/4', keyHint: '3', label: t('note.quarter') || 'Veerand' },
    { value: '1/8', keyHint: '4', label: t('note.eighth') || 'Kaheksandik' },
    { value: '1/16', keyHint: '5', label: t('note.sixteenth') || 'Kuueteistkümnendik' },
  ];

  const durationToNoteType = (dur) => {
    switch (dur) {
      case '1/1': return 'whole';
      case '1/2': return 'half';
      case '1/8': return 'eighth';
      case '1/16': return 'sixteenth';
      case '1/32': return 'thirtySecond';
      default: return 'quarter';
    }
  };
  const durationToRestType = (dur) => {
    switch (dur) {
      case '1/1': return 'whole';
      case '1/2': return 'half';
      case '1/8': return 'eighth';
      case '1/16': return 'sixteenth';
      case '1/32': return 'thirtySecond';
      default: return 'quarter';
    }
  };

  const RhythmGlyph = ({ duration, dotted = false, rest = false }) => {
    const staffSpace = 6.2;
    const w = 34;
    const h = 34;
    const cx = 16;
    const cy = 18;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {rest ? (
          <RestSymbol type={durationToRestType(duration)} x={cx} y={cy} staffSpace={staffSpace} />
        ) : (
          <NoteSymbol type={durationToNoteType(duration)} cx={cx} cy={cy} staffSpace={staffSpace} stemUp={true} />
        )}
        {dotted && <circle cx={cx + 10} cy={cy} r={1.6} fill="currentColor" />}
      </svg>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-amber-50 border-b border-amber-200">
      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mr-1">
        {t('toolbox.rhythm') || 'Rütm'}
      </span>

      {durationOptions.map((opt) => {
        const active = selectedRhythm === opt.value && !isRest;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setSelectedRhythm(opt.value);
              setIsRest(false);
            }}
            className={`relative px-2 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
            title={`${opt.label} (${opt.keyHint})`}
          >
            <span className="absolute -top-1 -right-1 text-[10px] leading-[1] px-1 py-[2px] rounded bg-white/70 text-amber-900 border border-amber-300">
              {opt.keyHint}
            </span>
            <span className={active ? 'text-white' : 'text-amber-900'}>
              <RhythmGlyph duration={opt.value} />
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setIsRest(!isRest)}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isRest ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
        title={t('note.rest') || 'Paus'}
      >
        <RhythmGlyph duration={selectedRhythm} rest={true} />
      </button>

      <button
        type="button"
        onClick={() => setIsDotted(!isDotted)}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isDotted ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
        title={t('note.dotted') || 'Punkt'}
      >
        <RhythmGlyph duration={selectedRhythm} dotted={true} rest={false} />
      </button>

      <span className="text-[11px] text-amber-700 ml-2">
        {t('shortcut.rhythmDigits') || '1–5 = rütm, A–G = noot'}
      </span>
    </div>
  );
}

/**
 * Mootori juurkomponent: ühendab konteksti, rütmiriba, noodijoonestiku vaate ja klaviatuuri.
 */
function NotationOrchestratorInner({ showPiano = true, t = (k) => k }) {
  const [addInstrumentOpen, setAddInstrumentOpen] = useState(false);
  const notation = useNotation();
  const {
    keySignature,
    timeSignature,
    timeSignatureMode,
    instruments,
    activeInstrumentId,
    setActiveInstrumentId,
    addInstrument,
    clefType,
    cursorPosition,
    ghostPitch,
    ghostOctave,
    notationStyle,
    notationMode,
    globalSpacingMultiplier = 1,
    staffSpacing = 120,
    setSelectedRhythm,
    setIsRest,
    addNote,
  } = notation;

  const onNotePlay = usePianoToNotationHandler();

  // Klaviatuuri kiirklahvid: 1–5 rütm, A–G noodi sisestus.
  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const onKeyDown = (e) => {
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Rhythm: 1..5
      const rhythmByDigit = {
        '1': '1/1',
        '2': '1/2',
        '3': '1/4',
        '4': '1/8',
        '5': '1/16',
      };
      if (rhythmByDigit[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedRhythm(rhythmByDigit[e.key]);
        setIsRest(false);
        return;
      }

      // Note entry: A..G
      const k = String(e.key || '').toUpperCase();
      if (k.length === 1 && k >= 'A' && k <= 'G') {
        e.preventDefault();
        e.stopPropagation();
        addNote(k, ghostOctave ?? 4, 0, { skipPlay: true });
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [addNote, ghostOctave, setIsRest, setSelectedRhythm]);

  const { measures, effectiveMeasuresPerInstrument } = useMemo(
    () => buildMeasuresFromInstruments(instruments, timeSignature),
    [instruments, timeSignature]
  );

  const staffCount = instruments?.length ?? 1;
  const layoutWithScale = useMemo(() => {
    const dims = PAGE_DIMENSIONS.portrait ?? { height: 1123, margin: 60 };
    const availablePageHeight = dims.height - (dims.margin ?? 60) * 2;
    const opts = {
      measuresPerLine: 4,
      staffCount,
      globalSpacingMultiplier,
      staffSpacing: Math.max(40, staffSpacing),
      pageHeight: availablePageHeight > 0 ? availablePageHeight : undefined,
    };
    const systemsZero = computeLayout(measures, timeSignature, PIXELS_PER_BEAT, PAGE_WIDTH_DEFAULT, opts);
    const systemCount = systemsZero.length;
    const { scale, staffHeight, staffSpace } = computeScaleForA4(staffCount, systemCount, 'portrait');
    const optsScaled = { ...opts, staffHeight, staffSpace };
    const systems = computeLayout(measures, timeSignature, PIXELS_PER_BEAT, PAGE_WIDTH_DEFAULT, optsScaled);
    return { systems, staffHeight, staffSpace, scale };
  }, [measures, timeSignature, staffCount, globalSpacingMultiplier, staffSpacing]);

  const { systems, staffHeight, staffSpace } = layoutWithScale;
  const timelineHeight = staffHeight;
  const marginLeft = LAYOUT.MARGIN_LEFT ?? 60;
  const pageWidth = PAGE_WIDTH_DEFAULT;
  // JO-võti: toonika (I aste) positsioon sõltub aktiivsest helistikust (alati MAŽOOR, valged klahvid).
  const joClefStaffPosition = getTonicStaffPosition(keySignature);
  const centerY = timelineHeight / 2;
  const getPitchY = useCallback(
    (pitch, octave) =>
      getVerticalPosition(pitch, octave, clefType, {
        centerY,
        staffSpace: staffSpace || 10,
        keySignature,
      }),
    [clefType, centerY, keySignature, staffSpace]
  );

  return (
    <div className="flex flex-col min-h-[400px] bg-white">
      <RhythmToolbar t={t} />
      <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1">
          {t('toolbox.instruments') || 'Instrumendid'}
        </span>
        <select
          value={activeInstrumentId}
          onChange={(e) => setActiveInstrumentId(e.target.value)}
          className="px-2 py-1 rounded text-sm border border-slate-300 bg-white text-slate-800"
        >
          {instruments.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
            </option>
          ))}
        </select>
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setAddInstrumentOpen((v) => !v)}
            className="px-2 py-1 rounded text-xs font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
            title={t('toolbox.addInstrument') || 'Lisa instrument'}
          >
            + {t('toolbox.addInstrument') || 'Lisa instrument'}
          </button>
          {addInstrumentOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden="true"
                onClick={() => setAddInstrumentOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] py-1 rounded border border-slate-200 bg-white shadow-lg">
                {Object.entries(INSTRUMENT_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      addInstrument({ preset: key });
                      setAddInstrumentOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 first:rounded-t last:rounded-b"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-2 mr-1">{t('layout.staffSpacing') || 'Ridade vahe'}</span>
        <input
          type="range"
          min={60}
          max={240}
          step={10}
          value={staffSpacing}
          onChange={(e) => notation.setStaffSpacing(Number(e.target.value))}
          className="w-24 h-2 rounded accent-slate-600"
          title={t('layout.staffSpacingHint') || 'Vertikaalne vahe joonestikute vahel (px)'}
        />
        <span className="text-xs text-slate-600 w-10">{staffSpacing} px</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-[600px]" style={{ width: pageWidth }}>
          {notationStyle === 'FIGURENOTES' ? (
            <FigurenotesView
              systems={systems}
              effectiveMeasures={effectiveMeasuresPerInstrument[activeInstrumentId] ?? effectiveMeasuresPerInstrument[instruments?.[0]?.id]}
              marginLeft={marginLeft}
              timelineHeight={timelineHeight}
              pageWidth={pageWidth}
              timeSignature={timeSignature}
              timeSignatureMode={timeSignatureMode}
              keySignature={keySignature}
              showBarNumbers={true}
              figureBaseWidth={FIGURE_BASE_WIDTH * globalSpacingMultiplier}
            />
          ) : (
            <TraditionalNotationView
              systems={systems}
              instruments={instruments}
              effectiveMeasuresPerInstrument={effectiveMeasuresPerInstrument}
              marginLeft={marginLeft}
              timelineHeight={timelineHeight}
              pageWidth={pageWidth}
              timeSignature={timeSignature}
              timeSignatureMode={timeSignatureMode}
              staffLines={5}
              staffSpace={staffSpace}
              clefType={clefType}
              keySignature={keySignature}
              notationMode="traditional"
              joClefStaffPosition={joClefStaffPosition}
              relativeNotationShowKeySignature={false}
              relativeNotationShowTraditionalClef={true}
              layoutLineBreakBefore={[]}
              showLayoutBreakIcons={false}
              translateLabel={t}
              showBarNumbers={true}
              showRhythmSyllables={false}
              showAllNoteLabels={false}
              enableEmojiOverlays={false}
              chords={[]}
              isNoteSelected={() => false}
              onNoteClick={() => {}}
              getPitchY={getPitchY}
              isFirstInBraceGroup={false}
              ghostPitch={ghostPitch}
              ghostOctave={ghostOctave}
              cursorPosition={cursorPosition}
            />
          )}
        </div>
      </div>

      {showPiano && (
        <>
          {createPortal(
            <div className="fixed bottom-0 left-0 right-0 z-[100] min-h-[140px] bg-gradient-to-t from-amber-100 to-amber-50 border-t-2 border-amber-300 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] py-3 px-4">
              <div className="mx-auto max-w-4xl" style={{ minHeight: 120 }}>
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  {t('toolbox.pianoKeyboard') || 'Klaviatuur'}
                </span>
                <div className="mt-2" style={{ minHeight: 100 }}>
                  <InteractivePiano
                    firstNote={48}
                    lastNote={72}
                    width={Math.min(900, typeof window !== 'undefined' ? window.innerWidth - 80 : 600)}
                    height={100}
                    showMidiSelect={false}
                    onNotePlay={onNotePlay}
                    figurenotesColors={notationStyle === 'FIGURENOTES' || notationMode === 'pedagogical' ? FIGURENOTES_COLORS : null}
                    keySignature={keySignature}
                    keyboardPlaysPiano={notationStyle === 'FIGURENOTES' || notationMode === 'pedagogical'}
                  />
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}

/**
 * Keskne mootor: pakub NotationContext ja renderdab sisu.
 */
export function NotationOrchestrator({ children, showPiano = true, t = (k) => k }) {
  return (
    <NotationProvider>
      {children != null ? children : <NotationOrchestratorInner showPiano={showPiano} t={t} />}
    </NotationProvider>
  );
}

export default NotationOrchestrator;
