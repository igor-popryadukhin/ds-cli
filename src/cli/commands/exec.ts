import path from 'path';
import { Command } from 'commander';

import { getApprovalsConfig, getExecConfig, getHistoryDir, getSandboxConfig } from '../../config';
import { Approvals } from '../../core/approvals/approvalsPolicy';
import { runSafe } from '../../core/exec/runner';
import { SandboxPolicy } from '../../core/sandbox/sandboxPolicy';
import { HistoryLogger } from '../../core/services/historyLogger';

export const execCommand = new Command('exec')
  .description('execute command within sandbox constraints')
  .argument('<command...>', 'command to execute')
  .option('--cwd <dir>', 'working directory')
  .option('--timeout <ms>', 'timeout in milliseconds')
  .option('--yes', 'auto approve execution')
  .option('--json', 'emit JSON lines output')
  .action(async (commandParts: string[], options: { cwd?: string; timeout?: string; yes?: boolean; json?: boolean }) => {
    const { cwd, timeout, yes, json } = options;
    const command = commandParts.join(' ');
    const sandboxConfig = getSandboxConfig();
    const approvalsConfig = getApprovalsConfig();
    const execConfig = getExecConfig();
    const historyDir = path.resolve(process.cwd(), getHistoryDir());
    const historyLogger = new HistoryLogger(historyDir);
    const workspaceRoot = path.resolve(process.cwd(), sandboxConfig.workspaceRoot);
    const sandbox = new SandboxPolicy({ ...sandboxConfig, workspaceRoot });
    const approvals = new Approvals(approvalsConfig.policy);
    const timeoutMs = timeout ? Number.parseInt(timeout, 10) : execConfig.timeoutMs;
    if (Number.isNaN(timeoutMs)) {
      console.error('Invalid timeout value');
      process.exitCode = 1;
      return;
    }
    const resolvedCwd = cwd ? path.resolve(process.cwd(), cwd) : workspaceRoot;
    const preview = {
      command,
      cwd: resolvedCwd,
      timeoutMs,
      envWhitelist: execConfig.envWhitelist,
    };

    if (json) {
      console.log(JSON.stringify({ type: 'exec.preview', preview }));
    } else {
      console.log(`Command: ${command}`);
      console.log(`cwd: ${resolvedCwd}`);
      console.log(`timeout: ${timeoutMs}ms`);
    }

    try {
      const result = await runSafe(command, {
        sandbox,
        approvals,
        cwd: resolvedCwd,
        timeoutMs,
        envWhitelist: execConfig.envWhitelist,
        autoApprove: yes,
        historyLogger: (event) => historyLogger.log(event),
      });

      if (json) {
        console.log(
          JSON.stringify({
            type: 'exec.result',
            ran: result.ran,
            code: result.code,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs,
            timedOut: result.timedOut,
          }),
        );
      } else if (!result.ran) {
        console.log('Command execution was not approved');
      } else {
        console.log(`Exit code: ${result.code}`);
        if (result.stdout.trim()) {
          console.log('stdout:\n' + result.stdout);
        }
        if (result.stderr.trim()) {
          console.log('stderr:\n' + result.stderr);
        }
        if (result.timedOut) {
          console.log('Command timed out');
        }
      }

      if (result.ran && result.code !== 0) {
        process.exitCode = result.code ?? 1;
      }
    } catch (error) {
      const err = error as Error;
      if (json) {
        console.log(JSON.stringify({ type: 'exec.error', message: err.message }));
      } else {
        console.error('Failed to execute command:', err.message);
      }
      process.exitCode = 1;
    }
  });
