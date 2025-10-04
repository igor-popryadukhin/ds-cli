import path from 'path';
import { Command } from 'commander';

import { getApprovalsConfig, getHistoryDir, updateConfig } from '../../config';
import { ApprovalPolicy } from '../../core/approvals/approvalsPolicy';
import { HistoryLogger } from '../../core/services/historyLogger';

function getHistoryLogger(): HistoryLogger {
  const historyDir = path.resolve(process.cwd(), getHistoryDir());
  return new HistoryLogger(historyDir);
}

function validatePolicy(policy: string): policy is ApprovalPolicy {
  return policy === 'untrusted' || policy === 'on-failure' || policy === 'on-request' || policy === 'never';
}

export const approvals = new Command('approvals')
  .description('manage approval policy')
  .addCommand(
    new Command('get')
      .description('print current approval policy')
      .action(() => {
        const config = getApprovalsConfig();
        console.log(config.policy);
      }),
  )
  .addCommand(
    new Command('set')
      .description('update approval policy')
      .argument('<policy>', 'approval policy: untrusted | on-failure | on-request | never')
      .action(async (policy: string) => {
        if (!validatePolicy(policy)) {
          console.error('Invalid approval policy. Use one of: untrusted, on-failure, on-request, never');
          process.exitCode = 1;
          return;
        }
        const current = getApprovalsConfig();
        if (current.policy === policy) {
          console.log(`Approval policy already set to ${policy}`);
          return;
        }
        updateConfig({ approvals: { ...current, policy } });
        console.log(`Approval policy updated to ${policy}`);
        await getHistoryLogger().log({ type: 'approvals.set', policy });
      }),
  );
