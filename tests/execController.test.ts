import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import Ajv from 'ajv';

import { ExecController } from '../src/controllers/execController';
import type { HeadlessExecConfig } from '../src/config/profileLoader';
import { SessionFsRepository } from '../src/core/repository/sessionFsRepository';
import type { EventPayload, EventSink } from '../src/core/services/eventBus';
import type { DeepSeekClient } from '../src/api/deepseekClient';

class MemorySink implements EventSink {
  public readonly events: EventPayload[] = [];

  async write(event: EventPayload): Promise<void> {
    this.events.push(event);
  }
}

function createConfig(): HeadlessExecConfig {
  return {
    model: 'deepseek-chat',
    historyDir: 'history',
    sandbox: {
      mode: 'read-only',
      workspaceRoot: '.',
      allowDeepSeekOnly: true,
    },
    approvals: {
      policy: 'untrusted',
    },
    exec: {
      timeoutMs: 120000,
      envWhitelist: ['PATH'],
    },
  };
}

describe('ExecController', () => {
  let dir: string;
  let repo: SessionFsRepository;
  let sink: MemorySink;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'exec-controller-'));
    repo = new SessionFsRepository(dir);
    sink = new MemorySink();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('runs a headless turn with streaming and persists session', async () => {
    const client = {
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify({ ok: true }),
        usage: { completion_tokens: 10 },
      }),
    } as unknown as DeepSeekClient;

    const controller = new ExecController(client, repo, sink, {
      sessionId: 'session-test',
      config: createConfig(),
      cwd: dir,
    });

    const ajv = new Ajv();
    const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };
    const validator = ajv.compile(schema);

    const result = await controller.run({
      prompt: 'check',
      stream: true,
      schema,
      validator,
    });

    expect(result.text).toBe(JSON.stringify({ ok: true }));
    expect(result.validation?.valid).toBe(true);
    expect(client.chat).toHaveBeenCalled();

    const snapshot = await repo.readSnapshot('session-test');
    expect(snapshot?.messages).toHaveLength(2);
    expect(snapshot?.turns).toHaveLength(1);

    const types = sink.events.map((event) => event.type);
    expect(types).toContain('item.delta');
    expect(types).toContain('item.completed');
    expect(types).not.toContain('validation.failed');
  });

  it('emits validation failure when response does not match schema', async () => {
    const client = {
      chat: jest.fn().mockResolvedValue({
        content: 'not-json',
      }),
    } as unknown as DeepSeekClient;

    const controller = new ExecController(client, repo, sink, {
      sessionId: 'session-invalid',
      config: createConfig(),
      cwd: dir,
    });

    const ajv = new Ajv();
    const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };
    const validator = ajv.compile(schema);

    const result = await controller.run({
      prompt: 'check',
      schema,
      validator,
    });

    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.reason).toBe('parse_error');
    expect(sink.events.map((event) => event.type)).toContain('validation.failed');
  });
});
