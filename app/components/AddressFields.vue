<script setup lang="ts">
import type { AddressFields } from '~/shared/address/address-form'
import { useGeoMunicipalities, useGeoStates } from '~/shared/api/geo'

/**
 * Campos de una dirección `AddressInput` con estados y municipios del INEGI (API_SPEC §10). Va dentro
 * de un `UForm`; `prefix` es la ruta de los errores (por ejemplo, `address` → `address.phone`).
 */
const props = withDefaults(
  defineProps<{ address: AddressFields; prefix?: string; contactLabel?: string }>(),
  { prefix: 'address', contactLabel: 'Contacto' },
)

const name = (field: keyof AddressFields) => `${props.prefix}.${field}`

const { data: states } = useGeoStates()
const { data: municipalities, isFetching: loadingMunicipalities } = useGeoMunicipalities(
  () => props.address.stateCode,
)
const stateOptions = computed(() =>
  (states.value ?? []).map((s) => ({ value: s.code, label: s.name })),
)
const municipalityOptions = computed(() =>
  (municipalities.value ?? []).map((m) => ({ value: m.code, label: m.name })),
)
watch(
  () => props.address.stateCode,
  (code, previous) => {
    // eslint-disable-next-line vue/no-mutating-props -- el objeto reactivo es del formulario padre
    if (previous !== undefined && code !== previous) props.address.municipalityCode = ''
  },
)
</script>

<!-- eslint-disable vue/no-mutating-props -- los campos editan el estado reactivo del formulario padre -->
<template>
  <fieldset class="grid gap-4 sm:grid-cols-2">
    <legend class="sr-only">Dirección</legend>
    <UFormField :label="contactLabel" :name="name('recipientName')" required>
      <UInput v-model="address.recipientName" class="w-full" />
    </UFormField>
    <UFormField label="Teléfono" :name="name('phone')" required help="10 dígitos.">
      <UInput v-model="address.phone" inputmode="numeric" maxlength="10" class="w-full" />
    </UFormField>
    <UFormField label="Calle" :name="name('street')" required class="sm:col-span-2">
      <UInput v-model="address.street" class="w-full" />
    </UFormField>
    <UFormField label="Número exterior" :name="name('exteriorNumber')" required>
      <UInput v-model="address.exteriorNumber" class="w-full" />
    </UFormField>
    <UFormField label="Número interior" :name="name('interiorNumber')">
      <UInput v-model="address.interiorNumber" class="w-full" />
    </UFormField>
    <UFormField label="Colonia" :name="name('neighborhood')" required>
      <UInput v-model="address.neighborhood" class="w-full" />
    </UFormField>
    <UFormField label="Código postal" :name="name('postalCode')" required>
      <UInput v-model="address.postalCode" inputmode="numeric" maxlength="5" class="w-full" />
    </UFormField>
    <UFormField label="Estado" :name="name('stateCode')" required>
      <USelectMenu
        v-model="address.stateCode"
        :items="stateOptions"
        value-key="value"
        label-key="label"
        placeholder="Elige el estado"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Municipio" :name="name('municipalityCode')" required>
      <USelectMenu
        v-model="address.municipalityCode"
        :items="municipalityOptions"
        value-key="value"
        label-key="label"
        :loading="loadingMunicipalities"
        :disabled="!address.stateCode"
        placeholder="Elige el municipio"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Ciudad" :name="name('city')">
      <UInput v-model="address.city" class="w-full" />
    </UFormField>
    <UFormField label="Referencias" :name="name('references')" class="sm:col-span-2">
      <UTextarea v-model="address.references" :maxlength="250" autoresize class="w-full" />
    </UFormField>
  </fieldset>
</template>
