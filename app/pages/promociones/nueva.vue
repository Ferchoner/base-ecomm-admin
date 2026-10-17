<script setup lang="ts">
import PromotionForm from '~/features/promotions/components/PromotionForm.vue'
import type { Promotion } from '~/features/promotions/types'

definePageMeta({ title: 'Nueva promoción', permission: 'promotions.manage' })

function onSaved(p: Promotion) {
  navigateTo(`/promociones/${p.id}`, { replace: true })
}
</script>

<template>
  <div class="space-y-4">
    <UButton to="/promociones" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Promociones</UButton
    >
    <PromotionForm @saved="onSaved">
      <template #actions>
        <UButton to="/promociones" color="neutral" variant="ghost">Cancelar</UButton>
      </template>
    </PromotionForm>
  </div>
</template>
