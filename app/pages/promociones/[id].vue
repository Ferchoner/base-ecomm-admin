<script setup lang="ts">
import { useEndPromotion, usePromotion } from '~/features/promotions/api'
import PromotionForm from '~/features/promotions/components/PromotionForm.vue'
import { PROMOTION_STATUS, discountLabel, usesLabel } from '~/features/promotions/status'
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Promoción', permission: 'promotions.read' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const canManage = computed(() => session.can('promotions.manage'))
const { data: promotion, isPending, error, refetch } = usePromotion(id)

const end = useEndPromotion(id)
const confirm = useConfirm()
const toast = useToast()
async function onEnd() {
  const p = promotion.value
  if (!p) return
  const ok = await confirm({
    title: `¿Terminar ${p.name}?`,
    description:
      p.status === 'ACTIVE'
        ? 'Deja de aplicar ahora. No se puede deshacer; los pedidos que ya la recibieron la conservan.'
        : 'Ya no empezará. No se puede deshacer.',
    confirmLabel: 'Terminar',
    color: 'error',
  })
  if (!ok) return
  try {
    await end.mutateAsync(p.version)
    notifySuccess(toast, 'Promoción terminada')
  } catch (e) {
    notifyProblem(toast, e as ApiProblem, () => refetch())
  }
}
</script>

<template>
  <div class="space-y-4">
    <UButton to="/promociones" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Promociones</UButton
    >
    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="promotion">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-lg font-semibold">{{ promotion.name }}</h2>
          <StatusBadge :value="promotion.status" :styles="PROMOTION_STATUS" />
          <div class="flex-1" />
          <UButton
            v-if="canManage && promotion.status !== 'ENDED'"
            color="error"
            variant="outline"
            icon="i-lucide-circle-stop"
            :loading="end.isPending.value"
            @click="onEnd"
            >Terminar</UButton
          >
        </div>
        <DetailList
          :items="[
            { label: 'Descuento', value: discountLabel(promotion) },
            ...(promotion.code
              ? [
                  { label: 'Cupón', value: promotion.code, mono: true },
                  { label: 'Usos', value: usesLabel(promotion) },
                ]
              : []),
            ...(promotion.endedAt
              ? [{ label: 'Terminada', value: formatDateTime(promotion.endedAt) }]
              : []),
            { label: 'Creada', value: formatDateTime(promotion.createdAt) },
          ]"
        />
        <PromotionForm
          :key="promotion.id"
          :promotion="promotion"
          :readonly="!canManage"
          class="mt-2"
        />
      </template>
    </QueryState>
  </div>
</template>
