import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { getAttachState, getProcesses, subscribeAttach, refreshProcesses, performAttach, executeScript, getSelectedPids } from '../../stores/attachStore';
import { appendConsoleLog, clearConsoleLogs, getConsoleLogs, subscribeToConsoleLogs } from '../../stores/consoleStore';
import { loadTabs, saveTabs } from '../../stores/tabsStore';
import { setSession, removeSession, getSessions, loadInstanceSessions } from '../../stores/instanceSessionStore';
import { useFemTheme } from '../../context/themeContext';
import { SYNTAX_THEMES, DEFAULT_SYNTAX_THEME } from '../../constants/syntaxThemes';

import sidebarIcon   from '../../assets/sidebar.png';
import downArrowIcon from '../../assets/down-arrow.png';
import folderIcon    from '../../assets/folder.png';
import branchIcon    from '../../assets/branch.png';
import cloudIcon     from '../../assets/fem-cloud.png';
import blankPageIcon from '../../assets/blank-page.png';

interface FileTab     { id: number; name: string; content: string; }
interface ScriptEntry { id: number; name: string; content: string; }
interface Props { sidebarOpen: boolean; setSidebarOpen: (v: boolean | ((p: boolean) => boolean)) => void; }

const SAMPLE = `if IY_LOADED and not _G.IY_DEBUG == true then
  -- error("Infinite Yield is already running!")
  return
end

pcall(function() getgenv().IY_LOADED = true end)

local cloneref = cloneref or function(o) return o end
COREGUI = cloneref(game:GetService("CoreGui"))
Players = cloneref(game:GetService("Players"))

if not game:IsLoaded() then
  local notLoaded = Instance.new("Message")
  notLoaded.Parent = COREGUI
  notLoaded.Text = "Infinite Yield is waiting for the game to load"
  game.Loaded:Wait()
  notLoaded:Destroy()
end

currentVersion = "6.3.1"

ScaledHolder = Instance.new("Frame")
Scale = Instance.new("UIScale")
Holder = Instance.new("Frame")
Title = Instance.new("TextLabel")`;

// ── Mask-image icon — backgroundColor tracks full HSL (hue + sat + lit) ─────
function Icon({ src, size, active }: { src: string; size: number; active?: boolean }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      backgroundColor: active ? 'var(--fem-base)' : 'var(--fem-muted)',
      WebkitMaskImage: `url(${src})`,
      WebkitMaskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskImage: `url(${src})`,
      maskSize: 'contain',
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      pointerEvents: 'none',
      transition: 'background-color 0.2s',
    }} />
  );
}

