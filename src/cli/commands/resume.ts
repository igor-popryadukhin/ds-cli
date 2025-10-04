import path from 'path';
import { Command } from 'commander';

import { getHistoryDir, getProviderId } from '../../config';
import { ChatController } from '../../controllers/chatController';
import { SessionFsRepository } from '../../core/repository/sessionFsRepository';
import { EventBus } from '../../core/services/eventBus';
import { createProviderClient } from '../../providers/clientFactory';
import { getProvider } from '../../providers/registry';
import { MissingApiKeyError } from '../../providers/types';
import { startTui } from '../../tui';

export const resume = new Command('resume')
  .description('resume last or specific session')
  .option('--last', 'resume last session')
  .argument('[id]', 'session id')
  .action(async (id: string | undefined, options: { last?: boolean }) => {
    const { last } = options;
    const providerId = getProviderId();
    const provider = getProvider(providerId);
    if (!provider) {
      console.error(`Provider "${providerId}" is not configured. Please update config/providers.json.`);
      process.exitCode = 1;
      return;
    }

    const historyDir = path.resolve(process.cwd(), getHistoryDir());
    const repo = new SessionFsRepository(historyDir);

    const targetId = last ? await repo.lastSessionId() : id;
    if (!targetId) {
      console.error('No session to resume');
      process.exitCode = 1;
      return;
    }

    const snapshot = await repo.readSnapshot(targetId);
    if (!snapshot) {
      console.error(`Snapshot for session ${targetId} not found`);
      process.exitCode = 1;
      return;
    }

    let client;
    try {
      client = createProviderClient(provider);
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        console.error(`Missing API key: set ${error.envKey} for provider ${error.providerId}.`);
        process.exitCode = 11;
        return;
      }
      throw error;
    }

    const controller = new ChatController(
      client,
      repo,
      process.cwd(),
      snapshot.model ?? provider.defaultModel,
      new EventBus(),
    );

    controller.eventBus.emit('session', snapshot);
    controller.eventBus.emit('status', { state: 'idle' });

    await startTui(controller, snapshot);
  });
