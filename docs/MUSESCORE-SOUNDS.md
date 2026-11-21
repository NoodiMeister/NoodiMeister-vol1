# MuseScore heliteek ja Noodimeisteri instrumentide vastendus

## Kasutaja ei pea MuseScore'i laadima

Noodimeister hostib **General MIDI (FluidR3_GM)** helid ise rakenduse all:

- **Runtime URL:** `/sounds/FluidR3_GM/{instrument}-mp3.js`
- **Kaust:** `public/sounds/FluidR3_GM/`
- **Mängija:** `soundfont-player` + kaardistus `src/musical/soundLibrary.js`
- **Uuenda faile:** `npm run sounds:fetch` (laeb ainult kasutatavad pillid; `deploy:cf` jooksutab sama enne build’i)
- **Litsents / attribution:** `public/sounds/LICENSE.md` (FluidR3 MIT + midi-js-soundfonts packaging)

Kasutajal ei ole vaja MuseScore’i ega MuseSounds’i. **MuseSounds on proprietary** ja ei kuulu Noodimeistri teeki.

Faili avamisel käivitub **score load session** (`src/musical/scoreLoadSession.js`): eellaaditakse kõik failis kasutatud unikaalsed instrumendid (progress N/M). MIDI/Play ootavad sessiooni lõppu. Pärast seda on heli vahemälus; puuduva faili korral jääb oscillator-fallback + kasutajateade.

---

## MuseScore heliteegi asukoht (viide, kui kasutad MuseScore'i eraldi)

### MuseScore 2 (macOS)
- Vaikimisi SoundFont:  
  `/Applications/MuseScore 2.app/Contents/Resources/sound/MuseScore_General.sf3`
- Kasutaja SoundFontid:  
  `~/Documents/MuseScore2/Soundfonts`

### MuseScore 3 (macOS)
- Tavaliselt sama struktuur kui MS2 või rakenduse kaustas `sound/`.

### MuseScore 4 (MuseHub)
- Helipakid laaditakse alla **MuseHub**i kaudu (MuseSounds = eraldi EULA; ei jaotata Noodimeistriga).
- Asukoht macOS-il: MuseHubi seadetes “Sounds installation path”.
- Windows: `C:\ProgramData\MuseHub\Downloads` (vaikimisi).

MuseScore kasutab **General MIDI (GM)**-ühilduvat helikomplekti: 128 programmi (0–127), nii et FluidR3 / MuseScore_General ja Noodimeisteri vastendus on ühilduv.

---

## Noodimeisteri instrument → GM program / soundfont

Tõde on koodis: `INSTRUMENT_TO_GM_PROGRAM` ja `INSTRUMENT_TO_SOUNDFONT_NAME` failis `src/musical/soundLibrary.js`.

| Noodimeister instrument | GM program | Soundfont name (FluidR3_GM) |
|-------------------------|------------|------------------------------|
| piano / single-staff-* | 0 | acoustic_grand_piano |
| electric-piano | 4 | electric_piano_1 |
| organ | 19 | church_organ |
| harpsichord | 6 | harpsichord |
| accordion | 21 | accordion |
| celesta | 8 | celesta |
| guitar / ukulele (sopran/tenor/bariton) | 24 | acoustic_guitar_nylon |
| ukulele-bass / acoustic-bass | 32 | acoustic_bass |
| electric-bass | 33 | electric_bass_finger |
| violin | 40 | violin |
| viola | 41 | viola |
| cello | 42 | cello |
| double-bass | 43 | contrabass |
| strings-ensemble | 48 | string_ensemble_1 |
| flute | 73 | flute |
| recorder | 74 | recorder |
| clarinet | 71 | clarinet |
| oboe | 68 | oboe |
| bassoon | 70 | bassoon |
| trumpet | 56 | trumpet |
| trombone | 57 | trombone |
| tuba | 58 | tuba |
| french-horn | 60 | french_horn |
| tin-whistle-* | 78 | whistle |
| saxophone | 65 | alto_sax |
| voice | 52 | choir_aahs |
| glockenspiel / metallophone | 9 | glockenspiel |
| xylophone (sh Orff) | 13 | xylophone |
| marimba / boomwhackers | 12 | marimba |
| vibraphone | 11 | vibraphone |
| handbells | 14 | tubular_bells |
| triangle / sleighbells / windchimes | 112 | tinkle_bell |
| agogo / cowbell / maracas / shakers | 113 | agogo |
| claves / woodblock / temple-blocks / castanets / guiro | 115 | woodblock |
| djembe / cajon | 116 | taiko_drum |
| bongo / conga | 117 | melodic_tom |
| cymbals | 119 | reverse_cymbal |
| rainstick | 96 | fx_1_rain |
| synth-lead | 80 | lead_1_square |
| synth-pad | 88 | pad_2_warm |

Klassiruumi/Orff rütmipillid kasutavad **erinevaid** GM tämbreid (mitte kõik `woodblock`).

---

## Noodimeisteris

- **Klaviatuur ja “noot sisestamisel mängib”**: heli valitakse valitud **tööriista instrumendi** (Instrumendid-toolbox) järgi.
- Helid tulevad **oma hostist** (`/sounds/...`); esimesel mängimisel võib olla lühike laadimine.
- Arendus: pärast clone’i või kui heli puudub → `npm run sounds:fetch`.
