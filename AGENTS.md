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
- **Kohalik tootmise eelvaade:** `npm run preview:full` → `http://127.0.0.1:4177` (build + `vite preview` + brauser avaneb; port `vite.config.js` → `preview.port`). Cursor/VS Code: **Tasks → Run Task → “Noodimeister: build + preview …”**.

### Testimise ja lingid (õige aadress OAuth jaoks)

- **Ametlik toodang (kasutajad, Google/Microsoft OAuth):** `https://noodimeister.ee` ja `https://www.noodimeister.ee` — need peavad olema **Google Cloud Console** (ja Azure/Microsoft) **Authorized JavaScript origins** + **redirect URI** nimekirjas. Üksikasjad: `docs/GOOGLE-SETUP.md`, `docs/ONEDRIVE-JUHEND.md`.
- **Verceli tootmise tehniline URL (üks projekt, vt `docs/VERCEL-GITHUB.md`):** `https://noodi-meister-vol1-la-stravaganza.vercel.app` — ära kasuta teist `*.vercel.app` projekti tootmise asemel.
- **Iga juhuslik Verceli preview URL** (`…-hash-haru.vercel.app`) on **uus päritolu**; Google/Microsoft ei tööta seal, kuni see on **sama käsitsi** konsooli lisatud. Täieliku pilve/auth testi jaoks eelista **noodimeister.ee** või lisa **täpne** preview URL konsooli.
- **Kohalik dev (fikseeritud):** `http://127.0.0.1:5197` — **`npm run dev`** avab vaikimisi **demo intro**: `http://127.0.0.1:5197/demo-intro`. Preview pärast build’i: `http://127.0.0.1:4177` (vt `npm run preview:full`). OAuth (Google/Microsoft) jaoks lisa konsooli need päritolud, kui testid kohapeal.

### Noodimeistri standardid (elav dokument)

- **Standard: scorepage (noodileht) — toote- ja visuaalne definitsioon (kohustuslik AI-le ja arendajale)**
  - **Mis see on:** **Scorepage (noodileht)** on **dokumendi leht**: ala, kuhu kasutaja peab saama **kirjutada noote** ja **tekste**, **muuta takte**, **muuta layout’it** (paigutus, reavahetused jne). Pärast sisestust peab **kogu noodikiri** koos **staff** (joonestik(ud)) ja **keys** (võtmed / vastav kontekst sõltuvalt režiimist) **eksisteerima ja olema nähtav** selles vaates — mitte ainult “mõnes teises mälus”.
  - **Eksport ja print:** **PDF-eksport** ja **print** peavad **eelvaates** (preview) kuvama **sama** töö sisu ja piire (käitumine “enne printimist” — kasutaja näeb, mida trükitakse). See eeldus on scorepage’iga seotud; regressioon, kus preview või PDF ei vasta scorele, on **blokeeriv** kuni parandatud.
  - **Scorepage on rakenduse süda.** See peab olema alati **nähtav** ja korrektses kihis: noodilehe sisu (taktimõõt, beat-boxid, noodid jne) peab olema **z-index / stacking context**, mis tagab nähtavuse lehekülje kujunduse suhtes (tüüpiliselt score’i kiht **vähemalt 1** võrreldes tausta/dekooriga; täpne number sõltub paigutusest — oluline on, et noodid ei jääks alumisse või nähtamatusse kihti).
  - **Paigutus:** scorepage asub **MainLayout** sees, **paremal** pool külgmenüüd.
  - **Kriitiline nõue:** kui scorepage on **tühi või nähtamatu**, on rakendus **kasutu** — selliseid regressioone ei tohi merge’ida ilma paranduseta.
  - **Overflow:** ära pane vanem-konteineritele **`overflow: hidden`** ilma kontrollimata, et noodileht (sh vertikaalne/horisontaalne sisu) **mahuks** vaatesse või oleks mõistlikult **scrollitav**; muidu võib “olemas olev” score jääda lõigatuks või nähtamatuks.

