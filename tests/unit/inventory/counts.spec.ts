import { describe, expect, it } from 'vitest'
import { withLine } from '~/features/inventory/api'
import { countedSchema, locationSchema, openCountSchema } from '~/features/inventory/schemas'
import {
  chunkList,
  countFilterLabel,
  normalizeLocation,
  parseLocations,
} from '~/features/inventory/status'
import type { Count, CountLine } from '~/features/inventory/types'

const W = '0b1d6a3e-8a1f-4f3e-9b8e-3c2a1d4e5f60'

function line(over: Partial<CountLine> = {}): CountLine {
  return {
    variantId: 'v1',
    sku: 'SKU-1',
    productTitle: 'Producto',
    position: 1,
    location: 'A1',
    counted: null,
    countedBy: null,
    countedAt: null,
    recount: false,
    expected: null,
    difference: null,
    outcome: null,
    movementId: null,
    ...over,
  }
}

function sheet(lines: CountLine[]): Count {
  return {
    id: 'c1',
    folio: 'C-000001',
    warehouseId: W,
    status: 'OPEN',
    filter: { location: 'A*' },
    note: null,
    blind: true,
    lineCount: lines.length,
    countedCount: lines.filter((l) => l.counted !== null).length,
    lines,
    version: 1,
    createdAt: '2026-11-08T10:00:00.000Z',
    createdBy: 'u1',
    closedAt: null,
    closedBy: null,
  } as Count
}

describe('ubicaciones (ADR-0173)', () => {
  it('se normalizan como la API: sin espacios de sobra y en mayúsculas', () => {
    expect(normalizeLocation('  vitrina   1 ')).toBe('VITRINA 1')
    expect(normalizeLocation('a1')).toBe('A1')
  })

  it('hasta 20 caracteres al normalizarla; vacía la quita', () => {
    expect(locationSchema.safeParse({ location: '' }).success).toBe(true)
    expect(locationSchema.safeParse({ location: `  ${'A'.repeat(20)}  ` }).success).toBe(true)
    expect(locationSchema.safeParse({ location: 'A'.repeat(21) }).success).toBe(false)
  })

  it('etiquetas de estante: sin repetir, en orden natural y sin las largas', () => {
    const { valid, invalid } = parseLocations('a10, a2\nA2\n\nvitrina 1,' + 'X'.repeat(21))
    expect(valid).toEqual(['A2', 'A10', 'VITRINA 1'])
    expect(invalid).toEqual(['X'.repeat(21)])
    expect(chunkList([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('hojas de conteo (ADR-0173)', () => {
  it('abrir: un almacén y al menos una ubicación, categoría o clase', () => {
    const base = { warehouseId: W, location: '', note: '' }
    expect(openCountSchema.safeParse(base).success).toBe(false)
    expect(openCountSchema.safeParse({ ...base, warehouseId: '' }).success).toBe(false)
    expect(openCountSchema.safeParse({ ...base, location: 'a*' }).success).toBe(true)
    expect(openCountSchema.safeParse({ ...base, countClass: 'C' }).success).toBe(true)
    expect(openCountSchema.safeParse({ ...base, categoryId: 'cat' }).success).toBe(true)
  })

  it('abrir: el prefijo antes del * va de 1 a 20 caracteres', () => {
    const base = { warehouseId: W, note: '' }
    expect(openCountSchema.safeParse({ ...base, location: ' * ' }).success).toBe(false)
    expect(openCountSchema.safeParse({ ...base, location: `${'A'.repeat(20)}*` }).success).toBe(
      true,
    )
    expect(openCountSchema.safeParse({ ...base, location: `${'A'.repeat(21)}*` }).success).toBe(
      false,
    )
  })

  it('lo contado: entero de 0 a 100,000', () => {
    expect(countedSchema.safeParse(0).success).toBe(true)
    expect(countedSchema.safeParse(100_000).success).toBe(true)
    expect(countedSchema.safeParse(100_001).success).toBe(false)
    expect(countedSchema.safeParse(-1).success).toBe(false)
    expect(countedSchema.safeParse(1.5).success).toBe(false)
  })

  it('el filtro de la hoja, en palabras', () => {
    expect(countFilterLabel({ location: 'A*' })).toBe('Ubicaciones A…')
    expect(countFilterLabel({ location: 'B2', countClass: 'A' })).toBe('Ubicación B2 · Clase A')
    expect(countFilterLabel({ categoryId: 'c1' }, () => 'Juegos')).toBe('Categoría Juegos')
    expect(countFilterLabel({ variantIds: ['a', 'b'] })).toBe('2 variantes elegidas')
    expect(countFilterLabel({ variantIds: ['a'] })).toBe('1 variante elegida')
  })

  it('una línea guardada reemplaza la suya y cuenta como contada una vez', () => {
    const count = sheet([line(), line({ variantId: 'v2', sku: 'SKU-2', position: 2 })])
    const once = withLine(count, line({ counted: 3 }))
    expect(once.lines[0]!.counted).toBe(3)
    expect(once.countedCount).toBe(1)
    const again = withLine(once, line({ counted: 4 }))
    expect(again.countedCount).toBe(1)
    expect(again.lineCount).toBe(2)
  })

  it('una variante que no estaba se agrega al final', () => {
    const count = sheet([line()])
    const added = withLine(count, line({ variantId: 'v9', sku: 'NUEVA', position: 2, counted: 1 }))
    expect(added.lines.map((l) => l.variantId)).toEqual(['v1', 'v9'])
    expect(added.lineCount).toBe(2)
    expect(added.countedCount).toBe(1)
  })
})
