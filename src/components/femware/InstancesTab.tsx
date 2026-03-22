import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getSessions, subscribeToSessions, loadInstanceSessions, InstanceSessionInfo } from '../../stores/instanceSessionStore';
import { subscribeAttach, getAttachedProcesses, getSelectedPids, setSelectedPids, togglePid, getAttachState, executeScript } from '../../stores/attachStore';
import { saveTabs, loadTabs } from '../../stores/tabsStore';
import { useFemTheme } from '../../context/themeContext';

let _useAll = true;
let _initialized = false;

function getModuleUseAll() { return _useAll; }

async function loadUseAllFromDisk(): Promise<boolean> {
  if (_initialized) return _useAll;
  try {
    const state = await loadTabs() as any;
    if (state?.instancesUseAll !== undefined) _useAll = state.instancesUseAll as boolean;
  } catch {}
  _initialized = true;
  return _useAll;
}

function saveUseAllToDisk(useAll: boolean, selectedPids: number[]) {
  (saveTabs as any)({ instancesUseAll: useAll, instancesSelectedPids: useAll ? [] : selectedPids });
}

// PillToggle subscribes to theme context so it re-renders whenever theme changes
function PillToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { derived } = useFemTheme();
  const [animKey, setAnimKey] = useState(0);
  return (
    <>
      <style>{`.pill-knob-anim { animation: knobPop 0.22s ease forwards; }`}</style>
      <div onClick={e => { e.stopPropagation(); setAnimKey(k => k+1); onToggle(); }}
        style={{
          width: 34, height: 18, borderRadius: 9, padding: 3, boxSizing: 'border-box',
          background: on ? derived.base : derived.a18,
          border: `1px solid ${on ? derived.a65 : derived.a30}`,
          boxShadow: on
            ? `inset 0 0 8px ${derived.a45}, 0 0 6px ${derived.a40}`
            : `inset 0 0 5px ${derived.a20}`,
          cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          display: 'flex', alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start', flexShrink: 0,
        }}>
        <div key={animKey} className={animKey > 0 ? 'pill-knob-anim' : ''}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: on ? '#fff' : derived.a30,
            boxShadow: on ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            transition: 'background 0.2s', flexShrink: 0,
          }} />
      </div>
    </>
  );
}

function FemBtn({ label, onClick, disabled, variant = 'default', small }: {
  label: string; onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean; variant?: 'default' | 'danger' | 'success'; small?: boolean;
}) {
  const { derived } = useFemTheme();
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  const isSuccess = variant === 'success';
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      style={{
        padding: small ? '3px 10px' : '0 14px', height: small ? 26 : 32,
        borderRadius: 8, fontSize: small ? 10 : 11, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        transition: 'all .15s',
        color: isSuccess ? '#81c784' : (hov || press) ? 'var(--fem-base)' : 'var(--fem-muted)',
        background: derived.islandBg,
        border: isSuccess ? '1px solid rgba(129,199,132,0.4)' : '1px solid var(--fem-a30)',
        boxShadow: isSuccess ? 'inset 0 0 16px rgba(129,199,132,0.3)' : press ? 'var(--fem-inset-md)' : 'var(--fem-glow-sm)',
        outline: 'none', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
      }}>{label}</button>
  );
}

