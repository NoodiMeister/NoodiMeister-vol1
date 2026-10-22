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
- **Tootmise deploy = Cloudflare** (Workers / Pages; `wrangler.toml`, käsk `npm run deploy:cf`). **Ära deploy’i Vercelit** ega käivita Verceli CLI deploy’d, kui kasutaja seda eraldi ei palu. Domeen `noodimeister.ee` peab viitama Cloudflare’i deploy’ile. Üksikasjad: `DEPLOY.md`.
- **Verceli tehniline URL (ainult legacy / API viide, vt `docs/VERCEL-GITHUB.md`):** `https://noodi-meister-vol1-la-stravaganza.vercel.app` — ei ole esmane toodangu host; ära kasuta teist `*.vercel.app` projekti ega eelda, et push = Vercel deploy.
- **Iga juhuslik Verceli preview URL** (`…-hash-haru.vercel.app`) on **uus päritolu**; Google/Microsoft ei tööta seal. Täieliku pilve/auth testi jaoks eelista **noodimeister.ee**.
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

- **Standard: engraving anchors ja drift-invariandid (kõik notatsioonirežiimid)**
  - **Põhireegel:** staff-jooned, taktijooned ja glüüfid (võtmed, accidentalid, kordusmärgid jne) peavad lähtuma **samast ankruraamist** (`barlineFrame` / `anchorFrame`), mitte eraldi valemitest eri vaadetes.
  - **Ühik:** kõik paigutuskonstandid peavad olema väljendatud `staffSpace` suhtes; väldi “paljaid px” väärtusi renderi keskloogikas.
  - **Renderi jaotus:** geomeetrilised objektid (`line`/`path`) jäävad geomeetriaks; SMuFL sümbolid jäävad glüüfideks — kuid nende `x/y/size` arvutatakse samast raamistikust.
  - **Kordusmärgid (kohustuslik):** `repeatStart/repeatEnd` ei tohi “hõljuda” ega dubleeruda lõpujoonega; kui taktil on `repeatEnd`, ei tohi sama ankru peal lisaks tekkida fallback-final-barline.
  - **Lõpujoon / topeltjoon (MuseScore UX):** kasutaja klikib topeltjoonele → sinine valikukast; Backspace/Delete eemaldab topeltjoone ja asendab üksiktaktijoonega (`barlineSingle` peidab ka skoori lõpu auto-final’i). Tööriistakasti „Lõpujoon (||)“ taastab topeltjoone.
  - **Avaankur (kohustuslik):** kui rea alguses on kordusmärk, peab taktimõõt/helistik jääma loetavaks; kattumine (`repeatStart` vs `time signature`/`key signature`) on regressioon.
  - **Drift-lävi:** sama sisendi korral peab paigutus olema deterministlik; sama tüüpi glüüfide ankrud eri ridades/režiimides ei tohi lahkneda rohkem kui kokkulepitud optiline kalibratsioon (`kx/ky/ks`).
  - **Kalibratsioon:** optilised parandused on lubatud ainult nimega konstantidena (nt `*_INSET_STAFF_SPACES`, `*_HEIGHT_MULTIPLIER`) ühes kohas; ära dubleeri samu “magic numbreid” view failides.
  - **Kontroll enne merge'i:** kui muudatus puudutab taktijooni, kordusmärke, võtmemärke või taktimõõtu, tee vähemalt üks visuaalne smoke nii `traditional` kui `figurenotes` vaates ning kinnita, et ankrud on kooskõlas.

- **Standard: veateated kasutajale**
  - kasutajale: inimkeelne selgitus + järgmine samm
  - arendajale: struktureeritud info (allikas, kood, kirjeldus)

- **Standard: sisestus peab tunduma “pro-grade”**
  - tekstikasti loomine, noodi sisestus, TAB/fingering ja akordi sisestus peavad reageerima kohe ja ennustatavalt
  - sisestusvoogudes ei tohi olla märgatavat lag'i, topeltsisestust, vahelejätmisi ega cursor-jitter'it
  - enne sisestusloogika muutmist võrdle käitumist MuseScore/Finale/Sibelius tüüpi töövoogudega

