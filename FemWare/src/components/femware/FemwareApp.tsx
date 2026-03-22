import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EditorTab } from './EditorTab';
import { SettingsTab } from './SettingsTab';
import { HomeTab } from './HomeTab';
import { InstancesTab } from './InstancesTab';
import { OutputTab } from './OutputTab';
import { VisualsTab } from './VisualsTab';
import { loadTabs, saveTabs } from '../../stores/tabsStore';
import { useFemTheme } from '../../context/themeContext';

import topImg        from '../../assets/top img.png';
import homeIcon      from '../../assets/home.png';
import codingIcon    from '../../assets/coding.png';
import cloudIcon     from '../../assets/cloud.png';
import favFolderIcon from '../../assets/favorite-folder.png';
import brushIcon     from '../../assets/brush.png';
import settingIcon   from '../../assets/setting.png';
import sidebarIcon   from '../../assets/sidebar.png';
import kawaiiImg     from '../../assets/bottom img.png';
import boyKisserBg   from '../../assets/boy kisser.png';
import boyKisserTop  from '../../assets/boy kisser top.png';
import boyKisserBot  from '../../assets/boy kisser bottom.png';
import astolfoAsset  from '../../assets/astolfo.png';

type ViewType = 'editor' | 'settings' | 'home' | 'instances' | 'output' | 'visuals';

const TOOLS: { src: string; size: number; view: ViewType }[] = [
  { src: homeIcon,      size: 20, view: 'home'      },
  { src: codingIcon,    size: 20, view: 'editor'    },
  { src: cloudIcon,     size: 24, view: 'instances' },
  { src: favFolderIcon, size: 24, view: 'output'    },
  { src: brushIcon,     size: 30, view: 'visuals'   },
  { src: settingIcon,   size: 22, view: 'settings'  },
];

// Built-in preset asset map — resolved from imports so they load instantly
const PRESET_ASSETS: Record<string, { logoTop: string; logoBottom: string; bg: string }> = {
  'Astolfo':    { logoTop: topImg,       logoBottom: kawaiiImg,    bg: astolfoAsset },
  'Boy Kisser': { logoTop: boyKisserTop, logoBottom: boyKisserBot, bg: boyKisserBg  },
};

async function winMin()   { await getCurrentWindow().minimize(); }
async function winMax()   { await getCurrentWindow().toggleMaximize(); }
async function winClose() { await getCurrentWindow().close(); }

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

