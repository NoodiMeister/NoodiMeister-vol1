# OneDrive: registreerimine, logimine ja salvestamine – juhend

## Kuidas praegu nupud töötavad

| Nupp      | Taga olev „mootor“ |
|-----------|--------------------|
| **Google** | Täielik: OAuth (Client ID), token localStorage’is, Drive API (failid, kaustad, Picker). Registreerimine/logimine ja pilve salvestamine töötavad. |
| **Microsoft** | Ainult UI: klõps avab `alert('Microsofti sisselogimine tuleb tulevikus...')`. OAuth, tokenit ega OneDrive API-d pole. |
| **Apple** | Sama: ainult `alert('Apple sisselogimine tuleb tulevikus...')`. Tegelikku Sign in with Apple ega iCloud API-d pole. |

Seega **ainult Google’il on „mootor“** – Microsoft ja Apple on placeholder’id. OneDrive’i jaoks tuleb luua sarnane ahel: Azure rakendus → sisselogimine (Microsoft identity) → token → OneDrive API (failid/kaustad).

---

## Mida OneDrive’i jaoks vaja on (ülevaade)

1. **Azure’is** rakenduse registreerimine (nagu Google Cloud’is OAuth client).
2. **Rakenduses** Microsofti sisselogimine (MSAL.js või sarnane) → access token.
3. **Tokeni salvestamine** (nt `noodimeister-microsoft-token`) ja aegumise kontroll.
4. **OneDrive API** kasutamine: kausta loomine, faili üleslaadimine, faili lugemine (sarnane Google Drive’iga).
5. **UI** ühendamine: Microsoft nupp teeb tõelise sisselogimise; salvestamise dialoogis võimalus „Salvesta OneDrive’i“.

---

## Samm 1: Azure rakenduse registreerimine

