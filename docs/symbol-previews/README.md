# Symbol previews – view the design (not code)

To **see** the symbol designs as images in Cursor or any viewer:

---

## View in Cursor (images, not code)

1. Open the **PNG files** in this folder:
   - `clef-bass.png`, `clef-c.png`, `note-whole.png`, `rest-whole.png`, `rest-quarter.png`, etc.

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
- **Traditional** clefs/notes/rests in the app use Leland (SMuFL); the preview PNGs here use path-based equivalents so export never depends on a browser or font.
