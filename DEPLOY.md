# NoodiMeister – deploy juhend

**Üks kujundus:** Rakendusel on üks paigutus ja kujundus (see, mida näed Cursoris kohalikult). Deploy peab kasutama **sama** repositooriumi ja haru, et veebiversioon oleks identne Cursoriga. Enne deploy’i: `npm run build` ja `npm run preview` – kujundus peab kohalikult olema õige.

---

## Alternatiivid Vercel’ile (Netlify, Cloudflare Pages)

Kui Vercel’iga tekib probleeme (kujundus ei uuene, cache jms), võid kasutada **Netlify** või **Cloudflare Pages**. Mõlemad ehitavad sama repost ja kujundus ühtib Cursoriga.

### Variant A: Netlify

1. Mine [netlify.com](https://netlify.com) ja logi sisse (vajadusel ühenda GitHub).
2. **Add new site → Import an existing project** → vali **GitHub** ja repositoorium **NoodiMeister** (või sinu repo).
3. Netlify loeb **netlify.toml** automaatselt:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Redirects:** SPA redirect on juba `netlify.toml`-is (`/*` → `/index.html`).
4. **Production branch:** `main`. Vajuta **Deploy site**.
5. Pärast deploy’i: **Site settings → Domain management** – saad muuta subdomeeni (nt `noodimeister.netlify.app`).

**Uuendused:** iga `git push origin main` käivitab uue deploy’i. Kujundus = Cursor’i versioon.

### Variant B: Cloudflare Pages

1. Mine [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Vali **GitHub** ja repositoorium **NoodiMeister**.
3. **Build settings:**
   - **Framework preset:** Vite (või None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Production branch:** `main`. Vajuta **Save and Deploy**.
5. **SPA:** Fail **public/_redirects** kopeeritakse build’iga `dist/`-i; Cloudflare Pages kasutab seda (kõik teed → `index.html`).

**Uuendused:** iga push `main`-i uuendab lehte. Tasuta tier on piisav.

### Ühine enne deploy’i

```bash
npm install
npm run build
npm run preview
```

Ava `http://127.0.0.1:4173` – kui kujundus on õige, on see sama, mida Netlify/Cloudflare näitab.

---

## Cursor’i kujunduse ülekandmine (üldine)

Kujundus tuleb Vercel’ile automaatselt, kui deploy’id teed **sama repositooriumi** põhjal. Sammud:

1. **Kohalikult Cursoris** – kui oled kujundust muutnud (`src/`, `index.css`, `tailwind.config.cjs` jms), salvesta ja veendu, et rakendus näeb välja nii nagu soovid.
2. **Kohalik preview** – käivita `npm run build` ja `npm run preview`, ava `http://127.0.0.1:4173`. Kui kujundus on õige, on see sama, mida host (Netlify, Cloudflare, Vercel) näitab.
3. **Push GitHubi** – `git add .` → `git commit -m "..."` → `git push origin main`. Host ehitab sama koodi; kujundus = Cursor’i versioon.

**Kokkuvõte:** Cursor’i kujundust ei kopeeri käsitsi – host ehitab rakenduse samast repost. Iga `git push origin main` uuendab veebiversiooni.

---

## Versioonide ühtlustamine (mida kontrollida)

Et Cursor ja Vercel oleksid sama kujunduse ja käitumisega:

| Mida kontrollida | Kuidas |
|------------------|--------|
| **Sama repo ja haru** | Vercel → Project → Settings → Git: repo ja haru (nt `main`) peavad olema õiged. Deploy’id tulevad ainult sellest repost. |
| **Sama Node** | `package.json` sisaldab `"engines": { "node": ">=18" }`. Vercel kasutab seda. Kohalikult: `node -v` (soovitavalt 18+). |
| **Sama sõltuvused** | Kasuta **package-lock.json** – see on repos. Vercel ja kohalik `npm install` kasutavad sama lock-faili → sama versioonid. |
| **Enne push’i** | `npm install` (värskenda lock’i vajadusel), `npm run build`, `npm run preview` – kui kohalikult kõik töötab ja kujundus on õige, Vercel’il on sama. |
| **Pärast deploy’i** | Vercel → Deployments → ava live URL ja võrdle Cursor’i `npm run preview`-ga (paigutus, värvid, fondid). |

**Soovitus:** Ära commiti `node_modules/`. Lae alati üles `package.json` + `package-lock.json`; Vercel ja teised installivad sõltuvused nendest.

---

## Kui kujundus Vercel’il ei ühti Cursor’iga

1. **Vercel’i cache tühi redeploy**
   - Vercel → sinu projekt → **Deployments**.
   - Viimase deploy’i juures **⋮** (kolm punkti) → **Redeploy**.
   - Märgi **Clear build cache** (või “Redeploy with existing cache” vastand) ja kinnita. Vercel ehitab kõik uuesti.
2. **Brauseri cache**
   - Ava Vercel’i leht **inkognito** või tee **Ctrl+Shift+R** / **Cmd+Shift+R** (hard refresh), et mitte näha vana CSS-i.
3. **Haru ja viimane kood**
   - Vercel → **Settings → Git**: Production Branch = `main` (või sinu haru). Veendu, et viimased muudatused on GitHubis: `git push origin main`.
4. **Kohalik võrdlus**
   - Kohalikult: `npm run build` ja `npm run preview` → `http://127.0.0.1:4173`. Kui **siin** kujundus on vale, paranda koodi; kui siin on õige aga Vercel’il vale, on põhjus tavaliselt cache või vale haru.

Projektis on **Tailwind safelist** (`tailwind.config.cjs`), et dünaamilised klassid jääksid production build’i ka sisse.

---

## 1. GitHub’i kandmine

Veendu, et repositooriumis on kõik vajalikud failid:

- **Projektijuur:** `package.json`, `index.html`, `vite.config.js`, `netlify.toml` (Netlify), `vercel.json` (Vercel)
- **Allikad:** `src/`, `public/_redirects` (SPA redirect Cloudflare/Netlify jaoks)
- **Konfiguratsioon:** `tailwind.config.cjs`, `postcss.config.cjs`

**Käsk:** pushi kogu projekt GitHub’i (sh `vercel.json`).

```bash
git add .
git commit -m "Add Vercel config and deploy docs"
git push origin main
```

## 2. Vercel’is seadistamine

1. Mine [vercel.com](https://vercel.com) ja logi sisse (vajadusel ühenda GitHub).
2. **Add New… → Project**.
3. Vali **Import Git Repository** ja oma **Noodimeister** repositoorium.
4. **Build & Development Settings** (Vercel võtab need automaatselt `vercel.json`-ist):
   - **Framework Preset:** Vite (või “Other”)
   - **Build Command:** `npm run build` (või tühjaks – kasutab `vercel.json`)
   - **Output Directory:** `dist` (või tühjaks – kasutab `vercel.json`)
   - **Install Command:** `npm install`
5. **Root Directory:** jäta tühjaks (kui projekt on repojuuris).
6. **Environment Variables:** praegu pole vaja; kui hiljem lisad (nt API võtmed), lisa siin.
7. Vajuta **Deploy**.

## 3. Kontroll enne deploy’i

Kohalikult veendu, et build töötab ja **kujundus on see, mida tahad Vercel’il näha** (sama mis Cursoris):

```bash
npm install
npm run build
npm run preview
```

Ava `http://localhost:4173` (või terminalis näidatud aadress). Kui paigutus ja kujundus on õiged, on Vercel’i deploy sama. Kui `dist/` tekkis ja vigade ei ole, peaks Vercel’i build samuti läbi minema.

## 4. Pärast deploy’i

- **Live URL:** Vercel annab lingi kujul `https://noodimeister-xxx.vercel.app` (või sinu domeen).
- **SPA:** Kõik teed (`/...`) suunatakse `index.html` poole (`vercel.json` rewrites).
- **Node:** `package.json` sisaldab `"engines": { "node": ">=18" }`, et Vercel kasutaks sobivat Node versiooni.

Kui build Vercel’is ebaõnnestub, vaata **Deployments → failed deploy → Build Logs** ja võrdle kohaliku `npm run build` väljundiga.

---

## 5. Kui Vercel ei tuvasta deployment’i

**Põhjused:** repo pole ühendatud, vale haru või kood pole GitHubis.

**Lahendus:**

1. **Lükka kood GitHubi** (kohalikult terminalis):
   ```bash
   cd /Users/raidolill/Desktop/Noodimeister
   git add .
   git commit -m "Vercel deploy fix"
   git push origin main
   ```

2. **Vercel → Add New Project**
   - **Import Git Repository** → vali **NoodiMeister/NoodiMeister** (või oma GitHubi kasutaja/repo).
   - Kui repot ei näe: **Adjust GitHub App Permissions** – anna Vercelile ligipääs sellele repole (GitHub → Settings → Applications → Vercel → Configure).

3. **Vali õige haru**
   - **Production Branch:** `main` (või `master`, vastavalt repole).

4. **Deploy käsitsi**
   - Pärast projekti loomist: **Deployments** → **Redeploy** viimase deploy’i juures või **Create Deployment** ja vali haru `main`.

5. **Kontrolli ühendust**
   - **Project → Settings → Git** – peab olema ühendatud repo ja haru (nt `main`). Iga `git push origin main` peaks käivitama uue deployment’i.
