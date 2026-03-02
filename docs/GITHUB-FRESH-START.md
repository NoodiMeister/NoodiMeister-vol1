# Ettepanek: GitHub repo tühjaks ja uus commit + push

## Eesmärk
- GitHubis olev ajalugu asendatakse **ühe puhta commitiga** (praegune projekti olek).
- Repo ei ole enam "tühi" – see sisaldab kogu NoodiMeisteri koodi, aga **ilma vana ajaloota**.

## Sammud (kohalikult)

1. **Uus haru ilma ajaloota (orphan)**  
   `git checkout --orphan new-main`  
   → Tekib haru `new-main`, kus pole ühtegi eelmist commiti; praegused failid on staged.

2. **Kõik projektifailid staged**  
   `git add -A`  
   → Lisatakse kõik (sh uued dokid). Failid, mis on `.gitignore`is (`node_modules/`, `.env`, `dist/` jne), jäävad välja.

3. **Üks esialgne commit**  
   `git commit -m "Initial commit: NoodiMeister"`  
   (või sinu soovitud sõnum.)

4. **Vana main kustutada, uus ümber nimetada**  
   `git branch -D main`  
   `git branch -m main`  
   → Nüüd on kohalik `main` see üks uus commit.

5. **GitHubi üle kirjutada (force push)**  
   `git push -f origin main`  
   → GitHubi `main` sisaldab nüüd ainult seda ühte commiti; kõik vana ajalugu kaob **GitHubis**.

## Tähtis
- **Force push** (`-f`) kirjutab kaugema `main` üle. Kui keegi teine selle repoga töötab, peavad nad uuesti clone’ima või oma kohaliku `main` resettima.
- **Kohalikult** on kõik failid alles; kaotatud on ainult **GitHubis** olev vana ajalugu.
- Soovi korral võid enne push’i kontrollida: `git log --oneline` (peaks olema üks commit).

## Järgnev
- Vercel (või teised) deploy’id tulevad edasi `main`-ist; üks commit ei muuda deploy’i loogikat.
- Edasised muudatused: `git add …`, `git commit -m "..."`, `git push origin main` (tavapäraselt, ilma `-f`).
