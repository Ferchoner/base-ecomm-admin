<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { ADDRESS_FIELDS, emptyAddress } from '~/shared/address/address-form'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import type { Money } from '~/shared/api/types'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useDebounced } from '~/shared/utils/debounce'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { formatMoney } from '~/shared/utils/money'
import {
  useBuyer,
  useBuyerSearch,
  usePlaceStaffOrder,
  useSellableStock,
  useStaffQuote,
  useWarehouseOptions,
} from '../api'
import { storeOrderSchema, toStaffOrderInput } from '../schemas'
import type { StoreOrderForm } from '../schemas'
import type { BuyerCustomer, SellableStock, StaffQuoteInput } from '../types'

/**
 * Pedido en la tienda física a nombre de un cliente presente (UC-ORD-12 y 13, ADR-0161): se cotiza
 * en el almacén elegido, del único que sale el stock, y se coloca con `Idempotency-Key`.
 */
const MAX_LINES = 100
const MAX_UNITS = 30

const session = useSessionStore()
const canSearchStock = computed(() => session.can('inventory.read'))
const canSearchCustomers = computed(() => session.can('customers.read'))
/** Versión del aviso de privacidad para invitados (GAPS G-19); vacía, no se aceptan invitados. */
const privacyNoticeVersion = String(useRuntimeConfig().public.privacyNoticeVersion ?? '').trim()

const state = reactive<StoreOrderForm>({
  warehouseId: '',
  fulfillment: 'SHIPPING',
  lines: [],
  buyer: canSearchCustomers.value ? 'customer' : 'guest',
  customerId: undefined,
  contactEmail: '',
  privacyNoticeShown: false,
  addressMode: 'saved',
  addressId: undefined,
  address: emptyAddress(),
})
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const problemMessages = ref<string[]>([])

