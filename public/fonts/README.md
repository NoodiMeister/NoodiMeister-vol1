# Music fonts (SMuFL)

This folder holds the music notation fonts used by the app.

## Leland

- **Leland** is the primary SMuFL font for traditional notation (clefs, noteheads, rests).
- The app loads Leland from **Leland.otf** if present, otherwise **Leland.woff2**.

### Adding Leland.otf

1. Obtain **Leland.otf** (e.g. from Steinberg Dorico installation or a licensed copy).
2. Copy the file into this folder:
   ```
   public/fonts/Leland.otf
   ```
3. The app will use it automatically; no code changes needed.

### Leland.woff2

- A `.woff2` version may already be present for web use (smaller size, good browser support).
- If you add **Leland.otf**, the app prefers it; **Leland.woff2** is used as fallback when `.otf` is not available.

### Licensing

- Leland is a commercial font (Steinberg). Use and distribution must comply with its license.

## Leland Text

- **LelandText** is the text companion font (lyrics, chord symbols, expression text, etc.).
- The app loads it from **LelandText.otf** if present, otherwise **LelandText.woff2**.

### Adding LelandText.otf

1. Obtain **LelandText.otf** (e.g. from Steinberg Dorico or a licensed copy).
2. Copy the file into this folder:
   ```
   public/fonts/LelandText.otf
   ```
3. The app will use it automatically.

### LelandText.woff2

- A `.woff2` version can be used as fallback when `.otf` is not available.

### Licensing

- Same as Leland (Steinberg); use must comply with its license.

---

## TinWhistleTab

- **TinWhistleTab** is used for tin whistle fingering view: note names (a, b, c, d, e, f, g, c#) below each note.
- Place the font file in this folder:
  ```
  public/fonts/TinWhistleTab.ttf
  ```
- The app loads it via `@font-face` in `src/index.css`. When instrument is *Tin whistle* and view is *Fingering*, note names are rendered with this font.

---

## RecorderFont

- **RecorderFont** (RecorderFont-BYDx.ttf) is used for recorder finger tables when instrument is *Recorder* and view is *Fingering*.
- Place the font file in this folder:
  ```
  public/fonts/RecorderFont-BYDx.ttf
  ```
- The app loads it via `@font-face` in `src/index.css`. Fingering labels below each note use this font (note names C, D, E, F, G, A, B, plus C#, F#, etc. as applicable).

---

Traditional rhythm and clef designs use **Leland** (symbols) and **LelandText** (text); other music fonts have been removed from this app.