1. Mine [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** (või **Azure Active Directory**) → **App registrations** → **New registration**.
2. **Name:** nt `NoodiMeister`.  
   **Supported account types:** „Accounts in any organizational directory and personal Microsoft accounts“.  
   **Redirect URI:** vali **Single-page application (SPA)** ja lisa:
   - `http://localhost:5173`
   - `https://noodi-meister-vol1-la-stravaganza.vercel.app`
3. **Register** → kopeeri **Application (client) ID** ja **Directory (tenant) ID** (vajalikud koodis).

**Luba (scope) OneDrive’i jaoks:**

4. **App registrations** → sinu rakendus → **API permissions** → **Add a permission**.
5. **Microsoft Graph** → **Delegated permissions**. Lisa:
   - `User.Read` (profiil, sisselogimine)
   - `Files.ReadWrite` või `Files.ReadWrite.AppFolder` (OneDrive failid)
   - `offline_access` (refresh token, valikuline)
6. **Grant admin consent** (kui on organisatsiooni konto).

**Testija-nimekiri (valikuline):** keskkonnamuutuja `VITE_MICROSOFT_TESTER_EMAILS` (komaga eraldatud e-mailid). Kui see on **tühi**, saavad **kõik** Microsofti kontod sisse logida. Kui täidad (nt `raido.lill@paikesekool.parnu.ee`), saavad ainult need e-mailid lõpuni – kasulik enne avalikku avaldamist. **Avaldamiseks igaühele:** jäta `VITE_MICROSOFT_TESTER_EMAILS` tühjaks nii kohalikus `.env` kui Vercel / tootmise keskkonnamuutujates.

**Salavõti (client secret) SPA puhul tavaliselt ei kasutata** – brauseris kasutatakse PKCE flow’d ilma salavõtata. Veendu, et **Authentication** → **Platform configurations** → SPA redirect URI’d on täpselt need, mida rakendus kasutab.

---

**Kui Microsofti sisselogimine ei vii kuhugi või suunab alati /login lehele:** Azure → App registrations → NoodiMeister → Authentication. **Redirect URI (SPA)** peab olema **rakenduse juur**, mitte /login: lisa mõlemad `https://www.noodimeister.ee/` ja `https://www.noodimeister.ee/login` (ja soovi korral `http://localhost:5173/`, `http://localhost:5173/login`). Kui Azure’s on `.../login`, eemalda see ja lisa ainult juur-URL. Pärast sisselogimist kuvatakse vea korral soovitatav URI – kopeeri see Azure'i.

## Samm 2: Rakenduse koodis – paketid ja keskkond

- Installi Microsofti autentimise teek brauseri jaoks, nt:
  ```bash
  npm install @azure/msal-browser
  ```
- Keskkonnamuutujad (nt `.env`):
  - `VITE_AZURE_CLIENT_ID` – Application (client) ID
  - `VITE_AZURE_TENANT_ID` – tavaliselt `common` (kõik kontod) või Directory (tenant) ID

---

## Samm 3: Sisselogimise „mootor“ (MSAL)

1. **Konfiguratsioon:** loo `MsalProvider` või ühekordne `PublicClientApplication` koos `clientId`, `authority` (nt `https://login.microsoftonline.com/common`), `redirectUri`.
2. **Logi sisse:** kasuta `loginPopup` või `loginRedirect` soovitud scope’idega (`User.Read`, `Files.ReadWrite`).
3. **Pärast edukat sisselogimist:**
   - võta `accessToken` (ja soovitud korral `account` profiili jaoks);
   - salvesta token localStorage’i (nt `noodimeister-microsoft-token`, `noodimeister-microsoft-token-expiry`);
   - salvesta kasutaja info (e-mail, nimi) nagu Google puhul, nt `noodimeister-logged-in` koos `provider: 'microsoft'`;
   - registreerimise režiimis lisa kasutaja `noodimeister-users` nimekirja.
4. **Microsoft nupu juures:** kutsu välja see sisselogimise loogika (ära kasuta enam `alert`).

Nii saad **registreerimise ja logimise** OneDrive’i (Microsofti kontoga) jaoks tööle.

---

## Samm 4: OneDrive API – salvestamine ja laadimine

OneDrive kasutab **Microsoft Graph API**:

- **Profiil:** `GET https://graph.microsoft.com/v1.0/me`
- **Failid / kaustad:** `GET/POST https://graph.microsoft.com/v1.0/me/drive/root/children` (loetelu), `POST .../me/drive/root/children` (loo kaust või fail), `GET .../me/drive/items/{id}/content` (lae fail alla).

Loogika võib sarnaneda `googleDrive.js`-iga:

- **createFolder(accessToken, parentId, folderName)** – `POST /me/drive/items/{parentId}/children` kehaga `{ name: folderName, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }`.
- **createFileInFolder(accessToken, folderId, fileName, content)** – `PUT /me/drive/items/{folderId}:/{fileName}:/content` või vastav endpoint, body = faili sisu (JSON string).
- **pickFolder / pickFile** – Graph’il on **file picker** (JavaScript SDK) või saad käsitsi loetelda kaustu ja lasta kasutajal valida; võid ka esimese versioonina pakkuda „loo uus kaust” + „salvesta siia“, nagu Google puhul.

Token tuleb igal päringul päisesse: `Authorization: Bearer ${accessToken}`.

---

## Samm 5: UI ühendamine

- **Login/Registreeru lehel:** Microsoft nupp → MSAL sisselogimine → token ja kasutaja salvestatakse → suunamine `/app`.
- **Tööriistas (salvestamine):**  
  - laienda salvestamise dialoogi (nagu Google puhul): valik „Salvesta Google Drivesse“ vs **„Salvesta OneDrive’i“**;  
  - kui valitud OneDrive: kas „Vali olemasolev kaust“ (Graph API kaustade loetelu + valik) või „Loo uus kaust“ (createFolder) ja salvesta sinna fail (createFileInFolder).
- **Laadimine:** „Laadi pilvest“ võib pakkuda valikut „Google Drive“ vs „OneDrive“ ja OneDrive puhul kasutada Graph API failide loetelu + faili sisu allalaadimist.

---

## Kokkuvõte

- **Praegu:** Google’il on ainus täielik mootor (OAuth, token, Drive API, UI). Microsoft ja Apple nupud on placeholder’id (ainult alert).
- **OneDrive’i lisamiseks:** Azure app registration → MSAL sisselogimine (registreerimine + logimine) → token → Microsoft Graph API (OneDrive: kaustad, failid) → sama salvestamise/laadimise loogika UI-s nagu Google puhul.

Kui soovid, võime järgmise sammuna välja töötada konkreetse koodi (MSAL konfiguratsioon, üks `oneDrive.js` teenus ja CloudLogin.jsx Microsoft nupu ühendamine).
