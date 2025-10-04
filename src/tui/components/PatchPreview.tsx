import React from 'react';
import { Box, Text } from 'ink';

import { PatchPreview as PatchPreviewData } from '../../core/patch/preview';

export interface PatchPreviewProps {
  preview: PatchPreviewData;
}

export function PatchPreview({ preview }: PatchPreviewProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text>Patch changes: {preview.files.length} files (+{preview.totalAdditions} / -{preview.totalDeletions})</Text>
      {preview.files.map((file) => (
        <Text key={file.path}>
          {file.path} {file.isNew ? '[new]' : ''} {file.isDeleted ? '[deleted]' : ''} (+{file.additions} / -{file.deletions})
        </Text>
      ))}
    </Box>
  );
}
