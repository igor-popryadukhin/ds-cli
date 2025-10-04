import React from 'react';
import { render } from 'ink';

import { ChatController } from '../controllers/chatController';
import { Session } from '../core/models/session';
import { Chat } from './components/Chat';

export async function startTui(controller: ChatController, initialSession: Session) {
  const app = render(<Chat controller={controller} initialSession={initialSession} />);
  await app.waitUntilExit();
}
