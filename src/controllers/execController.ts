import { randomUUID } from 'node:crypto';
import type { ValidateFunction } from 'ajv';

import { ProviderClient, ChatMessage, ChatResult } from '../providers/types';
import { SessionFsRepository } from '../core/repository/sessionFsRepository';
import { loadAgentsDoc } from '../core/services/agentsDocLoader';
import { EventPayload, EventSink } from '../core/services/eventBus';
import { Message } from '../core/models/message';
import { Session } from '../core/models/session';
import { HeadlessExecConfig } from '../config/profileLoader';

interface ExecControllerOptions {
  sessionId: string;
  config: HeadlessExecConfig;
  cwd: string;
  profile?: string;
  resumeSnapshot?: Session | null;
  agentsLoader?: typeof loadAgentsDoc;
}

export interface ExecRunOptions {
  prompt: string;
  stream?: boolean;
  schema?: unknown;
  validator?: ValidateFunction;
}

export interface ExecRunResult {
  text: string;
  usage?: ChatResult['usage'];
  validation?: {
    valid: boolean;
    errors?: unknown;
    reason?: 'parse_error' | 'schema_mismatch';
  };
}

interface ValidationResult {
  valid: boolean;
  parsed?: unknown;
  errorReason?: 'parse_error' | 'schema_mismatch';
  errors?: unknown;
}

function cloneMessage(message?: Message): Message | undefined {
  if (!message) {
    return undefined;
  }
  return { ...message };
}

function cloneSession(session: Session): Session {
  return {
    ...session,
    messages: session.messages.map(cloneMessage) as Message[],
    turns: session.turns.map((turn) => ({
      ...turn,
      user: cloneMessage(turn.user),
      assistant: cloneMessage(turn.assistant),
    })),
    meta: session.meta ? { ...session.meta } : undefined,
  };
}

function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function chunkText(text: string): string[] {
  if (!text) {
    return [];
  }
  const chunks: string[] = [];
  const tokens = text.split(/(\s+)/);
  let buffer = '';
  for (const token of tokens) {
    if (buffer.length + token.length > 80 && buffer) {
      chunks.push(buffer);
      buffer = '';
    }
    buffer += token;
  }
  if (buffer) {
    chunks.push(buffer);
  }
  return chunks.length ? chunks : [text];
}

export class ExecController {
  private session: Session | null = null;

  private readonly agentsLoader: typeof loadAgentsDoc;

  constructor(
    private readonly client: ProviderClient,
    private readonly repository: SessionFsRepository,
    private readonly sink: EventSink,
    private readonly options: ExecControllerOptions,
  ) {
    this.agentsLoader = options.agentsLoader ?? loadAgentsDoc;
  }

  async run(runOptions: ExecRunOptions): Promise<ExecRunResult> {
    const { prompt, stream, schema, validator } = runOptions;
    const session = await this.ensureSession();

    await this.emit('thread.started', {
      profile: this.options.profile,
      model: this.options.config.model,
    });
    await this.emit('sandbox.set', {
      mode: this.options.config.sandbox.mode,
      workspaceRoot: this.options.config.sandbox.workspaceRoot,
      allowDeepSeekOnly: this.options.config.sandbox.allowDeepSeekOnly,
    });
    await this.emit('approvals.set', {
      policy: this.options.config.approvals.policy,
    });
    await this.emit('turn.started', {
      prompt,
    });

    const working = cloneSession(session);
    const ts = Date.now();
    const userMessage: Message = { id: randomUUID(), role: 'user', content: prompt, ts };
    working.messages = [...working.messages, userMessage];

    await this.emit('item.user', { text: prompt });

    const messagesForModel: ChatMessage[] = toChatMessages(session.messages);
    if (schema) {
      messagesForModel.push({
        role: 'system',
        content: `Ответь JSON-структурой, соответствующей следующей JSON-схеме: ${JSON.stringify(schema)}`,
      });
    }
    messagesForModel.push({ role: 'user', content: prompt });

    const startedAt = Date.now();

    try {
      const result = await this.client.chat(messagesForModel, {
        model: this.options.config.model,
        jsonMode: Boolean(schema),
      });
      const assistantMessage = this.createAssistantMessage(result.content);

      if (stream) {
        for (const piece of chunkText(result.content)) {
          await this.emit('item.delta', { text: piece });
        }
      }

      await this.emit('item.completed', { text: result.content });

      working.messages = [...working.messages, assistantMessage];
      working.turns = [
        ...working.turns,
        {
          id: randomUUID(),
          user: userMessage,
          assistant: assistantMessage,
          ts: assistantMessage.ts,
        },
      ];
      working.meta = {
        ...(working.meta ?? {}),
        cwd: this.options.cwd,
        profile: this.options.profile,
        lastCompletedAt: assistantMessage.ts,
      };

      Object.assign(session, working);
      session.messages = working.messages;
      session.turns = working.turns;
      session.meta = working.meta;

      await this.repository.saveSnapshot(session);

      const durationMs = Date.now() - startedAt;
      await this.emit('turn.completed', {
        usage: result.usage ?? undefined,
        durationMs,
      });

      const validation = this.validateOutput(result.content, schema, validator);
      if (!validation.valid) {
        await this.emit('validation.failed', {
          reason: validation.errorReason,
          errors: validation.errors,
        });
      }

      await this.emit('thread.completed', {});

      return {
        text: result.content,
        usage: result.usage,
        validation: validation.valid
          ? { valid: true }
          : { valid: false, errors: validation.errors, reason: validation.errorReason },
      };
    } catch (error) {
      const err = error as Error;
      await this.emit('turn.completed', {
        error: { message: err.message },
      });
      await this.emit('thread.completed', {
        error: { message: err.message },
      });
      throw err;
    }
  }

  private async ensureSession(): Promise<Session> {
    if (this.session) {
      return this.session;
    }

    if (this.options.resumeSnapshot) {
      this.session = cloneSession(this.options.resumeSnapshot);
      return this.session;
    }

    const now = Date.now();
    const systemPrompt = await this.agentsLoader(this.options.cwd);
    const session: Session = {
      id: this.options.sessionId,
      model: this.options.config.model,
      createdAt: now,
      messages: [],
      turns: [],
      meta: {
        cwd: this.options.cwd,
        profile: this.options.profile,
      },
    };

    if (systemPrompt.trim()) {
      session.messages.push({
        id: randomUUID(),
        role: 'system',
        content: systemPrompt,
        ts: now,
      });
    }

    await this.repository.saveSnapshot(session);
    this.session = session;
    return this.session;
  }

  private createAssistantMessage(content: string): Message {
    return {
      id: randomUUID(),
      role: 'assistant',
      content,
      ts: Date.now(),
    };
  }

  private validateOutput(
    text: string,
    schema: unknown,
    validator?: ValidateFunction,
  ): ValidationResult {
    if (!schema || !validator) {
      return { valid: true };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return {
        valid: false,
        errorReason: 'parse_error',
        errors: { message: (error as Error).message },
      };
    }

    const valid = validator(parsed);
    return {
      valid,
      parsed,
      errorReason: valid ? undefined : 'schema_mismatch',
      errors: valid ? undefined : validator.errors ?? null,
    };
  }

  private async emit(type: EventPayload['type'], data?: Record<string, unknown>): Promise<void> {
    const payload: EventPayload = {
      ts: new Date().toISOString(),
      type,
      session: { id: this.options.sessionId },
      data,
    };
    await this.sink.write(payload);
  }
}
