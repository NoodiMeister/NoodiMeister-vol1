# Test- ja toodangukeskkond

Soov: **arendaja saab teha muudatusi ilma, et tavalist kasutajat kohe mõjutaks**. Kasutaja töötab stabiilsel toodangulehel; uuendused ilmuvad alles siis, kui oled need testinud ja `main`-i merginud.

## Kuidas see töötab

### Toodang (kasutajate leht)

- **Aadress:** https://www.noodimeister.ee (või sinu toodangu domeen)
- **Verceli seade:** **Production Branch** = `main`
- **Tähendus:** Ainult push’id **`main`** harule uuendavad toodangut. Kuni sa ei merge’i `main`-i, kasutaja ei näe ühtegi muudatust.

### Test / arendus

- **Variant A – haru + Vercel Preview:** Tööta harul `develop` (või mis tahes teine haru). Iga push sellele harule teeb Vercelis **eelvaate (preview)** deploy’i.
  - Eelvaate link: Vercel Dashboard → **Deployments** → vali viimane deploy harust `develop` → **Visit**.
  - Link on tavaliselt kujul: `noodimeister-git-develop-xxx.vercel.app`
- **Variant B – kohalikult:** `npm run dev` – rakendus käivitub kohalikult; muudatused ei ilmu veebilehele.

Testiversioonil (ja kohalikult) kuvatakse üleval **riba**:
- **TEST – see on testiversioon…** (Verceli eelvaate deploy’il)
- **Kohalik arendus – muudatused ei ilmu veebilehele** (localhost)

Testiribal on link toodangulehele (noodimeister.ee), et testija saaks kiiresti toodangut avada.

Toodangul (`main` → noodimeister.ee) seda riba **ei** ole.

## Soovitatav töövoog

1. **Arendus:** Tööta harul `develop` (või loo alamharu nt `feature/uus-funktsioon`).
2. **Push:** `git push origin develop` → Vercel teeb eelvaate deploy’i. Ava eelvaate link ja testi.
3. **Kui kõik töötab:** Merge `develop` → `main` (GitHubis või käsitsi: `git checkout main && git merge develop && git push origin main`).
4. **Toodang uueneb** ainult nüüd; kasutajad näevad muudatused alles pärast seda.

Nii **testileht** (eelvaate URL) ja **toimiv toodang** (noodimeister.ee) on eraldi: arendaja muudatused ei mõjuta kasutajat enne, kui sa ise merge’id `main`-i.

## Verceli kontroll

- **Settings → Git → Production Branch:** peaks olema `main`.
- Kui Production Branch on `main`, siis **ainult** `main` deploy’id lähevad toodangu domeenile; kõik teised harud annavad eelvaate lingid.

## Kokkuvõte

| Keskkond   | Kuidas                         | Kes näeb        |
|------------|---------------------------------|-----------------|
| Toodang    | Push/merge `main`               | Kõik kasutajad  |
| Test       | Push `develop` (või teine haru) | Arendaja (eelvaate link) |
| Kohalik    | `npm run dev`                   | Ainult sinu arvuti |