// ── Almacén ──
const warehouses = useWarehouseOptions(true)
const activeWarehouses = computed(() =>
  (warehouses.data.value ?? []).filter((w) => w.status === 'ACTIVE'),
)
const warehouseOptions = computed(() =>
  activeWarehouses.value.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
watch(
  activeWarehouses,
  (list) => {
    if (!state.warehouseId && list[0]) state.warehouseId = list[0].id
  },
  { immediate: true },
)
const FULFILLMENT_OPTIONS = [
  { value: 'SHIPPING', label: 'Envío a domicilio' },
  { value: 'IN_STORE', label: 'Venta de mostrador (se entrega en la tienda)' },
]

// ── Productos ──
const search = ref('')
const debouncedSearch = useDebounced(search)
const stock = useSellableStock(() =>
  canSearchStock.value && state.warehouseId && debouncedSearch.value.trim().length >= 2
    ? { warehouseId: state.warehouseId, q: debouncedSearch.value.trim() }
    : null,
)
function addLine(item: SellableStock) {
  const existing = state.lines.find((l) => l.variantId === item.variantId)
  if (existing) existing.quantity = Math.min(MAX_UNITS, (existing.quantity ?? 0) + 1)
  else if (state.lines.length < MAX_LINES)
    state.lines.push({
      variantId: item.variantId,
      sku: item.sku,
      productTitle: item.productTitle,
      quantity: 1,
    })
  search.value = ''
}
function removeLine(variantId: string) {
  state.lines = state.lines.filter((l) => l.variantId !== variantId)
}

// ── Cotización ──
const quoteInput = computed<StaffQuoteInput | null>(() => {
  const lines = state.lines
    .filter((l) => Number.isInteger(l.quantity) && l.quantity! >= 1 && l.quantity! <= MAX_UNITS)
    .map((l) => ({ variantId: l.variantId, quantity: l.quantity! }))
  if (!state.warehouseId || lines.length === 0) return null
  return { lines, warehouseId: state.warehouseId, fulfillment: state.fulfillment }
})
const debouncedQuoteInput = useDebounced(quoteInput, 400)
const quote = useStaffQuote(debouncedQuoteInput)
/** La cotización corresponde a lo que se ve: sin cambios pendientes ni consulta en curso. */
const quoteCurrent = computed(
  () =>
    !!quote.data.value &&
    !quote.isPlaceholderData.value &&
    !quote.isFetching.value &&
    JSON.stringify(quoteInput.value) === JSON.stringify(debouncedQuoteInput.value) &&
    quoteInput.value?.lines.length === state.lines.length,
)
const quoteLine = (variantId: string) =>
  quote.data.value?.lines.find((l) => l.variantId === variantId)

// ── Comprador ──
const BUYER_OPTIONS = computed(() => [
  ...(canSearchCustomers.value ? [{ value: 'customer', label: 'Cliente registrado' }] : []),
  {
    value: 'guest',
    label: 'Invitado',
    disabled: !privacyNoticeVersion,
  },
  ...(state.fulfillment === 'IN_STORE'
    ? [{ value: 'none', label: 'Sin datos del comprador' }]
    : []),
])
watch(
  () => state.fulfillment,
  (f) => {
    if (f === 'SHIPPING' && state.buyer === 'none')
      state.buyer = canSearchCustomers.value ? 'customer' : 'guest'
  },
)
const customerSearch = ref('')
const debouncedCustomerSearch = useDebounced(customerSearch)
const buyers = useBuyerSearch(debouncedCustomerSearch)
const picked = ref<BuyerCustomer | null>(null)
function pickCustomer(c: BuyerCustomer) {
  picked.value = c
  state.customerId = c.id
  customerSearch.value = ''
}
function clearCustomer() {
  picked.value = null
  state.customerId = undefined
  state.addressId = undefined
}
const buyer = useBuyer(() => (state.buyer === 'customer' ? state.customerId : undefined))
const savedAddresses = computed(() => buyer.data.value?.addresses ?? [])
watch(savedAddresses, (list) => {
  const preferred = list.find((a) => a.isDefault) ?? list[0]
  state.addressId = preferred?.id
  state.addressMode = preferred ? 'saved' : 'new'
})
const addressOptions = computed(() =>
  savedAddresses.value.map((a) => ({
    value: a.id,
    label: `${a.street} ${a.exteriorNumber}, ${a.neighborhood}, ${a.municipalityName} (${a.recipientName})`,
  })),
)
const needsAddressForm = computed(
  () =>
    state.fulfillment === 'SHIPPING' && (state.buyer !== 'customer' || state.addressMode === 'new'),
)

// ── Colocar ──
const place = usePlaceStaffOrder()
const confirm = useConfirm()
const toast = useToast()
// Una llave por pedido: si el usuario reintenta el mismo tras un error de red, la API no duplica.
let idempotencyKey = crypto.randomUUID()
watch(
  () => [state, quote.data.value?.grandTotal.amount],
  () => (idempotencyKey = crypto.randomUUID()),
  { deep: true },
)

const FORM_FIELDS = [
  'warehouseId',
  'customerId',
  'contactEmail',
  'addressId',
  ...ADDRESS_FIELDS.map((f) => `address.${f}`),
]
const FIELD_MAP = Object.fromEntries(
  ADDRESS_FIELDS.map((f) => [`shippingAddress.${f}`, `address.${f}`]),
)

const money = (m: Money | null | undefined) => formatMoney(m)

async function onSubmit(event: FormSubmitEvent<StoreOrderForm>) {
  problem.value = null
  problemMessages.value = []
  const q = quote.data.value
  if (!quoteCurrent.value || !q?.readyToPlace) return
  const ok = await confirm({
    title: '¿Colocar el pedido?',
    description: `Total ${money(q.grandTotal)}. Se aparta el stock en el almacén elegido y el pedido queda por cobrar.`,
    confirmLabel: 'Colocar pedido',
  })
  if (!ok) return
  try {
    const order = await place.mutateAsync({
      input: toStaffOrderInput(event.data, q.grandTotal.amount, privacyNoticeVersion),
      idempotencyKey,
    })
    notifySuccess(toast, 'Pedido colocado', `${order.publicCode} queda por cobrar.`)
    await navigateTo(`/pedidos/${order.id}`)
  } catch (e) {
    const p = e as ApiProblem
    if (['total-mismatch', 'insufficient-stock', 'variant-not-sellable'].includes(p.type))
      void quote.refetch()
    if (p.type === 'total-mismatch') {
      const current = p.extensions.currentTotal as Money | undefined
      problemMessages.value = [
        `El total cambió${current ? ` a ${money(current)}` : ''}. Revisa la cotización y vuelve a colocar el pedido.`,
      ]
    } else if (p.type === 'email-not-verified') {
      problemMessages.value = ['El cliente debe confirmar su email antes de comprar.']
    }
    const fields = [...FORM_FIELDS, ...state.lines.map((_, i) => `lines.${i}.quantity`)]
    const { fieldErrors, otherMessages } = problemFieldErrors(p, fields, FIELD_MAP)
    form.value?.setErrors(fieldErrors)
    problemMessages.value.push(...otherMessages)
    problem.value = p
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="storeOrderSchema"
    :state="state"
    :validate-on="['change']"
    class="grid gap-4 lg:grid-cols-3"
    @submit="onSubmit"
  >
    <div class="space-y-4 lg:col-span-2">
      <UCard>
        <template #header><h3 class="font-semibold">Venta</h3></template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Almacén"
            name="warehouseId"
            required
            help="El stock sale solo de este almacén."
          >
            <USelect
              v-model="state.warehouseId"
              :items="warehouseOptions"
              :loading="warehouses.isPending.value"
              placeholder="Elige el almacén"
              class="w-full"
            />
          </UFormField>
          <URadioGroup v-model="state.fulfillment" :items="FULFILLMENT_OPTIONS" legend="Entrega" />
        </div>
      </UCard>

      <UCard>
        <template #header><h3 class="font-semibold">Productos</h3></template>
        <div class="space-y-3">
          <template v-if="canSearchStock">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Buscar por SKU o producto en el almacén"
              aria-label="Buscar productos"
              :disabled="!state.warehouseId"
              class="w-full"
            />
            <ul
              v-if="search.trim().length >= 2 && stock.data.value"
              class="divide-y divide-default rounded-md border border-default"
              aria-label="Resultados"
            >
              <li
                v-for="item in stock.data.value.data"
                :key="item.id"
                class="flex items-center justify-between gap-3 p-2 text-sm"
              >
                <div class="min-w-0">
                  <code class="text-xs font-medium">{{ item.sku }}</code>
                  <div class="truncate text-muted">{{ item.productTitle }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <span :class="item.available > 0 ? 'text-muted' : 'text-error'"
                    >{{ item.available }} disponibles</span
                  >
                  <UButton
                    size="sm"
                    icon="i-lucide-plus"
                    :aria-label="`Agregar ${item.sku}`"
                    @click="addLine(item)"
                  />
                </div>
              </li>
              <li v-if="stock.data.value.data.length === 0" class="p-2 text-sm text-muted">
                Sin coincidencias con existencias en este almacén.
              </li>
            </ul>
          </template>
          <p v-else class="text-sm text-muted">
            Buscar productos requiere el permiso para consultar el inventario.
          </p>

          <UFormField name="lines">
            <p v-if="state.lines.length === 0" class="text-sm text-muted">
              Agrega los productos que lleva el cliente.
            </p>
            <ul v-else class="divide-y divide-default rounded-md border border-default">
              <li
                v-for="(line, i) in state.lines"
                :key="line.variantId"
                class="flex flex-wrap items-center gap-3 p-2 text-sm"
              >
                <div class="min-w-0 flex-1">
                  <code class="text-xs font-medium">{{ line.sku }}</code>
                  <div class="truncate text-muted">
                    {{ line.productTitle }}
                    <template v-if="quoteLine(line.variantId)?.options">
                      ·
                      {{ Object.values(quoteLine(line.variantId)!.options).join(' / ') }}
                    </template>
                  </div>
                  <p
                    v-if="quoteLine(line.variantId) && !quoteLine(line.variantId)!.sellable"
                    class="text-error"
                  >
                    No se vende: no está publicada o no tiene precio.
                  </p>
                  <p
                    v-else-if="quoteLine(line.variantId) && !quoteLine(line.variantId)!.canFulfill"
                    class="text-error"
                  >
                    No alcanza en este almacén junto con lo demás.
                  </p>
                </div>
                <UFormField :name="`lines.${i}.quantity`">
                  <UInputNumber
                    v-model="line.quantity"
                    :min="1"
                    :max="MAX_UNITS"
                    :aria-label="`Unidades de ${line.sku}`"
                    class="w-28"
                  />
                </UFormField>
                <span class="w-24 text-right font-medium">{{
                  money(quoteLine(line.variantId)?.lineTotal)
                }}</span>
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`Quitar ${line.sku}`"
                  @click="removeLine(line.variantId)"
                />
              </li>
            </ul>
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header><h3 class="font-semibold">Comprador</h3></template>
        <div class="space-y-4">
          <UFormField name="buyer">
            <URadioGroup
              v-model="state.buyer"
              :items="BUYER_OPTIONS"
              orientation="horizontal"
              legend="Comprador"
            />
          </UFormField>
          <p v-if="!privacyNoticeVersion" class="text-sm text-muted">
            Sin la versión del aviso de privacidad configurada no se aceptan invitados.
          </p>

          <template v-if="state.buyer === 'customer'">
            <div v-if="picked" class="flex items-center justify-between gap-2 text-sm">
              <div>
                <div class="font-medium">{{ picked.firstNames }} {{ picked.lastNames }}</div>
                <div class="text-muted">{{ picked.email }}</div>
              </div>
              <UButton color="neutral" variant="ghost" size="sm" @click="clearCustomer"
                >Cambiar</UButton
              >
            </div>
            <UFormField
              v-else
              label="Cliente"
              name="customerId"
              required
              help="Busca por nombre o email; solo aparecen clientes activos con el email confirmado."
            >
              <UInput
                v-model="customerSearch"
                icon="i-lucide-search"
                placeholder="Nombre o email"
                class="w-full"
              />
              <ul
                v-if="customerSearch.trim().length >= 2 && buyers.data.value"
                class="mt-2 divide-y divide-default rounded-md border border-default"
                aria-label="Clientes"
              >
                <li v-for="c in buyers.data.value.data" :key="c.id">
                  <button
                    type="button"
                    class="w-full p-2 text-left text-sm hover:bg-elevated"
                    @click="pickCustomer(c)"
                  >
                    <span class="font-medium">{{ c.firstNames }} {{ c.lastNames }}</span>
                    <span class="text-muted"> · {{ c.email }}</span>
                  </button>
                </li>
                <li v-if="buyers.data.value.data.length === 0" class="p-2 text-sm text-muted">
                  Sin coincidencias.
                </li>
              </ul>
            </UFormField>
          </template>

          <template v-else-if="state.buyer === 'guest'">
            <UFormField label="Email del comprador" name="contactEmail" required>
              <UInput
                v-model="state.contactEmail"
                type="email"
                autocomplete="off"
                :maxlength="254"
                class="w-full"
              />
            </UFormField>
            <UFormField name="privacyNoticeShown">
              <UCheckbox
                v-model="state.privacyNoticeShown"
                :label="`Le presenté el aviso de privacidad (versión ${privacyNoticeVersion})`"
              />
            </UFormField>
          </template>
          <p v-else class="text-sm text-muted">
            Venta de mostrador sin email: el comprador no podrá consultar su pedido.
          </p>
        </div>
      </UCard>

      <UCard v-if="state.fulfillment === 'SHIPPING'">
        <template #header><h3 class="font-semibold">Dirección de envío</h3></template>
        <div class="space-y-4">
          <template v-if="state.buyer === 'customer' && savedAddresses.length">
            <URadioGroup
              v-model="state.addressMode"
              :items="[
                { value: 'saved', label: 'Una dirección guardada del cliente' },
                { value: 'new', label: 'Otra dirección' },
              ]"
              legend="Dirección"
            />
            <UFormField
              v-if="state.addressMode === 'saved'"
              label="Dirección guardada"
              name="addressId"
              required
            >
              <USelect v-model="state.addressId" :items="addressOptions" class="w-full" />
            </UFormField>
          </template>
          <AddressFields
            v-if="needsAddressForm"
            :address="state.address"
            contact-label="Quién recibe"
          />
        </div>
      </UCard>
    </div>

    <div class="space-y-4">
      <UCard class="lg:sticky lg:top-4">
        <template #header><h3 class="font-semibold">Total</h3></template>
        <div class="space-y-3 text-sm">
          <ProblemAlert v-if="problem" :problem="problem" :messages="problemMessages" />
          <ProblemAlert v-else-if="quote.error.value" :problem="quote.error.value" />
          <p v-if="!quoteInput" class="text-muted">Agrega productos para cotizar.</p>
          <template v-else-if="quote.data.value">
            <DetailList
              :items="[
                { label: 'Subtotal', value: money(quote.data.value.subtotal) },
                ...(quote.data.value.discountTotal.amount
                  ? [{ label: 'Descuento', value: `−${money(quote.data.value.discountTotal)}` }]
                  : []),
                {
                  label: 'Envío',
                  value:
                    state.fulfillment === 'IN_STORE'
                      ? 'En tienda'
                      : money(quote.data.value.shippingCost),
                },
                { label: 'IVA incluido', value: money(quote.data.value.taxTotal) },
              ]"
            />
            <div class="flex items-baseline justify-between border-t border-default pt-2">
              <span class="font-medium">Total</span>
              <span class="text-lg font-semibold" aria-live="polite">{{
                money(quote.data.value.grandTotal)
              }}</span>
            </div>
            <p v-if="quote.data.value.estimatedDelivery" class="text-muted">
              Entrega estimada: {{ quote.data.value.estimatedDelivery.minBusinessDays }} a
              {{ quote.data.value.estimatedDelivery.maxBusinessDays }} días hábiles tras el pago.
            </p>
            <UAlert
              v-if="!quote.data.value.readyToPlace"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="Revisa los productos marcados"
              description="Hay productos que no se venden o no alcanzan en este almacén."
            />
          </template>
          <UButton
            type="submit"
            block
            :loading="place.isPending.value"
            :disabled="!quoteCurrent || !quote.data.value?.readyToPlace"
            >Colocar pedido</UButton
          >
          <p class="text-xs text-muted">
            El pedido queda por cobrar; el pago se registra en su detalle.
          </p>
        </div>
      </UCard>
    </div>
  </UForm>
</template>