- **Standard: Paigutus “Vahe: lai” / laius löögi kohta vs lehe laius**
  - `Vahe: tavaline` (85 px/löök), `Vahe: lai` (120 px/löök) ja “Laius löögi kohta” on **soovitud** tihedus — need peavad paigutust muutma (kitsam/laiem), mitte jääma vaikseks.
  - **Ära** klambi `pixelsPerBeat` enne layout’i lehe max-fit väärtusele (see lukustab UI: kõik ≥ max näevad välja sama).
  - Lehepiir kehtib **ainult ületäitumisel**: figuurnotatsiooni rea `measureWidths` summa ≤ content-laius (`fitWidthsToContentWidth`); ülejääv ei tohi minna `overflow: hidden` taha.
  - Kui soovitud laius juba täidab lehe, laiemaks saamiseks vähenda taktide arvu reas.

- **Standard: landscape / mitme lehe noodirida**
  - Paigutus (`yOffset`) elab **sisemises** lehekastis (`scorePageInnerHeight`); ekraanil on iga A4 **täislehe** riba + lauavahe.
  - Kui rida ei mahu lehele, peab `yOffset` minema **järgmise lehe algusesse** (mitte `yAcc = 0` ega lehepiiri sisse).
  - **Lehe serv (kohustuslik):** iga lehe alaosas on tuntav varu (`PAGE_EDGE_RESERVE_MM`, vähemalt ~30% rea kõrgusest). Kui järgmine noodirida jääks sellesse ribasse, viiakse see automaatselt järgmisele lehele.
  - Ekraaninihe: `layoutY + pageIndex * (deskGap + pagePaddingY)`. Ainult `deskGap` jätab rea kahe lehe tühja riba peale (eriti landscape, kus leht on madal).
  - PDF/trükk (`disablePhysicalPageGaps`) jääb loogilisele Y-le; lauavahe on ainult ekraan.

- **Standard: figuurnotatsiooni akordid (kuvamine vs andmed)**
  - **Akordiplokid** (`figurenotesChordBlocks`) on **kuvamise** lüliti: sisse = värviline akordirida; välja = akorde **ei kuvata** (ei plokke ega akordinimesid meloodia peal).
  - Lüliti **ei tohi** vaikimisi akorde failist kustutada; `chords[]` jääb alles, kuni kasutaja eemaldab akordi (Backspace/Delete akordireal) või **Eemalda kõik akordid**.
  - **Regressioon:** akordiplokkide väljalülitamine ei tohi jätta “rippuvaid” D/A-tüüpi nimesid figuurnootide kohale.

- **Standard: kursori ajamudel (cursor time model)**
  - **Kursori põhitõde on ajapositsioon** (`cursorBeat` / takt + löök + alamjaotus), mitte eraldiseisev “cursor rhythm”.
  - **Sisestusrütm** (`inputDuration`) on eraldi sisestusparameeter: see määrab lisatava/asendatava sündmuse kestuse, mitte kursori asukoha.
  - Sama sisend peab olema deterministlik: `cursorBeat + inputDuration + mode` -> sama notatsiooni tulemus.
  - Kustutamine ei tohi ajatelge “auku” jätta: kustutatud aeg täidetakse pausidega vastavalt kestustele.
  - Selection, click, Shift+Arrow, Shift+drag peavad muutma ühtset kursori/valiku mudelit; UI ei tohi pidada paralleelset “salatõde”.

- **Standard: pedagoogiline C4-põhi (kirjutamispiirkond)**
  - Pedagoogilises režiimis (`vabanotatsioon` / kuvarežiimid A–C) on sisestuse **alumine ankur absoluutne C4** (MIDI ≥ 60).
  - Vaikimisi ghost = C4; oktaavi nihutus lubab 4…6, mitte alla 4.
  - Tähekäsk A–G ei tohi valida oktavit, mis annaks noodi alla C4 (nt C4 + `B` → B4, mitte B3).
  - Käemärgid (režiim C) loetakse samast `notes[]`; C4-põhi hoiab JO…DI põhioktaavi stabiilsena.
  - Vt `docs/PEDAGOGICAL-NOTATION-REQUIREMENTS.md` §5.1.

