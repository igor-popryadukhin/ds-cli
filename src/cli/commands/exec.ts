import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'node:crypto';

import Ajv, { type ValidateFunction } from 'ajv';
import { Command } from 'commander';

import { ExecController } from '../../controllers/execController';
import {
  EventSink,
  FileEventSink,
  JsonlStdoutSink,
  MultiEventSink,
} from '../../core/services/eventBus';
import { SessionFsRepository } from '../../core/repository/sessionFsRepository';
import type { Session } from '../../core/models/session';
import {
  HeadlessExecConfig,
  PartialHeadlessConfig,
  resolveHeadlessConfig,
} from '../../config/profileLoader';
import { createProviderClient } from '../../providers/clientFactory';
import { getProvider } from '../../providers/registry';
import { MissingApiKeyError } from '../../providers/types';

const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const;
const APPROVAL_POLICIES = ['untrusted', 'on-failure', 'on-request', 'never'] as const;

type SandboxMode = (typeof SANDBOX_MODES)[number];
type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];

interface ExecOptions {
  model?: string;
  profile?: string;
  json?: boolean;
  jsonFile?: string;
  stream?: boolean;
  session?: string;
  resume?: boolean;
  last?: boolean;
  sandbox?: SandboxMode;
  approval?: ApprovalPolicy;
  timeout?: string;
  cwd?: string;
  outputSchema?: string;
  yes?: boolean;
}

class HistoryEventSink implements EventSink {
  constructor(private readonly repository: SessionFsRepository, private readonly sessionId: string) {}

  async write(event: Parameters<EventSink['write']>[0]): Promise<void> {
    await this.repository.append(this.sessionId, event);
  }
}

async function readPrompt(promptArg?: string): Promise<string> {
  if (promptArg && promptArg !== '-') {
    return promptArg;
  }

  const chunks: string[] = [];
  return await new Promise<string>((resolve, reject) => {
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      chunks.push(chunk as string);
    });
    process.stdin.on('end', () => {
      resolve(chunks.join(''));
    });
    process.stdin.on('error', (error) => reject(error));
  });
}

function buildOverrides(options: ExecOptions): PartialHeadlessConfig {
  const overrides: PartialHeadlessConfig = {};

  if (options.model) {
    overrides.model = options.model;
  }

  if (options.timeout) {
    const timeout = Number.parseInt(options.timeout, 10);
    if (Number.isNaN(timeout) || timeout <= 0) {
      throw new Error('Invalid timeout value');
    }
    overrides.exec = { ...(overrides.exec ?? {}), timeoutMs: timeout };
  }

  if (options.sandbox) {
    if (!SANDBOX_MODES.includes(options.sandbox)) {
      throw new Error(`Unsupported sandbox mode: ${options.sandbox}`);
    }
    overrides.sandbox = { ...(overrides.sandbox ?? {}), mode: options.sandbox };
  }

  if (options.approval) {
    if (!APPROVAL_POLICIES.includes(options.approval)) {
      throw new Error(`Unsupported approval policy: ${options.approval}`);
    }
    overrides.approvals = { ...(overrides.approvals ?? {}), policy: options.approval };
  } else if (options.yes) {
    overrides.approvals = { ...(overrides.approvals ?? {}), policy: 'never' };
  }

  return overrides;
}

