# Rütmipildid ja nende sisestamise/joonistamise loogika

Dokument kirjeldab, kus asuvad rütmi tööriista pildid (ikoonid), kuidas valikud sisestatakse ja kuidas noodid/pausid joonistatakse.

---

## 1. Rütmipiltide koodid (ikoonid tööriistakastis)

### 1.1 Asukohad

- **Põhiloogika ja ikoonid (traditsiooniline + patternid):** `src/toolboxes/rhythmToolbox.jsx`
- **Duplikaat RHYTHM_PATTERN_ICONS:** `src/noodimeister-complete.jsx` (read 199–249) – kasutatakse UI renderdamisel, kui import ei tule rhythmToolboxist
- **Kodály silpide pildid (SVG failid):** `public/` – `ta.svg`, `ti-ti.svg`, `ta-a.svg`, `sh-sh.svg`, `ti-ri-ti-ri.svg`, `ta-a-a-a.svg`, `ri.svg`

### 1.2 Üksikute vältuste ikoonid (noodid ja pausid)

Funktsioon **`RhythmIcon`** (`src/toolboxes/rhythmToolbox.jsx`):

- **Props:** `duration`, `isDotted`, `isRest`
- **`duration` väärtused:** `'1/1'`, `'1/2'`, `'1/4'`, `'1/8'`, `'1/16'`, `'1/32'`. Erijuhtumid: `'rest'` ja `'dotted'` käsitletakse kui `'1/4'` (veerand).
- **Noodid:** iga vältus on SVG (ellipse pea + vars + vajadusel lipud). Punktiga noodil lisatakse `isDotted` → täpp.
- **Pausid:** `isRest === true` → eraldi SVG per vältus (täis-, pool-, veerand-, kaheksandik-, kuueteistkümnendik-, kuuskümnendikpaus).

Konkreetsed komponendid failis:
- Noodid: `noteIcons[d]` – whole/half (tühi pea), quarter/eighth/sixteenth/32nd (täidetud pea + vars + 0/1/2/3 lippu).
- Pausid: `restIcons[d]` – rect/path/circle+path vastavalt 1/1 … 1/32.

### 1.3 Rütmimustrite (patternite) ikoonid

**`RHYTHM_PATTERN_ICONS`** (mõlemas kohas ühesugune loogika):

| Võti        | Kirjeldus (visuaal) |
|------------|----------------------|
| `'2/8'`    | 2 kaheksandiknooti, ühine tala |
| `'4/16'`   | 4 kuueteistkümnendiknooti, kaks tala |
| `'8/16'`   | 8 kuueteistkümnendiknooti, kaks tala |
| `'1/8+2/16'` | 1/8 + 2×1/16 (punktirütm: pikk–lühike–lühike) |
| `'2/16+1/8'` | 2×1/16 + 1/8 (lühike–lühike–pikk) |
| `'triplet'`  | 3 nooti, number 3 (triool) |

Ikoonid on JSX SVG-d (ellipsid noodipead, jooned varred, horisontaalsed jooned talad).

### 1.4 Kodály silpide pildid (rütmisilbid)

**`RHYTHM_SYLLABLE_IMAGES`** – võti on vältus või `'rest'`, väärtus on tee public/ failini:

- `'1/4'` → `/ta.svg`
- `'1/8'` → `/ti-ti.svg`
- `'1/2'` → `/ta-a.svg`
- `'rest'` → `/sh-sh.svg`
- `'1/16'` → `/ti-ri-ti-ri.svg`
- `'1/1'` → `/ta-a-a-a.svg`
- `'1/32'` → `/ri.svg`

Neid kasutatakse rütmitööriista paneelis, kui soovitakse näidata silpide pilti (õpetaja/režiimi sõltuvalt).

---

## 2. Rütmitööriista valikud (toolbox options)

**`getToolboxes(t, instrumentConfig).rhythm.options`** (`src/noodimeister-complete.jsx`, umbes read 566–581):

