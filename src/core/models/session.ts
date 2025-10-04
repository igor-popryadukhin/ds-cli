import { Message } from './message';
import { Turn } from './turn';

export interface Session {
  id: string;
  model: string;
  createdAt: number;
  messages: Message[];
  turns: Turn[];
  meta?: Record<string, unknown>;
}
