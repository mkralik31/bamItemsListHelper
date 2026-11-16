import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ExcelJS from 'exceljs'
import { extractProductMetadata } from './product-extraction'
import { buildReport } from './report'
import type { ReportSelection } from '../report-fields'

type ReportItem = { code?: string; url: string; name: string; quantity: number; price: string; currency: string; imageData?: string; note?: string; alternativeName?: string; alternativeImageData?: string; alternativePrice?: string; alternativeUrl?: string; color?: string; dimensions?: string }
type ReportRoom = { name: string; items: ReportItem[] }
type ProductData = { name?: string; price?: string; currency?: string; imageData?: string; color?: string; dimensions?: string }
type ProjectFile = { version: 1; name: string; investor?: string; projectDate?: string; propertyType?: string; rooms: { id: string; name: string; collapsed: boolean; items: (ReportItem & { id: string; dimensions?: string })[] }[] }
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sk-SK,sk;q=0.9,en-US;q=0.8,en;q=0.7'
}
const execFileAsync = promisify(execFile)
const curlCommand = process.platform === 'win32' ? 'curl.exe' : '/usr/bin/curl'

const fetchImage = async (url?: string): Promise<string | undefined> => {
  if (!url?.startsWith('http')) return undefined
  const response = await fetch(url, { headers: browserHeaders, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) return undefined
  const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  if (!contentType.startsWith('image/')) return undefined
  const bytes = Buffer.from(await response.arrayBuffer())
  return bytes.length <= 4 * 1024 * 1024 ? `data:${contentType};base64,${bytes.toString('base64')}` : undefined
}
async function loadShopifyProduct(url: string): Promise<ProductData> {
  const source = new URL(url)
  const productPath = source.pathname.match(/^(\/products\/[^/]+)/)?.[1]
  if (!productPath) throw new Error('Obchod zablokoval načítanie stránky (429).')
  const endpoint = `${source.origin}${productPath}.js`
  let product: { title?: string; price?: number; images?: string[]; featured_image?: string; variants?: { id?: number; price?: number; title?: string; option1?: string }[] }
  // Shopify URL načítame najprv cez lokálny curl. Ak by najprv zasiahol Electron,
  // ochrana obchodu môže dočasne limitovať aj následnú správnu požiadavku.
  try {
    const { stdout } = await execFileAsync(curlCommand, ['--http1.1', '--location', '--silent', '--show-error', '--max-time', '15', '--user-agent', browserHeaders['User-Agent'], endpoint], { maxBuffer: 8 * 1024 * 1024 })
    product = JSON.parse(stdout) as typeof product
  } catch (error) {
    const response = await fetch(endpoint, { headers: { ...browserHeaders, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) })
    if (!response.ok) {
      const detail = error instanceof Error ? ` Lokálne načítanie: ${error.message}` : ''
      throw new Error(`Obchod zablokoval načítanie stránky (${response.status}).${detail}`)
    }
    product = await response.json() as typeof product
  }
  const wantedVariant = source.searchParams.get('variant')
  const variant = product.variants?.find(entry => String(entry.id) === wantedVariant)
  const cents = variant?.price ?? product.price
  const image = product.featured_image || product.images?.[0]
  const color = variant?.option1 || variant?.title
  return { name: product.title, price: typeof cents === 'number' ? (cents / 100).toFixed(2) : undefined, currency: 'EUR', imageData: await fetchImage(image).catch(() => undefined), color: color && color.toLowerCase() !== 'default title' ? color : undefined }
}
async function productFromHtml(html: string): Promise<ProductData> {
  const product = extractProductMetadata(html)
  return { ...product, imageData: await fetchImage(product.imageUrl).catch(() => undefined) }
}
async function loadProductInBrowser(url: string): Promise<ProductData> {
  const page = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } })
  try {
    page.webContents.setUserAgent(browserHeaders['User-Agent'])
    await page.loadURL(url)
    const html = await page.webContents.executeJavaScript('document.documentElement.outerHTML', true) as string
    const product = await productFromHtml(html)
    if (!product.name && !product.price && !product.imageData) throw new Error('Stránka neposkytla údaje produktu.')
    return product
  } finally { if (!page.isDestroyed()) page.destroy() }
}
async function loadProduct(url: string): Promise<ProductData> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Odkaz musí začínať http:// alebo https://')
  // Typický Shopify produkt (vrátane noo.ma) má verejný .js endpoint. Skúsime ho
  // pred HTML, aby sa WAF Electronovou požiadavkou vôbec neaktivoval.
  if (new URL(url).pathname.startsWith('/products/')) {
    try { return await loadShopifyProduct(url) } catch {
      try { return await loadProductInBrowser(url) } catch { /* Nie je to Shopify, pokračujeme HTML. */ }
    }
  }
  // Niektoré e-shopy občas vrátia 429 aj pri jedinej požiadavke. Jeden krátky retry
  // šetrí používateľa pred ručným opakovaním a bez limitu nezaťažuje obchod.
  let response: Response | undefined
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(url, { headers: browserHeaders, signal: AbortSignal.timeout(12_000) })
    if (response.status !== 429) break
    await new Promise(resolve => setTimeout(resolve, 900))
  }
  if (!response) throw new Error('Stránku sa nepodarilo načítať.')
  if (response.status === 429) {
    try { return await loadProductInBrowser(url) } catch { return loadShopifyProduct(url) }
  }
  if (!response.ok) throw new Error(`Stránku sa nepodarilo načítať (${response.status}).`)
  return productFromHtml(await response.text())
}
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))
const priceNumber = (price: string) => Number(price.replace(',', '.')) || 0
async function spreadsheet(project: ProjectFile): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Výpis položiek')
  sheet.mergeCells('A1:C1'); sheet.getCell('A1').value = 'bäm!'
  sheet.mergeCells('D1:L3'); sheet.getCell('D1').value = project.propertyType || project.name
  sheet.getCell('A2').value = 'investor:'; sheet.getCell('B2').value = project.investor || ''
  sheet.getCell('A3').value = 'dátum:'; sheet.getCell('B3').value = project.projectDate || ''
  sheet.columns = [{ width: 16 }, { width: 30 }, { width: 34 }, { width: 16 }, { width: 10 }, { width: 16 }, { width: 40 }, { width: 28 }, { width: 28 }, { width: 34 }, { width: 16 }, { width: 40 }]
  sheet.addRow(['ozn.', 'názov', 'ilustračný obr.', 'suma/kus', 'počet', 'suma', 'link', 'poznámka', 'alternatíva', 'ilustračný obr.', 'suma', 'link'])
  sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000CC' } }
  for (const room of project.rooms) { const heading = sheet.addRow([room.name]); sheet.mergeCells(`A${heading.number}:L${heading.number}`); heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; for (const item of room.items) {
    const row = sheet.addRow([item.code || '', [item.name, item.color && `Farba / variant: ${item.color}`, item.dimensions && `Rozmery: ${item.dimensions}`].filter(Boolean).join('\n'), '', item.price ? priceNumber(item.price) : '', item.quantity, item.price ? priceNumber(item.price) * item.quantity : '', '', item.note || '', item.alternativeName || '', '', item.alternativePrice ? priceNumber(item.alternativePrice) : '', ''])
    row.getCell(7).value = { text: item.url, hyperlink: item.url }; row.getCell(12).value = item.alternativeUrl ? { text: item.alternativeUrl, hyperlink: item.alternativeUrl } : ''
    row.getCell(4).numFmt = '#,##0.00'; row.getCell(6).numFmt = '#,##0.00'; row.getCell(11).numFmt = '#,##0.00'; row.height = 58
    for (const [imageData, col] of [[item.imageData, 2], [item.alternativeImageData, 9]] as const) { const image = imageData?.match(/^data:image\/(png|jpeg|jpg);base64,(.*)$/i); if (image) { const imageId = workbook.addImage({ base64: image[2], extension: image[1].toLowerCase() === 'jpg' ? 'jpeg' : image[1].toLowerCase() as 'png' | 'jpeg' }); sheet.addImage(imageId, { tl: { col, row: row.number - 1 }, ext: { width: 52, height: 52 } }) } }
  } }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
