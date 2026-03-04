# Valge ekraan Vercelil / noodimeister.ee

Kui leht on täiesti valge (v.a. võib-olla kollakas theme-color), võib põhjus olla üks järgmistest.

## 1. Ava brauseri konsool (F12)

- **Chrome/Edge:** F12 või paremklõps → „Uuri“ → vahekaart **Console**.
- Vaata, kas on **punaseid vigu** (nt `Cannot access '…' before initialization`, `Failed to load module`, `404`).

## 2. Kontrolli võrgu päringuid (Network)

- F12 → vahekaart **Network** (Võrguvood).
- Laadi leht uuesti (Ctrl+R / Cmd+R).
- Vaata, kas mõni **JS või CSS fail** annab **404** (punane). Kui jah, siis Vercel ei serveeri `dist/assets/` faile või build ei vasta deploy’ile.

## 3. Tüüpilised põhjused

| Põhjus | Lahendus |
|--------|----------|
| **JS viga** (nt lucide-react TDZ) | Uuenda koodi (optimizeDeps + manualChunks on juba lisatud). Puhasta brauseri vahemälu ja proovi uuesti. |
| **Asset 404** | Vercel → Project → Settings: veendu, et **Build Output Directory** on `dist` ja et deploy käivitatakse pärast `npm run build`. |
| **Vale branch** | Vercel deploy’ib valitud branch’i; veendu, et deploy tuleb sellest branch’ist, kuhu push’isid. |
| **Cache** | Proovi inkognito aknas või teise brauseriga; või „Empty cache and hard reload“ (F12 → paremklõps Reload-nupul). |

## 4. Pärast viimast koodi uuendust

- **index.html:** 4 sekundi järel kuvatakse tõrgete korral sõnum „Rakendus ei laadinud“ ja soovitus avada konsool.
- **main.jsx:** tööaegsed vead logitakse konsooli.

Kui konsoolis on konkreetne viga (nt `ReferenceError`, `Failed to fetch`), saad selle põhjal täpsema lahenduse (või kopeeri viga siia ja küsi abi).
