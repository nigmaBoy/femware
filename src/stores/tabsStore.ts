import { loadPersistedJson, savePersistedJson } from './persistedJson';

export interface Tab {
  id: number;
  name: string;
  content: string;
}

interface TabsState {
  tabs: Tab[];
  activeTabId: number;
  sidebarWidth: number;
  sidebarOpen: boolean;
  consoleHeight: number;
  accordionOpen: Record<string, boolean>;
}

const SETTINGS_FILE = 'tabs.json';

let state: TabsState = {
  tabs: [{ id: 0, name: 'Untitled 0', content: '' }],
  activeTabId: 0,
  sidebarWidth: 276,
  sidebarOpen: true,
  consoleHeight: 115,
  accordionOpen: {
    'Local Files': true,
    'Auto Execute': false,
    'Fem Cloud (Auto-Saved)': false,
  },
};

let listeners = new Set<() => void>();
let initialized = false;

function notify(): void {
  listeners.forEach(l => l());
}

function getState(): TabsState {
  return { 
    ...state, 
    tabs: [...state.tabs],
    accordionOpen: { ...state.accordionOpen },
  };
}

export async function loadTabs(): Promise<TabsState> {
  if (initialized) {
    return getState();
  }

  try {
    const loaded = await loadPersistedJson<TabsState | null>(SETTINGS_FILE, null);
    if (loaded && loaded.tabs && loaded.tabs.length > 0) {
      state = {
        ...loaded,
        sidebarWidth: loaded.sidebarWidth ?? 276,
        sidebarOpen: loaded.sidebarOpen ?? true,
        consoleHeight: loaded.consoleHeight ?? 115,
        accordionOpen: loaded.accordionOpen || state.accordionOpen,
      };
    } else {
      await savePersistedJson(SETTINGS_FILE, state);
    }
  } catch (e) {
    console.error('Failed to load tabs:', e);
  }

  initialized = true;
  notify();
  return getState();
}

export async function saveTabs(newState: Partial<TabsState>): Promise<void> {
  state = { 
    ...state, 
    ...newState,
    accordionOpen: newState.accordionOpen ? { ...state.accordionOpen, ...newState.accordionOpen } : state.accordionOpen,
  };
  notify();

  try {
    await savePersistedJson(SETTINGS_FILE, state);
  } catch (e) {
    console.error('Failed to save tabs:', e);
  }
}

export function getTabs(): Tab[] {
  return [...state.tabs];
}

export function getActiveTabId(): number {
  return state.activeTabId;
}

export function getSidebarWidth(): number {
  return state.sidebarWidth;
}

export function getSidebarOpen(): boolean {
  return state.sidebarOpen;
}

export function getConsoleHeight(): number {
  return state.consoleHeight;
}

export function getAccordionOpen(section: string): boolean {
  return state.accordionOpen[section] ?? false;
}

export function subscribeToTabs(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
