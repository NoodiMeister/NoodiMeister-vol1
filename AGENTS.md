## Kuidas me Noodimeistris otsuseid teeme (AI + inimene)

### Eesmärk

Noodimeister peab käituma “õpetaja tööriistana”: võimalikult vähe üllatusi, selged veateated, nulltolerants korduvatele UX‑bugidele.

### Kasutajast lähtuv arhitektuur (kõige tähtsam)

Kõik muudatused peavad hoidma kasutaja teekonnad tervena:

- **Auth**: kasutaja saab registreerida ja sisse logida isikliku konto / Google / Microsoft kanaliga, kuid identiteeti ei tohi automaatselt kokku liita üle providerite. `provider + email` moodustab konto identiteedi; erinevad Google/Microsoft e-mailid peavad jääma eraldi kontodeks ja eraldi tööruumideks.
- **Minu tööd**: kaustade ja failide loomine + haldus (loodud tööde turvaline säilimine).
- **No-overwrite**: failid ei tohi üksteist üle kirjutada; konfliktid lahendatakse selgelt (rename/duplicate/version), mitte vaikimisi overwrite’iga.
- **Noodistusmootor**: noodi/akordi sisestus ja eemaldus peab olema deterministlik, kursor ei tohi skip’ida ega “joosta”.
- **Sisestuse kvaliteet**: tekstikastide, nootide, akordide, TAB-ide ja fingering-märkide sisestus peab töötama sujuvalt, täpselt ja ilma lag'ita; ükski sisestus ei tohi juhuslikult dubleeruda, kaduda või nihkuda.
- **Režiimid**: traditional / figurenotes / pedagogical on eraldiseisvad režiimid; pedagoogiline sisaldab mitut sisestusrežiimi.
- **Eksport & print**: PDF eelvaade ja print preview peavad vastama prinditavale alale; ei mingeid suvalisi lõikamisi või ümberpaigutusi.

### Arhitektuuri “ankrud”

- **State**: `src/store/**` (nt `NotationContext`) on tõde.
- **Domain**: notatsiooni reeglid `src/notation/**`, paigutus `src/layout/**`.
- **Orkestreerimine**: `src/orchestrator/**` ühendab sisendi → loogika → state → vaated.
- **UI**: `src/components/**` ja `src/pages/**` on kasutajaliides, mitte reeglimootor.

### Kui teeme uue funktsiooni või muudame käitumist

1) Leia analoog:
- esmalt meie koodist (kas juba on sarnane “muster”?)
- kui puudu, siis võrdle MuseScore/Finale/Sibelius terminoloogia ja UX‑iga

2) Kirjelda standard:
- lisa siia faili lühike kirje “Noodimeistri standard: <teema>”
- lisa 2–5 punkti “mis peab alati kehtima”

3) Rakenda väikese sammuga:
- hoia muudatus kitsas
- ära sega UI‑domeeni ja notatsiooni reegleid

4) Kontrollplaan (enne PR/merge’i):
- **Põhivoog**: sisesta noodid (klaviatuur/hiir) → render (traditional/figurenotes) → eksport (SVG/PDF/PNG kui kasutusel)
- **Kiirklahvid**: 1–5 rütm, A–G noot; ei tohi häirida input‑välju
- **Errorid**: auth ja eksport peavad andma arusaadava sõnumi + taastumisjuhise
- **Build**: `npm run build` peab läbi minema

### Noodimeistri standardid (elav dokument)

- **Standard: veateated kasutajale**
  - kasutajale: inimkeelne selgitus + järgmine samm
  - arendajale: struktureeritud info (allikas, kood, kirjeldus)

- **Standard: sisestus peab tunduma “pro-grade”**
  - tekstikasti loomine, noodi sisestus, TAB/fingering ja akordi sisestus peavad reageerima kohe ja ennustatavalt
  - sisestusvoogudes ei tohi olla märgatavat lag'i, topeltsisestust, vahelejätmisi ega cursor-jitter'it
  - enne sisestusloogika muutmist võrdle käitumist MuseScore/Finale/Sibelius tüüpi töövoogudega

### Filosoofia vs regressioonid (AI jaoks kohustuslik eristus)

- **Filosoofia** (eesmärk, prioriteedid) ütleb *kuhu* liigume ja *mida* ei tohi ohverdada.
- **Regressioonide vältimine** nõuab *kontrolli*: automaatne või korduv käsitsi-kontroll, mis tõestab, et varem korda tehtud käitumine jääb alles.

Ilma kontrollita võib AI “parandada” ühte kohta ja murda teist — isegi kui tekst reeglites on õige. Seega: **iga kriitiline parandus peab jätma jälje**, mis seda tulevikus kaitseb (vt allpool).

### Kuidas hoida varem korda tehtud funktsioone uuesti murdmata

1. **Enne muudatust — mõõt**: mis käitumine peab kindlasti alles jääma? (kirjuta 1–3 lauset PR-i või commiti kirjelduse juurde).
2. **Pärast muudatust — tõestus**:
   - `npm run build`
   - `npm run test:export-smoke` (eksport / font / determinism)
   - kui muudatus puudutab noodigraafikat, laadimist või PDF-i: **käsitsi smoke** (vt “Kontrollplaan” üleval).
3. **Kui viga parandati teist korda** (sama klassi bug): lisa **automaatne kontroll** (nt uus assert `scripts/check-export-determinism.mjs`-is, uus väike testiskript, või dokumenteeritud “ei tohi” koos koodiviitega). Filosoofia üksi ei asenda seda sammu.
4. **Üks muudatus = üks mure**: ära sega samas PR-is eksporti, auth’t ja noodijoonestiku renderit, kui vältida saab — see on kõige tüüpilisem regressioonide allikas.
5. **“Kaitstud tõed”** (näited, mida ei tohi ilma põhjendatud refaktorita murda):
   - scorepage render ei tohi `null` minna, kui projekti andmed on olemas;
   - `sourceNotationMode` on faili loomisel fikseeritud ja muutumatu;
   - cloud salvestus ei tohi vaikimisi üle kirjutada väärast failist / valest kontekstist.

**Kokkuvõte AI-le:** loe esmalt filosoofiat ja reegleid, **siis** kontrolli, kas muudatus nõuab uut kaitset (test/assert/smoke). Kui ei nõua — küsi, kas see on tõesti “ohutu kosmeetika”.

