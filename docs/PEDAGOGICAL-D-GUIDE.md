# Juhis: pedagoogiline kuvarežiim D pärast A-s noodistamist

**Eesmärk:** kui lugu on **A**-s (JO-võti + noodid) valmis, lülita **D** (interaktiivne / õppematerjal), et siduda taustheli või video, stseenid (cue), playhead ja harjutus — **ilma nootide ümberkirjutamiseta**.

**Seotud:** `AGENTS.md` → pedagoogilised kuvarežiimid A/B/C/D; `docs/PEDAGOGICAL-NOTATION-REQUIREMENTS.md` §5.

---

## 1. Mis on A vs D (ühe lausega)

| Režiim | Mis see on | Mida seal teed |
|--------|------------|----------------|
| **A** | Noodistus / korrastus | Sisesta ja paranda noodid, rütm, laulusõnad, JO |
| **B / C** | Sama loo kuvavaated | Käemärgid (B all, C asendab pead) |
| **D** | Interaktiivne õppematerjal | Heli/video, sync, cue’d, meedia-toolbar, animatsioon |

A, B, C ja D on **sama faili** vaated (`notes[]` ei dubleeru ega kao). Noodid kirjuta **A**-s; playbacki UI elab **ainult D**-s.

---

## 2. Eeltingimused (A-s)

1. Loo või ava **pedagoogiline** töö (notatsioonimeetod: Pedagoogiline / `vabanotatsioon`).
2. Ülemisel **Režiim/meetod** ribal: **P** (pedagoogiline) → kuvarežiim **A**.
3. Sisesta noodid (N-režiim: A–G / MIDI / palett), taktimõõt, vajadusel laulusõnad.
4. Salvesta töö (kohalik või pilv), et D-sse minek ei kaoks õnnetusel.

---

## 3. Üleminek A → D

1. Veendu, et oled **pedagoogilises** failis (riba: Pedagoogiline notatsioon).
2. Klõpsa ribal **D** (või Seaded → kuvarežiim **D · Interaktiivne**).
3. Noodigraafika jääb samaks (D kasutab A layout’i); lisanduvad:
   - ülemine paneel **Taustheli / animeerimine** (assets, cue’d, kursori stiil);
   - alumine **pedagoogiline meedia-toolbar** (MP3, BPM, sync, loop, noodijoon, video).

**Tagasi A-sse:** klõpsa ribal **A** (või B/C). D-st lahkudes peatatakse taasesitus automaatselt — noodistus jääb puhtaks.

---

## 4. Põhivoog D-s (pärast valmis noote)

### 4.1 Lae taustheli

1. Alumisel toolbar’il: **Vali helifail…** (MP3 jms).
2. Sea **BPM** nii, et kursor jookseks koos salvestisega (vajadusel Sync: BPM või ankrud).
3. **Step** (1/4, 1/8, 1/16) määrab transporti sammu.
4. Vajadusel **Loop** + korduste arv.

### 4.2 Stseenid (cue)

Ülemises D-paneelis **Pedagoogilised stseenid (cue)**:

1. Sea **Algus s** / **Lõpp s** (media aeg sekundites).
2. Valikuline tekst, pilt/GIF, **Peida noodileht** selle stseeni ajal.
3. **Lisa stseen** — stseenid ilmuvad ajajoonele.
4. Stseenide ruler: **Vaade → Video editor ruler (pedagoogiline)**.

### 4.3 Playhead / kursori kuju

Samast paneelist: püstine joon, emoji (nt viiul), liikumise stiil (kaar / sirge), värv ja paistvus — õpilasele “lugemiskursor”.

### 4.4 Harjuta

1. Käivita taasesitus meedia-toolbar’ist või seotud Play-voo kaudu.
2. Kursor liigub noodistikus heli ajaga (BPM / sync).
3. Loopiga korda raskeid lõike.
4. Kui midagi noodis on vale → **A**, paranda, tagasi **D** (andmed samad).

### 4.5 Animation Record (valikuline)

1. Lülita **Live preview ala: ON**.
2. Joonista noodilehele stseeniala (katkendjooneline ristkülik).
3. Siis muutub **Animation Record** aktiivseks — salvestab valitud ala.

---

## 5. Mida D-s mitte teha

- Ära kasuta D-d peamise **noodisisestuse** kohana — sisestus ja korrastus on A (ja vajadusel B/C kuvana).
- Ära oota eraldi “Uus Muusika stuudio” Minu tööd nuppu: see on toote mustand; **praegu** on D = pedagoogilise faili kuvarežiim.
- Ära jäta D peale, kui õpetaja peab noote muutma — lülitu A-sse, et playback ei segaks.

---

## 6. Lühike kontrollnimekiri

- [ ] A-s noodid valmis ja salvestatud  
- [ ] Riba: P → **D**  
- [ ] Helifail laetud, BPM sobib  
- [ ] Cue’d / playhead seadistatud (kui vaja)  
- [ ] Harjutus: play + loop töötab  
- [ ] Tagasi A: playback peatub; noodid alles  

---

## 7. Kus juhend rakenduses

**Kuidas?** (`/kuidas`) → küsimus *„Kuidas pedagoogilises A-s valmis loost teha interaktiivne D?“*.
