import type { Page, Schemas } from '~/shared/api/types'

export type AdminCustomer = Schemas['AdminCustomerDto']
export type CustomerPage = Page<AdminCustomer>
export type CustomerStatus = AdminCustomer['status']
export type CustomerAnonymization = Schemas['CustomerAnonymizationDto']
export type GuestAnonymizationInput = Schemas['AnonymizeGuestDto']
export type GuestAnonymization = Schemas['GuestAnonymizationDto']

/** Filtros de `GET /v1/admin/identity/customers` (API_SPEC §9.18). */
export interface CustomerListParams {
  page: number
  pageSize: number
  q?: string
  status?: string
  emailVerified?: boolean
  createdFrom?: string
  createdTo?: string
  sort?: string
}
