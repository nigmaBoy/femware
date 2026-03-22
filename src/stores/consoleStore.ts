import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type ConsoleLogLevel = 'info' | 'warning' | 'error' | 'success' | 'status';
export type LogSource = 'femware' | 'roblox';

export interface ConsoleLogEntry {
  id: string;
  level: ConsoleLogLevel;
  message: string;
  timestamp: Date;
  source: LogSource;
}

interface ConsoleLogPayload {
  level?: string;
  message?: string;
}

let logs: ConsoleLogEntry[] = [];
const listeners = new Set<() => void>();
let unlistenPromise: Promise<UnlistenFn> | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function normalizeLevel(level?: string): ConsoleLogLevel {
  if (level === 'warning' || level === 'error' || level === 'success' || level === 'status') {
    return level;
  }
  return 'info';
}

function nextId(): string {
  return `console_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function initializeConsoleListener(): Promise<void> {
  // If a listener is already registered, tear it down first before re-registering.
  // Previously this just did an early return which blocked re-initialization after
  // redirect_output was toggled off and back on.
  if (unlistenPromise) {
    const unlisten = await unlistenPromise;
    unlisten();
    unlistenPromise = null;
  }

  unlistenPromise = listen<ConsoleLogPayload>('console-log', (event) => {
    appendConsoleLog({
      level: normalizeLevel(event.payload?.level),
      message: event.payload?.message ?? '',
      source: 'roblox',
    });
  });

  await unlistenPromise;
}

export function appendConsoleLog(entry: Omit<ConsoleLogEntry, 'id' | 'timestamp'>): void {
  logs = [
    ...logs,
    {
      id: nextId(),
      timestamp: new Date(),
      ...entry,
    },
  ].slice(-500);

  notify();
}

export function clearConsoleLogs(): void {
  if (logs.length === 0) return;
  logs = [];
  notify();
}

// Clear only Roblox redirect logs
export function clearRobloxLogs(): void {
  const robloxLogs = logs.filter(log => log.source === 'roblox');
  if (robloxLogs.length === 0) return;
  logs = logs.filter(log => log.source !== 'roblox');
  notify();
}

export function getConsoleLogs(): ConsoleLogEntry[] {
  return [...logs];
}

// Get only Roblox redirect logs (for OutputTab)
export function getRobloxLogs(): ConsoleLogEntry[] {
  return logs.filter(log => log.source === 'roblox');
}

export function subscribeToConsoleLogs(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}