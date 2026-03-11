# Toetuse automatiseerimine (Stripe)

Selle juhendi järgi saab programmeerida nii, et:
- kasutaja maksab **kaardiga** Stripe’i kaudu (IBAN’it käsitsi sisestama ei pea);
- **programm loeb ise ära**, kas ja kuni millal kasutajal on toetus kehtiv;
- täisfunktsioon lubatakse ainult siis, kui toetus on kehtiv (või kui ta on sisselogitud ja toetuse kontrolli pole veel sisse lülitatud).

## Ülevaade voost

1. Kasutaja valib hinnakirjal/toeta lehel kuude arvu ja vajutab „Toeta“.
2. Kui ta on sisselogitud, frontend kutsub backend’i API-d **Create Checkout Session** (Stripe).
3. Kasutaja suunatakse Stripe Checkout lehele ja maksab kaardiga.
4. Pärast edukat makset Stripe kutsub sinu backend’i **webhook’iga** – backend salvestab: „see e-mail on toetanud kuni kuupäev X“.
5. Frontend küsib vajadusel API-st **toetuse staatust** (e-maili järgi) ja näitab täisfunktsiooni või demo režiimi.

Andmebaas (Vercel KV või Supabase) hoiab seost: `e-mail → toetus kehtib kuni (kuupäev)`.

## 1. Stripe konto ja võtmed

1. Loo konto: [dashboard.stripe.com](https://dashboard.stripe.com).
2. **Developers → API keys**: kopeeri **Publishable key** (pk_…) ja **Secret key** (sk_…).
3. **Developers → Webhooks**: lisa endpoint `https://SINU-DOMEEN.vercel.app/api/stripe-webhook`, sündmus **checkout.session.completed**.
4. Loo **Webhook signing secret** (whsec_…) ja lisa see keskkonnamuutujate hulka.

Keskkonnamuutujad (Vercel Project → Settings → Environment Variables):

- `STRIPE_SECRET_KEY` = sk_…
- `STRIPE_WEBHOOK_SECRET` = whsec_…
- `STRIPE_PUBLISHABLE_KEY` = pk_… (vajalik frontend’ile; Vite puhul `VITE_STRIPE_PUBLISHABLE_KEY`)

## 2. Andmebaas: kuhu toetuse kehtivus kirjutada

Variant **A – Vercel KV (soovitus)**

1. Vercel’is: Project → Storage → Create Database → **KV**.
2. Ühenda see oma projektiga; Vercel lisab automaatselt `KV_REST_API_URL` ja `KV_REST_API_TOKEN`.

Variant **B – Supabase (või muu SQL)**

- Loo tabel nt `user_support`: `email` (text, primary), `support_until` (date).
- Webhook’is ja support-status API’s kasuta Supabase client’it selle tabeli lugemiseks/kirjutamiseks.

Projektis on API näidete puhul kasutusel **Vercel KV** (võti: `support:${email}`, väärtus: ISO kuupäev string).

## 3. Backend API otspunktid (Vercel Serverless)

- **POST /api/create-checkout-session**  
  Keha: `{ "months": number, "email": string }`.  
  Loob Stripe Checkout Session’i, tagastab `{ "url": "https://checkout.stripe.com/..." }`.  
  Frontend suunab kasutaja sellele URLile.

- **POST /api/stripe-webhook**  
  Stripe saadab sinna sündmused. Kontrolli `event.type === 'checkout.session.completed'`, võta sealt `client_reference_id` (e-mail) ja ostu metaandmed (kuude arv), arvuta `support_until` ja salvesta andmebaasi (Vercel KV või Supabase).

- **GET /api/support-status?email=...**  
  Tagastab `{ "supportUntil": "YYYY-MM-DD" | null }`.  
  Tootmises tuleks e-mail edastada turvaliselt (nt pärast sisselogimist sessiooni kaudu); praegu võib olla päringu parameeter.

## 4. Frontend

- **Toeta leht**: kui kasutaja on sisselogitud ja valib kuud ning vajutab „Toeta“, kutsutakse `create-checkout-session` ja tehakse suunamine Stripe’i lehele. Kui ei ole sisselogitud, suunatakse registreerumisele.
- **Toetuse staatuse lugemine**: pärast sisselogimist (või lehe laadimist) kutsutakse `getSupportStatus(user.email)`. Tulemus hoitakse kontekstis (nt `supportUntil`).
- **Täisfunktsiooni loogika**: `hasFullAccess = isLoggedIn() && (supportUntil == null || supportUntil >= tänane kuupäev)`. Kui Stripe/KV pole veel seadistatud, võid `supportUntil === null` tõlgendada kui „piirangut ei ole“ (kõik sisseloginud kasutajad täisfunktsiooniga).

## 5. Hinnad ja kuude arv

- Backend’is peavad hinnad ühtima frontend’iga: nt 5 €/kuu, 12 kuud = 55 €.
- Stripe Checkout Session’is kasuta `line_items` ühe (või mitme) rea ga; summa sentides (nt 500 = 5,00 €).
- Soovi korral kasuta `client_reference_id: email`, et webhook’is teada saada, kellele toetus märkida.

## 6. Webhook ja toomine (raw body)

Stripe webhook kontrollib signatuuri; selleks on vaja **toorkeha** (raw body), mitte JSON-parsitud keha. Vercel serverless funktsioonis `api/stripe-webhook.js` loetakse keha käsitsi (`readRawBody`). Kui Vercel keskkonnas keha on juba ära söödud, tuleb Vercel’i konfiguratsioonis või koodis kasutada platvormi pakutud raw body’d (kui olemas). Kohalik testimine: kasuta [Stripe CLI](https://stripe.com/docs/stripe-cli) `stripe listen --forward-to localhost:3000/api/stripe-webhook`.

## 7. Turvalisus

- Webhook’is **alati** kontrolli Stripe signatuuri (`stripe.webhooks.constructEvent` koos `STRIPE_WEBHOOK_SECRET`’iga).
- Tootmises ära looda support-status’ile ainult päringu parameetrile; kasuta sessiooni või JWT’d, et e-mail tuleb usaldusväärsest allikast.
- Stripe võtmed ja webhook secret hoia keskkonnamuutujates, mitte koodis.

## 8. Kokkuvõte

| Samm | Kus | Mis |
|------|-----|-----|
| Makse | Stripe Checkout | Kasutaja maksab kaardiga; IBAN’it ei ole vaja. |
| Kirje „X toetas kuni Y“ | Webhook → andmebaas | `stripe-webhook` + Vercel KV (või Supabase). |
| „Kas mul on täisfunktsioon?“ | Frontend | `support-status` API → `supportUntil` → `hasFullAccess`. |

Pärast seda ei pea sa ise IBAN’i ega makseid käsitsi sisestama – kõik laeb programmeeritud voo järgi ära.
