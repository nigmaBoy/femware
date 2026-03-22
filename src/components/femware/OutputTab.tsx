import { useState, useEffect, useRef, useCallback } from 'react';
import { clearRobloxLogs, getRobloxLogs, initializeConsoleListener, subscribeToConsoleLogs } from '../../stores/consoleStore';
import { getClientSettings, subscribeToClientSettings } from '../../stores/clientSettingsStore';
import { useFemTheme } from '../../context/themeContext';

type LogLevel = 'info' | 'warning' | 'error' | 'success' | 'status';
interface LogEntry { id: string; level: LogLevel; message: string; timestamp: Date; }

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#e8a0c0', warning: '#ffb74d', error: '#ff6b6b', success: '#81c784', status: '#f698d9',
};
const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO', warning: 'WARN', error: 'ERR', success: 'OK', status: 'SYS',
};

export function OutputTab() {
  const { islandStyle, derived } = useFemTheme();
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [filter, setFilter]     = useState<LogLevel | 'all'>('all');
  const [redirectEnabled, setRedirectEnabled] = useState(() => !!getClientSettings().redirect_output);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeConsoleListener().then(() => setLogs(getRobloxLogs()));
    const unsubLogs     = subscribeToConsoleLogs(() => setLogs(getRobloxLogs()));
    const unsubSettings = subscribeToClientSettings(() => setRedirectEnabled(!!getClientSettings().redirect_output));
    return () => { unsubLogs(); unsubSettings(); };
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const handleClear = useCallback(() => { clearRobloxLogs(); setLogs([]); }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter);
  const levelCounts  = logs.reduce((acc, l) => { acc[l.level] = (acc[l.level] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ ...islandStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', height: 44,
        borderBottom: '1px solid var(--fem-a15)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--fem-dark)', fontSize: 13, fontWeight: 600 }}>Output</span>
          {logs.length > 0 && redirectEnabled && (
            <span style={{
              background: 'var(--fem-a20)', boxShadow: `inset 0 0 8px var(--fem-a40)`,
              color: 'var(--fem-darker)', fontSize: 10, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20, border: '1px solid var(--fem-a25)',
            }}>{logs.length}</span>
          )}
        </div>

        {redirectEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(['all','info','warning','error','success','status'] as const).map(lvl => {
              const isActive = filter === lvl;
              const color = lvl === 'all' ? derived.muted : LEVEL_COLORS[lvl];
              const count = lvl === 'all' ? logs.length : (levelCounts[lvl] || 0);
              if (lvl !== 'all' && count === 0) return null;
              return (
                <button key={lvl} onClick={() => setFilter(lvl)} style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? color + '88' : 'var(--fem-a20)'}`,
                  background: isActive ? color + '22' : 'transparent',
                  color: isActive ? color : 'var(--fem-muted)',
                  transition: 'all .15s', fontFamily: 'inherit',
                  boxShadow: isActive ? `inset 0 0 8px ${color}44` : 'none',
                }}>
                  {lvl === 'all' ? 'All' : LEVEL_LABELS[lvl]}
                  {count > 0 && <span style={{ marginLeft: 4, opacity: 0.75 }}>{count}</span>}
                </button>
              );
            })}
            <div style={{ width: 1, height: 16, background: 'var(--fem-a20)', margin: '0 2px' }} />
            <button onClick={handleClear} style={{
              padding: '2px 10px', height: 26, borderRadius: 8, fontSize: 10, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              color: 'var(--fem-muted)', background: derived.islandBg,
              border: '1px solid var(--fem-a30)', boxShadow: 'var(--fem-glow-sm)', outline: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--fem-base)'; e.currentTarget.style.boxShadow = 'var(--fem-inset-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--fem-muted)'; e.currentTarget.style.boxShadow = 'var(--fem-glow-sm)'; }}
            >Clear</button>
          </div>
        )}
      </div>

      {/* Log content */}
      <div ref={logsRef} style={{ flex: 1, overflow: 'auto', padding: '8px 14px 12px', fontFamily: 'Consolas, Courier New, monospace', fontSize: 12, lineHeight: '20px' }}>
        {!redirectEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <p style={{ color: 'var(--fem-dim)', fontSize: 13, fontWeight: 500, margin: 0 }}>Redirect Output is disabled</p>
            <p style={{ color: 'var(--fem-dim)', fontSize: 11, margin: 0 }}>Enable it in Settings to see Roblox logs here</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <p style={{ color: 'var(--fem-dim)', fontSize: 13, fontWeight: 500, margin: 0 }}>
              {logs.length === 0 ? 'No output yet' : 'No logs match this filter'}
            </p>
            <p style={{ color: 'var(--fem-dim)', fontSize: 11, margin: 0 }}>
              {logs.length === 0 ? 'Roblox logs will appear here' : `${logs.length} log${logs.length !== 1 ? 's' : ''} hidden by filter`}
            </p>
          </div>
        ) : filteredLogs.map(log => (
          <div key={log.id} style={{ display: 'flex', gap: 8, marginBottom: 3, wordBreak: 'break-all', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--fem-muted)', opacity: 0.5, flexShrink: 0, userSelect: 'none' }}>[{formatTime(log.timestamp)}]</span>
            <span style={{
              flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              color: LEVEL_COLORS[log.level], background: LEVEL_COLORS[log.level] + '18',
              border: `1px solid ${LEVEL_COLORS[log.level]}44`,
              letterSpacing: '0.04em', alignSelf: 'center', lineHeight: '14px', userSelect: 'none',
            }}>{LEVEL_LABELS[log.level]}</span>
            <span style={{ color: LEVEL_COLORS[log.level], fontWeight: log.level === 'error' ? 600 : 400, flex: 1 }}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}