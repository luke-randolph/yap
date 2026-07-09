// Canonical demo content. Guests can only ever interact with these fake
// "demo" characters; each guest gets a private copy of the conversations below.

export interface DemoCharacter {
  email: string;
  displayName: string;
}

export const DEMO_CHARACTERS: DemoCharacter[] = [
  { email: 'ava@demo.yap', displayName: 'Ava Chen' },
  { email: 'sam@demo.yap', displayName: 'Sam Robertson' },
  { email: 'maya@demo.yap', displayName: 'Maya Lopez' },
];

interface DemoMessage {
  from: string; // demo character email
  body: string;
}

// Group chat seeded for every guest. `creator` is the demo character that
// "owns" the group (marked group admin); members include the guest.
export const DEMO_GROUP = {
  name: 'Yap Crew ☕',
  creator: 'ava@demo.yap',
  members: ['ava@demo.yap', 'sam@demo.yap', 'maya@demo.yap'],
  messages: [
    { from: 'ava@demo.yap', body: 'Hey hey 👋 welcome to Yap!' },
    {
      from: 'sam@demo.yap',
      body: 'This is a demo space — go ahead and send anything. It all works for real: replies, reactions, image uploads.',
    },
    { from: 'maya@demo.yap', body: 'Try long-pressing a message to react 🎉' },
    {
      from: 'ava@demo.yap',
      body: "Heads up though — we're just sample bots, so we won't reply back 🙂",
    },
    { from: 'sam@demo.yap', body: 'When you’re ready, sign up to chat with real people.' },
  ] as DemoMessage[],
} as const;

// One-on-one DM seeded for every guest.
export const DEMO_DM = {
  with: 'ava@demo.yap',
  messages: [
    {
      from: 'ava@demo.yap',
      body: 'This is a 1:1 DM 💬 Your messages save and sync live — open a second tab to see it.',
    },
    { from: 'ava@demo.yap', body: 'Go ahead, say hi!' },
  ] as DemoMessage[],
} as const;

export const DEMO_FRIENDS = ['ava@demo.yap', 'sam@demo.yap'] as const;
export const DEMO_FRIEND_REQUEST_FROM = 'maya@demo.yap';
export const DEMO_MESSAGE_REQUEST = {
  from: 'maya@demo.yap',
  messages: [
    { from: 'maya@demo.yap', body: 'Hey! We met in Yap Crew — figured I’d say hi over here 👋' },
    {
      from: 'maya@demo.yap',
      body: 'This is a message request. Accept to reply, or decline to remove it.',
    },
  ] as DemoMessage[],
} as const;

export const GUEST_NAMES = [
  'Jordan',
  'Riley',
  'Alex',
  'Taylor',
  'Casey',
  'Morgan',
  'Jamie',
  'Quinn',
  'Avery',
  'Rowan',
  'Harper',
  'Emerson',
];
