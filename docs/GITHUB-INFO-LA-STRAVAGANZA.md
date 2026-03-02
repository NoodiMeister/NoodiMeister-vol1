# GitHub seadistamine info@la-stravaganza.com-ga

Selleks et kõik (GitHub, Vercel, commit’id) oleksid ühe identiteedi all: **info@la-stravaganza.com**.

---

## 1. Kohalik projekt (Cursor) – juba tehtud

Selles repos on seadistatud:

- **Git e-mail:** info@la-stravaganza.com  
- **Git nimi:** La Stravaganza  

Uued commit’id kasutavad seda identiteeti. Kontrolli kohalikult:

```bash
cd /Users/raidolill/Desktop/Noodimeister
git config user.email
git config user.name
```

---

## 2. GitHubi konto selle e-mailiga

**Variant A – sul on juba GitHubi konto**

1. Mine **github.com** → **Settings** (avatar → Settings).
2. **Emails** → lisa **info@la-stravaganza.com** ja kinnita (link e-kirjaga).
3. Soovi korral tee sellest **Primary** e-mail.

**Variant B – uus konto**

1. **github.com** → Sign up.
2. Kasuta e-maili **info@la-stravaganza.com**.
3. Loo kasutajanimi (nt lastravaganza või la-stravaganza).

---

## 3. Repo GitHubis (info@la-stravaganza.com kontol)

1. Logi sisse kontoga, kus on **info@la-stravaganza.com**.
2. **New repository** → nimi nt **NoodiMeister** (või **noodimeister**).
3. **Create repository** (tühi, ilma README-ta).

4. Kohalikult ühenda see repo ja pushi:

```bash
cd /Users/raidolill/Desktop/Noodimeister
git remote set-url origin https://github.com/SINU-KASUTAJANIMI/NoodiMeister.git
git push -u origin main
```

Asenda **SINU-KASUTAJANIMI** selle GitHubi konto kasutajanimega (nt lastravaganza).

Kui vana **NoodiMeister/NoodiMeister** repo jääb teise kontole alles ja sa tahad edaspidi ainult uut:

- uus repo = **SINU-KASUTAJANIMI/NoodiMeister** (info@la-stravaganza.com kontol);
- `git remote set-url` ja `git push` nagu ülal.

---

## 4. Vercel ühendamine uue repoga

1. **vercel.com** → sinu projekt (või **Add New Project**).
2. **Settings → Git**.
3. Kui vahetasid repot: **Disconnect** vana repo, siis **Connect Git Repository** → vali **SINU-KASUTAJANIMI/NoodiMeister** (info@la-stravaganza.com kontol).
4. **Production Branch:** `main`.

Edaspidi iga `git push origin main` uuendab Vercel’i sellest ühest repost (info@la-stravaganza.com identiteediga).

---

## Kokkuvõte

| Koht | Tegevus |
|------|--------|
| **Cursor (kohalik)** | Git user.email = info@la-stravaganza.com, user.name = La Stravaganza ✓ |
| **GitHub** | Konto, kus on info@la-stravaganza.com; repo nt SINU-KASUTAJANIMI/NoodiMeister |
| **Kohalik remote** | `git remote set-url origin https://github.com/SINU-KASUTAJANIMI/NoodiMeister.git` |
| **Vercel** | Git → ühendatud repo = see sama repo, haru main |

Nii on kõik ühe e-maili (info@la-stravaganza.com) ja ühe GitHubi konto/repo küljes.
