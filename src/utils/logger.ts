import pino from 'pino';

import { getLoggingConfig } from '../config';

const loggingConfig = getLoggingConfig();

export const logger = pino({
  level: loggingConfig.level,
  name: 'deepseek-cli',
});

export type Logger = typeof logger;
