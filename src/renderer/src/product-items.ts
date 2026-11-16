export type Product = { url: string; name: string; quantity: number; price: string; currency: string; imageData?: string; note?: string; color?: string; dimensions?: string }
export type Item = Product & { id: string; code?: string; alternative?: Product; alternativeName?: string; alternativeImageData?: string; alternativePrice?: string; alternativeUrl?: string; loading?: boolean; fetchError?: string }

export function normalizeItem(item: Item): Item {
  if (item.alternative || !(item.alternativeName || item.alternativeImageData || item.alternativePrice || item.alternativeUrl)) return item
  return { ...item, alternative: { name: item.alternativeName || '', imageData: item.alternativeImageData, price: item.alternativePrice || '', url: item.alternativeUrl || '', quantity: item.quantity, currency: item.currency || 'EUR' } }
}

export function swapAlternative(item: Item): Item {
  const normalized = normalizeItem(item)
  if (!normalized.alternative) return item
  const { url, name, quantity, price, currency, imageData, note, color, dimensions } = normalized
  const { alternativeName: _name, alternativeImageData: _image, alternativePrice: _price, alternativeUrl: _url, ...rest } = normalized
  const next = normalized.alternative
  return { ...rest, url: next.url, name: next.name, quantity: next.quantity, price: next.price, currency: next.currency, imageData: next.imageData, note: next.note, color: next.color, dimensions: next.dimensions, alternative: { url, name, quantity, price, currency, imageData, note, color, dimensions }, loading: false, fetchError: undefined }
}

export function sameUrl(first: string, second: string): boolean {
  if (!first.trim() || !second.trim()) return false
  try { return new URL(first.trim()).href === new URL(second.trim()).href } catch { return first.trim() === second.trim() }
}
