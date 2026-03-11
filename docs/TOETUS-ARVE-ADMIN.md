# Toetus e-arvega ja administraatori ligipääs

See juhend kirjeldab voogu, kui **organisatsioon** (nt kool, asutus) soovib rakendust toetada ja kasutada, kuid **ei saa maksta pangakaardi ega pangaülekandega** – ainult **arvega** (e-arvega). Administraator (sina) saad organisatsioonilt konkreetsed **kasutajate e-mailid**, kellele soovitakse täisfunktsiooni, ja annad neile ligipääsu rakenduse kaudu.

## Ülevaade voost

1. **Organisatsioon** (nt Pärnu Päikese kool) võtab sinuga ühendust (e-post, telefon) ja teatab:
   - tahame toetada NoodiMeistrit ja kasutada täisfunktsiooni;
   - maksame **e-arvega** (mitte kaardiga ega ülekandega);
   - siin on **kasutajate e-mailide nimekiri**, kellele soovime ligipääsu.

2. **Sina (administraator):**
   - koostad organisatsioonile **e-arve** (väljaspool NoodiMeisterit – oma raamatupidamise/arvestuse süsteemiga);
   - pärast arve laekumist (või kokkuleppel enne) avad NoodiMeistri **administraatori lehe** ja annad nimekirjas olevatele kontodele täisfunktsiooni kehtivuse.

3. **Rakendus:** need kasutajad logivad sisse oma e-mailiga; rakendus loeb toetuse staatuse (sama KV andmebaas kui Stripe puhul) ja lubab **täisfunktsiooni** kuni sinu määratud kuupäevani.

## Mida sul vaja on

- **Vercel KV** (või muu salvestus), kuhu toetuse kehtivus kirjutatakse – sama, mida kasutavad ka Stripe ja support-status API.
- **ADMIN_SECRET** – tugev salasõna/parool, mida keegi teine ei tea. Seadistad selle **Vercel → Project → Settings → Environment Variables**: `ADMIN_SECRET` = (sinu valitud väärtus).

## Kuidas administraator ligipääsu annab

### Variant 1: Admin-leht brauseris (soovitus)

1. Ava **https://SINU-DOMEEN.vercel.app/admin** (või `http://localhost:5173/admin` kohalikult).
2. Sisesta **Administraatori parool** (sama mis `ADMIN_SECRET` keskkonnas).
3. Kleepi **e-mailide nimekiri** (üks reale või komadega eraldatuna).
4. Vali **Toetus kehtib kuni** (kuupäev).
5. Valikuline: **Märkus** (nt „Pärnu Päikese kool, arve 2024-001”).
6. Vajuta **Anna täisfunktsioon**.

Rakendus saadab päringu backend’ile; kui parool klapib, kirjutatakse iga e-maili kohta andmebaasi „toetus kehtib kuni YYYY-MM-DD”. Need kasutajad saavad kohe täisfunktsiooni kuni selle kuupäevani.

### Variant 2: API otse (skript, Postman)

Kui soovid automatiseerida või kasutada oma skripti:

```http
POST /api/admin/grant-support
Content-Type: application/json
X-Admin-Secret: <SINU_ADMIN_SECRET>

{
  "emails": ["opetaja@kool.ee", "opilane@kool.ee"],
  "supportUntil": "2026-08-31",
  "note": "Pärnu Päikese kool, arve 2024-001"
}
```

- **emails** – massiiv e-mailidega või üks string (read või komadega eraldatud).
- **supportUntil** – kuupäev kujul `YYYY-MM-DD`.
- **note** – valikuline märkus (salvestatakse, et hiljem teada saada, kellele ja mille kohta).

## Turvalisus

- **ADMIN_SECRET** hoia ainult keskkonnamuutujas (Vercel); ära lisa seda koodi ega avalikku repositooriumi.
- Admin-leht (`/admin`) on avalikult nähtav (igaüks võib lehe avada); ligipääs toimub **ainult parooli** kaudu. Kasuta tugevat parooli ja ära jaga seda.
- Soovi korral võid admin-lehe peita (nt ei lisa avalikku menüüsse linki) – ligipääs siis otse aadressi `/admin` kaudu.

## Kokkuvõte

| Samm | Kes | Mis |
|------|-----|-----|
| Taotlus | Organisatsioon | Ühendus sinuga; nimekiri e-mailidega; makse e-arvega. |
| Arve | Sina | Koostad e-arve oma süsteemis; saadad organisatsioonile. |
| Ligipääsu andmine | Sina | Ava `/admin`, sisesta parool ja e-mailid, vali kehtivuse lõpp, kinnita. |
| Täisfunktsioon | Rakendus | Kasutajad logivad sisse; rakendus loeb toetuse KV-st ja lubab täisfunktsiooni. |

Sama andmebaas (Vercel KV võti `support:<email>`) kasutab nii Stripe makseid kui ka administraatori poolt antud ligipääsu – seega üksik kasutaja võib omada nii kaardiga makstud toetust kui ka organisatsiooni e-arvega antud ligipääsu; kehtib see kuupäev, mis on kaugeim tulevikus.
