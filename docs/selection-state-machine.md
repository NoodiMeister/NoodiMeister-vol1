# Noodimeister Selection State Machine (v1)

See dokument fikseerib Noodimeistri valiku (selection) käitumise nii, et see oleks deterministlik ja sama kõikides režiimides.

## Eesmärk

- üks tõde selection state'ile
- ühesed modifikaatorireeglid (`Click`, `Shift`, `Cmd/Ctrl`)
- alati nähtav visuaalne tagasiside
- käsud (`Delete`, `Copy`, `Paste`) sõltuvad selection tüübist, mitte vaate spetsiifikast
- **pointer click** aktiveerib objekti **ja** avab vastava toolbox’i (`pointerClickPolicy.js`)

## State tüübid

| AGENTS nimi | Runtime `kind` (praegu) | Näide |
|---|---|---|
| `none` | `none` | — |
| `singleNote` | `note` | üks noot/paus |
| `noteRange` | `range` | järjestikune nootide ajavahemik |
| `measureRange` | `measureRange` | üks või mitu takti |
| `singleObject` | `singleObject` | barline, repeat, clef, textBox |
| `objectList` | `objectList` | Cmd/Ctrl multi-select (osaliselt) |

## Pointer click → selection → toolbox

| Hit target | Next state | Toolbox | Lubatud käsud / UX |
|---|---|---|---|
| Tühi takt (väljaspool noodi hit’i) | `measureRange` (üks takt) | `layout` | reavahetus / ühendus; **mitte** note-käsud |
| Taktijoon / topelt / kordus / hüpe | `singleObject` | `repeatsJumps` | Backspace → single barline / eemalda märk |
| Tekstikast / pealkiri / autor | `singleObject` (text*) | `textBox` (+ floating text) | redigeeri teksti |
| Võti (clef) | `singleObject` (clef) | `clefs` | vaheta glüüf → score uueneb |
| Noot / paus (noodipea hit) | `note` | `rhythm` + **N-mode** | ↑↓ kõrgus; kestus; akordimärk noodi beat’ile; measure highlight kaob |
| Shift+Click noot | `range` | (ei sunni N-mode) | range highlight |

Poliitika: `src/orchestrator/pointerClickPolicy.js` (`toolboxIdForSelection`).

## Event -> Transition skeem

| Event | Current State | Next State | Visual | Lubatud käsud |
|---|---|---|---|---|
| Click noot | any | `note` (+ N-mode) | noodi sinine highlight | Delete→rest, Copy; rhythm toolbox |
| Left-drag noot→noot (ilma Shift) | `note`/`range` | `range` **sama takti sees** | range highlight | taktipiir = ankru takti start/endBeat |
| Shift+Click / Shift+drag noot | `note`/`range` | `range` (võib üle takti) | range highlight | Delete→rest, Copy |
| Shift+Arrow Left/Right | `note`/`range` | `range` | range highlight | Copy |
| Click tühi takt | any | `measureRange` (üks takt) | sinine takti kast | layout; paremklikk → kontekstimenüü |
| Right-click takt | any | `measureRange` (+ menüü) | sinine kast + menüü | properties / insert / delete / copy / paste |
| Teine left-click samale taktile | `measureRange` | `measureRange` (sama) | kast jääb | **ei** deselecti (erinevalt taktijoonest/võtmest) |
| Shift+Arrow Left/Right (taktivalik aktiivne) | `measureRange` | `measureRange` (focus nihkub) | sinine kast laieneb/kahaneb | MuseScore: anchor fikseeritud, focus liigub |
| Cmd/Ctrl+C (taktivalik) | `measureRange` | unchanged | unchanged | kopeerib taktid measureClipboard'ile |
| Left-click teisele taktile (kui measureClipboard täis) | any | `measureRange` siht | siht valitud | **paste overwrite** (eelmine sisu kaob ulatuses) |
| Shift+Arrow (SEL taktis) | any | `measureRange` | takti highlight | Delete measure range, Copy |
| Click taktijoon / repeat / jump | any | `singleObject` | märgi sinine highlight | Delete → single / remove; repeatsJumps |
| Click clef | any | `singleObject` (clef) | clef highlight | clefs toolbox |
| Click text | any | `singleObject` (text*) | text border / floating tool | textBox tools |
| Backspace/Delete | `singleObject` (barline*) | `none` | marker kaob | convertFinal / removeRepeatMark |
| Backspace/Delete | `note`/`range` | sama ulatus (noodid → paus) | jääb või puhastub | replaceSelectedNotesWithRests |
| Cmd/Ctrl+C | `note`/`range`/`measureRange` | unchanged | unchanged | copy |
| Esc | any | `none` | kõik markerid kaovad | deselect + sulge selection-driven toolbox |
| Teine klikk samale taktijoonle / võtmele | sama `singleObject` | `none` | marker kaob | toggle deselect |
| Teine left-click samale taktile | `measureRange` | `measureRange` | kast jääb | ei deselecti |
| Klikk tühjale lehe/laua pinnale | any | `none` | markerid kaovad | deselect (`clearPointerSelection`) |

## Deselect (deaktiveerimine)

Ühtne API: `clearPointerSelection({ closeToolbox: true })` (`noodimeister-complete.jsx`).

| Tee | Käitumine |
|---|---|
| **Esc** | Puhasta note/range/measure/object/text/clef valik; sulge layout / repeatsJumps / clefs / textBox. N-mode + rhythm jääb alles. |
| **Teine klikk** samale taktijoonele / võtmele | Toggle → `none` + sama toolbox-sulgumine. |
| **Teine left-click samale taktile** | **Ei** deselecti (deselect = Esc / tühi pind). |
| **Tühi pind** (score padding / lehe konteiner, kui `target === currentTarget`) | Sama mis Esc. |
| **Delete** pärast objekti eemaldust | Valik puhastatakse automaatselt. |

`shouldCloseToolboxOnDeselect` / `isSamePointerTarget`: `src/orchestrator/pointerClickPolicy.js`.

## Modifikaatorireeglid (kohustuslik)

- `Click` = vali üks element + ava seotud toolbox
- `Shift+Click` = laienda järjestikust vahemikku
- `Cmd/Ctrl+Click` = lisa/eemalda `objectList`-i (v2 eesmärk)

## Repository seis

### Mis on juurutatud / juurutamisel

- ühtne reducer-põhine selection (`cursorSelection`) + `applySelectionModel`
- pointer poliitika moodul: `src/orchestrator/pointerClickPolicy.js`
- nootide Shift-range; kordusmärkide pointer valik (traditional + figurenotes)
- `Delete/Backspace` kordusmärgile / topeltjoonele (sh `barlineFinal` → `barlineSingle`)

### Avatud / järgmised sammud

- `objectList` täielik kõigile objektitüüpidele
- enharmooniline respell kui esmaklassiline N-mode tegevus
- visuaalse markeri tokenid ühtlustada (sama sinine/opacity)

## Smoke test enne merge'i

1. Click tühi takt → measure highlight + layout toolbox (reavahetus / ühendus).
2. Click taktijoon / topelt / kordus → highlight + repeatsJumps; Backspace → single.
3. Click tekst → tekst aktiivne + tekstiriistad.
4. Click võti → clefs toolbox; võtme vahetus uuendab score’i.
5. Click noot → highlight + N-mode + rhythm; Shift+Click → range ilma N-mode sundita.
6. Esc → kõik valikud puhastuvad.
