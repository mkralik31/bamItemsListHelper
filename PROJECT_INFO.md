# Project info

## Cieľ

Lokálna desktopová aplikácia pre Grandpano/BAM na evidenciu produktov v interiérovom projekte a odovzdanie offline výpisu klientovi.

## Done

- Electron + React + TypeScript editor; responzívne úzke rozloženie.
- Miestnosti: pridanie, zbalenie, premenovanie, odstránenie s potvrdením pri položkách.
- Položky: vloženie URL cez Enter, inline úpravy vrátane farby/variantu a rozmerov, cena × množstvo, detailná karta.
- Extrakcia názvu/obrázka/ceny: Shopify `.js`, Open Graph, JSON-LD, označená textová cena a skrytý Chromium fallback; pokus o farbu/variant a rozmery.
- Projekty: `.json` s vloženými obrázkami, Otvoriť/Uložiť/Nový projekt, auto-save po prvom uložení, posledný projekt pri štarte.
- Offline HTML výpis so zbaliteľnými miestnosťami a vloženým XLSX (odkazy, miestnosť, farba/variant, rozmery, ceny, miniatúry).
- BAM modrý/light-blue dizajn a dodané logo.
- Produkčné balíky: macOS DMG/ZIP pre Intel aj Apple Silicon a Windows x64 ZIP so spustiteľným `.exe`.
- Overené: `npm run typecheck`, `npm run build`.

## ADR

- Lokálne bez účtu/hostingu; `.json` je prenosný zdroj pravdy.
- Main proces robí sieť a súbory; renderer nesmie obchádzať preload IPC.
- Ručné polia majú prednosť pred výsledkom extrakcie.
- HTML výpis je samostatný/offline; internet je potrebný iba po otvorení obchodných odkazov.
- Neexistuje univerzálne spoľahlivé čítanie e-shopov; používa sa viac lokálnych stratégií, nie AI/proxy.

## Známe dlhy

- nooma môže vracať 429 aj pre Electron a lokálny `curl`; neobchádzať cez tretiu stranu bez súhlasu.
- Rozmery sú heuristika textu; varianty, mena a medzisúčty sú primárne optimalizované na EUR.
- Chýbajú automatické testy, lint, validácia schémy JSON a režim pre konflikty/poškodené súbory.
- Balíky nie sú podpísané/notarizované a používajú predvolenú Electron ikonu.

## Next

1. Manuálny režim a jasné retry pre blokované obchody; otestovať viac reálnych zdrojov.
2. Validácia/migrácia `.json`, upozornenie na neuložené zmeny, bezpečnejší „Nový projekt“.
3. Doplniť rozmery do HTML/XLSX a lepšie riešiť meny/varianty.
4. Testy extraktorov a UI; ESLint/formatter.
5. Podpísanie/notarizácia macOS a podpisovanie Windows balíka; vlastná ikona aplikácie.
