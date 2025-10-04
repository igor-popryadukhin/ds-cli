#!/usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';

import { approvals } from './commands/approvals';
import { chat } from './commands/chat';
import { execCommand } from './commands/exec';
import { patchApply } from './commands/patchApply';
import { resume } from './commands/resume';
import { sandbox } from './commands/sandbox';
import { logger } from '../utils/logger';

dotenv.config();

const program = new Command();

program.name('deepseek').description('DeepSeek command line interface').version('0.1.0');
program.addCommand(chat);
program.addCommand(resume);
program.addCommand(sandbox);
program.addCommand(approvals);
program.addCommand(patchApply);
program.addCommand(execCommand);

program.parseAsync(process.argv).catch((error: unknown) => {
  const err = error as Error;
  logger.error({ err }, 'Failed to execute DeepSeek CLI command');
  console.error('Failed to execute DeepSeek CLI command:', err.message);
  process.exit(1);
});
