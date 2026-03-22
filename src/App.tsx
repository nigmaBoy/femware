import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { LoginPage } from './components/auth/LoginPage';
import { FemwareApp } from './components/femware/FemwareApp';
import { ThemeProvider, preloadTheme } from './context/themeContext';
import { loadClientSettings } from './stores/clientSettingsStore';
import { loadSettings } from './stores/settingsStore';
import astolfoBg from './assets/astolfo.png';
import './styles/globals.css';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await preloadTheme();
        // Wait two frames so WebView fully paints images before showing UI
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        setThemeReady(true);

        await Promise.all([loadClientSettings(), loadSettings()]);
        const win = getCurrentWindow();
        await win.setSize(new LogicalSize(358, 420));
        await win.setResizable(false);
        await win.center();
        invoke<boolean>('validate_license_session', { license: null })
          .then(valid => { if (valid) expandToDashboard(); else setAuthed(false); })
          .catch(() => setAuthed(false));
      } catch {
        setThemeReady(true);
        setAuthed(true);
      }
    };
    init();
  }, []);

  const expandToDashboard = async () => {
    const win = getCurrentWindow();
    await win.setResizable(true);
    await win.setSize(new LogicalSize(1200, 700));
    await win.center();
    setAuthed(true);
  };

  if (!themeReady || authed === null) return null;
  if (!authed) return <LoginPage onLogin={expandToDashboard} />;

  return (
    <ThemeProvider astolfoAssetUrl={astolfoBg}>
      <FemwareApp />
    </ThemeProvider>
  );
}