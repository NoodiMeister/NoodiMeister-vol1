# Pedagoogilise notatsiooni funktsiooninõuded

See dokument sõnastab pedagoogilise notatsiooni jaoks vajalikud funktsioonid, **eraldades need figuurnotatsiooni süsteemist**. Implementeerimine tuleb hiljem; siin on ainult nõuded ja piirangud.

---

## Põhimõte

- **Pedagoogiline notatsioon** kasutab JO-võtit, JO-LE-MI nimesid, Kodály rütmisilpe jne. See on iseseisev meetod.
- **Figuurnotatsioon** on oma süsteem (värvid, kujundid, võre). Pedagoogilise notatsiooni uued võimalused ei tohi sõltuda figuurnotatsiooni konstantidest ega loogikast.
- Uued funktsioonid peavad olema **pedagoogilise notatsiooni seaded / andmestruktuur**, mitte figuurnotatsiooni laiendused.

---

## 1. Noodijoonestiku joonte arv

**Nõue:** Kasutaja peab saama valida, **kui mitut noodijoonestiku joont** (noodirea) pedagoogilises notatsioonis kasutatakse.

**Detailid:**

- Valik kehtib **ainult pedagoogilise notatsiooni** režiimis (JO-LE-MI).
- Selle funktsiooni eesmärk ei ole ainult “mitu joont joonistada”, vaid anda kasutajale võimalus **valida, milliseid astme nimetusi (JO, LE, MI, NA, SO, RA, DI) ta soovib aktiivselt kasutada**, lähtudes pedagoogilise notatsiooni **värvisüsteemist**.\n+  - Praktikas tähendab see, et kasutaja saab koostada **aktiivsete astmete komplekti** (nt ainult JO–MI–SO–RA) ning ülejäänud astmed jäävad välja (nt neid ei kuvata/ei pakuta/ei värvita vastavalt; täpne käitumine lepitakse hiljem kokku, aga valik peab olema võimalik).\n+- Noodijoonestiku joonte arvu valik peab toetama vähemalt:\n+  - **2-jooneline joonestik**\n+  - **3-jooneline joonestik**\n+  (lisaks võivad hiljem tulla 1/5-jooneline, kuid käesolev nõue rõhutab 2 ja 3 joont).\n+- **2- ja 3-joonelise joonestiku korral** peab olema võimalik kasutada nii:\n+  - **joonte pealseid alasid** (st joone “peal” asuvad positsioonid)\n+  - **joonte vahelisi alasid** (st vahed joonte vahel)\n+  See tähendab, et astmete “asendid” ei piirdu ainult joonega – lubatud on ka vahe-positsioonid, et astmete paigutus oleks piisava eraldusvõimega.\n+- Joonte arv mõjutab:\n+  - millised “tasandid/positsioonid” on kasutusel astmete kuvamiseks;\n+  - kuidas JO-võti ja muud pedagoogilised märgised (nimed, värvid, kujundid) joonestikul ankurdavad.\n+- See on **pedagoogilise notatsiooni seade**, mitte figuurnotatsiooni võre ega traditsioonilise noodikirja üldine paigutusvalik.

**Ei kuulu siia:** Figuurnotatsiooni võre või traditsioonilise noodijoonestiku üldine „5 vs 1 joon” loogika tervikuna – need jäävad oma meetodite alla. Nõue kehtib **pedagoogilise notatsiooni** kontekstis.

---

## 2. Oma värvikombinatsioonid (mitte figuurnotatsiooni värvid)

**Nõue:** Pedagoogilise notatsiooni jaoks peab olema võimalik **määratleda teistsuguseid värvi kombinatsioone**, mis **ei ole figuurnotatsiooniga seotud**.

**Detailid:**

- Praegu võib pedagoogiline värv tulla ühest skeemist (nt sama võti nagu figuurnotatsioonil). Nõue on: **pedagoogilise notatsiooni värvid peavad olema oma andmestruktuur / valik**.
- Kasutaja (või õpetaja) peab saama valida või määratleda **värviskeemi** ainult pedagoogilise notatsiooni jaoks, nt:
  - JO (I aste) = üks värv, LE (II aste) = teine värv, jne;
  - või täiesti teine 7 (või N) tooni jaoks eraldi palett.
