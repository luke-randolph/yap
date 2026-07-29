<script setup lang="ts">
const model = defineModel<string>({ required: true });
</script>

<template>
  <input
    v-model="model"
    class="rounded-md border border-border bg-background px-3 py-2 text-sm pointer-coarse:text-base outline-none focus:border-primary"
  />
</template>
