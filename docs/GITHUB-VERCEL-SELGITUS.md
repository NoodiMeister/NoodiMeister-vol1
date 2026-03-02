# GitHub ja Vercel – kes on kes ja mis on mis

## Sinu kohalik projekt (Cursor) praegu

| Asi | Väärtus |
|-----|--------|
| **Kuhu push läheb** | `https://github.com/NoodiMeister/NoodiMeister.git` |
| **Haru** | `main` |
| **Git nimi (kohalik)** | Raido Lill |
| **Git e-mail (kohalik)** | lill.raido@gmail.com |

See tähendab: kui sa teed `git push origin main`, siis kood läheb **repositooriumisse NoodiMeister/NoodiMeister** (GitHubis). "NoodiMeister" võib olla kas sinu GitHubi **organisatsioon** või **kasutajanimi**.

---

## Erinevad “kasutajad” – kuidas aru saada

### 1. GitHubi konto (kes sa sisse logid)

- **github.com** → paremas ülanurgas avatar → see on **sinu sisselogitud konto** (nt raidolill või NoodiMeister).
- Ühel GitHubi kontol võib olla mitu **repositooriumi**.
- Võid olla ka **organisatsiooni** (nt NoodiMeister) liige – siis näed nii oma isiklikke repo-sid kui ka orgi repo-sid.

**Kuidas vaadata:** github.com → avatar → "Your repositories" või "Your organizations".

### 2. GitHubi repositoorium (kust Vercel loeb)

- Aadress on kujul: **github.com / KASUTAJA-VÕI-ORGI-NIMI / REPO-NIMI**
- Sinu puhul: **NoodiMeister / NoodiMeister**  
  → esimene NoodiMeister = omanik (kasutaja või org), teine = repojuure nimi.

**Kuidas vaadata:**  
Ava brauseris `https://github.com/NoodiMeister/NoodiMeister` – kõige üleval on “NoodiMeister / NoodiMeister”. See on **ainuke repo**, kuhu su Cursori projekt praegu pushib.

### 3. Vercel’i projekt (üks projekt = üks GitHubi repo)

- Iga **Vercel’i projekt** on ühendatud **ühe** GitHubi repoga (ja ühe haruga, nt `main`).
- Kui sul on mitu Vercel’i projekti, võib olla:
  - erinevad **repo-d** (nt NoodiMeister/NoodiMeister vs raidolill/noodimeister);
  - või sama repo, aga erinevad **harud** (nt main vs develop).

**Kuidas vaadata:**  
vercel.com → Dashboard → iga projekti juures **Settings → Git** – seal on “Repository” (nt NoodiMeister/NoodiMeister) ja “Production Branch” (nt main).

---

## Mida kontrollida, kui “näen erinevaid kasutajaid”

1. **GitHub:**  
   - Mis konto peal sa oled? (avatar paremas ülanurgas)  
   - Kas repod on sinu isikliku konto all (nt raidolill/…) või organisatsiooni all (NoodiMeister/…)?

2. **Vercel:**  
   - Mitu projekti sul on?  
   - Iga projekti juures: **Settings → Git** → kirjuta üles “Repository” ja “Production Branch”.  
   - Soovitatav: **üks** projekt, mis on ühendatud **NoodiMeister/NoodiMeister** ja haruga **main** – see vastab sinu Cursori projektile.

3. **Kohalikult (Cursor):**  
   - `git remote -v` → peab näitama **NoodiMeister/NoodiMeister**, kui tahad, et Vercel kasutaks sama koodi.  
   - Kui näed `raidolill/...` või teist repot, siis push läheb sinna, mitte NoodiMeister/NoodiMeister – ja Vercel’i projekt, mis on ühendatud NoodiMeister/NoodiMeister-iga, ei uuene.

---

## Lühikokkuvõte

- **Üks Cursori kaust** → üks **Git remote** (praegu NoodiMeister/NoodiMeister).  
- **Üks GitHubi repo** võib olla ühendatud **mitme** Vercel’i projektiga (erinevad kontod või testimiseks), aga **ühe** “põhilise” jaoks piisab ühest projektist.  
- Et Cursor ja Vercel ühtiksid: **Vercel’i projekti Git seades** peab olema **Repository: NoodiMeister/NoodiMeister** ja **Production Branch: main**.

Kui tahad, võid Vercel’i Dashboardist iga projekti juuresta “Repository” ja “Production Branch” siia kirja panna – siis saab täpselt öelda, milline projekt sinu Cursori koodi kasutab.
