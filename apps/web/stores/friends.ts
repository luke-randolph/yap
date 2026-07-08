import type { FriendDTO, FriendRequestDTO, UserPublicDTO } from '@yap/contracts';

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref<FriendDTO[]>([]);
  const incoming = ref<FriendRequestDTO[]>([]);
  const outgoing = ref<FriendRequestDTO[]>([]);
  const blocked = ref<UserPublicDTO[]>([]);
  const loaded = ref(false);
  const loading = ref(false);

  const incomingCount = computed(() => incoming.value.length);

  async function fetchAll() {
    loading.value = true;
    try {
      const api = useApi();
      const [f, r, b] = await Promise.all([
        api<FriendDTO[]>('/friends'),
        api<{ incoming: FriendRequestDTO[]; outgoing: FriendRequestDTO[] }>('/friends/requests'),
        api<UserPublicDTO[]>('/users/blocked'),
      ]);
      friends.value = f;
      incoming.value = r.incoming;
      outgoing.value = r.outgoing;
      blocked.value = b;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function refreshFriends() {
    const api = useApi();
    friends.value = await api<FriendDTO[]>('/friends');
  }

  async function sendRequest(email: string): Promise<FriendRequestDTO> {
    const api = useApi();
    const created = await api<FriendRequestDTO>('/friends/requests', {
      method: 'POST',
      body: { email },
    });
    // 'incoming' means the other user had already sent a request; the server
    // accepted it, creating the friendship.
    if (created.direction === 'incoming') {
      incoming.value = incoming.value.filter((r) => r.id !== created.id);
      await refreshFriends();
    } else {
      outgoing.value = [created, ...outgoing.value.filter((r) => r.id !== created.id)];
    }
    return created;
  }

  async function accept(id: string) {
    const api = useApi();
    await api(`/friends/requests/${id}/accept`, { method: 'POST' });
    incoming.value = incoming.value.filter((r) => r.id !== id);
    await refreshFriends();
  }

  async function decline(id: string) {
    const api = useApi();
    await api(`/friends/requests/${id}/decline`, { method: 'POST' });
    incoming.value = incoming.value.filter((r) => r.id !== id);
    outgoing.value = outgoing.value.filter((r) => r.id !== id);
  }

  async function remove(userId: string) {
    const api = useApi();
    await api(`/friends/${userId}`, { method: 'DELETE' });
    friends.value = friends.value.filter((f) => f.user.id !== userId);
  }

  async function block(user: UserPublicDTO) {
    const api = useApi();
    await api(`/users/${user.id}/block`, { method: 'POST' });
    friends.value = friends.value.filter((f) => f.user.id !== user.id);
    incoming.value = incoming.value.filter((r) => r.user.id !== user.id);
    outgoing.value = outgoing.value.filter((r) => r.user.id !== user.id);
    if (!blocked.value.some((b) => b.id === user.id)) blocked.value = [user, ...blocked.value];
  }

  async function unblock(userId: string) {
    const api = useApi();
    await api(`/users/${userId}/block`, { method: 'DELETE' });
    blocked.value = blocked.value.filter((b) => b.id !== userId);
  }

  function isFriend(userId: string) {
    return friends.value.some((f) => f.user.id === userId);
  }

  function isBlocked(userId: string) {
    return blocked.value.some((b) => b.id === userId);
  }

  function incomingFrom(userId: string) {
    return incoming.value.find((r) => r.user.id === userId) ?? null;
  }

  function outgoingTo(userId: string) {
    return outgoing.value.find((r) => r.user.id === userId) ?? null;
  }

  function reset() {
    friends.value = [];
    incoming.value = [];
    outgoing.value = [];
    blocked.value = [];
    loaded.value = false;
  }

  return {
    friends,
    incoming,
    outgoing,
    blocked,
    loaded,
    loading,
    incomingCount,
    fetchAll,
    sendRequest,
    accept,
    decline,
    remove,
    block,
    unblock,
    isFriend,
    isBlocked,
    incomingFrom,
    outgoingTo,
    reset,
  };
});
