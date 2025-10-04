import fs from 'fs';
import path from 'path';

export interface LlmProvider {
  id: string;
  baseUrl: string;
  envKey: string;
  wireApi: 'chat' | 'responses';
  defaultModel: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

interface ProviderConfigFile {
  providers: Record<string, Omit<LlmProvider, 'id'>>;
}

let cachedProviders: Map<string, LlmProvider> | null = null;

function readProvidersConfig(): ProviderConfigFile {
  const filePath = path.resolve(__dirname, '../../config/providers.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as ProviderConfigFile;
}

function loadProviders(): Map<string, LlmProvider> {
  if (cachedProviders) {
    return cachedProviders;
  }
  const config = readProvidersConfig();
  const providers = new Map<string, LlmProvider>();
  for (const [id, value] of Object.entries(config.providers ?? {})) {
    providers.set(id, { id, ...value });
  }
  cachedProviders = providers;
  return providers;
}

export function listProviders(): LlmProvider[] {
  return Array.from(loadProviders().values());
}

export function getProvider(id: string): LlmProvider | undefined {
  return loadProviders().get(id);
}

export function getDefaultProvider(): LlmProvider {
  const providers = listProviders();
  if (providers.length === 0) {
    throw new Error('No providers configured. Please add at least one provider to config/providers.json.');
  }
  return providers[0];
}

export function resetProviderRegistry(): void {
  cachedProviders = null;
}
