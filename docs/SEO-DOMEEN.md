# SEO ja põhidomeen (noodimeister.ee)

## Põhidomeen

Rakenduse **ainus ametlik domeen** on **https://noodimeister.ee** (ilma www).

- Otsingumootorid ja jagamise lingid viitavad sellele aadressile (canonical, Open Graph, Twitter).
- **www.noodimeister.ee** suunatakse automaatselt → **https://noodimeister.ee** (Vercel `redirects`).

Kui kasutad Vercelit, seadista **Custom Domain** projektis: **noodimeister.ee**. Siis rakendus on kättesaadav ainult selle domeeni kaudu; teised (nt `*.vercel.app`) võid jätta välja või suunata samuti noodimeister.ee poole (Vercel Dashboard → Domains).

## SEO (index.html)

- **Canonical URL:** `https://noodimeister.ee/`
- **Open Graph** (Facebook, LinkedIn jms): `og:title`, `og:description`, `og:url`, `og:image`, `og:locale`
- **Twitter Card:** `summary_large_image` sama sisuga
- **robots:** `index, follow`
- **theme-color:** amber (#b45309)

## Jagamise pilt (og-image)

Sotsiaalvõrgustike eelvaade kasutab pilti: **https://noodimeister.ee/og-image.png**

1. Loo pilt (soovitus: 1200×630 px), nt logo või tööriista ekraanivõte.
2. Lisa fail projekti: **`public/og-image.png`**
3. Deploy järel on see kättesaadav aadressil `https://noodimeister.ee/og-image.png`

Kui faili pole, jagamisel võib kuvata vaikimisi teksti ilma pildita.

## Google OAuth ja teised domeenid

Google sisselogimine ja Drive töötavad ainult **neil domeenidel**, mis on lisatud Google Cloud Console’is (Authorized JavaScript origins ja Authorized redirect URIs). Lisa seal **https://noodimeister.ee**. Kui kasutad veel mõnda domeeni (nt testimiseks), lisa ka see. Üksikasjad: [GOOGLE-SETUP.md](./GOOGLE-SETUP.md).
