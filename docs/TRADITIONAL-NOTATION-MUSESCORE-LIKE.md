# Traditional notation: making it look and function like MuseScore

**Goal:** Improve traditional notation design and behaviour so it matches MuseScore quality, **without** needing to copy or run MuseScore’s codebase.

---

## Do you need to copy the MuseScore GitHub repo?

**Short answer: No.** You can get very close with:

1. **SMuFL engraving defaults** (public spec) — one source of truth for line thicknesses, beam thickness, stem thickness, etc.
2. **Your existing Leland font** — SMuFL-compliant; MuseScore uses its own font but the *layout rules* are what matter.
3. **Targeted changes** in your code (constants, rest alignment, beam slope, clef alignment).

**If you do clone MuseScore’s repo**, it’s useful for:

- **Extracting numbers**: e.g. default style (staff line thickness, stem length, notehead scale) from their style files.
- **Checking rules**: e.g. beam slope, rest vertical position, stem direction.
- **Not for**: Copying C++ code into your app. Their stack is C++/Qt; yours is React/JS. We translate **constants and rules** into your `StaffConstants.js`, `NoteSymbols.jsx`, `BeamCalculation.js`, etc.

So: **clone only if you want to match MuseScore’s exact numeric choices.** Otherwise, use the checklist below and SMuFL defaults.

---

## SMuFL engraving defaults (use these)

