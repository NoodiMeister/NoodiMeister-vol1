# Figurenotes / Figuurnotatsioon – line spacing logic

## Spacing rule (same between every line)

In Figurenotes view, the score is a **grid of measure boxes**: each **line** (row) contains one or more measures (e.g. 4 boxes per row). The rule is:

- **Same spacing between every line:** the vertical distance from the **start of one row** to the **start of the next row** is always the same value (in px). So:
  - Line 0 at `yOffset = 0`
  - Line 1 at `yOffset = rowHeight + gap`
  - Line 2 at `yOffset = 2 * (rowHeight + gap)`
  - …

So **one** user-facing value controls the **gap between two lines**: that gap is applied **between every pair of consecutive lines**.

## How it is implemented

1. **LayoutEngine (figure mode)**  
   `calculateLayout('figure', orientation, data)` → `calculateFigureGrid(data, availableWidth, availablePageHeight)`:
   - Reads `data.staffSpacing` (px): **step from one row start to the next** (row height + gap).
   - For each system (row): `yOffset = systemIndex * staffSpacing`.
   - So the **rule is implemented between every line**: the same `staffSpacing` is used for all rows.

2. **Row height vs gap**  
   - **Row height** = height of one Figurenotes row (measure boxes + padding). Fixed per view (e.g. `FIGURE_ROW_HEIGHT`).
   - **Gap** = empty space between the bottom of one row and the top of the next.
   - **staffSpacing** = row height + gap (so step = same between every line).

3. **User control**  
   - In the app, **Layout → system gap (px)** sets the **gap** between lines. The slider allows **5** (smallest) up to 250.
   - The layout uses `staffSpacing = FIGURE_ROW_HEIGHT + layoutSystemGap` so the same gap is applied between every line and rows do not overlap.

4. **A4 page breaks**  
   - If a line does not fit on the current A4 page, the **whole line** is moved to the next page (no row is split across pages). Page height comes from the app’s A4 parameters (`pageWidth * A4_HEIGHT_RATIO`).

## Why spacing can look “too big”

- If the app used the **traditional** layout for Figurenotes (one layout for both staff and figure), the step between systems was `staffHeight + systemGap` (e.g. 140 + 120 = 260 px). The **row** height was still the full staff height (140), so the **gap** was 120 px, which can feel large.
- Using **figure layout** with a dedicated **figure row height** (e.g. 80 px) and **user-controlled gap** (e.g. 20–80 px) gives:
  - Step = 80 + gap → smaller total step and smaller gap.
  - The same rule (step = row height + gap) is applied **between every line**.

## Summary

| Concept            | Meaning                                      | Applied |
|--------------------|----------------------------------------------|---------|
| **Line**           | One row of measure boxes                     | —       |
| **Gap**             | Vertical space between two consecutive lines| Same between every line |
| **staffSpacing**   | Step = row height + gap (px)                 | Same for all rows (`yOffset = index * staffSpacing`) |
| **User setting**   | Gap (or step) in Layout                      | Drives `staffSpacing` so the rule holds everywhere |
