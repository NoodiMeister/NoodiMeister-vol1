# Symbol improvement consultation

**Goal:** Traditional notation, Figurenotes, and pedagogical methods should work perfectly and look professional — comparable to **MuseScore** (traditional) and **figurenotes.org** (Figurenotes).

This doc explains:
1. What you already have (symbol functions + design)
2. What “professional” usually means for each system
3. **What to tell a developer** to improve **symbol functions** vs **symbol design**

---

## 1. What you have today

### Traditional (MuseScore-like)
- **Note symbols:** `NoteSymbols.jsx` — SMuFL noteheads (Leland), stems, flags (1–3), beam support via `BeamCalculation.js`
- **Rest symbols:** `RestSymbols.jsx` — SMuFL rests (whole … 32nd)
- **Clefs:** `ClefSymbols.jsx` — Treble, Bass, JO (Pedagoogiline notatsioon), SMuFL for treble/bass
- **Staff:** `StaffConstants.js` — staff space, stem length, notehead size, ledger width
- **Beams:** `BeamCalculation.js` — beam groups, geometry, stem lengths to beam

### Figurenotes (figurenotes.org-like)
- **Shapes + colors:** `FigureNotesLibrary.js` — C=red square, D=circle, E=triangle, F=rectangle, G=star, A=diamond, B=white oval; octave styles (cross, darkened, outline)
- **View:** `FigurenotesView.jsx` — colored shapes, optional stems/flags, JO names, rest = “Z”, optional rhythm syllables
- **Toolbox:** `FigurenotesBlockIcon` in `rhythmToolbox.jsx` — gray duration blocks (1×, 2×, …)

### Pedagogical
- **Time signature:** Pedagogical mode in both views — numerator + note shape for denominator (e.g. quarter note icon instead of “4”)
- **Rhythm syllables:** Kodály (ta, ti-ti, etc.) via `RHYTHM_SYLLABLE_IMAGES` and `RhythmSyllableLabel`
- **JO names:** `joNames.js` — note names in Figurenotes view

---

## 2. What “professional” usually means

### MuseScore (traditional)
- **Consistent scaling:** All glyphs (noteheads, rests, clefs) use one staff-space-based scale (e.g. 4× staff space for noteheads).
- **Stem/flag rules:** Stem side (left/right) by stem direction; flags one side; smooth join between stem and notehead.
- **Beams:** Horizontal (or slight slope), clean connection to stems, correct number of beams (1=8th, 2=16th, 3=32nd).
- **Rests:** Centered in staff space, correct vertical alignment (e.g. whole/half on line, eighth/sixteenth hang from above).
- **Clefs:** Aligned so that the reference line (G for treble, F for bass) sits exactly on the staff line.

### Figurenotes.org
- **Clear shapes:** Each pitch = one shape, one color; shapes are simple and recognizable (square, circle, triangle, etc.).
- **Duration:** Shown by stem + number of flags (or by “block” length in toolbox), not by changing the shape.
- **Rest:** Distinct symbol (often “Z” or similar) so it’s never confused with a note.
- **Layout:** Uncluttered; spacing and size consistent so that learners can scan quickly.

---

## 3. What to improve: two layers

Improvements split into:

- **Symbol functions** — *where* and *how* symbols are chosen, positioned, and combined (logic, API, layout).
- **Symbol design** — *how* each symbol looks (glyphs, shapes, strokes, proportions).

You can ask for changes in either or both.

---

## 4. What to tell someone to improve SYMBOL FUNCTIONS

Use phrases like:

- **“Fix symbol choice”**  
  - “Use the correct notehead type for 1/32 in the timeline (e.g. black notehead + 3 flags, not sixteenth + extra flags).”  
  - “Use the correct rest type everywhere (including 1/32 rest) from `smuflRestForDurationLabel` / `RestSymbol`.”

- **“Fix positioning/alignment”**  
  - “Rests should be vertically centered in the staff space (or follow SMuFL alignment).”  
  - “Treble clef: G line should sit exactly on the second line from the top.”  
  - “Stems should attach at the correct side of the notehead (right when up, left when down) and meet the beam cleanly.”

- **“Fix scaling/sizing”**  
  - “All traditional symbols (notes, rests, clefs) should scale from one `staffSpace` (or one fontSize) so they stay in proportion when staff size changes.”  
  - “Figurenotes shapes and stems should scale with the figure size so they don’t look tiny or huge.”

- **“Fix beams”**  
  - “Beams should be horizontal (or follow MuseScore-style slope) and connect to stems without gaps.”  
  - “Beam thickness and spacing between beams should match staff space.”

- **“Unify toolbox vs staff”**  
  - “Rhythm toolbox icons (RhythmIcon, FigurenotesBlockIcon, pattern icons) should match the same logic and proportions as the symbols on the staff/timeline.”

- **“Pedagogical mode”**  
  - “In pedagogical time signature, the denominator note symbol should use the same NoteSymbol/RestSymbol as the rest of the app (or the same scaling).”  
  - “Rhythm syllable labels should align consistently with notes/rests and not overlap.”

