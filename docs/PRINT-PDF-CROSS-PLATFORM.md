# Print/PDF Cross-Platform Notes

## Current single-source pipeline

Noodimeister now uses one shared page model for:

- on-screen page geometry
- PDF preview
- vector PDF export
- print preview SVG pages

Main files:

- `src/utils/pageGeometry.js`
  Shared paper-size helpers for A3/A4/A5, portrait/landscape, and px/mm/pt conversions.
- `src/utils/scoreToSvg.js`
  Builds one paged SVG snapshot model used by preview, print, and vector PDF export.
- `src/utils/fontReady.js`
  Waits for browser fonts before capture/export and exposes a small font availability report.
- `src/noodimeister-complete.jsx`
  Orchestrates preview capture, print preparation, vector PDF generation, and raster fallback.
- `src/layout/LayoutManager.js`
  Keeps screen layout page width/height in sync with the same paper geometry helpers.

## Data flow

1. User chooses paper size and orientation.
2. `pageGeometry.js` derives shared page dimensions.
3. Screen layout uses the same dimensions for page width/height ratio.
4. `scoreToSvg()` serializes the score into a page-model snapshot.
5. The snapshot feeds:
   - PDF preview
   - browser print SVG pages
   - vector PDF export via `jsPDF` + `svg2pdf.js`
6. If SVG export fails, raster export falls back to `html2canvas`.

## Important invariants

- Print and PDF must honor the same paper size.
- Preview and exported PDF must use the same page count.
- Page backgrounds and footer overlays must render per page, not stretch over the whole document.
- Font loading must settle before preview/export starts.
- Horizontal page flow still exports/prints with landscape-oriented page geometry.

## Known environment risks

- If the notation fonts referenced in `public/fonts/` are missing in deployment, browser fallback fonts can still change glyph metrics.
- Safari and Firefox can differ from Chromium in `window.print()`, `@page`, and embedded-PDF print behavior.
- Raster fallback is less deterministic than the shared SVG path and should stay a backup path only.

## Manual verification matrix

Check these combinations after export-related changes:

- macOS Chrome
- macOS Safari
- macOS Firefox
- Windows Chrome
- Windows Edge
- Windows Firefox

For each browser, verify:

- A4 portrait
- A4 landscape
- A3 or A5 non-default paper size
- multi-page pedagogical sheet
- print preview page breaks match exported PDF
- title, author, footer, and page background are not clipped
- notation glyphs render with the intended fonts
