# NoodiMeister: iPad / Android tablet brauseris

See dokument kirjeldab sisselogimise režiime, konto lehte ja notatsioonirakendust tabletirežiimis (iPad / Android tahvel brauseris) ning tuvastab võimalikud probleemid.

---

## 1. Sisselogimise režiimid tabletis

### 1.1 E-mail + parool (kohalik konto)

- **Kuidas töötab:** Kasutaja sisestab e-maili ja parooli lehel `/login`, võib valida "Jäta mind meelde" (localStorage vs sessionStorage).
- **Tabletil:** Töötab tavaliselt hästi. Vormi väljad ja nupud on suuremad (Tailwind `py-2`, `px-4`), sobivad puudega.
- **Võimalikud probleemid:**
  - **Privaatne režiim / kolmandate osapoolte küpsised blokeeritud:** Rakendus kontrollib `getStorageForLogin(stayLoggedIn)` ja kuvab selge veateate: "Brauser ei luba andmeid salvestada (nt privaatne režiim). Proovi teist brauserit või lülita privaatne režiim välja."
  - iPad Safari või Android Chrome privaatrežiimis võib localStorage/sessionStorage olla piiratud – siis sisselogimine võib "kinnitamine ebaõnnestus" viga anda.

### 1.2 Google (OAuth)

- **Kuidas töötab:** Nupp "Google" kasutab `@react-oauth/google` → `useGoogleLogin` koos `flow: 'implicit'`. Vaikimisi see **avab popup-akna** (Google sisselogimise leht).
- **Tabletil:** Popup võib olla problemaatiline:
  - iPad Safari võib popupi blokeerida või kuvada hüpikakna teisiti.
  - Android Chrome võib samuti popupi blokeerida või kasutaja ei näe hüpikakent.
  - Kui kasutaja sulgeb popupi, kuvatakse `popup_closed_by_user` – seda ei näidata kui tõrget (vaikimisi vaikiv).
- **Soovitus:** Tabletil oleks stabiilsem **redirect-põhine** Google OAuth (`flow: 'redirect'` või vastav konfiguratsioon), et terve leht suunatakse Google’i poole ja tagasi – nii ei sõltu popup’itest.

### 1.3 Microsoft (OneDrive / MSAL)

