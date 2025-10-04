import path from 'path';

import { SandboxConfig, SandboxMode, SandboxPaths, ExecValidationOptions } from './types';

export class SandboxViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxViolationError';
  }
}

export class SandboxPolicy {
  private readonly workspaceRoot: string;
  private readonly writableRoots: string[];

  constructor(private readonly cfg: SandboxConfig) {
    this.workspaceRoot = path.resolve(cfg.workspaceRoot);
    this.writableRoots = (cfg.writableRoots ?? []).map((root) => path.resolve(root));
  }

  get mode(): SandboxMode {
    return this.cfg.mode;
  }

  get allowDeepSeekOnly(): boolean {
    return this.cfg.allowDeepSeekOnly;
  }

  get paths(): SandboxPaths {
    return { workspaceRoot: this.workspaceRoot, writableRoots: [...this.writableRoots] };
  }

  isInsideWorkspace(absPath: string): boolean {
    const resolved = path.resolve(absPath);
    return resolved === this.workspaceRoot || resolved.startsWith(`${this.workspaceRoot}${path.sep}`);
  }

  private isInsideWritableRoots(absPath: string): boolean {
    const resolved = path.resolve(absPath);
    return this.writableRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  }

  isWriteAllowed(absPath: string): boolean {
    const resolved = path.resolve(absPath);
    if (this.cfg.mode === 'danger-full-access') {
      return true;
    }

    if (this.cfg.mode === 'read-only') {
      return false;
    }

    if (this.cfg.mode === 'workspace-write') {
      return this.isInsideWorkspace(resolved) || this.isInsideWritableRoots(resolved);
    }

    return false;
  }

  assertWriteAllowed(absPath: string) {
    if (!this.isWriteAllowed(absPath)) {
      throw new SandboxViolationError(`Writing to ${absPath} is not permitted in sandbox mode ${this.cfg.mode}`);
    }
  }

  isExecCwdAllowed(cwd: string): boolean {
    const resolved = path.resolve(cwd);
    if (this.cfg.mode === 'danger-full-access') {
      return true;
    }

    if (this.cfg.mode === 'read-only') {
      return false;
    }

    return this.isInsideWorkspace(resolved) || this.isInsideWritableRoots(resolved);
  }

  assertExecAllowed(opts: ExecValidationOptions) {
    const { cwd, override } = opts;
    if (this.cfg.mode === 'read-only' && !override) {
      throw new SandboxViolationError('Execution is not allowed in read-only sandbox mode without explicit approval');
    }

    if (!this.isExecCwdAllowed(cwd)) {
      throw new SandboxViolationError(`Execution cwd ${cwd} is not permitted in sandbox mode ${this.cfg.mode}`);
    }
  }

  isNetworkAllowed(hostname: string): boolean {
    if (this.cfg.mode === 'danger-full-access') {
      return true;
    }

    if (this.cfg.allowDeepSeekOnly) {
      return hostname.endsWith('api.deepseek.com');
    }

    return false;
  }

  assertNetworkAllowed(hostname: string) {
    if (!this.isNetworkAllowed(hostname)) {
      throw new SandboxViolationError(`Network access to ${hostname} is not allowed in sandbox mode ${this.cfg.mode}`);
    }
  }
}
