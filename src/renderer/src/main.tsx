import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import './styles.css'
import { insertItem } from './item-numbering'
import { normalizeItem, sameUrl, swapAlternative, type Item, type Product } from './product-items'
import { defaultReportSelection, reportFields, type ReportSelection, type MainField, type AlternativeField } from '../../report-fields'

type Room = { id: string; name: string; category?: 'T' | 'SV' | 'L'; collapsed: boolean; items: Item[] }
type Project = { version: 1; name: string; investor?: string; projectDate?: string; propertyType?: string; rooms: Room[] }

const initialRooms: Room[] = [
  { id: 'living', name: '01 / typové prvky - 1.01 chodba', collapsed: false, items: [] },
  { id: 'kitchen', name: '02 / typové prvky - 1.02 denná zóna', collapsed: true, items: [] }
]
const todayMonth = () => { const date = new Date(); return `${String(date.getMonth() + 1).padStart(2, '0')} / ${date.getFullYear()}` }

const formatMoney = (value: number) => new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const roomTotal = (room: Room) => room.items.reduce((sum, item) => sum + (Number(item.price.replace(',', '.')) || 0) * item.quantity, 0)
const itemLabel = (count: number) => count === 1 ? 'položka' : count > 1 && count < 5 ? 'položky' : 'položiek'

function AlternativeEditor({ alternative, parentCode, disabled, quantity, currency, onAdd, onChange, onSwap, onRemove }: { alternative?: Product; parentCode?: string; disabled: boolean; quantity: number; currency: string; onAdd: (product: Product) => void; onChange: (change: Partial<Product>, url?: string) => void; onSwap: () => void; onRemove: () => void }): ReactElement {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState('')
  const current = useRef(alternative)
  current.current = alternative
  const load = async (url: string) => {
    const initial: Product = { name: '', url, quantity, price: '', currency }
    onAdd(initial)
    setAdding(false); setLink('')
    setLoading(true); setError('')
    try {
      const result = await window.bamItems.loadProduct(url)
      const latest = current.current
      if (!latest || latest.url !== url) return
      const changes: Partial<Product> = {}
      for (const field of ['name', 'price', 'currency', 'imageData', 'color', 'dimensions'] as const) {
        if (latest[field] === initial[field] && !initial[field] && result[field]) changes[field] = result[field]
      }
      onChange(changes, url)
    } catch (err) { setError(err instanceof Error ? err.message : 'Produkt sa nepodarilo načítať.') } finally { setLoading(false) }
  }
  if (!alternative) return adding ? <form className="add-link alternative-link-entry" onSubmit={event => { event.preventDefault(); const url = link.trim(); if (url) void load(url) }}><span aria-hidden="true">↗</span><input autoFocus value={link} onChange={event => setLink(event.target.value)} placeholder="Vložte odkaz na pridanie alternatívy a stlačte Enter" aria-label="Odkaz na alternatívu" /><button type="submit">Pridať</button><button type="button" aria-label="Zrušiť pridávanie alternatívy" onClick={() => { setAdding(false); setLink('') }}>×</button></form> : <button className="alternative-add" type="button" onClick={() => setAdding(true)}>+ Pridať alternatívu</button>
  return <section className="alternative" aria-label={`Alternatíva k položke ${parentCode || ''}`}>
    <div className="alternative-label">ALTERNATÍVA</div>
    <div className="item alternative-row">
      <label className="alternative-photo" title="Zmeniť obrázok">{alternative.imageData ? <img className="product-image" src={alternative.imageData} alt="Obrázok alternatívy" /> : <span className="placeholder-image" aria-hidden="true">{loading ? '…' : '⌂'}</span>}<input type="file" accept="image/png,image/jpeg" aria-label="Zmeniť obrázok alternatívy" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') onChange({ imageData: reader.result }) }; reader.readAsDataURL(file) }} /></label>
      <div className="item-main"><input className="item-name" value={alternative.name} placeholder={loading ? 'Načítavam produkt…' : 'Názov alternatívy'} aria-label="Názov alternatívy" onChange={event => onChange({ name: event.target.value })} /><input className="alternative-url-input" value={alternative.url} aria-label="Odkaz alternatívy" onChange={event => onChange({ url: event.target.value })} />
        <div className="item-meta-fields"><input value={alternative.note || ''} onChange={event => onChange({ note: event.target.value })} placeholder="Poznámka" aria-label="Poznámka alternatívy" /><input value={alternative.color || ''} onChange={event => onChange({ color: event.target.value })} placeholder="Farba / variant" aria-label="Farba alternatívy" /><input value={alternative.dimensions || ''} onChange={event => onChange({ dimensions: event.target.value })} placeholder="Rozmery" aria-label="Rozmery alternatívy" /></div>
        {error && <small className="fetch-error">{error} Údaje môžete doplniť ručne.</small>}
        <button className="alternative-swap" type="button" disabled={disabled || loading} onClick={onSwap}>Použi tento</button>
      </div>
      <label className="compact-field"><span>Množstvo</span><input type="number" min="1" value={alternative.quantity} onChange={event => onChange({ quantity: Math.max(1, Number(event.target.value) || 1) })} /></label>
      <label className="compact-field price-field"><span>Cena / ks</span><div><input value={alternative.price} inputMode="decimal" onChange={event => onChange({ price: event.target.value })} /><span>€</span></div></label>
      <strong className="line-total" title="Alternatíva sa nezapočítava do celkového súčtu">{alternative.price ? `${formatMoney((Number(alternative.price.replace(',', '.')) || 0) * alternative.quantity)} €` : 'Chýba cena'}</strong>
      <button className="remove" type="button" aria-label="Odstrániť alternatívu" disabled={loading} onClick={() => { if (window.confirm('Odstrániť alternatívu aj so zadanými údajmi?')) onRemove() }}>×</button>
    </div>
  </section>
}

