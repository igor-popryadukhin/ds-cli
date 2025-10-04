import { Configuration, OpenAIApi } from 'openai';

import { ChatMessage, ProviderClient, ProviderChatOptions, MissingApiKeyError } from './types';
import { LlmProvider } from './registry';

class OpenAiCompatibleClient implements ProviderClient {
  private readonly api: OpenAIApi;

  constructor(
    private readonly provider: LlmProvider,
    private readonly apiKey: string,
  ) {
    const configuration = new Configuration({ apiKey, basePath: provider.baseUrl });
    this.api = new OpenAIApi(configuration);
  }

  async chat(messages: ChatMessage[], options?: ProviderChatOptions) {
    const model = options?.model ?? this.provider.defaultModel;
    const response = await this.api.createChatCompletion({
      model,
      messages,
      ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    const msg = response.data.choices[0].message;
    return {
      content: msg?.content ?? '',
      usage: response.data.usage ?? undefined,
    };
  }
}

export function createProviderClient(provider: LlmProvider): ProviderClient {
  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new MissingApiKeyError(provider.id, provider.envKey);
  }

  switch (provider.wireApi) {
    case 'chat':
      return new OpenAiCompatibleClient(provider, apiKey);
    case 'responses':
      throw new Error(`Provider wireApi \"responses\" is not implemented for provider ${provider.id}`);
    default:
      throw new Error(`Unsupported wireApi for provider ${provider.id}`);
  }
}
