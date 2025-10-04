import fs from 'fs';
import path from 'path';

import { ApprovalPolicy } from '../core/approvals/approvalsPolicy';
import { SandboxConfig } from '../core/sandbox/types';

export interface HeadlessExecConfig {
  provider: string;
  model: string;
  historyDir: string;
  sandbox: SandboxConfig;
  approvals: { policy: ApprovalPolicy };
  exec: { timeoutMs: number; envWhitelist: string[] };
}

export type PartialHeadlessConfig = Partial<HeadlessExecConfig> & {
  sandbox?: Partial<SandboxConfig>;
  approvals?: Partial<HeadlessExecConfig['approvals']>;
  exec?: Partial<HeadlessExecConfig['exec']>;
};

const CONFIG_ROOT = path.resolve(__dirname, '../../config');
const DEFAULT_PATH = path.join(CONFIG_ROOT, 'default.json');

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as unknown;
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  if (source === null || source === undefined) {
    return target;
  }
  const output: Record<string, unknown> = Array.isArray(target) ? [...(target as unknown[])] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const current = (output as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      (output as Record<string, unknown>)[key] = [...value];
    } else if (
      value &&
      typeof value === 'object' &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      (output as Record<string, unknown>)[key] = deepMerge(current, value as Record<string, unknown>);
    } else {
      (output as Record<string, unknown>)[key] = value;
    }
  }
  return output as T;
}

export function loadDefaultHeadlessConfig(): HeadlessExecConfig {
  const data = readJsonFile(DEFAULT_PATH);
  return data as HeadlessExecConfig;
}

export function loadProfileConfig(profile: string): PartialHeadlessConfig {
  const profilePath = path.join(CONFIG_ROOT, 'profiles', `${profile}.json`);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile "${profile}" not found at ${profilePath}`);
  }
  return readJsonFile(profilePath) as PartialHeadlessConfig;
}

export function mergeHeadlessConfig(
  base: HeadlessExecConfig,
  override: PartialHeadlessConfig | undefined,
): HeadlessExecConfig {
  if (!override) {
    return base;
  }
  return deepMerge(base, override as PartialHeadlessConfig);
}

export function resolveHeadlessConfig(
  profile?: string,
  overrides?: PartialHeadlessConfig,
): HeadlessExecConfig {
  const base = loadDefaultHeadlessConfig();
  const withProfile = profile ? mergeHeadlessConfig(base, loadProfileConfig(profile)) : base;
  return mergeHeadlessConfig(withProfile, overrides);
}
