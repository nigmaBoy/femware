import { useSyncExternalStore } from 'react';
import { getAutoInject, setAutoInject, subscribeAutoInject } from '../../stores/autoInjectStore';
import { getClientSettings, updateClientSynSetting } from '../../stores/clientSettingsStore';
import { initializeConsoleListener } from '../../stores/consoleStore';
import { useState, useEffect } from 'react';
import { useFemTheme } from '../../context/themeContext';

function PillToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { derived } = useFemTheme();
  const [animKey, setAnimKey] = useState(0);
  return (
    <>
      <style>{`.settings-knob-anim { animation: knobPop 0.22s ease forwards; }`}</style>
      <div
        onClick={() => { setAnimKey(k => k + 1); onChange(!value); }}
        style={{
          width: 40, height: 22, borderRadius: 11, padding: 3, boxSizing: 'border-box',
          background: value ? 'var(--fem-base)' : 'var(--fem-a18)',
          border: `1px solid ${value ? derived.a65 : derived.a30}`,
          boxShadow: value
            ? `inset 0 0 10px ${derived.a45}, 0 0 8px ${derived.a50}`
            : `inset 0 0 6px ${derived.a20}`,
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          display: 'flex', alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start', flexShrink: 0,
        }}
      >
        <div key={animKey} className={animKey > 0 ? 'settings-knob-anim' : ''}
          style={{
            width: 14, height: 14, borderRadius: '50%',
            background: value ? '#fff' : derived.a30,
            boxShadow: value ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            transition: 'background 0.2s', flexShrink: 0,
          }}
        />
      </div>
    </>
  );
}

interface SettingRowProps {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}

function SettingRow({ label, description, value, onChange }: SettingRowProps) {
  const { derived } = useFemTheme();
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
        transition: 'background 0.2s, box-shadow 0.2s, border-color 0.2s',
        background: value ? derived.a12 : hov ? derived.a08 : derived.islandBg,
        border: `1px solid ${value ? derived.a45 : hov ? derived.a30 : derived.a20}`,
        boxShadow: value
          ? `inset 0 0 20px ${derived.a25}, 0 4px 14px ${derived.a15}`
          : hov
          ? `inset 0 0 14px ${derived.a15}, 0 2px 8px ${derived.a12}`
          : `inset 0 0 10px ${derived.a08}`,
        userSelect: 'none',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: value ? 'var(--fem-darker)' : 'var(--fem-dark)', transition: 'color 0.2s', lineHeight: 1.3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, fontWeight: 400, color: value ? 'var(--fem-dark)' : 'var(--fem-muted)', marginTop: 2, transition: 'color 0.2s', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      <div onClick={e => { e.stopPropagation(); onChange(!value); }}>
        <PillToggle value={value} onChange={onChange} />
      </div>
    </div>
  );
}

export function SettingsTab() {
  const { islandStyle } = useFemTheme();
  const autoInject = useSyncExternalStore(subscribeAutoInject, getAutoInject);
  const [redirectOutput, setRedirectOutput] = useState(false);

  useEffect(() => {
    const clientSettings = getClientSettings();
    setRedirectOutput(!!clientSettings.redirect_output);
  }, []);

  const handleRedirectChange = async (value: boolean) => {
    setRedirectOutput(value);
    await updateClientSynSetting('redirect_output', value);
    if (value) await initializeConsoleListener();
  };

  return (
    <div style={{ ...islandStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', height: 44, flexShrink: 0,
        borderBottom: '1px solid var(--fem-a15)',
      }}>
        <span style={{ color: 'var(--fem-dark)', fontSize: 13, fontWeight: 600 }}>Settings</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SettingRow label="Auto-Inject" description="Automatically attach to new Roblox instances when they open" value={autoInject} onChange={setAutoInject} />
          <SettingRow label="Redirect Output" description="Forward Roblox print and warn calls to the Output tab" value={redirectOutput} onChange={handleRedirectChange} />
        </div>
      </div>
    </div>
  );
}