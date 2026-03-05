/**
 * KESKNE MOOTOR (Orchestrator).
 * Importib kõik notatsiooni- ja tööriistamoodulid ning ühendab sündmuste ahela:
 * PianoKeyboard vajutus → PitchInputLogic → NotationContext.addNote → vaated värskenduvad.
 * RhythmToolbox valikud → NotationContext (selectedRhythm, isDotted, isRest) → NoteSymbols.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

// —— Store & context ——
import { NotationProvider, useNotation, DURATIONS, getEffectiveDuration } from '../store/NotationContext';

// —— Pitch input (klahv → kõrgus) ——
import { getPitchFromMidi } from '../musical/PitchInputLogic';

// —— Tööriistakastid (rütm, taktimõõt, võtmed) ——
import { RhythmIcon, RhythmPatternIcon } from '../toolboxes/rhythmToolbox';
import { ClefIcon } from '../toolboxes/clefsToolbox';
import { MeterIcon, PedagogicalMeterIcon } from '../toolboxes/timeSignatureToolbox';

// —— Notatsioon: sümbolid ja vaated ——
import { NoteSymbol } from '../notation/NoteSymbols';
import RestSymbol from '../notation/RestSymbols';
import { TraditionalNotationView } from '../views/TraditionalNotationView';
import { FigurenotesView } from '../views/FigurenotesView';
import { computeLayout, getStaffHeight, LAYOUT, PAGE_BREAK_GAP } from '../layout/LayoutManager';
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

  const rhythmOptions = [
    { value: '1/4', label: t('note.quarter') || '1/4' },
    { value: '1/8', label: t('note.eighth') || '1/8' },
    { value: '1/2', label: t('note.half') || '1/2' },
    { value: '1/1', label: t('note.whole') || '1/1' },
    { value: '1/16', label: t('note.sixteenth') || '1/16' },
    { value: 'rest', label: t('note.rest') || 'Paus' },
    { value: 'dotted', label: t('note.dotted') || 'Punkt' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-amber-50 border-b border-amber-200">
      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mr-1">Rütm</span>
      {rhythmOptions.map((opt) => {
        if (opt.value === 'rest') {
          const active = isRest;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIsRest(!active)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
              title={opt.label}
            >
              <RhythmIcon duration={selectedRhythm} isRest={true} />
            </button>
          );
        }
        if (opt.value === 'dotted') {
          const active = isDotted;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIsDotted(!active)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
              title={opt.label}
            >
              <RhythmIcon duration={selectedRhythm} isDotted={true} />
            </button>
          );
        }
        const active = selectedRhythm === opt.value && !isRest && !isDotted;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setSelectedRhythm(opt.value);
              setIsRest(false);
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-amber-600 text-white' : 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'}`}
            title={opt.label}
          >
            <RhythmIcon duration={opt.value} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Mootori juurkomponent: ühendab konteksti, rütmiriba, noodijoonestiku vaate ja klaviatuuri.
 */
function NotationOrchestratorInner({ showPiano = true, t = (k) => k }) {
  const notation = useNotation();
  const {
    keySignature,
    timeSignature,
    timeSignatureMode,
    notes,
    clefType,
    cursorPosition,
    ghostPitch,
    ghostOctave,
    notationStyle,
  } = notation;

  const onNotePlay = usePianoToNotationHandler();

  const { measures, effectiveMeasures } = useMemo(
    () => buildMeasuresFromNotes(notes, timeSignature),
    [notes, timeSignature]
  );

  const systems = useMemo(() => {
    const opts = { measuresPerLine: 4, staffCount: 1 };
    return computeLayout(measures, timeSignature, PIXELS_PER_BEAT, PAGE_WIDTH_DEFAULT, opts);
  }, [measures, timeSignature]);

  const timelineHeight = getStaffHeight();
  const marginLeft = LAYOUT.MARGIN_LEFT ?? 60;
  const pageWidth = PAGE_WIDTH_DEFAULT;
  const joClefStaffPosition = DEFAULT_JO_CLEF_STAFF_POSITION;
  const centerY = timelineHeight / 2;
  const getPitchY = useCallback(
    (pitch, octave) =>
      getVerticalPosition(pitch, octave, clefType, {
        centerY,
        staffSpace: 10,
        keySignature,
      }),
    [clefType, centerY, keySignature]
  );

  return (
    <div className="flex flex-col min-h-[400px] bg-white">
      <RhythmToolbar t={t} />

      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-[600px]" style={{ width: pageWidth }}>
          {notationStyle === 'FIGURENOTES' ? (
            <FigurenotesView
              systems={systems}
              effectiveMeasures={effectiveMeasures}
              marginLeft={marginLeft}
              timelineHeight={timelineHeight}
              pageWidth={pageWidth}
              timeSignature={timeSignature}
              timeSignatureMode={timeSignatureMode}
              keySignature={keySignature}
              showBarNumbers={true}
            />
          ) : (
            <TraditionalNotationView
              systems={systems}
              effectiveMeasures={effectiveMeasures}
              marginLeft={marginLeft}
              timelineHeight={timelineHeight}
              pageWidth={pageWidth}
              timeSignature={timeSignature}
              timeSignatureMode={timeSignatureMode}
              staffLines={5}
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
                    figurenotesColors={notationStyle === 'FIGURENOTES' ? FIGURENOTES_COLORS : null}
                    keySignature={keySignature}
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