| Indeks | id        | value       | key/code   | Tõlge (võti) |
|--------|-----------|-------------|------------|----------------|
| 0      | 1/32      | '1/32'      | 2, Digit2  | note.thirtySecond |
| 1      | 1/16      | '1/16'      | 3, Digit3  | note.sixteenth |
| 2      | 1/8       | '1/8'       | 4, Digit4  | note.eighth |
| 3      | 1/4       | '1/4'       | 5, Digit5  | note.quarter |
| 4      | 1/2       | '1/2'       | 6, Digit6  | note.half |
| 5      | 1/1       | '1/1'       | 7, Digit7  | note.whole |
| 6      | 2/8       | '2/8'       | –          | note.pattern2eighth |
| 7      | 4/16      | '4/16'      | –          | note.pattern4sixteenth |
| 8      | 8/16      | '8/16'      | –          | note.pattern8sixteenth |
| 9      | 1/8+2/16  | '1/8+2/16'  | –          | note.patternEighthTwoSixteenth |
| 10     | 2/16+1/8  | '2/16+1/8'  | –          | note.patternTwoSixteenthEighth |
| 11     | rest      | 'rest'      | 0, Digit0  | note.rest |
| 12     | dotted    | 'dotted'    | ., Period  | note.dotted |

**UI render:** Rütmipaneel (activeToolbox === 'rhythm') joonistab iga `option` jaoks ikooni järgmise reegli järgi (`noodimeister-complete.jsx`, umbes rida 4625–4632):

- Kui `notationStyle === 'FIGURENOTES'` ja value on üks vältustest `['1/1','1/2','1/4','1/8','1/16','1/32']` → `<FigurenotesBlockIcon duration={option.value} />`
- Kui leidub `RHYTHM_SYLLABLE_IMAGES[option.value]` → `<img src={...} />` + fallback `<RhythmIcon duration={option.value} />`
- `option.value === 'rest'` → `<RhythmIcon duration={selectedDuration} isRest={true} />`
- `option.value === 'dotted'` → `<RhythmIcon duration={selectedDuration} isDotted={true} />`
- Patternid `['2/8','4/16','8/16','1/8+2/16','2/16+1/8']` → `<RhythmPatternIcon pattern={option.value} />`
- Üksikvältused `['1/1','1/2','1/4','1/8','1/16','1/32']` (kui ei ole figurenotes ega silpide pilt) → noot + paus: `<><RhythmIcon duration={option.value} /><RhythmIcon duration={option.value} isRest={true} /></>`

---

## 3. Sisestamise loogika

### 3.1 Vältused ja olek

- **NotationContext** (`src/store/NotationContext.jsx`): `selectedRhythm` (durationLabel), `isDotted`, `isRest`.
- **DURATIONS:** `'1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125` (beats, 1 = üks veerand).
- **getEffectiveDuration(durationLabel, isDotted):** tagastab `DURATIONS[durationLabel] * (isDotted ? 1.5 : 1)`.

Noodimeisteris (single-staff) kasutatakse kohalikku state’i: `selectedDuration`, `isDotted`, `isRest`, `lastDurationRef` – need sünkroonitakse/loetakse kontekstist või ref’ist.

### 3.2 Klõps rütmitööriistas: handleToolboxSelection('rhythm')

**Fail:** `src/noodimeister-complete.jsx`, `handleToolboxSelection`, case `'rhythm'` (umbes read 2454–2504).

1. **Patternid** (`'2/8'`, `'4/16'`, `'8/16'`, `'1/8+2/16'`, `'2/16+1/8'`):
   - Kutsutakse `insertPatternAtCursor(option.value)`.
   - Lisatakse kursorile vastav massiiv noote (vt allpool RHYTHM_PATTERN_NOTES).
   - Paneel suletakse.

2. **Paus (rest):**
   - Kui on valitud noote: valitud nootide `isRest` lükatakse ümber.
   - Kui valikut pole: `setIsRest(prev => !prev)` (sisestusrežiimis järgmised noodid tulevad pausidena).

