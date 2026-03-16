# Taktimõõdu 4/4 võrdlus: rakendus vs kohalikud kujutised

## Rakenduses (Noodimeister)

- **Paigutus:** kõik väärtused tulevad failist `src/notation/TimeSignatureLayout.js` (`TIME_SIG_LAYOUT`).
- **Numbrid:** SMuFL taktimõõdu numbrid (Leland), komponent `TimeSigDigits` + `smuflTimeSigDigitsForNumber` – numbrid joonistatakse notatsioonifondi (SMuFL) glyph’idega, mitte tavatekstina.
- **Kasutus:** nii traditsiooniline vaade (`TraditionalNotationView`) kui figuurnotatsioon (`FigurenotesView`); figuurnotatsioonis skaleeritakse kõik `timeSignatureSize` / 16 järgi, et vahed jääksid proportsionaalsed.

## Kohalikud kujutised (docs/)

| Fail | Sisaldab | Märkus |
|------|----------|--------|
| `taktimoot-4-4.svg` | Klassikaline 4/4 (kaks numbrit 4, kriips) | Sama paigutus kui rakenduses; numbrid on tavatekst (sans-serif), et SVG oleks iseseisev – **rakenduses on SMuFL-numbrid**. |
| `taktimoot-4-4-pedagoogiline.svg` | Pedagoogiline 4/4 (number 4, kriips, veerandnoot) | Sama paigutus (noodipea, varras) kui rakenduses. |

**Ühine paigutus (mõlemal) = `TimeSignatureLayout.js`:**

- Lugeja: y = -8 (baseline)
- Kriips: y = -2, x = -10 … +10
- Nimetaja (klassikaline): y = 5
- Pedagoogiline noot: ellips (1, 2.5), rx=4, ry=2.5; varras (-3, 3)–(-3, 23)

Kui muudad rakendust (`src/notation/TimeSignatureLayout.js`), uuenda ka docs/ SVG-d ja `taktimoot-4-4-koordinaadid.md`.

Seega **kohalikud SVG-d on uuendatud variandid**, mis näitavad täpselt seda paigutust, mida rakendus kasutab; ainus erinevus on numbrite kujundus (SVG = tavatekst, rakendus = SMuFL).

**Kohalikud kujutised**
- **Täpselt nagu rakenduses (Leland SMuFL numbrid):**
  - [taktimoot-4-4-leland.svg](./taktimoot-4-4-leland.svg) – klassikaline 4/4
  - [taktimoot-4-4-pedagoogiline-leland.svg](./taktimoot-4-4-pedagoogiline-leland.svg) – pedagoogiline 4/4
  - [taktimoot-4-4-leland.html](./taktimoot-4-4-leland.html) – mõlemad ühes lehes (font laeb kindlamini)
- **Sama paigutus, tavatekst (ilma Leland-fondita):**
  - [taktimoot-4-4.svg](./taktimoot-4-4.svg) – klassikaline 4/4
  - [taktimoot-4-4-pedagoogiline.svg](./taktimoot-4-4-pedagoogiline.svg) – pedagoogiline 4/4
