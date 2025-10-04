import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { ChatController } from '../../controllers/chatController';
import { Session } from '../../core/models/session';
import { StatusState } from '../../core/services/eventBus';
import { MessageList } from './MessageList';
import { StatusBar } from './StatusBar';

export interface ChatProps {
  controller: ChatController;
  initialSession: Session;
}

export function Chat({ controller, initialSession }: ChatProps) {
  const [session, setSession] = useState<Session>(initialSession);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<StatusState>('idle');
  const [error, setError] = useState<string | undefined>();
  const sessionRef = useRef(session);
  const sendingRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    const unsubscribeStatus = controller.eventBus.on('status', (event) => {
      setStatus(event.state);
      setError(event.message);
      if (event.state !== 'sending') {
        sendingRef.current = false;
      }
    });
    const unsubscribeSession = controller.eventBus.on('session', (updatedSession) => {
      setSession(updatedSession);
    });
    return () => {
      unsubscribeStatus();
      unsubscribeSession();
    };
  }, [controller]);

  const submit = async () => {
    const text = input.trim();
    if (!text || sendingRef.current) {
      return;
    }
    sendingRef.current = true;
    setInput('');
    try {
      await controller.send(sessionRef.current, text);
      setError(undefined);
    } catch (err) {
      const e = err as Error;
      setError(e.message);
      sendingRef.current = false;
    }
  };

  useInput((inputKey, key) => {
    if (key.return) {
      void submit();
      return;
    }
    if (key.backspace || key.delete) {
      setInput((value) => value.slice(0, -1));
      return;
    }
    if (!key.ctrl && !key.meta && inputKey) {
      setInput((value) => value + inputKey);
    }
  });

  const cursor = status === 'sending' ? '' : '█';

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text color="yellow">DeepSeek CLI — Interactive (Terminal)</Text>
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        <MessageList messages={session.messages} />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">› </Text>
        <Text>{input}{cursor}</Text>
      </Box>
      <Box marginTop={1}>
        <StatusBar sessionId={session.id} model={session.model} status={status} error={error} />
      </Box>
    </Box>
  );
}
