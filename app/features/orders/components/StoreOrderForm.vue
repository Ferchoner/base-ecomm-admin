<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { ADDRESS_FIELDS, emptyAddress } from '~/shared/address/address-form'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import type { Money } from '~/shared/api/types'
import { isScanCode } from '~/shared/api/variant-lookup'
import { useSessionStore } from '~/shared/auth/session.store'
import { useDeviceWarehouse } from '~/shared/device/device-warehouse'
import { promotionLabel } from '~/shared/status/sales'
import { useScannerCapture } from '~/shared/scanner/use-scanner-capture'
import { useVariantScan } from '~/shared/scanner/use-variant-scan'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useDebounced } from '~/shared/utils/debounce'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { formatMoney } from '~/shared/utils/money'
import {
  useBuyer,
  useBuyerSearch,
  useOpenPriceVariants,
  usePlaceStaffOrder,
  useSellableStock,
  useStaffQuote,
  useStockInWarehouse,
  useWarehouseOptions,
} from '../api'
import {
  MAX_OPEN_PRICE_NOTE,
  openPriceLineReady,
  storeOrderSchema,
  toStaffOrderInput,
  toStaffOrderLine,
} from '../schemas'
import { couponProblemMessage } from '../status'
import BringStockFromOtherWarehouse from './BringStockFromOtherWarehouse.vue'
import type { StoreOrderForm } from '../schemas'
import type { BuyerCustomer, OpenPriceVariant, SellableStock, StaffQuoteInput } from '../types'

/**
 * Pedido en la tienda física a nombre de un cliente presente (UC-ORD-12 y 13, ADR-0161): se cotiza
 * en el almacén elegido, del único que sale el stock, y se coloca con `Idempotency-Key`.
 */
const props = defineProps<{
  /**
   * A dónde volver al colocarlo, en vez del detalle del pedido: recibe `?ligar=<id>&venta=<código>`
   * para que esa pantalla lo ligue (una orden de trabajo, API_SPEC §25.7).
   */
  returnTo?: string
}>()

const MAX_LINES = 100
const MAX_UNITS = 30

const session = useSessionStore()
const canSearchStock = computed(() => session.can('inventory.read'))
const canSearchCustomers = computed(() => session.can('customers.read'))
/** Escanear busca el código en el catálogo (`catalog.read`) y su existencia (`inventory.read`). */
const canScan = computed(() => canSearchStock.value && session.can('catalog.read'))
/** Vender lo que aún no está en el catálogo (ADR-0171 de base-shop, D-098). */
const canOpenPrice = computed(() => session.can('orders.open-price'))
/** Traer de otro local lo que aquí no alcanza (`inventory.transfer`, ADR-0172 de base-shop). */
const canBring = computed(() => canSearchStock.value && session.can('inventory.transfer'))
/** Versión del aviso de privacidad para invitados (GAPS G-19); vacía, no se aceptan invitados. */
const privacyNoticeVersion = String(useRuntimeConfig().public.privacyNoticeVersion ?? '').trim()

