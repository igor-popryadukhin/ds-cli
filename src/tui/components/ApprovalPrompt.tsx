import React from 'react';
import { Box, Text } from 'ink';

export interface ApprovalPromptProps {
  title: string;
  details?: string;
  danger?: boolean;
}

export function ApprovalPrompt({ title, details, danger }: ApprovalPromptProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={danger ? 'red' : 'green'} paddingX={1} paddingY={0}>
      <Text color={danger ? 'red' : 'green'}>{title}</Text>
      {details ? <Text>{details}</Text> : null}
      <Text>Confirm? [y/N]</Text>
    </Box>
  );
}
