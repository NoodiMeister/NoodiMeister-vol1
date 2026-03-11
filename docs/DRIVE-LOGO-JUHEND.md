# Kuidas teha NoodiMeisteri failid Drive’is logoga ära tuvastatavaks

Et kasutaja näeks oma **Google Drive’i** vaates (drive.google.com) NoodiMeisteri failide kõrval **logo ikooni**, tuleb rakendus seostada Drive’iga ja avalikult avaldada. Allpool on vajalikud sammud.

---

## Oluline eeldus

Drive ei garanteeri, et **iga** failinimekirja rea juures kuvatakse teie rakenduse ikoon. Ikoon võib ilmuda eriti siis, kui:

- rakendus on avaldatud Google Workspace Marketplace’is (või mõnes muus avalikus kohas), ja
- Drive peab teie rakendust selle failitüübi (MIME type) „põhiloovaks“ või „põhilugevaks“.

Seega on vaja kogu teekond läbi teha; pärast seda hakatakse ikooni tavaliselt näitama (võib võtta aega kuni mõni päev).

---

## Samm 1: Drive UI integreerimise seadistamine (Google Cloud)

1. Logi sisse: [Google Cloud Console](https://console.cloud.google.com/).
2. Vali oma projekt (NoodiMeister).
3. Menüüst: **APIs & Services** → **Enabled APIs & services**.
4. Klõpsa **Google Drive API** real (mitte „Enabled APIs“ lehe pealkiri).
5. Otsi sealt link või vahekaart nimega **Drive UI integration** / **Drive integration** või sarnane.  
   Kui seda ei näe, proovi: **APIs & Services** → **Google Workspace Marketplace SDK** (või **Drive API** konfiguratsioonileht).
6. **Drive UI integration** konfiguratsioonis:
   - **Application icon(s)** – laadi üles NoodiMeisteri logo (PNG, läbipaistev taust). Soovitatav suurus **32×32 px** (dokumendi ikoon failinimekirjas). Võid lisada ka suurema (nt 128×128) rakenduse menüüde jaoks.
   - **Open URL** – aadress, kuhu Drive suunab faili avamisel. Näide:  
     `https://www.noodimeister.ee/app`  
     Drive lisab automaatselt päringuparameetri `state`, kus on faili ID jms. Rakendus peab selle vastu võtma ja faili avama (vt allpool „state parameeter“).
   - **Default MIME types** – lisa: `application/vnd.noodimeister+json`
   - **Default file extensions** – lisa: `noodimeister`
7. (Soovituslik) **Creating files** – märgi ära, kui tahad, et Drive’i nupust „Uus“ saaks luua NoodiMeisteri projekti. **New URL** võiks olla nt `https://www.noodimeister.ee/app` või `/tood`.
8. Salvesta (**Submit** / **Save**).

Domeeni **www.noodimeister.ee** (ja kasutatud alamateekondade) **omandiõigust** tuleb Google’ile tõestada (nt [Google Search Console](https://search.google.com/search-console) – lisa domeen ja kinnita).

---

## Samm 2: OAuth scope „drive.install“

Et rakendus ilmuks Drive’i menüüs „Ava koos“ ja seostuks failitüübiga, peavad kasutajad andma ka **drive.install** scope’i.

- OAuth päringus (sisselogimine Google’iga) lisa scope:  
  `https://www.googleapis.com/auth/drive.install`
- See võimaldab Drive’il rakendust „paigaldatud“ rakenduste hulka arvata ja failide avamisel pakkuda.

Kui NoodiMeister kasutab juba Drive API’d, kontrolli, et consent screenil on see scope lisatud ja et sisselogimise voo käigus seda küsitakse (vajadusel lisa scope oma OAuth konfiguratsiooni).

---

## Samm 3: „Open URL“ ja state parameeter

Kui kasutaja valib Drive’is „Ava koos“ → NoodiMeister, saadab Drive brauseri suunamisega sinu **Open URL** aadressile ja lisab **state** parameetri (JSON, URL‑enkodeeritud). Näide:

- `https://www.noodimeister.ee/app?state=%7B%22ids%22%3A%5B%22FILE_ID%22%5D%2C%22action%22%3A%22open%22%7D`

Rakendus peab:

1. Võtma `state` päringuparameetri.
2. Dekodeerima (decodeURIComponent) ja parsima JSON.
3. Võtma välja `ids` (massiiv faili ID‑dest) ja vajadusel `resourceKeys`.
4. Suunama kasutaja tööriista avamisele koos selle `fileId`‑ga (nt `/app?fileId=FILE_ID`), et fail Drive’ist laetakse.

Ilma selle loogikata Drive’i „Ava koos“ ei suuda faili NoodiMeisteriga avada.

---

## Samm 4: Avaldamine Google Workspace Marketplace’is

Et rakendust (ja seeläbi ikooni) Drive’is täie mõjusega kasutataks, tuleb see avaldada **Google Workspace Marketplace’is**:

1. **APIs & Services** → **Google Workspace Marketplace SDK** (või otsi „Marketplace“).
2. Täida **Store listing**:
   - **App details**: nimi, lühikirjeldus, pikk kirjeldus, kategooria.
   - **Application icons**: vähemalt **128×128** ja **32×32** (PNG). Veebirakendustel soovitatakse ka 96×96 ja 48×48.
   - **Application card banner**: **220×140** px.
   - **Screenshots**: vähemalt 1, soovituslik 1280×800 px (rakenduse integreerimine Google’iga).
   - **Support links**: kasutustingimused, privaatsuspoliitika, tugi (kohustuslikud).
3. Vali nähtavus: **Avalik** (kõigile) või **Privaatne** (ainult oma domeen).
4. Esita **Submit for Review**. Avalikud rakendused läbivad Google’i ülevaatuse; võib võtta mõned päevad.

Pärast kinnitamist on rakendus Drive’iga seotud ja kasutajad saavad selle „Connect more apps“ / Marketplace’ist lisada. Failitüüp `application/vnd.noodimeister+json` on seotud teie rakenduse ja üleslaetud ikoonidega.

---

## Lühikokkuvõte

| Samm | Kus | Mida teha |
|------|-----|-----------|
| 1 | Google Cloud Console → Drive API / Marketplace SDK | Seadista Drive UI integration: ikoon(id), Open URL, MIME type `application/vnd.noodimeister+json`, laiend `noodimeister`. Kinnita domeen. |
| 2 | OAuth konfiguratsioon | Lisa scope `https://www.googleapis.com/auth/drive.install`. |
| 3 | NoodiMeisteri kood | Implementeeri Open URL vastuvõtt ja `state` parameetri töötlus (faili ID → ava /app?fileId=...). |
| 4 | Google Workspace Marketplace | Täida Store listing (ikoonid 32×32, 128×128, banner, screenshotid, lingid), esita ülevaatuse. |

Pärast seda on failid Drive’i keskkonnas NoodiMeisteri failitüübiga ära tuntavad ja logo ikoon võib hakata failide kõrval ilmuma (sõltuvalt Google’i loogikast võib see võtta aega).

---

## OneDrive (Microsoft)

Microsoft OneDrive ei paku API kaudu võimalust määrata failile kohandatud rakenduse ikooni nii nagu Google Drive UI integration. Failid jäävad laiendi `.noodimeister` või üldise dokumendi ikooniga. Seega praegu saab logo ikooni failide kõrval usaldusväärselt nähtavaks teha **ainult Google Drive’i** poolel, järgides ülalolevaid samme.