The [SMuFL engraving defaults](https://w3c.github.io/smufl/latest/specification/engravingdefaults.html) define recommended values in **staff spaces**:

| Key | SMuFL example | Your current | Action |
|-----|----------------|--------------|--------|
| `staffLineThickness` | 0.1 | (not in StaffConstants) | Add staff line thickness = `staffSpace * 0.1` where you draw staff lines |
| `stemThickness` | 0.1 | `staffSpace * 0.12` | Change to `staffSpace * 0.1` in NoteSymbols.jsx (Stem, Flags) |
| `beamThickness` | 0.5 | `staffSpace * 0.5` ✓ | Keep |
| `beamSpacing` | 0.25 | `staffSpace * 0.4` (gap) | Consider reducing to 0.25 for spacing between beams |
| `legerLineThickness` | 0.2 | (implicit in stroke) | Use `staffSpace * 0.2` for ledger lines |
| `legerLineExtension` | 0.2 | ledger half-width 1.4 | SMuFL is notehead-relative; keep or tune to match Leland |

Use these in **one place** (e.g. `StaffConstants.js` or a small `EngravingDefaults.js`) so all traditional symbols and layout use the same values.

---

## Improvement checklist (design + function)

Apply these in your **Traditional** method only (see PROGRAM-SPEC-METHODS-VS-ENGINES.md).

### 1. Single source for layout constants

- **Add** a small module (e.g. `src/notation/EngravingDefaults.js`) that exports SMuFL-based values in staff spaces: stem thickness, beam thickness, beam spacing, staff line thickness, ledger thickness.
- **Use** that module in `StaffConstants.js`, `NoteSymbols.jsx`, `RestSymbols.jsx`, `BeamCalculation.js`, and anywhere you draw staff lines or ledger lines.
- **Result:** One set of numbers for “MuseScore-like” engraving; easy to tweak later.

### 2. Notehead and clef scaling

- **Rule:** SMuFL glyphs are designed so that **1 em = 4 staff spaces** (the standard staff height). So `fontSize = staffSpace * 4` for noteheads and clefs is correct; keep it.
- **Rests:** You use `staffSpace * 4.5`. If Leland rests look too big or small, try `staffSpace * 4` for consistency with noteheads, or check Leland’s metadata if available.
- **Result:** Noteheads, clefs, and rests scale together and match staff size.

### 3. Stem and flag design

- **Stem thickness:** Use SMuFL `stemThickness` 0.1 (you have 0.12) in `NoteSymbols.jsx` (Stem and Flags).
- **Stem attachment:** MuseScore: stem **right** of notehead when stem up, **left** when stem down; attach at notehead edge. Your code already follows this; ensure the x-offset uses `getNoteheadRx(staffSpace)` and half stroke width so the join is clean.
- **Flags:** Your Flags use a Bézier curve. MuseScore uses an “S” shape. If you have the MuseScore repo, you could compare their flag control points and adjust your path; otherwise keep your current curve and only tune thickness to 0.1 sp.

### 4. Beams

- **Thickness:** Keep `staffSpace * 0.5` (SMuFL).
- **Spacing:** Use SMuFL `beamSpacing` 0.25 for the gap between primary and secondary beams (you have 0.4; reducing will look closer to MuseScore).
- **Slope:** MuseScore allows a slight slope so the beam connects the first and last stem tips. Your `computeBeamGeometry` already does this. Ensure the beam is drawn as a **filled rectangle** (or rounded rect) with correct thickness and no gap between stem and beam.
- **Result:** Beams look like MuseScore: correct thickness, spacing, and slope.

### 5. Rest vertical alignment

- **Rule:** Whole rest: centered in **middle** of staff (between 2nd and 3rd line in 5-line staff). Half rest: sits on **3rd line**. Quarter and shorter: standard positions (e.g. quarter rest hangs from 4th line, eighth has dot in middle space, etc.). SMuFL rest glyphs are designed with anchors; Leland should follow that.
- **Your code:** You pass `x, y` and `staffSpace` to rest symbols. Ensure the **y** passed to each rest is the correct vertical anchor (e.g. staff middle for whole, 3rd line for half). If your Traditional view computes rest y from a single “slot” or line index, align that with SMuFL rest positions.
- **Result:** Rests sit on the right lines and don’t float.

### 6. Clef alignment

- **Treble:** The **G** line (second from top) should pass through the spiral’s center. You have `spiralAlignDy = staffSpace * 0.35`. If the clef is still off, tune this so that when `y` is the G-line y, the glyph baseline/center matches.
- **Bass:** The **F** line (second from bottom) should align with the two dots. Same idea: `y` = F-line y, and the glyph should be vertically centered on that.
- **Result:** Clefs “lock” to the correct staff lines like in MuseScore.

### 7. Staff lines

- **Thickness:** Draw staff lines with `staffSpace * 0.1` (SMuFL `staffLineThickness`).
- **Result:** Consistent, professional staff appearance.

### 8. Ledger lines

- **Thickness:** `staffSpace * 0.2` (SMuFL `legerLineThickness`).
- **Length:** You have `getLedgerHalfWidth`; keep or adjust so ledger lines extend slightly past the notehead (SMuFL `legerLineExtension` 0.2 is notehead-relative).
- **Result:** Ledger lines match SMuFL and MuseScore style.

---

## If you clone MuseScore’s repo: what to look at

- **Style / layout constants:** e.g. `engraving/style/defaultstyle.cpp` or similar (path may vary by version). Look for: staff line thickness, stem thickness, beam thickness, beam spacing, notehead scale, stem length.
- **Beam slope:** How they compute beam start/end y from first and last note (you already have slope; you can compare numbers).
- **Rest y positions:** How they place whole, half, quarter, eighth rests vertically (which line or space).
- **Flag shape:** If they expose Bézier or shape data for flags, you can mirror that in your Flags component.

You **don’t** need to run or build MuseScore. Just open those files and read the constants and formulas, then apply the same values or rules in your JS/React code.

---

## Summary

- **No need to copy the full MuseScore repo** to get MuseScore-like traditional notation. Use SMuFL engraving defaults + the checklist above.
- **If you do clone the repo:** use it to **extract constants and rules** and translate them into your codebase; don’t copy C++ into your app.
- **Concrete steps:** (1) Add EngravingDefaults / use SMuFL values in one place, (2) stem 0.1 sp, (3) beam spacing 0.25 sp, (4) staff line 0.1 sp, (5) ledger 0.2 sp, (6) align rests and clefs to the correct lines. That will get your traditional notation very close to MuseScore in both look and behaviour.
