import path from 'path';
import { Command } from 'commander';

import { DeepSeekClient } from '../../api/deepseekClient';
import { getApiConfig, getHistoryDir } from '../../config';
import { ChatController } from '../../controllers/chatController';
import { SessionFsRepository } from '../../core/repository/sessionFsRepository';
import { EventBus } from '../../core/services/eventBus';
import { startTui } from '../../tui';

export const chat = new Command('chat')
  .description('start interactive terminal chat')
  .option('-m, --model <name>', 'model name to use')
  .action(async (options: { model?: string }) => {
    const { model } = options;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY is not set. Please configure it in your environment.');
      process.exitCode = 1;
      return;
    }

    const apiConfig = getApiConfig();
    const historyDir = path.resolve(process.cwd(), getHistoryDir());
    const selectedModel = model ?? apiConfig.model;

    const controller = new ChatController(
      new DeepSeekClient(apiKey, apiConfig.baseUrl, selectedModel),
      new SessionFsRepository(historyDir),
      process.cwd(),
      selectedModel,
      new EventBus(),
    );

    const session = await controller.startSession();
    await startTui(controller, session);
  });