async function createReport(project: ProjectFile, selection: ReportSelection): Promise<{ cancelled: boolean; path?: string }> {
  const projectName = project.name; const rooms = project.rooms
  const target = await dialog.showSaveDialog({ title: 'Uložiť výpis', defaultPath: `${projectName || 'Vypis-poloziek'}.html`, filters: [{ name: 'HTML výpis', extensions: ['html'] }] })
  if (target.canceled || !target.filePath) return { cancelled: true }
  const htmlReport = await buildReport(project, selection)
  await writeFile(target.filePath, htmlReport, 'utf8')
  return { cancelled: false, path: target.filePath }
  /*
  const xlsx = (await spreadsheet(project)).toString('base64')
  const roomMarkup = rooms.map(room => {
    const total = room.items.reduce((sum, item) => sum + priceNumber(item.price) * item.quantity, 0)
    const rows = room.items.map(item => {
      const properties = [item.color && `Farba / variant: ${item.color}`, item.dimensions && `Rozmery: ${item.dimensions}`].filter(Boolean).map(value => escapeHtml(value as string)).join(' • ')
      const e = (value?: string) => escapeHtml(value || '')
      return `<article class="item"><div class="product"><strong>${e(item.code)} ${e(item.name)}</strong>${item.imageData ? `<img src="${e(item.imageData)}" alt="">` : ''}<small>${properties}</small><a href="${e(item.url)}">${e(item.url)}</a><small>Poznámka: ${e(item.note)}</small><small>Alternatíva: ${e(item.alternativeName)} ${e(item.alternativePrice)}</small>${item.alternativeImageData ? `<img src="${e(item.alternativeImageData)}" alt="Alternatíva">` : ''}<a href="${e(item.alternativeUrl)}">${e(item.alternativeUrl)}</a></div><span>${item.quantity} ks</span><span>${item.price ? `${e(item.price)} ${e(item.currency)}` : 'Chýba cena'}</span><b>${item.price ? `${(priceNumber(item.price) * item.quantity).toLocaleString('sk-SK', { minimumFractionDigits: 2 })} ${e(item.currency)}` : '—'}</b></article>`
    }).join('')
    return `<details open><summary><span>${escapeHtml(room.name)} <small>${room.items.length} položiek</small></span><b>${total.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €</b></summary><div class="items">${rows || '<p>Bez položiek</p>'}</div></details>`
  }).join('')
  const grandTotal = rooms.reduce((sum, room) => sum + room.items.reduce((part, item) => part + priceNumber(item.price) * item.quantity, 0), 0)
  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(projectName)}</title><style>body{margin:0;background:linear-gradient(145deg,#c2d0f0,#eef2ff 48%,#fff);color:#13007d;font:15px "Avenir Next",Avenir,system-ui,sans-serif}.report-brand{display:block;color:#2600ff;font:800 15px "Arial Rounded MT Bold","Avenir Next",sans-serif;letter-spacing:-.06em;margin-bottom:9px}.page{max-width:980px;margin:auto;padding:44px 24px}h1{font:800 36px "Arial Rounded MT Bold","Avenir Next",sans-serif;margin:0}.top{display:flex;justify-content:space-between;gap:20px;align-items:end;border-bottom:1px solid #9baee2;padding-bottom:25px}.top p{color:#5b5b82;margin:7px 0 0}.total{text-align:right}.total strong{font-size:23px}button{border:0;border-radius:999px;background:#2600ff;color:#ffffff;padding:11px 15px;font-weight:700;cursor:pointer;margin-top:22px}details{background:#fff;border:1px solid #aabbe6;border-radius:7px;margin-top:15px}summary{display:flex;justify-content:space-between;padding:16px;cursor:pointer;font-weight:700}small{color:#5b5b82;font-weight:400;margin-left:8px}.items{border-top:1px solid #d9dfff}.item{display:grid;grid-template-columns:58px 1fr 70px 115px 120px;gap:14px;align-items:center;padding:13px 16px;border-bottom:1px solid #e7eaff}.item:last-child{border:0}.item img,.no-image{width:54px;height:54px;object-fit:cover;border-radius:4px;background:#e4eaff}.no-image{display:grid;place-items:center;color:#5b5b82;font-size:10px;text-align:center}.product{min-width:0}.product strong,.product a{display:block}.product a{color:#0000cc;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.product small{display:block;margin-top:4px;color:#5b5b82;font-size:11px;line-height:1.35}@media(max-width:620px){.item{grid-template-columns:54px 1fr 80px;grid-template-areas:'image product total' 'image quantity price'}.item img,.no-image{grid-area:image}.product{grid-area:product}.item span:first-of-type{grid-area:quantity}.item span:last-of-type{grid-area:price}.item b{grid-area:total}.report-brand{display:block;color:#2600ff;font:800 15px "Arial Rounded MT Bold","Avenir Next",sans-serif;letter-spacing:-.06em;margin-bottom:9px}.page{padding:26px 12px}}</style></head><body><main class="page"><div class="top"><div><span class="report-brand">bam!</span><h1>${escapeHtml(projectName)}</h1><p>Výpis produktov pre interiérový projekt</p></div><div class="total">Celkom<br><strong>${grandTotal.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €</strong></div></div><button id="excel">Stiahnuť Excel</button>${roomMarkup}</main><script>document.querySelector('#excel').onclick=()=>{const s='${xlsx}';const b=Uint8Array.from(atob(s),c=>c.charCodeAt(0));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([b],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download='Vypis-poloziek.xlsx';a.click();URL.revokeObjectURL(a.href)}</script></body></html>`
  const header = `<p>Investor: ${escapeHtml(project.investor || '')} · Dátum: ${escapeHtml(project.projectDate || '')} · ${escapeHtml(project.propertyType || '')}</p>`
  await writeFile(target.filePath, html.replace('<button id="excel">', `${header}<button id="excel">`), 'utf8'); return { cancelled: false, path: target.filePath } */
}
const isProjectFile = (value: unknown): value is ProjectFile => {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<ProjectFile>
  return typeof project.name === 'string' && Array.isArray(project.rooms)
}
const lastProjectConfig = () => join(app.getPath('userData'), 'last-project.json')
async function rememberProject(path: string): Promise<void> { await writeFile(lastProjectConfig(), JSON.stringify({ path }), 'utf8') }
async function readProject(path: string): Promise<ProjectFile> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (!isProjectFile(parsed)) throw new Error('Vybraný súbor nie je platný projekt BAM Items.')
  return parsed
}
async function saveProject(project: ProjectFile, existingPath?: string): Promise<{ cancelled: boolean; path?: string }> {
  let path = existingPath
  if (!path) {
    const target = await dialog.showSaveDialog({ title: 'Uložiť projekt', defaultPath: `${project.name || 'Novy-projekt'}.json`, filters: [{ name: 'Projekt BAM Items', extensions: ['json'] }] })
    if (target.canceled || !target.filePath) return { cancelled: true }
    path = target.filePath
  }
  await writeFile(path, JSON.stringify(project, null, 2), 'utf8')
  await rememberProject(path)
  return { cancelled: false, path }
}
async function openProject(): Promise<{ cancelled: boolean; path?: string; project?: ProjectFile }> {
  const selected = await dialog.showOpenDialog({ title: 'Otvoriť projekt', properties: ['openFile'], filters: [{ name: 'Projekt BAM Items', extensions: ['json'] }] })
  if (selected.canceled || !selected.filePaths[0]) return { cancelled: true }
  const project = await readProject(selected.filePaths[0]); await rememberProject(selected.filePaths[0])
  return { cancelled: false, path: selected.filePaths[0], project }
}
async function lastProject(): Promise<{ path?: string; project?: ProjectFile }> {
  try {
    const saved = JSON.parse(await readFile(lastProjectConfig(), 'utf8')) as { path?: string }
    return typeof saved.path === 'string' ? { path: saved.path, project: await readProject(saved.path) } : {}
  } catch { return {} }
}
function createWindow(): void { const window = new BrowserWindow({ width: 1080, height: 800, minWidth: 420, minHeight: 560, title: 'BAM Items List Helper', webPreferences: { preload: join(__dirname, '../preload/index.js') } }); if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL); else window.loadFile(join(__dirname, '../renderer/index.html')) }
let lastReportPath: string | undefined
app.whenReady().then(() => { ipcMain.handle('product:load', (_event, url: string) => loadProduct(url)); ipcMain.handle('report:create', async (_event, project: ProjectFile, selection: ReportSelection) => { const result = await createReport(project, selection); if (result.path) lastReportPath = result.path; return result }); ipcMain.handle('report:reveal', () => { if (!lastReportPath) throw new Error('Cesta k výpisu nie je dostupná.'); shell.showItemInFolder(lastReportPath) }); ipcMain.handle('project:save', (_event, project: ProjectFile, path?: string) => saveProject(project, path)); ipcMain.handle('project:open', () => openProject()); ipcMain.handle('project:last', () => lastProject()); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
