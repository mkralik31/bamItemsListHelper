import assert from 'node:assert/strict'
import test from 'node:test'
import { extractProductMetadata } from './product-extraction.ts'

test('Bonami titulok poskytne rozmery, ale slovo Farba z recenzie sa neimportuje', () => {
  const product = extractProductMetadata(`
    <meta property="og:title" content="Koberec Loft 160 × 230 cm">
    <article class="review"><strong>Farba</strong> presne sedí s fotkou.</article>
  `)

  assert.equal(product.dimensions, '160 × 230 cm')
  assert.equal(product.color, undefined)
})

test('farba sa načíta iba z produktového JSON-LD', () => {
  const product = extractProductMetadata(`
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Stolička","color":"Forest green"}</script>
  `)

  assert.equal(product.color, 'Forest green')
})

test('samostatné osi noo.ma sa prevedú na pomenované rozmery', () => {
  const product = extractProductMetadata(`
    <dl><dt>Height</dt><dd>76 cm</dd><dt>Width</dt><dd>48 cm</dd><dt>Depth</dt><dd>52 cm</dd></dl>
  `)

  assert.equal(product.dimensions, 'Výška 76 cm × Šírka 48 cm × Hĺbka 52 cm')
})