- **Kuidas töötab:** Kasutatakse **redirect-vood**: `loginRedirect()` suunab kasutaja Microsofti sisselogimise lehele; pärast sisselogimist tuleb tagasi sama päritolu URLile (nt `/login`), kus `MicrosoftRedirectHandler.jsx` töötleb `?code=` või `#code=` ja salvestab sessiooni, seejärel suunatakse `/tood`.
- **Tabletil:** Redirect töötab tavaliselt hästi, sest **popupi pole** – kogu leht liigub. Hash (#) võib mõnel brauseril/versioonil ära kärpida; koodis on juba kinnitus (`noodimeister-microsoft-hash-stripped`) ja kasutajale antakse juhis lubada hüpikaknad (kontekst: kui midagi suunab enne tagasi).

---

## 2. Konto leht (`/konto` – AccountPage)

### 2.1 Ülevaade ja paigutus

- **Route:** `/konto` (sisselogimata kasutaja suunatakse `/login`).
- **Layout:**  
  - Ülaosas header: logo, seaded (keel, teema, väljalogimine), lingid "Minu tööd" ja "Esileht".  
  - Peasisu: üks suur kaart (`account-card`), max-width `max-w-2xl`, keset lehte.

### 2.2 Sektsioonid ja funktsioonid

1. **Pealkiri / kasutaja info**  
   - Näidatakse kasutaja nimi ja e-mail, sisselogimise viis (Google / Microsoft / E-mail).

2. **Uus töö / Minu tööd**  
   - Nupud: "Uus töö" (link `/app?new=1`) ja "Minu tööd" (link `/tood`).

3. **Minu tööd (failid)**  
   - Kui Google ühendatud: Google Drive’i failide nimekiri (max-h-48, keritav).  
   - Kui Microsoft ühendatud: OneDrive’i failide nimekiri.  
   - Failide avamine: link `/app?fileId=...` või `/app?fileId=...&cloud=onedrive`.

4. **Kasutaja andmed**  
   - E-mail, nimi, sisselogimise viis; nupp "Logi välja".

5. **Kohalik fail**  
   - Lühike selgitus, et faili saab salvestada kohalikult.

6. **Google Drive**  
   - Kui ühendatud: salvestuskausta valik (vali olemasolev kaust või loo uus).  
   - **Google Picker:** `googleDrive.pickFolder()` kasutab Google Picker API-d – see **avab Google’i oma UI (tihti popup/overlay)**. Tabletil võib Picker käituda erinevalt (mõnel juhul blokeeritakse või UI ei kuvu korralikult).

7. **OneDrive**  
   - Kui ühendatud: salvestuskausta valik.  
   - **OneDrive kaustade valik:** Rakenduse **sisemine modal** (mitte brauseri popup) – kaustade sirvamine on lehel endal (`oneDrivePickerOpen`), keritav nimekiri. Tabletil töötab see tavaliselt hästi.

### 2.3 Seaded (dropdown)

- **Keel:** ET / EN (ja teised `LOCALES`).  
- **Teema:** Hele / Tume.  
- **Logi välja.**  
- Dropdown on `absolute right-0 top-full`, `z-50` – väikese ekraaniga võib nupp "Seaded" ja dropdown olla tihedalt; tavaliselt jääb tabletile nähtavale.

### 2.4 Modals (tabletil)

- **OneDrive kaustade valik:** `max-h-[80vh]`, `overflow-y-auto` – sobib tabletile.  
- **Kausta ümbernimetamine:** Väike modal `max-w-sm` – sobib.

---

## 3. Notatsioonirakendus (NoodiMeister) tabletis

### 3.1 Üldine

- **Viewport:** `index.html` sisaldab `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` ja `apple-mobile-web-app-capable` / `mobile-web-app-capable` – sobib mobiilile ja tabletile.
- **Touch:**  
  - `index.css`: `touch-action: manipulation` (vähendab viivitust), `.main-score-area`: `-webkit-overflow-scrolling: touch` (siledam kerimine iOS-il).  
  - Noodijoonestikul: noodi lisamine puudega – `clientY` võetakse `e.clientY ?? e.changedTouches?.[0]?.clientY ?? e.touches?.[0]?.clientY`; `e.pointerType === 'touch' || e.pointerType === 'pen'` puhul kutsutakse `preventDefault()` (vältimaks kerimist klõpsu ajal). Seega **noodi sisestamine sõrmevajutusega** on toetatud.

### 3.2 Hand-tööriist (pan / lohistamine)

- **Praegu:** Hand-režiimis lohistamine kasutab **ainult hiire sündmusi** (`mousedown` → `document.addEventListener('mousemove', ...)` ja `mouseup`).  
- **Tabletil:** Paljud brauserid emuleerivad touch’ist mouse sündmusi (hilinenult). Seega lohistamine võib töötada, kuid võib olla ebaturvaline või aeglane. **Soovitus:** lisada touch-käsitlejad (`touchstart` / `touchmove` / `touchend`) hand-pan’i jaoks, et kerimine oleks tabletil sujuv.

### 3.3 Kursorivahetus (Select / Hand / Type)

- Režiimide vahetus on nuppudega – tabletil töötab. Kontekstimenüü (paremklõps) võib tabletis puududa või olla "long press"; koodis on `onContextMenu` – võib vajada long-press või alternatiivi tabletile.

### 3.4 Tööriistaribad ja paneelid

- Ribad kasutavad Tailwind’i (flex, wrap, padding). Väikese laiusega võib riba mitu rida võtta – see on oodatav.  
- Vasak poolne sidebar (`w-72`) võib tabletil võtta palju ruumi; võimalik, et tulevikus võetakse kasutusele kokkupandav menüü väikese ekraani jaoks.

### 3.5 Kerimine

- Põhisisu: `overflow-auto` või `overflow-x-auto overflow-y-hidden` (horisontaalse lehevoo puhul).  
- `main-score-area` on keritav; touch-kerimine toetatakse CSS-iga (`-webkit-overflow-scrolling: touch`).

### 3.6 Fokus ja klaviatuur

- Mõned toimingud (nt sõnade sisestus) kasutavad `lyricInputRef.current?.focus()`. Tabletil vituaalne klaviatuur võib tulla üles ja võtta ruumi – see on tavapärane käitumine.

---

## 4. Mis võib tabletis kokku jooksutada või mitte lasta töötada?

| Probleem | Põhjus | Soovitus |
|----------|--------|----------|
| **Google sisselogimine ebaõnnestub või popup sulgub** | Google OAuth kasutab popupi (`flow: 'implicit'`). Tabletil popup blokeeritakse või käitumine erineb. | Võtta kasutusele redirect-põhine Google sisselogimine (nt `flow: 'redirect'` või vastav teek), et tabletil ei oleks popupi vaja. |
| **Google Drive “Vali salvestuskaust” ei ava / ei tööta** | Google Picker avab oma akna (popup/iframe). Tabletil võib see blokeeritud olla või UI katki. | Testida tabletbrauseris; vajadusel pakkuda alternatiivi (nt “Loo uus kaust” ilma Pickerita või selge juhis popupi lubamiseks). |
| **Microsoft sisselogimine – hash kaob** | Mõnel brauseril redirect tagasi võib # fragmenti ära kärpida. | Koodis on juba käsitlus; kasutajale antakse vihje lubada hüpikaknad ja proovida uuesti. |
| **Privaatne režiim – “Salvestamine ebaõnnestus”** | localStorage/sessionStorage on privaatrežiimis piiratud. | Juba kuvatakse selge sõnum – soovitada tavarežiimi või teist brauserit. |
| **Hand-tööriist (lohistamine) aeglane või ei reageeri** | Pan kasutab ainult mouse sündmusi. | Lisada touch-käsitlejad hand-pan’i jaoks (`touchstart`/`touchmove`/`touchend`). |
| **Paremklõps / kontekstimenüü** | Tabletil paremklõps puudub. | Long-press või eraldi nupp “Kleebi” jms. võib olla vajalik. |
| **Väike ekraan – sidebar + tööriistariba** | `w-72` sidebar võtab ruumi. | Võimalik tulevikus hamburger-menüü või kokkupandav sidebar. |
| **Vituaalne klaviatuur katab sisu** | Fokus input-väljale tõstab klaviaturi. | Tavapärane; võib scrollida sisu nähtavale või kohandada layouti. |

---

## 5. Kokkuvõte

- **Sisselogimine:** E-mail/parool ja **Microsoft** töötavad tabletil hästi (Microsoft kasutab redirect’i). **Google** sõltub popup’ist – tabletis võib viga tekkida; soovitatav on redirect-põhine Google OAuth.
- **Konto leht:** Layout ja modals on tabletis kasutatavad; OneDrive kaustade valik on rakendusesiseselt, Google Picker võib tabletis olla tundlik.
- **Notatsioon:** Puudetugi noodi lisamiseks on olemas; kerimine on touch-sõbralik. Hand-pan võiks saada otsese touch-toe, et tabletil oleks stabiilsem.

Kõik viited pärinevad praegusest koodist (login, konto, notatsioon, touch, hand-pan, OAuth).
