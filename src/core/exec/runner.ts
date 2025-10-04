import { spawn } from 'node:child_process';
import path from 'path';

import { Approvals } from '../approvals/approvalsPolicy';
import { promptApproval } from '../approvals/prompts';
import { SandboxPolicy } from '../sandbox/sandboxPolicy';
import { filterEnv } from './envPolicy';

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  envWhitelist?: string[];
  autoApprove?: boolean;
  sandbox: SandboxPolicy;
  approvals: Approvals;
  historyLogger?: (event: Record<string, unknown>) => Promise<void>;
}

export interface ExecResult {
  ran: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

function resolveCwd(options: ExecOptions): string {
  const cwd = options.cwd ?? options.sandbox.paths.workspaceRoot;
  return path.resolve(cwd);
}

export async function runSafe(cmd: string, opts: ExecOptions): Promise<ExecResult> {
  const cwd = resolveCwd(opts);
  const preview = {
    command: cmd,
    cwd,
    timeoutMs: opts.timeoutMs,
    envWhitelist: opts.envWhitelist,
  };

  if (opts.historyLogger) {
    await opts.historyLogger({ type: 'exec.preview', preview });
  }

  const requiresApproval = opts.approvals.needsApproval('exec');
  const requiresOverride = opts.sandbox.mode === 'read-only';

  let approved = Boolean(opts.autoApprove);
  if ((requiresApproval || requiresOverride) && !approved) {
    const confirmed = await promptApproval({
      autoYes: opts.autoApprove,
      message: `Execute command: "${cmd}"? cwd=${cwd} timeout=${opts.timeoutMs ?? 'default'}`,
    });
    if (!confirmed) {
      return { ran: false, code: null, stdout: '', stderr: '', durationMs: 0, timedOut: false };
    }
    approved = true;
  }

  opts.sandbox.assertExecAllowed({ cwd, override: approved });

  const env = opts.envWhitelist ? filterEnv({ whitelist: opts.envWhitelist }, process.env) : process.env;

  if (opts.historyLogger) {
    await opts.historyLogger({ type: 'exec.started', command: cmd, cwd });
  }

  return new Promise<ExecResult>((resolve, reject) => {
    const start = Date.now();
    const child = spawn(cmd, {
      shell: true,
      cwd,
      env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, opts.timeoutMs)
      : null;

    const finalize = async (result: ExecResult, error?: Error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (opts.historyLogger) {
        await opts.historyLogger({
          type: 'exec.finished',
          command: cmd,
          cwd,
          code: result.code,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          error: error ? error.message : undefined,
        });
      }
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      const durationMs = Date.now() - start;
      void finalize({ ran: true, code: null, stdout, stderr, durationMs, timedOut }, error as Error);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - start;
      void finalize({ ran: true, code, stdout, stderr, durationMs, timedOut });
    });
  });
}
