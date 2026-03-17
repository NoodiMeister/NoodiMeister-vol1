# JO-clef (Estonian music pedagogical method)

The **JO-clef** (JO-võti) is used in the Estonian pedagogical notation system (Pedagoogiline notatsioon). The clef marks the position of **JO** (relatiivne toonika, I aste) on the staff. In traditional notation the name Do is fixed; the movable note name is JO.

## Official shape (4 black stripes)

- **2 vertical stripes** with a gap between them equal to **the space between staff lines**.
- **2 horizontal stripes** in the **middle of the 2nd (right) vertical stripe**, with the same **space between them** as between staff lines. The JO notehead sits in that gap.
- All four elements are black stripes (no filled boxes).

## How to share your JO-clef understanding with the AI

So the implementation (shape, proportions, **color**) matches the method, you can:

1. **Reference image**  
   Add a photo or scan of the official JO-clef from a method book or handout (e.g. a reference image in this repo) and say: “Use this as the JO-clef reference.”

2. **Short written spec in this repo**  
   Edit this file (or add `JO-CLEF-SPEC.md`) and describe:
   - **Color:** e.g. “Black on white staff” / “White on dark staff” / “Same as note head color” / “Always black (#000)”.
   - **Shape:** any differences from the current symbol (left pillar, top box, window, bottom box).
   - **Source:** name of the method (e.g. La Stravaganza, Kodály-based material) or a link.

3. **Link to method or standard**  
   Paste a URL to the official description or a PDF page that defines the JO-clef.

4. **Inverted / opposite color**  
   The app can render the JO-clef in **opposite** color (e.g. white instead of black) for dark backgrounds or for comparison. If the “correct” version for your method is the inverted one, say so and we can make that the default where appropriate.

---

## Current implementation (summary)

- **Component:** `src/components/ClefSymbols.jsx` → `JoClefSymbol` — 4 black stripes (2 vertical, 2 horizontal in middle of 2nd vertical; gaps = staff space)
- **Standalone SVG:** `JoClefSymbol.svg` (black), `JoClefSymbol-inverted.svg` (white)
- **Color:** Uses `fill` / `stroke`; default is `var(--note-fill, #000)` (theme: dark on light, white on dark).  
  An **inverted** variant uses the opposite (e.g. `#ffffff` on light) for comparison or dark-mode-only use.

If you describe or add a reference for the “correct” JO-clef (including color), the code can be updated to match.
