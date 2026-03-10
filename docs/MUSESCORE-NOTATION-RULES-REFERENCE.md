# MuseScore notation rules reference

Where to find the rules for **clef placement on the staff** and **rhythm symbols vs. time signature** when implementing traditional notation (e.g. from MuseScore’s fonts and layout). Your project already uses `musescoreStyle.js` and SMuFL/Leland; this doc points to the official sources and summarizes the main rules.

---

## 1. Where the rules live

### MuseScore GitHub (layout and style numbers)

- **Fonts (SMuFL metadata):**  
  [github.com/musescore/MuseScore/tree/master/fonts](https://github.com/musescore/MuseScore/tree/master/fonts)  
  - `fonts/leland/leland_metadata.json` – Leland engraving defaults and glyph bounding boxes (bBox).  
  - Bravura, Petaluma, etc. are in subfolders; **do not edit** (see fonts README).

- **Engraving style defaults (the numbers):**  
  [src/engraving/style/](https://github.com/musescore/MuseScore/tree/master/src/engraving/style)  
  - **`styledef.cpp`** – single source of default values in staff spaces (`_sp`), e.g.:
    - `stemWidth` = 0.10 sp  
    - `stemLength` = 3.5  
    - `shortestStem` = 2.5  
    - `staffLineWidth` = 0.11 sp  
    - `ledgerLineWidth` = 0.16 sp  
    - `ledgerLineLength` = 0.33 sp (notehead-relative)  
    - `beamWidth` = 0.5 sp  
    - `clefLeftMargin`, `clefBarlineDistance`, `clefKeyRightMargin`, `clefTimesigDistance`, etc.  
  - **`defaultstyle.cpp`** – loads versioned `.mss` style files; the numeric defaults are defined in `styledef.cpp` (and in the embedded legacy `.mss` resources).

- **Symbol names (SMuFL ↔ MuseScore):**  
  `src/engraving/types/symnames.cpp` – mapping from internal symbol IDs to SMuFL glyph names (clefs, rests, noteheads, flags, etc.).

- **Clef layout / positioning:**  
  Clef vertical position is determined by which **staff line** the clef is “on”. MuseScore uses standard conventions (see below); exact pixel placement uses the font’s bBox and, when available, **glyphsWithAnchors** from the font metadata.  
  - PR [#7316](https://github.com/musescore/MuseScore/pull/7316) (MU4) refactored SMuFL symbol anchors (ledger lines, flag placement, etc.).  
  - Known issues: [Clef vertical displacement](https://github.com/musescore/MuseScore/issues/15697), [clef after staff offset](https://github.com/musescore/MuseScore/issues/26043).

### SMuFL (W3C) – font-agnostic layout rules

- **Engraving defaults (line thicknesses, stem, beams, ledger):**  
  [Engraving defaults](https://w3c.github.io/smufl/latest/specification/engravingdefaults.html)  
  Defines recommended values in **staff spaces** (e.g. `staffLineThickness` 0.1, `stemThickness` 0.1, `beamThickness` 0.5, `beamSpacing` 0.25, `legerLineThickness` 0.2, `legerLineExtension` 0.2). Your `musescoreStyle.js` already follows Leland’s metadata, which aligns with these.

- **Glyph anchors (stem attachment, clef numerals, notehead origin):**  
  [glyphsWithAnchors](https://w3c.github.io/smufl/latest/specification/glyphswithanchors.html)  
  - Noteheads: `stemUpSE`, `stemDownNW` (and optional `stemUpNW` / `stemDownSW` for flag overlap).  
  - Clefs: `numeralTop`, `numeralBottom` for clefs with ligatured numbers (e.g. 8va); standard G/F/C clefs are positioned by **staff line** (see below).  
  - Rests: no mandatory anchor; vertical position is by convention (which line/space).

- **Glyph classes (clefs, noteheads, rests, flags):**  
  [classes](https://w3c.github.io/smufl/latest/specification/classes.html)  
  Defines `clefs`, `clefsG`, `clefsF`, `clefsC`, `noteheads`, `rests`, `flags`, etc., for consistent handling.

---

## 2. How clefs from the font are placed on the staff

- **Unit:** SMuFL assumes **1 em = 4 staff spaces** (staff height). Clef glyphs are drawn at `fontSize = staffSpace * 4`. Origin is typically the left of the glyph; vertical alignment is done by placing the **reference staff line** through the correct point of the glyph.

- **Standard placement (5-line staff, line 1 = top):**
  - **G (treble) clef:** The **G line** (second line from top, line 2) passes through the **center of the spiral**. Position the glyph so that this line aligns with the spiral (often via a small `spiralAlignDy` or equivalent so the glyph’s visual center sits on that line).
  - **F (bass) clef:** The **F line** (second line from bottom, line 4) passes through the **two dots** (and the curl). Place the glyph so that line aligns with the dot line.
  - **C clef:** The **middle line** (line 3) is middle C. Center the C-clef glyph on that line.

- **Font metadata:**  
  Leland’s `leland_metadata.json` gives **bBox** (bounding box) for `gClef`, `fClef`, `cClef` (and variants). Use bBox to derive vertical offset so the correct staff line hits the right part of the glyph. If the font provides **glyphsWithAnchors** (e.g. Bravura), use those for precise stem/numeral alignment; for basic G/F/C placement, “which line” + bBox is enough.

- **Spacing (from MuseScore styledef.cpp):**  
  `clefLeftMargin` 0.75 sp, `clefBarlineDistance` 0.5 sp, `clefKeyRightMargin` 0.8 sp, `clefKeyDistance` 0.75 sp, `clefTimesigDistance` 1.0 sp. So: clef → key → time sig with these gaps.

---

## 3. How rhythm symbols interact with each other and the time signature

- **Stems:**  
  - **Length:** Default `stemLength` 3.5 sp; when shortened (e.g. beamed notes), not shorter than `shortestStem` 2.5 sp (MuseScore `styledef.cpp`).  
  - **Thickness:** 0.1 sp (SMuFL / Leland).  
  - **Attachment:** Stem **right** of notehead when stem up, **left** when stem down; use notehead anchors (`stemUpSE`, `stemDownNW`) from font metadata when available.

- **Beams:**  
  - **Thickness** 0.5 sp, **spacing** between beams 0.25 sp (SMuFL; Leland same).  
  - **Grouping:** Default beaming is **per time signature**. Each time signature has a default beam group (e.g. 4/4: group by quarter; 6/8: group by dotted quarter).  
  - MuseScore: Time signature properties → “Beam groups” control how notes are beamed within a measure. Your layout/beam logic should group e.g. eighth notes according to the same rules (e.g. 2+2 in 4/4, 3+3 in 6/8) unless overridden per note.  
  - **Slope:** Beam can slope so it connects first and last stem tips; MuseScore allows this; SMuFL doesn’t mandate a formula.

- **Rests:**  
  - **Vertical position by duration:**  
    - Whole rest: centered in **middle** of staff (between 2nd and 3rd line).  
    - Half rest: on **3rd line**.  
    - Quarter and shorter: conventional positions (e.g. quarter rest hangs from 4th line; eighth rest “dot” in middle space).  
  - **Dots:** `dotRestDistance` 0.25 sp (MuseScore).  
  - **Multi-measure rests:** Handled by style (e.g. `createMultiMeasureRests`, `minMMRestWidth`); separate from single-note rest placement.

- **Time signature:**  
  - Affects **default beaming** (how many eighths/sixteenths are grouped).  
  - Does **not** change clef placement or rest vertical positions; those are by clef type and rest duration.  
  - Spacing: `clefTimesigDistance` 1.0 sp between clef/key and time signature (MuseScore).

---

## 4. Quick reference: main numeric defaults (MuseScore styledef.cpp)

| Concept              | MuseScore default | SMuFL / Leland |
|----------------------|-------------------|----------------|
| Staff line width     | 0.11 sp           | 0.1 (Leland 0.11) |
| Stem width           | 0.10 sp           | 0.1            |
| Stem length          | 3.5 sp            | –              |
| Shortest stem        | 2.5 sp            | –              |
| Ledger line width    | 0.16 sp           | 0.2 (Leland 0.16) |
| Ledger length        | 0.33 sp (rel.)    | 0.2 (rel.)     |
| Beam width           | 0.5 sp            | 0.5            |
| Beam spacing         | –                 | 0.25           |
| Clef left margin     | 0.75 sp           | –              |
| Clef–barline         | 0.5 sp            | –              |
| Clef–time sig        | 1.0 sp            | –              |
| Dot–rest distance    | 0.25 sp           | –              |

Your `src/notation/musescoreStyle.js` already mirrors Leland/MuseScore-style values; the table above is for cross-checking with the MuseScore repo.

---

## 5. Summary

- **Clef placement:** Use the **staff line** rule (G line for treble, F line for bass, middle for C). Scale clef at 4 sp per em; use font bBox (and anchors if present) to align that line with the correct part of the glyph. Margins from MuseScore `styledef.cpp`.
- **Rhythm vs. time signature:** Time signature drives **default beam grouping**; stem length/thickness and rest positions are from style/SMuFL, not from the time signature. Beams follow SMuFL thickness/spacing and can slope to stem tips.
- **Sources:** MuseScore [fonts](https://github.com/musescore/MuseScore/tree/master/fonts) and [src/engraving/style/styledef.cpp](https://github.com/musescore/MuseScore/blob/master/src/engraving/style/styledef.cpp) for numbers; [SMuFL engraving defaults](https://w3c.github.io/smufl/latest/specification/engravingdefaults.html) and [glyphsWithAnchors](https://w3c.github.io/smufl/latest/specification/glyphswithanchors.html) for font-agnostic rules.
