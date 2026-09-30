export type Entry = { id: number; name: string };
export type DrawSession = { entries: Entry[]; topic: string; mode?: import('./sports').GameMode };
const SESSION_KEY = 'pixel-election:session:v1';
const DEFAULT_TOPIC = '오늘 커피 쏠 사람은?';

export function readSession(): DrawSession {
  const empty = { entries: [{ id: 1, name: '' }, { id: 2, name: '' }], topic: DEFAULT_TOPIC };
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return empty;
    const value = saved as Partial<DrawSession>;
    if (!Array.isArray(value.entries) || value.entries.length < 2 || value.entries.length > MAX_CANDIDATES) return empty;
    if (!value.entries.every(entry => entry && typeof entry.name === 'string')) return empty;
    return {
      entries: value.entries.map((entry, index) => ({ id: index + 1, name: entry.name.slice(0, 16) })),
      topic: typeof value.topic === 'string' ? value.topic.slice(0, 60) : DEFAULT_TOPIC,
      mode: value.mode === 'racing' || value.mode === 'arena' ? value.mode : 'election',
    };
  } catch { return empty; }
}

export function saveSession(value: DrawSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch { /* The draw also works when storage is unavailable. */ }
}
import { MAX_CANDIDATES } from './election';
