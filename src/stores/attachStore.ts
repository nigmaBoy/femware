import { invoke } from '@tauri-apps/api/core';
import { getAutoInject } from './autoInjectStore';

type AttachState = 'detached' | 'attaching' | 'attached';

export interface RobloxProcess {
  pid: number;
  name: string;
  username?: string;
}

interface AttachStore {
  state: AttachState;
  dmaMode: boolean;
  selectedPids: number[];
  processes: RobloxProcess[];
  attachedProcesses: RobloxProcess[];
  hasAttached: boolean;
}

let store: AttachStore = {
  state: 'detached',
  dmaMode: false,
  selectedPids: [],
  processes: [],
  attachedProcesses: [],
  hasAttached: false,
};

// Guard: only allow state to become 'attached' when the user explicitly
// clicks Attach. refreshProcesses must never flip this.
let _attachedByUser = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getAttachState(): AttachState {
  return store.state;
}

export function isDmaMode(): boolean {
  return false;
}

export function getProcesses(): RobloxProcess[] {
  return store.processes;
}

export function getAttachedProcesses(): RobloxProcess[] {
  return store.attachedProcesses;
}

export function getSelectedPids(): number[] {
  return store.selectedPids;
}

export function getHasAttached(): boolean {
  return store.hasAttached;
}

export function setHasAttached(value: boolean): void {
  store = { ...store, hasAttached: value };
  notify();
}

export function setSelectedPids(pids: number[]): void {
  store = { ...store, selectedPids: pids };
  notify();
}

export function togglePid(pid: number): void {
  const current = store.selectedPids;
  const next = current.includes(pid)
    ? current.filter((p) => p !== pid)
    : [...current, pid];
  store = { ...store, selectedPids: next };
  notify();
}

export function selectAllPids(): void {
  store = { ...store, selectedPids: store.processes.map((p) => p.pid) };
  notify();
}

export function deselectAllPids(): void {
  store = { ...store, selectedPids: [] };
  notify();
}

export async function refreshProcesses(): Promise<void> {
  try {
    const processes = await invoke<RobloxProcess[]>('get_roblox_processes');
    const validPids = new Set(processes.map((p) => p.pid));
    const selectedPids = store.selectedPids.filter((pid) => validPids.has(pid));
    const attachedProcesses = store.attachedProcesses.filter((p) => validPids.has(p.pid));

    // Auto-inject: if a new Roblox instance appears while we're attached, pull it in automatically
    if (getAutoInject() && store.state === 'attached') {
      const attachedPidSet = new Set(store.attachedProcesses.map(p => p.pid));
      const newProcesses = processes.filter(p => !attachedPidSet.has(p.pid));
      if (newProcesses.length > 0) {
        // Inject Cosmic into each new instance
        for (const proc of newProcesses) {
          try {
            await invoke<number>('inject_into_pid', { pid: proc.pid });
          } catch {
            // Non-fatal — instance may already be injected or closing
          }
        }
        const mergedAttached = [...attachedProcesses, ...newProcesses];
        const mergedSelected = [...new Set([...selectedPids, ...newProcesses.map(p => p.pid)])];
        store = { ...store, processes, selectedPids: mergedSelected, attachedProcesses: mergedAttached };
        notify();
        return;
      }
    }

    store = { ...store, processes, selectedPids, attachedProcesses };
    notify();
  } catch {
    store = { ...store, processes: [], selectedPids: [], attachedProcesses: [] };
    notify();
  }
}

export function subscribeAttach(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startAttaching(): void {
  store = { ...store, state: 'attaching' };
  notify();
}

export async function setAttached(): Promise<void> {
  if (!_attachedByUser) return;
  store = { ...store, state: 'attached', dmaMode: false, hasAttached: true };
  notify();

  try {
    await invoke('start_vscode_server');
  } catch {}
}

export async function setDetached(): Promise<void> {
  _attachedByUser = false;
  store = { ...store, state: 'detached', dmaMode: false, hasAttached: false, attachedProcesses: [] };
  notify();

  try {
    await invoke('stop_vscode_server');
  } catch {}
}

// Cosmic exit code 6 = success (mirrors Cosmic C# GetAttachStatusMessage)
const COSMIC_SUCCESS_EXIT_CODE = 6;

export async function performAttach(invokeFunc: () => Promise<void>): Promise<void> {
  try {
    _attachedByUser = true;
    startAttaching();

    const processes = await invoke<RobloxProcess[]>('get_roblox_processes');

    if (processes.length === 0) {
      await setDetached();
      throw new Error('No Roblox instances found');
    }

    await invokeFunc();

    // Inject Cosmic into every detected Roblox instance.
    // inject_into_pid runs Cosmic-Injector.exe <pid> and returns the exit code.
    // Exit code 6 = success. We don't hard-fail on individual PID injection
    // failures — the instance may already be injected or closing.
    const injectedProcesses: RobloxProcess[] = [];
    const injectionErrors: string[] = [];

    for (const proc of processes) {
      try {
        const exitCode = await invoke<number>('inject_into_pid', { pid: proc.pid });
        if (exitCode === COSMIC_SUCCESS_EXIT_CODE) {
          injectedProcesses.push(proc);
        } else {
          // Exit codes other than 6 are failures but we still track them so
          // the user can see them in the instances tab rather than silently dropping them.
          // The injector may still have partially succeeded (e.g. already injected = 1).
          injectedProcesses.push(proc);
          injectionErrors.push(`PID ${proc.pid}: exit code ${exitCode}`);
        }
      } catch (err) {
        injectionErrors.push(`PID ${proc.pid}: ${err}`);
      }
    }

    if (injectedProcesses.length === 0) {
      await setDetached();
      const detail = injectionErrors.join(', ');
      throw new Error(`Cosmic injection failed for all instances. ${detail}`);
    }

    const allPids = injectedProcesses.map(p => p.pid);

    store = {
      ...store,
      state: 'attached',
      processes,
      attachedProcesses: injectedProcesses,
      selectedPids: allPids,
      dmaMode: false,
      hasAttached: true,
    };
    notify();

    try {
      await invoke('start_vscode_server');
    } catch {}
  } catch (err) {
    await setDetached();
    throw err;
  }
}

export async function executeScript(script: string): Promise<void> {
  if (store.state !== 'attached') {
    throw new Error('No client attached');
  }

  let pids = store.selectedPids;

  if (pids.length === 0) {
    pids = store.processes.map(p => p.pid);
  }

  if (pids.length === 0) {
    throw new Error('No attached instances');
  }

  // Always use execute_script_redirected so the print/warn override wrapper is
  // always injected. The redirect_output setting only controls whether the
  // OutputTab renders the logs — it does NOT affect whether the hook is installed.
  // Using execute_script (no wrapper) would leave print/warn unhooked, breaking
  // output entirely when redirect is off.
  await invoke('execute_script_redirected', { script, pids });
}