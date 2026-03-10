# Notation rules and state

**Purpose:** One place that describes how notation is **produced** from state: what is rule-based vs defined per key, and how we avoid defining every key separately.

---

## Current situation

### 1. State (NotationContext)

Notation state is **many separate keys**: `keySignature`, `timeSignature`, `selectedRhythm`, `clefType`, `notationMode`, `notationStyle`, etc. There is no single “notation task” type; the **method** (Traditional / Figurenotes / Pedagogical) selects which view and symbols to use (see `PROGRAM-SPEC-METHODS-VS-ENGINES.md`), but there is no central “law” that says “given this state, produce this notation.” That logic is spread across:

- `StaffConstants.js` – staff position from (pitch, octave, clef)
- `transpose.js` – transposition from key → semitones
- `notationConstants.js` – key → semitones, JO defaults
- `PedagogicalLogic.js` – color/shape from degree relative to JO
- `joNames.js` – JO name from degree in key

So: **we do not have one explicit set of “notation production rules”;** we have a mix of formulas and per-key lookups.

### 2. What is rule-based today

- **Staff position (treble/bass):**  
  `position = (octave - K) * 7 + pitchIndex - offset` with fixed K and offset per clef. So (pitch, octave, clef) → Y is a **formula**, not a table.
- **JO-relative degree:**  
  Half steps from tonic → diatonic degree (0–6) → JO name and pedagogical color/shape. So once we have “half steps from tonic,” the rest is **fixed rules** (e.g. `diatonicMap`, `PEDAGOGICAL_COLORS`).
- **Which view/symbols:**  
  `notationStyle` + `notationMode` → single view (see PROGRAM-SPEC). One place, clear rules.

### 3. What is per-key lookup today

- **Key → semitones from C:**  
  `KEY_TO_SEMITONE` in `notationConstants.js` – every key (C, G, D, A, E, B, F, Bb, Eb) is listed by hand. Adding F#, Ab, etc. would require adding more entries.
- **Key → tonic staff position (JO):**  
  `TONIC_STAFF_POSITION` in `StaffConstants.js` – same: each key defined separately.

So today we **do** define every key separately for transposition and JO position.

---

## Do we have to define every key separately?

**No.** We can derive both from **rules**:

1. **Key → semitones from C**  
   A key is a **letter** (C, D, E, F, G, A, B) plus an optional **accidental** (sharp or flat).  
   - Letter → base semitone: C=0, D=2, E=4, F=5, G=7, A=9, B=11.  
   - Semitone(key) = (base + accidental) mod 12 (e.g. Bb = 11−1 = 10, F# = 5+1 = 6).  
   So we can support any key name (including F#, Ab, Gb, etc.) **without** listing them in a table.

2. **Key → tonic staff position**  
   Tonic staff position is “where does the tonic pitch lie on the treble staff?” That is already defined by the same rule we use for any note: `getStaffPositionTreble(tonicPitch, 4)`. So we need key → (pitch, octave); octave is 4 for the tonic; pitch is the key’s letter + accidental. So we can derive tonic staff position from the key name and the existing staff-position formula.

If we implement these two rules in one place (e.g. `notationConstants.js` and `StaffConstants.js`), then:

- We **do not** need to add a new table entry for every new key.
- The **laws** for “key → semitones” and “key → tonic position” are explicit and consistent.

---

## Suggested “notation production rules” (single place)

A single place (this doc or a short “NotationRules” comment block in code) can state:

| Task | Rule / law |
|------|------------|
| Staff Y from (pitch, octave, clef) | `getVerticalPosition(pitch, octave, clefType, options)` – treble/bass use fixed formula; JO uses tonic position + half steps from tonic. |
| Semitones from C for a key | Key = letter + optional ♯/♭; base = letter semitone (C=0…B=11); result = (base + accidental) mod 12. |
| Tonic staff position for key | Tonic = key’s pitch in octave 4; position = `getStaffPositionTreble(tonicPitch, 4)`. |
| Transpose by key change | `getTransposeSemitones(fromKey, toKey)` = semitones(toKey) − semitones(fromKey). |
| JO name / pedagogical color-shape | Half steps from tonic (from staff position or pitch+octave) → diatonic degree 0–6 → JO name and color/shape from fixed tables. |
| Which view/symbols | `notationStyle` + `notationMode` → ViewSwitcher → exactly one view (Traditional / Figurenotes); pedagogical = Traditional + JO clef + PedagogicalLogic. |

Then:

- **State** stays as many keys in NotationContext (that’s fine).
- **Key signatures** are no longer “every key defined separately” – they are produced by the key-name rules above.
- **Notation tasks** (where to draw a note, which accidental, which color) are all **produced** by these rules from the same state.

---

## File map (where the rules live)

| Rule | Where it lives / should live |
|------|------------------------------|
| Key → semitones | `notationConstants.js`: derive from key name (letter + accidental). |
| Key → tonic staff position | `StaffConstants.js`: derive from key name + `getStaffPositionTreble`. |
| Pitch+octave+clef → Y | `StaffConstants.js`: `getVerticalPosition`, `getVerticalPositionFromJoAnchor`. |
| Key change → transpose amount | `transpose.js`: `getTransposeSemitones(fromKey, toKey)`. |
| Degree → JO name, color, shape | `joNames.js`, `PedagogicalLogic.js` (fixed tables by degree). |
| Method → view and symbols | `ViewSwitcher.js`, `PROGRAM-SPEC-METHODS-VS-ENGINES.md`. |

Implementing the key-name rules in code (and optionally re-exporting a small “notation rules” API) gives you **one set of laws** for producing notation, without defining every key in every state or in every table.
