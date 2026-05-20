<script setup lang="ts">
const auth = useAuthStore();

async function handleLogout() {
  await auth.logout();
  await navigateTo('/login');
}
</script>

<template>
  <div>
    <header class="border-b border-border">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <h1 class="text-lg font-semibold tracking-tight">Yap</h1>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            class="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="handleLogout"
          >
            Log out
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-12">
      <p class="text-sm text-muted-foreground">Signed in as</p>
      <p class="mt-1 text-xl font-medium">{{ auth.user?.displayName }}</p>
      <p class="text-sm text-muted-foreground">{{ auth.user?.email }}</p>
    </main>
  </div>
</template>
