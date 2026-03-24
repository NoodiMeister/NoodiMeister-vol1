# Noodimeistri standard: Export PDF + Print Preview andme-leping

Eesmärk: PDF preview, PDF export ja brauseri print preview peavad kasutama sama score-andmestikku ning sama paigutusloogikat.

## Kohustuslikud reeglid

- Kasuta alati ühte snapshot-builderit (`buildScoreExportSnapshot`) nii PDF preview kui print flow jaoks.
- Snapshot peab tulema reaalsest score konteinerist (`scoreContainerRef.current`), mitte suvalisest DOM valikust.
- Notatsiooni SVG peab olema otsene viide nähtavale score SVG-le (`exportNotationSvgRef.current`).
- Header (pealkiri/autor) ja score vertikaalne vahe peab olema stabiilne ning sõltumatu kasutaja zoom/fit skaalast.
- `exportScaleFactor` mõjutab noodigraafika skaalat, mitte pealkirja ploki offsetit.
- Print flow peab kasutama deterministic SVG page mudelit (`nm-print-svg-mode`), mitte brauseri suvalist DOM transform printi.

## Mida ei tohi teha

- Ära ehita PDF preview ja print jaoks eraldi option-objekte erinevate väljadega.
- Ära võta notatsiooni-SVG-d ainult `querySelector('svg[viewBox]')` järgi.
- Ära kasuta fallbacke, mis peidavad paigutusvigu (nt vaikimisi raster fallback), kui eesmärk on 1:1 paigutus.

## Kiir-kontroll enne merge'i

- Sama töö: scorepage vaade vs PDF preview esimene leht = süsteemide alguskoht sama.
- Sama töö: PDF preview vs brauseri print preview = esimene noodirida ei tohi olla pealkirja peal.
- `npm run build` läbib.
