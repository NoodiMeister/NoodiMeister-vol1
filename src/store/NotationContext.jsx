/**
 * NotationContext – andmete keskus (KESKNE MOOTORI state).
 * Hoiab: aktiivne helistik, taktimõõt, valitud rütm ja kõik sisestatud noodid.
 * RhythmToolbox valikud jõuavad siia; NoteSymbols ja vaated loevad siit.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { transposeNotes, getTransposeSemitones } from '../musical/transpose';

const NotationContext = createContext(null);

export function useNotation() {
  const ctx = useContext(NotationContext);
  if (!ctx) throw new Error('useNotation must be used within NotationProvider');
  return ctx;
}

export function useNotationOptional() {
  return useContext(NotationContext);
}

/** Noodi kestused (beatUnit väärtused). */
export const DURATIONS = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 };

export function getEffectiveDuration(durationLabel, isDotted = false) {
  const base = DURATIONS[durationLabel];
  if (base == null) return 1;
  return isDotted ? base * 1.5 : base;
}

const defaultTimeSignature = { beats: 4, beatUnit: 4 };

/** Ühe instrumendi andmed: id, name, clef, notationMode, notes. */
function createInstrument(id, name, clef, notes = [], notationMode = 'traditional') {
  return { id, name, clef, notationMode: notationMode ?? 'traditional', notes: notes ?? [] };
}

/** Instrumentide eelvalikud: nimi, võti, ulatus. */
export const INSTRUMENT_PRESETS = {
  piano: { name: 'Klaver', clef: 'treble', range: ['A0', 'C8'] },
  violin: { name: 'Viiul', clef: 'treble', range: ['G3', 'A7'] },
  voice: { name: 'Laul', clef: 'treble', range: ['C3', 'C6'] },
  bass: { name: 'Basskitarr', clef: 'bass', range: ['E1', 'G3'] },
};

const DEFAULT_INSTRUMENTS = [
  createInstrument('default', 'Klaver', 'treble', [], 'traditional'),
];

