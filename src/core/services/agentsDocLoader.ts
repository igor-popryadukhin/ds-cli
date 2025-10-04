import fs from 'fs/promises';
import path from 'path';

export async function loadAgentsDoc(cwd: string, home = process.env.HOME ?? '') {
  const paths = [path.join(home, '.deepseek', 'AGENTS.md'), path.join(cwd, 'AGENTS.md')];
  const parts: string[] = [];
  for (const p of paths) {
    try {
      parts.push(await fs.readFile(p, 'utf-8'));
    } catch {
      // ignore missing files
    }
  }
  return parts.join('\n\n---\n\n');
}
