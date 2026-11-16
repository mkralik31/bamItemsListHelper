# AGENTS.md

## Stack a architektúra

- Electron 33 + electron-vite 2, React 19, TypeScript strict, Vite 5.
- `src/main`: Electron main proces; IPC, dialógy, súbory, extrakcia produktov, HTML/XLSX výpis.
- `src/preload`: jediná bezpečná IPC plocha `window.bamItems`.
- `src/renderer`: React UI; nepoužíva Node/Electron API priamo.
- `exceljs`: zabalený XLSX v offline HTML výpise.

## Mapa

- `src/main/index.ts` — IPC, `.json` projekty, extrakcia, report.
- `src/preload/index.ts` — IPC bridge.
- `src/renderer/src/main.tsx` — stav a UI editora.
- `src/renderer/src/styles.css` — BAM dizajn.
- `src/renderer/public/bam-logo.png` — používané logo.

## Konvencie

- UI a používateľské správy píš po slovensky.
- Zachovaj TypeScript strict; názvy typov PascalCase, funkcie/cenné camelCase.
- Renderer len volá deklarované IPC metódy; každú novú metódu pridaj do preloadu aj `bam-items.d.ts`.
- Chyby externých stránok zobraz stručne pri položke; nikdy nezahadzuj ručne upravený názov/cenu/obrázok neskorou odpoveďou.
- Projektový JSON musí zostať prenosný: obrázky ukladaj ako data URI, nie ako lokálne cesty.

## Príkazy

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run start
```

- Lint a automatické testy zatiaľ nie sú nakonfigurované.
- Po zmene `main` alebo `preload` Electron úplne reštartuj; renderer CSS/React môže obnoviť Vite.

## AI pravidlá

- Vždy spusti `npm run typecheck && npm run build` po zmene kódu.
- Nepridávaj účet, hosting, cloudové ukladanie ani externú AI/proxy službu bez explicitného súhlasu.
- Neposielaj produktové odkazy ani projektové dáta tretej strane; extrakcia je lokálna.
- Neodstraňuj ručné úpravy ani projektové súbory bez potvrdenia používateľa.
- Nevymeň logo ani BAM farby bez nového podkladu od používateľa.
