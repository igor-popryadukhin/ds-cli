import path from 'path';
import { Command } from 'commander';

import { getHistoryDir, getSandboxConfig, updateConfig } from '../../config';
import { SandboxMode } from '../../core/sandbox/types';
import { HistoryLogger } from '../../core/services/historyLogger';

function getHistoryLogger(): HistoryLogger {
  const historyDir = path.resolve(process.cwd(), getHistoryDir());
  return new HistoryLogger(historyDir);
}

function validateMode(mode: string): mode is SandboxMode {
  return mode === 'read-only' || mode === 'workspace-write' || mode === 'danger-full-access';
}

export const sandbox = new Command('sandbox')
  .description('inspect and change sandbox mode')
  .addCommand(
    new Command('get')
      .description('print current sandbox configuration')
      .action(() => {
        const config = getSandboxConfig();
        console.log(JSON.stringify(config, null, 2));
      }),
  )
  .addCommand(
    new Command('set')
      .description('update sandbox mode')
      .argument('<mode>', 'sandbox mode: read-only | workspace-write | danger-full-access')
      .action(async (mode: string) => {
        if (!validateMode(mode)) {
          console.error('Invalid sandbox mode. Use one of: read-only, workspace-write, danger-full-access');
          process.exitCode = 1;
          return;
        }
        const current = getSandboxConfig();
        if (current.mode === mode) {
          console.log(`Sandbox mode already set to ${mode}`);
          return;
        }
        updateConfig({ sandbox: { ...current, mode } });
        console.log(`Sandbox mode updated to ${mode}`);
        await getHistoryLogger().log({ type: 'sandbox.set', mode });
      }),
  );
