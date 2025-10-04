import { ChatController } from '../src/controllers/chatController';
import { DeepSeekClient } from '../src/api/deepseekClient';
import { SessionFsRepository } from '../src/core/repository/sessionFsRepository';
import { EventBus, StatusEvent } from '../src/core/services/eventBus';

jest.mock('../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ChatController', () => {
  let client: { chat: jest.Mock };
  let repo: {
    append: jest.Mock;
    saveSnapshot: jest.Mock;
    readSnapshot: jest.Mock;
    lastSessionId: jest.Mock;
  };
  let eventBus: EventBus;
  let loader: jest.Mock;

  beforeEach(() => {
    client = {
      chat: jest.fn(),
    };
    repo = {
      append: jest.fn().mockResolvedValue(undefined),
      saveSnapshot: jest.fn().mockResolvedValue(undefined),
      readSnapshot: jest.fn(),
      lastSessionId: jest.fn(),
    };
    eventBus = new EventBus();
    loader = jest.fn().mockResolvedValue('System instructions');
  });

  it('starts a session with system prompt from agents loader', async () => {
    const controller = new ChatController(
      client as unknown as DeepSeekClient,
      repo as unknown as SessionFsRepository,
      '/tmp/project',
      'deepseek-chat',
      eventBus,
      loader,
    );

    const session = await controller.startSession();

    expect(loader).toHaveBeenCalledWith('/tmp/project');
    expect(repo.saveSnapshot).toHaveBeenCalledWith(session);
    expect(repo.append).toHaveBeenCalledWith(session.id, expect.objectContaining({ type: 'session.started' }));
    expect(session.messages[0]).toMatchObject({ role: 'system', content: 'System instructions' });
  });

  it('sends user messages, stores assistant responses and emits status events', async () => {
    client.chat.mockResolvedValue({ content: 'Hello from DeepSeek' });

    const controller = new ChatController(
      client as unknown as DeepSeekClient,
      repo as unknown as SessionFsRepository,
      '/tmp/project',
      'deepseek-chat',
      eventBus,
      loader,
    );

    const session = await controller.startSession();
    repo.append.mockClear();
    repo.saveSnapshot.mockClear();

    const statuses: StatusEvent['state'][] = [];
    eventBus.on('status', (event) => {
      statuses.push(event.state);
    });

    const updated = await controller.send(session, 'Hi there');

    expect(client.chat).toHaveBeenCalledTimes(1);
    expect(client.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Hi there' }),
      ]),
    );

    expect(repo.append).toHaveBeenNthCalledWith(1, session.id, expect.objectContaining({ type: 'item.user' }));
    expect(repo.append).toHaveBeenNthCalledWith(2, session.id, expect.objectContaining({ type: 'item.assistant' }));
    expect(repo.saveSnapshot).toHaveBeenCalledWith(updated);

    expect(updated.messages.filter((m) => m.role === 'assistant')).toHaveLength(1);
    expect(updated.turns).toHaveLength(1);
    expect(statuses).toContain('sending');
    expect(statuses).toContain('idle');
  });
});
