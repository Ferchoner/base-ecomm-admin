<template>
  <main class="flex min-h-screen items-center justify-center bg-muted p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
        <UIcon name="i-lucide-store" class="size-6 text-primary" />
        <span>Backoffice</span>
      </div>
      <slot />
    </div>
  </main>
</template>
