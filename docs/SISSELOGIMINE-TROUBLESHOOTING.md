# Sisselogimise tõrgete lahendamine

## E-mail ja parool

| Probleem | Kontroll / lahendus |
|----------|----------------------|
| „Vale e-mail või parool“ | Kas konto on loodud? Mine `/registreeru` ja loo konto, seejärel proovi uuesti `/login`. |
| „Salvestamine ebaõnnestus“ | Brauser võib blokeerida salvestuse (privaatne režiim, keelatud küpsised). Proovi tavalises aknas või teises brauseris. |
| „Andmeid ei saanud lugeda“ | `noodimeister-users` võib olla vigane. Ava F12 → Application → Local Storage, vaata võtit `noodimeister-users` või tühjenda saidi andmed. |
| „Midagi läks valesti“ | Ava konsool (F12). Tõrge võib olla nt vigane JSON või puuduv localStorage. |

## Google sisselogimine

| Probleem | Kontroll / lahendus |
|----------|----------------------|
| Nupp „Google“ puudub või tekst „lisa VITE_GOOGLE_CLIENT_ID“ | **Kohalik:** lisa faili `.env` rida `VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com`. **Vercel:** Project → Settings → Environment Variables → lisa `VITE_GOOGLE_CLIENT_ID`. |
| redirect_uri_mismatch (400) | Lisa praegune päritolu (nt `https://noodimeister.ee`) Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized JavaScript origins ja Authorized redirect URIs. Vaata [GOOGLE-SETUP.md](./GOOGLE-SETUP.md). |
| „Google sisselogimine ebaõnnestus“ (alert) | Token või userinfo võib olla kehtetu. Proovi uuesti; kui kasutad blokeerijaid, luba noodimeister.ee ja accounts.google.com. |
| Popup sulgub kohe / COOP hoiatus | Brauser või laiendus võib blokeerida popupi. Proovi teises brauseris või keela popup-blokeerija saidil. |
| Pärast Google sisselogimist valge ekraan | Võib olla JS-viga lehel `/app`. Ava konsool (F12) ja vaata viga (nt „Cannot access … before initialization“). Uuenda koodi ja deploy. |

## Administraatori / testija viga Cursorile (arendusrežiim)

Kui käivitad rakenduse **kohalikult** (`npm run dev`), salvestatakse iga sisselogimise/registreerimise viga automaatselt faili **`logs/last-auth-error.json`**. Saad (või Cursor AI) viga sealt lugeda ilma brauserist kopeerimata.

- Faili asukoht: projekti juurest `logs/last-auth-error.json`
- Sisaldab: `source`, `code`, `description`, `fullMessage`, `copyableText`, `timestamp`
- Cursoris: ava fail või ütle vestlusesse nt „vaata viimast auth viga“ – AI saab faili lugeda ja viga analüüsida.

**Kasutaja teavitamine:** Kui kasutaja vajutab „Saada Cursorisse“, kuvatakse teade „Ole kannatlik – viga töödeldakse ja parandatakse. Teavitame, kui viga on lahendatud.“ Rakendus pollib (ainult dev) staatusfaili. Kui oled viga parandanud ja testinud, käivita **`npm run mark-error-fixed`** – siis kuvatakse kasutajale roheline teade: „Viga on vastuvõetud, töödeldud, parandatud ja testitud. Proovi uuesti sisselogimist.“

Productionis (Vercel) seda lõpp-punkti ei ole; vead kuvatakse ainult kasutajale ja „Saada Cursorisse“ nupuga.

## Üldine

- **Juba sisselogitud:** kui oled sisse loginud ja avad `/login` või `/registreeru`, suunatakse sind automaatselt `/tood`.
- **Session vs „Jää sisse logituks“:** kui linnuke on välja, logitakse välja brauseri tabi sulgemisel (sessionStorage). Kui linnuke on sees, kasutatakse localStorage ja sisselogimine püsib.
- **Vercel:** veendu, et keskkonnamuutuja `VITE_GOOGLE_CLIENT_ID` on seadistatud Production (ja soovi korral Preview) keskkonnas.
