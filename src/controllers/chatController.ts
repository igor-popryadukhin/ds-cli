import { randomUUID } from 'node:crypto';
import { DeepSeekClient, ChatMessage } from '../api/deepseekClient';
import { Message } from '../core/models/message';
import { Session } from '../core/models/session';
import { SessionFsRepository } from '../core/repository/sessionFsRepository';
import { loadAgentsDoc } from '../core/services/agentsDocLoader';
import { EventBus } from '../core/services/eventBus';
import { logger } from '../utils/logger';

function cloneMessage(message?: Message): Message | undefined {
  if (!message) {
    return undefined;
  }
  return { ...message };
}

function cloneSession(session: Session): Session {
  return {
    ...session,
    messages: session.messages.map(cloneMessage) as Message[],
    turns: session.turns.map((turn) => ({
      ...turn,
      user: cloneMessage(turn.user),
      assistant: cloneMessage(turn.assistant),
    })),
    meta: session.meta ? { ...session.meta } : undefined,
  };
}

function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export class ChatController {
  constructor(
    private readonly client: DeepSeekClient,
    private readonly repo: SessionFsRepository,
    private readonly cwd: string,
    private readonly model: string,
    private readonly events: EventBus,
    private readonly agentsLoader: typeof loadAgentsDoc = loadAgentsDoc,
  ) {}

  get eventBus() {
    return this.events;
  }

  async startSession(): Promise<Session> {
    const now = Date.now();
    const id = randomUUID();
    const systemPrompt = await this.agentsLoader(this.cwd);
    const session: Session = {
      id,
      model: this.model,
      createdAt: now,
      messages: [],
      turns: [],
      meta: { cwd: this.cwd },
    };

    if (systemPrompt.trim()) {
      const systemMessage: Message = {
        id: randomUUID(),
        role: 'system',
        content: systemPrompt,
        ts: Date.now(),
      };
      session.messages.push(systemMessage);
    }

    await this.repo.saveSnapshot(session);
    await this.repo.append(session.id, { type: 'session.started', model: this.model, ts: Date.now() });

    logger.debug({ sessionId: session.id, model: this.model }, 'Session started');
    this.events.emit('session', session);
    this.events.emit('status', { state: 'idle' });
    return session;
  }

  async send(current: Session, userText: string): Promise<Session> {
    const session = cloneSession(current);
    const ts = Date.now();
    const user: Message = { id: randomUUID(), role: 'user', content: userText, ts };
    session.messages = [...session.messages, user];

    Object.assign(current, session);
    current.messages = session.messages;
    current.turns = session.turns;
    current.meta = session.meta;

    await this.repo.append(session.id, { type: 'item.user', message: user, ts });
    this.events.emit('message', user);
    this.events.emit('session', session);
    this.events.emit('status', { state: 'sending' });

    logger.debug({ sessionId: session.id, userMessageId: user.id }, 'Sending message to DeepSeek');

    try {
      const { content } = await this.client.chat(toChatMessages(session.messages));
      const now = Date.now();
      const assistant: Message = {
        id: randomUUID(),
        role: 'assistant',
        content,
        ts: now,
      };

      session.messages = [...session.messages, assistant];
      session.turns = [
        ...session.turns,
        {
          id: randomUUID(),
          user,
          assistant,
          ts: now,
        },
      ];

      await this.repo.append(session.id, { type: 'item.assistant', message: assistant, ts: now });
      await this.repo.saveSnapshot(session);

      current.messages = session.messages;
      current.turns = session.turns;
      current.meta = session.meta;

      this.events.emit('message', assistant);
      this.events.emit('session', session);
      this.events.emit('status', { state: 'idle' });

      logger.debug({ sessionId: session.id, assistantMessageId: assistant.id }, 'Received response from DeepSeek');
      return session;
    } catch (error) {
      const err = error as Error;
      Object.assign(current, session);
      current.messages = session.messages;
      current.turns = session.turns;
      current.meta = session.meta;
      this.events.emit('status', { state: 'error', message: err.message });
      this.events.emit('error', { error: err });
      logger.error({ err, sessionId: session.id }, 'Failed to get response from DeepSeek');
      throw err;
    }
  }
}
