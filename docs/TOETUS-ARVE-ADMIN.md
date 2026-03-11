# Toetus e-arvega ja administraatori ligipääs

See juhend kirjeldab voogu, kui **organisatsioon** (nt kool, asutus) soovib rakendust toetada ja kasutada, kuid **ei saa maksta pangakaardi ega pangaülekandega** – ainult **arvega** (e-arvega). Administraator (sina) saad organisatsioonilt konkreetsed **kasutajate e-mailid**, kellele soovitakse täisfunktsiooni, ja annad neile ligipääsu rakenduse kaudu.

## Ühekordne administraatori registreerimine

- **Aadress:** `https://noodimeister.ee/administraator-registreerimine`. Sellel lehel saab **ainult üks kord** registreerida **ühe** administraatori konto. Pärast seda ei saa keegi teine enam siin kontot luua.
- **Kuidas:** ava leht, sisesta **ADMIN_SECRET** (salajane võti), oma **e-mail** ja **administraatori parool** (min 8 tähemärki). Pärast kinnitamist on see e-mail ainus administraatori konto. Seejärel loo (kui pole veel) tavaline NoodiMeisteri konto **sama e-mailiga** (registreeru või Google/Microsoft), mine `/administraator` ja sisesta äsja valitud administraatori parool.
- Kui administraator on juba registreeritud, leht näitab teadet ja linki `/administraator`-ile. Rohkem kontosid lisada ei saa.

## Peidetud administraatori leht

- **Aadress:** `https://noodimeister.ee/administraator`. Leht **ei ole** avaliku menüü ega jaluse link – ligipääs ainult otse URLi kaudu.
- **Nõuded:** oled **sisselogitud** oma administraatori kontoga (sama e-mail, mis ühekordsel registreerimisel) ja sisestad **administraatori parooli**. Parool tuleb vahetada **iga 3 kuud**.
- **Kes on administraator:** kas (1) ühekordsel registreerimisel määratud ainus e-mail (salvestatakse KV-sse), või (2) kui registreerimist pole tehtud, siis Vercel `ADMIN_EMAILS`. Ainult selle e-mailiga sisseloginud kasutaja pääseb administraatori töölauale.

## Ülevaade voost

1. **Organisatsioon** (nt Pärnu Päikese kool) võtab sinuga ühendust ja teatab: toetame, maksame e-arvega, siin on kasutajate e-mailid.
2. **Sina:** koostad e-arve oma süsteemis; pärast laekumist avad **/administraator**, logid sisse oma kontoga, sisestad administraatori parooli ja annad nimekirjas olevatele kontodele täisfunktsiooni.
3. **Rakendus:** need kasutajad saavad täisfunktsiooni kuni sinu määratud kuupäevani (sama KV kui Stripe puhul).

## Keskkonnamuutujad (Vercel)

| Muutuja | Kirjeldus |
|---------|-----------|
| **ADMIN_SECRET** | Salajane võti. Vajalik: (1) ühekordsel registreerimisel lehel /administraator-registreerimine; (2) API otse autentimiseks (header `X-Admin-Secret`). |
| **ADMIN_EMAILS** | Kui ühekordset registreerimist **pole** tehtud: komadega eraldatud e-mailid, kes pääsevad /administraator lehele. Kui registreerimine on tehtud, kasutatakse ainult KV-s salvestatud ainsat administraatori e-maili. |

## Administraatori parool ja 3 kuud

- **Esimene kord:** kui administraatori parooli pole veel seatud, pead sisestama **ADMIN_SECRET** (salajane võti) ja valima uue administraatori parooli (vähemalt 8 tähemärki). Seda teed ainult üks kord.
- **Järgmised korrad:** avad /administraator, logid sisse oma kontoga (e-mail ADMIN_EMAILS nimekirjas), sisestad **administraatori parooli** ja saad ligipääsu vormile „Anna täisfunktsioon”.
- **Iga 3 kuud:** süsteem palub parooli vahetada. Sisestad praeguse ja uue parooli; pärast seda saad jätkata.

Parool salvestatakse räsitult (KV); ADMIN_SECRET jääb ainult keskkonnamuutujasse.

## Kuidas ligipääsu annad (administraatori lehel)

1. Ava **https://SINU-DOMEEN/administraator**.
2. Kui ei ole sisselogitud, suunatakse sisselogimise lehele (pärast sisselogimist tagasi /administraator).
3. Sisesta **administraatori parool** (või esmakordsel seadistamisel ADMIN_SECRET ja uus parool).
4. Kui süsteem palub, **vaheta parool** (praegune + uus).
5. **Töölaual** saad: näha **toetuse saanud kontode nimekirja** (e-mail, kehtib kuni, märkus), avada **rakenduse lingid** (Minu tööd, tööriist, hinnakiri, toeta, konto, avaleht) ja **anna täisfunktsiooni** uutele e-mailidele (vorm: e-mailid, kehtivuse lõpp, märkus).

Vana aadress **/admin** suunab automaatselt **/administraator**-ile.

## API otse (valikuline)

Kui soovid skriptiga või Postmaniga anda ligipääsu, saad endiselt kasutada headerit **X-Admin-Secret** (võrdub ADMIN_SECRET):

```http
POST /api/admin/grant-support
Content-Type: application/json
X-Admin-Secret: <ADMIN_SECRET>

{ "emails": ["a@kool.ee"], "supportUntil": "2026-08-31", "note": "Pärnu Päikese kool" }
```

Või pärast parooli sisestamist brauseris saad seansi (JWT); API aktsepteerib ka **Authorization: Bearer &lt;JWT&gt;** (sama, mida brauser saadab).

## Turvalisus

- **ADMIN_EMAILS** ja **ADMIN_SECRET** hoia Vercel keskkonnas; ära lisa neid koodi ega repositooriumi.
- Leht /administraator on avalikult laaditav (URL on teada), kuid sisu ja toimingud on kaitstud: ainult ADMIN_EMAILS kontod ja õige administraatori parool (või ADMIN_SECRET API puhul) annavad ligipääsu.
- Parool salvestatakse räsitult; 3-kuine vahetus vähendab riski.

## Kokkuvõte

| Samm | Kes | Mis |
|------|-----|-----|
| Taotlus | Organisatsioon | Ühendus; nimekiri e-mailidega; makse e-arvega. |
| Arve | Sina | Koostad e-arve oma süsteemis. |
| Ligipääsu andmine | Sina | Ava /administraator, logi sisse, sisesta admin-parool (vaheta 3 kuu järel), anna e-mailidele kehtivus. |
| Täisfunktsioon | Rakendus | Kasutajad logivad sisse; rakendus loeb toetuse KV-st. |

Sama KV (`support:<email>`) kasutavad nii Stripe maksed kui ka administraatori antud ligipääs; kehtib kaugeim kuupäev.
