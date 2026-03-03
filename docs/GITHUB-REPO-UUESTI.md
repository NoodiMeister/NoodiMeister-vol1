# GitHub repo kustutamine ja failide uuesti üles laadimine

## 1. Kustuta repo GitHubis (brauseris)

1. Ava **https://github.com/NoodiMeister/NoodiMeister-vol1**
2. Klõpsa **Settings** (repositooriumi vahekaardil)
3. Keri alla sektsioonini **Danger Zone**
4. Klõpsa **Delete this repository**
5. Kinnituseks sisesta reponimi: **NoodiMeister-vol1**
6. Klõpsa **I understand the consequences, delete this repository**

Repo on nüüd kustutatud. Kohalikud failid ja Git-ajalugu jäävad sinu arvutisse alles.

---

## 2. Loo GitHubis uus tühi repo

1. Mine **https://github.com/new**
2. **Repository name:** `NoodiMeister-vol1` (või soovitud nimi)
3. **Public**
4. **Ära** lisa README, .gitignore ega litsentsi – jäta repo tühjaks
5. Klõpsa **Create repository**

GitHub näitab seejärel juhiseid "…or push an existing repository from the command line". Kasuta allolevaid käske (kohalikust kaustast).

---

## 3. Ühenda kohalik projekt uue repoga ja pushi

Käivita terminalis (asendades `NoodiMeister-vol1` ja `NoodiMeister`, kui saidil on teine nimi):

```bash
cd /Users/raidolill/Desktop/Noodimeister

# Kui uue repo aadress on sama (sama org ja repo nimi):
git remote set-url origin https://github.com/NoodiMeister/NoodiMeister-vol1.git

# Kui lõid repo teise nimega, kasuta uut URL-i, nt:
# git remote set-url origin https://github.com/NoodiMeister/UUS-REPO-NIMI.git

# Laadi kõik failid ja kaustad uuesti üles (üks puhas commit)
git push -u origin main
```

- Kui küsitakse sisselogimist, kasuta GitHubi kasutajanime ja **Personal Access Token** (mitte parooli) või logi sisse brauseris.
- Pärast edukat push’i on GitHubis ainult praegune projektisisu (failid ja kaustad ühe commitiga).

---

## Kui remote URL on vale

Uue repo loomisel näitab GitHub näiteks:

```
https://github.com/NoodiMeister/NoodiMeister-vol1.git
```

Seadista see käsuga:

```bash
git remote remove origin
git remote add origin https://github.com/NoodiMeister/NoodiMeister-vol1.git
git push -u origin main
```

---

## Kokkuvõte

| Samm | Kus | Tegevus |
|------|-----|--------|
| 1 | GitHub.com | Settings → Danger Zone → Delete this repository |
| 2 | GitHub.com | New repository, tühi (no README) |
| 3 | Terminal | `git remote set-url origin …` (vajadusel) → `git push -u origin main` |

Pärast seda on repo GitHubis tühi olnud ja täidetud uuesti sinu praeguste failide ja kaustadega.