- **Standard: pedagoogilised kuvarežiimid A/B/C/D**
  - Kehtib ainult pedagoogilise faili sees (`notationMode` / `vabanotatsioon`); `sourceNotationMode` jääb lukku.
  - `pedagogicalDisplayMode`: **A** `joStaff` (JO-võti + noodid), **B** `joStaffHandSigns` (JO + käemärgid noodi all enne laulusõnu), **C** `handSignLyrics` (7 astmejoont, käemärgid glüüfide asemel, laulusõnad all), **D** `interactive` (interaktiivne playback: taustheli, cue’d, playhead, meedia-toolbar, animatsiooni eksport).
  - A/B/C/D on **sama loo vaated** (`notes`, lyrics, taktimõõt, JO-ankur) — vahetus ei dubleeri ega kustuta andmeid.
  - **A/B/C = noodistus** (sisestus, korrastus, kuvamine). Playbacki UI ja süsteemid **ei tohi** A/B/C-s olla peal ega segada sisestust.
  - **D = interaktiivne režiim**: kogu pedagoogiline playback (heli, cue, playhead-stiilid, alumine meedia-toolbar, video ruler, animatsiooni eksport) elab **ainult** D all. D-st lahkudes peatatakse taasesitus.
  - C: alumine joon = JO … ülemine = DI; taktijooned 1.–7. jooneni; X = beat/taktimõõt (ti-ti lähestikku); käemärk RTL peegel ainult renderdamisel (uTheory ND); `handSignStyle.showDegreeLines` võib horisontaalsed astmejooned peita.
  - Ülemine **Režiim/meetod** riba: T/F/P → (kui P) A/B/C/D → (kui C) Style; A–D ei dubleerita teacher-paneelis.
  - Detailid: `docs/PEDAGOGICAL-NOTATION-REQUIREMENTS.md` §5.

- **Standard: käemärkide nähtavus (C)**
  - `handSignStyle`: `sizePercent` (50…200; 100 = vaikimisi, 200 = 2× vektorskaala) ja `contrast` (0…1; peenike → väga paks SVG stroke).
  - Sama uTheory font; glüüfifaile ei muudeta (CC BY-NC-ND). Suurem suurus skaleerib ka astmejoonte vahet.
  - Ekraan, PDF ja print kasutavad sama `handSignStyle` (persist projektifailis).

- **Standard: noodipea tööriistakast (notehead toolbox)**
  - **Mõiste:** tööriist muudab **noodipea kujutist** (`note head`), mitte rütmi/kestust. Rütmitööriistakast jääb kestuste ja mustrite jaoks.
  - **Sisu:** kasutaja valib MuseScore/SMuFL inspireeritud glüüfe: ovaal, X, kolmnurk üles, kolmnurk alla, romb, ruut (+ valikuline emoji). Igal valikul on glüüfi eelvaade.
  - **Render:** traditsiooniline joonestik peab rakendama valitud kujundit (ei tohi sundida X/ruut/kolmnurk tagasi ovaaliks).
  - **Eraldus rütmist:** kui noodipea kast on avatud, ei tohi UI näidata rütmitööriista ikoone/seadeid samas ribas.

- **Standard: uus lugu / uus harjutus (`addSongBlock`, Option+N)**
  - Eelmise loo viimasele taktile pannakse `barlineFinal` (topelt lõpujoon).
  - Uus takt kuulub **ainult uuele reale** (`layoutLineBreakBefore` uue takti **0-põhise** indeksi peale); eelmisele reale ei lisata tühja täite-takti ega nihutata eelmise loo viimast takti uuele reale.
  - Uue loo esimene süsteem kuvab taktinumbri **1** (`layoutBarNumberRestartAt`).
  - Sama käitumine `traditional` ja `figurenotes` vaates; paigutuse `lineBreakBefore` / `pageBreakBefore` on kõikjal 0-põhised.

