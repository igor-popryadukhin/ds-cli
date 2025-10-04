import React from 'react';
import { Box, Text } from 'ink';

import { StatusState } from '../../core/services/eventBus';

export interface StatusBarProps {
  sessionId: string;
  model: string;
  status: StatusState;
  error?: string;
}

const statusColor: Record<StatusState, string> = {
  idle: 'gray',
  sending: 'yellow',
  error: 'red',
};

const statusLabel: Record<StatusState, string> = {
  idle: 'Idle',
  sending: 'Responding…',
  error: 'Error',
};

export function StatusBar({ sessionId, model, status, error }: StatusBarProps) {
  return (
    <Box justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="gray">Session: {sessionId}</Text>
      <Text color="gray">Model: {model}</Text>
      <Text color={statusColor[status]}>
        {statusLabel[status]}
        {status === 'error' && error ? ` — ${error}` : ''}
      </Text>
    </Box>
  );
}