- Värvid on seotud **JO suhtes diatoonilise astmega** (I, II, … VII), mitte absoluutse tooniga. Figuurnotatsiooni absoluutsed värvid ei määra pedagoogilise notatsiooni värve.
- Võimalikud lahendused (spetsifikatsiooni tasemel): valik eeldefineeritud palettide hulgast (nt „klassikaline”, „pehme”, „Orff”) või kohandatav palett (iga astme värv konfigureeritav). Täpne andmemudel jääb implementatsiooni faasi.
- **Piirang:** Figuurnotatsiooni konstandid (nt `FIGURENOTES_COLORS`) ei tohi olla ainus allikas pedagoogilise notatsiooni värvide jaoks. Pedagoogiline notatsioon peab saama värvid **omast konfiguratsioonist**.

### 2.1 Esmane kasutaja poolt antud värviskeem (näide / lähteväärtused)

Allolev skeem peab olema toetatud pedagoogilise notatsiooni konfiguratsioonina (st mitte figuurnotatsiooni värvide tuletis).\n+
- **JO**: must\n+- **MI**: sinine\n+- **SO**: punane\n+- **RA**: roheline\n+
Märkused:\n+
- Kui kõik 7 astet on aktiivsed, tuleb määrata ka ülejäänud astmete (LE, NA, DI) värvid (kas eraldi või mõne reegli abil). Hetkel on antud minimaalsed nõutud seosed (JO/MI/SO/RA).\n+- Kui kasutaja valib (punkt 1 järgi) ainult osa astmetest, siis värviskeem peab toimima vähemalt valitud astmete jaoks.

---

## 3. Erisugused kujundid (Orff-pedagoogika: kellad, torud jms)

**Nõue:** Pedagoogilise notatsiooni jaoks peab olema võimalik kasutada **erisuguseid kujundeid**, sh **kellad ja torud** (vastavalt Orff-pedagoogikast tulenevatele instrumentidele), **nootidega seotud värvidega**.

**Detailid:**

- Praegu võivad kujundid (ruut, ring, kolmnurk jne) olla jagatud või inspireeritud figuurnotatsioonist. Nõue on: **pedagoogilise notatsiooni kujundid peavad olema oma valik / süsteem**, seotud pedagoogilise meetodiga (sh Orff).
- **Orff-instrumentid:** metallofonid, ksülofonid, kellad (kellamäng), torud jms – iga toon või astme võib olla seotud konkreetse kujundi või sümboliga (nt kella kujund, toru kujund).
- Kujundid on seotud **noodiga** (JO suhtes oktaav või aste) ja **värvidega** – nt sama värvi reegel nagu punkt 2, kuid kujund tuleb Orff-instrumentide loogikast, mitte figuurnotatsiooni kujundite loogikast.
- Võimalikud lahendused (spetsifikatsiooni tasemel): valik kujundistikust (nt „tavaline” [ruut/ring/kolmnurk], „Orff kellad”, „Orff torud”) või instrumentide põhine seadistus. Täpne andmemudel jääb implementatsiooni faasi.
- **Piirang:** Figuurnotatsiooni kujundite loogika ei tohi olla ainus allikas pedagoogilise notatsiooni kujundite jaoks. Pedagoogiline notatsioon peab saama kujundid **omast konfiguratsioonist** (Orff või muu meetod).

---

## 4. Astme trepp ja käemärgid: eritasandiline JO-LE-MI notatsioon (ruudud)

**Nõue:** Pedagoogilise notatsiooni jaoks peab olema võimalik kasutada **astme trepil ja käemärkidel põhinevat eritasandilist JO-LE-MI notatsiooni**, kus **iga trepiastme tasand on visuaalselt joonistatud ruutkujunditega** (nagu trepp – nt Super Mario stiilis).

**Detailid:**