- **Standard: parooli taastamine (kohalik e-post + parool)**
  - **Ulatus:** kehtib **ainult** `provider: local` kontodele (e-post + parool brauseris). **Google/Microsoft** parooli ja identiteedi taastamine jääb vastavalt Google’ile ja Microsoftile; Noodimeister ei saada neile läbi oma e-kirja SSO parooli resetti.
  - **Server on tõde parooli räsi jaoks:** Vercel KV-s hoitakse `nm:auth:local:{email}` kirjet (scrypt räsi + sool). **Ülekirjutamine:** uus serverikirje luuakse `POST /api/auth/sync-local-account` kaudu **ainult kui** kirjet pole; olemasolevat ei tohi üle kirjutada ilma kehtiva parooli või kehtiva ühekordse taastamistokenita.
  - **Sisselogimine:** eelistatud tee on `POST /api/auth/verify-local-login`; kui serveris kirjet pole (404), võib rakendus **üks kord** kasutada legacy `localStorage` parooli vastavust ja seejärel teha **sünk** serverisse. Kui serveris kirje on ja parool on vale (401), **ei tohi** aktsepteerida ainult kohalikku `localStorage` vastavust (server on allikas).
  - **Taastamisvoog:** `POST /api/auth/request-password-reset` ei tohi paljastada, kas e-post on süsteemis; vastus peab olema kasutajale **sama sõnastus** olenemata olemasolust. Taastamistoken on **ühekordne**, lühiaegne (≈1 h), hoitakse KV-s räsi võtmena; kiri läheb **Resend** (või asendaja) kaudu; lingi baas tuleb `NM_PUBLIC_SITE_URL` (tootmise kanooniline URL).
  - **Keskkond:** tootmises peavad olema `KV_*`, `RESEND_API_KEY`, `RESEND_FROM`, `NM_PUBLIC_SITE_URL`. Kohalikus dev-is kasuta `NM_DEV_API_PROXY` (vite proxy) või `vercel dev`, muidu `/api/auth/*` ei tööta.

- **Standard: Import noot / nuoti / sheet music (teistest programmidest Noodimeistrisse)**
  - **Definitsioon:** “Import noot/nuoti/sheet music” tähendab, et teises programmis (nt MuseScore, Sibelius, Finale) loodud/salvestatud partituur tuuakse Noodimeister.ee keskkonda nii, et kasutaja saab seda edasi muuta.
  - **Asukoht UX-is:** `Minu tööd` lehel peab olema eraldi `Impordi töö` tegevus; import **ei tohi eeldada**, et kasutaja loob enne käsitsi “uue töö”. Import loob uue projekti (või kontrollitud koopia), mitte ei kirjuta olemasolevat vaikimisi üle.
  - **A) PDF import:** PDF import tähendab arvuti/AI-lugerit, mis suudab PDF-ist tuvastada vähemalt noodid, rütmid, instrumendid/stavid, hääled ning nähtava teksti. Kuna PDF on visuaalne formaat, peab süsteem andma kasutajale import-raporti + parandatavad hoiatused (ebakindlad kohad) enne lõplikku kinnitamist.
  - **B) XML import:** MusicXML/XML import peab lugema vähemalt helistiku, taktimõõdu, rütmid, noodid ja pealkirja; võimalusel ka tekstielemendid (sh tekstikastide sisu/positsioon). Impordi tulemus peab jääma kasutajale täiendatavalt/muudetavalt Noodimeistri noodigraafika töövoos.
  - **No-overwrite + jälgitavus:** impordi käigus peab säilima failiohutus: “create new” vaikimisi, selge konfliktikäitumine (duplicate/rename/version) ja kasutajale arusaadav teade, mida imporditi, mida ei suudetud lugeda ja mida soovitatakse käsitsi kontrollida.
  - **Kvaliteedinõue:** import ei tohi “pakendada” kogu partituuri ühte instrumenti ilma nähtava hoiatuseta; part-id, staffid ja hääled peavad säilima nii täpselt kui sisend lubab. Kui täpne taastamine pole võimalik, tuleb see kasutajale selgelt välja tuua ning pakkuda parandatavat tulemust, mitte vaikset andmekadu.

