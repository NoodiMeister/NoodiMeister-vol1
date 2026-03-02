# Vercel + GitHub: muudatused ei ilmu

**Tootmise aadress (ainus projekt):** https://noodi-meister-vol1-la-stravaganza.vercel.app  
Kogu projekt on seotud selle Verceli projektiga. Teist (noodi-meister-vol1.vercel.app) ei kasutata toodanguks.

Kui Vercel ei võta GitHubi push'e vastu või ei tee automaatselt uut deploy'd, kontrolli järgmist.

## 1. Ühendus GitHubiga (Vercel Dashboard)

1. Ava [vercel.com](https://vercel.com) → **Dashboard** → vali projekt **NoodiMeister** (või vastav nimi).
2. Mine **Settings** → **Git**.
3. Veendu, et **Connected Git Repository** näitab õiget repo (nt `sinu-kasutaja/Noodimeister`).
4. Kui repo puudub või on vale:
   - **Disconnect** (kui on ühendatud vale repo).
   - **Connect Git Repository** → vali **GitHub** → vali õige **Noodimeister** repo ja **Connect**.

## 2. Production branch

Samuti **Settings** → **Git**:

- **Production Branch** peaks olema see haru, kuhu sa pushid (tavaliselt `main` või `master`).
- Kui pushid teise haru (nt `develop`), muuda Production Branch selleks või pushi muudatused `main`-i.

## 3. GitHub’i õigused ja webhookid

- Vercel peab GitHubis olema autoriseeritud: **GitHub** → **Settings** → **Applications** → **Authorized OAuth Apps** → **Vercel** – olemas ja õigustega.
- Kui oled repo omanik: **Repo** → **Settings** → **Webhooks** – peaks olema Vercel webhook (nt `https://api.vercel.com/...`). Kui puudub, ühenda Vercel repo uuesti (samm 1).
- **Kui küsitakse webhook’i nime:** sisesta nt **Vercel** või **Vercel Deploy (NoodiMeister)**. Nimi on ainult silt; võid panna ka **Production** või **Deploy**.

## 4. Deploy käsitsi

- **Vercel Dashboard** → projekt → **Deployments** → **Deploy** (või **Redeploy** viimase deploy’i juures).
- Vali **Use existing Build Cache** välja lülitamata, kui tahad täiesti uut buildi.

## 5. Root Directory (kui projekt on repo juures)

**Settings** → **General** → **Root Directory**:

- Peaks olema **tühi** (või `./`), kui `package.json` ja `vercel.json` on repo juurkaustas.
- Kui see on nt `frontend` või mõni alamkaust, siis Vercel ehitab vale kausta ja võib ignoreerida muudatusi juures.

## 6. Pärast parandust

- Tee muudatus, pushi GitHubi: `git push origin main` (või oma production branch).
- Kui ühendus ja branch on õiged, iga push peaks käivitama uue deploy’i. Deploymente vaata **Deployments** vahekaardilt.

---

## 7. Redeploy teeb „teise“ GitHubi kasutajaga / kaks projekti

Kui oled märganud, et **redeploy** (või iga push) näitab **erinevat GitHubi kasutajat** või tekib deploy kahes Verceli projektis (**noodi-meister-vol1** ja **noodi-meister-vol1-la-stravaganza**), põhjus on tavaliselt see:

- **Sama GitHub repo on ühendatud kahe erineva Verceli projektiga** (nt üks sinu isikliku konto all, teine tiimi „la-stravaganza“ all).
- Iga push käivitab deploy’d **mõlemas** projektis; Vercel näitab iga deploy’i juures seda GitHubi kasutajat, kellega **see Vercel projekt** on ühendatud (või kes tegi viimase push’i).

### Mida teha

1. **Otsusta ära üks „päris“ projekt** – toodang = **noodi-meister-vol1-la-stravaganza.vercel.app**. Teine projekt (**noodi-meister-vol1**) jääb ilma domeenita või eemalda sealt Git-ühendus.
2. **Eemalda Git-ühendus teiselt projektilt:** Vercel → teine projekt → **Settings** → **Git** → **Disconnect**. Siis ei käivitu selle projekti deploy enam automaatselt.
3. **Jäta ühendus alles ainult ühel projektil** – see, millel on **www.noodimeister.ee**. Nii teeb redeploy ainult üks projekt ja üks GitHubi seos.
4. **GitHub** → repo → **Settings** → **Webhooks**: kui on kaks Vercel-webhooki, võid ühe eemaldada, et push käivitaks deploy ainult ühes projektis.

Pärast seda peaks **redeploy** toimuma ühe GitHubi kasutaja / ühe Verceli projekti kontekstis.
