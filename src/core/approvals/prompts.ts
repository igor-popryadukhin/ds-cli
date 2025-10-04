import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface PromptOptions {
  autoYes?: boolean;
  message: string;
}

export async function promptApproval({ autoYes, message }: PromptOptions): Promise<boolean> {
  if (autoYes) {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
}
