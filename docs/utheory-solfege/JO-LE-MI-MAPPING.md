# JO-LE-MI k\u00e4em\u00e4rkide mapping (uTheory Kod\u00e1ly/Curwen)

Selles projektis kasutame **JO-LE-MI-NA-SO-RA-DI** astmenimesid (movable tonic = JO).

uTheory pakett kasutab klassikalisi solfege nimesid (**do, re, mi, fa, sol, la, ti**).
Seega mapping on:

| Meie aste | Solfege | uTheory SVG (teacher perspective) |
|----------|---------|-----------------------------------|
| JO | do | `docs/utheory-solfege/glyph-svgs/do-teacher.svg` |
| LE | re | `docs/utheory-solfege/glyph-svgs/re-teacher.svg` |
| MI | mi | `docs/utheory-solfege/glyph-svgs/mi-teacher.svg` |
| NA | fa | `docs/utheory-solfege/glyph-svgs/fa-teacher.svg` |
| SO | sol | `docs/utheory-solfege/glyph-svgs/sol-teacher.svg` |
| RA | la | `docs/utheory-solfege/glyph-svgs/la-teacher.svg` |
| DI | ti | `docs/utheory-solfege/glyph-svgs/ti-teacher.svg` |

## Kiirmapping t&#228;hem&#228;rkidega (uTheory font key map)

uTheory pakett sisaldab fonti, kus diatoonilised k&#228;em&#228;rgid on seotud t&#228;htedega.
See vastab sinu kirjeldatud j&#228;rjestusele (**d, r, m, f, s, l, t, d**).

Eesti astmenimedele vastav mapping:

| uTheory t&#228;ht | Solfege | Meie aste |
|---------------|---------|-----------|
| **d** | do | **JO** |
| **r** | re | **LE** |
| **m** | mi | **MI** |
| **f** | fa | **NA** |
| **s** | sol | **SO** |
| **l** | la | **RA** |
| **t** | ti | **DI** |
| **d** | do | **JO** (kordus) |

Allikas: `docs/utheory-solfege/utheory-solfege-key-map.pdf` (ja `utheory-solfege-key-map-quick-view.png`).

### First-person vs Third-person

uTheory key map eristab:

- **lower-case** (nt `d r m f s l t`): first-person (self) k&#228;em&#228;rgid
- **upper-case** (nt `D R M F S L T`): third-person (teacher) k&#228;em&#228;rgid

Meie harjutustes saame valida, kas kasutada self v&#245;i teacher vaadet; mapping Eesti astmete suhtes j&#228;&#228;b samaks.

## Käemärkide suund Eestis: peegelpilt (RTL)

Eesti haridussüsteemi jaoks kuvame kõik käemärgid **peegelpildis paremalt vasakule (RTL)**.

- **Oluline:** me ei muuda uTheory SVG-faile (ND-litsents). Peegeldus tehakse **renderdamisel** (`transform` / CSS).

### SVG transform (uTheory teacher SVG-d)

uTheory `glyph-svgs/*-teacher.svg` failidel on `viewBox="-10 0 621 1024"`.
Horisontaalne peegeldus ümber viewBox keskme (x = 300.5) on:

- `translate(601 0) scale(-1 1)`

Näide:

```svg
<g transform="translate(601 0) scale(-1 1)">
  <!-- uTheory path siia sisse -->
</g>
```

### CSS alternatiiv

Kui kasutad käemärki `<img>` või inline SVG elemendina UI-s, siis:

- `transform: scaleX(-1);`

## Litsents

uTheory pakett on litsentsiga **CC BY-NC-ND 4.0**.

- **NC**: ainult mitte-\u00e4riline kasutus.
- **ND**: tuletatud/paremdatud versiooni ei tohi jagada (nt SVG kuju muutmine ja selle levitamine).

Seega neid SVG-sid tuleb kasutada **originaalkujul** (v\u00e4rvimine/transformatsioon renderdamisel on tavaliselt ok kui faili ennast ei muudeta ja jagata muudetuna; kui tahame olla 100% kindlad, hoiame failid muutmata ja lisame vaid viited).

