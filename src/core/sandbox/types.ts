export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface SandboxConfig {
  mode: SandboxMode;
  workspaceRoot: string;
  writableRoots?: string[];
  allowDeepSeekOnly: boolean;
}

export interface SandboxPaths {
  workspaceRoot: string;
  writableRoots: string[];
}

export interface ExecValidationOptions {
  cwd: string;
  override?: boolean;
}
