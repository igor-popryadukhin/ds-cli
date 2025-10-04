#!/usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';

import { DeepSeekClient } from '../api/deepseekClient';
import { logger } from '../utils/logger';

dotenv.config();

const program = new Command();

program.name('deepseek').description('DeepSeek command line interface').version('0.1.0');

program
  .command('hello')
  .description('Verify DeepSeek CLI initialization')
  .action(() => {
    logger.info('DeepSeek CLI initialized successfully');
    console.log('DeepSeek CLI initialized successfully');
  });

program
  .command('test-api')
  .description('Send a test message to DeepSeek API')
  .action(async () => {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      logger.error('DEEPSEEK_API_KEY is not set');
      console.error('DEEPSEEK_API_KEY is not set. Please configure it in your environment.');
      process.exitCode = 1;
      return;
    }

    try {
      const client = new DeepSeekClient(apiKey);
      const response = await client.send([
        {
          role: 'user',
          content: 'ping',
        },
      ]);
      logger.info({ response }, 'Received response from DeepSeek API');
      console.log('DeepSeek API response:', response.content);
      console.log('Tokens used:', response.tokensUsed);
    } catch (error) {
      logger.error({ err: error }, 'Failed to communicate with DeepSeek API');
      console.error('Failed to communicate with DeepSeek API:', (error as Error).message);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  logger.error({ err: error }, 'Failed to execute DeepSeek CLI command');
  console.error('Failed to execute DeepSeek CLI command:', (error as Error).message);
  process.exit(1);
});
