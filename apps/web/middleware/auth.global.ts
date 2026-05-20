const PUBLIC_ROUTES = new Set(['/login']);

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  const auth = useAuthStore();

  if (!auth.isAuthenticated) {
    await auth.refresh();
  }

  const isPublic = PUBLIC_ROUTES.has(to.path);

  if (auth.isAuthenticated && isPublic) {
    return navigateTo('/');
  }

  if (!auth.isAuthenticated && !isPublic) {
    return navigateTo('/login');
  }
});
