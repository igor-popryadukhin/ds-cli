import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { Approvals } from '../src/core/approvals/approvalsPolicy';
import { applyPatch } from '../src/core/patch/apply';
import { buildPreview } from '../src/core/patch/preview';
import { parseUnifiedDiff } from '../src/core/patch/parseUnifiedDiff';
import { runSafe } from '../src/core/exec/runner';
import { SandboxPolicy } from '../src/core/sandbox/sandboxPolicy';
import { SandboxConfig } from '../src/core/sandbox/types';

function createSandbox(config: Partial<SandboxConfig> = {}, workspaceRoot?: string) {
  const root = workspaceRoot ?? process.cwd();
  return new SandboxPolicy({
    mode: 'read-only',
    workspaceRoot: root,
    allowDeepSeekOnly: true,
    ...config,
  });
}

async function withTempWorkspace(fn: (workspace: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-cli-test-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('SandboxPolicy', () => {
  test('disallows writes in read-only mode', async () => {
    await withTempWorkspace(async (workspace) => {
      const sandbox = createSandbox({ mode: 'read-only', workspaceRoot: workspace });
      expect(sandbox.isWriteAllowed(path.join(workspace, 'file.txt'))).toBe(false);
    });
  });

  test('allows workspace writes in workspace-write mode', async () => {
    await withTempWorkspace(async (workspace) => {
      const sandbox = createSandbox({ mode: 'workspace-write', workspaceRoot: workspace });
      expect(sandbox.isWriteAllowed(path.join(workspace, 'file.txt'))).toBe(true);
      expect(sandbox.isWriteAllowed(path.join(path.dirname(workspace), 'outside.txt'))).toBe(false);
    });
  });

  test('allows all writes in danger-full-access mode', async () => {
    await withTempWorkspace(async (workspace) => {
      const sandbox = createSandbox({ mode: 'danger-full-access', workspaceRoot: workspace });
      expect(sandbox.isWriteAllowed(path.join(workspace, 'file.txt'))).toBe(true);
      expect(sandbox.isWriteAllowed(path.join('/', 'tmp', 'other.txt'))).toBe(true);
    });
  });
});

describe('Patch application', () => {
  const diff = `diff --git a/example.txt b/example.txt\n` +
    `--- a/example.txt\n` +
    `+++ b/example.txt\n` +
    `@@ -0,0 +1 @@\n` +
    `+hello world\n`;

  test('buildPreview counts additions', () => {
    const parsed = parseUnifiedDiff(diff);
    const preview = buildPreview(parsed);
    expect(preview.totalAdditions).toBe(1);
    expect(preview.totalDeletions).toBe(0);
    expect(preview.files[0].isNew).toBe(true);
  });

  test('applyPatch writes files and respects sandbox', async () => {
    await withTempWorkspace(async (workspace) => {
      const sandbox = createSandbox({ mode: 'workspace-write', workspaceRoot: workspace });
      const approvals = new Approvals('never');
      const result = await applyPatch(diff, {
        sandbox,
        approvals,
        workspaceRoot: workspace,
        historyLogger: () => Promise.resolve(),
      });
      expect(result.applied).toBe(true);
      const content = await fs.readFile(path.join(workspace, 'example.txt'), 'utf-8');
      expect(content.trim()).toBe('hello world');
    });
  });
});

describe('runSafe', () => {
  test('executes command inside sandbox', async () => {
    await withTempWorkspace(async (workspace) => {
      const sandbox = createSandbox({ mode: 'workspace-write', workspaceRoot: workspace });
      const approvals = new Approvals('never');
      const result = await runSafe('echo test-run-safe', {
        sandbox,
        approvals,
        cwd: workspace,
        timeoutMs: 1000,
        envWhitelist: ['PATH'],
        autoApprove: true,
      });
      expect(result.ran).toBe(true);
      expect(result.stdout).toContain('test-run-safe');
    });
  });
});
