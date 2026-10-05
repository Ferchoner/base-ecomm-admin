import { z } from 'zod'

// Límites de CreateBrandDto/CreateCategoryDto/CreateProductDto/CreateVariantDto (openapi/v1.json)
// y API_SPEC §11.6–11.9. La validación definitiva es de la API.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SLUG_MESSAGE = 'Solo minúsculas, dígitos y guiones entre ellos.'

const optionalSlug = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .refine((v) => v === '' || SLUG.test(v), SLUG_MESSAGE)
    .optional()
    .transform((v) => (v ? v : undefined))

const name100 = z.string().trim().min(1, 'Escribe un nombre.').max(100, 'Máximo 100 caracteres.')

export const brandSchema = z.object({ name: name100, slug: optionalSlug(100) })
export type BrandForm = z.input<typeof brandSchema>

export const categorySchema = z.object({
  name: name100,
  slug: optionalSlug(100),
  parentId: z.string().nullable(),
  position: z
    .number({ error: 'Escribe un número entero.' })
    .int('Escribe un número entero.')
    .min(0, 'Mínimo 0.')
    .max(10_000, 'Máximo 10 000.'),
})
export type CategoryForm = z.input<typeof categorySchema>

export const productSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un título.').max(200, 'Máximo 200 caracteres.'),
  slug: optionalSlug(200),
  description: z.string().max(10_000, 'Máximo 10 000 caracteres.'),
  brandId: z.string().nullable(),
  categoryIds: z.array(z.string()).max(10, 'Hasta 10 categorías.'),
})
export type ProductForm = z.input<typeof productSchema>

/** Número opcional de un input: vacío es `null`. */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null || Number.isNaN(v) ? null : Number(v)),
    schema.nullable(),
  )

const dimension = optionalNumber(
  z
    .number({ error: 'Escribe un número.' })
    .min(0.1, 'Mayor que 0.')
    .max(999_999.9, 'Máximo 999 999.9.')
    .refine((v) => Math.round(v * 10) === v * 10, 'Un decimal como máximo.'),
)

export const variantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, 'Escribe el SKU.')
      .max(64, 'Máximo 64 caracteres.')
      .regex(/^[A-Za-z0-9._-]+$/, 'Solo letras, dígitos, guion, guion bajo y punto.'),
    options: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Escribe el nombre.').max(30, 'Máximo 30 caracteres.'),
          value: z.string().trim().min(1, 'Escribe el valor.').max(50, 'Máximo 50 caracteres.'),
        }),
      )
      .max(3, 'Hasta 3 opciones.'),
    weightGrams: optionalNumber(
      z
        .number({ error: 'Escribe un número entero.' })
        .int('Gramos enteros.')
        .min(1, 'Mayor que 0.')
        .max(2_147_483_647, 'Demasiado grande.'),
    ),
    lengthCm: dimension,
    widthCm: dimension,
    heightCm: dimension,
  })
  .refine(
    (v) => new Set(v.options.map((o) => o.name.trim().toLowerCase())).size === v.options.length,
    { path: ['options'], message: 'Cada opción debe tener un nombre distinto.' },
  )
/** Estado del formulario: las medidas se escriben como texto; vacío es "sin valor". */
type Measure = string
export interface VariantForm {
  sku: string
  options: Array<{ name: string; value: string }>
  weightGrams: Measure
  lengthCm: Measure
  widthCm: Measure
  heightCm: Measure
}
export type VariantFormOutput = z.output<typeof variantSchema>

export const imageSchema = z.object({
  altText: z.string().max(200, 'Máximo 200 caracteres.'),
  variantId: z.string().nullable(),
})
export type ImageForm = z.input<typeof imageSchema>
