# Traditional symbols: full rebuild from MuseScore

**Status:** Phase 1–4 done. Single source of truth is `src/notation/musescoreStyle.js` (MuseScore default style). `EngravingDefaults.js` removed; all traditional symbols and StaffConstants use musescoreStyle.

---

## 1. What you decided

- The current design logic for traditional notation symbols is **false** and must go.
- The whole symbol code for **traditional** notation should be **radically deleted** and **started from scratch**.
- The new implementation must be based on **samples of MuseScore** (their proportions, rules, and visual style).

---

## 2. Scope: what “traditional symbol code” means

**In scope for deletion/rebuild (traditional only):**

| Area | Current files / code | Action |
|------|----------------------|--------|
| Noteheads, stems, flags | `src/notation/NoteSymbols.jsx` | Delete and rewrite from MuseScore reference |
| Rests | `src/notation/RestSymbols.jsx` | Delete and rewrite from MuseScore reference |
| Clefs (treble, bass, C) | `src/components/ClefSymbols.jsx` (Treble, Bass, C-clef only) | Delete and rewrite from MuseScore reference |
| Beams | `src/notation/BeamCalculation.js` | Delete and rewrite from MuseScore reference |
| Layout constants | `src/notation/StaffConstants.js`, `src/notation/EngravingDefaults.js` | Replace with MuseScore-based constants |
| SMuFL glyph usage | `src/notation/smufl/SmuflGlyph.jsx`, `src/notation/smufl/glyphs.js` | Keep only as glyph IDs; sizing/positioning from MuseScore |
| Traditional view rendering | `src/views/TraditionalNotationView.jsx` (symbol-drawing parts) | Update to use new symbol layer only |

**Out of scope (keep as-is for now):**

- **Figurenotes** symbols and logic (`FigureNotesLibrary.js`, FigurenotesView, FigurenotesBlockIcon).
- **Pedagogical** logic (`PedagogicalLogic.js`) and **JO clef** (can be re‑hooked to the new clef/note system later).
- **Data and input engines** (NotationContext, layout engine, toolbox options): same data; only the **drawing** of traditional symbols changes.
- **Rest of app** (routing, auth, piano, etc.).

---

## 3. Source of truth: “samples of MuseScore”

The new code must be derived from MuseScore, not from the current Noodimeister logic. Concretely:

1. **MuseScore as reference**
   - Use MuseScore’s **default style** (or their SMuFL engraving defaults) for:
     - Staff line thickness, stem thickness, beam thickness, beam spacing
     - Notehead scale, stem length, flag shape and placement
     - Rest placement and scale
     - Clef alignment (G line for treble, F line for bass)
   - Optionally clone the **MuseScore repository** and take constants from their style/layout code (e.g. `defaultstyle.cpp` or equivalent) so numbers are exact.

2. **What to rebuild**
   - A **new** traditional symbol layer that:
     - Uses **one** set of MuseScore-based constants (no mix of old EngravingDefaults and ad‑hoc values).
     - Draws noteheads, stems, flags, rests, clefs, and beams **only** from those constants and from SMuFL glyph IDs (no legacy layout math).
   - Same **public API** where possible (e.g. `<NoteSymbol type="quarter" … />`, `<RestSymbol type="quarter" … />`) so `TraditionalNotationView` and the rest of the app need minimal change.

3. **What to delete**
   - All **current** traditional symbol implementation in the files listed above: remove every function/component that computes or draws stems, flags, beams, rest position, clef position, and the current constants. Replace with the new MuseScore-based implementation.

---

## 4. Files to remove or fully replace (traditional symbols)

| File | Action |
|------|--------|
| `src/notation/NoteSymbols.jsx` | **Replace entirely** – new implementation from MuseScore (noteheads, stems, flags). |
| `src/notation/RestSymbols.jsx` | **Replace entirely** – new implementation from MuseScore (rest scale and vertical position). |
| `src/components/ClefSymbols.jsx` | **Replace** TrebleClefSymbol, BassClefSymbol, StaffTrebleClef, StaffBassClef, and C-clef usage; **keep** JoClefSymbol and JO-related API for pedagogical. |
| `src/notation/BeamCalculation.js` | **Replace entirely** – beam grouping and geometry from MuseScore rules. |
| `src/notation/StaffConstants.js` | **Replace** all layout constants with MuseScore-based values (stem length, notehead size, staff line thickness, etc.). |
| `src/notation/EngravingDefaults.js` | **Remove** or **replace** – single source of truth becomes “MuseScore defaults” (one module). |

