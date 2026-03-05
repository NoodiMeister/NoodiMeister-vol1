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

export function NotationProvider({ children }) {
  const [keySignature, setKeySignatureState] = useState('C');
  const [timeSignature, setTimeSignatureState] = useState(defaultTimeSignature);
  const [timeSignatureMode, setTimeSignatureModeState] = useState('standard'); // 'standard' | 'pedagogical'
  const [selectedRhythm, setSelectedRhythmState] = useState('1/4'); // durationLabel – RhythmToolbox valik
  const [isDotted, setIsDottedState] = useState(false);
  const [isRest, setIsRestState] = useState(false);
  const [notes, setNotesState] = useState([]);
  const [clefType, setClefTypeState] = useState('treble');
  const [cursorPosition, setCursorPositionState] = useState(0);
  const [ghostPitch, setGhostPitchState] = useState('C');
  const [ghostOctave, setGhostOctaveState] = useState(4);
  const [notationStyle, setNotationStyleState] = useState('TRADITIONAL'); // 'TRADITIONAL' | 'FIGURENOTES'

  const setKeySignature = useCallback((key) => setKeySignatureState(key), []);
  const setTimeSignature = useCallback((ts) => setTimeSignatureState(ts || defaultTimeSignature), []);
  const setTimeSignatureMode = useCallback((mode) => setTimeSignatureModeState(mode), []);
  const setSelectedRhythm = useCallback((dur) => setSelectedRhythmState(dur), []);
  const setIsDotted = useCallback((d) => setIsDottedState(!!d), []);
  const setIsRest = useCallback((r) => setIsRestState(!!r), []);
  const setNotes = useCallback((updater) => {
    setNotesState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);
  const setClefType = useCallback((clef) => setClefTypeState(clef), []);
  const setCursorPosition = useCallback((pos) => setCursorPositionState(pos), []);
  const setGhostPitch = useCallback((p) => setGhostPitchState(p), []);
  const setGhostOctave = useCallback((o) => setGhostOctaveState(o), []);
  const setNotationStyle = useCallback((s) => setNotationStyleState(s), []);

  const getEffectiveDurationForSelection = useCallback((durationLabel, dotted) => {
    return getEffectiveDuration(durationLabel ?? selectedRhythm, dotted ?? isDotted);
  }, [selectedRhythm, isDotted]);

  /** Lisab noodi kursorisse. Mootor kasutab seda pärast PitchInputLogic.getPitchFromMidi. */
  const addNote = useCallback((pitch, octave, accidental = 0, options = {}) => {
    const durationLabel = options.durationLabel ?? selectedRhythm;
    const dotted = options.isDotted ?? isDotted;
    const rest = options.isRest ?? isRest;
    const effectiveDuration = getEffectiveDuration(durationLabel, dotted);

    const newNote = {
      id: options.id ?? Date.now(),
      pitch,
      octave,
      duration: effectiveDuration,
      durationLabel,
      isDotted: dotted,
      isRest: rest,
      lyric: options.lyric ?? '',
      ...(accidental !== 0 && { accidental }),
      ...(options.tuplet && { tuplet: options.tuplet }),
    };

    setNotesState((prev) => [...prev, newNote]);
    setCursorPositionState((p) => p + effectiveDuration);
    setGhostPitchState(pitch);
    setGhostOctaveState(octave);
    return newNote;
  }, [selectedRhythm, isDotted, isRest]);

  /** Transponeerib kõik noodid pooltoonide võrra. Pausid jäävad muutmata. */
  const transposeScore = useCallback((semitones) => {
    if (!semitones) return;
    setNotesState((prev) => transposeNotes(prev, semitones));
  }, []);

  /** Transponeerib partituuri uude helistikku (värskendab ka keySignature). */
  const transposeToKey = useCallback((newKey) => {
    const semitones = getTransposeSemitones(keySignature, newKey);
    if (!semitones) return;
    setNotesState((prev) => transposeNotes(prev, semitones));
    setKeySignatureState(newKey);
  }, [keySignature]);

  /** Uue faili loomine: tühjendab noodid, kursor algusesse, ghost väärtused. */
  const createNewFile = useCallback(() => {
    setNotesState([]);
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
    clefType,
    cursorPosition,
    ghostPitch,
    ghostOctave,
    notationStyle,
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
