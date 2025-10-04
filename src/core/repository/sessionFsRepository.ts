import fs from 'fs/promises';
import path from 'path';

import { Session } from '../models/session';

export class SessionFsRepository {
  constructor(private readonly baseDir: string) {}

  private p(id: string) {
    return path.join(this.baseDir, `${id}.jsonl`);
  }

  private snap(id: string) {
    return path.join(this.baseDir, `${id}.snapshot.json`);
  }

  async append(id: string, record: unknown) {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.appendFile(this.p(id), JSON.stringify(record) + '\n', 'utf-8');
  }

  async saveSnapshot(session: Session) {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.snap(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  async readSnapshot(id: string): Promise<Session | null> {
    try {
      const content = await fs.readFile(this.snap(id), 'utf-8');
      return JSON.parse(content) as Session;
    } catch {
      return null;
    }
  }

  async lastSessionId(): Promise<string | null> {
    try {
      const files = (await fs.readdir(this.baseDir)).filter((f) => f.endsWith('.snapshot.json'));
      if (!files.length) {
        return null;
      }
      files.sort((a, b) => a.localeCompare(b));
      return files.pop()!.replace('.snapshot.json', '');
    } catch {
      return null;
    }
  }
}
