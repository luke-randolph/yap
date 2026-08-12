import tailwindcss from '@tailwindcss/vite';

// Baked into the head at build time — the '/' route is SPA-rendered, so crawlers only see this.
const siteUrl = process.env.SITE_URL ?? 'https://yap.luke-randolph.com';
const siteDescription =
  'Real-time direct messages and group chats with reactions, replies, gifs and image sharing.';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      title: 'Yap',
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'canonical', href: siteUrl },
      ],
      meta: [
        { name: 'description', content: siteDescription },
        { name: 'theme-color', content: '#8b5cf6' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Yap' },
        { property: 'og:title', content: 'Yap — real-time chat' },
        { property: 'og:description', content: siteDescription },
        { property: 'og:url', content: siteUrl },
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Yap — real-time chat' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Yap — real-time chat' },
        { name: 'twitter:description', content: siteDescription },
        { name: 'twitter:image', content: `${siteUrl}/og-image.png` },
        { name: 'twitter:image:alt', content: 'Yap — real-time chat' },
      ],
    },
  },
  modules: ['@nuxtjs/color-mode', '@pinia/nuxt', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['socket.io-client', 'zod', 'lucide-vue-next', 'vuemoji-picker', '@vueuse/core'],
    },
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
  },
  routeRules: {
    '/': { ssr: false },
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3333',
    },
  },
});