3. **Punkt (dotted):**
   - Kui on valitud noote: valitud nootide puhul `isDotted` ja `duration` uuendatakse (duration = base * 1.5).
   - Kui valikut pole: `setIsDotted(prev => !prev)`.

4. **Üksikvältused** (`'1/1'`, `'1/2'`, `'1/4'`, `'1/8'`, `'1/16'`, `'1/32'`):
   - `lastDurationRef.current = option.value`, `setSelectedDuration(option.value)`.
   - Kui on valitud noote: kõigi valitud nootide `durationLabel` ja `duration` (ja vajadusel dotted) uuendatakse.
   - Kui valikut pole: järgmine sisestatav noot kasutab seda vältust (läbi `addNoteAtCursor`).

### 3.3 Ühe noodi sisestus: addNoteAtCursor

**Fail:** `src/noodimeister-complete.jsx`, umbes read 2339–2389.

- **durationLabel:** `lastDurationRef.current ?? selectedDuration`.
- **duration (beats):** `getEffectiveDuration(durationLabel)` (või trioli/kvintooli jms korral teisendatud väärtus).
- Uus noot: `{ id, pitch, octave, duration, durationLabel, isDotted, isRest, lyric, ... }`.
- Noodid lisatakse aktiivsele reale (või grand staff puhul vastavale reale helikõrgust järgi); kursor nihkub `cursorPosition + effectiveDuration`.

### 3.4 Mustrite sisestus: insertPatternAtCursor

**RHYTHM_PATTERN_NOTES** (sama fail, useMemo umbes read 2393–2400):

| Võti        | Massiiv (durationLabel, duration) |
|-------------|------------------------------------|
| '2/8'       | [ { 1/8, 0.5 }, { 1/8, 0.5 } ] |
| '4/16'      | 4× { 1/16, 0.25 } |
| '8/16'      | 8× { 1/16, 0.25 } |
| '1/8+2/16'  | [ { 1/8, 0.5 }, { 1/16, 0.25 }, { 1/16, 0.25 } ] |
| '2/16+1/8'  | [ { 1/16, 0.25 }, { 1/16, 0.25 }, { 1/8, 0.5 } ] |

**insertPatternAtCursor(patternKey):**
- Võtab `RHYTHM_PATTERN_NOTES[patternKey]`.
- Loob iga elemendi kohta noodi: sama `ghostPitch`, `ghostOctave`, `isRest`; `durationLabel` ja `duration` mustrist.
- Lisab kõik need nootid kursorile, suurendab `cursorPosition` mustri kogupikkuse võrra.

**Märkus:** Triooli ikoon (`'triplet'`) on ainult visuaal; triooli režiim lülitub klahvidega (Ctrl+3 jne), mitte selle nupu valikuga.

### 3.5 Klahvistik

- **2–7:** valitud rütm (2=1/32 … 7=1/1) – kas rakendub valitud nootidele või määrab järgmise noodi rütmi.
- **0 + rütmiklahv (2–7):** paus vastava vältusega (sisestatakse noot `isRest: true`).
- **.:** dotted toggle.
- **Ctrl+3 / Ctrl+5 / Ctrl+6 / Ctrl+7:** triool, kvintool, sekstool, septool (rütmivältuse sisse).

---

## 4. Joonistamise loogika

### 4.1 durationLabel → sümboli tüüp (traditsiooniline)

- **Noodid:**  
  **TraditionalNotationView** (`getNoteheadGlyph`, `getFlagCount`):
  - `1/1` → noteheadWhole  
  - `1/2` → noteheadHalf  
  - `1/4`, `1/8`, `1/16`, `1/32` → noteheadBlack  
  - Lippude arv: `1/8` → 1, `1/16` → 2, `1/32` → 3.

- **Timeline (noodimeister-complete):**  
  `durationLabelToNoteSymbolType`: `'1/1'→'whole'`, `'1/2'→'half'`, `'1/4'→'quarter'`, `'1/8'→'eighth'`, `'1/16'→'sixteenth'`, **`'1/32'→'sixteenth'`** (1/32 joonistatakse kuueteistkümnendikuna + 3 lippu).

