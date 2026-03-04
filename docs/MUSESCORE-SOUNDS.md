# MuseScore heliteek ja Noodimeisteri instrumentide vastendus

## Kasutaja ei pea MuseScore'i laadima

Noodimeister laeb **instrumentide helid otse veebist** (GitHub / CDN). Kasutajal ei ole vaja MuseScore'i eraldi paigaldada ega kasutada.

- **Allikas:** teek `soundfont-player` laeb GM-hele (FluidR3_GM) aadressilt  
  **https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/**  
  (Benjamin Gleitzmani [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) – GitHub Pages).
- Iga instrument (klaver, viiul, kitarr jne) laetakse esimesel mängimisel võrgu kaudu; edaspidi on heli vahemälus.
- See on **General MIDI**-ühilduv komplekt, sarnane MuseScore vaikimisi helidega, aga täiesti veebipõhine.

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
- Helipakid laaditakse alla **MuseHub**i kaudu.
- Asukoht macOS-il: MuseHubi seadetes (Muse Hub → Settings) kuvatav “Sounds installation path”.
- Windows: `C:\ProgramData\MuseHub\Downloads` (vaikimisi).

MuseScore kasutab **General MIDI (GM)**-ühilduvat helikomplekti: 128 programmi (0–127), nii et MuseScore_General.sf3 ja Noodimeisteri vastendus on ühilduv iga GM SoundFontiga.

---

## Noodimeisteri instrument → GM program (MuseScore / üldine GM)

Noodimeister kasutab sama **instrument → GM program** vastendust, et klaviatuuri- ja noodisisestuse heli oleks kooskõlas MuseScore’i (ja teiste GM-rakendustega).

| Noodimeister instrument | GM program | GM nimi (MuseScore / GM) |
|-------------------------|------------|---------------------------|
| piano | 0 | Acoustic Grand Piano |
| organ | 19 | Church Organ |
| harpsichord | 6 | Harpsichord |
| accordion | 21 | Accordion |
| guitar | 24 | Acoustic Guitar (nylon) |
| ukulele-sopran, ukulele-tenor, ukulele-bariton | 24 | Acoustic Guitar (nylon) |
| ukulele-bass | 32 | Acoustic Bass |
| violin | 40 | Violin |
| viola | 41 | Viola |
| cello | 42 | Cello |
| double-bass | 43 | Contrabass |
| flute | 73 | Flute |
| recorder | 74 | Recorder |
| clarinet | 71 | Clarinet |
| oboe | 68 | Oboe |
| bassoon | 70 | Bassoon |
| trumpet | 56 | Trumpet |
| trombone | 57 | Trombone |
| tuba | 58 | Tuba |
| french-horn | 60 | French Horn |
| tin-whistle | 75 | Whistle |
| saxophone | 65 | Alto Sax |
| voice | 52 | Choir Aahs |
| single-staff-treble, single-staff-bass | 0 | Acoustic Grand Piano |

See tabel on koodis konstant `INSTRUMENT_TO_GM_PROGRAM` ja SoundFont-mängija jaoks `INSTRUMENT_TO_SOUNDFONT_NAME` (FluidR3_GM / MusyngKite või muu GM SoundFont).

---

## Noodimeisteris

- **Klaviatuur ja “noot sisestamisel mängib”**: heli valitakse valitud **tööriista instrumendi** (Instrumendid-toolbox) järgi. Helid laetakse **veebist** (ülal nimetatud GitHub Pages CDN); kasutaja ei pea MuseScore'i ega ühtegi teist tarkvara laadima.
- Esimesel mängimisel võib ühe hetke kesta instrumendi helifaili laadimine; seejärel mängib valitud instrument GM-heli (MuseScore-moodi).
