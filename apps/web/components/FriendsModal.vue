<script setup lang="ts">
import { Check, MessageSquare, UserPlus, X } from 'lucide-vue-next';
import { emailSchema, getApiError, type UserPublicDTO } from '@yap/contracts';

const emit = defineEmits<{ close: [] }>();

const friends = useFriendsStore();
const conversations = useConversationsStore();
const sidebar = useSidebarStore();
const toasts = useToastsStore();

const tab = ref<'friends' | 'requests'>('friends');
const email = ref('');
const adding = ref(false);
const addError = ref<string | null>(null);
const selectedUser = ref<UserPublicDTO | null>(null);
const messaging = ref<string | null>(null);

onMounted(() => {
  friends.fetchAll().catch(() => undefined);
});

async function add() {
  const parsed = emailSchema.safeParse(email.value.trim());
  if (!parsed.success) {
    addError.value = 'Enter a valid email';
    return;
  }
  adding.value = true;
  addError.value = null;
  try {
    const req = await friends.sendRequest(parsed.data);
    email.value = '';
    if (req.direction === 'incoming') {
      toasts.success(`You and ${req.user.displayName} are now friends`);
    } else {
      toasts.success(`Friend request sent to ${req.user.displayName}`);
    }
  } catch (e) {
    addError.value = getApiError(e)?.message ?? 'Could not send request';
  } finally {
    adding.value = false;
  }
}

async function messageFriend(user: UserPublicDTO) {
  if (messaging.value) return;
  messaging.value = user.id;
  try {
    const convo = await conversations.create({ participantEmails: [user.email] });
    conversations.select(convo.id);
    sidebar.close();
    emit('close');
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not open chat');
  } finally {
    messaging.value = null;
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
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-lg"
    >
      <div class="flex items-start justify-between p-6 pb-4">
        <h2 class="text-lg font-semibold tracking-tight">Friends</h2>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="px-6">
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <label class="text-sm font-medium">Add a friend by email</label>
            <input
              v-model="email"
              type="email"
              autocomplete="off"
              placeholder="name@example.com"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              @keydown.enter.prevent="add"
            />
          </div>
          <button
            type="button"
            :disabled="adding || !email.trim()"
            class="flex shrink-0 items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="add"
          >
            <UserPlus class="h-4 w-4" />
            Add
          </button>
        </div>
        <p v-if="addError" class="mt-1 text-sm text-destructive-foreground">{{ addError }}</p>

        <div class="mt-4 flex gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            class="flex-1 rounded-md px-3 py-1.5"
            :class="
              tab === 'friends' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            "
            @click="tab = 'friends'"
          >
            Friends ({{ friends.friends.length }})
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5"
            :class="
              tab === 'requests' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            "
            @click="tab = 'requests'"
          >
            Requests
            <span
              v-if="friends.incomingCount"
              class="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
            >
              {{ friends.incomingCount }}
            </span>
          </button>
        </div>
      </div>

      <div class="mt-3 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <template v-if="tab === 'friends'">
          <p v-if="!friends.friends.length" class="py-8 text-center text-sm text-muted-foreground">
            No friends yet. Add someone by their email above.
          </p>
          <ul v-else class="space-y-1">
            <li
              v-for="f in friends.friends"
              :key="f.friendshipId"
              class="flex items-center gap-3 rounded-md p-2 hover:bg-muted"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 text-left"
                @click="selectedUser = f.user"
              >
                <UserAvatar :name="f.user.displayName" :src="f.user.avatarUrl" :size="36" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ f.user.displayName }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{
                    f.user.email
                  }}</span>
                </span>
              </button>
              <button
                type="button"
                :disabled="messaging === f.user.id"
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

        <template v-else>
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
                      <span class="block truncate text-sm font-medium">{{
                        r.user.displayName
                      }}</span>
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
      </div>
    </div>

    <UserProfileModal v-if="selectedUser" :user="selectedUser" @close="selectedUser = null" />
  </div>
</template>
