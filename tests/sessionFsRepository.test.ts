import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { SessionFsRepository } from '../src/core/repository/sessionFsRepository';
import { Session } from '../src/core/models/session';

function createSession(id: string): Session {
  return {
    id,
    model: 'deepseek-chat',
    createdAt: Date.now(),
    messages: [],
    turns: [],
  };
}

describe('SessionFsRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-repo-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('appends records as JSON lines', async () => {
    const repo = new SessionFsRepository(dir);
    await repo.append('test', { type: 'event', value: 1 });
    await repo.append('test', { type: 'event', value: 2 });

    const content = await fs.readFile(path.join(dir, 'test.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ type: 'event', value: 1 });
    expect(JSON.parse(lines[1])).toEqual({ type: 'event', value: 2 });
  });

  it('saves and reads snapshots', async () => {
    const repo = new SessionFsRepository(dir);
    const session = createSession('abc');
    await repo.saveSnapshot(session);

    const snapshot = await repo.readSnapshot('abc');
    expect(snapshot).toEqual(session);
  });

  it('returns the last session id', async () => {
    const repo = new SessionFsRepository(dir);
    await repo.saveSnapshot(createSession('001'));
    await repo.saveSnapshot(createSession('002'));

    const lastId = await repo.lastSessionId();
    expect(lastId).toBe('002');
  });
});