export function NotationProvider({ children }) {
  const [keySignature, setKeySignatureState] = useState('C');
  const [timeSignature, setTimeSignatureState] = useState(defaultTimeSignature);
  const [timeSignatureMode, setTimeSignatureModeState] = useState('standard'); // 'standard' | 'pedagogical'
  const [selectedRhythm, setSelectedRhythmState] = useState('1/4'); // durationLabel – RhythmToolbox valik
  const [isDotted, setIsDottedState] = useState(false);
  const [isRest, setIsRestState] = useState(false);
  const [instruments, setInstrumentsState] = useState(() => [...DEFAULT_INSTRUMENTS.map((i) => ({ ...i, notes: [] }))]);
  const [activeInstrumentId, setActiveInstrumentIdState] = useState('default');
  const [cursorPosition, setCursorPositionState] = useState(0);
  const [ghostPitch, setGhostPitchState] = useState('C');
  const [ghostOctave, setGhostOctaveState] = useState(4);
  const [notationStyle, setNotationStyleState] = useState('TRADITIONAL'); // 'TRADITIONAL' | 'FIGURENOTES'
  const [notationMode, setNotationModeState] = useState('traditional'); // 'traditional' | 'vabanotatsioon' | 'figurenotes'
  const [globalSpacingMultiplier, setGlobalSpacingMultiplierState] = useState(1.0);
  const [staffSpacing, setStaffSpacingState] = useState(120); // Vertikaalne vahe joonestikute vahel (px), keskkohast keskkohani
  const [measureWidthMultiplier, setMeasureWidthMultiplierState] = useState(1.0); // Horisontaalne kordaja

  const activeInstrument = useMemo(
    () => instruments.find((i) => i.id === activeInstrumentId) ?? instruments[0],
    [instruments, activeInstrumentId]
  );
  const notes = activeInstrument?.notes ?? [];
  const clefType = activeInstrument?.clef ?? 'treble';

  const shouldApplyFigureRestCleanup = useCallback((options = {}) => {
    // Apply only when user is working in figurenotation view.
    // (notationStyle is the actual view switch in NotationOrchestrator)
    if (notationStyle !== 'FIGURENOTES') return false;
    // Allow opt-out for special import/transform operations if ever needed.
    if (options?.disableFigureRestCleanup) return false;
    return true;
  }, [notationStyle]);

  const buildIntervalsFromNotes = useCallback((noteList) => {
    const intervals = [];
    let beat = 0;
    (noteList || []).forEach((n, idx) => {
      const start = typeof n?.beat === 'number' ? n.beat : beat;
      const dur = Math.max(0, Number(n?.duration ?? 0));
      const end = start + dur;
      intervals.push({ note: n, idx, start, end });
      beat = start + dur;
    });
    return intervals;
  }, []);

  const setKeySignature = useCallback((key) => setKeySignatureState(key), []);
  const setTimeSignature = useCallback((ts) => setTimeSignatureState(ts || defaultTimeSignature), []);
  const setTimeSignatureMode = useCallback((mode) => setTimeSignatureModeState(mode), []);
  const setSelectedRhythm = useCallback((dur) => setSelectedRhythmState(dur), []);
  const setIsDotted = useCallback((d) => setIsDottedState(!!d), []);
  const setIsRest = useCallback((r) => setIsRestState(!!r), []);
  const setNotes = useCallback((updater) => {
    setInstrumentsState((prev) =>
      prev.map((inst) =>
        inst.id === activeInstrumentId
          ? { ...inst, notes: typeof updater === 'function' ? updater(inst.notes) : updater }
          : inst
      )
    );
  }, [activeInstrumentId]);
  const setClefType = useCallback((clef) => {
    setInstrumentsState((prev) =>
      prev.map((inst) => (inst.id === activeInstrumentId ? { ...inst, clef } : inst))
    );
  }, [activeInstrumentId]);
  const setActiveInstrumentId = useCallback((id) => setActiveInstrumentIdState(id), []);
  const addInstrument = useCallback((options = {}) => {
    const id = options.id ?? `inst-${Date.now()}`;
    let name = options.name ?? 'Instrument';
    let clef = options.clef ?? 'treble';
    let notationMode = options.notationMode ?? 'traditional';
    if (options.preset && INSTRUMENT_PRESETS[options.preset]) {
      const preset = INSTRUMENT_PRESETS[options.preset];
      name = preset.name;
      clef = preset.clef;
    }
    setInstrumentsState((prev) => [...prev, createInstrument(id, name, clef, [], notationMode)]);
    setActiveInstrumentIdState(id);
    return id;
  }, []);

  /** Muudab instrumendi tüüpi vastavalt eelvalikule (preset key). */
  const changeInstrument = useCallback((instrumentId, presetKey) => {
    const preset = INSTRUMENT_PRESETS[presetKey];
    if (!preset) return;
    updateInstrument(instrumentId, { name: preset.name, clef: preset.clef });
  }, [updateInstrument]);
  const removeInstrument = useCallback((instrumentId) => {
    setInstrumentsState((prev) => {
      const next = prev.filter((i) => i.id !== instrumentId);
      if (next.length === 0) return [...DEFAULT_INSTRUMENTS.map((i) => ({ ...i, notes: [] }))];
      if (activeInstrumentId === instrumentId) setActiveInstrumentIdState(next[0].id);
      return next;
    });
  }, [activeInstrumentId]);
  const updateInstrument = useCallback((instrumentId, patch) => {
    setInstrumentsState((prev) =>
      prev.map((inst) =>
        inst.id === instrumentId ? { ...inst, ...patch } : inst
      )
    );
  }, []);
  const setCursorPosition = useCallback((pos) => setCursorPositionState(pos), []);
  const setGhostPitch = useCallback((p) => setGhostPitchState(p), []);
  const setGhostOctave = useCallback((o) => setGhostOctaveState(o), []);
  const setNotationStyle = useCallback((s) => setNotationStyleState(s), []);
  const setNotationMode = useCallback((m) => setNotationModeState(m), []);
  /** Režiimi vahetus: traditsioonilisele minnes sunnib viiulivõtme peale, kui praegu on JO-võti. */
  const switchNotationMode = useCallback((newMode) => {
    setNotationModeState(newMode);
    if (newMode === 'traditional' && clefType === 'jo') {
      setClefType('treble');
    }
  }, [clefType, setClefType]);
  const setGlobalSpacingMultiplier = useCallback((v) => setGlobalSpacingMultiplierState(typeof v === 'number' ? v : 1), []);
  const setStaffSpacing = useCallback((v) => setStaffSpacingState(typeof v === 'number' ? v : 120), []);
  const setMeasureWidthMultiplier = useCallback((v) => setMeasureWidthMultiplierState(typeof v === 'number' ? v : 1), []);

  const getEffectiveDurationForSelection = useCallback((durationLabel, dotted) => {
    return getEffectiveDuration(durationLabel ?? selectedRhythm, dotted ?? isDotted);
  }, [selectedRhythm, isDotted]);

  /** Lisab noodi kursorisse. Mootor kasutab seda pärast PitchInputLogic.getPitchFromMidi. */
  const addNote = useCallback((pitch, octave, accidental = 0, options = {}) => {
    const durationLabel = options.durationLabel ?? selectedRhythm;
    const dotted = options.isDotted ?? isDotted;
    const rest = options.isRest ?? isRest;
    const effectiveDuration = getEffectiveDuration(durationLabel, dotted);
    const insertionBeat = typeof options.beat === 'number' ? options.beat : cursorPosition;
    const newStart = insertionBeat;
    const newEnd = insertionBeat + effectiveDuration;

    const newNote = {
      id: options.id ?? Date.now(),
      pitch,
      octave,
      duration: effectiveDuration,
      durationLabel,
      isDotted: dotted,
      isRest: rest,
      lyric: options.lyric ?? '',
      ...(typeof options.beat === 'number' && { beat: options.beat }),
      ...(accidental !== 0 && { accidental }),
      ...(options.tuplet && { tuplet: options.tuplet }),
    };

    setInstrumentsState((prev) =>
      prev.map((inst) =>
        inst.id === activeInstrumentId
          ? (() => {
            const existingNotes = inst.notes ?? [];

            if (shouldApplyFigureRestCleanup(options)) {
              const intervals = buildIntervalsFromNotes(existingNotes);

              // 1) If inserting a figurenote (non-rest), remove any rests that overlap its time range.
              if (!rest) {
                const keep = intervals.filter((iv) => {
                  const isRestNote = !!iv?.note?.isRest;
                  if (!isRestNote) return true;
                  // overlap: [a,b) intersects [c,d)
                  return !(newStart < iv.end && newEnd > iv.start);
                }).map((iv) => iv.note);
                return { ...inst, notes: [...keep, newNote] };
              }

              // 2) If inserting a rest, skip it if it would overlap an existing played note.
              const overlapsPlayed = intervals.some((iv) => {
                const isPlayed = !iv?.note?.isRest;
                if (!isPlayed) return false;
                return newStart < iv.end && newEnd > iv.start;
              });
              if (overlapsPlayed) return inst;
            }

            return { ...inst, notes: [...existingNotes, newNote] };
          })()
          : inst
      )
    );
    setCursorPositionState((p) => (typeof options.beat === 'number' ? options.beat : p) + effectiveDuration);
    setGhostPitchState(pitch);
    setGhostOctaveState(octave);
    return newNote;
  }, [
    selectedRhythm,
    isDotted,
    isRest,
    activeInstrumentId,
    cursorPosition,
    buildIntervalsFromNotes,
    shouldApplyFigureRestCleanup,
  ]);

  /** Transponeerib kõik instrumentide noodid pooltoonide võrra. */
  const transposeScore = useCallback((semitones) => {
    if (!semitones) return;
    setInstrumentsState((prev) =>
      prev.map((inst) => ({ ...inst, notes: transposeNotes(inst.notes, semitones) }))
    );
  }, []);

  /** Transponeerib partituuri uude helistikku (värskendab ka keySignature). */
  const transposeToKey = useCallback((newKey) => {
    const semitones = getTransposeSemitones(keySignature, newKey);
    if (!semitones) return;
    setInstrumentsState((prev) =>
      prev.map((inst) => ({ ...inst, notes: transposeNotes(inst.notes, semitones) }))
    );
    setKeySignatureState(newKey);
  }, [keySignature]);

  /** Uue faili loomine: tühjendab kõikide instrumentide noodid, kursor algusesse. */
  const createNewFile = useCallback(() => {
    setInstrumentsState((prev) => prev.map((inst) => ({ ...inst, notes: [] })));
    setCursorPositionState(0);
    setGhostPitchState('C');
    setGhostOctaveState(4);
  }, []);

  const value = useMemo(() => ({
    keySignature,
    setKeySignature,
    timeSignature,
    setTimeSignature,
    timeSignatureMode,
    setTimeSignatureMode,
    selectedRhythm,
    setSelectedRhythm,
    isDotted,
    setIsDotted,
    isRest,
    setIsRest,
    notes,
    setNotes,
    instruments,
    activeInstrumentId,
    activeInstrument,
    setActiveInstrumentId,
    addInstrument,
    removeInstrument,
    updateInstrument,
    changeInstrument,
    clefType,
    setClefType,
    cursorPosition,
    setCursorPosition,
    ghostPitch,
    ghostOctave,
    setGhostPitch,
    setGhostOctave,
    notationStyle,
    setNotationStyle,
    notationMode,
    setNotationMode,
    switchNotationMode,
    globalSpacingMultiplier,
    setGlobalSpacingMultiplier,
    staffSpacing,
    setStaffSpacing,
    measureWidthMultiplier,
    setMeasureWidthMultiplier,
    getEffectiveDuration: getEffectiveDurationForSelection,
    addNote,
    transposeScore,
    transposeToKey,
    createNewFile,
    DURATIONS,
  }), [
    keySignature,
    timeSignature,
    timeSignatureMode,
    selectedRhythm,
    isDotted,
    isRest,
    notes,
    instruments,
    activeInstrumentId,
    activeInstrument,
    clefType,
    cursorPosition,
    ghostPitch,
    ghostOctave,
    notationStyle,
    notationMode,
    globalSpacingMultiplier,
    staffSpacing,
    measureWidthMultiplier,
    getEffectiveDurationForSelection,
    addNote,
    transposeScore,
    transposeToKey,
    createNewFile,
  ]);

  return (
    <NotationContext.Provider value={value}>
      {children}
    </NotationContext.Provider>
  );
}
