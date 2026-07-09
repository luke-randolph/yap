<script setup lang="ts">
import { Ban, Check, MessageSquare, UserMinus, UserPlus, X } from 'lucide-vue-next';
import { getApiError, type UserPublicDTO } from '@yap/contracts';

const props = defineProps<{ user: UserPublicDTO }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const friends = useFriendsStore();
const conversations = useConversationsStore();
const sidebar = useSidebarStore();
const toasts = useToastsStore();

const busy = ref<string | null>(null);
const confirming = ref<'remove' | 'block' | 'unblock' | null>(null);

const isSelf = computed(() => props.user.id === auth.user?.id);
const isFriend = computed(() => friends.isFriend(props.user.id));
const isBlocked = computed(() => friends.isBlocked(props.user.id));
const incomingReq = computed(() => friends.incomingFrom(props.user.id));
const outgoingReq = computed(() => friends.outgoingTo(props.user.id));

onMounted(() => {
  if (!friends.loaded) friends.fetchAll().catch(() => undefined);
});

async function run(key: string, fn: () => Promise<void>, fail: string) {
  if (busy.value) return;
  busy.value = key;
  try {
    await fn();
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? fail);
  } finally {
    busy.value = null;
  }
}

function message() {
  return run(
    'message',
    async () => {
      const convo = await conversations.create({ participantEmails: [props.user.email] });
      conversations.select(convo.id);
      sidebar.close();
      emit('close');
    },
    'Could not open chat',
  );
}

function addFriend() {
  return run(
    'add',
    async () => {
      await friends.sendRequest(props.user.email);
      toasts.success(`Friend request sent to ${props.user.displayName}`);
    },
    'Could not send request',
  );
}

function acceptRequest() {
  const req = incomingReq.value;
  if (!req) return;
  return run(
    'accept',
    async () => {
      await friends.accept(req.id);
      toasts.success(`You and ${props.user.displayName} are now friends`);
    },
    'Could not accept request',
  );
}

function declineRequest() {
  const req = incomingReq.value;
  if (!req) return;
  return run('decline', () => friends.decline(req.id), 'Could not decline request');
}

function cancelRequest() {
  const req = outgoingReq.value;
  if (!req) return;
  return run('cancel', () => friends.decline(req.id), 'Could not cancel request');
}

async function removeFriend() {
  await run(
    'remove',
    async () => {
      await friends.remove(props.user.id);
      toasts.success(`Removed ${props.user.displayName}`);
    },
    'Could not remove friend',
  );
  confirming.value = null;
}

async function blockUser() {
  await run(
    'block',
    async () => {
      await friends.block(props.user);
      toasts.success(`Blocked ${props.user.displayName}`);
    },
    'Could not block',
  );
  confirming.value = null;
}

async function unblockUser() {
  await run('unblock', () => friends.unblock(props.user.id), 'Could not unblock');
  confirming.value = null;
}
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex items-start justify-between">
        <h2 class="text-lg font-semibold tracking-tight">Profile</h2>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="mt-5 flex flex-col items-center gap-3 text-center">
        <UserAvatar :name="user.displayName" :src="user.avatarUrl" :size="96" />
        <div>
          <p class="text-base font-semibold">{{ user.displayName }}</p>
          <p class="text-sm text-muted-foreground">{{ user.email }}</p>
        </div>
        <span
          v-if="isFriend"
          class="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
        >
          <Check class="h-3 w-3" /> Friends
        </span>
      </div>

      <div v-if="!isSelf" class="mt-6 space-y-2">
        <template v-if="isBlocked">
          <p class="text-center text-sm text-muted-foreground">
            You've blocked {{ user.displayName }}. They can't message you or send requests.
          </p>
          <button
            type="button"
            :disabled="busy === 'unblock'"
            class="w-full rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            @click="confirming = 'unblock'"
          >
            Unblock
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            :disabled="busy === 'message'"
            class="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="message"
          >
            <MessageSquare class="h-4 w-4" />
            Message
          </button>

          <div v-if="incomingReq" class="flex gap-2">
            <button
              type="button"
              :disabled="busy === 'accept'"
              class="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              @click="acceptRequest"
            >
              <Check class="h-4 w-4" />
              Accept request
            </button>
            <button
              type="button"
              :disabled="busy === 'decline'"
              class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              @click="declineRequest"
            >
              Decline
            </button>
          </div>

          <button
            v-else-if="outgoingReq"
            type="button"
            :disabled="busy === 'cancel'"
            class="w-full rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            @click="cancelRequest"
          >
            Cancel request
          </button>

          <button
            v-else-if="isFriend"
            type="button"
            :disabled="busy === 'remove'"
            class="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            @click="confirming = 'remove'"
          >
            <UserMinus class="h-4 w-4" />
            Remove friend
          </button>

          <button
            v-else
            type="button"
            :disabled="busy === 'add'"
            class="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            @click="addFriend"
          >
            <UserPlus class="h-4 w-4" />
            Add friend
          </button>

          <button
            type="button"
            :disabled="busy === 'block'"
            class="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm text-destructive-foreground hover:bg-muted disabled:opacity-50"
            @click="confirming = 'block'"
          >
            <Ban class="h-4 w-4" />
            Block
          </button>
        </template>
      </div>
    </div>

    <ConfirmModal
      v-if="confirming === 'block'"
      title="Block user?"
      :message="`${user.displayName} won't be able to message you or send you friend requests.`"
      confirm-label="Block"
      danger
      :loading="busy === 'block'"
      @confirm="blockUser"
      @cancel="confirming = null"
    />
    <ConfirmModal
      v-if="confirming === 'unblock'"
      title="Unblock user?"
      :message="`${user.displayName} will be able to message you and send you friend requests again.`"
      confirm-label="Unblock"
      :loading="busy === 'unblock'"
      @confirm="unblockUser"
      @cancel="confirming = null"
    />
    <ConfirmModal
      v-if="confirming === 'remove'"
      title="Remove friend?"
      :message="`You'll no longer be friends with ${user.displayName}.`"
      confirm-label="Remove"
      danger
      :loading="busy === 'remove'"
      @confirm="removeFriend"
      @cancel="confirming = null"
    />
  </div>
</template>
