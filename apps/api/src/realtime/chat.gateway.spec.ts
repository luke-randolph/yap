import { ForbiddenException } from '@nestjs/common';
import type { AuthService } from '../auth/auth.service';
import type { MessagesService } from '../messages/messages.service';
import { ChatGateway } from './chat.gateway';

type SendSocket = Parameters<ChatGateway['onMessageSend']>[0];

const CONVERSATION_ID = 'ckvv1abcd0000abcd1234efgh';
const CLIENT_MESSAGE_ID = '6f9619ff-8b86-4d01-b42d-00c04fc964ff';

function makeSocket(userId?: string) {
  const join = jest.fn();
  const disconnect = jest.fn();
  const socket = { data: { userId }, join, disconnect } as unknown as SendSocket;
  return { socket, join, disconnect };
}

function makeGateway(overrides: { verifyAccessToken?: jest.Mock; createMessage?: jest.Mock }) {
  const verifyAccessToken = overrides.verifyAccessToken ?? jest.fn();
  const createMessage = overrides.createMessage ?? jest.fn();
  const auth = { verifyAccessToken } as unknown as AuthService;
  const messages = { create: createMessage } as unknown as MessagesService;
  return { gateway: new ChatGateway(auth, messages), verifyAccessToken, createMessage };
}

describe('ChatGateway', () => {
  describe('onMessageSend', () => {
    it('rejects a socket with no authenticated user', async () => {
      const { gateway } = makeGateway({});
      const { socket } = makeSocket(undefined);
      const ack = await gateway.onMessageSend(socket, {
        conversationId: CONVERSATION_ID,
        body: 'hi',
        clientMessageId: CLIENT_MESSAGE_ID,
      });
      expect(ack).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    });

    it('rejects a payload that fails validation', async () => {
      const { gateway, createMessage } = makeGateway({});
      const { socket } = makeSocket('user-1');
      const ack = await gateway.onMessageSend(socket, { body: '' });
      expect(ack).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
      expect(createMessage).not.toHaveBeenCalled();
    });

    it('persists a valid message and acks with it', async () => {
      const message = { id: 'msg-1', conversationId: CONVERSATION_ID };
      const createMessage = jest.fn().mockResolvedValue(message);
      const { gateway } = makeGateway({ createMessage });
      const { socket } = makeSocket('user-1');

      const ack = await gateway.onMessageSend(socket, {
        conversationId: CONVERSATION_ID,
        body: 'hello',
        clientMessageId: CLIENT_MESSAGE_ID,
      });

      expect(createMessage).toHaveBeenCalledWith('user-1', CONVERSATION_ID, {
        body: 'hello',
        clientMessageId: CLIENT_MESSAGE_ID,
      });
      expect(ack).toEqual({ ok: true, message });
    });

    it('maps a known service error to its error code', async () => {
      const createMessage = jest
        .fn()
        .mockRejectedValue(
          new ForbiddenException({ error: { code: 'NOT_PARTICIPANT', message: 'nope' } }),
        );
      const { gateway } = makeGateway({ createMessage });
      const { socket } = makeSocket('user-1');

      const ack = await gateway.onMessageSend(socket, {
        conversationId: CONVERSATION_ID,
        body: 'hello',
        clientMessageId: CLIENT_MESSAGE_ID,
      });

      expect(ack).toEqual({ ok: false, error: { code: 'NOT_PARTICIPANT', message: 'nope' } });
    });

    it('maps an unexpected error to a generic send failure', async () => {
      const createMessage = jest.fn().mockRejectedValue(new Error('boom'));
      const { gateway } = makeGateway({ createMessage });
      const { socket } = makeSocket('user-1');

      const ack = await gateway.onMessageSend(socket, {
        conversationId: CONVERSATION_ID,
        body: 'hello',
        clientMessageId: CLIENT_MESSAGE_ID,
      });

      expect(ack).toMatchObject({ ok: false, error: { code: 'SEND_FAILED' } });
    });
  });

  describe('handleConnection', () => {
    it('joins the user room for an authenticated socket', async () => {
      const { gateway } = makeGateway({});
      const { socket, join, disconnect } = makeSocket('user-1');
      await gateway.handleConnection(socket);
      expect(join).toHaveBeenCalledWith('user:user-1');
      expect(disconnect).not.toHaveBeenCalled();
    });

    it('disconnects a socket with no user', async () => {
      const { gateway } = makeGateway({});
      const { socket, join, disconnect } = makeSocket(undefined);
      await gateway.handleConnection(socket);
      expect(disconnect).toHaveBeenCalledWith(true);
      expect(join).not.toHaveBeenCalled();
    });
  });

  describe('onAuthRefresh', () => {
    it('re-joins the room when the same user refreshes', async () => {
      const verifyAccessToken = jest.fn().mockResolvedValue({ sub: 'user-1' });
      const { gateway } = makeGateway({ verifyAccessToken });
      const { socket, join, disconnect } = makeSocket('user-1');
      await gateway.onAuthRefresh(socket, { accessToken: 'good' });
      expect(join).toHaveBeenCalledWith('user:user-1');
      expect(disconnect).not.toHaveBeenCalled();
    });

    it('disconnects when a different user token arrives on the socket', async () => {
      const verifyAccessToken = jest.fn().mockResolvedValue({ sub: 'user-2' });
      const { gateway } = makeGateway({ verifyAccessToken });
      const { socket, disconnect } = makeSocket('user-1');
      await gateway.onAuthRefresh(socket, { accessToken: 'other-user' });
      expect(disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects on a missing token', async () => {
      const { gateway } = makeGateway({});
      const { socket, disconnect } = makeSocket('user-1');
      await gateway.onAuthRefresh(socket, { accessToken: '' });
      expect(disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects on an invalid token', async () => {
      const verifyAccessToken = jest.fn().mockRejectedValue(new Error('bad token'));
      const { gateway } = makeGateway({ verifyAccessToken });
      const { socket, disconnect } = makeSocket('user-1');
      await gateway.onAuthRefresh(socket, { accessToken: 'bad' });
      expect(disconnect).toHaveBeenCalledWith(true);
    });
  });
});
