# Google sisselogimine ja Drive’i seadistus

NoodiMeister toetab:
- **Google’iga sisselogimist** (Login ja Registreeru lehel)
- **Google’iga registreerimist** (uus konto luuakse automaatselt, kui valid „Registreeru” lehel nupu „Google”)
- **Projektide salvestamist Google Drivesse** ja sealt laadimist (tööriistariba nupud „Pilve salvesta” ja „Laadi pilvest”)

Kõik need nõuavad Google Cloud projekti ja OAuth 2.0 kliendi ID-d.

---

## Kiire parandus: „Access blocked“ / „Error 400: redirect_uri_mismatch“

Kui näed **„This app's request is invalid“** või **„Error 400: redirect_uri_mismatch“**:

1. **Vaata brauseri aadressiribalt**, kust proovid sisse logida (nt `https://noodi-meister-vol1-la-stravaganza.vercel.app`).
2. **Päritolu** = ainult protokoll + domeen, ilma teekonnata. Näide: `https://noodi-meister-vol1-la-stravaganza.vercel.app`
3. Mine **[Google Cloud Console](https://console.cloud.google.com/)** → **APIs & Services** → **Credentials**.
4. Klõpsa oma **OAuth 2.0 Client ID** (Web application) peal.
5. **Authorized JavaScript origins** – lisa rida täpse päritoluga. Kui kasutad teisi domeene, lisa need samuti.
6. **Authorized redirect URIs** – lisa **sama** päritolu (üks rida iga domeeni kohta). See on sageli puudu – redirect URIs peab olema täpselt see aadress, kust sisselogimist tehakse.
7. Klõpsa **Save**. Oota 1–2 minutit ja proovi uuesti.

Kui rakendus töötab teisel domeenil, lisa see domeen mõlemasse välja (origins ja redirect URIs).

---

## Samm-sammult

### 1. Google Cloud projekt

1. Mine aadressile: [Google Cloud Console](https://console.cloud.google.com/)
2. Vali olemasolev projekt või **Create Project** → anna nime (nt „NoodiMeister”) → **Create**

### 2. Luba vajalikud API-d

Projektis peavad olema lubatud:

- **Google Drive API** – failide lugemine ja kirjutamine  
  - [Luba Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) → **Enable**
- **Google Picker API** – faili/kausta valimise dialoog  
  - [Luba Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com) → **Enable**

### 3. OAuth 2.0 kliendi ID (Web application)

1. Menüüst: **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. Kui küsitakse, seadista **OAuth consent screen**:
   - User Type: **External** (või Internal, kui see on tööorganisatsiooni konto)
   - Täida vähemalt **App name** (nt „NoodiMeister”) ja **User support email**
   - **Save and Continue** kuni lõpuni
4. Tagasi **Credentials** lehel: **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: nt „NoodiMeister Web”
   - **Authorized JavaScript origins** – lisa **iga** domeen (kui Vercelil on kaks, lisa mõlemad):
     - `http://127.0.0.1:5197` (kohalik arendus – Vite `vite.config.js` fikseeritud port)
     - `http://localhost:5197` (kui brauser/konsool nõuab localhost varianti)
     - `https://noodi-meister-vol1-la-stravaganza.vercel.app`
     - `https://www.noodimeister.ee`
   - **Authorized redirect URIs** – lisa **samad** read. Kui üks domeen puudub, Google sisselogimine ebaõnnestub sellel domeenil (Error 400: redirect_uri_mismatch).
5. **Create** → kopeeri **Client ID** (kujul `xxxxx.apps.googleusercontent.com`)

### 4. Keskkonnamuutuja projektis

1. Projekti juurkaustas kopeeri näidisfail:  
   `cp .env.example .env`
2. Ava `.env` ja lisa (asenda oma Client ID-ga):  
   `VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com`
3. **Vercel/Netlify:** lisa sama väärtus keskkonnamuutujana **Environment variables** (nt `VITE_GOOGLE_CLIENT_ID`).

### 5. Taaskäivita ja testi

- Kohalikult: `npm run dev` → `http://127.0.0.1:5197` (vaikimisi avaneb `/demo-intro`). Google Console’is lisa päritolud vastavalt sellele, mida brauseris kasutad.
- **Registreeru** või **Logi sisse** → vali nupp **Google** → kinnita sisselogimine ja lubadused (sh Drive)
- Pärast sisselogimist mine **Tööriist** (/app) → kasuta **Pilve salvesta** (vali kaust Drivest) ja **Laadi pilvest** (vali fail)

---

## Kuidas see rakenduses töötab

| Funktsioon | Kus | Mida teeb |
|------------|-----|-----------|
| Google’iga registreerimine | `/registreeru` → nupp „Google” | Loob kohaliku „konto” (e-mail + nimi) ja salvestab Google access tokeni Drive’i jaoks |
| Google’iga sisselogimine | `/login` → nupp „Google” | Logib sisse, salvestab tokeni; kui kasutajat polnud, käitub nagu registreerimine |
| Pilve salvesta | /app tööriistariba „Pilve salvesta” | Küsib kausta (Picker), loob Drivesse faili `.noodimeister` |
| Laadi pilvest | /app tööriistariba „Laadi pilvest” | Küsib faili (Picker), laeb sisu ja täidab projekti |

Token kehtib umbes 1 tundi; pärast aegumist tuleb uuesti **Logi sisse** → **Google** teha.

---

## Kui tuleb „Need admin approval“ (kooli / organisatsiooni konto)

Kui sisselogimine toimub **organisatsiooni** e-mailiga (nt @kool.ee, @ettevote.ee) ja teade ütleb, et **NoodiMeister needs permission that only an admin can grant**:

- Põhjus: Google Workspace’i organisatsioonides peab **administraator** lubama kinnitamata (unverified) rakendused.
- Lahendus: **Organisatsiooni Google’i administraator** peab Admin Console’is lubama NoodiMeisteri (kolmanda osapoole rakenduste juurdepääsu seaded). Täpsed sammud: [GOOGLE-ORGANISATSIOON-ADMIN.md](./GOOGLE-ORGANISATSIOON-ADMIN.md).

---

## Kui tuleb „Error 400: redirect_uri_mismatch“

1. Vaata veateatest või brauseri aadressiribalt **päritolu** (nt `https://noodi-meister-vol1-c7ms0vldp-la-stravaganza.vercel.app`).
2. **Kui see on preview-URL** (sisaldab juhuslikku osa nagu `c7ms0vldp`): **ära lisa seda**. Ava hoopis **toodangu aadress** – **https://www.noodimeister.ee** või **https://noodi-meister-vol1-la-stravaganza.vercel.app** – ja logi sisse sealt. Need kaks peavad olema Google Console’is lisatud.
3. Google Cloud Console → **Credentials** → OAuth 2.0 Client ID. Lisa **Authorized JavaScript origins** ja **Authorized redirect URIs** sektsioonidesse: `https://www.noodimeister.ee` ja `https://noodi-meister-vol1-la-stravaganza.vercel.app`.
4. **Save** → oota mõni minut → proovi uuesti **www.noodimeister.ee** aadressil.

---

## Faili ikoon kasutaja Drive’is (drive.google.com)

Kui kasutaja avab oma Google Drive’i otse (mitte noodimeister.ee kaudu), siis NoodiMeisteri **logo ei ilmu** failide kõrvale automaatselt. Rakendus salvestab failid MIME-tüübiga `application/vnd.noodimeister+json`, et Drive tuvastaks need NoodiMeisteri projektidena („Ava koos“ võib pakkuda meie rakendust).

Et **NoodiMeisteri logo** kuvataks Drive’i failinimekirjas, tuleks rakendus avalikult registreerida (nt Google Workspace Marketplace) ja seadistada Drive’i integreerimine koos rakenduse ikooniga. See on eraldi samm ja nõuab Google’i kinnitust.