function App(): ReactElement {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [projectName, setProjectName] = useState('Nový interiérový projekt')
  const [investor, setInvestor] = useState('')
  const [projectDate, setProjectDate] = useState(todayMonth)
  const [newRoomName, setNewRoomName] = useState('')
  const [notice, setNotice] = useState('')
  const [reportPath, setReportPath] = useState<string | undefined>()
  const [reportSelection, setReportSelection] = useState<ReportSelection>(defaultReportSelection)
  const [selectingReport, setSelectingReport] = useState(false)
  const reportDialog = useRef<HTMLDialogElement>(null)
  const [projectPath, setProjectPath] = useState<string | undefined>()
  const [selectedItem, setSelectedItem] = useState<{ roomId: string; itemId: string } | null>(null)
  const [manualItem, setManualItem] = useState<{ roomId: string; url: string } | null>(null)
  const [removedRoomNotice, setRemovedRoomNotice] = useState('')
  const [duplicate, setDuplicate] = useState<{ roomId: string; itemId: string; url: string; code?: string; name: string } | null>(null)
  const duplicateDialog = useRef<HTMLDialogElement>(null)
  const linkInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const roomsRef = useRef(rooms)
  roomsRef.current = rooms

  const projectTotal = useMemo(() => rooms.reduce((sum, room) => sum + roomTotal(room), 0), [rooms])
  const detail = selectedItem ? (() => {
    const room = rooms.find(entry => entry.id === selectedItem.roomId)
    const item = room?.items.find(entry => entry.id === selectedItem.itemId)
    return room && item ? { room, item } : null
  })() : null
  const project = (): Project => ({ version: 1, name: projectName, investor, projectDate, rooms: rooms.map(room => ({ ...room, items: room.items.map(({ loading: _loading, fetchError: _fetchError, ...item }) => item) })) })

  useEffect(() => {
    window.bamItems.lastProject().then(result => {
      const loaded = result.project as Project | undefined
      if (loaded?.name && Array.isArray(loaded.rooms)) { setProjectName(loaded.name); setInvestor(loaded.investor || ''); setProjectDate(loaded.projectDate || ''); setRooms(loaded.rooms.map(room => ({ ...room, items: room.items.map(normalizeItem) }))); setProjectPath(result.path); setNotice(`Otvorený posledný projekt: ${loaded.name}`) }
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!projectPath) return
    const timer = window.setTimeout(() => { window.bamItems.saveProject(project(), projectPath).catch(() => setNotice('Automatické uloženie sa nepodarilo.')) }, 700)
    return () => window.clearTimeout(timer)
  }, [projectName, investor, projectDate, rooms, projectPath])

  useEffect(() => {
    if (!removedRoomNotice) return
    const timer = window.setTimeout(() => setRemovedRoomNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [removedRoomNotice])

  useEffect(() => {
    if (duplicate && duplicateDialog.current && !duplicateDialog.current.open) duplicateDialog.current.showModal()
  }, [duplicate])
  useEffect(() => { if (selectingReport && reportDialog.current && !reportDialog.current.open) reportDialog.current.showModal() }, [selectingReport])

  const updateRoom = (roomId: string, update: (room: Room) => Room) => setRooms(current => current.map(room => room.id === roomId ? update(room) : room))
  const updateItem = (roomId: string, itemId: string, update: (item: Item) => Item) => updateRoom(roomId, room => ({ ...room, items: room.items.map(item => item.id === itemId ? update(item) : item) }))

  const addItem = (roomId: string, url: string, allowDuplicate = false) => {
    const cleanUrl = url.trim()
    if (!cleanUrl) return
    const existing = roomsRef.current.find(room => room.id === roomId)?.items.find(item => sameUrl(item.url, cleanUrl))
    if (existing && !allowDuplicate) {
      setDuplicate({ roomId, itemId: existing.id, url: cleanUrl, code: existing.code, name: existing.name })
      return
    }
    const itemId = crypto.randomUUID()
    setRooms(current => insertItem<Item, Room>(current, roomId, { id: itemId, url: cleanUrl, name: 'Načítavam produkt…', quantity: 1, price: '', currency: 'EUR', loading: true }).map(room => room.id === roomId ? { ...room, collapsed: false } : room))
    requestAnimationFrame(() => { const input = linkInputs.current[roomId]; if (input) { input.value = ''; input.focus() } })
    window.bamItems.loadProduct(cleanUrl).then(product => updateItem(roomId, itemId, item => ({
      ...item,
      name: item.name === 'Načítavam produkt…' ? product.name || 'Nová položka' : item.name,
      price: item.price || product.price || '',
      currency: product.currency || item.currency,
      imageData: item.imageData || product.imageData,
      color: item.color ?? product.color,
      dimensions: item.dimensions ?? product.dimensions,
      loading: false
    }))).catch(error => updateItem(roomId, itemId, item => ({ ...item, name: item.name === 'Načítavam produkt…' ? 'Nová položka' : item.name, loading: false, fetchError: error instanceof Error ? error.message : 'Produkt sa nepodarilo načítať.' })))
  }

  const closeDuplicate = (clearInput: boolean) => {
    const roomId = duplicate?.roomId
    duplicateDialog.current?.close()
    setDuplicate(null)
    if (roomId) requestAnimationFrame(() => { const input = linkInputs.current[roomId]; if (input) { if (clearInput) input.value = ''; input.focus() } })
  }

  const addManualItem = (roomId: string, url: string) => {
    const cleanUrl = url.trim()
    if (!cleanUrl) return
    let normalizedUrl = cleanUrl
    try { normalizedUrl = new URL(cleanUrl).toString() } catch { setNotice('Zadajte platný odkaz na produkt (https://…).'); return }
    const itemId = crypto.randomUUID()
    setRooms(current => insertItem<Item, Room>(current, roomId, { id: itemId, url: normalizedUrl, name: 'Nová položka', quantity: 1, price: '', currency: 'EUR' }).map(room => room.id === roomId ? { ...room, collapsed: false } : room))
    setManualItem(null)
    setNotice('Položka pridaná. Doplňte názov, cenu a ďalšie údaje priamo v riadku.')
  }

  const createReport = async () => {
    setReportPath(undefined)
    setNotice('Vytváram výpis…')
    try {
      const result = await window.bamItems.createReport(project(), reportSelection)
      setNotice('')
      if (!result.cancelled && result.path) setReportPath(result.path)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Výpis sa nepodarilo vytvoriť.') }
  }

  const saveProject = async () => {
    try {
      const result = await window.bamItems.saveProject(project(), projectPath)
      if (!result.cancelled && result.path) { setProjectPath(result.path); setNotice(`Projekt uložený: ${result.path}`) }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Projekt sa nepodarilo uložiť.') }
  }

  const openProject = async () => {
    try {
      const result = await window.bamItems.openProject()
      const loaded = result.project as Project | undefined
      if (!result.cancelled && result.path && loaded?.name && Array.isArray(loaded.rooms)) { setProjectName(loaded.name); setInvestor(loaded.investor || ''); setProjectDate(loaded.projectDate || ''); setRooms(loaded.rooms.map(room => ({ ...room, items: room.items.map(normalizeItem) }))); setProjectPath(result.path); setSelectedItem(null); setNotice(`Otvorený projekt: ${loaded.name}`) }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Projekt sa nepodarilo otvoriť.') }
  }

  const newProject = () => {
    setProjectName('Nový interiérový projekt'); setInvestor(''); setProjectDate(todayMonth()); setRooms(initialRooms.map(room => ({ ...room, items: [] }))); setProjectPath(undefined); setSelectedItem(null); setNotice('Vytvorený nový projekt. Uložte ho tlačidlom Uložiť.')
  }

  const addRoom = () => {
    const name = newRoomName.trim()
    if (!name) return
    setRooms(current => [...current, { id: crypto.randomUUID(), name: /^\d+\s*\//.test(name) ? name : `${String(current.length + 1).padStart(2, '0')} / typové prvky - ${name}`, category: 'T', collapsed: false, items: [] }])
    setNewRoomName('')
  }

  const removeRoom = (room: Room) => {
    if (room.items.length > 0 && !window.confirm(`Odstrániť miestnosť „${room.name}“ aj so všetkými ${room.items.length} položkami?`)) return
    setRooms(current => current.filter(entry => entry.id !== room.id))
    setSelectedItem(current => current?.roomId === room.id ? null : current)
    setRemovedRoomNotice(`Miestnosť „${room.name}“ bola odstránená.`)
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><img src="/bam-logo.png" alt="bam!" /><span>ITEMS LIST</span></div>
      <nav aria-label="Akcie projektu">
        <button className="toolbar-button" type="button" onClick={newProject}>Nový projekt</button>
        <button className="toolbar-button" type="button" onClick={openProject}>Otvoriť</button>
        <button className="toolbar-button" type="button" onClick={saveProject}>Uložiť</button>
        <button className="export-button" type="button" onClick={() => { setReportSelection(defaultReportSelection()); setSelectingReport(true) }}>Vytvoriť výpis</button>
      </nav>
    </header>

    <section className="workspace">
      <div className="project-heading">
        <div className="project-fields"><label>Investor<input value={investor} onChange={event => setInvestor(event.target.value)} placeholder="Meno investora" /></label><label>Dátum<input value={projectDate} onChange={event => setProjectDate(event.target.value)} placeholder="MM / RRRR" /></label><label className="project-title">Názov projektu<input className="project-name" value={projectName} onChange={event => setProjectName(event.target.value)} aria-label="Názov projektu" /></label></div>
        <div className="grand-total"><span>Celkom</span><strong>{formatMoney(projectTotal)} €</strong></div>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {reportPath && <div className="notice report-notice" role="status"><button className="report-notice-link" type="button" title="Zobraziť výpis v priečinku" onClick={() => window.bamItems.revealReport().catch(() => setNotice('Priečinok s výpisom sa nepodarilo otvoriť.'))}>Výpis uložený: {reportPath}</button><button className="report-notice-close" type="button" aria-label="Zavrieť oznámenie o uložení výpisu" onClick={() => setReportPath(undefined)}>×</button></div>}
      {removedRoomNotice && <p className="notice" role="status">{removedRoomNotice}</p>}

      <div className="rooms" aria-label="Miestnosti projektu">
        {rooms.map(room => <section className="room" key={room.id}>
          <div className="room-header">
            <button className="collapse" type="button" onClick={() => updateRoom(room.id, value => ({ ...value, collapsed: !value.collapsed }))} aria-expanded={!room.collapsed} aria-label={`${room.collapsed ? 'Rozbaliť' : 'Zbaliť'} ${room.name}`}>{room.collapsed ? '›' : '⌄'}</button>
            <input className="room-name" value={room.name} onChange={event => updateRoom(room.id, value => ({ ...value, name: event.target.value }))} aria-label="Názov miestnosti" />
            <span className="item-count">{room.items.length} {itemLabel(room.items.length)}</span>
            <strong className="room-total">{formatMoney(roomTotal(room))} €</strong>
            <button className="remove-room" type="button" onClick={() => removeRoom(room)} aria-label={`Odstrániť miestnosť ${room.name}`}>×</button>
          </div>
          {!room.collapsed && <div className="room-content">
            <label className="room-category">Označovanie nových položiek <select value={room.category || 'T'} onChange={event => updateRoom(room.id, value => ({ ...value, category: event.target.value as 'T' | 'SV' | 'L' }))}><option value="T">Typové prvky (T1)</option><option value="SV">Svietidlá (SV 01)</option><option value="L">Malé lampy (L1)</option></select></label>
            {room.items.length > 0 && <div className="item-list">
              {room.items.map(item => <div className="item-group" key={item.id}><article className="item item-clickable" onClick={() => setSelectedItem({ roomId: room.id, itemId: item.id })}>
                {item.imageData ? <img className="product-image" src={item.imageData} alt="" /> : <div className="placeholder-image" aria-hidden="true">{item.loading ? '…' : '⌂'}</div>}
                <div className="item-main">
                  <input className="item-name" value={item.name} onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, name: event.target.value }))} aria-label="Názov položky" />
                  <a href={item.url} onClick={event => event.stopPropagation()} target="_blank" rel="noreferrer" title={item.url}>{item.url}</a>
                  <div className="item-meta-fields"><input value={item.code || ''} onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, code: event.target.value }))} placeholder="Označenie (SV 01)" aria-label="Označenie položky" /><input value={item.note || ''} onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, note: event.target.value }))} placeholder="Poznámka" aria-label="Poznámka" /></div>
                  <div className="item-meta-fields"><input value={item.color || ''} onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, color: event.target.value }))} placeholder="Farba / variant" aria-label="Farba alebo variant" /><input value={item.dimensions || ''} onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, dimensions: event.target.value }))} placeholder="Rozmery" aria-label="Rozmery" /></div>
                {item.fetchError && <small className="fetch-error">{item.fetchError} Údaje môžete doplniť priamo v položke.</small>}
                </div>
                <label className="compact-field"><span>Množstvo</span><input value={item.quantity} type="number" min="1" inputMode="numeric" onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, quantity: Math.max(1, Number(event.target.value) || 1) }))} /></label>
                <label className="compact-field price-field"><span>Cena / ks</span><div><input value={item.price} type="text" inputMode="decimal" placeholder="—" onClick={event => event.stopPropagation()} onChange={event => updateItem(room.id, item.id, value => ({ ...value, price: event.target.value }))} /><span>€</span></div></label>
                <strong className="line-total">{item.price ? `${formatMoney((Number(item.price.replace(',', '.')) || 0) * item.quantity)} €` : 'Chýba cena'}</strong>
                <button className="remove" type="button" onClick={event => { event.stopPropagation(); updateRoom(room.id, value => ({ ...value, items: value.items.filter(entry => entry.id !== item.id) })) }} aria-label={`Odstrániť ${item.name}`}>×</button>
              </article>
              <AlternativeEditor alternative={item.alternative} parentCode={item.code} quantity={item.quantity} currency={item.currency} disabled={!!item.loading} onAdd={alternative => updateItem(room.id, item.id, value => ({ ...value, alternative }))} onChange={(change, url) => updateItem(room.id, item.id, value => value.alternative && (!url || value.alternative.url === url) ? { ...value, alternative: { ...value.alternative, ...change } } : value)} onSwap={() => updateItem(room.id, item.id, swapAlternative)} onRemove={() => updateItem(room.id, item.id, value => { const { alternative: _alternative, alternativeName: _name, alternativeImageData: _image, alternativePrice: _price, alternativeUrl: _url, ...rest } = value; return rest })} />
              </div>)}
            </div>}
            {manualItem?.roomId === room.id && <form className="manual-entry" onSubmit={event => { event.preventDefault(); addManualItem(room.id, manualItem.url) }}>
              <label>Ručné pridanie položky<input autoFocus value={manualItem.url} onChange={event => setManualItem({ roomId: room.id, url: event.target.value })} placeholder="https://…" /></label>
              <p>Stránka sa nepodarila načítať. Pridáme iba odkaz; názov, cenu, farbu a rozmery môžete vyplniť ručne.</p>
              <div><button type="submit">Pridať položku</button><button type="button" onClick={() => setManualItem(null)}>Zrušiť</button></div>
            </form>}
            <form className="add-link" onSubmit={event => { event.preventDefault(); addItem(room.id, linkInputs.current[room.id]?.value ?? '') }}>
              <span aria-hidden="true">↗</span><input ref={element => { linkInputs.current[room.id] = element }} placeholder="Vložte odkaz na produkt a stlačte Enter" aria-label={`Odkaz na produkt v miestnosti ${room.name}`} />
              <button type="submit">Pridať</button>
            </form>
          </div>}
        </section>)}
      </div>

      <form className="add-room" onSubmit={event => { event.preventDefault(); addRoom() }}>
        <input value={newRoomName} onChange={event => setNewRoomName(event.target.value)} placeholder="Názov novej miestnosti" aria-label="Názov novej miestnosti" />
        <button type="submit">+ Pridať miestnosť</button>
      </form>
    </section>
    {selectingReport && <dialog ref={reportDialog} className="duplicate-dialog report-fields-dialog" aria-labelledby="report-fields-title" onCancel={event => { event.preventDefault(); setSelectingReport(false) }}>
      <h2 id="report-fields-title">Vyberte polia výpisu</h2><p>Výber platí pre HTML, Excel aj CSV.</p>
      <div className="report-fields-groups"><fieldset><legend>Hlavný prvok</legend>{reportFields.main.map(([key, label]) => <label key={key}><input type="checkbox" checked={reportSelection.main.includes(key)} onChange={event => setReportSelection(current => ({ ...current, main: event.target.checked ? [...current.main, key] : current.main.filter(field => field !== key) as MainField[] }))} />{label}</label>)}</fieldset>
      <fieldset><legend>Alternatíva</legend>{reportFields.alternative.map(([key, label]) => <label key={key}><input type="checkbox" checked={reportSelection.alternative.includes(key)} onChange={event => setReportSelection(current => ({ ...current, alternative: event.target.checked ? [...current.alternative, key] : current.alternative.filter(field => field !== key) as AlternativeField[] }))} />{label}</label>)}</fieldset></div>
      <div className="duplicate-actions"><button type="button" disabled={!reportSelection.main.length && !reportSelection.alternative.length} onClick={() => { setSelectingReport(false); void createReport() }}>Vytvoriť výpis</button><button type="button" onClick={() => setSelectingReport(false)}>Zrušiť</button></div>
    </dialog>}
    {duplicate && <dialog ref={duplicateDialog} className="duplicate-dialog" aria-labelledby="duplicate-title" aria-describedby="duplicate-description" onCancel={event => { event.preventDefault(); closeDuplicate(false) }}>
      <h2 id="duplicate-title">Prvok už existuje</h2>
      <p id="duplicate-description">{duplicate.code ? `Prvok už existuje na pozícii ${duplicate.code}.` : `Prvok „${duplicate.name}“ už existuje v tejto miestnosti.`}</p>
      <div className="duplicate-actions">
        <button type="button" autoFocus onClick={() => { const { roomId, itemId } = duplicate; updateItem(roomId, itemId, item => ({ ...item, quantity: item.quantity + 1 })); closeDuplicate(true) }}>Navýšiť množstvo</button>
        <button type="button" onClick={() => { const { roomId, url } = duplicate; closeDuplicate(true); addItem(roomId, url, true) }}>Pridať nový</button>
        <button type="button" onClick={() => closeDuplicate(false)}>Zrušiť</button>
      </div>
    </dialog>}
    {detail && <div className="detail-backdrop" role="presentation" onMouseDown={() => setSelectedItem(null)}>
      <aside className="detail-card" role="dialog" aria-modal="true" aria-label={`Náhľad: ${detail.item.name}`} onMouseDown={event => event.stopPropagation()}>
        <button className="detail-close" type="button" onClick={() => setSelectedItem(null)} aria-label="Zavrieť náhľad">×</button>
        {detail.item.imageData ? <img className="detail-image" src={detail.item.imageData} alt={detail.item.name} /> : <div className="detail-image detail-placeholder">Bez obrázka</div>}
        <label>Ilustračný obrázok <input type="file" accept="image/png,image/jpeg" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') updateItem(detail.room.id, detail.item.id, item => ({ ...item, imageData: reader.result as string })) }; reader.readAsDataURL(file) }} /></label>
        <label>Odkaz na produkt <input value={detail.item.url} onChange={event => updateItem(detail.room.id, detail.item.id, item => ({ ...item, url: event.target.value }))} /></label>
        <p className="detail-room">{detail.room.name}</p><h2>{detail.item.name}</h2>
        <a className="detail-link" href={detail.item.url} target="_blank" rel="noreferrer">Otvoriť produktovú stránku ↗</a>
        <dl className="detail-facts"><div><dt>Cena za kus</dt><dd>{detail.item.price ? `${formatMoney(Number(detail.item.price.replace(',', '.')) || 0)} ${detail.item.currency}` : 'Chýba cena'}</dd></div><div><dt>Množstvo</dt><dd>{detail.item.quantity} ks</dd></div>{detail.item.color && <div><dt>Farba / variant</dt><dd>{detail.item.color}</dd></div>}{detail.item.dimensions && <div><dt>Rozmery</dt><dd>{detail.item.dimensions}</dd></div>}</dl>
        <strong className="detail-total">Spolu: {detail.item.price ? `${formatMoney((Number(detail.item.price.replace(',', '.')) || 0) * detail.item.quantity)} ${detail.item.currency}` : '—'}</strong>
      </aside>
    </div>}
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
