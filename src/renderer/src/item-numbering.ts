type Category = 'T' | 'SV' | 'L'
type NumberedItem = { code?: string }
type NumberedRoom<T extends NumberedItem> = { id: string; category?: Category; items: T[] }

// Ručne zadané označenia mimo tvaru T + číslo zostávajú nedotknuté.
export function insertItem<T extends NumberedItem, R extends NumberedRoom<T>>(rooms: R[], roomId: string, item: T): R[] {
  const target = rooms.findIndex(room => room.id === roomId)
  if (target < 0) return rooms
  const category = rooms[target].category || 'T'
  const pattern = new RegExp(`^${category}\\s*(\\d+)$`, 'i')
  const number = (code?: string) => Number(code?.trim().match(pattern)?.[1] || 0)
  const format = (value: number) => category === 'SV' ? `SV ${String(value).padStart(2, '0')}` : `${category}${value}`
  if (category !== 'T') {
    const next = Math.max(0, ...rooms.flatMap(room => room.items.map(entry => number(entry.code)))) + 1
    return rooms.map((room, index) => index === target ? { ...room, items: [...room.items, { ...item, code: format(next) }] } : room)
  }
  const next = Math.max(0, ...rooms.slice(0, target + 1).flatMap(room => room.items.map(entry => number(entry.code)))) + 1
  return rooms.map((room, index) => {
    if (index === target) return { ...room, items: [...room.items, { ...item, code: format(next) }] }
    if (index < target) return room
    return { ...room, items: room.items.map(entry => number(entry.code) >= next ? { ...entry, code: format(number(entry.code) + 1) } : entry) }
  })
}
