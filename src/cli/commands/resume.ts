import path from 'path';
import { Command } from 'commander';

import { DeepSeekClient } from '../../api/deepseekClient';
import { getApiConfig, getHistoryDir } from '../../config';
import { ChatController } from '../../controllers/chatController';
import { SessionFsRepository } from '../../core/repository/sessionFsRepository';
import { EventBus } from '../../core/services/eventBus';
import { startTui } from '../../tui';

export const resume = new Command('resume')
  .description('resume last or specific session')
  .option('--last', 'resume last session')
  .argument('[id]', 'session id')
  .action(async (id: string | undefined, options: { last?: boolean }) => {
    const { last } = options;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY is not set. Please configure it in your environment.');
      process.exitCode = 1;
      return;
    }

    const apiConfig = getApiConfig();
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

    const controller = new ChatController(
      new DeepSeekClient(apiKey, apiConfig.baseUrl, snapshot.model),
      repo,
      process.cwd(),
      snapshot.model,
      new EventBus(),
    );

    controller.eventBus.emit('session', snapshot);
    controller.eventBus.emit('status', { state: 'idle' });

    await startTui(controller, snapshot);
  });
