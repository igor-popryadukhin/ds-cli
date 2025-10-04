import path from 'path';
import { Command } from 'commander';

import { getHistoryDir, getModelId, getProviderId } from '../../config';
import { ChatController } from '../../controllers/chatController';
import { SessionFsRepository } from '../../core/repository/sessionFsRepository';
import { EventBus } from '../../core/services/eventBus';
import { createProviderClient } from '../../providers/clientFactory';
import { getProvider } from '../../providers/registry';
import { MissingApiKeyError } from '../../providers/types';
import { startTui } from '../../tui';

export const chat = new Command('chat')
  .description('start interactive terminal chat')
  .option('-m, --model <name>', 'model name to use')
  .action(async (options: { model?: string }) => {
    const { model } = options;
    const providerId = getProviderId();
    const provider = getProvider(providerId);
    if (!provider) {
      console.error(`Provider "${providerId}" is not configured. Please update config/providers.json.`);
      process.exitCode = 1;
      return;
    }

    const historyDir = path.resolve(process.cwd(), getHistoryDir());
    const selectedModel = model ?? getModelId() ?? provider.defaultModel;

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

    const controller = new ChatController(client, new SessionFsRepository(historyDir), process.cwd(), selectedModel, new EventBus());

    const session = await controller.startSession();
    await startTui(controller, session);
  });
