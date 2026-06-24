export const useSidebarStore = defineStore('sidebar', () => {
  // Ignored at md+ where the sidebar is always shown.
  const isOpen = ref(true);

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  return { isOpen, open, close, toggle };
});
