<script setup lang="ts">
import type { Schemas } from '~/shared/api/types'

/**
 * Dirección de un pedido o envío. En una orden anonimizada o bloqueada solo quedan código postal,
 * estado y municipio (API_SPEC §8.2, ADR-0145, ADR-0151); el resto llega en `null`.
 */
const props = defineProps<{
  address:
    Schemas['AdminOrderAddressDto'] | Schemas['ShipmentAddressDto'] | Schemas['PostalAddressDto']
}>()

const a = computed(() => props.address)
const street = computed(() =>
  [
    a.value.street,
    a.value.exteriorNumber,
    a.value.interiorNumber && `int. ${a.value.interiorNumber}`,
  ]
    .filter(Boolean)
    .join(' '),
)
const reduced = computed(() => !a.value.street && !a.value.recipientName)
</script>

<template>
  <address class="space-y-0.5 text-sm not-italic">
    <div v-if="a.recipientName" class="font-medium">{{ a.recipientName }}</div>
    <div v-if="street">{{ street }}</div>
    <div v-if="a.neighborhood">{{ a.neighborhood }}</div>
    <div>
      C.P. {{ a.postalCode }}, {{ a.city ? `${a.city}, ` : '' }}{{ a.municipalityName }},
      {{ a.stateName }}
    </div>
    <div v-if="a.references" class="text-muted">{{ a.references }}</div>
    <div v-if="a.phone">Tel. {{ a.phone }}</div>
    <p v-if="reduced" class="text-xs text-muted">
      Sin datos personales: solo se conservan el código postal, el estado y el municipio.
    </p>
  </address>
</template>