const state = reactive<StoreOrderForm>({
  warehouseId: '',
  // La venta de mostrador es la más común: es la opción inicial (PLAN_API_1.7 RQ-3, D-083).
  fulfillment: 'IN_STORE',
  lines: [],
  buyer: canSearchCustomers.value ? 'customer' : 'guest',
  customerId: undefined,
  contactEmail: '',
  privacyNoticeShown: false,
  addressMode: 'saved',
  addressId: undefined,
  address: emptyAddress(),
  couponCode: '',
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
// Empieza en el local de este equipo (D-097); si no tiene, en el primer almacén activo.
const device = useDeviceWarehouse()
watch(
  activeWarehouses,
  (list) => {
    if (!state.warehouseId) state.warehouseId = device.initial(list.map((w) => w.id))
  },
  { immediate: true },
)
const warehouseNames = computed(() =>
  Object.fromEntries((warehouses.data.value ?? []).map((w) => [w.id, w.name])),
)
const deviceWarehouseName = computed(() => {
  const w = activeWarehouses.value.find((x) => x.id === device.warehouseId.value)
  return w ? `${w.name} (${w.code})` : null
})
/** Se vende desde otro almacén que el de este equipo: se avisa, por si fue un descuido. */
const otherThanDevice = computed(
  () =>
    !!deviceWarehouseName.value &&
    !!state.warehouseId &&
    state.warehouseId !== device.warehouseId.value,
)
const FULFILLMENT_OPTIONS = [
  { value: 'IN_STORE', label: 'Venta de mostrador (se entrega en la tienda)' },
  { value: 'SHIPPING', label: 'Envío a domicilio' },
]

// ── Productos ──
const search = ref('')
const debouncedSearch = useDebounced(search)
const stock = useSellableStock(() =>
  canSearchStock.value && state.warehouseId && debouncedSearch.value.trim().length >= 2
    ? { warehouseId: state.warehouseId, q: debouncedSearch.value.trim() }
    : null,
)
const openPriceVariants = useOpenPriceVariants(
  () => canOpenPrice.value && session.can('catalog.read'),
)
const openPriceIds = computed(
  () => new Set((openPriceVariants.data.value ?? []).map((v) => v.variantId)),
)
function addLine(item: Pick<SellableStock, 'variantId' | 'sku' | 'productTitle'>) {
  const existing = state.lines.find((l) => l.variantId === item.variantId)
  if (existing) {
    if (!existing.openPrice) existing.quantity = Math.min(MAX_UNITS, (existing.quantity ?? 0) + 1)
  } else if (state.lines.length < MAX_LINES) {
    const openPrice = openPriceIds.value.has(item.variantId)
    state.lines.push({
      variantId: item.variantId,
      sku: item.sku,
      productTitle: item.productTitle,
      quantity: 1,
      ...(openPrice && { openPrice: true, unitPrice: '', note: '' }),
    })
  }
  search.value = ''
}
/**
 * "Artículo sin registrar": una línea de precio libre. Cada variante va una vez por venta, así que dos
 * artículos distintos van en variantes distintas (Juego, Consola…), como fija ADR-0171 de base-shop.
 */
const openPriceTaken = (v: OpenPriceVariant) => state.lines.some((l) => l.variantId === v.variantId)
function addOpenPrice(v: OpenPriceVariant) {
  if (openPriceTaken(v)) return
  addLine(v)
}
function removeLine(variantId: string) {
  state.lines = state.lines.filter((l) => l.variantId !== variantId)
}

// ── Lector de códigos (PLAN_API_1.7 §3.1): Enter en el buscador o escanear en cualquier parte ──
const stockInWarehouse = useStockInWarehouse()
const scan = useVariantScan({
  sellableOnly: true,
  onFound: async (v) => {
    if (!state.warehouseId) return { tone: 'warning', text: 'Elige primero el almacén.' }
    const item = await stockInWarehouse(v.id, state.warehouseId).catch(() => undefined)
    if (item === undefined)
      return { tone: 'error', text: 'No se pudo consultar la existencia. Intenta de nuevo.' }
    const none = item === null || item.available <= 0
    if (none && !canBring.value)
      return { tone: 'warning', text: `No hay existencias de ${v.sku} en este almacén.` }
    const existing = state.lines.find((l) => l.variantId === v.id)
    if (existing && (existing.quantity ?? 0) >= MAX_UNITS)
      return { tone: 'warning', text: `${v.sku} ya tiene el máximo de ${MAX_UNITS} unidades.` }
    if (!existing && state.lines.length >= MAX_LINES)
      return { tone: 'warning', text: `La venta ya tiene ${MAX_LINES} productos.` }
    addLine(item ?? { variantId: v.id, sku: v.sku, productTitle: v.product.title })
    const quantity = state.lines.find((l) => l.variantId === v.id)?.quantity ?? 1
    if (none)
      return {
        tone: 'warning',
        text: `No hay ${v.sku} en este almacén: tráelo de otro local desde la línea.`,
      }
    return {
      tone: 'success',
      text: `${v.sku} · ${v.product.title}: ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'}.${item?.location ? ` Está en ${item.location}.` : ''}`,
    }
  },
})
watch(search, (v) => {
  if (v) scan.clear()
})
const searchInput = useTemplateRef('searchInput')
// El buscador queda listo para el primer escaneo en cuanto hay almacén (se habilita con él).
watch(
  () => !!state.warehouseId,
  async (ready, was) => {
    if (!ready || was) return
    await nextTick()
    searchInput.value?.inputRef?.focus()
  },
  { immediate: true },
)
async function onSearchEnter() {
  if (!canScan.value || !isScanCode(search.value)) return
  await scan.scan(search.value)
  // Si no se agregó, el siguiente escaneo reemplaza el código en vez de sumarse a él.
  searchInput.value?.inputRef?.select()
}
useScannerCapture((code) => {
  if (!canScan.value) return
  search.value = ''
  void scan.scan(code)
  searchInput.value?.inputRef?.focus()
})

// ── Cotización ──
const quoteInput = computed<StaffQuoteInput | null>(() => {
  // Una línea de precio libre se cotiza cuando ya tiene su precio y qué se vendió.
  const lines = state.lines
    .filter((l) => Number.isInteger(l.quantity) && l.quantity! >= 1 && l.quantity! <= MAX_UNITS)
    .filter((l) => !l.openPrice || openPriceLineReady(l))
    .map((l) => toStaffOrderLine(l, l.quantity!))
  if (!state.warehouseId || lines.length === 0) return null
  return {
    lines,
    warehouseId: state.warehouseId,
    fulfillment: state.fulfillment,
    ...(state.couponCode && { couponCode: state.couponCode }),
  }
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
// ── Cupón (API_SPEC §26.8): se aplica con un botón, no al escribir, y se manda en la cotización ──
const couponDraft = ref('')
function applyCoupon() {
  state.couponCode = couponDraft.value.trim().toUpperCase()
}
function removeCoupon() {
  state.couponCode = ''
  couponDraft.value = ''
}
const quoteHints = computed(() =>
  quote.error.value?.type === 'coupon-not-applicable'
    ? [couponProblemMessage(quote.error.value.extensions.reason)]
    : [],
)

const quoteLine = (variantId: string) =>
  quote.data.value?.lines.find((l) => l.variantId === variantId)

/**
 * Sin leer el catálogo, una variante de precio libre se reconoce cuando la cotización la rechaza por
 * faltarle el precio (`openPriceRequired` en `lines[i].unitPrice`): la línea pasa a pedirlo.
 */
watch(
  () => quote.error.value,
  (p) => {
    const sent = debouncedQuoteInput.value?.lines ?? []
    for (const error of p?.errors ?? []) {
      const match = /^lines[.[](\d+)\]?\.unitPrice$/.exec(error.field)
      if (!match || error.code !== 'openPriceRequired') continue
      const variantId = sent[Number(match[1])]?.variantId
      const line = state.lines.find((l) => l.variantId === variantId)
      if (line && !line.openPrice) Object.assign(line, { openPrice: true, unitPrice: '', note: '' })
    }
  },
)

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
    await navigateTo(
      props.returnTo
        ? { path: props.returnTo, query: { ligar: order.id, venta: order.publicCode } }
        : `/pedidos/${order.id}`,
    )
  } catch (e) {
    const p = e as ApiProblem
    if (['total-mismatch', 'insufficient-stock', 'variant-not-sellable'].includes(p.type))
      void quote.refetch()
    if (p.type === 'total-mismatch') {
      const current = p.extensions.currentTotal as Money | undefined
      problemMessages.value = [
        `El total cambió${current ? ` a ${money(current)}` : ''}. Revisa la cotización y vuelve a colocar el pedido.`,
      ]
    } else if (p.type === 'coupon-not-applicable') {
      problemMessages.value = [couponProblemMessage(p.extensions.reason)]
    } else if (p.type === 'email-not-verified') {
      problemMessages.value = ['El cliente debe confirmar su email antes de comprar.']
    }
    const fields = [
      ...FORM_FIELDS,
      ...state.lines.flatMap((_, i) => [
        `lines.${i}.quantity`,
        `lines.${i}.unitPrice`,
        `lines.${i}.note`,
      ]),
    ]
    // La API nombra `lines[0].unitPrice` los errores de las líneas que revisa el dominio.
    const lineFields = Object.fromEntries(
      state.lines.flatMap((_, i) =>
        ['quantity', 'unitPrice', 'note'].map((f) => [`lines[${i}].${f}`, `lines.${i}.${f}`]),
      ),
    )
    const { fieldErrors, otherMessages } = problemFieldErrors(p, fields, {
      ...FIELD_MAP,
      ...lineFields,
    })
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
            <p v-if="otherThanDevice" class="mt-1 text-sm text-warning">
              Este equipo es de {{ deviceWarehouseName }}: confirma que el producto sale de aquí.
            </p>
          </UFormField>
          <URadioGroup v-model="state.fulfillment" :items="FULFILLMENT_OPTIONS" legend="Entrega" />
        </div>
      </UCard>

      <UCard>
        <template #header><h3 class="font-semibold">Productos</h3></template>
        <div class="space-y-3">
          <template v-if="canSearchStock">
            <UInput
              ref="searchInput"
              v-model="search"
              icon="i-lucide-scan-barcode"
              :placeholder="
                canScan
                  ? 'Escanea o busca por SKU o producto'
                  : 'Buscar por SKU o producto en el almacén'
              "
              aria-label="Buscar productos"
              :disabled="!state.warehouseId"
              :loading="scan.pending.value"
              class="w-full"
              @keydown.enter.prevent="onSearchEnter"
            />
            <ScanResult
              :feedback="scan.feedback.value"
              :choices="scan.choices.value"
              @choose="scan.choose"
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
                <span
                  v-if="item.location"
                  class="shrink-0 text-xs font-medium"
                  :aria-label="`Ubicación de ${item.sku}`"
                  ><UIcon name="i-lucide-map-pin" class="align-middle" /> {{ item.location }}</span
                >
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

          <div
            v-if="canOpenPrice && openPriceVariants.data.value?.length"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <span class="text-muted">Artículo sin registrar:</span>
            <UButton
              v-for="v in openPriceVariants.data.value"
              :key="v.variantId"
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              :disabled="!state.warehouseId || openPriceTaken(v)"
              :aria-label="`Agregar artículo sin registrar: ${v.label}`"
              @click="addOpenPrice(v)"
              >{{ v.label }}</UButton
            >
          </div>

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
                  <BringStockFromOtherWarehouse
                    v-if="
                      canBring &&
                      !line.openPrice &&
                      quoteLine(line.variantId)?.sellable &&
                      !quoteLine(line.variantId)!.canFulfill
                    "
                    :variant-id="line.variantId"
                    :sku="line.sku"
                    :quantity="line.quantity ?? 1"
                    :warehouse-id="state.warehouseId"
                    :warehouse-names="warehouseNames"
                  />
                  <div v-if="line.openPrice" class="mt-2 grid gap-2 sm:grid-cols-3">
                    <UFormField :name="`lines.${i}.unitPrice`" label="Precio con IVA" required>
                      <UInput
                        v-model="line.unitPrice"
                        inputmode="decimal"
                        placeholder="0.00"
                        icon="i-lucide-dollar-sign"
                        :aria-label="`Precio de ${line.sku}`"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField
                      :name="`lines.${i}.note`"
                      label="Qué se vendió"
                      required
                      class="sm:col-span-2"
                    >
                      <UInput
                        v-model="line.note"
                        :maxlength="MAX_OPEN_PRICE_NOTE"
                        placeholder="Ej. Juego usado de carreras"
                        :aria-label="`Qué se vendió en ${line.sku}`"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                  <p
                    v-if="line.openPrice && !openPriceLineReady(line)"
                    class="mt-1 text-xs text-muted"
                  >
                    Precio libre: se cotiza al escribir el precio y qué se vendió. No recibe
                    promociones ni cupones.
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
                <span class="w-24 text-right">
                  <span class="font-medium">{{ money(quoteLine(line.variantId)?.lineTotal) }}</span>
                  <span
                    v-if="quoteLine(line.variantId)?.discountAmount.amount"
                    class="block text-xs text-success"
                    >−{{ money(quoteLine(line.variantId)!.discountAmount) }}</span
                  >
                </span>
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
          <ProblemAlert
            v-else-if="quote.error.value"
            :problem="quote.error.value"
            :messages="quoteHints"
          />
          <div class="flex items-end gap-2">
            <UFormField label="Cupón" name="couponCode" class="flex-1">
              <UInput
                v-if="!state.couponCode"
                v-model="couponDraft"
                placeholder="Código"
                autocomplete="off"
                class="w-full uppercase"
                @keydown.enter.prevent="applyCoupon"
              />
              <div v-else class="flex items-center gap-2">
                <UBadge color="success" variant="subtle" size="lg">{{ state.couponCode }}</UBadge>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  class="px-0"
                  aria-label="Quitar cupón"
                  @click="removeCoupon"
                  >Quitar</UButton
                >
              </div>
            </UFormField>
            <UButton
              v-if="!state.couponCode"
              color="neutral"
              variant="outline"
              :disabled="!couponDraft.trim()"
              @click="applyCoupon"
              >Aplicar</UButton
            >
          </div>
          <p v-if="!quoteInput" class="text-muted">Agrega productos para cotizar.</p>
          <template v-else-if="quote.data.value">
            <DetailList
              :items="[
                { label: 'Subtotal', value: money(quote.data.value.subtotal) },
                ...(quote.data.value.discountTotal.amount
                  ? [
                      {
                        label: quote.data.value.promotion
                          ? `Descuento (${promotionLabel(quote.data.value.promotion)})`
                          : 'Descuento',
                        value: `−${money(quote.data.value.discountTotal)}`,
                      },
                    ]
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
