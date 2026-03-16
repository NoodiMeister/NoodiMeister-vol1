# Taktimõõt 4/4 – koordinaadid ja vahed (gap)

**Ühine allikas koodis:** `src/notation/TimeSignatureLayout.js` – konstantid `TIME_SIG_LAYOUT`. Kõik taktimõõdu joonistused (TraditionalNotationView, FigurenotesView, tööriistakasti ikoonid) kasutavad neid; figuurnotatsioonis korrutatakse väärtused `scale`-iga, et vahed suureneksid proportsionaalselt (px suurenemisega ei muutu suhted).

Kõik y-koordinaadid on antud grupi **lokaalses** süsteemis (`<g transform="translate(30, 25)">`), st päritolu on taktimõõdu keskpunkt (x=30, y=25 canvasil).

---

## 1. Klassikaline 4/4 (kaks numbrit 4)

| Element | Koordinaadid | Selgitus |
|--------|---------------|----------|
| **Lugeja "4"** | `x=0`, `y=-8` | Teksti baseline (numbri põhjajoone y). `text-anchor="middle"` → number on tsentreeritud. |
| **Kriips** | `x1=-10`, `y1=-2`, `x2=10`, `y2=-2` | Horisontaalne joon, pikkus 20, keskel y=-2 (Leland-numbri alla). `stroke-width="1.5"`. |
| **Nimetaja "4"** | `x=0`, `y=5` | Teksti baseline. |

### Vahed (gap) – klassikaline

- **Lugeja "4" → kriips:**  
  - Numbri 4 baseline on y=-8. Kriips on y=-2.  
  - **Vahe (baseline → kriips):** `-2 - (-8) = 6` (kriips ei läbi Leland-numbrit).

- **Kriips → nimetaja "4":**  
  - Kriips y=-2. Nimetaja baseline y=5.  
  - **Vahe (kriips → baseline):** `5 - (-2) = 7`.

---

## 2. Pedagoogiline 4/4 (number 4 + kriips + veerandnoot)

| Element | Koordinaadid | Selgitus |
|--------|---------------|----------|
| **Lugeja "4"** | `x=0`, `y=-8` | Sama mis klassikalises. |
| **Kriips** | `x1=-10`, `y1=-2`, `x2=10`, `y2=-2` | Sama joon. |
| **Veerandnoot (pea)** | `cx=1`, `cy=2.5`, `rx=4`, `ry=2.5` | Ellipsi keskpunkt (1, 2.5), laius 8, kõrgus 5. |
| **Veerandnoot (varras)** | `x1=-3`, `y1=3`, `x2=-3`, `y2=23` | Vertikaalne joon, pikkus 20. |

### Veerandnoot – ääred

- Ellips: ülaääre y = `2.5 - 2.5 = 0`, alaääre y = `2.5 + 2.5 = 5`.
- Varre ülemine ots: y=3 (noodipea sisse), alumine: y=23.

### Vahed (gap) – pedagoogiline

- **Lugeja "4" → kriips:** `-2 - (-8) = 6`.
- **Kriips → veerandnoot (ellipsi ülaäär):** `0 - (-2) = 2`.
- **Kriips → veerandnoot (ellipsi kesk):** `2.5 - (-2) = 4.5`.

---

## 3. Kokkuvõte – arvud üheks viitamiseks

| Suurus | Väärtus |
|--------|--------|
| Lugeja "4" y (baseline) | -8 |
| Kriips y | -2 |
| **Gap: lugeja baseline → kriips** | **6** |
| Nimetaja "4" y (baseline) | 5 |
| **Gap: kriips → nimetaja baseline** | **7** |
| Kriips pikkus (x) | 20 (x -10 … +10) |
| Veerandnoot ellips kesk (cx, cy) | 1, 2.5 |
| Veerandnoot ellips ülaäär y | 0 |
| **Gap: kriips → noodipea ülaäär** | **2** |
| Veerandnoot varre pikkus | 20 (y 3 … 23) |
| Veerandnoot varras x | -3 |
| Ellips rx, ry | 4, 2.5 |

Need arvud vastavad praegustele SVG-dele; kui muudad `font-size` või skaleerimist, tuleb vastavad vahed ümber arvutada (või skaleerida proportsionaalselt).
