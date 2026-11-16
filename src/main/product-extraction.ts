export type ExtractedProductMetadata = {
  name?: string
  price?: string
  currency?: string
  imageUrl?: string
  color?: string
  dimensions?: string
}

const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

const meta = (html: string, keys: string[]) => {
  for (const key of keys) for (const pattern of [new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i'), new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, 'i')]) {
    const result = html.match(pattern)
    if (result?.[1]) return decode(result[1].trim())
  }
}

const asNumber = (value: unknown) => typeof value === 'number' ? String(value) : typeof value === 'string' ? value.replace(/\s/g, '').replace(',', '.') : undefined

const labeledPrice = (html: string): { price: string; currency: string } | undefined => {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
  const match = text.match(/(?:cena|price)\s*(?:od|za)?\s*:?[^\d]{0,160}?(\d{1,3}(?:[ .\u00a0]\d{3})*(?:[,.]\d{1,2})?)\s*(€|eur)/i)
  return match ? { price: asNumber(match[1]) || match[1], currency: 'EUR' } : undefined
}

export const productDimensions = (html: string): string | undefined => {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ')
  const labels: Record<string, string> = { height: 'Výška', width: 'Šírka', depth: 'Hĺbka', length: 'Dĺžka', výška: 'Výška', šírka: 'Šírka', hĺbka: 'Hĺbka', dĺžka: 'Dĺžka' }
  const pairs = [...text.matchAll(/\b(height|width|depth|length|výška|šírka|hĺbka|dĺžka)\s*:?\s*(\d{1,3}(?:[,.]\d+)?\s*(?:cm|mm|m))\b/gi)]
    .map(match => `${labels[match[1].toLowerCase()]} ${match[2]}`)
  if (pairs.length >= 2) return pairs.join(' × ')
  const match = text.match(/(?:rozmery?|dimensions?|size)\s*:?[\s\S]{0,110}?(\d{1,3}(?:[,.]\d+)?\s*(?:cm|mm|m)(?:\s*[x×]\s*\d{1,3}(?:[,.]\d+)?\s*(?:cm|mm|m)?){1,2})/i)
  return match?.[1]?.replace(/\s+/g, ' ').trim()
}

export const dimensionsInText = (text?: string): string | undefined => {
  if (!text) return undefined
  const match = text.replace(/\u00a0/g, ' ').match(/(\d{1,3}(?:[,.]\d+)?\s*(?:cm|mm|m)?\s*[x×]\s*\d{1,3}(?:[,.]\d+)?(?:\s*(?:cm|mm|m))?(?:\s*[x×]\s*\d{1,3}(?:[,.]\d+)?(?:\s*(?:cm|mm|m))?)?)/i)
  if (!match?.[1]) return undefined
  const value = match[1].replace(/\s+/g, ' ').trim()
  return /(?:cm|mm|m)\b/i.test(value) ? value : undefined
}

const productColor = (html: string, schema?: Record<string, unknown>): string | undefined => {
  // Product metadata avoids matching labels or sentences inside customer reviews.
  const schemaColor = typeof schema?.color === 'string' ? schema.color.trim() : undefined
  return schemaColor || meta(html, ['product:color', 'og:color'])
}

const findProductSchema = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) return value.map(findProductSchema).find(Boolean)
  const record = value as Record<string, unknown>
  if (record['@type'] === 'Product' || (Array.isArray(record['@type']) && record['@type'].includes('Product'))) return record
  return Object.values(record).map(findProductSchema).find(Boolean)
}

export const extractProductMetadata = (html: string): ExtractedProductMetadata => {
  let schema: Record<string, unknown> | undefined
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { schema ??= findProductSchema(JSON.parse(match[1])) } catch { /* preskočiť neplatné JSON-LD */ }
  }
  const offer = schema?.offers as Record<string, unknown> | undefined
  const textPrice = labeledPrice(html)
  const imageUrl = meta(html, ['og:image', 'twitter:image']) || (Array.isArray(schema?.image) ? schema.image[0] : schema?.image as string | undefined)
  const name = meta(html, ['og:title', 'twitter:title']) || schema?.name as string | undefined
  return {
    name,
    price: meta(html, ['product:price:amount', 'og:price:amount']) || asNumber(offer?.price) || textPrice?.price,
    currency: meta(html, ['product:price:currency', 'og:price:currency']) || offer?.priceCurrency as string | undefined || textPrice?.currency,
    imageUrl,
    color: productColor(html, schema),
    dimensions: productDimensions(html) || dimensionsInText(name)
  }
}