- **Standard: lehe taust vs noodigraafika kiht (toote eristus, mitte kloon)**
  - **Eesmärk:** Noodimeister ei ole eesmärgipäraselt järjekordne MuseScore’i või Sibeliuse “kloon”; õpetaja peab saama **lehte kujundada** (sh imporditud kujundus) nii, et **noodigraafika** jääb **kasutatavaks ja loetavaks** — nii **sisestusvaates** kui **kõigis eelvaadetes** (PDF, print, muud preview’d), ilma et dekoratiivne kiht **noodisid kattaks** või “klikitav, aga nähtamatu” olukorda looks.
  - **Imporditav kujundus:** eelistatud vorming **SVG** (skaalautuv, selge piir joonise ja noodikihi vahel). Taust/dekoor joonistatakse **alati noodigraafika alla** (stacking order), kuni eraldi otsus ja tehniline kontroll ei luba teisiti.
  - **Keeld kuni edasise otsuseni:** valikut “kujundus noodistuse **ees**” (watermark / demo-lehe katmine) **ei taasta**, kuni **noodileht + kõik preview-vood** on ühtlustatud ja testitud — varem olnud “ees” režiim oli mõeldud pigem demo/watermark stsenaariumile, aga põhjustas noodikihi peitmist ja ebaühtlasi eelvaateid.
  - **Tausta nihutamine:** kasutaja saab tausta asukohta muuta **ohutult** (nt paigutuspaneeli juhtnupud, käetööriist + Alt + lohistamine score alal), **ilma** noodikihi z-index’i taustaga vahetamata.
  - **Regressioon:** kui imporditud kujundus või CSS **peidab noodid** või **lõikab** need ebaühtlaselt võrreldes pealkirjaga, on see **P0** (sama klass mis nähtamatu scorepage).

- **Standard: figuurnotatsiooni multi-staff süsteem (klaver + lisapillid)**
  - kui pill on **klaver (piano)**, siis sama takti **meloodia- ja bassirida** peavad jääma **sama süsteemi** sisse (vertikaalselt kohakuti), mitte minema järgmisse süsteemi
  - kui kasutaja lisab klaveri kõrvale veel pille/hääli, siis sama takti read paigutatakse **samasse süsteemi üksteise alla**
  - süsteemivahetus tohib toimuda alles pärast seda, kui **kõik sama süsteemi read** (kõik nähtavad stavid) on paigutatud
  - figuurnotatsiooni süsteemi vertikaalne samm arvutatakse kui: kõigi nähtavate staffide kogukõrgus + staffidevahelised vahed + süsteemivahe

- **Standard: veateated kasutajale**
  - kasutajale: inimkeelne selgitus + järgmine samm
  - arendajale: struktureeritud info (allikas, kood, kirjeldus)

- **Standard: sisestus peab tunduma “pro-grade”**
  - tekstikasti loomine, noodi sisestus, TAB/fingering ja akordi sisestus peavad reageerima kohe ja ennustatavalt
  - sisestusvoogudes ei tohi olla märgatavat lag'i, topeltsisestust, vahelejätmisi ega cursor-jitter'it
  - enne sisestusloogika muutmist võrdle käitumist MuseScore/Finale/Sibelius tüüpi töövoogudega

- **Standard: parooli taastamine (kohalik e-post + parool)**
  - **Ulatus:** kehtib **ainult** `provider: local` kontodele (e-post + parool brauseris). **Google/Microsoft** parooli ja identiteedi taastamine jääb vastavalt Google’ile ja Microsoftile; Noodimeister ei saada neile läbi oma e-kirja SSO parooli resetti.
  - **Server on tõde parooli räsi jaoks:** Vercel KV-s hoitakse `nm:auth:local:{email}` kirjet (scrypt räsi + sool). **Ülekirjutamine:** uus serverikirje luuakse `POST /api/auth/sync-local-account` kaudu **ainult kui** kirjet pole; olemasolevat ei tohi üle kirjutada ilma kehtiva parooli või kehtiva ühekordse taastamistokenita.
  - **Sisselogimine:** eelistatud tee on `POST /api/auth/verify-local-login`; kui serveris kirjet pole (404), võib rakendus **üks kord** kasutada legacy `localStorage` parooli vastavust ja seejärel teha **sünk** serverisse. Kui serveris kirje on ja parool on vale (401), **ei tohi** aktsepteerida ainult kohalikku `localStorage` vastavust (server on allikas).
  - **Taastamisvoog:** `POST /api/auth/request-password-reset` ei tohi paljastada, kas e-post on süsteemis; vastus peab olema kasutajale **sama sõnastus** olenemata olemasolust. Taastamistoken on **ühekordne**, lühiaegne (≈1 h), hoitakse KV-s räsi võtmena; kiri läheb **Resend** (või asendaja) kaudu; lingi baas tuleb `NM_PUBLIC_SITE_URL` (tootmise kanooniline URL).
  - **Keskkond:** tootmises peavad olema `KV_*`, `RESEND_API_KEY`, `RESEND_FROM`, `NM_PUBLIC_SITE_URL`. Kohalikus dev-is kasuta `NM_DEV_API_PROXY` (vite proxy) või `vercel dev`, muidu `/api/auth/*` ei tööta.

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

