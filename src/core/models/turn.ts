import { Message } from './message';

export interface Turn {
  id: string;
  user?: Message;
  assistant?: Message;
  ts: number;
}
