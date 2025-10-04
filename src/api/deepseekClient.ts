import { Configuration, OpenAIApi } from 'openai';

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

export class DeepSeekClient {
  private readonly api: OpenAIApi;

  constructor(apiKey: string, baseURL = 'https://api.deepseek.com', private readonly model = 'deepseek-chat') {
    this.api = new OpenAIApi(new Configuration({ apiKey, basePath: baseURL }));
  }

  async chat(messages: ChatMessage[], jsonMode = false): Promise<ChatResult> {
    const res = await this.api.createChatCompletion({
      model: this.model,
      messages,
      ...(jsonMode && { response_format: { type: 'json_object' } }),
    });
    const msg = res.data.choices[0].message;
    return {
      content: msg?.content ?? '',
      usage: res.data.usage ?? undefined,
    };
  }
}
