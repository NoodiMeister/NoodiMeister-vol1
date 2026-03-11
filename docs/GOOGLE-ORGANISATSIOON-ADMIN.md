# Kooli / organisatsiooni administraator: NoodiMeisteri lubamine

Kui kasutaja (nt õpetaja või õpilane) domeeniga **@paikesekool.parnu.ee** (või mõne muu Google Workspace’i organisatsiooniga) proovib NoodiMeisteriga Google’i kaudu sisse logida või Google Drive’iga ühendust võtta, võib tekkida teade:

> **Need admin approval** – NoodiMeister needs permission to access resources in your organisation that only an admin can grant. Please ask an admin to grant permission to this app before you can use it.

See tähendab, et teie **organisatsiooni (Google Workspace) administraator** peab NoodiMeisteri rakenduse **lubama**.

---

## Mida administraatoril teha

1. Logi sisse **Google’i administraatorikonsooli**: [admin.google.com](https://admin.google.com) (kontoga, millel on administraatoriõigused).
2. Vali **Turvalisus** (Security) või **Rakendused** (Apps).
3. Otsi seadeid, mis reguleerivad **kolmanda osapoole rakenduste** ligipääsu. Tavaliselt:
   - **Turvalisus** → **API-d ja andmete juurdepääs** (API controls) või
   - **Rakendused** → **Google Workspace Marketplace’i rakendused** või
   - **Rakendused** → **Rakenduste juurdepääsu haldus** (App access control).
4. Leia valik, kus saab lubada **kinnitamata** (unverified) rakendusi või konkreetse rakenduse **NoodiMeister**:
   - **„Luba kasutajatel kinnitamata rakendusi kasutada“** (või sarnane) – siis saavad kõik organisatsiooni kasutajad NoodiMeisteri kasutada; või
   - **„Lisa rakendus“** / **„Luba rakendus“** – kui saab NoodiMeisteri nime või Client ID järgi lisada ja lubada.
5. Salvesta muudatused.

Kui kasutaja on juba proovinud sisse logida ja näinud „Need admin approval“, võib administraatoril olla **päringute** või **ootel olevate kinnituste** nimekiri – seal võib olla NoodiMeister; selle kinnitamine lubab selle kasutaja (või kogu organisatsiooni) jaoks ligipääsu.

---

## Täpsed kohad (Google Admin)

- **Admin Console** → **Turvalisus** → **Põhiseaded** (Basic settings) või **API-d** (API controls):  
  Vaata **„Rakenduste juurdepääsu haldus“** (Manage third-party app access). Seal saab valida režiimi: kas kõik rakendused on lubatud, keelatud või ainult administraatori kinnitatud.
- **Rakendused** → **Rakenduste juurdepääsu haldus** (App access control):  
  Siin saab määrata, kas kasutajad võivad kinnitamata rakendusi kasutada, või ainult valitud rakendused.

Pärast seda peaks kasutaja **raido.lill@paikesekool.parnu.ee** (ja teised sama organisatsiooni kasutajad) saama NoodiMeisteriga Google’iga sisse logida ja Google Drive’i kasutada.

---

## Kui soovitate linki administraatorile

Võite administraatorile saata selle lehe lingi või lühikokkuvõtte:

- **Probleem:** NoodiMeister on Google’i jaoks „unverified“ rakendus; organisatsioonides nõuab see administraatori luba.
- **Lahendus:** Admin Console’is lubada kolmanda osapoole / kinnitamata rakendused või konkreetselt NoodiMeister (vt samme ülal).
