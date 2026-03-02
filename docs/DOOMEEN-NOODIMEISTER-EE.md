# Domeeni noodimeister.ee sidumine Verceliga

See juhend kirjeldab, kuidas ühendada domeen **noodimeister.ee** NoodiMeister projekti Vercel’is (praegune aadress: https://noodi-meister-vol1-la-stravaganza.vercel.app).

---

## 1. Lisa domeen Vercel’is

1. Mine [vercel.com](https://vercel.com) → **Dashboard**.
2. Vali projekt **NoodiMeister** (või nimi, mille all projekt on).
3. Ava **Settings** → **Domains**.
4. Klõpsa **Add** (või "Add Domain").
5. Sisesta **noodimeister.ee** ja kinnita.
6. Kui Vercel küsib, kas lisada ka **www.noodimeister.ee**, vali jah – soovitav on mõlemad ja ümbersuunamine (nt www → noodimeister.ee või vastupidi).

Pärast lisamist näitab Vercel **Invalid Configuration** või sarnase oleku ja annab täpsed DNS-kirjed, mida registraris seada.

---

## 1b. Invalid Configuration – mida kopeerida ja kuhu kleepida

Kui Vercel näitab **Invalid Configuration**, tuleb DNS-kirjed lisada domeeni pakkuja juurde. Siin on täpne “kust võtta” ja “kuhu panna”.

### Vercel’ist (kust kopeerida)

1. **vercel.com** → sinu projekt → **Settings** → **Domains**.
2. Lehel on nimekiri domeenidest. **Klõpsa domeeni nime peale** (nt **noodimeister.ee** või **www.noodimeister.ee**), et näha konfiguratsiooni.
3. Vercel näitab 1–2 kirjet:

   **Apex domeeni (noodimeister.ee) jaoks:**
   - **Type:** A  
   - **Name / Host:** sageli `@` või tühi (või `noodimeister.ee`)  
   - **Value / Points to / Answer:** IP-aadress (NoodiMeisteri puhul **`216.150.1.1`** – kasuta alati seda, mida Vercel sinu projekti juures näitab)  
   → **Kopeeri see Value (IP-aadress).**

   **www (www.noodimeister.ee) jaoks:**
   - **Type:** CNAME  
   - **Name / Host:** `www`  
   - **Value / Points to / Answer:** **`c8771fb459ca39dc.vercel-dns-016.com`** (NoodiMeisteri projekti CNAME – kasuta seda, mida Vercel näitab)  
   → **Kopeeri see Value (sihtdomeen).**

   *(Kui Vercel näitab teistsuguseid väljanimesid, otsi välja, kus on “Value”, “Points to” või “Answer” – see on see, mida kopeerida.)*

### Domeeni pakkuja juurde (kuhu kleepida)

Logi sisse **sinna, kus domeeni DNS-i haldad** (nt zone.ee, internet.ee, veebimajutuse paneel).

**A-kirje (apex = noodimeister.ee):**

| Vercel’ist võetud | DNS-paneelis sisesta |
|-------------------|----------------------|
| Type: **A**       | Kirje tüüp: **A**    |
| Name: **@** (või tühi) | Host / Nimi: **@** või tühi (või “apex”) |
| Value: **216.150.1.1** | Väärtus / Siht / Points to: **216.150.1.1** (kleepi Vercel’ist kopeeritud väärtus) |

**CNAME-kirje (www):**

| Vercel’ist võetud | DNS-paneelis sisesta |
|-------------------|----------------------|
| Type: **CNAME**   | Kirje tüüp: **CNAME** |
| Name: **www**     | Host / Nimi: **www**  |
| Value: **c8771fb459ca39dc.vercel-dns-016.com** | Väärtus / Siht / Points to: **c8771fb459ca39dc.vercel-dns-016.com** |

Salvesta muudatused. Vercel kontrollib DNS-i perioodiliselt; kui kirjed on õiged, **Invalid Configuration** asendub **Valid Configuration** (võib võtta mõni minut kuni tund).

**Kui kasutad zone.ee:** **Minu** → vali domeen **noodimeister.ee** → **DNS** (või **Kirjed**). Lisa uus kirje, vali tüüp (A või CNAME), väli “nimi” = `@` või `www`, “väärtus” = kopeeritud väärtus, salvesta.

---

## 1c. Veebimajutus.ee – täpsed kohad

Kui domeeni DNS-i haldad **veebimajutus.ee** kaudu:

### Kus kohast (Vercel)
- **vercel.com** → projekt → **Settings** → **Domains** → klõpsa **noodimeister.ee** (ja vajadusel **www.noodimeister.ee**).
- Kopeeri **A**-kirje väärtus: **216.150.1.1** (või see IP, mida Vercel näitab).
- Kopeeri **CNAME**-kirje väärtus: **c8771fb459ca39dc.vercel-dns-016.com** (NoodiMeisteri projekti puhul).

### Kuhu kleepida (veebimajutus.ee)

1. **Logi sisse:** [admin.veebimajutus.ee](https://admin.veebimajutus.ee/)
2. **Ava domeeni haldus** ja vali oma domeen (noodimeister.ee).
3. **Ülevalt rippmenüüst "Domeen"** vali **Nimeserver (DNS)**.
4. Leia sektsioon **Muud DNS kirjed** ja klõpsa **Muuda**.

**A-kirje (noodimeister.ee → Vercel):**
- Otsi üles olemasolev **tüüp A** kirje (või lisa uus nupuga **+ Lisa uus kirje**, kui vaja).
- **Väärtus** / IP-aadress: kleepi **216.150.1.1** (või Vercel’ist kopeeritud IP).
- Salvesta **Salvesta muudatused**.

**CNAME-kirje (www.noodimeister.ee → Vercel):**
- Klõpsa **+ Lisa uus kirje**.
- **Tüüp:** CNAME (või vali CNAME).
- **Nimi / host:** **www**
- **Väärtus / siht:** **c8771fb459ca39dc.vercel-dns-016.com**
- Salvesta **Salvesta muudatused**.

**Leviku aeg:** Eestis kuni 24 h, rahvusvaheliselt kuni 48 h. Kontroll: [whatsmydns.net](https://www.whatsmydns.net/).

Veebimajutus.ee KKK: [Kuidas muuta domeeni kirjet](https://www.veebimajutus.ee/klienditugi/kkk/kuidas-muuta-domeeni-kirjet/).

---

## 2. DNS seadistamine (domeeni registraris)

Domeen **noodimeister.ee** on registreeritud kuskil (nt. zone.ee, internet.ee, GoDaddy, Namecheap jne). Seal, kus domeeni DNS-i haldad, tuleb lisada järgmised kirjed.

### Variant A: Verceli nameserverid (lihtsaim)

Kui registrar lubab muuta **nameserverid** (NS):

1. Vercel’is **Settings → Domains** → vali noodimeister.ee → vali **Use Vercel Nameservers**.
2. Vercel annab kaks nameserverit, näiteks:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. Mine oma domeeni registrari juurde (nt zone.ee) → **Domeeni haldus** / **DNS** → **Nameserverid**.
4. Asenda olemasolevad NS-kirjed Verceli omadega ja salvesta.

Pärast seda haldab Vercel kogu DNS-i; apex (noodimeister.ee) ja www töötavad automaatselt.

---

### Variant B: Kirjed registraris (ilma nameserverit vahetamata)

Kui jätad DNS-i praeguse pakkuja juurde, lisa **käsitsi** need kirjed:

#### Apex domeen: noodimeister.ee

| Tüüp | Nimi / Host | Väärtus |
|------|-------------|--------|
| **A** | `@` või tühi või `noodimeister.ee` | `216.150.1.1` |

- **Nimi:** sageli `@` või tühi (apex). Kui registrar küsib “host”, proovi `@` või jäta tühjaks.
- **TTL:** võid jätta vaikimisi (nt 3600) või 60.

#### Subdomeen: www.noodimeister.ee

Vercel’i **Domains** lehel on projekti jaoks **CNAME** siht. NoodiMeisteri puhul: **c8771fb459ca39dc.vercel-dns-016.com**. Lisa:

| Tüüp  | Nimi / Host | Väärtus |
|-------|-------------|--------|
| **CNAME** | `www` | `c8771fb459ca39dc.vercel-dns-016.com` |

**Täpne CNAME siht:** Ava Vercel → projekt → **Settings → Domains** → klõpsa **www.noodimeister.ee** – seal on näidatud täpne väärtus.

---

## 3. SSL (HTTPS)

Vercel võtab SSL-sertifikaadi (Let’s Encrypt) automaatselt pärast seda, kui domeen on DNS-iga korrektselt seotud ja Vercel tuvastab domeeni. Täiendavat konfiguratsiooni tavaliselt ei vajata.

---

## 4. Kontroll ja levik

- **Vercel:** **Settings → Domains** – staatus peaks lülituma **Valid Configuration** / “Ready” kui DNS on õige.
- **Levik:** DNS muudatused võivad võtta mõnest minutist kuni 24–48 tunnini. Kiire kontroll: [whatsmydns.net](https://www.whatsmydns.net/) – otsi `noodimeister.ee` A-kirje (peaks olema `216.150.1.1`) ja `www.noodimeister.ee` CNAME.

---

## 5. Lühikokkuvõte

| Samm | Kus | Tegevus |
|------|-----|--------|
| 1 | Vercel | **Settings → Domains** → lisa **noodimeister.ee** (ja soovi korral www). |
| 2a | Registrar | Verceli nameserverid **ns1.vercel-dns.com**, **ns2.vercel-dns.com** – või |
| 2b | Registrar | A-kirje: `@` → `216.150.1.1`; CNAME: `www` → `c8771fb459ca39dc.vercel-dns-016.com`. |
| 3 | Oodata | Kuni 48 h DNS levik; Vercel kinnitab domeeni ja võtab SSL. |

Pärast seda peaks **noodimeister.ee** ja **www.noodimeister.ee** viitama NoodiMeister rakendusele Vercel’is.

---

## .ee domeenide märkused

- **veebimajutus.ee:** vt ülal jaotist **1c. Veebimajutus.ee – täpsed kohad**. Kokkuvõte: [admin.veebimajutus.ee](https://admin.veebimajutus.ee/) → Domeeni haldus → **Domeen** = **Nimeserver (DNS)** → **Muud DNS kirjed** → **Muuda**; A = 216.150.1.1, CNAME www = c8771fb459ca39dc.vercel-dns-016.com.
- **zone.ee:** **Minu** → vali domeen → **DNS** või **Nameserverid**. A-kirje puhul host = `@` või tühi; CNAME puhul host = `www`.
- Kui kasutad **ALIAS/ANAME** apex’i jaoks (mõned pakkujad): siht võiks olla `c8771fb459ca39dc.vercel-dns-016.com` – kui Vercel seda varianti pakub, järgi nende juhiseid UI’s.

Kui Vercel’i **Domains** lehel on konkreetsed väärtused (eriti CNAME), kasuta alati neid – need on projekti jaoks õiged.
