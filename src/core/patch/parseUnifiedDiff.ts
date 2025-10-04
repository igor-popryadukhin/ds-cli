export interface HunkLine {
  type: 'context' | 'add' | 'remove';
  value: string;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: HunkLine[];
}

export interface FileDiff {
  path: string;
  hunks: Hunk[];
  isNew: boolean;
  isDeleted: boolean;
}

function parseHunkHeader(header: string) {
  const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header);
  if (!match) {
    throw new Error(`Invalid hunk header: ${header}`);
  }

  return {
    oldStart: Number.parseInt(match[1], 10),
    oldLines: match[2] ? Number.parseInt(match[2], 10) : 1,
    newStart: Number.parseInt(match[3], 10),
    newLines: match[4] ? Number.parseInt(match[4], 10) : 1,
  };
}

function sanitizePath(raw: string): string {
  const trimmed = raw.replace(/^a\//, '').replace(/^b\//, '');
  return trimmed;
}

export function parseUnifiedDiff(input: string): FileDiff[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let pendingHeader: { oldPath?: string; newPath?: string } | null = null;

  const pushCurrent = () => {
    if (current) {
      files.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      pushCurrent();
      pendingHeader = null;
      continue;
    }

    if (line.startsWith('--- ')) {
      pendingHeader = pendingHeader ?? {};
      const oldPath = line.slice(4).trim();
      pendingHeader.oldPath = oldPath === '/dev/null' ? undefined : sanitizePath(oldPath);
      continue;
    }

    if (line.startsWith('+++ ')) {
      pendingHeader = pendingHeader ?? {};
      const newPath = line.slice(4).trim();
      pendingHeader.newPath = newPath === '/dev/null' ? undefined : sanitizePath(newPath);
      const pathValue = pendingHeader.newPath ?? pendingHeader.oldPath;
      if (!pathValue) {
        throw new Error('Unable to determine file path from diff headers');
      }
      current = {
        path: pathValue,
        hunks: [],
        isNew: pendingHeader.oldPath === undefined && pendingHeader.newPath !== undefined,
        isDeleted: pendingHeader.newPath === undefined && pendingHeader.oldPath !== undefined,
      };
      continue;
    }

    if (line.startsWith('@@')) {
      if (!current) {
        throw new Error('Found hunk header before file header');
      }
      const { oldStart, oldLines, newStart, newLines } = parseHunkHeader(line);
      current.hunks.push({ oldStart, oldLines, newStart, newLines, lines: [] });
      continue;
    }

    if (!current) {
      continue;
    }

    if (!current.hunks.length) {
      continue;
    }

    const hunk = current.hunks[current.hunks.length - 1];

    if (line.startsWith('+')) {
      hunk.lines.push({ type: 'add', value: line.slice(1) });
    } else if (line.startsWith('-')) {
      hunk.lines.push({ type: 'remove', value: line.slice(1) });
    } else if (line.startsWith(' ')) {
      hunk.lines.push({ type: 'context', value: line.slice(1) });
    } else if (line.startsWith('\\ No newline at end of file')) {
      // ignore
    } else if (line.trim() === '') {
      hunk.lines.push({ type: 'context', value: '' });
    }
  }

  pushCurrent();

  return files;
}
