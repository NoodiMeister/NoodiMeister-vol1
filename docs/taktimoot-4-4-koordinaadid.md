# Taktimõõt 4/4 – koordinaadid ja vahed (gap)

**Ühine allikas koodis:** `src/notation/TimeSignatureLayout.js` – konstantid `TIME_SIG_LAYOUT`. Kõik taktimõõdu joonistused (TraditionalNotationView, FigurenotesView, tööriistakasti ikoonid) kasutavad neid; figuurnotatsioonis korrutatakse väärtused `scale`-iga, et vahed suureneksid proportsionaalselt (px suurenemisega ei muutu suhted).

Kõik y-koordinaadid on antud grupi **lokaalses** süsteemis (`<g transform="translate(30, 25)">`), st päritolu on taktimõõdu keskpunkt (x=30, y=25 canvasil).

---

## 1. Klassikaline 4/4 (kaks numbrit 4)

| Element | Koordinaadid | Selgitus |
|--------|---------------|----------|
| **Lugeja "4"** | `x=0`, `y=-8` | Teksti baseline (numbri põhjajoone y). `text-anchor="middle"` → number on tsentreeritud. |
| **Kriips** | `x1=-10`, `y1=-5`, `x2=10`, `y2=-5` | Horisontaalne joon, pikkus 20, keskel y=-5. `stroke-width="1.5"`. |
| **Nimetaja "4"** | `x=0`, `y=11` | Teksti baseline. |

### Vahed (gap) – klassikaline

- **Lugeja "4" → kriips:**  
  - Numbri 4 baseline on y=-8. Kriips on y=-5.  
  - **Vahe (baseline → kriips):** `-5 - (-8) = 3`.

- **Kriips → nimetaja "4":**  
  - Kriips y=-5. Nimetaja baseline y=11.  
  - **Vahe (kriips → baseline):** `11 - (-5) = 16`.

---

## 2. Pedagoogiline 4/4 (number 4 + kriips + veerandnoot)

| Element | Koordinaadid | Selgitus |
|--------|---------------|----------|
| **Lugeja "4"** | `x=0`, `y=-8` | Sama mis klassikalises. |
| **Kriips** | `x1=-10`, `y1=-5`, `x2=10`, `y2=-5` | Sama joon. |
| **Veerandnoot (pea)** | `cx=1`, `cy=0.5`, `rx=4`, `ry=2.5` | Ellipsi keskpunkt (1, 0.5), laius 8, kõrgus 5. |
| **Veerandnoot (varras)** | `x1=-3`, `y1=1`, `x2=-3`, `y2=21` | Vertikaalne joon, pikkus 20. |

### Veerandnoot – ääred

- Ellips: ülaääre y = `0.5 - 2.5 = -2`, alaääre y = `0.5 + 2.5 = 3`.
- Varre ülemine ots: y=1 (noodipea sisse), alumine: y=21.

### Vahed (gap) – pedagoogiline

- **Lugeja "4" → kriips:** `-5 - (-8) = 3`.
- **Kriips → veerandnoot (ellipsi ülaäär):** `-2 - (-5) = 3`.
- **Kriips → veerandnoot (ellipsi kesk):** `0.5 - (-5) = 5.5`.

---

## 3. Kokkuvõte – arvud üheks viitamiseks

| Suurus | Väärtus |
|--------|--------|
| Lugeja "4" y (baseline) | -8 |
| Kriips y | -5 |
| **Gap: lugeja baseline → kriips** | **3** |
| Nimetaja "4" y (baseline) | 11 |
| **Gap: kriips → nimetaja baseline** | **16** |
| Kriips pikkus (x) | 20 (x -10 … +10) |
| Veerandnoot ellips kesk (cx, cy) | 1, 0.5 |
| Veerandnoot ellips ülaäär y | -2 |
| **Gap: kriips → noodipea ülaäär** | **3** |
| Veerandnoot varre pikkus | 20 (y 1 … 21) |
| Veerandnoot varras x | -3 |
| Ellips rx, ry | 4, 2.5 |

Need arvud vastavad praegustele SVG-dele; kui muudad `font-size` või skaleerimist, tuleb vastavad vahed ümber arvutada (või skaleerida proportsionaalselt).