- **Pausid:**  
  **glyphs.js** `smuflRestForDurationLabel`: 1/1→restWhole, 1/2→restHalf, 1/4→restQuarter, 1/8→rest8th, 1/16→rest16th, 1/32→rest32nd.  
  **RestSymbols.jsx:** tüübid `whole`, `half`, `quarter`, `eighth`, `sixteenth` – **1/32 (rest32nd) on glyphs.js-s olemas, kuid RestSymbols.jsx ei ekspordi ThirtySecondRestSymbolit; kui kuskil kasutatakse üldist `Rest`/type, võib 1/32 paus vajada oma branchi või tüüpi.**

### 4.2 Kust joonistamine toimub

- **Traditsiooniline viis:**  
  **TraditionalNotationView** – SMuFL noodipead, varred, lipud, talad; pausid `smuflRestForDurationLabel` + SmuflGlyph.
- **Figurenotes:**  
  **FigurenotesView** – kujund (värv/kuju), vajadusel vars ja 1/2/3 vibu (1/8, 1/16, 1/32); paus Z.
- **Timeline (noodimeister-complete):**  
  Ühe rea kohta inline: noodid (trad/fig), pausid (inline SVG 1/1, 1/2, 1/4, 1/8, 1/16, 1/32), ghost noot kursoril. Talade arvutus: **BeamCalculation.js** – `isBeamable(durationLabel)` (1/8, 1/16, 1/32), `getBeamLevel(durationLabel)` (1→2→3).

### 4.3 1/32 erijuht

- **NoteSymbols.jsx:** Ei eksporda `ThirtySecondNoteSymbol` ega `thirtySecond` tüüpi; Timeline kasutab `durationLabelToNoteSymbolType` → `'1/32' => 'sixteenth'` ja joonistab 3 lippu (getFlagCount või ekvivalent).
- **RestSymbols.jsx:** Ei sisalda `sixteenth`-st pikemat (e. 1/32 pausi komponenti); SMuFL rest32nd on `glyphs.js`-is olemas. 1/32 paus joonistatakse noodimeister-complete sees inline SVG-ga (read 5838–5846 ja 6221).

---

## 5. Failide viited kokkuvätlikult

| Mida | Fail |
|------|------|
| RhythmIcon, RHYTHM_PATTERN_ICONS, RHYTHM_SYLLABLE_IMAGES | `src/toolboxes/rhythmToolbox.jsx` |
| RHYTHM_PATTERN_ICONS duplikaat, toolboxes.rhythm.options, handleToolboxSelection rhythm | `src/noodimeister-complete.jsx` |
| RHYTHM_PATTERN_NOTES, insertPatternAtCursor, addNoteAtCursor | `src/noodimeister-complete.jsx` |
| DURATIONS, getEffectiveDuration, selectedRhythm | `src/store/NotationContext.jsx` |
| Noodi sümbolid (pea, vars, lipud) | `src/notation/NoteSymbols.jsx` |
| Pausi sümbolid (SMuFL) | `src/notation/RestSymbols.jsx` |
| SMuFL glyph id ja smuflRestForDurationLabel | `src/notation/smufl/glyphs.js` |
| Traditsiooniline vaade (getNoteheadGlyph, getFlagCount, pausid) | `src/views/TraditionalNotationView.jsx` |
| Figuurnoodid (kujund, vars, vibud, paus Z) | `src/views/FigurenotesView.jsx` |
| Talade loogika | `src/notation/BeamCalculation.js` |
| Timeline inline (ghost, pausid, durationLabelToNoteSymbolType) | `src/noodimeister-complete.jsx` (Timeline komponent) |

Kui teed parandusi rütmipiltide või sisestamise/joonistamise loogika juures, saad sellest dokumendist kiiresti ülevaate, kus mis asub ja kuidas väärtused (eriti `durationLabel`, `isDotted`, `isRest`) läbi süsteemi liiguvad.
