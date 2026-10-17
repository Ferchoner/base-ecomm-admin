import type { Page, Schemas } from '~/shared/api/types'

// Promociones y cupones (API_SPEC §26, ADR-0168).
export type Promotion = Schemas['PromotionDto']
export type PromotionSummary = Schemas['PromotionSummaryDto']
export type PromotionPage = Page<PromotionSummary>
export type PromotionCreateInput = Schemas['CreatePromotionDto']
export type PromotionUpdateInput = Schemas['UpdatePromotionDto']
export type PromotionStatus = Promotion['status']
export type PromotionTarget = Schemas['PromotionTargetViewDto']
export type PromotionTargetType = PromotionTarget['type']
export type PromotionChannel = 'ONLINE' | 'STORE'

/** Filtros de `GET /v1/admin/promotions` (API_SPEC §26.3). */
export interface PromotionListParams {
  page: number
  pageSize: number
  q?: string
  kind?: string
  status?: string
  channel?: string
  appliesTo?: string
  sort?: string
}

/** Opción para elegir un producto, categoría o marca como destino de la promoción. */
export interface TargetOption {
  type: PromotionTargetType
  id: string
  name: string
}
