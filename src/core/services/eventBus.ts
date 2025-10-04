import { EventEmitter } from 'node:events';

import { Message } from '../models/message';
import { Session } from '../models/session';

export type StatusState = 'idle' | 'sending' | 'error';

export interface StatusEvent {
  state: StatusState;
  message?: string;
}

export interface AgentPatchSuggestedEvent {
  diff: string;
  reason?: string;
}

export interface AgentExecSuggestedEvent {
  command: string;
  cwd?: string;
  reason?: string;
}

export type ChatEventMap = {
  status: StatusEvent;
  session: Session;
  message: Message;
  error: { error: Error };
  'agent.patch.suggested': AgentPatchSuggestedEvent;
  'agent.exec.suggested': AgentExecSuggestedEvent;
};

type Listener<T> = (payload: T) => void;

export class EventBus {
  private readonly emitter = new EventEmitter();

  on<K extends keyof ChatEventMap>(event: K, listener: Listener<ChatEventMap[K]>) {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  once<K extends keyof ChatEventMap>(event: K, listener: Listener<ChatEventMap[K]>) {
    this.emitter.once(event, listener);
    return () => this.emitter.off(event, listener);
  }

  emit<K extends keyof ChatEventMap>(event: K, payload: ChatEventMap[K]) {
    this.emitter.emit(event, payload);
  }
}
