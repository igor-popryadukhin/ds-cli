import fs from 'fs/promises';
import { EventEmitter } from 'node:events';
import path from 'path';

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

export type EventType =
  | 'thread.started'
  | 'thread.completed'
  | 'turn.started'
  | 'turn.completed'
  | 'item.user'
  | 'item.delta'
  | 'item.completed'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'patch.preview'
  | 'patch.applied'
  | 'patch.rollback'
  | 'exec.preview'
  | 'exec.started'
  | 'exec.finished'
  | 'sandbox.set'
  | 'approvals.set'
  | 'validation.failed';

export interface EventPayload {
  ts: string;
  type: EventType;
  session: { id: string };
  data?: Record<string, unknown>;
}

export interface EventSink {
  write(event: EventPayload): Promise<void> | void;
  close?(): Promise<void> | void;
}

export class JsonlStdoutSink implements EventSink {
  async write(event: EventPayload): Promise<void> {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
}

export class FileEventSink implements EventSink {
  constructor(private readonly filePath: string) {}

  async write(event: EventPayload): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, `${JSON.stringify(event)}\n`, 'utf-8');
  }
}

export class MultiEventSink implements EventSink {
  constructor(private readonly sinks: EventSink[]) {}

  async write(event: EventPayload): Promise<void> {
    for (const sink of this.sinks) {
      await sink.write(event);
    }
  }

  async close(): Promise<void> {
    for (const sink of this.sinks) {
      if (typeof sink.close === 'function') {
        await sink.close();
      }
    }
  }
}

export class NullEventSink implements EventSink {
  async write(): Promise<void> {
    // no-op
  }
}
