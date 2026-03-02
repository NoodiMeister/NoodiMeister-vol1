# Plaan: noodimeister.ee tööle ilma vigadeta

Lühike samm-sammuline plaan, et saidi **noodimeister.ee** üles seada ja vältida levinud vigu.

---

## Faas 1: Enne deploy’i (kohalikult)

### 1.1 Build ja preview

```bash
cd /Users/raidolill/Desktop/Noodimeister
npm install
npm run build
npm run preview
```

- Ava **http://127.0.0.1:4173** – kujundus ja navigeerimine peavad töötama.
- Kui build ebaõnnestub või preview’s on vigu → paranda enne järgmist sammu.
- **Viga “Element #root ei leitud”** → kontrolli, et `index.html` sisaldab `<div id="root"></div>`.

### 1.2 Google Client ID (kohalik test)

- Kopeeri `.env.example` → `.env`.
- Lisa reale: `VITE_GOOGLE_CLIENT_ID=sinu-client-id.apps.googleusercontent.com`
- Client ID tuleb [Google Cloud Console](https://console.cloud.google.com/) → Credentials → OAuth 2.0 Client ID.
- Käivita `npm run dev` ja testi **Registreeru** / **Logi sisse** → nupp **Google**. Kui töötab kohalikult, on sama võimalik tootmises (kui lisa samm 3.2).

---

## Faas 2: GitHub ja Vercel

### 2.1 Kood GitHubis

- Veendu, et repositooriumis on: `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `vercel.json`, `src/`, `public/_redirects`, `tailwind.config.cjs`, `postcss.config.cjs`.
- **Ära** lisa `node_modules/` ega `.env` (tundlikud andmed) – need on `.gitignore`-is.

```bash
git add .
git status   # kontrolli, et .env ei ole staged
git commit -m "Valmis deploy noodimeister.ee jaoks"
git push origin main
```

### 2.2 Vercel projekt

1. [vercel.com](https://vercel.com) → **Add New… → Project**.
2. **Import Git Repository** → vali oma **Noodimeister** repo.
3. **Build & Development Settings** (Vercel võtab `vercel.json`-ist):
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: tühi
4. **Deploy** → oota, kuni build läbib. Live URL on nt `https://noodimeister-xxx.vercel.app`.

### 2.3 Keskkonnamuutuja Vercel’is (Google jaoks)

- **Project → Settings → Environment Variables**
- Lisa: **Name** `VITE_GOOGLE_CLIENT_ID`, **Value** `sinu-client-id.apps.googleusercontent.com`
- Vali **Production** (ja soovi korral Preview).
- **Save** → tee **Redeploy** (Deployments → viimane → Redeploy), et uus muutuja jõuaks build’i.

---

## Faas 3: Domeen noodimeister.ee

### 3.1 Domeen Vercel’is

1. **Settings → Domains → Add**
2. Sisesta **noodimeister.ee** ja kinnita; lisa ka **www.noodimeister.ee** (soovitav).
3. Vercel näitab **Invalid Configuration** ja annab DNS-kirjed (A ja CNAME). **Ära** kasuta siin dokumendis olevaid näidiseid – kopeeri **alati** Vercel’i UI-st antud väärtused.

### 3.2 DNS registraris (nt zone.ee, veebimajutus.ee)

- **Apex (noodimeister.ee):** A-kirje, Name = `@` (või tühi), Value = **Vercel’ist kopeeritud IP** (nt 76.76.21.21 – võta alati Vercel’ist).
- **www:** CNAME, Name = `www`, Value = **Vercel’ist kopeeritud CNAME** (nt `cxxx.vercel-dns.com`).
- Salvesta. Levik võib võtta **mõni minut kuni 24–48 h**. Kontroll: [whatsmydns.net](https://www.whatsmydns.net/).
- Kui Vercel näitab **Valid Configuration** ja SSL on aktiivne, on domeen korras.

Täpsemalt: **docs/DOOMEEN-NOODIMEISTER-EE.md** (sh veebimajutus.ee sammud).

---

## Faas 4: Google sisselogimine tootmises (vältida redirect_uri_mismatch)

### 4.1 Authorized origins ja redirect URIs

- [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials** → sinu **OAuth 2.0 Client ID (Web)**.
- **Authorized JavaScript origins** – lisa **täpselt** (ilma lõpuslasita):
  - `https://noodimeister.ee`
  - `https://www.noodimeister.ee`
  - `https://noodimeister-xxx.vercel.app` (sinu tegelik Vercel production URL)
  - `http://localhost:5173` (arenduse jaoks)
- **Authorized redirect URIs** – lisa **samad** read (https ja http localhost).
- **Save** → oota mõni minut, siis proovi uuesti.

### 4.2 Kui ikka “Error 400: redirect_uri_mismatch”

- Ava **toodangu aadress** (nt https://www.noodimeister.ee), mitte preview-URL (nt `…-xxx-abc123.vercel.app`).
- Kontrolli brauseri aadressiribal olevat päritolu – see peab **täpselt** ühtima ühega Google Console’is. Tühikud või `http` vs `https` rikkuvad.
- Vaata täpsemalt: **docs/GOOGLE-SETUP.md**.

---

## Faas 5: Kontroll ja vigaotsing

### 5.1 Kiire kontrollnimekiri

| Kontroll | Kus |
|----------|-----|
| Build töötab | `npm run build` → exit 0, `dist/` loodud |
| Preview töötab | `npm run preview` → ava 127.0.0.1:4173 |
| Repo ühendatud | Vercel → Settings → Git: repo + haru `main` |
| Env muutuja | Vercel → Settings → Environment Variables: `VITE_GOOGLE_CLIENT_ID` |
| DNS kehtiv | Vercel → Domains: noodimeister.ee / www → Valid |
| Google origins | Google Console: noodimeister.ee ja www lisatud |

### 5.2 Levinud vead ja lahendused

| Viga | Lahendus |
|------|----------|
| **Build failed** Vercel’is | Vaata Deployments → Build Logs. Võrdle kohaliku `npm run build` väljundiga; paranda puudujaid sõltuvusi või Node versiooni (`package.json` → `engines.node`). |
| **Valge/rikutud kujundus** | Hard refresh (Ctrl+Shift+R) või inkognito; Vercel → Redeploy **Clear build cache**. |
| **404 teedel** (/app, /login jne) | Veendu, et `vercel.json` sisaldab `rewrites` → `/index.html` (projektis on juba). |
| **Google “redirect_uri_mismatch”** | Lisa tootmise URL (noodimeister.ee, www) Google Console’i Authorized origins ja redirect URIs. |
| **Domeen Invalid Configuration** | Kontrolli DNS-i (A + CNAME) registraris; kasuta Vercel’i UI-s näidatud väärtusi; oota DNS levikut. |

### 5.3 Pärast muudatusi

- Iga `git push origin main` käivitab Vercel’is uue deploy’i.
- Kujundus ja kood tulevad **sama repost** – Cursor’i muudatused jõuavad veebi push’iga.
- Kui lisad uue keskkonnamuutuja, tee **Redeploy**, et build seda kasutaks.

---

## Lühikokkuvõte

1. **Kohalikult:** `npm run build` + `npm run preview` → kõik töötab.
2. **GitHub:** push `main`; Vercel import + env `VITE_GOOGLE_CLIENT_ID`.
3. **Domeen:** Vercel’is lisa noodimeister.ee + www; seadista DNS registraris (A + CNAME).
4. **Google:** lisa noodimeister.ee ja www nii origins kui redirect URIs.
5. **Kontroll:** ava https://www.noodimeister.ee ja testi sisselogimist ning lehti.

Rohkem üksikasju: **DEPLOY.md**, **docs/DOOMEEN-NOODIMEISTER-EE.md**, **docs/GOOGLE-SETUP.md**.
