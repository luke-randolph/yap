import { defineStore } from 'pinia';

export type HomeTab = 'friends' | 'requests' | 'blocked';

export const useHomeStore = defineStore('home', () => {
  const tab = ref<HomeTab>('friends');
  return { tab };
});
