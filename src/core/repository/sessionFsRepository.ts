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
      const entries = (await fs.readdir(this.baseDir))
        .filter((file) => file.endsWith('.snapshot.json'))
        .map((file) => ({
          id: file.replace('.snapshot.json', ''),
          path: path.join(this.baseDir, file),
        }));

      if (!entries.length) {
        return null;
      }

      let latest: { id: string; mtimeMs: number } | null = null;
      for (const entry of entries) {
        try {
          const stat = await fs.stat(entry.path);
          if (!latest || stat.mtimeMs > latest.mtimeMs) {
            latest = { id: entry.id, mtimeMs: stat.mtimeMs };
          }
        } catch {
          // ignore files that cannot be stat'ed
        }
      }

      return latest?.id ?? null;
    } catch {
      return null;
    }
  }
}
