# Program spec: methods vs engines

**Purpose:** One place that defines how the program should work and **strictly separates methods from engines**. Use this when briefing developers or tools (e.g. Vercel, AI): so nothing creates unnecessary views, symbol design, or function keys by mistake.

---

## Rule

- **Methods** = what the user chooses and sees: **which view**, **which symbols**, **which function keys** for Traditional, Figurenotes, or Pedagogical.
- **Engines** = shared logic: **one** data model, **one** layout, **one** input pipeline. No per-method duplicate engines.

**Do not:** Create or change a view, symbol set, or shortcut layout “by view” unless this spec says that change belongs to a specific method.  
**Do:** Change only the method(s) or engine layer that the task specifies.

---

## 1. The three methods (user-facing)

Each method is a **mode** the user can select. It determines **which view is shown**, **which symbol system is used**, and **which shortcuts/keys apply** for that mode.

### Method 1: TRADITIONAL

| What | Spec |
|------|------|
| **User intent** | Standard Western notation: staff, clefs (treble/bass/alto/tenor), SMuFL noteheads and rests, beams. |
| **View** | **Exactly one:** `TraditionalNotationView`. No other view must render “traditional” notation. |
| **Symbols** | Noteheads and rests from SMuFL (Leland) via `NoteSymbols.jsx`, `RestSymbols.jsx`, `ClefSymbols.jsx` (Treble, Bass, C-clef). Stems, flags, beams from `BeamCalculation.js` and `StaffConstants.js`. |
| **Function keys / toolbox** | Rhythm toolbox shows `RhythmIcon` (note/rest icons). Clef toolbox: treble, bass, alto, tenor. Time signature: standard or pedagogical denominator. Keyboard shortcuts for rhythm (2–7, 0, dot) apply. |
| **Layout** | Uses engine’s **traditional** branch: staff lines, measure bars, clef at start of system. |
| **Trigger** | `notationStyle === 'TRADITIONAL'` and `notationMode !== 'vabanotatsioon'`. |

**Do not:** Add a second “traditional view” or a duplicate set of traditional symbol components. All traditional rendering goes through this method and its single view/symbol set.

---

### Method 2: FIGURENOTES

| What | Spec |
|------|------|
| **User intent** | Figurenotes.org-style: pitch = shape + color (C=red square, D=circle, …), duration = note width or stems/flags; rest = “Z”; grid of measure boxes. |
| **View** | **Exactly one:** `FigurenotesView`. No other view must render the Figurenotes grid and colored shapes. |
| **Symbols** | Shapes and colors from `FigureNotesLibrary.js` (paths and colors per pitch; octave styles). Optional stems/flags for duration. Rest = “Z”. Traditional note names (C, D, E, …) only; pedagogical (JO/LE/MI) names are not used. Toolbox duration = `FigurenotesBlockIcon` (gray blocks). |
| **Function keys / toolbox** | Rhythm toolbox shows `FigurenotesBlockIcon` per duration. No clef toolbox for Figurenotes (no JO clef in this view). Same rhythm numeric keys (2–7, 0, dot) for input. |
| **Layout** | Uses engine’s **figure** branch: measure boxes, beat grid, horizontal flow of figures. |
| **Trigger** | `notationStyle === 'FIGURENOTES'`. |

**Do not:** Create an extra “Figurenotes view” or duplicate Figurenotes shape/color logic elsewhere. All Figurenotes rendering goes through this method and its single view/symbol set.

---

### Method 3: PEDAGOGICAL (Pedagoogiline notatsioon)

| What | Spec |
|------|------|
| **User intent** | Movable “JO” (Do) clef; colors and shapes **relative to JO**, not absolute pitch. Same staff as traditional, but notehead color/shape from `PedagogicalLogic.js` (JO-relative). |
| **View** | **Same view as Traditional:** `TraditionalNotationView`, with JO clef and pedagogical coloring. Not a third view component. |
| **Symbols** | Clef: JO clef from `ClefSymbols.jsx` (`JoClefSymbol`). Note appearance: staff position + color/shape from `getPedagogicalSymbol()` (JO-relative). Notehead/rest glyphs still SMuFL; color/shape overlay is pedagogical-only. |
| **Function keys / toolbox** | Same as Traditional (rhythm toolbox with `RhythmIcon`, clef toolbox, time signature). JO clef position is adjustable (e.g. joClefStaffPosition). |
| **Layout** | Uses engine’s **pedagogical** branch (same as traditional layout, with JO clef placement). |
| **Trigger** | `notationMode === 'vabanotatsioon'` (with staff notation, i.e. not Figurenotes). |

**Do not:** Build a separate “PedagogicalView” or duplicate staff-drawing logic. Pedagogical = Traditional view + JO clef + PedagogicalLogic for color/shape.

---

## 2. The engines (shared; do not duplicate)

Engines are **independent of which method is selected**. There is **one** of each. Do not create engine logic “per view” or “per method”.

### 2.1 Data engine

| What | Spec |
|------|------|
| **Single source of truth** | `NotationContext` (and in noodimeister-complete: notes, staves, timeSignature, keySignature, cursorPosition, etc.). |
| **Note shape** | One note object: `{ pitch, octave, duration, durationLabel, isRest, isDotted, ... }`. Same for all methods. |
| **Rules** | No separate “traditional notes” vs “figurenotes notes” vs “pedagogical notes”. One note list; methods only change how it is **displayed** (which view + which symbols). |

**Do not:** Create a separate store or note model per method. All methods read from the same data engine.

---

### 2.2 Layout engine

