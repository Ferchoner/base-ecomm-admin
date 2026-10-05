<script setup lang="ts">
import type { PageMeta } from '~/shared/api/types'

const props = defineProps<{ meta: PageMeta | undefined }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()

const summary = computed(() => {
  const m = props.meta
  if (!m || m.totalItems === 0) return ''
  const from = (m.page - 1) * m.pageSize + 1
  const to = Math.min(m.page * m.pageSize, m.totalItems)
  return `${from}–${to} de ${m.totalItems}`
})
</script>

<template>
  <div v-if="meta && meta.totalPages > 0" class="flex flex-wrap items-center justify-between gap-2">
    <span class="text-sm text-muted">{{ summary }}</span>
    <UPagination
      v-if="meta.totalPages > 1"
      :page="meta.page"
      :total="meta.totalItems"
      :items-per-page="meta.pageSize"
      @update:page="(p) => emit('update:page', p)"
    />
  </div>
</template>
