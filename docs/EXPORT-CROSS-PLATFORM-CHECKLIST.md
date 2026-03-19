# Export Cross-Platform Checklist

Use this checklist after preview/PDF/print changes.

## Target browsers

- macOS Chrome
- Windows Chrome
- Windows Edge

## Test file matrix

- Traditional notation, 2+ pages
- Figurenotes, chord blocks enabled
- Pedagogical notation with JO clef
- Score with text boxes

## Verify in each browser

- Preview page count matches exported PDF page count.
- Print preview page breaks match PDF page breaks.
- Clefs, noteheads, rests, and time signatures keep the same positions.
- Title, author, footer, and text boxes do not reflow between macOS and Windows.
- No random letters/diacritics appear in music glyphs.
- No clipping on page edges.
- Background design opacity and page coverage match between preview and PDF.

## Quick regression command

Run:

```bash
node scripts/check-export-determinism.mjs
```

Then run:

```bash
npm run build
```
