# Instrumendi vaade ja muudatused koodis

## Kuidas praegu instrumendi valik muudatusi tekitab

### Üks instrument kogu partituuris

- Partituuris on **üks globaalne instrument** (`instrument` state, nt `'piano'`, `'guitar'`).
- **Instrumendi “sisestamine”** = tööriistakast **Instrumendid** → kasutaja klõpsab instrumendi nime peal.
- Selle peale käivitatakse `handleToolboxSelection` (case `'instruments'`):
  - kutsutakse `setInstrument(instId)`;
  - vajadusel uuendatakse `instrumentNotationVariant` (nt standard / tab / fingering) ja `clefType` (treble/bass) vastavalt instrumendi konfiguratsioonile.
- **Uut rida ega uut noodirida ei lisa.** Kogu partituur on endiselt ühe instrumendi ühe (või klaveri puhul kahe) noodiridaga. Muutub ainult **notatsiooni tüüp** (võti, TAB, sõrmestus jms) selle ühe instrumendi jaoks.

### Süsteem koodis praegu

- `computeLayout` arvutab **süsteemid** = **read** (iga rida = üks horisontaalne taktirida, ühe “reavahetusega”).
- Iga süsteem koosneb **ühest noodiridast** (või klaveri puhul kahest ühendatud ridast). Mitut eri instrumenti ühe rea kohta (nt viiul + vioola + tšello ühes plokis) praegu **ei ole**.
- Seega praegu **ei teki** olukorda, kus “instrumentatsiooni rida” erineks “uue reaga” – iga rida on lihtsalt sama instrumendi järgmine rida.

---

## Kas peaks tekkima lisa rida või ühendatud notatsiooni süsteemi märgis?

### Mitme instrumendi korral (tulevik)

Kui kunagi toetatakse **mitut instrumenti** (mitut noodirida) korraga:

- **Üks notatsiooni süsteem** (üks “plokk”) = üks horisontaalne taktirida, kus **mitu noodirida on taktidega ühendatud** (sama taktimõõt, joondatud taktijooned).
- Et eristada “see plokk on üks süsteem (ühe rea instrumentatsioon)” ja “siit algab uus rida”, kasutatakse tavaliselt **süsteemisulge** (ühendatud notatsiooni süsteemi märgis): vasakul küljel olev sulg/kaar, mis ühendab selle süsteemi kõik noodiridad.
- **Lisa rida** võiks tähendada näiteks:
  - eraldusjoont süsteemide vahele või
  - uut rida (uut süsteemi), kus algab uus sulgega plokk.

Seega **jah** – kui koodis lisatakse mitme instrumendi (mitme noodirida) toetus, siis **peaks tekkima**:

1. **Ühendatud notatsiooni süsteemi märgis (süsteemisulg)** – vasakul sulg/kaar, mis ühendab kõik selle rea noodiridad, et oleks selge: need read kuuluvad ühte taktidega joondatud plokki.
2. **Uue reaga** (uue süsteemiga) algab uus selline plokk; vajadusel võib olla ka visuaalne eraldus (nt vahe) või “lisa rida” süsteemide vahel.

### Praegune kood

- Kuna on ainult **üks instrument** ja **üks (või klaveril kaks) noodirida**, siis **praegu** ei ole koodis:
  - mitut rida (st mitut eri instrumendi rida),
  - süsteemisulge ega
  - “lisa rida” süsteemide vahel.
- Need oleks vajalikud alles **siis, kui** lisatakse andmemudel ja UI mitme instrumendi (mitme noodirida) jaoks ning ühe süsteemi sees mitu rida joondatakse taktidega ühte plokki.

---

## Kokkuvõte

| Küsimus | Vastus |
|--------|--------|
| Kuidas instrumendi sisestamisel muudatused praegu tekivad? | Instrumendi valik muudab globaalset `instrument` state’i ja (vajadusel) võtit/notatsiooni varianti. Uut rida ega uut noodirida ei lisa. |
| Kas praegu peaks koodis tekkima lisa rida või süsteemimärgis? | **Praegu ei pea** – on ainult üks instrument. **Mitme instrumendi toetuse korral** peaks tekkima ühendatud notatsiooni süsteemi märgis (süsteemisulg) ja uue reaga eristatav uus süsteem (vajadusel ka “lisa rida” / vahe). |