- **Standard: selection state machine (kohustuslik kõikides režiimides)**
  - **Üks tõde valikule:** valik on üks mudel (`selectionModel`), millel on selged tüübid: `none`, `singleNote`, `noteRange`, `measureRange`, `singleObject` (nt repeat mark), `objectList` (katkendlikud objektid). Ära hoia paralleelseid "peidetud tõdesid".
  - **Ühesed modifikaatorid:** `Click` = single, `Shift+Click` = range extend (ajaliselt järjestikune), `Cmd/Ctrl+Click` = lisa/eemalda `objectList` valikust. Sama kaart peab kehtima `traditional`, `figurenotes`, `pedagogical` vaates.
  - **Mode sõltumatus valikule:** `SEL` ja `N-mode` võivad käske piirata, kuid valiku semantika peab jääma samaks. Kui objekt on valitud, peab `Delete/Backspace` käitumine olema prognoositav ja tüübi-põhine (nt repeat mark eemaldus, nootide asendus pausidega).
  - **Deterministlikud üleminekud:** igal sündmusel (`click`, `shift+arrow`, `shift+drag`, `esc`, `delete`, `copy`, `paste`) on täpselt üks lubatud üleminek. "Best effort" või vaikimisi fallback, mis muudab selection type’i ilma nähtava põhjuseta, on regressioon.
  - **Kohustuslik visuaalne tagasiside:** igal selection type’il on oma nähtav marker (single highlight, range rectangle, measure highlight, object highlight). Kui state on aktiivne ja markerit ei kuvata, loetakse see bugiks.
  - **Kopeeri-kleebi reegel:** `objectList` = merge-käitumine, `noteRange/measureRange` = ajavahemiku overwrite-käitumine. Käitumine peab olema ühtlane kõikides režiimides ja sama sisendi korral deterministlik.
  - **Smoke enne merge’i:** testi minimaalselt: (1) click single -> highlight, (2) shift-extend -> range marker, (3) cmd/ctrl-click toggle list, (4) selected repeat mark delete, (5) esc clear, (6) copy/paste vastab selection type’ile.

- **Standard: pointer click selection (score hit → selection → toolbox)**
  - **Poliitika:** `src/orchestrator/pointerClickPolicy.js` — üks kaart `selection → activeToolbox`. Ära dubleeri “mis toolbox avaneb” loogikat view failides.
  - **1) Tühi takt:** klikk takti tühjale alale → `measureRange` (üks takt) + `layout` toolbox. Lubatud: reavahetus järgmisele reale / kui takt on rea alguses, ühendus eelmise reaga (`connectNextSystem` / `connectPreviousSystem`). Kursor liigub valitud takti algusesse, et layout-nupud töötaksid.
  - **2) Taktijoon / topeltjoon / kordusmärk:** klikk → `singleObject` + `repeatsJumps` toolbox. Backspace/Delete: topeltjoon või kordusmärk → tavaline taktijoon (`barlineSingle` / `removeRepeatMark`). Ka tavaline üksiktaktijoon peab olema valitav.
  - **3) Tekst:** klikk tekstikastile / pealkirjale / autorile → tekstivalik + tekstimuutmise tööriistad (`textBox` / floating text tool). Note/repeat valik puhastatakse.
  - **4) Võti (clef):** klikk võtme glüüfile → `singleObject` (clef) + `clefs` toolbox. Võtme vahetus peab uuendama noodigraafikat vastavalt võtmereeglitele (`setClefType` / JO-režiim).
  - **5) Noot / paus:** klikk → `singleNote` (runtime `kind: 'note'`) + N-mode + primaarne notatsioonitööriist (`rhythm`). Lubatud: kestus, artikulatsioon, kõrgus; Shift+Click jääb range’iks ilma N-mode sundita. Enharmooniline asendus: valitud noodil peab olema selge tee (tulevikus / olemasolev accidental-töövoog).
  - **Deselect (kohustuslik):** `Esc`, **teine klikk** samale taktile/taktijoonele/võtmele, või **tühi lehe/laua pind** → `clearPointerSelection` (`none` + markerid kaovad). Selection-driven toolbox (layout / repeatsJumps / clefs / textBox) sulgub; N-mode + `rhythm` jääb alles, kui kasutaja on N-režiimis.
  - **Regressioon:** selection ilma nähtava markerita või toolbox, mis ei reageeri valitud objektile, on P0 UX-bug. Aktiivne valik, mida Esc ei puhasta, on samuti P0.

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

