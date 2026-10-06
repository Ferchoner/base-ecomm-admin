import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import StatusBadge from '~/components/StatusBadge.vue'
import ProductForm from '~/features/catalog/components/ProductForm.vue'
import {
  brandSchema,
  categorySchema,
  productSchema,
  variantSchema,
} from '~/features/catalog/schemas'
import { PRODUCT_ACTIONS, PRODUCT_STATUS } from '~/features/catalog/status'
import { descendantIds, flattenTree } from '~/features/catalog/tree'
import type { CategoryNode, Product } from '~/features/catalog/types'
import { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'

const node = (id: string, name: string, children: CategoryNode[] = []): CategoryNode => ({
  id,
  name,
  slug: id,
  parentId: null,
  status: 'ACTIVE',
  position: 0,
  productCount: 0,
  childCount: children.length,
  children,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})

describe('árbol de categorías', () => {
  const tree = [
    node('ropa', 'Ropa', [node('camisas', 'Camisas', [node('lino', 'Lino')])]),
    node('hogar', 'Hogar'),
  ]

  it('aplana en orden con profundidad y ruta', () => {
    expect(flattenTree(tree).map((f) => [f.node.id, f.depth, f.path.join('/')])).toEqual([
      ['ropa', 0, 'Ropa'],
      ['camisas', 1, 'Ropa/Camisas'],
      ['lino', 2, 'Ropa/Camisas/Lino'],
      ['hogar', 0, 'Hogar'],
    ])
  })

  it('reúne la categoría y sus descendientes (destinos que formarían un ciclo)', () => {
    expect([...descendantIds(tree[0]!)].sort()).toEqual(['camisas', 'lino', 'ropa'])
  })
})

describe('esquemas de catálogo', () => {
  it('slug opcional con el formato de la API', () => {
    expect(brandSchema.safeParse({ name: 'Acme', slug: '' }).data).toEqual({
      name: 'Acme',
      slug: undefined,
    })
    expect(brandSchema.safeParse({ name: 'Acme', slug: 'Acme Co' }).success).toBe(false)
    expect(brandSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('posición de categoría entera entre 0 y 10 000', () => {
    const base = { name: 'Camisas', parentId: null }
    expect(categorySchema.safeParse({ ...base, position: 10_001 }).success).toBe(false)
    expect(categorySchema.safeParse({ ...base, position: 1.5 }).success).toBe(false)
    expect(categorySchema.safeParse({ ...base, position: 3 }).success).toBe(true)
  })

  it('producto con hasta 10 categorías', () => {
    const base = { title: 'Camisa', description: '', brandId: null }
    const ids = Array.from({ length: 11 }, (_, i) => `c${i}`)
    expect(productSchema.safeParse({ ...base, categoryIds: ids }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, categoryIds: ids.slice(0, 10) }).success).toBe(true)
  })

  it('variante: medidas vacías son null, un decimal y nombres de opción distintos', () => {
    const base = {
      sku: 'CAM-01',
      options: [],
      weightGrams: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
    }
    expect(variantSchema.parse(base)).toMatchObject({ weightGrams: null, lengthCm: null })
    expect(variantSchema.parse({ ...base, weightGrams: '350', lengthCm: '30.5' })).toMatchObject({
      weightGrams: 350,
      lengthCm: 30.5,
    })
    expect(variantSchema.safeParse({ ...base, lengthCm: '30.55' }).success).toBe(false)
    expect(variantSchema.safeParse({ ...base, weightGrams: '1.5' }).success).toBe(false)
    expect(variantSchema.safeParse({ ...base, sku: 'CAM 01' }).success).toBe(false)
    expect(
      variantSchema.safeParse({
        ...base,
        options: [
          { name: 'Talla', value: 'M' },
          { name: 'talla', value: 'L' },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('problemFieldErrors', () => {
  it('lleva duplicate-value y field-locked al campo', () => {
    const dup = new ApiProblem({
      type: 'duplicate-value',
      status: 409,
      title: 'Duplicado',
      extensions: { field: 'slug' },
    })
    expect(problemFieldErrors(dup, ['name', 'slug']).fieldErrors).toEqual([
      { name: 'slug', message: 'Ya existe; escribe otro valor.' },
    ])
    const locked = new ApiProblem({
      type: 'field-locked',
      status: 409,
      title: 'Campo fijo',
      extensions: { fields: ['sku', 'options'] },
    })
    expect(problemFieldErrors(locked, ['sku']).fieldErrors.map((e) => e.name)).toEqual(['sku'])
  })

  it('reparte los errores de validación', () => {
    const p = new ApiProblem({
      type: 'validation-error',
      status: 400,
      title: 'Datos inválidos',
      errors: [
        { field: 'brandId', code: 'inactiveBrand', message: 'La marca está inactiva.' },
        { field: 'other', code: 'x', message: 'Otro.' },
      ],
    })
    expect(problemFieldErrors(p, ['brandId'])).toEqual({
      fieldErrors: [{ name: 'brandId', message: 'La marca está inactiva.' }],
      otherMessages: ['Otro.'],
    })
  })
})

describe('estados', () => {
  it('ofrece las transiciones documentadas por estado', () => {
    expect(PRODUCT_ACTIONS.publish).toEqual(['DRAFT'])
    expect(PRODUCT_ACTIONS.reactivate).toEqual(['ARCHIVED'])
  })

  it('StatusBadge muestra crudo un valor que la API agregue', async () => {
    const known = await mountSuspended(StatusBadge, {
      props: { value: 'DRAFT', styles: PRODUCT_STATUS },
    })
    expect(known.text()).toBe('Borrador')
    const unknown = await mountSuspended(StatusBadge, {
      props: { value: 'REVIEW', styles: PRODUCT_STATUS },
    })
    expect(unknown.text()).toBe('REVIEW')
  })
})

describe('ProductForm', () => {
  const product = (version: number, title: string): Product => ({
    id: 'p1',
    title,
    slug: 'camisa',
    description: null,
    brand: null,
    categories: [],
    images: [],
    variants: [],
    status: 'DRAFT',
    storeVisibility: 'NOT_PUBLISHED',
    firstPublishedAt: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    version,
  })
  const title = (w: Awaited<ReturnType<typeof mountSuspended>>) =>
    (w.find('input').element as HTMLInputElement).value

  it('sin cambios propios muestra el producto recargado', async () => {
    const w = await mountSuspended(ProductForm, { props: { product: product(1, 'Camisa') } })
    await w.setProps({ product: product(2, 'Camisa de lino') })
    expect(title(w)).toBe('Camisa de lino')
    expect(w.text()).not.toContain('cambió mientras lo editabas')
  })

  it('conserva los cambios sin guardar y avisa que la versión quedó atrás', async () => {
    const w = await mountSuspended(ProductForm, { props: { product: product(1, 'Camisa') } })
    await w.find('input').setValue('Camisa azul')
    await w.setProps({ product: product(2, 'Camisa de lino') })
    expect(title(w)).toBe('Camisa azul')
    expect(w.text()).toContain('El producto cambió mientras lo editabas')
    const discard = w.findAll('button').find((b) => b.text() === 'Descartar mis cambios')
    await discard!.trigger('click')
    expect(title(w)).toBe('Camisa de lino')
    expect(w.text()).not.toContain('cambió mientras lo editabas')
  })
})
