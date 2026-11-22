# Muusika stuudio — hub + Montaaž

**Staatus:** MVP teostuses (`/stuudio`, Minu tööd hub).  
**Seotud:** `AGENTS.md` → Standard: Muusika stuudio (hub) + Montaaž.

---

## 1. Hub (Minu tööd)

Nupp **„Muusika stuudio“** asendab otsest „Ava kujundaja“. Hüpik:

1. **Kujundaja** — kirjastuse kujundaja → `/kujundaja`
2. **Montaaž** — õppematerjali montaaž → `/stuudio?new=1`

`.nms` failid avanevad Montaažis; `.nmc` Kujundajas; `.nm` noodigraafikas.

---

## 2. Montaaž — kõva reegel

**Null noodigraafika redaktori tööriista.** Ainult:

- Import (MusicXML / rikas `.nm`)
- Stseenikastid (nimed)
- Heli + Soundslice-tüüpi sync
- Playback cursor (stiil + emoji + quantize hüpetel)
- Salvestus `.nms`

---

## 3. Ekraan

```text
┌─ Montaaž · pealkiri ──── [Import|Stseenid|Sync|Cursor|Video] [Salvesta] ─┐
├──────────────────────────────┬──────────────────────────────────────────┤
│  A) Tööfail / partituur      │  B) Heli / media + mini-ruler            │
│     (ainult vaade + playhead)│                                          │
├──────────────────────────────┴──────────────────────────────────────────┤
│  C) Videoredaktor (tööfaili all) — 3 rida:                              │
│     1) Heli · 2) Stseenid · 3) Sync (+ quantize + playhead)            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Videoredaktor** elab **imporditud tööfaili all** (`src/studio/MontageTimeline.jsx`):
- **Rida 1 — Heli:** helifaili kandmine (nupp / klõps / drag-drop)
- **Rida 2 — Stseenid:** oma rida; lohista / venita; topeltklõps lisab
- **Rida 3 — Sync:** sync toimub **videoredaktoris** (topeltklõps / nupp / ankrute lohistamine)
- **Quantize** `1/2`…`1/32` + playhead. Ei ole CapCut-tüüpi NLE.

Implementatsioon: `src/pages/MusicStudioPage.jsx`, mudel `src/document/musicStudioDocumentModel.js`.

---

## 4. Andmemudel (lühike)

```jsonc
{
  "docType": "noodimeister-music-studio",
  "projectKind": "musicStudio",
  "title": "…",
  "score": {
    "source": "noodimeister" | "musicxml",
    "snapshot": { /* rikas .nm */ },
    "musicXml": "…",
    "link": null,
    "displayName": "…"
  },
  "media": { "kind": "audioFile", "local": { "fileName": "…", "objectUrl": null } },
  "sync": { "mode": "measureMap", "unit": "measure", "points": [ /* measureIndex, mediaSec */ ] },
  "scenes": [ { "id": "…", "name": "1" | "A" | "Intro", "startSec": 0, "endSec": null } ],
  "playback": {
    "cursor": {
      "motion": "linear" | "jump" | "arc" | "triangleJump",
      "emoji": "┃",
      "quantize": { "enabled": true, "unit": "1/4" | "1/8" | "1/16" | "1/2" | "1/1" | "1/32" }
    }
  }
}
```

**Quantize:** rütmivõre — kui tihedalt playhead hüppab. `1/8` peenem kui `1/4`. Kui noodid on peenemad kui võre (nt 1/16 vs quantize 1/8), playhead hüppab hõredamalt; floor-snap = ootab järgmise ruuduni.

**Pedagoogika:** `1/8` / `1/16` (jt peenemad) aitavad kooliõpilastel **tajuda kiiremate vältuste rütmi** — hüpped visualiseerivad pulsatsiooni, mida sirge playhead ei anna.

---

## 5. Video + Drive (esitlus)

- **Poolik montaaž** = `.nms` (draft) Drive kaustas — avatav Montaažis edasi töötamiseks.
- **Valmis / esitlusvideo** = videofail (MP4/WebM) **alla laetav** arvutisse **ja** salvestatav Drive’i (eelistatult **sama kaust** mis nooditööfail).
- Video peab olema **eraldiseisvalt esitatav** (õpetaja jagab Drive’ist ilma redaktorita).
- `.nms` hoiab `videoAsset` / `export` viidet; binaar ei lähe JSON-i sisse.

## 6. Faasid

**MVP (praegu):** hub, import, heli, sync, stseenid, playhead, **timeline tööfaili all**, Drive `.nms`, **sisseehitatud video render** (`src/studio/montageVideoRender.js` — MP4 kui brauser toetab, muidu WebM) + allalaadimine / Drive.

**Järgmine:** score SVG render montaaži kaadris, autosync, OneDrive parity.
