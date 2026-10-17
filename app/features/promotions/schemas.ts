import { z } from 'zod'
import { PESOS_PATTERN, centsToPesosText, pesosTextToCents } from '~/shared/utils/money'
import type {
  Promotion,
  PromotionChannel,
  PromotionCreateInput,
  PromotionUpdateInput,
} from './types'
import type { PromotionField } from './status'

// CreatePromotionDto (openapi/v1.json) y API_SPEC §26.2. La validación definitiva es de la API.

const CODE = /^[A-Za-z0-9-]{4,30}$/
const MAX_CENTS = 2_147_483_647

const pesos = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || PESOS_PATTERN.test(v), 'Pesos con hasta 2 decimales.')
    .refine(
      (v) => v === '' || (pesosTextToCents(v) >= 1 && pesosTextToCents(v) <= MAX_CENTS),
      message,
    )

const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), message)

export const promotionSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe un nombre.').max(120, 'Máximo 120 caracteres.'),
    discountType: z.enum(['percentage', 'amount']),
    percentage: wholeNumber(1, 100, 'Un entero de 1 a 100.'),
    amountOff: pesos('De $0.01 en adelante.'),
    targets: z
      .array(
        z.object({
          type: z.enum(['PRODUCT', 'CATEGORY', 'BRAND']),
          id: z.string(),
          name: z.string(),
        }),
      )
      .max(100, 'Hasta 100 productos, categorías o marcas.'),
    channels: z.array(z.enum(['ONLINE', 'STORE'])).min(1, 'Elige al menos un canal.'),
    minimumSubtotal: pesos('De $0.01 en adelante.'),
    /** `datetime-local` del navegador; vacío es "ahora". Se envía en ISO con zona. */
    startsAt: z.string(),
    endsAt: z.string(),
    code: z
      .string()
      .trim()
      .refine((v) => v === '' || CODE.test(v), 'De 4 a 30 letras, números o guiones.'),
    usageLimit: wholeNumber(1, MAX_CENTS, 'Un entero mayor que 0.'),
    oncePerCustomer: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.discountType === 'percentage' && v.percentage === '')
      issue('percentage', 'Escribe el porcentaje.')
    if (v.discountType === 'amount' && v.amountOff === '') issue('amountOff', 'Escribe el monto.')
    if (v.endsAt) {
      const start = v.startsAt ? new Date(v.startsAt).getTime() : Date.now()
      if (new Date(v.endsAt).getTime() <= start) issue('endsAt', 'Debe ser posterior al inicio.')
    }
    if (!v.code && v.usageLimit) issue('usageLimit', 'Solo un cupón tiene límite de usos.')
    if (!v.code && v.oncePerCustomer)
      issue('oncePerCustomer', 'Solo un cupón se limita por cliente.')
  })
export type PromotionForm = z.input<typeof promotionSchema>

/** Fecha ISO de la API → valor de un `datetime-local` en la zona del navegador. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const toIso = (local: string) => (local ? new Date(local).toISOString() : null)

export function initialPromotionForm(p?: Promotion): PromotionForm {
  return {
    name: p?.name ?? '',
    discountType: p?.amountOff ? 'amount' : 'percentage',
    percentage: p?.percentage !== null && p?.percentage !== undefined ? String(p.percentage) : '',
    amountOff: p?.amountOff ? centsToPesosText(p.amountOff.amount) : '',
    targets: (p?.targets ?? []).map((t) => ({ type: t.type, id: t.id, name: t.name ?? t.id })),
    channels: (p?.channels as PromotionChannel[] | undefined) ?? ['ONLINE', 'STORE'],
    minimumSubtotal: p?.minimumSubtotal ? centsToPesosText(p.minimumSubtotal.amount) : '',
    startsAt: p ? toLocalInput(p.startsAt) : '',
    endsAt: toLocalInput(p?.endsAt ?? null),
    code: p?.code ?? '',
    usageLimit: p?.usageLimit !== null && p?.usageLimit !== undefined ? String(p.usageLimit) : '',
    oncePerCustomer: p?.oncePerCustomer ?? false,
  }
}

function discount(v: PromotionForm) {
  return v.discountType === 'percentage'
    ? { percentage: Number(v.percentage) }
    : { amountOff: pesosTextToCents(v.amountOff) }
}

const targetsOf = (v: PromotionForm) => v.targets.map(({ type, id }) => ({ type, id }))

/** Cuerpo de `POST /v1/admin/promotions` a partir del formulario ya válido. */
export function toCreateInput(v: PromotionForm): PromotionCreateInput {
  const code = v.code.trim()
  return {
    name: v.name.trim(),
    ...discount(v),
    targets: targetsOf(v),
    channels: v.channels,
    ...(v.minimumSubtotal && { minimumSubtotal: pesosTextToCents(v.minimumSubtotal) }),
    ...(v.startsAt && { startsAt: toIso(v.startsAt) }),
    ...(v.endsAt && { endsAt: toIso(v.endsAt) }),
    ...(code && {
      code,
      ...(v.usageLimit && { usageLimit: Number(v.usageLimit) }),
      oncePerCustomer: v.oncePerCustomer,
    }),
  }
}

/**
 * Cuerpo de `PATCH /v1/admin/promotions/{id}`: solo lo que cambió y se puede editar en el estado
 * actual (API_SPEC §26.5), con la `version` leída. `null` quita un opcional.
 */
export function toUpdateInput(
  v: PromotionForm,
  p: Promotion,
  editable: Set<PromotionField>,
): PromotionUpdateInput {
  const before = initialPromotionForm(p)
  const changed = <K extends keyof PromotionForm>(k: K) =>
    JSON.stringify(v[k]) !== JSON.stringify(before[k])
  const out: PromotionUpdateInput = { version: p.version }
  if (editable.has('name') && changed('name')) out.name = v.name.trim()
  if (
    editable.has('discount') &&
    (changed('discountType') || changed('percentage') || changed('amountOff'))
  )
    Object.assign(out, discount(v))
  if (editable.has('targets') && changed('targets')) out.targets = targetsOf(v)
  if (editable.has('channels') && changed('channels')) out.channels = v.channels
  if (editable.has('minimumSubtotal') && changed('minimumSubtotal'))
    out.minimumSubtotal = v.minimumSubtotal ? pesosTextToCents(v.minimumSubtotal) : null
  if (editable.has('startsAt') && changed('startsAt') && v.startsAt)
    out.startsAt = toIso(v.startsAt)!
  if (editable.has('endsAt') && changed('endsAt')) out.endsAt = toIso(v.endsAt)
  if (editable.has('code') && changed('code')) out.code = v.code.trim() || null
  if (editable.has('usageLimit') && changed('usageLimit'))
    out.usageLimit = v.usageLimit ? Number(v.usageLimit) : null
  if (editable.has('oncePerCustomer') && changed('oncePerCustomer'))
    out.oncePerCustomer = v.oncePerCustomer
  return out
}
