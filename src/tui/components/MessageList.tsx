import React from 'react';
import { Box, Text } from 'ink';

import { Message } from '../../core/models/message';

const roleColors: Record<Message['role'], string> = {
  system: 'yellow',
  user: 'cyan',
  assistant: 'green',
};

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column">
      {messages.map((message) => (
        <Text key={message.id} color={roleColors[message.role]}>
          {message.role.padEnd(9)}: {message.content}
        </Text>
      ))}
    </Box>
  );
}
