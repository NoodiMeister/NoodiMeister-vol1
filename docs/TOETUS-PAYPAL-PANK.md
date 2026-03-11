# PayPal ja panga makseviisid

## 1. Panga / ülekande makseviised (Stripe’i kaudu)

Praegune **Stripe Checkout** toetab juba mitut makseviisi; need kuvatakse automaatselt vastavalt kasutaja asukohale ja valuutale (EUR):

| Meetod | Kirjeldus |
|--------|------------|
| **Kaart** | Debit- ja krediitkaart |
| **SEPA Direct Debit** | Pangaülekanne (IBAN) – SEPA piirkond |
| **Sofort** | Pangaülekanne (Klarna/Sofort) |
| **iDEAL** | Holland |
| **Bancontact** | Belgia |
| **giropay** | Saksamaa |

**Mida teha:** Stripe Dashboard’is **Settings → Payment methods** lülita soovitud meetodid sisse. Koodis on need juba loendis (`api/create-checkout-session.js`). Stripe filtreerib ise – näidatakse ainult meetodid, mis on lubatud ja sobivad valuutaga (EUR).

**SEPA / pangaülekannete aeglus:** Mõned meetodid (nt SEPA) võivad kinnitust võtta mitu päeva. Stripe saadab `checkout.session.completed` vastavalt oma reeglitele (nt pärast mandate’i vastuvõtmist). Kui soovid anda täisfunktsiooni alles pärast tegelikku laekumist, saad webhook’is kuulata ka `payment_intent.succeeded` (vajab täiendavat loogikat session’iga seostamiseks).

---

## 2. PayPal

Stripe Checkout **ei toeta** PayPal’i. PayPal’i lisamiseks on kaks peamist võimalust.

### Variant A – PayPal Checkout (soovitus)

1. **Konto:** [developer.paypal.com](https://developer.paypal.com) – loo rakendus, võta **Client ID** ja **Secret**.
2. **Voo:**
   - Frontend: kasuta [PayPal JavaScript SDK](https://developer.paypal.com/sdk/js/) või serveripoolne **Orders API**.
   - Loo tellimus (Order) backend’is: `POST https://api-m.paypal.com/v2/checkout/orders` (summa, currency, return_url, cancel_url).
   - Frontend’is kuvatakse PayPal nupp; kasutaja maksab PayPal’is.
   - Pärast maksmist kinnita tellimus: `POST .../v2/checkout/orders/{id}/capture`.
   - Pärast edukat capture’it kutsu oma backend’i endpoint (nt `POST /api/paypal-capture`), kus saadetakse `email`, `months`; backend kirjutab Vercel KV-sse `support:<email>` = `support_until` (sama loogika mis Stripe webhook’is).
3. **Turvalisus:** Capture’i tee ainult serveris; kontrolli summat ja korrektsust. Hoia Client ID ja Secret keskkonnamuutujates.

### Variant B – PayPal webhook

- PayPal saadab makse sündmused webhook’iga (nt `PAYMENT.CAPTURE.COMPLETED`).
- Backend endpoint (nt `POST /api/paypal-webhook`) kontrollib signatuuri, võtab seost tellimuse ja kasutaja vahel (custom_id või metadata), arvutab `support_until` ja kirjutab KV-sse.

**Ühine andmebaas:** Kasuta sama Vercel KV võtit `support:<email>` ja sama `support_until` loogikat nagu Stripe puhul – nii töötavad kaardimakse, panga makse ja PayPal ühe toetuse staatuse all.

---

## 3. Eesti / regionaalsed panga lingid (bank link)

Eestis pakuvad **panga linke** (suunamine panka, makse, tagasi callback) teenusepakkujad nt:

- **EveryPay** – [everypay.eu](https://everypay.eu)
- **Maksekeskus** (Braintree jms)
- Mõned pangad oma lahendustega

Tüüpiline voog:

1. Backend loob makse (summa, viide, tagasikutse URL).
2. Kasutaja suunatakse panka maksma.
3. Pank suunab tagasi sinu `return_url` või `callback_url`; teenusepakkuja kinnitab makse webhook’iga või callback’iga.
4. Backend kontrollib makse olekut ja kirjutab KV-sse `support:<email>` = `support_until`.

Koodi näidet siin ei ole; vajadusel võid lisada nt `api/banklink-create.js` ja `api/banklink-callback.js`, mis kasutavad valitud pakkuja API-d ja sama KV kirjet.

---

## 4. Lühikokkuvõte

| Soov | Lahendus |
|------|----------|
| **Pangaülekanne / SEPA / iDEAL / jms** | Stripe Checkout – lülita Stripe Dashboard’is sisse, kood toetab juba. |
| **PayPal** | Eraldi PayPal Orders API + oma endpoint, mis kirjutab sama KV `support:<email>`. |
| **Eesti panga link** | EveryPay / Maksekeskus vms – callback + sama KV loogika. |

Kõik variandid võivad kasutada sama **toetuse staatuse** API-d (`GET /api/support-status?email=...`) ja sama `support_until` väärtust – seega frontend ja täisfunktsiooni loogika jäävad ühtsed.
