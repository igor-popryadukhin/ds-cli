export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface ChatResult {
  content: string;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  };
}

export interface ProviderChatOptions {
  model?: string;
  jsonMode?: boolean;
}

export interface ProviderClient {
  chat(messages: ChatMessage[], options?: ProviderChatOptions): Promise<ChatResult>;
}

export class MissingApiKeyError extends Error {
  constructor(public readonly providerId: string, public readonly envKey: string) {
    super(`Provider \"${providerId}\" requires environment variable ${envKey}`);
    this.name = 'MissingApiKeyError';
  }
}
