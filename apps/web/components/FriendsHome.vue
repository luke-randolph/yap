<script setup lang="ts">
import { Check, MessageSquare, Plus } from 'lucide-vue-next';
import { getApiError, type ConversationDTO, type UserPublicDTO } from '@yap/contracts';

const friends = useFriendsStore();
const conversations = useConversationsStore();
const sidebar = useSidebarStore();
const home = useHomeStore();
const toasts = useToastsStore();
const showAdd = ref(false);
const selectedUser = ref<UserPublicDTO | null>(null);
const unblockTarget = ref<UserPublicDTO | null>(null);
const busy = ref<string | null>(null);

onMounted(() => {
  friends.fetchAll().catch(() => undefined);
});

async function messageFriend(user: UserPublicDTO) {
  if (busy.value) return;
  busy.value = user.id;
  try {
    const convo = await conversations.create({ participantEmails: [user.email] });
    conversations.select(convo.id);
    sidebar.close();
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not open chat');
  } finally {
    busy.value = null;
  }
}

async function accept(id: string, name: string) {
  try {
    await friends.accept(id);
    toasts.success(`You and ${name} are now friends`);
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not accept request');
  }
}

async function decline(id: string) {
  try {
    await friends.decline(id);
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not update request');
  }
}

function blockedChatFor(userId: string): ConversationDTO | null {
  return (
    conversations.list.find(
      (c) => c.isBlocked && !c.isGroup && c.participants.some((p) => p.user.id === userId),
    ) ?? null
  );
}

function openBlocked(user: UserPublicDTO) {
  const convo = blockedChatFor(user.id);
  if (convo) {
    conversations.select(convo.id);
    sidebar.close();
  } else {
    selectedUser.value = user;
  }
}

async function unblock(user: UserPublicDTO) {
  if (busy.value) return;
  busy.value = user.id;
  try {
    await friends.unblock(user.id);
    toasts.success(`Unblocked ${user.displayName}`);
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not unblock');
  } finally {
    busy.value = null;
  }
  unblockTarget.value = null;
}
</script>

<template>
  <div class="flex h-full w-full flex-col p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">Friends</h2>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90"
        @click="showAdd = true"
      >
        <Plus class="h-4 w-4" />
        Add
      </button>
    </div>

    <div class="mt-4 flex gap-1 rounded-lg bg-muted p-1 text-sm">
      <button
        type="button"
        class="flex-1 rounded-md px-3 py-1.5"
        :class="
          home.tab === 'friends' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        "
        @click="home.tab = 'friends'"
      >
        Friends ({{ friends.friends.length }})
      </button>
      <button
        type="button"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5"
        :class="
          home.tab === 'requests' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        "
        @click="home.tab = 'requests'"
      >
        Requests
        <span
          v-if="friends.incomingCount"
          class="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
        >
          {{ friends.incomingCount }}
        </span>
      </button>
      <button
        type="button"
        class="flex-1 rounded-md px-3 py-1.5"
        :class="
          home.tab === 'blocked' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        "
        @click="home.tab = 'blocked'"
      >
        Blocked
      </button>
    </div>

    <div class="mt-3 min-h-0 flex-1 overflow-y-auto">
      <template v-if="home.tab === 'friends'">
        <p v-if="!friends.friends.length" class="py-8 text-center text-sm text-muted-foreground">
          No friends yet. Tap <span class="font-medium text-foreground">Add</span> to invite someone
          by email.
        </p>
        <ul v-else class="space-y-1">
          <li
            v-for="f in friends.friends"
            :key="f.friendshipId"
            class="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              @click="selectedUser = f.user"
            >
              <UserAvatar :name="f.user.displayName" :src="f.user.avatarUrl" :size="36" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ f.user.displayName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ f.user.email }}</span>
              </span>
            </button>
            <button
              type="button"
              :disabled="busy === f.user.id"
              class="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-50"
              title="Message"
              aria-label="Message"
              @click="messageFriend(f.user)"
            >
              <MessageSquare class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </template>

      <template v-else-if="home.tab === 'requests'">
        <p
          v-if="!friends.incoming.length && !friends.outgoing.length"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          No pending requests.
        </p>

        <template v-else>
          <div v-if="friends.incoming.length">
            <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Received
            </p>
            <ul class="space-y-1">
              <li
                v-for="r in friends.incoming"
                :key="r.id"
                class="flex items-center gap-3 rounded-md p-2"
              >
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 text-left"
                  @click="selectedUser = r.user"
                >
                  <UserAvatar :name="r.user.displayName" :src="r.user.avatarUrl" :size="36" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ r.user.displayName }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{
                      r.user.email
                    }}</span>
                  </span>
                </button>
                <button
                  type="button"
                  class="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground hover:opacity-90"
                  @click="accept(r.id, r.user.displayName)"
                >
                  <Check class="h-3.5 w-3.5" />
                  Accept
                </button>
                <button
                  type="button"
                  class="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  @click="decline(r.id)"
                >
                  Decline
                </button>
              </li>
            </ul>
          </div>

          <div v-if="friends.outgoing.length" :class="friends.incoming.length ? 'mt-4' : ''">
            <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sent
            </p>
            <ul class="space-y-1">
              <li
                v-for="r in friends.outgoing"
                :key="r.id"
                class="flex items-center gap-3 rounded-md p-2"
              >
                <UserAvatar :name="r.user.displayName" :src="r.user.avatarUrl" :size="36" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ r.user.displayName }}</span>
                  <span class="block truncate text-xs text-muted-foreground">Pending</span>
                </span>
                <button
                  type="button"
                  class="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  @click="decline(r.id)"
                >
                  Cancel
                </button>
              </li>
            </ul>
          </div>
        </template>
      </template>

      <template v-else>
        <p v-if="!friends.blocked.length" class="py-8 text-center text-sm text-muted-foreground">
          You haven't blocked anyone.
        </p>
        <ul v-else class="space-y-1">
          <li
            v-for="u in friends.blocked"
            :key="u.id"
            class="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              @click="openBlocked(u)"
            >
              <UserAvatar :name="u.displayName" :src="u.avatarUrl" :size="36" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ u.displayName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ u.email }}</span>
              </span>
            </button>
            <button
              type="button"
              :disabled="busy === u.id"
              class="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-50"
              @click="unblockTarget = u"
            >
              Unblock
            </button>
          </li>
        </ul>
      </template>
    </div>

    <AddFriendModal v-if="showAdd" @close="showAdd = false" />
    <UserProfileModal v-if="selectedUser" :user="selectedUser" @close="selectedUser = null" />
    <ConfirmModal
      v-if="unblockTarget"
      title="Unblock user?"
      :message="`${unblockTarget.displayName} will be able to message you and send you friend requests again.`"
      confirm-label="Unblock"
      :loading="busy === unblockTarget.id"
      @confirm="unblock(unblockTarget)"
      @cancel="unblockTarget = null"
    />
  </div>
</template>
