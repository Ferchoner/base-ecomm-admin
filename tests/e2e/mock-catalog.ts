import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/**
 * Catálogo en memoria con las formas de openapi/v1.json (AdminBrand, AdminCategoryNode,
 * AdminProduct). Implementa solo lo que ejercitan las pruebas, con las reglas de API_SPEC §11.
 */
const NOW = '2026-10-01T12:00:00.000Z'
let seq = 0
const uuid = () => `0192a3b4-0000-7000-8000-${String(++seq).padStart(12, '0')}`

// PNG transparente de 1×1 para las imágenes servidas en /media.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

function problem(
  route: Route,
  status: number,
  type: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      type: `/problems/${type}`,
      title,
      status,
      detail: null,
      correlationId: 'e2e',
      ...extra,
    }),
  })
}

interface Brand {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'INACTIVE'
  productCount: number
  createdAt: string
  updatedAt: string
}
interface Category extends Omit<Brand, never> {
  parentId: string | null
  position: number
  childCount: number
}
interface Variant {
  id: string
  sku: string
  options: Record<string, string>
  status: 'ACTIVE' | 'DISCONTINUED'
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  editableIdentity: boolean
}
interface Image {
  id: string
  url: string
  altText: string | null
  position: number
  variantId: string | null
}
interface Product {
  id: string
  title: string
  slug: string
  description: string | null
  brandId: string | null
  categoryIds: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  variants: Variant[]
  images: Image[]
  publishedAt: string | null
  firstPublishedAt: string | null
  archivedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export interface CatalogSeed {
  brands?: Array<Partial<Brand> & { name: string }>
  categories?: Array<Partial<Category> & { name: string }>
  products?: Array<Partial<Product> & { title: string }>
}

export async function mockCatalogApi(page: Page, seed: CatalogSeed = {}) {
  const brands: Brand[] = (seed.brands ?? []).map((b) => ({
    id: uuid(),
    slug: slugify(b.name),
    status: 'ACTIVE',
    productCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...b,
  }))
  const categories: Category[] = (seed.categories ?? []).map((c) => ({
    id: uuid(),
    slug: slugify(c.name),
    status: 'ACTIVE',
    productCount: 0,
    childCount: 0,
    parentId: null,
    position: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...c,
  }))
  const products: Product[] = (seed.products ?? []).map((p) => ({
    id: uuid(),
    slug: slugify(p.title),
    description: null,
    brandId: null,
    categoryIds: [],
    status: 'DRAFT',
    variants: [],
    images: [],
    publishedAt: null,
    firstPublishedAt: null,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  }))
  const calls: Array<{ method: string; path: string; body: unknown }> = []

  const named = (list: Array<{ id: string; name: string }>, id: string) => {
    const found = list.find((x) => x.id === id)
    return found ? { id: found.id, name: found.name } : null
  }
  const adminProduct = (p: Product, detail = true) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    ...(detail && { description: p.description }),
    brand: p.brandId ? named(brands, p.brandId) : null,
    categories: p.categoryIds.map((id) => named(categories, id)).filter(Boolean),
    status: p.status,
    storeVisibility: p.status === 'PUBLISHED' ? 'HIDDEN_NO_PRICE' : 'NOT_PUBLISHED',
    variants: p.variants.map((v) => ({ ...v, editableIdentity: !p.firstPublishedAt })),
    images: p.images,
    publishedAt: p.publishedAt,
    firstPublishedAt: p.firstPublishedAt,
    archivedAt: p.archivedAt,
    version: p.version,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  })
  const tree = (parentId: string | null): unknown[] =>
    categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .map((c) => ({
        ...c,
        childCount: categories.filter((x) => x.parentId === c.id).length,
        children: tree(c.id),
      }))
  const page_ = <T>(items: T[], url: URL) => {
    const pageNo = Number(url.searchParams.get('page') ?? 1)
    const size = Number(url.searchParams.get('pageSize') ?? 20)
    return {
      data: items.slice((pageNo - 1) * size, pageNo * size),
      meta: {
        page: pageNo,
        pageSize: size,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / size),
      },
    }
  }

  await page.route(`${API}/media/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  )

  await page.route(`${API}/v1/admin/catalog/**`, async (route) => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS') return route.fallback()
    const url = new URL(request.url())
    const path = url.pathname.replace('/v1/admin/catalog', '')
    const isJson = (request.headers()['content-type'] ?? '').includes('application/json')
    const body = (isJson ? request.postDataJSON() : null) as Record<string, unknown> | null
    calls.push({ method, path, body })
    const seg = path.split('/').filter(Boolean)

    // ── Marcas ──
    if (seg[0] === 'brands') {
      if (seg.length === 1 && method === 'GET') {
        const q = url.searchParams.get('q')?.toLowerCase()
        const status = url.searchParams.get('status')?.split(',')
        const desc = url.searchParams.get('sort') === '-name'
        const items = brands
          .filter((b) => !q || b.name.toLowerCase().includes(q))
          .filter((b) => !status || status.includes(b.status))
          .sort((a, b) => (desc ? -1 : 1) * a.name.localeCompare(b.name))
        return json(route, 200, page_(items, url))
      }
      if (seg.length === 1 && method === 'POST') {
        const name = String(body?.name)
        if (brands.some((b) => b.name.toLowerCase() === name.toLowerCase()))
          return problem(route, 409, 'duplicate-value', 'El valor ya existe', { field: 'name' })
        const brand: Brand = {
          id: uuid(),
          name,
          slug: (body?.slug as string) ?? slugify(name),
          status: 'ACTIVE',
          productCount: 0,
          createdAt: NOW,
          updatedAt: NOW,
        }
        brands.push(brand)
        return json(route, 201, brand)
      }
      const brand = brands.find((b) => b.id === seg[1])
      if (!brand) return problem(route, 404, 'not-found', 'No encontrado')
      if (method === 'PATCH') return json(route, 200, Object.assign(brand, body))
      if (method === 'DELETE') {
        if (brand.productCount > 0)
          return problem(route, 409, 'resource-in-use', 'La marca está en uso')
        brands.splice(brands.indexOf(brand), 1)
        return json(route, 204, undefined)
      }
      if (seg[2] === 'deactivate')
        return json(route, 200, Object.assign(brand, { status: 'INACTIVE' }))
      if (seg[2] === 'reactivate')
        return json(route, 200, Object.assign(brand, { status: 'ACTIVE' }))
    }

    // ── Categorías ──
    if (seg[0] === 'categories') {
      if (seg.length === 1 && method === 'GET') return json(route, 200, { data: tree(null) })
      if (seg.length === 1 && method === 'POST') {
        const category: Category = {
          id: uuid(),
          name: String(body?.name),
          slug: (body?.slug as string) ?? slugify(String(body?.name)),
          parentId: (body?.parentId as string | null) ?? null,
          position: (body?.position as number) ?? 0,
          status: 'ACTIVE',
          productCount: 0,
          childCount: 0,
          createdAt: NOW,
          updatedAt: NOW,
        }
        categories.push(category)
        return json(route, 201, category)
      }
      const category = categories.find((c) => c.id === seg[1])
      if (!category) return problem(route, 404, 'not-found', 'No encontrado')
      if (method === 'PATCH') return json(route, 200, Object.assign(category, body))
      if (method === 'DELETE') {
        if (category.productCount > 0 || categories.some((c) => c.parentId === category.id))
          return problem(route, 409, 'resource-in-use', 'La categoría está en uso')
        categories.splice(categories.indexOf(category), 1)
        return json(route, 204, undefined)
      }
      if (seg[2] === 'deactivate')
        return json(route, 200, Object.assign(category, { status: 'INACTIVE' }))
      if (seg[2] === 'reactivate')
        return json(route, 200, Object.assign(category, { status: 'ACTIVE' }))
    }

    // ── Productos ──
    if (seg[0] === 'products') {
      if (seg.length === 1 && method === 'GET') {
        const q = url.searchParams.get('q')?.toLowerCase()
        const status = url.searchParams.get('status')?.split(',')
        const items = products
          .filter(
            (p) =>
              !q ||
              p.title.toLowerCase().includes(q) ||
              p.variants.some((v) => v.sku.toLowerCase().includes(q)),
          )
          .filter((p) => !status || status.includes(p.status))
          .filter(
            (p) =>
              !url.searchParams.get('brandId') || p.brandId === url.searchParams.get('brandId'),
          )
        return json(route, 200, {
          ...page_(items, url),
          data: page_(items, url).data.map((p) => adminProduct(p, false)),
        })
      }
      if (seg.length === 1 && method === 'POST') {
        const product: Product = {
          id: uuid(),
          title: String(body?.title),
          slug: (body?.slug as string) ?? slugify(String(body?.title)),
          description: (body?.description as string) ?? null,
          brandId: (body?.brandId as string) ?? null,
          categoryIds: (body?.categoryIds as string[]) ?? [],
          status: 'DRAFT',
          variants: [],
          images: [],
          publishedAt: null,
          firstPublishedAt: null,
          archivedAt: null,
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
        }
        products.unshift(product)
        return json(route, 201, adminProduct(product))
      }
      const product = products.find((p) => p.id === seg[1])
      if (!product) return problem(route, 404, 'not-found', 'No encontrado')
      if (seg.length === 2 && method === 'GET') return json(route, 200, adminProduct(product))

      // Imágenes: sin versión (API_SPEC §11.8).
      if (seg[2] === 'images') {
        if (seg.length === 3 && method === 'POST') {
          const id = uuid()
          product.images.push({
            id,
            url: `${API}/media/products/${product.id}/${id}.png`,
            altText: null,
            position: product.images.length + 1,
            variantId: null,
          })
          return json(route, 201, product.images.at(-1))
        }
        if (seg[3] === 'order' && method === 'PUT') {
          const ids = body?.imageIds as string[]
          product.images = ids.map((id, i) => ({
            ...product.images.find((im) => im.id === id)!,
            position: i + 1,
          }))
          return json(route, 200, { data: product.images })
        }
        const image = product.images.find((im) => im.id === seg[3])
        if (!image) return problem(route, 404, 'not-found', 'No encontrado')
        if (method === 'PATCH') return json(route, 200, Object.assign(image, body))
        if (method === 'DELETE') {
          product.images = product.images
            .filter((im) => im !== image)
            .map((im, i) => ({ ...im, position: i + 1 }))
          return json(route, 204, undefined)
        }
      }

      // El resto exige la versión leída (API_SPEC §2.3).
      if (body?.version !== product.version)
        return problem(route, 409, 'version-conflict', 'El recurso cambió', {
          currentVersion: product.version,
        })
      const bump = () => {
        product.version += 1
        return json(
          route,
          seg.length === 3 && seg[2] === 'variants' && method === 'POST' ? 201 : 200,
          adminProduct(product),
        )
      }
      if (seg.length === 2 && method === 'PATCH') {
        if (product.firstPublishedAt && 'slug' in body!)
          return problem(route, 409, 'field-locked', 'Campo fijo', { fields: ['slug'] })
        const { version: _v, ...changes } = body!
        Object.assign(product, changes)
        return bump()
      }
      if (seg[2] === 'publish') {
        if (!product.variants.some((v) => v.status === 'ACTIVE'))
          return problem(
            route,
            409,
            'invalid-state-transition',
            'Transición de estado no permitida',
            {
              reason: 'no-active-variant',
              detail: 'El producto necesita al menos una variante activa.',
            },
          )
        product.status = 'PUBLISHED'
        product.publishedAt = NOW
        product.firstPublishedAt ??= NOW
        return bump()
      }
      if (seg[2] === 'archive') {
        product.status = 'ARCHIVED'
        product.archivedAt = NOW
        return bump()
      }
      if (seg[2] === 'reactivate') {
        product.status = 'DRAFT'
        product.archivedAt = null
        return bump()
      }
      if (seg[2] === 'variants') {
        if (seg.length === 3) {
          const sku = String(body?.sku).toUpperCase()
          if (products.some((p) => p.variants.some((v) => v.sku === sku)))
            return problem(route, 409, 'duplicate-value', 'El valor ya existe', { field: 'sku' })
          product.variants.push({
            id: uuid(),
            sku,
            options: (body?.options as Record<string, string>) ?? {},
            status: 'ACTIVE',
            weightGrams: (body?.weightGrams as number | null) ?? null,
            lengthCm: (body?.lengthCm as number | null) ?? null,
            widthCm: (body?.widthCm as number | null) ?? null,
            heightCm: (body?.heightCm as number | null) ?? null,
            editableIdentity: true,
          })
          return bump()
        }
        const variant = product.variants.find((v) => v.id === seg[3])
        if (!variant) return problem(route, 404, 'not-found', 'No encontrado')
        if (seg[4] === 'discontinue') variant.status = 'DISCONTINUED'
        else if (seg[4] === 'reactivate') variant.status = 'ACTIVE'
        else {
          const { version: _v, ...changes } = body!
          Object.assign(variant, changes)
        }
        return bump()
      }
    }
    return problem(route, 404, 'not-found', 'No encontrado')
  })

  return {
    calls,
    products,
    /** Simula que otro usuario guardó el producto (sube su versión). */
    touchProduct(id: string) {
      const p = products.find((x) => x.id === id)!
      p.version += 1
      p.title = `${p.title} (editado)`
    },
  }
}
