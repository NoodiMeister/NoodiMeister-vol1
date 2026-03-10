# Symbol previews – view the design (not code)

To **see** the symbol designs as images in Cursor or any viewer:

---

## View in Cursor (images, not code)

1. Open the **PNG files** in this folder:
   - `clef-jo.png` (JO clef)
   - `clef-treble.png`, `clef-bass.png`, `clef-c.png`, `note-whole.png`, `rest-whole.png`, `rest-quarter.png`

2. In Cursor: **File → Open** (or drag) any of these `.png` files.  
   Cursor will show the **image**, not code.

3. Or open **`index.html`** in a **browser** (Chrome, Firefox, etc.): it only shows images in a grid, no HTML source.  
   From terminal: `npx serve docs/symbol-previews` then open `http://localhost:3000` (or the port shown).

---

## Regenerate PNGs

From the project root:

```bash
npm run export-symbols
```

- **Figurenotes**, **JO clef**, **octave**: Sharp (no font).
- **Traditional** clefs/notes/rests: Puppeteer (headless Chrome) so Leland is applied. Install with `npm install puppeteer --save-dev`; if Puppeteer or Chrome isn't available, those PNGs will show wrong/missing glyphs.

---

## Note

- **Figurenotes** letter PNGs (`figurenotes-A.png` … `figurenotes-G.png`) are regenerated as needed; `figurenotes-table.html` expects them in this folder.
- **Figurenotes** and **JO clef** PNGs match the app (path-based).
- **Traditional** clefs/notes/rests use SMuFL (Leland font). The generated PNGs may show simple glyphs or placeholders if the font isn’t available to the export script. For pixel-perfect traditional symbols, open **`public/symbol-previews.html`** in a **browser** (so the Leland font loads) and use “Export each symbol as PNG” there.
