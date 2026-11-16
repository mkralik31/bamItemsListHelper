import ExcelJS from 'exceljs'
import { defaultReportSelection, type ReportSelection } from '../report-fields'

export type ReportItem = { code?: string; name: string; imageData?: string; price: string; quantity: number; currency: string; url: string; note?: string; alternativeName?: string; alternativeImageData?: string; alternativePrice?: string; alternativeUrl?: string; color?: string; dimensions?: string; alternative?: { name: string; url: string; price: string; quantity: number; currency: string; imageData?: string; color?: string; dimensions?: string; note?: string } }
export type ReportProject = { name: string; investor?: string; projectDate?: string; rooms: { name: string; items: ReportItem[] }[] }
const number = (value: string) => Number(value.replace(',', '.')) || 0
type Column = { header: string; width: number; kind?: 'image' | 'url' | 'number'; value: (item: ReportItem) => string }
const columnsFor = (selection: ReportSelection): Column[] => {
  const main: Record<string, Column> = {
    code: { header: 'ozn.', width: 14, value: i => i.code || '' }, name: { header: 'názov', width: 30, value: i => i.name }, color: { header: 'farba / variant', width: 22, value: i => i.color || '' }, image: { header: 'ilustračný obr.', width: 22, kind: 'image', value: i => i.imageData || '' }, price: { header: 'suma/kus', width: 14, kind: 'number', value: i => i.price }, quantity: { header: 'počet', width: 10, kind: 'number', value: i => String(i.quantity) }, total: { header: 'suma', width: 14, kind: 'number', value: i => i.price ? String(number(i.price) * i.quantity) : '' }, url: { header: 'link', width: 40, kind: 'url', value: i => i.url }, dimensions: { header: 'rozmery', width: 24, value: i => i.dimensions || '' }, note: { header: 'poznámka', width: 28, value: i => i.note || '' }
  }
  const alternative: Record<string, Column> = {
    name: { header: 'alternatíva', width: 30, value: i => i.alternative?.name || i.alternativeName || '' }, color: { header: 'farba / variant alternatívy', width: 22, value: i => i.alternative?.color || '' }, image: { header: 'ilustračný obr. alternatívy', width: 22, kind: 'image', value: i => i.alternative?.imageData || i.alternativeImageData || '' }, price: { header: 'suma/kus alternatívy', width: 16, kind: 'number', value: i => i.alternative?.price || i.alternativePrice || '' }, quantity: { header: 'počet alternatívy', width: 12, kind: 'number', value: i => i.alternative ? String(i.alternative.quantity) : '' }, total: { header: 'suma alternatívy', width: 16, kind: 'number', value: i => i.alternative?.price ? String(number(i.alternative.price) * i.alternative.quantity) : i.alternativePrice || '' }, url: { header: 'link alternatívy', width: 40, kind: 'url', value: i => i.alternative?.url || i.alternativeUrl || '' }, dimensions: { header: 'rozmery alternatívy', width: 24, value: i => i.alternative?.dimensions || '' }, note: { header: 'poznámka alternatívy', width: 28, value: i => i.alternative?.note || '' }
  }
  const mainOrder = ['code', 'name', 'color', 'image', 'price', 'quantity', 'total', 'url', 'dimensions', 'note']
  const altOrder = ['name', 'color', 'image', 'price', 'quantity', 'total', 'url', 'dimensions', 'note']
  return [...mainOrder.filter(key => selection.main.includes(key as never)).map(key => main[key]), ...altOrder.filter(key => selection.alternative.includes(key as never)).map(key => alternative[key])]
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
const safeUrl = (value: string) => /^https?:\/\//i.test(value) ? value : ''

export async function buildReport(project: ReportProject, selection: ReportSelection = defaultReportSelection()): Promise<string> {
  const columns = columnsFor(selection)
  if (!columns.length) throw new Error('Vyberte aspoň jedno pole výpisu.')
  const headers = columns.map(column => column.header)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Výpis položiek')
  sheet.columns = columns.map(column => ({ width: column.width }))
  sheet.mergeCells('A1:B1'); sheet.getCell('A1').value = 'bäm!'
  sheet.getCell('A2').value = 'investor:'; sheet.getCell('B2').value = project.investor || ''
  sheet.getCell('A3').value = 'dátum:'; sheet.getCell('B3').value = project.projectDate || ''
  // ExcelJS nepodporuje rozostup znakov, preto používame úzke medzery medzi znakmi.
  const headerLastColumn = Math.max(3, columns.length)
  sheet.mergeCells(1, 3, 3, headerLastColumn); sheet.getCell('C1').value = Array.from(project.name.toLocaleUpperCase('sk-SK')).join('\u2009')
  sheet.getCell('C1').alignment = { vertical: 'middle', horizontal: 'center' }; sheet.getCell('C1').font = { name: 'Roboto', bold: true, size: 20, color: { argb: 'FF0000CC' } }
  for (let n = 1; n <= 3; n++) {
    sheet.getRow(n).height = 20
    for (let col = 1; col <= 2; col++) {
      const cell = sheet.getRow(n).getCell(col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } }
      cell.font = { name: 'Roboto', color: { argb: 'FF0000CC' }, bold: n !== 1 }
    }
  }
  sheet.getCell('C1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } }
  const head = sheet.addRow(headers); head.height = 24; head.eachCell(cell => { cell.font = { name: 'Roboto', bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000CC' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' } })
  const csvRows: string[][] = [['bäm!', '', '', project.name], ['investor:', project.investor || ''], ['dátum:', project.projectDate || ''], headers]
  const sections = project.rooms.map(room => {
    const heading = sheet.addRow([room.name]); if (columns.length > 1) sheet.mergeCells(heading.number, 1, heading.number, columns.length); heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; heading.font = { name: 'Roboto', color: { argb: 'FF0000CC' } }
    csvRows.push([room.name])
    const rows = room.items.map(item => {
      const data = columns.map(column => column.value(item)); csvRows.push(data)
      const row = sheet.addRow(data.map((v, i) => columns[i].kind === 'image' ? '' : columns[i].kind === 'number' && v !== '' ? number(v) : v)); row.height = 85
      row.eachCell({ includeEmpty: true }, cell => { cell.font = { name: 'Roboto', size: 11 }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; cell.border = { top: { style: 'thin', color: { argb: 'FFAAAAAA' } }, left: { style: 'thin', color: { argb: 'FFAAAAAA' } }, bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } }, right: { style: 'thin', color: { argb: 'FFAAAAAA' } } } })
      data.forEach((value, i) => { if (columns[i].kind === 'url' && safeUrl(value)) { row.getCell(i + 1).value = { text: value, hyperlink: value }; row.getCell(i + 1).font = { name: 'Roboto', color: { argb: 'FF0066CC' }, underline: true } } if (columns[i].kind === 'image') { const match = value.match(/^data:image\/(png|jpeg|jpg);base64,(.*)$/i); if (match) { const id = workbook.addImage({ base64: match[2], extension: match[1].toLowerCase() === 'png' ? 'png' : 'jpeg' }); sheet.addImage(id, { tl: { col: i + 0.1, row: row.number - 1 + 0.05 }, ext: { width: 90, height: 90 } }) } } })
      return `<tr>${data.map((value, i) => { const label = escape(headers[i]); if (columns[i].kind === 'image') return `<td data-label="${label}">${/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value) ? `<img src="${escape(value)}" alt="">` : ''}</td>`; if (columns[i].kind === 'url') return `<td data-label="${label}">${safeUrl(value) ? `<a href="${escape(value)}">${escape(value)}</a>` : escape(value)}</td>`; return `<td data-label="${label}">${escape(value)}</td>` }).join('')}</tr>`
    }).join('')
    return `<details open><summary>${escape(room.name)}</summary><div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></details>`
  }).join('')
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')
  const csv = Buffer.from('\ufeff' + csvRows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'utf8').toString('base64')
  return `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(project.name)}</title><style>body{font:14px Roboto,Arial,sans-serif;margin:0;color:#111}main{padding:20px}.head{display:grid;grid-template-columns:280px 1fr;background:#f1f1f1;color:#0000cc;border:1px solid #aaa}.meta{padding:8px;line-height:1.5}.title{display:grid;place-items:center;text-align:center;font-size:24px;font-weight:bold;letter-spacing:.2em;padding:16px;text-transform:uppercase}button{background:#0000cc;color:white;border:0;padding:10px 15px;margin:16px 8px 16px 0;cursor:pointer}details{margin-bottom:8px}summary{background:#d9d9d9;color:#0000cc;padding:10px;cursor:pointer}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0000cc;color:white}td,th{border:1px solid #aaa;padding:8px;text-align:center;overflow-wrap:anywhere;white-space:pre-line}td img{max-width:100%;max-height:110px;object-fit:contain}a{color:#0066cc}@media(max-width:800px){.head{grid-template-columns:1fr}.title{font-size:18px}thead{display:none}table,tbody,tr,td{display:block}tr{border:1px solid #aaa;margin:10px 0}td{display:grid;grid-template-columns:120px 1fr;text-align:left;border:0;border-bottom:1px solid #eee}td:before{content:attr(data-label);font-weight:bold;color:#0000cc}}</style></head><body><main><header class="head"><div class="meta">bäm!<br><b>investor:</b> ${escape(project.investor || '')}<br><b>dátum:</b> ${escape(project.projectDate || '')}</div><div class="title">${escape(project.name)}</div></header><button id="excel">Stiahnuť Excel</button><button id="csv">Stiahnuť CSV</button>${sections}</main><script>function download(data,type,name){const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}document.getElementById('excel').onclick=()=>download('${xlsx}','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Vypis-poloziek.xlsx');document.getElementById('csv').onclick=()=>download('${csv}','text/csv;charset=utf-8','Vypis-poloziek.csv')</script></body></html>`
}
