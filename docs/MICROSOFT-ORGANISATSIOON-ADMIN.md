# Kooli / organisatsiooni administraator: NoodiMeisteri lubamine (Microsoft)

Kui kasutaja organisatsiooni **Microsofti** kontoga (nt @paikesekool.parnu.ee) proovib NoodiMeisteriga sisse logida ja näeb teadet:

> **Need admin approval** – NoodiMeister needs permission to access resources in your organisation that only an admin can grant. Please ask an admin to grant permission to this app before you can use it.

siis **organisatsiooni Microsoft 365 / Entra ID administraator** peab rakendusele **admin consent** (administraatori nõusoleku) andma.

---

## Mida administraatoril teha

### Variant 1: Ootavad nõusolekupäringud (Admin consent requests)

1. Logi sisse **Azure’i portali**: [portal.azure.com](https://portal.azure.com) või **Microsoft 365 administraatorikeskus**: [admin.microsoft.com](https://admin.microsoft.com) (kontoga, millel on **Global administrator** või **Privileged role administrator** õigused).
2. **Azure’is:** vali **Microsoft Entra ID** (või **Azure Active Directory**) → **Enterprise applications** → **Admin consent requests** (või **Consent and permissions** → **Pending consent requests**).
3. Kui nimekirjas on **NoodiMeister**, vali see ja klõpsa **Approve** (Luba) / **Grant admin consent**.
4. Salvesta. Pärast seda saavad organisatsiooni kasutajad NoodiMeisteriga Microsofti kontoga sisse logida.

Kui **Admin consent requests** on tühi või NoodiMeisterit seal ei ole, kasuta varianti 2.

---

### Variant 2: Lisa rakendus ja anna nõusolek (Enterprise application)

1. Logi sisse **Azure’i portali**: [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** (või **Azure Active Directory**).
2. Vali **Enterprise applications** → **+ New application** → **Create your own application**.
3. **Name:** nt `NoodiMeister`. **Supported account types:** vali „Accounts in any organizational directory …“. **Register** (või kasuta allpool olevat „Add from gallery“ kui rakendus on galeriis – NoodiMeister võib olla registreeritud kolmanda osapoole rakendusena).
4. **Lihtsam tee:** **Enterprise applications** → **+ New application** → **Add an application that’s not in the gallery** (või otsi nimega, kui NoodiMeister on juba nimekirjas pärast esimest kasutaja päringut).
5. Täida **Application ID** – NoodiMeisteri arendaja peab sulle selle andma (Client ID Azure’i App registration’ist). Kui sul seda pole, palu arendajal saata **Application (client) ID** (kujul `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
6. Pärast rakenduse lisamist: **Enterprise applications** → **NoodiMeister** → **Permissions** → **Grant admin consent for [organisatsiooni nimi]**.
7. Kinnita. Pärast seda on nõusolek antud ja organisatsiooni kasutajad saavad sisse logida.

---

### Variant 3: Kasutajate nõusoleku seaded (User settings)

Kui soovid, et **kasutajad** saaksid ise kolmanda osapoole rakendustele nõusoleku anda (sh NoodiMeister), võid administraatorina seda lubada:

1. **Azure Portal** → **Microsoft Entra ID** → **User settings** (või **Enterprise applications** → **Consent and permissions**).
2. Leia **User consent for applications** vms. Seadista näiteks „Users can consent to apps accessing company data on their behalf“ või vastav režiim, et kasutajad saaksid NoodiMeisteri jaoks nõusolekut anda.
3. Salvesta. **Tähelepanu:** see võib avada teistele rakendustele ka ligipääsu; kasuta ainult siis, kui olete sellega nõus.

---

## Lühikokkuvõte

| Samm | Kus | Mida teha |
|------|-----|-----------|
| 1 | Azure Portal / M365 Admin | Logi sisse administraatorina. |
| 2 | Entra ID → Enterprise applications → Admin consent requests | Kui NoodiMeister on nimekirjas, klõpsa **Approve**. |
| 3 | Või: Lisa rakendus (Application ID) ja **Permissions** → **Grant admin consent** | Anna NoodiMeisterile administraatori nõusolek. |

Pärast nõusoleku andmist peaks kasutaja (nt raido.lill@paikesekool.parnu.ee) saama NoodiMeisteriga **Microsoft** nupu kaudu sisse logida ilma „Need admin approval“ teiseta.

---

## Kui vajate NoodiMeisteri Application ID-d

NoodiMeisteri rakendus on registreeritud Azure’is (App registration). **Application (client) ID** on arendajal; kui administraator peab rakenduse käsitsi galeriisse lisama (Variant 2), saate ID küsida NoodiMeisteri tugimeeskonnalt või arendajalt (tavaliselt kujul `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
