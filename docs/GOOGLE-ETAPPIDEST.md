# Google: registreerimine, sisselogimine, salvestamine ja laadimine – etapiti

Järgnevalt sammud, et NoodiMeisteris töötaks:
- **Google’iga registreerimine** (nupp „Google” lehel Registreeru)
- **Google’iga sisselogimine** (nupp „Google” lehel Logi sisse)
- **Projekti salvestamine Google Drivesse** (nupp „Pilve salvesta” tööriistas)
- **Projekti laadimine Google Drivest** (nupp „Laadi pilvest” tööriistas)

---

## Etapp 1: Google Cloud projekt

1. Ava [Google Cloud Console](https://console.cloud.google.com/).
2. Üleval vali projekt või klõpsa **Select a project** → **New Project**.
3. Sisesta projekti nimi (nt **NoodiMeister**) → **Create**.

---

## Etapp 2: API-de lubamine

1. Vasakult menüüst: **APIs & Services** → **Library** (või [Library](https://console.cloud.google.com/apis/library)).
2. Otsi **Google Drive API**:
   - Klõpsa **Google Drive API** → **Enable**.
3. Mine tagasi **Library** juurde ja otsi **Google Picker API**:
   - Klõpsa **Google Picker API** → **Enable**.

---

## Etapp 3: OAuth consent screen (üks kord)

1. **APIs & Services** → **OAuth consent screen**.
2. Kui küsitakse **User type**: vali **External** (või **Internal**, kui ainult oma organisatsioon).
3. **Create** (või **App registration**).
4. Täida vähemalt:
   - **App name:** NoodiMeister  
   - **User support email:** sinu e-mail
5. **Save and Continue** → järgmine leht → **Save and Continue** kuni lõpuni (Test users võid vahele jätta).

---

## Etapp 4: OAuth 2.0 Client ID (Web application)

1. **APIs & Services** → **Credentials**.
2. **+ Create Credentials** → vali **OAuth client ID**.
3. Kui küsitakse **Which API are you using?** – vali **Google Drive API**.
4. Kui küsitakse **Data preference** – vali **User data** (mitte Public data).
5. **Application type:** jäta või vali **Web application**.
6. **Name:** nt `NoodiMeister Web`.
7. **Authorized JavaScript origins** – lisa **täpselt** need aadressid, kust rakendus töötab (protokoll + domeen + port, **ilma** teekonnata nagu `/registreeru`):
   - `http://127.0.0.1:5197` (kohalik arendus)
   - **Iga toodangu domeen eraldi:** nt `https://noodi-meister-vol1-la-stravaganza.vercel.app` ja `https://www.noodimeister.ee` (kui Vercelil on mitu domeeni, lisa **mõlemad**).
8. **Authorized redirect URIs** – **peab** sisaldama **sama** päritolu. Lisa **iga** domeen, mida kasutad:
   - `http://127.0.0.1:5197`
   - `https://noodi-meister-vol1-la-stravaganza.vercel.app`
   - `https://www.noodimeister.ee`
   Kui kasutad kahte (või enamat) domeeni, aga Google Console’is on ainult üks, siis **teisel domeenil** Google sisselogimine ebaõnnestub (Error 400: redirect_uri_mismatch). Lisa alati **kõik** rakenduse domeenid.
9. Kui küsitakse **Your API key** – jäta tühjaks või vali **Skip**, kui see on valikuline. NoodiMeister ei vaja API key’t.
10. **Create**.
11. Kopeeri **Client ID** (kujul `xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`) – seda vajad järgmises etapis.

---

## Etapp 5: Client ID rakendusse

1. Ava projekti kaust (Noodimeister) terminalis.
2. Kui faili `.env` veel pole, kopeeri näidis:
   ```bash
   cp .env.example .env
   ```
3. Ava fail `.env` (Notepad, VS Code jms).
4. Leia rida `VITE_GOOGLE_CLIENT_ID=` ja lisa pärast võrdusmärki kopeeritud Client ID (tühikuid ära):
   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
   ```
5. Salvesta fail.

**Kui deploy’d Vercelil/Netlifyl:**  
Projekti **Settings** → **Environment Variables** → lisa muutuja **VITE_GOOGLE_CLIENT_ID** väärtusega sama Client ID.

---

## Etapp 6: Käivita ja testi

1. Terminalis projekti kaustas:
   ```bash
   npm run dev
   ```
2. Ava brauseris: `http://127.0.0.1:5197` (demo intro: `/demo-intro`).
3. **Registreerimine:** klõpsa **Registreeru** → **Google** → logi Google kontoga sisse ja anna lubadused (sh Drive). Peaks suunama tööriista (/app).
4. **Sisselogimine:** logi välja, mine **Logi sisse** → **Google** → peaks uuesti sisse logima ja suunama /app.
5. **Salvestamine Drivesse:** tööriistas klõpsa **Pilve salvesta** → vali kaust Google Drivest → projekt salvestatakse failina `.noodimeister`.
6. **Laadimine Drivest:** klõpsa **Laadi pilvest** → vali varem salvestatud fail → projekt laeb tööriista.

Kui mõni samm ebaõnnestub, kontrolli, et Drive API ja Picker API on lubatud ning et `.env` sisaldab õiget `VITE_GOOGLE_CLIENT_ID` (ilma tühikuteta).

---

## Tõrge: „Error 400: redirect_uri_mismatch“ / „This app's request is invalid“

See viga tähendab, et Google ei tunne ära rakenduse aadressi. **Lahendus:**

1. Ava rakendus brauseris (kohalikult või toodangus) ja vaata **aadressiribalt** täielik aadress (nt `https://noodimeister-abc123.vercel.app/registreeru`).
2. **Päritolu** = protokoll + domeen + port, **ilma** teekonnata. Näide: `https://noodimeister-abc123.vercel.app` (mitte `/registreeru` ega `/login`).
3. Mine [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
4. Klõpsa oma **OAuth 2.0 Client ID** (Web application) peal.
5. Kontrolli:
   - **Authorized JavaScript origins** – peab olema täpne päritolu, nt `https://noodimeister-abc123.vercel.app`. Lisa see, kui puudub.
   - **Authorized redirect URIs** – peab olema **sama** päritolu (üks rida), nt `https://noodimeister-abc123.vercel.app`. **Lisa see kindlasti**, kui see puudub – paljud vead tulevad sealt, et redirect URIs on tühi või vale.
6. Klõpsa **Save**. OAuth muudatused võivad võtta mõne minuti.
7. Proovi uuesti registreeruda / sisse logida.

**Kui sul on Vercelil kaks (või rohkem) domeeni** (nt `noodi-meister-vol1-la-stravaganza.vercel.app` ja `www.noodimeister.ee`): lisa **mõlemad** nii **Authorized JavaScript origins** kui **Authorized redirect URIs**. Iga domeen üks rida. Vastasel juhul töötab Google sisselogimine ainult sellel domeenil, mis on lisatud.

**Preview-deploy aadress (nt `noodi-meister-vol1-c7ms0vldp-la-stravaganza.vercel.app`):** see on **iga deploy’i** jaoks erinev. Google’iga sisselogimiseks kasuta **toodangu aadressi** – **www.noodimeister.ee** või **https://noodi-meister-vol1-la-stravaganza.vercel.app**. Neid kahte lisa Google Console’i; preview-URL’e lisama ei pea (need muutuvad iga kord).

---

## Kiire võrdlustabel

| Etapp | Kus | Mida teed |
|-------|-----|-----------|
| 1 | Cloud Console | Lood/valid projekti |
| 2 | APIs & Services → Library | Luba Drive API ja Picker API |
| 3 | OAuth consent screen | App name, e-mail, Save and Continue |
| 4 | Credentials → OAuth client ID | Web application, origins (localhost + toodang), kopeeri Client ID |
| 5 | Projekti .env | VITE_GOOGLE_CLIENT_ID=... |
| 6 | npm run dev, brauser | Testi Registreeru / Logi sisse / Pilve salvesta / Laadi pilvest |

Token kehtib umbes 1 tundi; pärast aegumist tuleb uuesti **Logi sisse** → **Google** teha.

---

## Tõrge: salvestatud fail läks tühjaks

Kui oled faili Google Drivesse salvestanud (sh olemasoleva faili üle kirjutanud) ja hiljem fail on tühi või sisu kadunud:

1. **Rakenduse kaitse:** NoodiMeister ei salvesta enam tühja ega vigast sisu Drive'i – kui projektisisu puudub või noodiread (staves) on tühjad, kuvatakse teade „Projektisisu puudub või on vigane – salvestamine peatatud“ ja API-kutset ei tehta.
2. **Google Drive töölaua sünk (Drive for Desktop):** Kui su **projekti- või töökaust** asub Google Drive'i sünkroonitavas kaustas (nt „Minu draiv“ / „My Drive“) ja teed seal ka git commit/push, võib Drive sünk üle kirjutada faile vanema versiooniga. Soovitus: **ära hoia NoodiMeisteri projekti faile (.nm) ega olulist tööd ainult Drive'i sünkroonitavas kaustas koos giti repoga** – kasuta Drive'i pigem brauseris (noodimeister.ee → Pilve salvesta) või hoida repot väljaspool Drive'i sünkroonitavat kausta.
3. **Taastamine:** Kui fail juba läks tühjaks, vaata Drive'is **Versioonide ajalugu** (paremklõps failil → „Manage versions“ / „Halda versioone“) – sealt saad võimalikult vana versiooni taastada.