- **“Figurenotes-specific”**  
  - “Figurenotes rest (Z) size and position should be consistent with note figure size.”  
  - “Stems and flags in Figurenotes view should follow the same duration rules as traditional (1/8=1 flag, 1/16=2, 1/32=3).”

**Example one-liner:**  
*“Fix symbol functions so that 1/32 notes and rests use the correct glyphs everywhere (timeline, staff, toolbox) and all traditional symbols scale from staffSpace.”*

---

## 5. What to tell someone to improve SYMBOL DESIGN

Use phrases like:

- **“Match MuseScore / SMuFL look”**  
  - “Noteheads: use Leland (or Bravura) SMuFL glyphs and match MuseScore’s oval proportion (width vs height).”  
  - “Flags: use the same S-shaped curve as MuseScore for eighth/sixteenth/32nd.”  
  - “Rests: use SMuFL rest glyphs; if we render ourselves, match their proportions and stroke thickness.”

- **“Improve clefs”**  
  - “Treble clef spiral should be centered on the G line and match standard proportions.”  
  - “Bass clef dots and curve should align with the F line.”  
  - “JO clef: make the window and pillars match our reference (e.g. JoClefSymbol.svg) and keep ledger lines aligned.”

- **“Improve Figurenotes shapes”**  
  - “Match figurenotes.org shapes: same colors (e.g. C=red square, D=circle, …) and same shapes (star for G, diamond for A, etc.).”  
  - “Octave styling (cross, outline, darkened) should be clearly visible and consistent with official Figurenotes.”

- **“Improve rhythm toolbox icons”**  
  - “RhythmIcon: make the small note/rest icons look like mini versions of the real SMuFL symbols (same shape, fewer pixels).”  
  - “FigurenotesBlockIcon: match the gray blocks to the duration grid (e.g. 1/4 = one block, 1/2 = two, 1/1 = four).”  
  - “Pattern icons (2/8, 4/16, etc.): use same notehead/stem/beam style as TraditionalNotationView.”

- **“Stroke and fill”**  
  - “Use a single `--note-fill` (or equivalent) for all traditional note/rest stroke and fill so themes work.”  
  - “Figurenotes: ensure contrast (e.g. white text on dark shapes, black on light) and consistent stroke width.”

**Example one-liner:**  
*“Improve symbol design so traditional notes and rests use SMuFL proportions and flag shape like MuseScore, and Figurenotes shapes and colors match figurenotes.org.”*

---

## 6. Quick reference: where things live

| What | Symbol functions | Symbol design |
|------|------------------|----------------|
| **Traditional notes** | `NoteSymbols.jsx`, `TraditionalNotationView.jsx`, `BeamCalculation.js`, timeline in `noodimeister-complete.jsx` | `NoteSymbols.jsx` (Stem, Flags), `smufl/glyphs.js`, font (Leland) |
| **Traditional rests** | `RestSymbols.jsx`, views, timeline | `RestSymbols.jsx`, `glyphs.js` |
| **Clefs** | `ClefSymbols.jsx`, staff layout in views | `ClefSymbols.jsx`, `SmuflGlyph` + glyphs |
| **Figurenotes** | `FigurenotesView.jsx`, `getFigureNoteWidth`, `LayoutEngine` | `FigureNotesLibrary.js` (paths, colors), `FigurenotesView.jsx` (stems, Z) |
| **Toolbox (rhythm)** | `rhythmToolbox.jsx`, `noodimeister-complete.jsx` (which icon for which option) | `RhythmIcon`, `FigurenotesBlockIcon`, `RHYTHM_PATTERN_ICONS` in `rhythmToolbox.jsx` |
| **Pedagogical** | Time signature and syllable rendering in both views | Same as above + `RhythmSyllableLabel`, syllable SVGs |

---

## 7. Summary: what to say to get the right improvements

- **“I want it to look like MuseScore”**  
  → Focus on: SMuFL scaling, stem/flag/beam rules, rest alignment, clef alignment.  
  → Say explicitly: “Improve **traditional symbol design** to match MuseScore” and/or “Fix **traditional symbol functions** (scaling, beams, rest/note types).”

- **“I want it to look like figurenotes.org”**  
  → Focus on: shape set and colors in `FigureNotesLibrary.js`, duration display (stems/flags or blocks), rest “Z”, layout clarity.  
  → Say: “Improve **Figurenotes symbol design** to match figurenotes.org” and/or “Fix **Figurenotes symbol functions** (sizing, alignment, rest and stem rules).”

- **“Pedagogical and traditional/Figurenotes must work together”**  
  → Focus on: one set of symbol choices and one scaling system for staff, toolbox, and pedagogical time signature/syllables.  
  → Say: “Unify **symbol functions** so pedagogical mode uses the same note/rest symbols and scaling as the main notation.”

You can paste one of the example one-liners from sections 4 and 5 into a task or chat to direct improvements precisely to either **symbol functions** or **symbol design**, or both.
