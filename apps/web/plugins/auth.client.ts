const PUBLIC_ROUTES = new Set(['/login']);

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', async () => {
    const auth = useAuthStore();
    await auth.refresh();

    const route = useRoute();
    const isPublic = PUBLIC_ROUTES.has(route.path);

    if (auth.isAuthenticated && isPublic) {
      await navigateTo('/', { replace: true });
    } else if (!auth.isAuthenticated && !isPublic) {
      await navigateTo('/login', { replace: true });
    }
  });
});