// ── Syntax highlighter ────────────────────────────────────────────────────────
function hl(raw: string): string {
  let s = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/(--[^\n]*)/g,'<span class="fw-cmt">$1</span>');
  s = s.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,'<span class="fw-str">$1</span>');
  s = s.replace(/(?<![">])\b(if|then|else|elseif|end|local|function|return|for|while|do|not|and|or|in|true|false|nil)\b(?![^<]*>)/g,'<span class="fw-kw">$1</span>');
  s = s.replace(/(?<![">])\b(\d+\.?\d*)\b(?![^<]*>)/g,'<span class="fw-num">$1</span>');
  s = s.replace(/(?<![">])\b([a-zA-Z_]\w*)\s*\((?![^<]*>)/g,'<span class="fw-fn">$1</span>(');
  return s;
}

// ── Accordion ─────────────────────────────────────────────────────────────────
function AccordionSection({ label, icon, isOpen, onToggle, children }: {
  label: string; icon?: string; isOpen?: boolean; onToggle?: (open: boolean) => void; children?: React.ReactNode;
}) {
  const { derived } = useFemTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen ?? internalOpen;
  const handleToggle = (v: boolean) => { if (onToggle) onToggle(v); else setInternalOpen(v); };


  return (
    <div style={{ marginBottom: 4, marginTop: 8 }}>
      <button onClick={() => handleToggle(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 10px', border: '1px solid var(--fem-a30)', borderRadius: 12,
        fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .2s',
        background: derived.islandBg,
        boxShadow: open ? 'var(--fem-inset-md)' : 'var(--fem-glow-sm)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: open ? 'var(--fem-darker)' : 'var(--fem-muted)' }}>
          {icon && <Icon src={icon} size={16} active={open} />}
          <span>{label}</span>
        </span>
        {/* Mask-image div so it tracks var(--fem-base)/var(--fem-muted) — responds to hue, sat AND lit */}
        <div style={{
          width: 16, height: 16, flexShrink: 0,
          backgroundColor: open ? 'var(--fem-base)' : 'var(--fem-muted)',
          WebkitMaskImage: `url(${downArrowIcon})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskImage: `url(${downArrowIcon})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          borderRadius: 3,
          transform: open ? '' : 'rotate(180deg)',
          transition: 'background-color 0.2s, transform 0.25s',
          pointerEvents: 'none',
        }} />
      </button>
      {open && <div style={{ padding: '4px 0' }}>{children}</div>}
    </div>
  );
}

// ── ScriptRow ─────────────────────────────────────────────────────────────────
function ScriptRow({ name, selected, onSelect, onDelete }: {
  name: string; selected: boolean; onSelect: () => void; onDelete?: () => void;
}) {
  const { derived } = useFemTheme();
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', cursor: 'pointer', borderRadius: 6,
        fontSize: 12, fontWeight: 500, transition: 'all .15s',
        color: selected ? 'var(--fem-darker)' : hov ? 'var(--fem-dark)' : 'var(--fem-dim)',
        background: selected ? derived.islandBg : hov ? derived.a08 : 'transparent',
        boxShadow: selected ? `inset 0 0 12px ${derived.a40}` : hov ? `inset 0 0 8px ${derived.a28}` : 'none',
        border: selected ? `1px solid ${derived.a20}` : '1px solid transparent',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Icon src={blankPageIcon} size={13} active={selected || hov} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </span>
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fem-muted)', fontSize: 14, padding: '0 2px', marginLeft: 4, lineHeight: 1, flexShrink: 0 }}>
          ×
        </button>
      )}
    </div>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────
function ActionBtn({ label, onClick, disabled }: {
  label: string; primary?: boolean; onClick?: () => void; disabled?: boolean;
}) {
  const { derived } = useFemTheme();
  const [hov, setHov]       = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: '0 14px', height: 36, borderRadius: 12,
        fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'all .15s',
        color: (hov || active) ? 'var(--fem-base)' : 'var(--fem-muted)',
        background: derived.islandBg,
        border: '1px solid var(--fem-a30)',
        boxShadow: active ? 'var(--fem-inset-md)' : 'var(--fem-glow-sm)',
        opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
      }}
    >{label}</button>
  );
}

// ── EditorTab ─────────────────────────────────────────────────────────────────
export function EditorTab({ sidebarOpen, setSidebarOpen }: Props) {
  const { islandStyle, derived, theme } = useFemTheme();

  // Resolve the active syntax theme colours — fall back to DEFAULT_SYNTAX_THEME if unset
  const activeSyntaxTheme = SYNTAX_THEMES.find(t => t.label === ((theme as any).syntaxTheme ?? DEFAULT_SYNTAX_THEME))
    ?? SYNTAX_THEMES.find(t => t.label === DEFAULT_SYNTAX_THEME)!;

  const [tabs, setTabs]               = useState<FileTab[]>([
    { id: 0, name: 'Untitled 0', content: '' },
    { id: 1, name: 'script.lua', content: SAMPLE },
  ]);
  const [activeTabId, setActiveTabId] = useState(0);

  useEffect(() => {
    loadTabs().then(state => {
      setTabs(state.tabs);
      setActiveTabId(state.activeTabId);
      setSidebarWidth(state.sidebarWidth);
      setConsoleHeight(state.consoleHeight);
      setAccordionOpen(state.accordionOpen);
    });
  }, []);

  const handleTabsChange = useCallback((newTabs: FileTab[], newActiveTabId: number) => {
    setTabs(newTabs); setActiveTabId(newActiveTabId);
    saveTabs({ tabs: newTabs, activeTabId: newActiveTabId });
  }, []);

  const [ctxTabId,        setCtxTabId]        = useState<number|null>(null);
  const [ctxPos,          setCtxPos]          = useState({ x: 0, y: 0 });
  const [ctxOpen,         setCtxOpen]         = useState(false);
  const [renamingTabId,   setRenamingTabId]   = useState<number|null>(null);
  const [renameValue,     setRenameValue]     = useState('');
  const [draggedTabId,    setDraggedTabId]    = useState<number|null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number|null>(null);
  // per-tab hover tracking so inactive tabs respond correctly
  const [hoveredTabId,    setHoveredTabId]    = useState<number|null>(null);
  const dragStartPos   = useRef({ x: 0, y: 0 });
  const renameInputRef = useRef<HTMLInputElement>(null);
  const tabsScrollRef  = useRef<HTMLDivElement>(null);

  const attachState   = useSyncExternalStore(subscribeAttach, getAttachState);
  const processes     = useSyncExternalStore(subscribeAttach, getProcesses);
  const isAttached    = attachState === 'attached';
  const isAttaching   = attachState === 'attaching';
  const instanceCount = processes.length;

  const [consoleLogs, setConsoleLogs] = useState<{ id: string; level: string; message: string; timestamp: Date }[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [sessionInfo, setSessionInfo] = useState<Record<number, any>>({});

  const fetchSessionInfo = useCallback(async (procs: typeof processes) => {
    const SCRIPT = (pid: number) => `local pid=${pid}\nlocal P=game:GetService("Players")\nlocal M=game:GetService("MarketplaceService")\nlocal H=game:GetService("HttpService")\nlocal lp=P.LocalPlayer\nlocal ok,thumb=pcall(function() return P:GetUserThumbnailAsync(lp.UserId,Enum.ThumbnailType.HeadShot,Enum.ThumbnailSize.Size100x100) end)\nlocal ok2,gn=pcall(function() return M:GetProductInfo(game.PlaceId).Name end)\nlocal info=H:JSONEncode({pid=pid,username=lp.Name,displayName=lp.DisplayName,gameName=ok2 and gn or"Unknown",gameId=game.PlaceId,jobId=game.JobId,userId=lp.UserId,avatarUrl=ok and thumb or""})\nmakefolder("SynzInfo")\nwritefile("SynzInfo/"..pid..".txt",info)`;
    for (const proc of procs) {
      try { await invoke('execute_script', { script: SCRIPT(proc.pid), pids: [proc.pid] }); } catch {}
    }
    setTimeout(async () => {
      for (const proc of procs) {
        try {
          const content = await readTextFile(`C:\\Users\\anton\\AppData\\Local\\Synapse Z\\workspace\\SynzInfo\\${proc.pid}.txt`);
          const info = JSON.parse(content);
          let avatarUrl = '';
          try { avatarUrl = await invoke<string>('fetch_roblox_avatar', { userId: info.userId }); } catch {}
          setSession(info.pid, { ...info, avatarUrl });
        } catch {}
      }
    }, 1500);
  }, []);

  const addLog = useCallback((level: string, message: string) => {
    const v = ['info','warning','error','success','status'].includes(level) ? level as any : 'info';
    appendConsoleLog({ level: v, message, source: 'femware' });
  }, []);

  useEffect(() => {
    const getFem = () => getConsoleLogs().filter((l: any) => l.source === 'femware');
    setConsoleLogs(getFem());
    return subscribeToConsoleLogs(() => setConsoleLogs(getFem()));
  }, []);

  useEffect(() => { if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight; }, [consoleLogs]);

  useEffect(() => {
    if (isAttached && processes.length > 0) {
      const newProcs = processes.filter(p => !sessionInfo[p.pid]);
      if (newProcs.length > 0) fetchSessionInfo(newProcs);
    }
  }, [processes, isAttached, sessionInfo, fetchSessionInfo]);

  useEffect(() => {
    const cur = new Set(processes.map(p => p.pid));
    Object.keys(getSessions()).map(Number).filter(pid => !cur.has(pid)).forEach(pid => removeSession(pid));
  }, [processes]);

  useEffect(() => { loadInstanceSessions().then(() => setSessionInfo(getSessions())); }, []);
  useEffect(() => { refreshProcesses(); const id = setInterval(refreshProcesses, 3000); return () => clearInterval(id); }, []);
  useEffect(() => { if (renamingTabId !== null) { renameInputRef.current?.focus(); renameInputRef.current?.select(); } }, [renamingTabId]);

  const [sidebarWidth,  setSidebarWidth]  = useState(276);
  const sbResizing    = useRef(false);
  const sbResizeStart = useRef({ x: 0, w: 0 });

  const [consoleHeight, setConsoleHeight] = useState(115);
  const [consoleOpen,   setConsoleOpen]   = useState(true);
  const conResizing    = useRef(false);
  const conResizeStart = useRef({ y: 0, h: 0 });

  const [accordionOpen, setAccordionOpen] = useState<Record<string,boolean>>({
    'Local Files': true, 'Auto Execute': false, 'Fem Cloud': false,
  });
  const [localScripts, setLocalScripts] = useState<ScriptEntry[]>([]);
  const [autoExec,     setAutoExec]     = useState<ScriptEntry[]>([]);
  const [cloudScripts, setCloudScripts] = useState<ScriptEntry[]>([]);

  useEffect(() => {
    const loadLocal = async () => {
      try {
        const entries = await readDir('C:\\Users\\anton\\AppData\\Local\\Synapse Z\\Scripts');
        const scripts: ScriptEntry[] = [];
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (e.name && (e.name.endsWith('.lua') || e.name.endsWith('.luau') || e.name.endsWith('.txt'))) {
            try { scripts.push({ id: Date.now()+i, name: e.name, content: await readTextFile('C:\\Users\\anton\\AppData\\Local\\Synapse Z\\Scripts\\' + e.name) }); } catch {}
          }
        }
        setLocalScripts(scripts);
      } catch { setLocalScripts([]); }
    };
    const loadAuto = async () => {
      try {
        const entries = await readDir('C:\\Users\\anton\\AppData\\Local\\Synapse Z\\autoexec');
        const scripts: ScriptEntry[] = [];
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (e.name && (e.name.endsWith('.lua') || e.name.endsWith('.luau') || e.name.endsWith('.txt'))) {
            try { scripts.push({ id: Date.now()+i, name: e.name, content: await readTextFile('C:\\Users\\anton\\AppData\\Local\\Synapse Z\\autoexec\\' + e.name) }); } catch {}
          }
        }
        setAutoExec(scripts);
      } catch {}
    };
    const loadCloud = async () => {
      const saved = await loadTabs();
      setCloudScripts(saved.tabs.map((t, i) => ({ id: 10000+i, name: t.name, content: t.content })));
    };
    loadLocal(); loadAuto(); loadCloud();
  }, []);

  const codeScrollRef = useRef<HTMLDivElement>(null);
  const lineNumRef    = useRef<HTMLDivElement>(null);
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const lines     = (activeTab?.content || '').split('\n');
  const selLocal  = localScripts.find(s => s.name === activeTab?.name)?.id ?? null;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (sbResizing.current)  setSidebarWidth( Math.max(160, Math.min(400, sbResizeStart.current.w + e.clientX - sbResizeStart.current.x)));
      if (conResizing.current) setConsoleHeight(Math.max(50,  Math.min(320, conResizeStart.current.h - (e.clientY - conResizeStart.current.y))));
    };
    const onUp = () => {
      if (sbResizing.current)  saveTabs({ sidebarWidth });
      if (conResizing.current) saveTabs({ consoleHeight });
      sbResizing.current = false; conResizing.current = false;
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [sidebarWidth, consoleHeight]);

  useEffect(() => {
    const el = tabsScrollRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Tab drag — exact original logic restored
  useEffect(() => {
    if (draggedTabId === null) return;
    const draggedIdx = tabs.findIndex(t => t.id === draggedTabId);

    const onMove = (e: MouseEvent) => {
      const el = tabsScrollRef.current; if (!el) return;
      const tabElements  = Array.from(el.children);
      const containerRect = el.getBoundingClientRect();

      if (e.clientX > containerRect.right) {
        if (dropTargetIndex !== tabs.length) setDropTargetIndex(tabs.length);
        return;
      }

      let newTarget: number | null = null;
      for (let idx = 0; idx < tabElements.length; idx++) {
        const r   = tabElements[idx].getBoundingClientRect();
        const mid = (r.left + r.right) / 2;
        if (e.clientX < mid) { newTarget = idx; break; }
        newTarget = idx + 1;
      }
      if (newTarget !== null) {
        newTarget = Math.max(0, Math.min(newTarget, tabs.length));
        if (newTarget !== dropTargetIndex) setDropTargetIndex(newTarget);
      }
    };

    const onUp = () => {
      if (draggedTabId !== null && dropTargetIndex !== null && draggedIdx !== -1) {
        let toIdx = dropTargetIndex;
        if (draggedIdx < toIdx) toIdx = toIdx - 1;
        if (toIdx < 0) toIdx = 0;
        if (toIdx >= tabs.length) toIdx = tabs.length - 1;
        if (draggedIdx !== toIdx) {
          const newTabs = [...tabs];
          const [moved] = newTabs.splice(draggedIdx, 1);
          newTabs.splice(toIdx, 0, moved);
          setTabs(newTabs);
          saveTabs({ tabs: newTabs, activeTabId });
        }
      }
      setDraggedTabId(null);
      setDropTargetIndex(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',  onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggedTabId, dropTargetIndex, tabs, activeTabId]);

  function updateContent(content: string) {
    const nt = tabs.map(t => t.id === activeTabId ? { ...t, content } : t);
    setTabs(nt); saveTabs({ tabs: nt, activeTabId });
  }
  function addTab() {
    const id = Date.now();
    const nt = [...tabs, { id, name: `Untitled ${tabs.length}`, content: '' }];
    setTabs(nt); setActiveTabId(id); saveTabs({ tabs: nt, activeTabId: id });
  }
  function closeTab(id: number) {
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const nt  = tabs.filter(t => t.id !== id);
    setTabs(nt);
    const newId = activeTabId === id ? nt[Math.min(idx, nt.length - 1)].id : activeTabId;
    setActiveTabId(newId); saveTabs({ tabs: nt, activeTabId: newId });
  }
  function deleteScript(sid: number) {
    const s = localScripts.find(x => x.id === sid);
    setLocalScripts(p => p.filter(x => x.id !== sid));
    if (s) { const t = tabs.find(t => t.name === s.name); if (t) closeTab(t.id); }
  }
  function startRename(tabId: number) {
    const t = tabs.find(t => t.id === tabId); if (!t) return;
    setCtxOpen(false); setRenameValue(t.name); setRenamingTabId(tabId);
  }
  function commitRename() {
    if (renamingTabId === null) return;
    const v = renameValue.trim();
    if (v) {
      const nt = tabs.map(t => t.id === renamingTabId ? { ...t, name: v } : t);
      setTabs(nt); saveTabs({ tabs: nt, activeTabId });
    }
    setRenamingTabId(null); setRenameValue('');
  }
  function cancelRename() { setRenamingTabId(null); setRenameValue(''); }
  function loadScript(content: string, name: string) {
    const hit = tabs.find(t => t.name === name);
    let nt: FileTab[], newId: number;
    if (hit) { nt = tabs.map(t => t.id === hit.id ? { ...t, content } : t); newId = hit.id; }
    else     { const id = Date.now(); nt = [...tabs, { id, name, content }]; newId = id; }
    setTabs(nt); setActiveTabId(newId); saveTabs({ tabs: nt, activeTabId: newId });
  }
  async function handleAttach() {
    if (instanceCount === 0) { addLog('error', 'No instances found'); return; }
    const cur        = getSelectedPids();
    const unattached = processes.filter(p => !cur.includes(p.pid));
    if (unattached.length === 0 && cur.length > 0) { addLog('info', 'Already attached to all instances'); return; }
    try {
      await performAttach(() => invoke('handle_attach', {}));
      const pids = getSelectedPids();
      if (pids.length > 0) {
        addLog('success', `Attached: ${pids.map(pid => { const i = sessionInfo[pid]; return i?.username ? `${i.username} (PID:${pid})` : `PID:${pid}`; }).join(', ')}`);
        await invoke('execute_script', { script: 'set_window_title("FemWare OT")', pids });
      } else {
        addLog('success', `Attached to ${instanceCount} instance${instanceCount !== 1 ? 's' : ''}`);
      }
    } catch { addLog('error', 'Failed to attach'); }
  }
  async function handleOpenFile() {
    try {
      const sel = await open({ multiple: false, filters: [{ name: 'Scripts', extensions: ['lua','luau','txt'] }] });
      if (!sel || typeof sel !== 'string') return;
      loadScript(await readTextFile(sel), sel.split(/[/\\]/).pop() || 'file.lua');
    } catch { addLog('error', 'Failed to open file'); }
  }
  async function handleSaveFile() {
    if (!activeTab) return;
    try {
      const p = await save({ defaultPath: activeTab.name, filters: [{ name: 'Lua', extensions: ['lua','luau'] }] });
      if (p) { await writeTextFile(p, activeTab.content); addLog('success', `Saved ${activeTab.name}`); }
    } catch { addLog('error', 'Failed to save file'); }
  }
  function consoleBadgeLabel() {
    if (isAttaching) return 'Attaching…';
    if (isAttached) { const n = getSelectedPids().length; return n > 0 ? `Attached (${n})` : `Attached (${instanceCount})`; }
    return 'Not Attached';
  }
  function onCodeScroll() {
    if (codeScrollRef.current && lineNumRef.current) lineNumRef.current.scrollTop = codeScrollRef.current.scrollTop;
  }
  function tabWidth(name: string) { return Math.max(60, Math.min(250, name.length * 7 + 32)); }

  return (
    <div onClick={() => setCtxOpen(false)} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, width: '100%' }}>

      <style>{`
        @keyframes knobPop {
          0%   { transform: scale(1); }
          35%  { transform: scale(0.68); }
          65%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        .fw-kw  { color: ${activeSyntaxTheme.kw}; }
        .fw-str { color: ${activeSyntaxTheme.str}; }
        .fw-cmt { color: ${activeSyntaxTheme.cmt}; }
        .fw-num { color: ${activeSyntaxTheme.num}; }
        .fw-fn  { color: ${activeSyntaxTheme.fn}; }
      `}</style>

      {/* ── MAIN ROW ── */}
      <div style={{ flex: 1, display: 'flex', gap: 2, minHeight: 0 }}>

        {/* SIDEBAR */}
        {sidebarOpen && (<>
          <div style={{ ...islandStyle, width: sidebarWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 0', flexShrink: 0 }}>
              <span style={{ color: 'var(--fem-dark)', fontSize: 14, fontWeight: 500 }}>Script Explorer</span>
              <button onClick={() => setSidebarOpen(false)} style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <Icon src={sidebarIcon} size={18} active />
              </button>
            </div>

            <div style={{ padding: '8px 14px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 40, background: derived.islandBg, border: `1px solid ${derived.a20}`, boxShadow: 'var(--fem-inset-md)', borderRadius: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fem-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input placeholder="Search" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--fem-muted)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }} />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 14px' }}>
              <AccordionSection label="Local Files" icon={folderIcon} isOpen={accordionOpen['Local Files']}
                onToggle={o => { const s = { ...accordionOpen, 'Local Files': o }; setAccordionOpen(s); saveTabs({ accordionOpen: s }); }}>
                {localScripts.map(s => (
                  <ScriptRow key={s.id} name={s.name} selected={selLocal === s.id}
                    onSelect={() => loadScript(s.content, s.name)} onDelete={() => deleteScript(s.id)} />
                ))}
                {localScripts.length === 0 && <p style={{ color: 'var(--fem-dim)', fontSize: 12, textAlign: 'center', margin: '8px 0' }}>No scripts yet</p>}
              </AccordionSection>

              <AccordionSection label="Auto Execute" icon={branchIcon} isOpen={accordionOpen['Auto Execute']}
                onToggle={o => { const s = { ...accordionOpen, 'Auto Execute': o }; setAccordionOpen(s); saveTabs({ accordionOpen: s }); }}>
                {autoExec.map(s => (
                  <ScriptRow key={s.id} name={s.name} selected={false}
                    onSelect={() => loadScript(s.content, s.name)} onDelete={() => setAutoExec(p => p.filter(x => x.id !== s.id))} />
                ))}
                {autoExec.length === 0 && <p style={{ color: 'var(--fem-muted)', fontSize: 12, textAlign: 'center', margin: '8px 0', opacity: 0.7 }}>No auto-exec scripts</p>}
              </AccordionSection>

              <AccordionSection label="Fem Cloud" icon={cloudIcon} isOpen={accordionOpen['Fem Cloud']}
                onToggle={o => { const s = { ...accordionOpen, 'Fem Cloud': o }; setAccordionOpen(s); saveTabs({ accordionOpen: s }); }}>
                {cloudScripts.length === 0
                  ? <p style={{ color: 'var(--fem-muted)', fontSize: 12, textAlign: 'center', margin: '8px 0', opacity: 0.7 }}>No auto-saved tabs</p>
                  : cloudScripts.map(s => (
                    <ScriptRow key={s.id} name={s.name} selected={false} onSelect={() => loadScript(s.content, s.name)} />
                  ))}
              </AccordionSection>
            </div>
          </div>

          <div style={{ width: 2, flexShrink: 0, cursor: 'col-resize', transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = derived.a40)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onMouseDown={e => { sbResizing.current = true; sbResizeStart.current = { x: e.clientX, w: sidebarWidth }; e.preventDefault(); }}
          />
        </>)}

        {/* EDITOR COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0 }}>

          {/* Tab strip */}
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 47, flexShrink: 0 }}>
            <div ref={tabsScrollRef} style={{ display: 'flex', alignItems: 'flex-end', flex: 1, height: '100%', overflowX: 'auto', overflowY: 'visible', scrollbarWidth: 'none' }}>
              {tabs.map((tab, i) => {
                const isActive   = tab.id === activeTabId;
                const isLast     = i === tabs.length - 1;
                const isRenaming = renamingTabId === tab.id;
                const isHovered  = hoveredTabId === tab.id;
                const tw         = tabWidth(tab.name);

                // Inactive tabs: bright like the rest of the UI panels (islandBg + light inset).
                // Active tab: same surface but with a strong dark inset so it reads as pressed/selected.
                const resolvedBg = derived.islandBg;
                const resolvedShadow = isActive
                  ? `${derived.islandShadow}, inset 0 0 40px ${derived.a33}`
                  : isHovered
                  ? `inset 0 0 12px ${derived.a40}, ${derived.glowMd}`
                  : `inset 0 0 28px ${derived.a40}, ${derived.glowSm}`;

                return (
                  <div key={tab.id}
                    onClick={() => { if (!isRenaming && draggedTabId === null) { setActiveTabId(tab.id); saveTabs({ tabs, activeTabId: tab.id }); } }}
                    onMouseEnter={() => setHoveredTabId(tab.id)}
                    onMouseLeave={() => setHoveredTabId(null)}
                    onMouseDown={e => { if (e.button === 0) { setDraggedTabId(tab.id); dragStartPos.current = { x: e.clientX, y: e.clientY }; } }}
                    onContextMenu={e => { e.preventDefault(); setCtxTabId(tab.id); setCtxPos({ x: e.clientX, y: e.clientY }); setCtxOpen(true); }}
                    style={{ height: '100%', flexShrink: 0, position: 'relative', width: tw, opacity: draggedTabId === tab.id ? 0.5 : 1, userSelect: 'none', cursor: 'pointer', borderTopLeftRadius: i === 0 ? 6 : 0, borderTopRightRadius: isLast ? 6 : 0, overflow: 'hidden' }}
                  >
                    {/* Tab bg — uses islandBg which already carries fgOpacity transparency, no border */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: resolvedBg,
                      boxShadow: resolvedShadow,
                      borderTopLeftRadius: i === 0 ? 6 : 0,
                      borderTopRightRadius: isLast ? 6 : 0,
                      transition: 'box-shadow 0.15s',
                    }} />

                    {/* No accent bars between tabs */}

                    {dropTargetIndex === tabs.length && i === tabs.length - 1 && draggedTabId !== null && (
                      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: 'var(--fem-base)', zIndex: 10, borderRadius: 2 }} />
                    )}
                    {dropTargetIndex === i && draggedTabId !== null && draggedTabId !== tab.id && (
                      <div style={{ position: 'absolute', left: -1, top: 0, bottom: 0, width: 3, background: 'var(--fem-base)', zIndex: 10, borderRadius: 2 }} />
                    )}

                    <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px 0 10px' }}>
                      {isRenaming ? (
                        <input ref={renameInputRef} value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename(); }}
                          onClick={e => e.stopPropagation()}
                          style={{ flex: 1, minWidth: 40, background: 'transparent', border: 'none', borderBottom: '1px solid var(--fem-base)', outline: 'none', color: 'var(--fem-base)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: '0 2px', caretColor: 'var(--fem-base)' }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          // Active tab: accent color. Hovered inactive: dark. Idle inactive: muted — same pattern as nav buttons.
                          color: isActive ? 'var(--fem-base)' : isHovered ? 'var(--fem-dark)' : 'var(--fem-muted)',
                          whiteSpace: 'nowrap',
                          transition: 'color 0.15s',
                        }}>
                          {tab.name}
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'var(--fem-base)' : 'var(--fem-muted)', width: 16, height: 16, fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.7, marginLeft: 2, transition: 'color 0.15s' }}>
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={addTab} style={{ width: 26, height: 26, flexShrink: 0, alignSelf: 'center', margin: '0 4px', borderRadius: 6, border: 'none', background: derived.islandBg, color: 'var(--fem-dark)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>

          {/* Editor body */}
          <div style={{
            ...islandStyle,
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minHeight: 0, marginTop: 0,
            borderTopLeftRadius: 0, borderTopRightRadius: 6,
            borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
          }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              <div ref={lineNumRef} style={{ padding: '12px 10px 12px 14px', color: 'var(--fem-muted)', fontFamily: 'Consolas, Courier New, monospace', fontSize: 14, userSelect: 'none', textAlign: 'right', lineHeight: '22px', background: 'transparent', flexShrink: 0, overflowY: 'hidden', minWidth: 40 }}>
                {lines.map((_, i) => <div key={i} style={{ height: 22 }}>{i + 1}</div>)}
              </div>
              <div ref={codeScrollRef} onScroll={onCodeScroll} style={{ flex: 1, overflow: 'auto', height: '100%' }}>
                <div style={{ display: 'grid', minHeight: '100%' }}>
                  <pre aria-hidden="true" style={{ gridArea: '1/1', margin: 0, padding: '12px 16px 12px 0', fontFamily: 'Consolas, Courier New, monospace', fontSize: 14, color: 'var(--fem-base)', lineHeight: '22px', whiteSpace: 'pre', pointerEvents: 'none', userSelect: 'none' }}
                    dangerouslySetInnerHTML={{ __html: hl(activeTab?.content || '') + '\n' }} />
                  <textarea value={activeTab?.content || ''} onChange={e => updateContent(e.target.value)} spellCheck={false}
                    style={{ gridArea: '1/1', margin: 0, padding: '12px 16px 12px 0', fontFamily: 'Consolas, Courier New, monospace', fontSize: 14, lineHeight: '22px', whiteSpace: 'pre', background: 'transparent', color: 'transparent', caretColor: 'var(--fem-base)', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <ActionBtn label="Execute" onClick={async () => { try { await executeScript(activeTab?.content || ''); } catch (err) { addLog('error', err instanceof Error ? err.message : 'Execute failed'); } }} />
                <ActionBtn label="Clear Text" onClick={() => updateContent('')} />
                <ActionBtn label="Open File" onClick={handleOpenFile} />
                <ActionBtn label="Save File" onClick={handleSaveFile} />
              </div>
              <ActionBtn label="Attach" disabled={isAttaching} onClick={handleAttach} />
            </div>
          </div>
        </div>
      </div>

      {consoleOpen && (
        <div style={{ height: 2, flexShrink: 0, cursor: 'row-resize', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = derived.a40)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onMouseDown={e => { conResizing.current = true; conResizeStart.current = { y: e.clientY, h: consoleHeight }; e.preventDefault(); }}
        />
      )}

      <div style={{ ...islandStyle, height: consoleOpen ? consoleHeight : 30, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, transition: 'height 0.2s ease' }}>
        <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: consoleOpen ? `1px solid var(--fem-a12)` : 'none', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <button onClick={() => setConsoleOpen(v => !v)} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
              <Icon src={sidebarIcon} size={16} active />
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fem-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Console</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => clearConsoleLogs()} style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--fem-dark)', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}>Clear</button>
            <span style={{ fontSize: 11, color: 'var(--fem-dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', transition: 'background 0.3s, box-shadow 0.3s', background: isAttached ? 'var(--fem-base)' : instanceCount > 0 ? derived.a40 : derived.a20, boxShadow: isAttached ? `0 0 5px ${derived.a80}` : undefined }} />
              {consoleBadgeLabel()}
            </span>
          </div>
        </div>
        {consoleOpen && (
          <div ref={consoleRef} style={{ flex: 1, padding: '6px 14px', fontFamily: 'Courier New, monospace', fontSize: 12, lineHeight: '18px', overflowY: 'auto', color: 'var(--fem-dark)', userSelect: 'text' }}>
            {consoleLogs.length === 0
              ? <div style={{ color: 'var(--fem-muted)' }}>[FemWare] Ready</div>
              : consoleLogs.map(log => (
                <div key={log.id} style={{ color: log.level === 'error' ? '#ff6b6b' : log.level === 'warning' ? '#ffb74d' : log.level === 'success' ? '#81c784' : log.level === 'status' ? 'var(--fem-base)' : 'var(--fem-muted)' }}>
                  [{log.timestamp.toLocaleTimeString()}] {log.message}
                </div>
              ))
            }
          </div>
        )}
      </div>

      {ctxOpen && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: ctxPos.x, top: ctxPos.y, background: derived.islandBg, border: `1px solid var(--fem-a20)`, borderRadius: 10, padding: 4, zIndex: 9999, minWidth: 160, boxShadow: `0 8px 24px var(--fem-a40)` }}>
          {[
            { label: '✏️  Rename tab', action: () => { if (ctxTabId !== null) startRename(ctxTabId); }, danger: false },
            null,
            { label: 'New tab',       action: () => { setCtxOpen(false); addTab(); },                                  danger: false },
            { label: '✕  Close tab',  action: () => { setCtxOpen(false); if (ctxTabId != null) closeTab(ctxTabId); },  danger: true  },
          ].map((item, i) =>
            item === null
              ? <div key={i} style={{ height: 1, background: 'var(--fem-a20)', margin: '3px 6px' }} />
              : <div key={i} onClick={item.action}
                  style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: item.danger ? '#e05080' : 'var(--fem-darker)', borderRadius: 7, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = item.danger ? 'rgba(224,80,128,.1)' : 'var(--fem-a25)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >{item.label}</div>
          )}
        </div>
      )}
    </div>
  );
}