/**
 * Interaktiivne klaveririba (klahvid, vahemikud, oktaavi nupud).
 * Eksportib midiToPitchOctave ja getAccidentalForPianoKey, et noodimeister-complete saaks noodi lisamisel kasutada.
 */
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InteractivePiano } from '../piano';
import { FIGURENOTES_COLORS } from '../utils/figurenotes';

// --- MIDI abifunktsioonid (klaviatuuri vahemik ja noodi nimetused) ---
const MIDI_PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PIANO_MIDI_MIN = 21;
const PIANO_MIDI_MAX = 108;
const PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };

function getMidiAttributes(midiNumber) {
  const n = Number(midiNumber);
  if (!Number.isFinite(n) || n < 0 || n > 127) return { pitchName: 'C', octave: 4, isAccidental: false };
  const octave = Math.floor(n / 12) - 1;
  const pitchName = MIDI_PITCH_NAMES[n % 12];
  const isAccidental = [1, 3, 6, 8, 10].includes(n % 12);
  return { pitchName, octave, isAccidental };
}

/** MIDI number → lühike nimetus (nt "C3", "F#4") vahemiku kuvamiseks */
function midiToRangeLabel(midi) {
  const n = Number(midi);
  if (!Number.isFinite(n) || n < 0 || n > 127) return 'C4';
  return MIDI_PITCH_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}

/** MIDI → { pitch, octave, isAccidental } (looduslik aste C..B). Eksporditakse. */
export function midiToPitchOctave(midiNumber) {
  const attrs = getMidiAttributes(midiNumber);
  const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
  return { pitch: naturalPitch, octave: attrs.octave, isAccidental: attrs.isAccidental };
}

/** Musta klahvi alteratsioon helistiku järgi: bemolli-helistikud → ♭ (-1), muud → ♯ (1). Valge klahv → 0. Eksporditakse. */
export function getAccidentalForPianoKey(midiNumber, keySignature) {
  const attrs = getMidiAttributes(midiNumber);
  if (!attrs.isAccidental) return 0;
  const useFlat = keySignature === 'F' || keySignature === 'Bb' || keySignature === 'Eb';
  return useFlat ? -1 : 1;
}

const PIANO_RANGE_PRESETS = [
  { id: 'C3-C5', label: 'C3-C5', first: 48, last: 72 },
  { id: 'C2-C5', label: 'C2-C5', first: 36, last: 72 },
  { id: 'C1-C5', label: 'C1-C5', first: 24, last: 72 },
  { id: 'C1-C7', label: 'C1-C7', first: 24, last: 96 },
];

/**
 * @param {boolean} visible – kas klaveririba on nähtav
 * @param {() => void} onClose – sulgemisel (näiteks setPianoStripVisible(false); setActiveToolbox(null))
 * @param {string} keySignature – helistik (nt 'C', 'G', 'F')
 * @param {string} notationStyle – 'TRADITIONAL' | 'FIGURENOTES'
 * @param {boolean} noteInputMode – kas nooti sisestatakse
 * @param {(midiNumber: number) => void} onNotePlay – klahvi mängimisel (parent lisab noodi, uuendab ghost)
 * @param {(key: string) => string} t – tõlkefunktsioon
 */
export function PianoSection({
  visible,
  onClose,
  keySignature,
  notationStyle,
  /** 'pedagogical' → klaver näitab Figurenotes värve ja oktaavireegleid */
  notationMode = 'traditional',
  noteInputMode,
  onNotePlay,
  t,
}) {
  const [pianoRangeNumbers, setPianoRangeNumbers] = useState({ first: 48, last: 72 });
  const [pianoStripWidth, setPianoStripWidth] = useState(900);
  const pianoStripWrapperRef = useRef(null);

  useEffect(() => {
    const updatePianoWidth = () => setPianoStripWidth((w) => Math.min(900, Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 900) - 80)));
    updatePianoWidth();
    window.addEventListener('resize', updatePianoWidth);
    return () => window.removeEventListener('resize', updatePianoWidth);
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
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
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

  if (!visible) return null;

  const firstNote = pianoRangeNumbers.first;
  const lastNote = pianoRangeNumbers.last;
  const activePresetId = PIANO_RANGE_PRESETS.find((p) => p.first === firstNote && p.last === lastNote)?.id ?? null;
  const rangeLabel = activePresetId ?? `${midiToRangeLabel(firstNote)}–${midiToRangeLabel(lastNote)}`;

  const handleNotePlay = (midiNumber) => {
    onNotePlay(midiNumber);
  };

  const content = (
    <div className="fixed bottom-0 left-0 right-0 z-[100] min-h-[140px] bg-gradient-to-t from-amber-100 to-amber-50 border-t-2 border-amber-300 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] py-3 px-4" style={{ isolation: 'isolate' }}>
      <div className="mx-auto max-w-4xl" style={{ minHeight: 120 }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              {t('toolbox.pianoKeyboard')}
            </span>
            <span className="text-xs text-amber-600">
              {t('midi.mouseKeyboardHint') || 'Hiirega või arvutiklahvidega mängi noote. Noot ilmub noodijoonestikule.'} Alt+←/→ nihutab vahemikku.
            </span>
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
              onClick={onClose}
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
            figurenotesColors={notationStyle === 'FIGURENOTES' || notationMode === 'pedagogical' ? FIGURENOTES_COLORS : null}
            keySignature={keySignature}
            keyboardPlaysPiano={notationStyle === 'FIGURENOTES' || notationMode === 'pedagogical'}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
