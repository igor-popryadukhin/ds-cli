import fs from 'fs/promises';
import path from 'path';

export class HistoryLogger {
  constructor(private readonly historyDir: string, private readonly fileName = 'operations.jsonl') {}

  private get filePath(): string {
    return path.join(this.historyDir, this.fileName);
  }

  async log(event: Record<string, unknown>) {
    const record = { ...event, ts: Date.now() };
    await fs.mkdir(this.historyDir, { recursive: true });
    await fs.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf-8');
  }
}
