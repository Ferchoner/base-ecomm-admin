import type { Schemas } from '~/shared/api/types'

export type PriceList = Schemas['PriceListDto']
export type PricePeriod = Schemas['PricePeriodDto']
export type PricePeriodList = Schemas['PricePeriodListDto']
export type PricePeriodState = PricePeriod['state']
export type SetPriceInput = Schemas['SetPriceDto']
export type PriceImportSummary = Schemas['PriceImportSummaryDto']
