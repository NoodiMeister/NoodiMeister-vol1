# Noodimeister Selection State Machine (v1)

See dokument fikseerib Noodimeistri valiku (selection) käitumise nii, et see oleks deterministlik ja sama kõikides režiimides.

## Eesmärk

- üks tõde selection state'ile
- ühesed modifikaatorireeglid (`Click`, `Shift`, `Cmd/Ctrl`)
- alati nähtav visuaalne tagasiside
- käsud (`Delete`, `Copy`, `Paste`) sõltuvad selection tüübist, mitte vaate spetsiifikast

## State tüübid

- `none` - valikut ei ole
- `singleNote` - üks noot/paus
- `noteRange` - järjestikune nootide ajavahemik
- `measureRange` - järjestikune taktivahemik
- `singleObject` - üks mitte-noodi objekt (nt `repeatStart`, `repeatEnd`, `segno`, `coda`, `volta1`, `volta2`)
- `objectList` - katkendlikud objektid (v2; praegu osaliselt)

## Event -> Transition skeem

| Event | Current State | Next State | Visual | Lubatud käsud |
|---|---|---|---|---|
| Click noot | any | `singleNote` | noodi sinine highlight | Delete->rest replace, Copy |
| Shift+Click noot | `singleNote`/`noteRange` | `noteRange` | range highlight | Delete->rest replace, Copy |
| Shift+Arrow Left/Right | `singleNote`/`noteRange` | `noteRange` | range highlight | Copy |
| Shift+Arrow Left/Right (SEL taktis) | any | `measureRange` | takti highlight | Delete measure range, Copy |
| Click repeat/jump märk | any | `singleObject` | märgi sinine highlight | Delete remove mark |
| Backspace/Delete | `singleObject` | `none` | marker kaob | removeRepeatMark |
| Backspace/Delete | `singleNote`/`noteRange` | sama ulatus (noodid muutuvad pausiks) | jääb nähtav või puhastub reegli järgi | replaceSelectedNotesWithRests |
| Cmd/Ctrl+C | `singleNote`/`noteRange`/`measureRange` | unchanged | unchanged | copy |
| Esc | any | `none` | kõik selection markerid kaovad | none |

## Modifikaatorireeglid (kohustuslik)

- `Click` = vali üks element
- `Shift+Click` = laienda järjestikust vahemikku
- `Cmd/Ctrl+Click` = lisa/eemalda `objectList`-i (v2 eesmärk)

## Repository analüüs (Apr 2026)

### Mis on juba olemas

- olemas on ühtne reducer-põhine selection mudel (`cursorSelection`) koos tüübituvastusega (`note`, `range`, `measureRange`, `none`)
- nootide `Shift`-põhine range selection drag/hover on olemas
- kordusmärkide pointer valik on olemas `TraditionalNotationView`-s
- kordusmärkide pointer valik lisati `FigurenotesView`-s (`repeatStart`/`repeatEnd`, sh combined rows)
- `Delete/Backspace` kordusmärgile töötab nüüd sõltumata N/SEL režiimist

### Leitud vastuolu

- noodi valik ei nullinud alati `selectedRepeatMark`-i, mis jättis paralleelse valikuallika.

### Tehtud parandus

- `src/noodimeister-complete.jsx`
  - `beginSelectionDrag()` nullib nüüd `selectedRepeatMark`-i
  - noodi `onNoteClick` harud nullivad `selectedRepeatMark`-i enne `singleNote` valikut

## Avatud punktid (v2)

- `objectList` (Cmd/Ctrl+Click) ei ole veel täielikult rakendatud kõikidele objektitüüpidele
- `segno/coda/volta` pointer-select figurenotes režiimis tuleb viia samale tasemele kui `repeatStart/repeatEnd`
- visuaalse markeri stiil tuleb standardiseerida ühe tokenikomplekti alla (same color/opacity/shape)

## Smoke test enne merge'i

1. Click noot -> `singleNote` highlight on nähtav.
2. Shift+Click/Shift+Arrow -> `noteRange` highlight muutub deterministlikult.
3. Click repeat mark (traditional + figurenotes) -> `singleObject` highlight nähtav.
4. Delete selected repeat mark (N + SEL) -> märk eemaldub.
5. Esc -> kõik valikud puhastuvad.
6. Copy/paste käitub valiku tüübi järgi (range overwrite vs object merge vastavalt toetusele).
