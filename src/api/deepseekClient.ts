import axios, { AxiosInstance } from 'axios';

import { getApiConfig } from '../config';

export type DeepSeekRole = 'system' | 'user' | 'assistant';

export interface DeepSeekMessage {
  role: DeepSeekRole;
  content: string;
}

export interface DeepSeekResponse {
  content: string;
  tokensUsed: number;
}

interface DeepSeekApiChoice {
  message: {
    content: string;
  };
}

interface DeepSeekApiUsage {
  total_tokens: number;
}

interface DeepSeekApiResponse {
  choices: DeepSeekApiChoice[];
  usage?: DeepSeekApiUsage;
}

export class DeepSeekClient {
  private readonly httpClient: AxiosInstance;

  private readonly modelName: string;

  constructor(
    private readonly apiKey: string,
    model?: string,
  ) {
    const apiConfig = getApiConfig();
    this.modelName = model ?? apiConfig.model;

    this.httpClient = axios.create({
      baseURL: apiConfig.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async send(messages: DeepSeekMessage[]): Promise<DeepSeekResponse> {
    const response = await this.httpClient.post<DeepSeekApiResponse>('/chat/completions', {
      model: this.modelName,
      messages,
      response_format: { type: 'json_object' },
    });

    const data = response.data;

    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Invalid response from DeepSeek API');
    }

    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? 0,
    };
  }
}
