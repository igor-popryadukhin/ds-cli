import pino from 'pino';

import { getLoggingConfig } from '../config';

const loggingConfig = getLoggingConfig();

export const logger = pino({
  level: loggingConfig.level,
  name: 'deepseek-cli',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

export type Logger = typeof logger;
