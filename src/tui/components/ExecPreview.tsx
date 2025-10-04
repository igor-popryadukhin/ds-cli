import React from 'react';
import { Box, Text } from 'ink';

export interface ExecPreviewProps {
  command: string;
  cwd: string;
  timeoutMs: number;
  envWhitelist: string[];
}

export function ExecPreview({ command, cwd, timeoutMs, envWhitelist }: ExecPreviewProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text>Execute: {command}</Text>
      <Text>cwd: {cwd}</Text>
      <Text>timeout: {timeoutMs}ms</Text>
      <Text>env whitelist: {envWhitelist.join(', ') || 'none'}</Text>
    </Box>
  );
}
