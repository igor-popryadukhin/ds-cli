import fs from 'fs/promises';
import path from 'path';
import { Command } from 'commander';

import { getApprovalsConfig, getHistoryDir, getSandboxConfig } from '../../config';
import { Approvals } from '../../core/approvals/approvalsPolicy';
import { applyPatch } from '../../core/patch/apply';
import { SandboxPolicy } from '../../core/sandbox/sandboxPolicy';
import { HistoryLogger } from '../../core/services/historyLogger';

async function readDiff(file?: string): Promise<string> {
  if (file) {
    return fs.readFile(file, 'utf-8');
  }
  return new Promise<string>((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

export const patchApply = new Command('patch')
  .description('operations with patches')
  .addCommand(
    new Command('apply')
      .description('apply patch from diff file or stdin')
      .option('--file <path>', 'path to diff file')
      .option('--yes', 'auto approve patch application')
      .option('--json', 'emit JSON lines')
      .action(async (options: { file?: string; yes?: boolean; json?: boolean }) => {
        const { file, yes, json } = options;
        const diff = await readDiff(file);
        if (!diff.trim()) {
          console.error('No diff content provided');
          process.exitCode = 1;
          return;
        }
        const sandboxConfig = getSandboxConfig();
        const approvalsConfig = getApprovalsConfig();
        const historyDir = path.resolve(process.cwd(), getHistoryDir());
        const historyLogger = new HistoryLogger(historyDir);
        const workspaceRoot = path.resolve(process.cwd(), sandboxConfig.workspaceRoot);
        const sandbox = new SandboxPolicy({ ...sandboxConfig, workspaceRoot });
        const approvals = new Approvals(approvalsConfig.policy);

        try {
          const result = await applyPatch(diff, {
            sandbox,
            approvals,
            workspaceRoot,
            autoYes: yes,
            historyLogger: (event) => historyLogger.log(event),
          });

          if (json) {
            console.log(JSON.stringify({ type: 'patch.preview', preview: result.preview }));
            console.log(JSON.stringify({ type: 'patch.result', applied: result.applied }));
          } else {
            console.log(`Patch preview: ${result.preview.files.length} files (+${result.preview.totalAdditions} / -${result.preview.totalDeletions})`);
            console.log(result.applied ? 'Patch applied successfully' : 'Patch application cancelled');
          }
        } catch (error) {
          const err = error as Error;
          if (json) {
            console.log(JSON.stringify({ type: 'patch.error', message: err.message }));
          } else {
            console.error('Failed to apply patch:', err.message);
          }
          process.exitCode = 1;
        }
      }),
  );
