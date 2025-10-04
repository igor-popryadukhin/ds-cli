import fs from 'fs/promises';
import path from 'path';

import { Approvals } from '../approvals/approvalsPolicy';
import { promptApproval } from '../approvals/prompts';
import { SandboxPolicy } from '../sandbox/sandboxPolicy';
import { FileDiff, parseUnifiedDiff } from './parseUnifiedDiff';
import { buildPreview, PatchPreview } from './preview';

export interface ApplyPatchResult {
  applied: boolean;
  preview: PatchPreview;
  backupDir?: string;
}

export interface ApplyPatchContext {
  sandbox: SandboxPolicy;
  approvals: Approvals;
  workspaceRoot: string;
  autoYes?: boolean;
  historyLogger?: (event: Record<string, unknown>) => Promise<void>;
}

interface FileApplyResult {
  path: string;
  newContent: string | null;
}

function ensureDir(filePath: string) {
  return fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readFileIfExists(target: string): Promise<string | null> {
  try {
    return await fs.readFile(target, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function applyFileDiff(diff: FileDiff, originalContent: string | null): string | null {
  const originalLines = originalContent?.split('\n') ?? [];
  const resultLines: string[] = [];
  let cursor = 1;

  for (const hunk of diff.hunks) {
    const copyUntil = hunk.oldStart - 1;
    while (cursor <= copyUntil && cursor - 1 < originalLines.length) {
      resultLines.push(originalLines[cursor - 1]);
      cursor += 1;
    }

    let originalIndex = hunk.oldStart - 1;
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        const expected = originalLines[originalIndex] ?? '';
        if (expected !== line.value) {
          throw new Error(`Context mismatch while applying patch for ${diff.path}`);
        }
        resultLines.push(line.value);
        originalIndex += 1;
        cursor = originalIndex + 1;
      } else if (line.type === 'remove') {
        const expected = originalLines[originalIndex] ?? '';
        if (expected !== line.value) {
          throw new Error(`Removal mismatch while applying patch for ${diff.path}`);
        }
        originalIndex += 1;
        cursor = originalIndex + 1;
      } else if (line.type === 'add') {
        resultLines.push(line.value);
      }
    }

    cursor = originalIndex + 1;
  }

  while (cursor - 1 < originalLines.length) {
    resultLines.push(originalLines[cursor - 1]);
    cursor += 1;
  }

  if (diff.isDeleted) {
    return null;
  }

  return resultLines.join('\n');
}

async function backupFile(workspaceRoot: string, target: string, backupRoot: string) {
  const content = await readFileIfExists(target);
  if (content === null) {
    return;
  }
  const relativePath = path.relative(workspaceRoot, target);
  const backupPath = path.join(backupRoot, relativePath);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, content, 'utf-8');
}

async function copyBackupDir(source: string, destination: string) {
  const entries = await fs.readdir(source, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyBackupDir(srcPath, destPath);
    } else {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      const content = await fs.readFile(srcPath, 'utf-8');
      await fs.writeFile(destPath, content, 'utf-8');
    }
  }
}

async function restoreFromBackup(backupRoot: string, workspaceRoot: string) {
  await copyBackupDir(backupRoot, workspaceRoot);
}

async function applySingleFile(workspaceRoot: string, diff: FileDiff): Promise<FileApplyResult> {
  const target = path.resolve(workspaceRoot, diff.path);
  const original = await readFileIfExists(target);
  const updated = applyFileDiff(diff, original);

  if (updated === null) {
    await fs.rm(target, { force: true });
    return { path: diff.path, newContent: null };
  }

  await ensureDir(target);
  await fs.writeFile(target, updated, 'utf-8');
  return { path: diff.path, newContent: updated };
}

export async function applyPatch(diffText: string, ctx: ApplyPatchContext): Promise<ApplyPatchResult> {
  const diffs = parseUnifiedDiff(diffText);
  const preview = buildPreview(diffs);
  const { sandbox, approvals, workspaceRoot, autoYes, historyLogger } = ctx;

  if (historyLogger) {
    await historyLogger({ type: 'patch.preview', preview });
  }

  for (const file of diffs) {
    const target = path.resolve(workspaceRoot, file.path);
    sandbox.assertWriteAllowed(target);
  }

  if (approvals.needsApproval('patch')) {
    const confirmed = await promptApproval({
      autoYes,
      message: `Apply patch for ${preview.files.length} files (+${preview.totalAdditions} / -${preview.totalDeletions})?`,
    });
    if (!confirmed) {
      return { applied: false, preview };
    }
  }

  const backupRoot = path.join(workspaceRoot, '.deepseek', 'backup', Date.now().toString());
  await fs.mkdir(backupRoot, { recursive: true });

  try {
    for (const file of diffs) {
      const target = path.resolve(workspaceRoot, file.path);
      await backupFile(workspaceRoot, target, backupRoot);
    }

    const appliedFiles: FileApplyResult[] = [];
    for (const file of diffs) {
      const result = await applySingleFile(workspaceRoot, file);
      appliedFiles.push(result);
    }

    if (historyLogger) {
      await historyLogger({ type: 'patch.applied', files: appliedFiles.map((f) => f.path) });
    }

    return { applied: true, preview, backupDir: backupRoot };
  } catch (error) {
    for (const file of diffs) {
      const target = path.resolve(workspaceRoot, file.path);
      if (file.isNew) {
        await fs.rm(target, { force: true }).catch(() => undefined);
      }
    }
    await restoreFromBackup(backupRoot, workspaceRoot).catch(() => undefined);
    if (historyLogger) {
      await historyLogger({ type: 'patch.rollback', error: (error as Error).message });
    }
    throw error;
  }
}
