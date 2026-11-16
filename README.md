# BAM Items List Helper

Lokálny Electron editor produktov pre interiérové projekty.

## Spustenie

```bash
npm install
npm run dev
```

## Použitie

- Vytvor miestnosti a vlož URL produktu; Enter pridá položku.
- Uprav názov, množstvo a cenu priamo v riadku; kliknutie na položku otvorí detail.
- **Uložiť** vytvorí prenosný `.json`; potom sa zmeny ukladajú automaticky.
- **Vytvoriť výpis** uloží offline HTML s tlačidlom na XLSX.

## Kontrola

```bash
npm run typecheck
npm run build
```

## Balíky pre odovzdanie

```bash
npm run package:mac
npm run package:win
```

- `release/macos/*.dmg` je macOS balík; vyberte podľa procesora (`arm64` pre Apple Silicon, bez `arm64` pre Intel).
- `release/windows/*-win.zip` je Windows x64 balík. Po rozbalení spustite `BAM Items List Helper.exe`.
- Balíky momentálne nie sú podpísané Apple ani Microsoft certifikátom, preto môže systém pri prvom otvorení upozorniť na neznámu aplikáciu.

Viac technického kontextu: [AGENTS.md](AGENTS.md), [PROJECT_INFO.md](PROJECT_INFO.md).
