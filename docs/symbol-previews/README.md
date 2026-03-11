# Symbol previews – view the design (not code)

To **see** the symbol designs as images in Cursor or any viewer:

---

## View in Cursor (images, not code)

1. Open the **PNG files** in this folder:
   - `clef-bass.png`, `clef-c.png`, `figurenotes-C.png`, `octave-4-circle.png`, etc.

**Aldivõti (C-clef / alto clef):** The symbol design is in **`clef-c.png`**. Staff placement (clef center = middle C) is defined by **`c-clef-on-staff.png`** — use that image as the reference for how the C-clef sits on the staff.

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

- All symbols are rendered with **Sharp** from path-based SVGs (no Puppeteer/Chrome). Clefs use paths from `bassclefsymbol.svg` and `public/trebleclefsymbol.svg`; notes and rests use path fallbacks.

---

## Note

- **Figurenotes** letter PNGs (`figurenotes-A.png` … `figurenotes-G.png`) are regenerated as needed; `figurenotes-table.html` expects them in this folder.
- **Figurenotes** PNGs match the app (path-based).
- **Traditional** clefs in the app use Leland (SMuFL); clef preview PNGs here use path-based equivalents. Note/rest symbols are not exported as PNGs (the rhythm toolbox uses inline SVG in the app).
