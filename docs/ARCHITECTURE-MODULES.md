# Noodimeister – modulaarne arhitektuur

Rakendus on jagatud iseseisvateks mooduliteks, et vältida mahupiiranguid ja parandada selgust. Kõik moodulid suhtlevad ühtse Store/Context süsteemi kaudu.

## Store / Context

- **`src/store/NoodimeisterContext.jsx`**
  - `NoodimeisterProvider` – ümbritseb rakendust; hoiab auth (user, logout), teema, praeguse faili (currentFileId, currentFileName).
  - `useNoodimeister()` – kohustuslik hook; viskab viga, kui Provider puudub.
  - `useNoodimeisterOptional()` – optioneelne; tagastab `null`, kui Provider puudub.
  - Sisselogimine ja faili andmed säilivad; väljalogimine tühjendab ka praeguse faili kontekstist.

## Notatsiooni loogika

- **`src/notation/TraditionalNotation.jsx`** – re-ekspordib `TraditionalNotationView` ja staff-konstandid.
- **`src/notation/FigureNotation.jsx`** – re-ekspordib `FigurenotesView` ja `FIGURENOTES_COLORS`, `getFigureSymbol`.
- **`src/notation/PedagogicalNotation.jsx`** – JO-nimed (`getJoName`), Kodály rütmisilbid (`getRhythmSyllableForNote`), `RhythmSyllableLabel`, vaikeseaded (showRhythmSyllables, showAllNoteLabels, enableEmojiOverlays).

Olemasolevad sümbolite failid:

- **`src/notation/NoteSymbols.jsx`** – noodid (MuseScore stiilis pea, vars, lipud, vihud).
- **`src/notation/RestSymbols.jsx`** – pausid.
- **`src/components/ClefSymbols.jsx`** – JO-võti, viiuli- ja bassivõti (sinu JO-võti, viiul, bass).

## Tööriistakastid (UI visuaalsete sümbolitega)

- **`src/toolboxes/rhythmToolbox.jsx`** – rütm: `RhythmIcon`, `RhythmPatternIcon`, `RHYTHM_SYLLABLE_IMAGES`.
- **`src/toolboxes/clefsToolbox.jsx`** – noodivõtmed: `ClefIcon` (JO, treble, bass, alto, tenor).
- **`src/toolboxes/timeSignatureToolbox.jsx`** – taktimõõdud: `MeterIcon`, `PedagogicalMeterIcon`.
- **`src/toolboxes/index.js`** – ühine eksport kõigile tööriistakastide ikoonidele.

## Paigutus

- **`src/layout/LayoutManager.js`**
  - `LAYOUT` – lehelaius, marginaalid, A4 suhe, `MEASURE_MIN_WIDTH`, jne.
  - `PAGE_BREAK_GAP`, `getStaffHeight()`, `setLayoutConfig()`.
  - `computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, layoutOptions)` – süsteemide arvutus; toetab taktide arvu rea kohta, käsitsi rea/lehevahetusi, `measureStretchFactors`.
  - `applyMeasureStretch(measureStretchFactors, measureIndex, factorDelta)` – takti laiendamine/kokkusurumine ({ ja } klahvide loogika).

## Muusikaline loogika

- **`src/musical/transpose.js`** – `transposeNotes(notes, semitones)`, `pitchOctaveToMidi`, `midiToNoteWithAccidental`, `getTransposeSemitones`, `KEY_TO_SEMITONE`.
- **`src/musical/chordPlayback.js`** – `getChordMidiNotes`, `playChord` (akordide mängimine).
- **`src/musical/repeatPlayback.js`** – `getPlaybackMeasureOrder`, `getNotesInPlaybackOrder` (kordusmärgid, volta, playback-jada).

## UI komponendid

- **`src/components/PianoKeyboard.jsx`** – ekspordib `PianoSection`, `InteractivePiano`, `PianoKeyboard` (noodinimed ja figuurid klahvidel; kasutab `PianoSection` + `InteractivePiano`).
- **`src/components/UserDashboard.jsx`** – sisselogimisejärgne vaade; renderdab `MinuTöödPage`; kasutab `useNoodimeisterOptional()` ja suunab sisselogimata kasutaja `/login`-ile.

## Marsruudid ja Provider

- **`App.jsx`** – rakendus on ümbritsetud `NoodimeisterProvider`-iga; marsruut `/tood` kasutab `UserDashboard` (enne oli `MinuTöödPage`).
- **`noodimeister-complete.jsx`** – impordib `computeLayout`, `getStaffHeight`, `LAYOUT`, `PAGE_BREAK_GAP` asemel `layout/LayoutManager`; `transposeNotes` asemel `musical/transpose`; `useNoodimeisterOptional` asemel `store/NoodimeisterContext`. `LoggedInUser` kasutab store’i logout’i ja kasutaja kuvamiseks, kui store on olemas.

## Järgmised sammud (soovitused)

1. **Tööriistakastid** – `noodimeister-complete.jsx` võib `RhythmIcon`, `ClefIcon`, `MeterIcon` asemel importida `toolboxes/index`-ist, et duplikaat koodi vähendada.
2. **Sisselogimine ja store** – Login/Register võivad pärast edukat sisselogimist kutsuda `store.setUser(authStorage.getLoggedInUser())`, et header ja teised komponendid kohe kasutajat näeksid (praegu sünkroonitakse `UserDashboard` mount’il).
3. **LayoutManager ja klahvid** – klahvide { ja } võib siduda `applyMeasureStretch`-iga konkreetses taktis (praegu `applyMeasureStretch` on eksportitud, loogika on LayoutManageris).