- **Astme trepp** (I, II, … VII aste – iga aste on trepi üks „samm”) ja **käemärgid** (Kodály käemärgid iga astme jaoks) on JO-LE-MI meetodi osa. Nõue on: neil põhinev **eritasandiline** vaade – iga diatooniline aste on oma trepiastme tasand.
- **Visuaal:** trepi astmed joonistatakse **ruutkujunditega** – iga astme tasand on üks ruut või ruutude rida, nii et nootide asukoht (JO, LE, MI, …) on kohe loetav astme järgi; kujund meenutab treppi (nt JO alumine, DI ülemine).
- See on **erinev** tavalise noodijoonestiku vaatest: siin ei pruugi olla klassikalist 5-joont; asemel on astme trepp, kus ruudud tähistavad iga trepiastet (ja vajadusel ka käemärki või nime).
- Võimalikud lahendused (spetsifikatsiooni tasemel): valik vaate režiimist (nt „tavaline noodijoonestik” vs „astme trepp ruutudega”); ruutude paigutus on **trepp** (vertikaalne: JO alumine, DI ülemine, või horisontaalselt samm-sammult). Täpne paigutus ja andmemudel jäävad implementatsiooni faasi.
- **Eraldus:** See on pedagoogilise notatsiooni **oma vaate tüüp** (astme trepp + käemärkide loogika, ruutkujunditega). Figuurnotatsiooni võre või kujundite süsteem ei määra seda; ruudud siin tähistavad **astme trepi tasandeid** JO-LE-MI süsteemis, mitte figuurnotatsiooni oktaavikujundeid.

---

---

## 5. Pedagoogilised kuvarežiimid A / B / C / D

**Nõue:** Pedagoogilise notatsiooni (`sourceNotationMode` / `vabanotatsioon`) **sees** peab olema valitav kuvarežiim `pedagogicalDisplayMode`. See on **vaade sama loo andmete peal**, mitte uus fail ega eraldi nootide koopia.

| Kood | Väärtus | Sisuliselt |
|------|---------|------------|
| **A** | `joStaff` | JO-võti + noodijoonestik + noodiglüüfid (praegune vaikimisi pedagoogiline vaade; **sisestus**) |
| **B** | `joStaffHandSigns` | JO-võti + noodijooned; käemärgid **noodi all**, **enne** laulusõnu |
| **C** | `handSignLyrics` | **7 astmejoont** (JO…DI); käemärgid **noodi glüüfide asemel**; laulusõnad joonte all |
| **D** | `interactive` | **Interaktiivne / playback**: taustheli, cue’d, playhead, meedia-toolbar, animatsiooni eksport |

### 5.1 Ühine andmemudel (A ↔ B ↔ C ↔ D)

- Samad `notes[]` (pitch, duration, beat), `lyric*`, `timeSignature`, `keySignature`, `joClefStaffPosition`.
- Režiimivahetus ei tohi muuta ega dubleerida nootide andmeid.
- Sisestus ja korrastus toimuvad peamiselt **A**-s (ka B/C kuvana); **D ei tohi** olla vaikimisi peal ega segada nootide loomist.
- Playbacki andmed (audio, cue’d, sync) võivad failis olla olemas ka A/B/C ajal, kuid nende **UI ja runtime** on ainult D-s.

#### Kirjutamispiirkond: C4+ (kohustuslik A-s ja seega B/C andmetes)

- Pedagoogilise sisestuse **alumine ankur on absoluutne C4** (MIDI ≥ 60).
- Vaikimisi ghost = **C4**; oktaavi nihutus (`Shift+↑/↓`) lubab **4…6**, mitte alla 4.
- Tähekäsk A–G valib oktavi nii, et tulemus ei jää alla C4 (nt ghost C4 + klahv `B` → **B4**, mitte B3).
- Käemärkide (C) 7 joont JO…DI loetakse samast `notes[]` andmest; C4-põhi hoiab põhioktaavi bassi libisemast.

### 5.2 Režiim C (testprototüüp) – fikseeritud reeglid