async function prepareValidator(
  schemaPath: string,
  cwd: string,
): Promise<{ schema: unknown; validator: ValidateFunction }> {
  const absolutePath = path.resolve(cwd, schemaPath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  const schema = JSON.parse(content) as unknown;
  const ajv = new Ajv({ allErrors: true });
  const validator = ajv.compile(schema);
  return { schema, validator };
}

async function resolveSession(
  repo: SessionFsRepository,
  options: ExecOptions,
): Promise<{ sessionId: string; snapshot: Session | null }> {
  if (options.session) {
    const snapshot = await repo.readSnapshot(options.session);
    if (!snapshot) {
      throw new Error(`Session ${options.session} not found`);
    }
    return { sessionId: options.session, snapshot };
  }

  if (options.resume) {
    if (!options.last) {
      throw new Error('Use --resume --last or provide --session <id>');
    }
    const lastId = await repo.lastSessionId();
    if (!lastId) {
      throw new Error('No previous sessions found');
    }
    const snapshot = await repo.readSnapshot(lastId);
    if (!snapshot) {
      throw new Error(`Session ${lastId} snapshot missing`);
    }
    return { sessionId: lastId, snapshot };
  }

  return { sessionId: randomUUID(), snapshot: null };
}

function applyWorkspacePaths(
  config: HeadlessExecConfig,
  cwd: string,
): { config: HeadlessExecConfig; historyDir: string } {
  const resolved: HeadlessExecConfig = {
    ...config,
    sandbox: { ...config.sandbox },
    approvals: { ...config.approvals },
    exec: { ...config.exec },
  };
  resolved.sandbox.workspaceRoot = path.resolve(cwd, resolved.sandbox.workspaceRoot);
  const historyDir = path.resolve(resolved.sandbox.workspaceRoot, resolved.historyDir);
  return { config: resolved, historyDir };
}

function createEventSink(
  repo: SessionFsRepository,
  sessionId: string,
  options: ExecOptions,
): EventSink {
  const sinks: EventSink[] = [];
  if (options.json) {
    sinks.push(new JsonlStdoutSink());
  }
  if (options.jsonFile) {
    sinks.push(new FileEventSink(path.resolve(process.cwd(), options.jsonFile)));
  }
  const historySink = new HistoryEventSink(repo, sessionId);
  sinks.push(historySink);

  if (sinks.length === 1) {
    return historySink;
  }

  return new MultiEventSink(sinks);
}

export const execCommand = new Command('exec')
  .description('Run DeepSeek in headless exec mode')
  .argument('[prompt]', 'task prompt; use "-" to read from stdin')
  .option('--model <name>', 'model name override')
  .option('--profile <name>', 'configuration profile to use')
  .option('--json', 'emit JSONL events to stdout')
  .option('--json-file <path>', 'also write JSONL events to file')
  .option('--stream', 'stream assistant tokens as item.delta events')
  .option('--session <id>', 'resume the specified session id')
  .option('--resume', 'resume a previous session')
  .option('--last', 'use with --resume to continue the latest session')
  .option('--sandbox <mode>', `override sandbox mode (${SANDBOX_MODES.join(', ')})`)
  .option('--approval <policy>', `override approval policy (${APPROVAL_POLICIES.join(', ')})`)
  .option('--timeout <ms>', 'request timeout in milliseconds')
  .option('--cwd <path>', 'working directory for the session context')
  .option('--output-schema <path>', 'validate the assistant response against JSON schema')
  .option('--yes', 'auto-approve privileged operations')
  .action(async (promptArg: string | undefined, options: ExecOptions) => {
    let sink: EventSink | undefined;
    try {
      const prompt = await readPrompt(promptArg);
      const overrides = buildOverrides(options);
      const baseConfig = resolveHeadlessConfig(options.profile, overrides);
      const cwd = options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
      const { config, historyDir } = applyWorkspacePaths(baseConfig, cwd);
      const repo = new SessionFsRepository(historyDir);
      const { sessionId, snapshot } = await resolveSession(repo, options);
      sink = createEventSink(repo, sessionId, options);

      const provider = getProvider(config.provider);
      if (!provider) {
        throw new Error(`Provider "${config.provider}" is not configured. Update config/providers.json.`);
      }

      let client;
      try {
        client = createProviderClient(provider);
      } catch (error) {
        if (error instanceof MissingApiKeyError) {
          console.error(`Missing API key: set ${error.envKey} for provider ${error.providerId}.`);
          process.exitCode = 11;
          return;
        }
        throw error;
      }
      const controller = new ExecController(client, repo, sink, {
        sessionId,
        config,
        cwd,
        profile: options.profile,
        resumeSnapshot: snapshot,
      });

      let validator: ValidateFunction | undefined;
      let schema: unknown;
      if (options.outputSchema) {
        const prepared = await prepareValidator(options.outputSchema, cwd);
        validator = prepared.validator;
        schema = prepared.schema;
      }

      const result = await controller.run({
        prompt,
        stream: Boolean(options.stream),
        schema,
        validator,
      });

      if (!options.json) {
        if (result.text.length) {
          process.stdout.write(result.text);
          if (!result.text.endsWith('\n')) {
            process.stdout.write('\n');
          }
        }
      }

      if (result.validation && !result.validation.valid) {
        process.exitCode = 2;
      }

    } catch (error) {
      const err = error as Error;
      console.error(err.message);
      process.exitCode = process.exitCode ?? 1;
    } finally {
      if (sink && typeof sink.close === 'function') {
        await sink.close();
      }
    }
  });
