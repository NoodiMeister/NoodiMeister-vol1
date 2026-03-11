# Sign in with Apple – seadistus

Apple nupp on nüüd aktiivne, kui `.env` sisaldab `VITE_APPLE_CLIENT_ID` ja `VITE_APPLE_REDIRECT_URI`. Voo käigus laetakse Apple’i JS SDK, avatakse popup ja pärast edukat sisselogimist salvestatakse kasutaja samasse salvestusse nagu Google/Microsoft puhul.

## Oluline: vajalik on Apple Developer Program

Kui näed teadet **„Access Unavailable – This resource is only for developers enrolled in a developer program…”**, siis:

- **Certificates, Identifiers & Profiles** (ja seega Sign in with Apple veebile) on ligipääsetav ainult **Apple Developer Programi** liikmetele.
- Programmi aastane tasu on umbes **99 USD**.  
  [Registreeru: developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)
- Pead sisse logima **selle Apple ID-ga**, mis on programmiga liitunud (või oled organisatsiooni meeskonnaliige, kellel on juurdepääs).

Kui praegu programmiga ei liitu, jäta Apple nupp välja (ära lisa `VITE_APPLE_CLIENT_ID` / `VITE_APPLE_REDIRECT_URI`) ja kasuta sisselogimiseks Google'i, Microsofti või e-maili/parooli.

---

## Kust leida App ID (ja kuidas luua)

**„App ID“ ei ole eraldi menüüpunkt.** Apple’i lehe kujundus võib erineda (mõnikord pole vasakpoolset menüüd). Kasuta otse linki:

1. **Mine otse siia (peale sisselogimist):**  
   **[developer.apple.com/account/resources](https://developer.apple.com/account/resources)**  
   See on leht „Certificates, Identifiers & Profiles“.

2. **Kust leida Identifiers:**  
   Kui näed **vasakpoolset menüüd** – klõpsa seal **Identifiers**.  
   Kui menüüd pole – otsi lehelt linki või vahekaarti nimega **Identifiers** (või **Certificates, Identifiers & Profiles** alamsektsioon). Mõnel kujundusel on üleval vahekaardid või rippmenüü.

3. **Uue ID loomine:**  
   Klõpsa **+** nuppu (tavaliselt üleval vasakul või Identifiers lehe peal).
4. Vali **App IDs** (mitte Services IDs ega Keys) ja klõpsa **Continue**.
5. Sisesta **Description** (nt „NoodiMeister“) ja **Bundle ID** (nt `ee.noodimeister.app`). Vali **Explicit App ID**.
6. Lülita võimaluste hulgast sisse **Sign in with Apple**, klõpsa **Continue** ja seejärel **Register**.

Nüüd on sul App ID. Seda vajatakse järgmise sammu jaoks (Services ID peab viitama sellele App ID-le).

---

## Sammud

1. **Apple Developer konto (programmiga liitunud)**  
   [developer.apple.com](https://developer.apple.com) – sisselogimine kontoga, mis on **Apple Developer Programis** (vt ülal).

2. **App ID (Sign in with Apple)**  
   Vt ülal jaotist „Kust leida App ID“. Loo uus App ID või vali olemasolev ja lülita sisse **Sign in with Apple**.

3. **Services ID (veebirakenduse jaoks)**  
   Identifiers → klõpsa **+** → vali **Services IDs** → **Continue**.  
   - **Description:** NoodiMeister Web  
   - **Identifier:** nt `ee.noodimeister.web` (see on sinu `VITE_APPLE_CLIENT_ID`)  
   - Loo ja klõpsa seejärel uue Services ID peal **Configure** (Sign in with Apple).  
   - Vali **Primary App ID** (see App ID, mille lõid ülal, peab olema Sign in with Apple’iga).  
   - **Domains and Subdomains:** sinu domeen ilma protokollita, nt `noodimeister.ee` või `noodi-meister-vol1-la-stravaganza.vercel.app`  
   - **Return URLs:** täielik URL (nt `https://noodimeister.ee` või `https://noodi-meister-vol1-la-stravaganza.vercel.app`). Peab olema kehtiv domeen (mitte `localhost`).  
   - Salvesta konfiguratsioon ja **Register**.

4. **.env**  
   Lisa (või kopeeri `.env.example`-ist):

   ```env
   VITE_APPLE_CLIENT_ID=ee.noodimeister.web
   VITE_APPLE_REDIRECT_URI=https://noodimeister.ee
   ```

   `VITE_APPLE_REDIRECT_URI` peab ühtima Services ID konfiguratsioonis sisestatud **Return URL**-iga.

5. **Kohalik testimine**  
   Apple ei luba `localhost` ega IP-a Return URL-ina. Võid kasutada:  
   - tunneli (nt ngrok) kohaliku dev serveri jaoks, või  
   - testimist otse toodangu-/preview-URL-il (nt Vercel).

## Voog rakenduses

- Kasutaja vajutab **Apple** nuppu (Logi sisse / Registreeru).
- Laetakse Apple’i skript, tehakse `AppleID.auth.init(… usePopup: true)` ja `AppleID.auth.signIn()`.
- Avaneb Apple’i popup; pärast sisselogimist tagastab Apple `user` (e-mail, võimalikult nimi) ja `id_token`.
- Rakendus salvestab `user = { email, name, provider: 'apple' }` salvestusse (`noodimeister-logged-in`, `noodimeister-users`) ja suunab `/tood`.

## Viited

- [Sign in with Apple JS (Apple Developer)](https://developer.apple.com/documentation/signinwithapplejs)
- [Configuring your webpage for Sign in with Apple](https://developer.apple.com/documentation/signinwithapplejs/configuring_your_webpage_for_sign_in_with_apple)
