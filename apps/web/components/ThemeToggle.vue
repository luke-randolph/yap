<script setup lang="ts">
import { Sun, Moon, Monitor } from "lucide-vue-next";

const colorMode = useColorMode();
const order = ["system", "light", "dark"] as const;

function cycle() {
  const i = order.indexOf(colorMode.preference);
  colorMode.preference = order[(i + 1) % order.length] ?? "system";
}
</script>

<template>
  <button
    type="button"
    class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    :title="`Theme: ${colorMode.preference}`"
    @click="cycle"
  >
    <Sun v-if="colorMode.preference === 'light'" class="h-5 w-5" />
    <Moon v-else-if="colorMode.preference === 'dark'" class="h-5 w-5" />
    <Monitor v-else class="h-5 w-5" />
  </button>
</template>