**Keep but only reference:**

- `src/notation/smufl/glyphs.js` – keep SMuFL **codepoints** (notehead, rest, clef IDs); no layout logic.
- `src/notation/smufl/SmuflGlyph.jsx` – keep as the **renderer** for one glyph at a time; sizing and position come from the new constants.

**Update after new symbols exist:**

- `src/views/TraditionalNotationView.jsx` – use only the new NoteSymbol, RestSymbol, clefs, and beam API (no old constants or drawing).
- `src/pages/SymbolGalleryPage.jsx` – use only the new traditional symbols.
- Any other file that imports the above (toolboxes, orchestrator, etc.) so they use the new API.

---

## 5. Phased plan (recommended)

**Phase 1 – MuseScore constants and one source of truth**

- Add a single module, e.g. `src/notation/musescoreStyle.js` (or `musescoreDefaults.js`), that holds **all** layout numbers taken from MuseScore (staff line thickness, stem thickness, stem length, beam thickness, beam spacing, notehead scale, rest scale, clef scale, etc.). No other file should define traditional layout constants.
- Optionally: document where each value comes from (e.g. “MuseScore default style”, or “MuseScore repo file X”).

**Phase 2 – New traditional symbols**

- Implement new **NoteSymbols** (notehead + stem + flags) using only `musescoreStyle` and SMuFL glyphs.
- Implement new **RestSymbols** (rest glyph + vertical position) using only `musescoreStyle` and SMuFL.
- Implement new **ClefSymbols** (treble, bass, C-clef) using only `musescoreStyle` and SMuFL; keep JO clef as-is.

**Phase 3 – Beams and staff**

- Implement new **BeamCalculation** (grouping and geometry) from MuseScore rules and `musescoreStyle`.
- **StaffConstants** (or equivalent) only re-exports or uses `musescoreStyle`; no legacy constants.

**Phase 4 – Remove old code and wire views**

- Remove all **old** implementations from `NoteSymbols.jsx`, `RestSymbols.jsx`, `ClefSymbols.jsx`, `BeamCalculation.js`, `StaffConstants.js`, `EngravingDefaults.js`.
- Ensure `TraditionalNotationView`, gallery, and toolboxes use only the new symbol layer.
- Run the app and the symbol gallery; fix any remaining references.

**Phase 5 – Figurenotes and pedagogical (no redesign)**

- Ensure Figurenotes and pedagogical mode still work; reconnect JO clef and any shared layout if needed. No redesign of Figurenotes symbols in this plan.

---

## 6. What I need from you to start

1. **MuseScore source (optional but best)**  
   If you can clone the MuseScore repo and point me to the file(s) that contain their **default style** (e.g. default line thicknesses, stem length, notehead size), I will base the new constants exactly on those. If not, I’ll use the **SMuFL engraving defaults** and common MuseScore-style values from public docs.

2. **Confirmation to proceed**  
   Reply with something like: **“Proceed with the traditional symbol rebuild”** (or “Start Phase 1”). I will then:
   - Create the MuseScore-based constants module (Phase 1),
   - Then implement the new NoteSymbols, RestSymbols, Clefs, and BeamCalculation (Phases 2–3),
   - Then remove the old symbol code and wire the views (Phase 4).

3. **Figurenotes**  
   Confirm that Figurenotes symbol design and code should **not** be deleted and should stay as-is (only traditional is rebuilt from MuseScore).

---

## 7. Short summary

- **Delete:** Current traditional symbol design and layout logic (notes, rests, clefs, beams, StaffConstants, EngravingDefaults).
- **Rebuild:** New traditional symbol layer from scratch, using **only** MuseScore (or SMuFL + MuseScore-style) as the reference.
- **Keep:** Data engine, layout engine, Figurenotes, pedagogical logic, JO clef; only the **drawing** of traditional symbols is replaced.

Once you confirm, we can start with Phase 1 (MuseScore constants and a single source of truth), then Phase 2–4 (new symbols, remove old code, wire views).
