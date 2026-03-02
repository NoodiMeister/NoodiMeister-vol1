# Täiesti uus repository info@la-stravaganza.com kontol

Kõik sammud ühest kohast – et asjad ei jääks sassi.

---

## 1. GitHubis: uus tühi repo

1. Logi GitHubi sisse **kontoga, kus on info@la-stravaganza.com** (mitte Raido127 ega NoodiMeister).
2. Paremas ülanurgas **+** → **New repository**.
3. **Repository name:** `NoodiMeister` (või `noodimeister`).
4. **Description:** vabatahtlik (nt "Noodivestide tööriist").
5. **Public**.
6. **Ära lisa** README, .gitignore ega licence – jäta **täiesti tühjaks**.
7. Vajuta **Create repository**.

8. GitHub näitab nüüd lehekülge "Quick setup" – **repo aadress** on üleval, näiteks:
   - `https://github.com/KASUTAJANIMI/NoodiMeister.git`
   - Kirjuta oma **KASUTAJANIMI** üles (see on info@la-stravaganza.com kontol).

---

## 2. Kohalikult (Cursor / terminal)

Asenda **KASUTAJANIMI** sama nimega, mis GitHubis (info@la-stravaganza.com konto kasutajanimi).

```bash
cd /Users/raidolill/Desktop/Noodimeister

# Ühenda uue repoga (ühe kord)
git remote set-url origin https://github.com/KASUTAJANIMI/NoodiMeister.git

# Lisa kõik failid (sh docs), commit, push
git add -A
git commit -m "NoodiMeister: täielik projekt (uue repo esimene push)"
git push -u origin main
```

Kui küsib parooli: kasuta GitHubi **Personal Access Token** (mitte tavaline parool).  
GitHub → Settings → Developer settings → Personal access tokens → Generate new token (scope: repo).

---

## 3. Vercel

1. **vercel.com** → sinu projekt (või **Add New Project**).
2. **Settings → Git**.
3. Kui oli vana repo ühendatud: **Disconnect**.
4. **Connect Git Repository** → vali **KASUTAJANIMI/NoodiMeister** (see uus repo).
5. **Production Branch:** `main`.

Valmis. Edaspidi iga `git push origin main` uuendab Vercel’i sellest uuest repost.
