import defaultConfig from './default.json';

export interface LoggingConfig {
  level: string;
}

export interface ApiConfig {
  baseUrl: string;
  model: string;
}

export interface AppConfig {
  api: ApiConfig;
  logging: LoggingConfig;
}

const appConfig: AppConfig = defaultConfig as AppConfig;

export const getConfig = (): AppConfig => appConfig;

export const getApiConfig = (): ApiConfig => appConfig.api;

export const getLoggingConfig = (): LoggingConfig => appConfig.logging;
