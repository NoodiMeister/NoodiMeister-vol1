## Kuidas me Noodimeistris otsuseid teeme (AI + inimene)

### Eesmärk

Noodimeister peab käituma “õpetaja tööriistana”: võimalikult vähe üllatusi, selged veateated, nulltolerants korduvatele UX‑bugidele.

### Kasutajast lähtuv arhitektuur (kõige tähtsam)

Kõik muudatused peavad hoidma kasutaja teekonnad tervena:

- **Auth**: sama kasutaja saab registreerida ja sisse logida isikliku konto / Google / Microsoft kanaliga.
- **Minu tööd**: kaustade ja failide loomine + haldus (loodud tööde turvaline säilimine).
- **No-overwrite**: failid ei tohi üksteist üle kirjutada; konfliktid lahendatakse selgelt (rename/duplicate/version), mitte vaikimisi overwrite’iga.
- **Noodistusmootor**: noodi/akordi sisestus ja eemaldus peab olema deterministlik, kursor ei tohi skip’ida ega “joosta”.
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
- **Kohalik tootmise eelvaade (sama port mis tavaliselt):** `npm run preview:full` → `http://127.0.0.1:4173` (build + `vite preview` + brauser avaneb). Cursor/VS Code: **Tasks → Run Task → “Noodimeister: build + preview …”**.

### Testimise ja lingid (õige aadress OAuth jaoks)

- **Ametlik toodang (kasutajad, Google/Microsoft OAuth):** `https://noodimeister.ee` ja `https://www.noodimeister.ee` — need peavad olema **Google Cloud Console** (ja Azure/Microsoft) **Authorized JavaScript origins** + **redirect URI** nimekirjas. Üksikasjad: `docs/GOOGLE-SETUP.md`, `docs/ONEDRIVE-JUHEND.md`.
- **Verceli tootmise tehniline URL (üks projekt, vt `docs/VERCEL-GITHUB.md`):** `https://noodi-meister-vol1-la-stravaganza.vercel.app` — ära kasuta teist `*.vercel.app` projekti tootmise asemel.
- **Iga juhuslik Verceli preview URL** (`…-hash-haru.vercel.app`) on **uus päritolu**; Google/Microsoft ei tööta seal, kuni see on **sama käsitsi** konsooli lisatud. Täieliku pilve/auth testi jaoks eelista **noodimeister.ee** või lisa **täpne** preview URL konsooli.
- **Kohalik:** `http://localhost:5173` / `http://127.0.0.1:5173` (dev), `http://127.0.0.1:4173` (preview pärast `npm run build`) — need tuleb konsoolis samuti lubada, kui testid OAuth kohapeal.

### Noodimeistri standardid (elav dokument)

- **Standard: veateated kasutajale**
  - kasutajale: inimkeelne selgitus + järgmine samm
  - arendajale: struktureeritud info (allikas, kood, kirjeldus)

