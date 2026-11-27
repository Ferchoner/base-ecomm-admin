import type { Page, Schemas } from '~/shared/api/types'

export type CashSummary = Schemas['CashSummaryDto']
export type CashClosing = Schemas['CashClosingDto']
export type CashDay = Schemas['CashDayDto']
export type CloseCashInput = Schemas['CloseCashDto']
export type CashClosingPage = Page<CashClosing>
export type CollectionMethod = CashDay['payments'][number]['method']

export interface CashClosingListParams {
  page?: number
  pageSize?: number
  warehouseId?: string
  dateFrom?: string
  dateTo?: string
}
