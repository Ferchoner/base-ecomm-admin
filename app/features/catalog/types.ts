import type { Page, Schemas } from '~/shared/api/types'

export type Brand = Schemas['AdminBrandDto']
export type BrandPage = Page<Brand>
export type BrandInput = Schemas['CreateBrandDto']
export type BrandStatus = Brand['status']

export type Category = Schemas['AdminCategoryDto']
export type CategoryNode = Schemas['AdminCategoryNodeDto']
export type CategoryInput = Schemas['CreateCategoryDto']
export type CategoryStatus = Category['status']

export type Product = Schemas['AdminProductDto']
export type ProductPage = Page<Product>
export type ProductStatus = Product['status']
export type StoreVisibility = Product['storeVisibility']
export type ProductCreateInput = Schemas['CreateProductDto']
export type ProductUpdateInput = Schemas['UpdateProductDto']

export type Variant = Schemas['AdminVariantDto']
export type VariantStatus = Variant['status']
export type VariantCreateInput = Schemas['CreateVariantDto']
export type VariantUpdateInput = Schemas['UpdateVariantDto']

export type ProductImage = Schemas['ImageDto']
export type ImageUpdateInput = Schemas['UpdateImageDto']

/** Filtros de `GET /v1/admin/catalog/brands` (openapi/v1.json). */
export interface BrandListParams {
  page: number
  pageSize: number
  q?: string
  status?: string
  sort?: string
}

/** Filtros de `GET /v1/admin/catalog/products` (API_SPEC §11.6). */
export interface ProductListParams {
  page: number
  pageSize: number
  q?: string
  status?: string
  brandId?: string
  categoryId?: string
  sort?: string
}
