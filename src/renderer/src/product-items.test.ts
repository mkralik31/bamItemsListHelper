import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeItem, sameUrl, swapAlternative, type Item } from './product-items.ts'

test('rovnaká adresa sa rozpozná, variant v URL zostáva odlišný', () => {
  assert.equal(sameUrl('https://example.com', ' https://example.com/ '), true)
  assert.equal(sameUrl('https://example.com/p?variant=1', 'https://example.com/p?variant=2'), false)
  assert.equal(sameUrl('', ''), false)
})

test('výmena zachová označenie a všetky údaje oboch produktov', () => {
  const item: Item = { id: '1', code: 'T4', name: 'Pôvodný', url: 'https://example.com/a', price: '10', quantity: 2, currency: 'EUR', note: 'A', color: 'biela', alternative: { name: 'Alternatíva', url: 'https://example.com/b', price: '20', quantity: 3, currency: 'EUR', note: 'B', dimensions: '80 cm' } }
  const swapped = swapAlternative(item)
  assert.equal(swapped.code, 'T4')
  assert.equal(swapped.name, 'Alternatíva')
  assert.equal(swapped.quantity * Number(swapped.price), 60)
  assert.equal(swapped.alternative?.color, 'biela')
  assert.equal(swapped.color, undefined)
  assert.equal(swapAlternative(swapped).alternative?.name, item.alternative?.name)
  assert.equal(swapAlternative(swapped).alternative?.dimensions, item.alternative?.dimensions)
})

test('staršia alternatíva zostane dostupná pri otvorení projektu', () => {
  const item: Item = { id: '1', name: 'Pôvodný', url: '', price: '', quantity: 2, currency: 'EUR', alternativeName: 'Alternatíva', alternativePrice: '15' }
  assert.equal(normalizeItem(item).alternative?.name, 'Alternatíva')
  assert.equal(normalizeItem(item).alternative?.quantity, 2)
})