export function InstancesTab() {
  const { islandStyle, derived } = useFemTheme();
  const [sessions, setSessions]              = useState<Record<number, InstanceSessionInfo>>({});
  const [processes, setProcesses]            = useState<{ pid: number }[]>([]);
  const [selectedPids, setSelectedPidsState] = useState<number[]>([]);
  const [useAll, setUseAllState]             = useState<boolean>(getModuleUseAll);
  const [attachState, setAttachState]        = useState<'detached'|'attaching'|'attached'>('detached');
  const [terminatingPids, setTerminatingPids]= useState<Set<number>>(new Set());
  const [copiedPids, setCopiedPids]          = useState<Set<number>>(new Set());
  const useAllRef = useRef(_useAll);

  const applyState = (newUseAll: boolean, newPids: number[]) => {
    _useAll = newUseAll; useAllRef.current = newUseAll;
    setUseAllState(newUseAll); setSelectedPidsState(newPids);
    setSelectedPids(newPids); saveUseAllToDisk(newUseAll, newPids);
  };

  useEffect(() => {
    let unsubSessions: (()=>void)|null = null;
    let unsubAttach: (()=>void)|null = null;
    let poll: ReturnType<typeof setInterval>|null = null;
    (async () => {
      loadInstanceSessions(); setSessions(getSessions());
      const procs = getAttachedProcesses(); setProcesses(procs); setAttachState(getAttachState());
      const savedUseAll = await loadUseAllFromDisk();
      if (savedUseAll) {
        _useAll = true; useAllRef.current = true; setUseAllState(true);
        const allPids = procs.map(p => p.pid); setSelectedPidsState(allPids); setSelectedPids(allPids);
      } else {
        _useAll = false; useAllRef.current = false; setUseAllState(false);
        setSelectedPidsState(getSelectedPids());
      }
      unsubSessions = subscribeToSessions(() => setSessions(getSessions()));
      unsubAttach = subscribeAttach(() => {
        const np = getAttachedProcesses(); setProcesses(np); setAttachState(getAttachState());
        if (useAllRef.current) { const ap = np.map(p=>p.pid); setSelectedPidsState(ap); setSelectedPids(ap); }
      });
      poll = setInterval(() => {
        const np = getAttachedProcesses(); setProcesses(np); setAttachState(getAttachState()); setSessions(getSessions());
        if (useAllRef.current) { const ap = np.map(p=>p.pid); setSelectedPidsState(ap); setSelectedPids(ap); }
      }, 3000);
    })();
    return () => { unsubSessions?.(); unsubAttach?.(); if (poll) clearInterval(poll); };
  }, []);

  const handleToggleAll = () => {
    if (useAllRef.current) applyState(false, []);
    else applyState(true, getAttachedProcesses().map(p=>p.pid));
  };
  const handleToggleInstance = (pid: number) => {
    if (useAllRef.current) { applyState(false, [pid]); return; }
    togglePid(pid);
    const next = getSelectedPids();
    if (next.length === 0) applyState(true, getAttachedProcesses().map(p=>p.pid));
    else applyState(false, [...next]);
  };
  const handleTerminate = async (pid: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTerminatingPids(p => new Set(p).add(pid));
    try { await invoke('terminate_roblox_process', { pid }); } catch {}
    setTerminatingPids(p => { const n=new Set(p); n.delete(pid); return n; });
  };
  const handleCopyJoinScript = async (session: InstanceSessionInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    const script = `game:GetService("TeleportService"):TeleportToPlaceInstance(${session.gameId}, "${session.jobId}")`;
    try {
      await navigator.clipboard.writeText(script);
      setCopiedPids(p => new Set(p).add(session.pid));
      setTimeout(() => setCopiedPids(p => { const n=new Set(p); n.delete(session.pid); return n; }), 2000);
    } catch {}
  };

  const REJOIN_SCRIPT = `
local TeleportService = game:GetService("TeleportService")
local Players = game:GetService("Players")
TeleportService:Teleport(game.PlaceId, Players.LocalPlayer)
`;

  const SERVER_HOP_SCRIPT = `
local TeleportService = game:GetService("TeleportService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local function getServers(cursor)
  local url = "https://games.roblox.com/v1/games/" .. game.PlaceId .. "/servers/Public?sortOrder=Asc&limit=100"
  if cursor and cursor ~= "" then url = url .. "&cursor=" .. cursor end
  local ok, res = pcall(function() return HttpService:GetAsync(url) end)
  if not ok then return nil end
  local ok2, data = pcall(function() return HttpService:JSONDecode(res) end)
  if not ok2 then return nil end
  return data
end

local function hop()
  local cursor = nil
  local tried = {}
  tried[game.JobId] = true
  for attempt = 1, 10 do
    local data = getServers(cursor)
    if not data or not data.data then break end
    for _, server in ipairs(data.data) do
      if not tried[server.id] and server.playing < server.maxPlayers then
        tried[server.id] = true
        local ok = pcall(function()
          TeleportService:TeleportToPlaceInstance(game.PlaceId, server.id, Players.LocalPlayer)
        end)
        if ok then return end
      end
    end
    cursor = data.nextPageCursor
    if not cursor then cursor = nil; break end
    task.wait(0.5)
  end
  -- fallback: just rejoin a new server
  TeleportService:Teleport(game.PlaceId, Players.LocalPlayer)
end

hop()
`;

  const handleRejoinAll = async () => {
    const pids = getSelectedPids();
    if (pids.length === 0) return;
    try { await executeScript(REJOIN_SCRIPT); } catch {}
  };

  const handleServerHopAll = async () => {
    const pids = getSelectedPids();
    if (pids.length === 0) return;
    try { await executeScript(SERVER_HOP_SCRIPT); } catch {}
  };

  const showInstances = attachState === 'attached';

  return (
    <div style={{ ...islandStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 44, borderBottom: '1px solid var(--fem-a15)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--fem-dark)', fontSize: 13, fontWeight: 600 }}>Instances</span>
          {showInstances && (
            <span style={{ background: 'var(--fem-a20)', boxShadow: 'inset 0 0 8px var(--fem-a40)', color: 'var(--fem-darker)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--fem-a25)' }}>{processes.length}</span>
          )}
          <div style={{ width: 1, height: 16, background: 'var(--fem-a20)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }} onClick={handleToggleAll}>
            <PillToggle on={useAll} onToggle={handleToggleAll} />
            <span style={{ fontSize: 11, fontWeight: 500, color: useAll ? 'var(--fem-darker)' : 'var(--fem-muted)', transition: 'color .2s' }}>Use All</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <FemBtn label="Rejoin All" onClick={handleRejoinAll} />
          <FemBtn label="Server Hop All" onClick={handleServerHopAll} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 12px' }}>
        {!showInstances ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <p style={{ color: 'var(--fem-dim)', fontSize: 13, fontWeight: 500, margin: 0 }}>Click "Attach" to see instances</p>
          </div>
        ) : processes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <span style={{ fontSize: 28, opacity: 0.4 }}>🎀</span>
            <p style={{ color: 'var(--fem-dim)', fontSize: 13, fontWeight: 500, margin: 0 }}>No instances found</p>
            <p style={{ color: 'var(--fem-dim)', fontSize: 11, margin: 0 }}>Open Roblox to see instances here</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {processes.map(proc => {
              const session = sessions[proc.pid];
              const instanceOn = useAll ? false : selectedPids.includes(proc.pid);
              const isTerminating = terminatingPids.has(proc.pid);
              const isCopied = copiedPids.has(proc.pid);
              return (
                <div key={proc.pid} style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  padding: '12px 12px 10px', borderRadius: 12,
                  transition: 'background 0.25s, box-shadow 0.25s, border-color 0.25s',
                  background: instanceOn ? derived.a12 : derived.islandBg,
                  border: `1px solid ${instanceOn ? derived.a45 : derived.a28}`,
                  boxShadow: instanceOn
                    ? `inset 0 0 22px ${derived.a40}, 0 6px 20px ${derived.a22}, 0 2px 6px ${derived.a15}`
                    : `inset 0 0 16px ${derived.a18}, 0 4px 14px ${derived.a15}, 0 2px 5px ${derived.a12}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: derived.a08, overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid var(--fem-a35)',
                      boxShadow: 'inset 0 0 10px var(--fem-a30)',
                    }}>
                      {session?.avatarUrl
                        ? <img src={session.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        : <span style={{ color: 'var(--fem-dim)', fontSize: 10 }}>?</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--fem-darker)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                        {session?.displayName || 'Unknown'}
                      </div>
                      <div style={{ color: 'var(--fem-muted)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>
                        @{session?.username || 'unknown'}
                      </div>
                    </div>
                    <PillToggle on={instanceOn} onToggle={() => handleToggleInstance(proc.pid)} />
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--fem-dim)', fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    padding: '4px 8px', background: 'var(--fem-a08)',
                    borderRadius: 6, border: '1px solid var(--fem-a15)',
                  }}>{session?.gameName || 'Unknown Game'}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <FemBtn label={isCopied ? '✓ Copied!' : 'Copy Join'} variant={isCopied ? 'success' : 'default'} small disabled={!session?.jobId} onClick={e => session && handleCopyJoinScript(session, e)} />
                    <FemBtn label={isTerminating ? 'Ending…' : 'Terminate'} variant="danger" small disabled={isTerminating} onClick={e => handleTerminate(proc.pid, e)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}