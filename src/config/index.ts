import fs from 'fs';
import path from 'path';

import defaultConfig from './default.json';
import { SandboxConfig, SandboxMode } from '../core/sandbox/types';
import { ApprovalPolicy } from '../core/approvals/approvalsPolicy';

export interface LoggingConfig {
  level: string;
}

export interface ApiConfig {
  baseUrl: string;
  model: string;
}

export interface ApprovalsConfig {
  policy: ApprovalPolicy;
}

export interface ExecConfig {
  timeoutMs: number;
  envWhitelist: string[];
}

export interface AppConfig {
  api: ApiConfig;
  logging: LoggingConfig;
  historyDir: string;
  sandbox: SandboxConfig;
  approvals: ApprovalsConfig;
  exec: ExecConfig;
}

const CONFIG_PATH = path.resolve(process.cwd(), '.deepseek', 'config.json');

let cachedConfig: AppConfig | null = null;

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = Array.isArray(target) ? [...(target as unknown[])] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const current = (result as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = [...value];
    } else if (value && typeof value === 'object' && current && typeof current === 'object' && !Array.isArray(current)) {
      (result as Record<string, unknown>)[key] = deepMerge(current, value as Record<string, unknown>);
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result as T;
}

function readUserConfig(): Partial<AppConfig> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as Partial<AppConfig>;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function applyEnvOverrides(config: AppConfig): AppConfig {
  const result = { ...config };
  const sandboxMode = process.env.DEEPSEEK_SANDBOX_MODE as SandboxMode | undefined;
  if (sandboxMode) {
    result.sandbox = { ...result.sandbox, mode: sandboxMode };
  }
  const approvalsPolicy = process.env.DEEPSEEK_APPROVALS_POLICY as ApprovalPolicy | undefined;
  if (approvalsPolicy) {
    result.approvals = { ...result.approvals, policy: approvalsPolicy };
  }
  const execTimeout = process.env.DEEPSEEK_EXEC_TIMEOUT_MS;
  if (execTimeout) {
    const parsed = Number.parseInt(execTimeout, 10);
    if (!Number.isNaN(parsed)) {
      result.exec = { ...result.exec, timeoutMs: parsed };
    }
  }
  const envWhitelist = process.env.DEEPSEEK_EXEC_ENV_WHITELIST;
  if (envWhitelist) {
    result.exec = { ...result.exec, envWhitelist: envWhitelist.split(',').map((item) => item.trim()).filter(Boolean) };
  }
  const workspaceRoot = process.env.DEEPSEEK_WORKSPACE_ROOT;
  if (workspaceRoot) {
    result.sandbox = { ...result.sandbox, workspaceRoot };
  }
  return result;
}

function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  const merged = deepMerge(defaultConfig as AppConfig, readUserConfig());
  cachedConfig = applyEnvOverrides(merged);
  return cachedConfig;
}

function ensureConfigDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function updateConfig(partial: Partial<AppConfig>) {
  const current = deepMerge(defaultConfig as AppConfig, readUserConfig());
  const updated = deepMerge(current, partial);
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  cachedConfig = applyEnvOverrides(updated as AppConfig);
}

export const getConfig = (): AppConfig => loadConfig();

export const getApiConfig = (): ApiConfig => loadConfig().api;

export const getLoggingConfig = (): LoggingConfig => loadConfig().logging;

export const getHistoryDir = (): string => loadConfig().historyDir;

export const getSandboxConfig = (): SandboxConfig => loadConfig().sandbox;

export const getApprovalsConfig = (): ApprovalsConfig => loadConfig().approvals;

export const getExecConfig = (): ExecConfig => loadConfig().exec;

export const getConfigPath = (): string => CONFIG_PATH;