| What | Spec |
|------|------|
| **Single entry** | `LayoutEngine.jsx`: `calculateLayout(mode, orientation, data)`. |
| **Branches** | `mode === 'figure'` → figure grid; `mode === 'traditional'` → traditional systems; `mode === 'pedagogical''` → same as traditional (with JO). One file, one public function, internal branches only. |
| **Rules** | No separate “TraditionalLayoutEngine”, “FigurenotesLayoutEngine”, “PedagogicalLayoutEngine”. One engine, mode parameter. |

**Do not:** Create three separate layout engines or three separate layout entry points. Add or change layout behaviour inside `LayoutEngine.jsx` by mode.

---

### 2.3 Input engine

| What | Spec |
|------|------|
| **Pitch input** | One path: keyboard/MIDI → `PitchInputLogic` / handler → add or update note in the single data model. Same for all methods. |
| **Rhythm input** | Toolbox and shortcuts update `selectedRhythm`, `isDotted`, `isRest` and apply to note creation or selection. Same state for all methods; only the **toolbox icons** shown are method-specific (RhythmIcon vs FigurenotesBlockIcon). |
| **Rules** | No separate “traditional input engine” vs “figurenotes input engine”. One input pipeline; method only changes which UI (toolbox icons, optional key behaviour) is shown. |

**Do not:** Create separate input handlers or state machines per method. One input flow; method selects which keys/toolbar are active or visible.

---

## 3. What belongs where (quick reference)

| If you want to change… | Where it lives | Do not… |
|------------------------|----------------|--------|
| How traditional staff and notes look | Method: TRADITIONAL → `TraditionalNotationView`, `NoteSymbols.jsx`, `RestSymbols.jsx`, `ClefSymbols.jsx`, `BeamCalculation.js` | Add another traditional view or duplicate SMuFL symbol set |
| How Figurenotes grid and shapes look | Method: FIGURENOTES → `FigurenotesView`, `FigureNotesLibrary.js`, Figurenotes rest “Z” and stems | Add another Figurenotes view or duplicate shape/color logic |
| How pedagogical (JO) colors/shapes look | Method: PEDAGOGICAL → `PedagogicalLogic.js`, JO clef in `ClefSymbols.jsx`, same view as Traditional | Add a separate PedagogicalView or duplicate staff rendering |
| Rhythm toolbox icons per method | Methods: TRADITIONAL/PEDAGOGICAL → `RhythmIcon`; FIGURENOTES → `FigurenotesBlockIcon` in `rhythmToolbox.jsx` | Create new toolbox components “by view” unless the spec adds a new method |
| Which view is shown for which mode | `ViewSwitcher.jsx`, `getViewModeFromNotation(notationStyle, notationMode)` | Derive view from ad‑hoc logic elsewhere; keep this single place |
| Where notes and measures come from | Engine: data → `NotationContext` / noodimeister state | Create method-specific note stores or measure builders |
| How measures/systems are positioned | Engine: layout → `LayoutEngine.jsx` `calculateLayout(mode, ...)` | Create separate layout engines per method |
| How key presses add notes | Engine: input → same handlers for all methods | Create separate input engines per method |

---

## 4. How to brief a developer or tool (e.g. Vercel)

Use this spec to avoid unnecessary work:

- **“Change only the Traditional method”**  
  → Change only: `TraditionalNotationView`, traditional symbol components (`NoteSymbols`, `RestSymbols`, Clefs), and traditional toolbox (e.g. `RhythmIcon`). Do **not** add a new view or a new engine.

- **“Change only the Figurenotes method”**  
  → Change only: `FigurenotesView`, `FigureNotesLibrary.js`, `FigurenotesBlockIcon`, and Figurenotes-specific layout branch. Do **not** add a new view or a new engine.

- **“Change only the Pedagogical method”**  
  → Change only: `PedagogicalLogic.js`, JO clef, and the way Traditional view uses JO + pedagogical symbols. Do **not** add a new PedagogicalView or duplicate staff logic.

- **“Change only the layout engine”**  
  → Change only: `LayoutEngine.jsx` (and possibly `LayoutManager.js`). Do **not** create new views or new symbol components.

- **“Change only the data engine”**  
  → Change only: note structure, `NotationContext`, and any code that reads/writes that state. Do **not** create method-specific stores or duplicate note models.

- **“Add a new method”**  
  → Only then: define a new method in this spec (view, symbols, keys, trigger), and add one branch in the layout engine and view switcher. Do **not** add a new data or input engine.

---

## 5. File map (methods vs engines)

| Layer | Files | Belongs to |
|-------|--------|------------|
| **Method: Traditional** | `TraditionalNotationView.jsx`, `NoteSymbols.jsx`, `RestSymbols.jsx`, `ClefSymbols.jsx` (Treble/Bass/C), `BeamCalculation.js`, `StaffConstants.js`, `smufl/glyphs.js`, `rhythmToolbox.jsx` (RhythmIcon, pattern icons) | Method |
| **Method: Figurenotes** | `FigurenotesView.jsx`, `FigureNotesLibrary.js`, `rhythmToolbox.jsx` (FigurenotesBlockIcon), `getFigureNoteWidth` usage | Method |
| **Method: Pedagogical** | `PedagogicalLogic.js`, `ClefSymbols.jsx` (JoClefSymbol), JO-related options in Traditional view | Method |
| **View selection** | `ViewSwitcher.jsx`, `NotationModes.js` | Method |
| **Engine: Data** | `NotationContext.jsx`, note/staff state in `noodimeister-complete.jsx` | Engine |
| **Engine: Layout** | `LayoutEngine.jsx`, `LayoutManager.js` | Engine |
| **Engine: Input** | `PitchInputLogic`, rhythm/toolbox handlers that update context and add notes | Engine |

This document is the **single place** that defines how the program works and how methods are separated from engines. When in doubt, check here before adding a new view, a new symbol set, or a new engine.