export function FemwareApp() {
  const { islandStyle, derived, theme, astolfoUrl } = useFemTheme();

  const [activeToolIdx, setActiveToolIdx] = useState(1);
  const [activeView,    setActiveView]    = useState<ViewType>('editor');
  const [sidebarOpen,   setSidebarOpen]   = useState(true);

  useEffect(() => {
    loadTabs().then(state => setSidebarOpen(state.sidebarOpen));
  }, []);

  const handleSidebarOpenChange = (v: boolean | ((p: boolean) => boolean)) => {
    const newValue = typeof v === 'function' ? v(sidebarOpen) : v;
    setSidebarOpen(newValue);
    saveTabs({ sidebarOpen: newValue });
  };

  // Resolve images: if a preset name is set, use imported assets (instant load)
  // Otherwise fall back to custom uploaded URL or default asset
  const presetAssets = theme.presetName ? PRESET_ASSETS[theme.presetName] : null;
  const logoTop    = presetAssets?.logoTop    || theme.logoTopUrl    || topImg;
  const logoBottom = presetAssets?.logoBottom || theme.logoBottomUrl || kawaiiImg;
  const bgAsset    = presetAssets?.bg         || null;

  const overlayImageUrl =
    bgAsset ? bgAsset :
    theme.bgMode === 'astolfo' ? astolfoUrl :
    theme.bgMode === 'image'   ? theme.bgImageUrl :
    null;

  return (
    <div style={{
      height: '100vh', position: 'relative', borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      gap: 4, padding: 4,
      fontFamily: "'Poppins', 'Segoe UI', sans-serif",
      boxSizing: 'border-box', userSelect: 'none',
    }}>

      <div style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 10, background: theme.bgColor }} />

      {overlayImageUrl && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, borderRadius: 10,
          backgroundImage: `url(${overlayImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: theme.bgOpacity / 100,
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0 }}>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <div style={{ ...islandStyle, width: 58, height: 58, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src={logoTop} draggable={false} style={{ width: 52, height: 52, objectFit: 'cover', pointerEvents: 'none', borderRadius: 4 }} />
          </div>

          <div data-tauri-drag-region style={{ ...islandStyle, flex: 1, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'relative' }}>
            <nav style={{ display: 'flex', gap: 12 }}>
              {['File', 'Edit', 'Debug', 'App'].map(l => (
                <button key={l} style={{ background: 'none', border: 'none', color: 'var(--fem-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', lineHeight: '18px' }}>{l}</button>
              ))}
            </nav>

            <span data-tauri-drag-region style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: "'Silva Marine', sans-serif", fontSize: 20, color: 'var(--fem-base)', letterSpacing: '0.06em', textShadow: `0 0 24px var(--fem-a80)`, userSelect: 'none' }}>
              FemWare
            </span>

            <div style={{ display: 'flex', gap: 8 }}>
              {[{ bg: derived.a20, fn: winMin }, { bg: derived.a40, fn: winMax }, { bg: derived.base, fn: winClose }].map(({ bg, fn }, i) => (
                <button key={i} onClick={fn} style={{ width: 14, height: 14, borderRadius: '50%', border: 'none', background: bg, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, flex: 1, minHeight: 0 }}>

          <div style={{ ...islandStyle, width: 58, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            {TOOLS.map((tool, i) => {
              const active = i === activeToolIdx;
              return (
                <button key={i} onClick={() => { setActiveToolIdx(i); setActiveView(TOOLS[i].view); }} style={{
                  width: 58, height: 48, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', flexShrink: 0,
                  background: active ? derived.a08 : 'transparent',
                  boxShadow: active ? `inset 0px 0px 12px ${derived.a40}` : undefined,
                  transition: 'all .2s',
                }}>
                  {active && <>
                    <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, background: 'var(--fem-base)', borderRadius: '0px 3px 3px 0px' }} />
                    <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, background: 'var(--fem-base)', borderRadius: '3px 0px 0px 3px' }} />
                  </>}
                  <Icon src={tool.src} size={tool.size} active={active} />
                </button>
              );
            })}

            <div style={{ flex: 1 }} />

            <button onClick={() => handleSidebarOpenChange(v => !v)} style={{ width: 58, height: 48, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{
                width: 20, height: 20, flexShrink: 0,
                backgroundColor: sidebarOpen ? 'var(--fem-base)' : 'var(--fem-muted)',
                WebkitMaskImage: `url(${sidebarIcon})`,
                WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                maskImage: `url(${sidebarIcon})`,
                maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
                pointerEvents: 'none',
                transform: sidebarOpen ? '' : 'rotate(180deg)',
                transition: 'background-color .2s, transform .3s',
              }} />
            </button>

            <div style={{ padding: 8, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 7, border: `1px solid var(--fem-base)`, boxShadow: `inset 0px 0px 10px var(--fem-base)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoBottom} draggable={false} style={{ width: 36, height: 36, objectFit: 'cover', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
            {activeView === 'home'      && <HomeTab />}
            {activeView === 'editor'    && <EditorTab sidebarOpen={sidebarOpen} setSidebarOpen={handleSidebarOpenChange} />}
            {activeView === 'instances' && <InstancesTab />}
            {activeView === 'output'    && <OutputTab />}
            {activeView === 'visuals'   && <VisualsTab />}
            {activeView === 'settings'  && <SettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}