- **7 horisontaalset joont** üksteise kohal/all; alumine = JO, ülemine = DI (üks diatooniline oktaav).
- Iga joon = üks aste; vertikaalne asukoht tuleb JO-ankru diatoonilisest astmest (`getJoName` / degree index 0…6).
- **Taktijooned** ulatuvad selgelt **1. joonest 7. jooneni**.
- Noodipea asemel **käemärk** (uTheory teacher; RTL peegel **ainult renderdamisel**).
- **X-paigutus** järgib taktimõõtu / beat’i (`measureWidths` / beatWidth, sh slotid löögis): ti-ti (1/8+1/8) = käemärgid **lähestikku**.
- Laulusõnad: üks rida **7 joone all**.
- Oktaavinihe väljaspool JO…DI: prototüübis clamp 0…6 (märkida UI-s).
- **Style** (ülemine Režiim/meetod riba, ainult C): `handSignStyle.sizePercent` 50…200 (vektorskaala; 200% = 2×) ja `handSignStyle.contrast` 0…1 (joone paksus peenike → väga paks). Fontifaile ei muudeta (CC BY-NC-ND).

### 5.3 Režiim B (`joStaffHandSigns`) — spetsifikatsioon (implementatsioon pärast C smoke’i)

B on **kirjeldatud ja koodis olemas** (`PEDAGOGICAL_DISPLAY_B`), kuid UI-s teadlikult **lukus** („Tulekul“); `resolvePedagogicalRenderMode(B)` renderdab ajutiselt A geomeetriat.

**Sihtkäitumine (kui B avatakse):**

- **Sama staff mis A:** JO-võti + 5-jooneline noodijoonestik + noodiglüüfid (pitch Y nagu A).
- **Käemärk iga noodi all** (uTheory teacher; RTL peegel ainult renderdamisel), **enne** laulusõnarida.
- **X** = sama beat/taktimõõt kui A (ti-ti lähestikku).
- **Y käemärgil** = fikseeritud offset noodipea all (mitte 7-astejooneline C-layout).
- Laulusõnad: üks rida käemärkide **all**.
- Andmed: sama `notes[]` / lyrics mis A; režiimivahetus ei dubleeri noote.
- Sisestus eelistatult A-s; B on peamiselt **kuvamine** (õpetaja vaade).

### 5.4 Režiim D (interaktiivne)

- D on **eraldi režiim** pedagoogilise all: playback, stseenid (cue), playhead-stiilid, alumine meedia-toolbar, video ruler, animatsiooni eksport.
- A/B/C-s neid süsteeme **ei kuvata** ega käivitata; D-st lahkudes peatatakse taasesitus.
- Score’i geomeetria D-s järgib A-d (`resolvePedagogicalRenderMode`); overlay’d on D-spetsiifilised.

---

## Kokkuvõte

| Nr | Funktsioon | Eraldus figuurnotatsioonist |
|----|------------|-----------------------------|
| 1  | Noodijoonestiku joonte arvu valik (1, 3, 5, …) | Kehtib ainult pedagoogilise notatsiooni režiimis; oma seade, mitte figuurnotatsiooni võre. |
| 2  | Oma värvikombinatsioonid (JO suhtes) | Värvid tulevad pedagoogilise notatsiooni konfiguratsioonist, mitte figuurnotatsiooni konstantidest. |
| 3  | Erisugused kujundid (kellad, torud, Orff) | Kujundid tulevad pedagoogilise notatsiooni / Orff konfiguratsioonist, mitte figuurnotatsiooni kujundite loogikast. |
| 4  | Astme trepp ja käemärgid: eritasandiline JO-LE-MI (ruududega) | Oma vaate tüüp; ruudud tähistavad astme trepi tasandeid, mitte figuurnotatsiooni kujundeid. |
| 5  | Kuvarežiimid A / B / C / D | Pedagoogilise faili sisene vaade; A–C noodistus; D interaktiivne playback; sama note/lyric tõde. |

Kõik nõuded on mõeldud **pedagoogilise notatsiooni** jaoks ja peavad olema implementeeritud nii, et figuurnotatsiooni süsteem jääb eraldi; ühine võib olla ainult tehniline abikiht (nt ühine joonistusmootor), mitte andmemudel ega äriline loogika.
