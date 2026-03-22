import { loadPersistedJson, savePersistedJson } from './persistedJson';

export interface InstanceSessionInfo {
  pid: number;
  username: string;
  displayName: string;
  gameName: string;
  gameId: number;
  jobId: string;
  avatarUrl: string;
  userId: number;
}

interface InstanceSessionStore {
  sessions: Record<number, InstanceSessionInfo>;
}

const FILE_NAME = 'instance-sessions.json';

let store: InstanceSessionStore = {
  sessions: {},
};

let listeners = new Set<() => void>();
let cachedSessions: Record<number, InstanceSessionInfo> = {};

function notify(): void {
  listeners.forEach(l => l());
}

export async function loadInstanceSessions(): Promise<void> {
  try {
    const loaded = await loadPersistedJson<Record<number, InstanceSessionInfo> | null>(FILE_NAME, null);
    if (loaded) {
      store.sessions = loaded;
      cachedSessions = loaded;
    }
  } catch (e) {
    console.error('Failed to load instance sessions:', e);
  }
  notify();
}

export async function saveInstanceSessions(): Promise<void> {
  try {
    await savePersistedJson(FILE_NAME, store.sessions);
  } catch (e) {
    console.error('Failed to save instance sessions:', e);
  }
}

export function getSessions(): Record<number, InstanceSessionInfo> {
  return cachedSessions;
}

export function setSession(pid: number, info: InstanceSessionInfo): void {
  store.sessions[pid] = info;
  cachedSessions = { ...store.sessions };
  notify();
  saveInstanceSessions();
}

export function removeSession(pid: number): void {
  delete store.sessions[pid];
  cachedSessions = { ...store.sessions };
  notify();
  saveInstanceSessions();
}

export function subscribeToSessions(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
