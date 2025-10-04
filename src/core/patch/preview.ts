import { FileDiff } from './parseUnifiedDiff';

export interface PatchFilePreview {
  path: string;
  additions: number;
  deletions: number;
  isNew: boolean;
  isDeleted: boolean;
}

export interface PatchPreview {
  files: PatchFilePreview[];
  totalAdditions: number;
  totalDeletions: number;
}

export function buildPreview(diffs: FileDiff[]): PatchPreview {
  const files: PatchFilePreview[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const diff of diffs) {
    let additions = 0;
    let deletions = 0;
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') {
          additions += 1;
        }
        if (line.type === 'remove') {
          deletions += 1;
        }
      }
    }
    totalAdditions += additions;
    totalDeletions += deletions;
    files.push({
      path: diff.path,
      additions,
      deletions,
      isNew: diff.isNew,
      isDeleted: diff.isDeleted,
    });
  }

  return {
    files,
    totalAdditions,
    totalDeletions,
  };
}
