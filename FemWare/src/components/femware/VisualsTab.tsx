import { useState, useRef, useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { useFemTheme, hexToHsl, hslToHex } from '../../context/themeContext';
import { SYNTAX_THEMES, DEFAULT_SYNTAX_THEME } from '../../constants/syntaxThemes';

import topImgDefault    from '../../assets/top img.png';
import bottomImgDefault from '../../assets/bottom img.png';
import astolfoAsset     from '../../assets/astolfo.png';
import boyKisserBg      from '../../assets/boy kisser.png';
import boyKisserTop     from '../../assets/boy kisser top.png';
import boyKisserBottom  from '../../assets/boy kisser bottom.png';

async function pickImageAsDataUrl(): Promise<string | null> {
  try {
    const selected = await open({ multiple: false, filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','avif','bmp'] }] });
    if (!selected || typeof selected !== 'string') return null;
    const bytes = await readFile(selected);
    const ext = selected.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = (ext==='jpg'||ext==='jpeg') ? 'image/jpeg' : ext==='gif' ? 'image/gif' : ext==='webp' ? 'image/webp' : ext==='bmp' ? 'image/bmp' : ext==='avif' ? 'image/avif' : 'image/png';
    let b64 = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(b64)}`;
  } catch { return null; }
}

const SAVED_THEMES_KEY = 'fem-saved-themes';
interface SavedTheme { name: string; theme: Record<string, unknown>; savedAt: number; }

function loadSavedThemesSync(): SavedTheme[] {
  try { const raw = localStorage.getItem(SAVED_THEMES_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function persistSavedThemes(themes: SavedTheme[]): void {
  try { localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(themes)); } catch {}
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fem-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, padding: '16px 18px', background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a22)', boxShadow: 'var(--fem-inset-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fem-darker)' }}>{title}</div>
      {children}
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const key = 'fem-collapse-' + title.replace(/\s+/g, '-').toLowerCase();
  const [open, setOpen] = useState(() => {
    try { const stored = localStorage.getItem(key); return stored !== null ? stored === 'true' : defaultOpen; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen(v => { const next = !v; try { localStorage.setItem(key, String(next)); } catch {} return next; });
  return (
    <div style={{ borderRadius: 14, background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a22)', boxShadow: 'var(--fem-inset-md)', display: 'flex', flexDirection: 'column' }}>
      <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fem-darker)' }}>{title}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <path d="M2 4L6 8L10 4" stroke="var(--fem-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>}
    </div>
  );
}

function FemSlider({ label, value, min = 0, max = 100, unit = '', onChange, gradient }: { label: string; value: number; min?: number; max?: number; unit?: string; onChange: (v: number) => void; gradient?: string; }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fem-muted)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fem-base)', minWidth: 36, textAlign: 'right' }}>{value}{unit}</span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, background: gradient || 'linear-gradient(to right, var(--fem-a25), var(--fem-base))', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }} />
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
        <div style={{ position: 'absolute', left: `calc(${pct}% - 9px)`, width: 18, height: 18, borderRadius: '50%', background: 'var(--fem-base)', border: '2.5px solid white', boxShadow: '0 1px 6px rgba(0,0,0,0.25), var(--fem-glow-sm)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: value, border: '1px solid var(--fem-a25)', flexShrink: 0 }} />
      <input value={local} onChange={e => { setLocal(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(local)) setLocal(value); }} maxLength={7}
        style={{ width: 90, padding: '4px 8px', borderRadius: 8, background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a22)', boxShadow: 'var(--fem-inset-sm)', color: 'var(--fem-darker)', fontSize: 12, fontWeight: 600, fontFamily: 'Consolas, monospace', outline: 'none' }} />
    </div>
  );
}

function PillToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const [animKey, setAnimKey] = useState(0);
  return (
    <>
      <style>{`.vis-knob-anim { animation: knobPop 0.22s ease forwards; }`}</style>
      <div onClick={() => { setAnimKey(k => k + 1); onToggle(); }} style={{ width: 34, height: 18, borderRadius: 9, padding: 3, boxSizing: 'border-box', background: on ? 'var(--fem-base)' : 'var(--fem-a18)', border: `1px solid ${on ? 'var(--fem-a65)' : 'var(--fem-a30)'}`, boxShadow: on ? 'inset 0 0 8px var(--fem-a45), 0 0 6px var(--fem-a40)' : 'inset 0 0 5px var(--fem-a20)', cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
        <div key={animKey} className={animKey > 0 ? 'vis-knob-anim' : ''} style={{ width: 10, height: 10, borderRadius: '50%', background: on ? '#fff' : 'var(--fem-a30)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.2)' : 'none', transition: 'background 0.2s', flexShrink: 0 }} />
      </div>
    </>
  );
}

function ColorWheel({ hue, sat, lit, onChange }: { hue: number; sat: number; lit: number; onChange: (h: number, s: number, l: number) => void; }) {
  const SIZE = 180, RING = 18;
  const cx = SIZE / 2, inner = SIZE / 2 - RING - 4;
  const sqSize = inner * 2 * 0.707;
  const hueRef = useRef<SVGSVGElement>(null);
  const slRef  = useRef<HTMLCanvasElement>(null);
  const draggingHue = useRef(false), draggingSL = useRef(false);
  const getHue = useCallback((e: MouseEvent | React.MouseEvent) => { const rect = hueRef.current!.getBoundingClientRect(); return Math.round((Math.atan2(e.clientY - rect.top - cx, e.clientX - rect.left - cx) * 180 / Math.PI + 360 + 90) % 360); }, [cx]);
  const getSL = useCallback((e: MouseEvent | React.MouseEvent) => { const r = slRef.current!.getBoundingClientRect(); return { s: Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))), l: Math.round(Math.max(0, Math.min(100, (1 - (e.clientY - r.top) / r.height) * 100))) }; }, []);
  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (draggingHue.current) onChange(getHue(e), sat, lit); if (draggingSL.current) { const { s, l } = getSL(e); onChange(hue, s, l); } };
    const onUp = () => { draggingHue.current = false; draggingSL.current = false; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [hue, sat, lit, getHue, getSL, onChange]);
  useEffect(() => {
    const canvas = slRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!; const W = canvas.width, H = canvas.height;
    const gH = ctx.createLinearGradient(0, 0, W, 0); gH.addColorStop(0, 'hsl(0,0%,100%)'); gH.addColorStop(1, `hsl(${hue},100%,50%)`);
    ctx.fillStyle = gH; ctx.fillRect(0, 0, W, H);
    const gB = ctx.createLinearGradient(0, 0, 0, H); gB.addColorStop(0, 'rgba(0,0,0,0)'); gB.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gB; ctx.fillRect(0, 0, W, H);
  }, [hue]);
  const segments = 36;
  const paths = Array.from({ length: segments }, (_, i) => {
    const a1 = (i / segments) * 2 * Math.PI - Math.PI / 2, a2 = ((i + 1) / segments) * 2 * Math.PI - Math.PI / 2;
    const r1 = SIZE / 2 - RING, r2 = SIZE / 2;
    const x1=cx+r1*Math.cos(a1),y1=cx+r1*Math.sin(a1),x2=cx+r2*Math.cos(a1),y2=cx+r2*Math.sin(a1);
    const x3=cx+r2*Math.cos(a2),y3=cx+r2*Math.sin(a2),x4=cx+r1*Math.cos(a2),y4=cx+r1*Math.sin(a2);
    return { d: `M${x1} ${y1} L${x2} ${y2} A${r2} ${r2} 0 0 1 ${x3} ${y3} L${x4} ${y4} A${r1} ${r1} 0 0 0 ${x1} ${y1}Z`, hue: i * (360 / segments) };
  });
  const hRad = (hue - 90) * Math.PI / 180, hR = SIZE / 2 - RING / 2;
  const hkx = cx + hR * Math.cos(hRad), hky = cx + hR * Math.sin(hRad);
  const slX = (sat / 100) * sqSize, slY = (1 - lit / 100) * sqSize;
  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg ref={hueRef} width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} onMouseDown={e => { draggingHue.current = true; onChange(getHue(e), sat, lit); }}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={`hsl(${p.hue},100%,55%)`} />)}
        <circle cx={hkx} cy={hky} r={8} fill={`hsl(${hue},100%,60%)`} stroke="white" strokeWidth={2.5} style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.4))' }} />
      </svg>
      <div style={{ position: 'absolute', left: cx-sqSize/2, top: cx-sqSize/2, width: sqSize, height: sqSize, borderRadius: 6, overflow: 'hidden', cursor: 'crosshair', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
        <canvas ref={slRef} width={sqSize} height={sqSize} style={{ display: 'block', width: sqSize, height: sqSize }} onMouseDown={e => { draggingSL.current = true; const { s, l } = getSL(e); onChange(hue, s, l); }} />
        <div style={{ position: 'absolute', left: slX-6, top: slY-6, width: 12, height: 12, borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)', pointerEvents: 'none', background: `hsl(${hue},${sat}%,${lit}%)` }} />
      </div>
    </div>
  );
}

function ImageUploadCard({ label, currentUrl, defaultSrc, onUpload, onClear }: { label: string; currentUrl: string; defaultSrc: string; onUpload: (url: string) => void; onClear: () => void; }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async () => { setUploading(true); const url = await pickImageAsDataUrl(); if (url) onUpload(url); setUploading(false); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--fem-a25)', boxShadow: 'var(--fem-inset-sm)' }}>
        <img src={currentUrl || defaultSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fem-dark)', marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleUpload} disabled={uploading} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a30)', color: 'var(--fem-muted)', boxShadow: 'var(--fem-glow-sm)', transition: 'all .15s' }}>
            {uploading ? 'Loading…' : currentUrl ? '↑ Replace' : '↑ Upload'}
          </button>
          {currentUrl && <button onClick={onClear} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--fem-a20)', color: 'var(--fem-dim)', transition: 'all .15s' }}>Reset</button>}
        </div>
      </div>
    </div>
  );
}

const THEME_PRESETS = [
  { label: 'Pink', h: 315, s: 100, l: 75 }, { label: 'Coral', h: 10, s: 90, l: 65 },
  { label: 'Peach', h: 30, s: 90, l: 65 }, { label: 'Lemon', h: 55, s: 90, l: 65 },
  { label: 'Mint', h: 150, s: 70, l: 65 }, { label: 'Sky', h: 200, s: 85, l: 65 },
  { label: 'Blue', h: 230, s: 90, l: 70 }, { label: 'Purple', h: 270, s: 85, l: 70 },
  { label: 'Lilac', h: 290, s: 80, l: 75 }, { label: 'White', h: 0, s: 0, l: 90 },
];

interface UiPreset { label: string; hue: number; sat: number; lit: number; bgColor: string; bgImageAsset: string; logoTopAsset: string; logoBottomAsset: string; }

function PresetCard({ preset, active, onApply, onDelete }: { preset: UiPreset; active: boolean; onApply: () => void; onDelete?: () => void }) {
  const [hov, setHov] = useState(false);
  const previewColor = `hsl(${preset.hue},${preset.sat}%,${preset.lit}%)`;
  return (
    <div onClick={onApply} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', background: active ? 'var(--fem-a15)' : hov ? 'var(--fem-a08)' : 'transparent', border: `1px solid ${active ? 'var(--fem-a40)' : hov ? 'var(--fem-a22)' : 'var(--fem-a15)'}`, boxShadow: active ? 'var(--fem-inset-sm)' : 'none' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: preset.bgColor, border: '1px solid var(--fem-a20)', position: 'relative', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.1)' }}>
        {preset.logoTopAsset && <img src={preset.logoTopAsset} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', bottom: 3, right: 3, width: 10, height: 10, borderRadius: '50%', background: previewColor, boxShadow: `0 0 4px ${previewColor}`, border: '1.5px solid rgba(255,255,255,0.8)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--fem-darker)' : 'var(--fem-dark)', transition: 'color 0.15s' }}>{preset.label}</div>
        <div style={{ fontSize: 10, color: 'var(--fem-muted)', marginTop: 2 }}>{preset.bgColor} · {previewColor}</div>
      </div>
      {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fem-base)', flexShrink: 0 }} />}
      {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fem-muted)', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0, marginLeft: 2 }}>×</button>}
    </div>
  );
}

// ── SyntaxThemeCard — shows colour swatches + name, highlights active ─────────
function SyntaxThemeCard({ st, active, onApply }: { st: typeof SYNTAX_THEMES[number]; active: boolean; onApply: () => void }) {
  const [hov, setHov] = useState(false);
  // Mini code preview: keyword, function, string, number, comment token colours
  const tokens: { color: string; label: string }[] = [
    { color: st.kw,  label: 'kw'  },
    { color: st.fn,  label: 'fn'  },
    { color: st.str, label: 'str' },
    { color: st.num, label: 'num' },
    { color: st.cmt, label: 'cmt' },
  ];
  return (
    <div
      onClick={onApply}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
        background: active ? 'var(--fem-a15)' : hov ? 'var(--fem-a08)' : 'transparent',
        border: `1px solid ${active ? 'var(--fem-a40)' : hov ? 'var(--fem-a22)' : 'var(--fem-a15)'}`,
        boxShadow: active ? 'var(--fem-inset-sm)' : 'none',
      }}
    >
      {/* Colour swatch strip */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {tokens.map(tok => (
          <div key={tok.label} title={tok.label} style={{ width: 12, height: 28, borderRadius: 4, background: tok.color, boxShadow: active ? `0 0 4px ${tok.color}66` : 'none', transition: 'box-shadow 0.15s' }} />
        ))}
      </div>

      {/* Label + mini code snippet */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--fem-darker)' : 'var(--fem-dark)', marginBottom: 3, transition: 'color 0.15s' }}>{st.label}</div>
        <div style={{ fontFamily: 'Consolas, monospace', fontSize: 10, lineHeight: 1.4, letterSpacing: 0 }}>
          <span style={{ color: st.kw }}>local </span>
          <span style={{ color: st.fn }}>x</span>
          <span style={{ color: 'var(--fem-muted)' }}> = </span>
          <span style={{ color: st.str }}>"hi"</span>
          <span style={{ color: 'var(--fem-muted)' }}> </span>
          <span style={{ color: st.cmt }}>-- </span>
          <span style={{ color: st.num }}>42</span>
        </div>
      </div>

      {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fem-base)', flexShrink: 0 }} />}
    </div>
  );
}

export function VisualsTab() {
  const { theme, setTheme, islandStyle } = useFemTheme();
  const [localH, setLocalH] = useState(theme.hue);
  const [localS, setLocalS] = useState(theme.sat);
  const [localL, setLocalL] = useState(theme.lit);
  const [bgH, setBgH] = useState(0);
  const [bgS, setBgS] = useState(0);
  const [bgL, setBgL] = useState(98);
  const [shadowSize,     setShadowSizeLocal]     = useState(theme.shadowSize     ?? 100);
  const [shadowStrength, setShadowStrengthLocal] = useState(theme.shadowStrength ?? 100);
  const [uploading, setUploading] = useState(false);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [newThemeName, setNewThemeName] = useState('');
  const themeCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgCommitTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocalH(theme.hue); setLocalS(theme.sat); setLocalL(theme.lit); }, [theme.hue, theme.sat, theme.lit]);
  useEffect(() => { setShadowSizeLocal(theme.shadowSize ?? 100); }, [theme.shadowSize]);
  useEffect(() => { setShadowStrengthLocal(theme.shadowStrength ?? 100); }, [theme.shadowStrength]);
  useEffect(() => { const { h, s, l } = hexToHsl(theme.bgColor); setBgH(h); setBgS(s); setBgL(l); }, [theme.bgColor]);
  useEffect(() => { setSavedThemes(loadSavedThemesSync()); }, []);

  const handleSaveTheme = useCallback(() => {
    const name = newThemeName.trim(); if (!name) return;
    const entry: SavedTheme = { name, theme: { ...theme }, savedAt: Date.now() };
    setSavedThemes(prev => { const existing = prev.findIndex(t => t.name === name); const next = existing >= 0 ? prev.map((t, i) => i === existing ? entry : t) : [...prev, entry]; persistSavedThemes(next); return next; });
    setNewThemeName('');
  }, [theme, newThemeName]);

  const handleLoadTheme = useCallback((saved: SavedTheme) => {
    const t = saved.theme as any;
    if (t.hue !== undefined && t.sat !== undefined && t.lit !== undefined) { setLocalH(t.hue); setLocalS(t.sat); setLocalL(t.lit); }
    if (t.shadowSize     !== undefined) setShadowSizeLocal(t.shadowSize);
    if (t.shadowStrength !== undefined) setShadowStrengthLocal(t.shadowStrength);
    setTheme(t);
  }, [setTheme]);

  const handleDeleteTheme = useCallback((name: string) => {
    setSavedThemes(prev => { const next = prev.filter(t => t.name !== name); persistSavedThemes(next); return next; });
  }, []);

  const handleThemeColorChange = useCallback((h: number, s: number, l: number) => {
    setLocalH(h); setLocalS(s); setLocalL(l);
    if (themeCommitTimer.current) clearTimeout(themeCommitTimer.current);
    themeCommitTimer.current = setTimeout(() => setTheme({ hue: h, sat: s, lit: l }), 40);
  }, [setTheme]);

  const handleBgColorChange = useCallback((h: number, s: number, l: number) => {
    setBgH(h); setBgS(s); setBgL(l);
    if (bgCommitTimer.current) clearTimeout(bgCommitTimer.current);
    bgCommitTimer.current = setTimeout(() => setTheme({ bgColor: hslToHex(h, s, l) }), 40);
  }, [setTheme]);

  const handleUploadBg = useCallback(async () => {
    setUploading(true);
    const url = await pickImageAsDataUrl();
    if (url) setTheme({ bgImageUrl: url, bgMode: 'image', presetName: '' } as any);
    setUploading(false);
  }, [setTheme]);

  const UI_PRESETS: UiPreset[] = [
    { label: 'Astolfo', hue: 315, sat: 100, lit: 75, bgColor: '#fff5fb', bgImageAsset: astolfoAsset, logoTopAsset: topImgDefault, logoBottomAsset: bottomImgDefault },
    { label: 'Boy Kisser', hue: 0, sat: 0, lit: 28, bgColor: '#d1d1d1', bgImageAsset: boyKisserBg, logoTopAsset: boyKisserTop, logoBottomAsset: boyKisserBottom },
  ];

  const activePresetLabel = (theme as any).presetName || null;

  const applyPreset = useCallback((preset: UiPreset) => {
    setLocalH(preset.hue); setLocalS(preset.sat); setLocalL(preset.lit);
    setTheme({
      hue: preset.hue, sat: preset.sat, lit: preset.lit,
      bgColor: preset.bgColor,
      bgImageUrl: '',
      bgMode: 'image',
      logoTopUrl: '',
      logoBottomUrl: '',
      presetName: preset.label,
    } as any);
  }, [setTheme]);

  // Active syntax theme — default to DEFAULT_SYNTAX_THEME if not set in theme yet
  const activeSyntaxThemeLabel: string = (theme as any).syntaxTheme ?? DEFAULT_SYNTAX_THEME;

  const bgImageEnabled = theme.bgMode === 'image' && !!(theme.bgImageUrl || (theme as any).presetName);
  const currentThemeHex = hslToHex(localH, localS, localL);
  const currentBgHex    = hslToHex(bgH, bgS, bgL);
  const previewColor    = `hsl(${localH},${localS}%,${localL}%)`;

  return (
    <div style={{ ...islandStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 44, flexShrink: 0, borderBottom: '1px solid var(--fem-a15)' }}>
        <span style={{ color: 'var(--fem-dark)', fontSize: 13, fontWeight: 600 }}>Visuals</span>
        <div style={{ marginLeft: 10, width: 12, height: 12, borderRadius: '50%', background: previewColor, boxShadow: `0 0 8px ${previewColor}`, border: '1.5px solid rgba(255,255,255,0.6)' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Section title="Presets">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {UI_PRESETS.map(preset => (
              <PresetCard key={preset.label} preset={preset} active={activePresetLabel === preset.label} onApply={() => applyPreset(preset)} />
            ))}
            {savedThemes.map(saved => {
              const t = saved.theme as any;
              const asPreset: UiPreset = { label: saved.name, hue: t.hue ?? 315, sat: t.sat ?? 100, lit: t.lit ?? 75, bgColor: t.bgColor ?? '#fff5fb', bgImageAsset: t.bgImageUrl ?? '', logoTopAsset: t.logoTopUrl ?? '', logoBottomAsset: t.logoBottomUrl ?? '' };
              const isActive = theme.hue === asPreset.hue && theme.sat === asPreset.sat && theme.lit === asPreset.lit && theme.bgColor === asPreset.bgColor;
              return <PresetCard key={saved.name} preset={asPreset} active={isActive} onApply={() => handleLoadTheme(saved)} onDelete={() => handleDeleteTheme(saved.name)} />;
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: savedThemes.length > 0 ? 4 : 0 }}>
            <input value={newThemeName} onChange={e => setNewThemeName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveTheme(); }} placeholder="Save current theme as preset…"
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a22)', boxShadow: 'var(--fem-inset-sm)', color: 'var(--fem-darker)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={handleSaveTheme} disabled={!newThemeName.trim()}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: newThemeName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a30)', color: 'var(--fem-muted)', boxShadow: 'var(--fem-glow-sm)', transition: 'all .15s', opacity: newThemeName.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>Save</button>
          </div>
        </Section>

        <CollapsibleSection title="Theme Color" defaultOpen={false}>
          <div>
            <Label>Presets</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {THEME_PRESETS.map(p => (
                <button key={p.label} title={p.label} onClick={() => handleThemeColorChange(p.h, p.s, p.l)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: `hsl(${p.h},${p.s}%,${p.l}%)`, cursor: 'pointer', flexShrink: 0, boxShadow: (localH===p.h && localS===p.s && localL===p.l) ? `0 0 0 2.5px white, 0 0 0 4px hsl(${p.h},${p.s}%,${p.l}%)` : '0 2px 6px rgba(0,0,0,0.15)', transition: 'box-shadow 0.15s' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <ColorWheel hue={localH} sat={localS} lit={localL} onChange={handleThemeColorChange} />
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FemSlider label="Hue" value={localH} min={0} max={359} unit="°" onChange={h => handleThemeColorChange(h, localS, localL)} gradient="linear-gradient(to right,hsl(0,90%,65%),hsl(30,90%,65%),hsl(60,90%,65%),hsl(120,90%,65%),hsl(180,90%,65%),hsl(240,90%,65%),hsl(300,90%,65%),hsl(360,90%,65%))" />
              <FemSlider label="Saturation" value={localS} unit="%" onChange={s => handleThemeColorChange(localH, s, localL)} />
              <FemSlider label="Lightness" value={localL} unit="%" onChange={l => handleThemeColorChange(localH, localS, l)} />
              <div><Label>Hex</Label><HexInput value={currentThemeHex} onChange={hex => { const { h, s, l } = hexToHsl(hex); handleThemeColorChange(h, s, l); }} /></div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--fem-a15)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FemSlider
              label="Shadow Size"
              value={shadowSize}
              min={0}
              max={200}
              unit=""
              onChange={v => { setShadowSizeLocal(v); setTheme({ shadowSize: v }); }}
            />
            <FemSlider
              label="Shadow Strength"
              value={shadowStrength}
              min={0}
              max={200}
              unit="%"
              onChange={v => { setShadowStrengthLocal(v); setTheme({ shadowStrength: v }); }}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Background Color" defaultOpen={false}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <ColorWheel hue={bgH} sat={bgS} lit={bgL} onChange={handleBgColorChange} />
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FemSlider label="Hue" value={bgH} min={0} max={359} unit="°" onChange={h => handleBgColorChange(h, bgS, bgL)} gradient="linear-gradient(to right,hsl(0,90%,65%),hsl(30,90%,65%),hsl(60,90%,65%),hsl(120,90%,65%),hsl(180,90%,65%),hsl(240,90%,65%),hsl(300,90%,65%),hsl(360,90%,65%))" />
              <FemSlider label="Saturation" value={bgS} unit="%" onChange={s => handleBgColorChange(bgH, s, bgL)} />
              <FemSlider label="Lightness" value={bgL} unit="%" onChange={l => handleBgColorChange(bgH, bgS, l)} />
              <div><Label>Hex</Label><HexInput value={currentBgHex} onChange={hex => { const { h, s, l } = hexToHsl(hex); handleBgColorChange(h, s, l); }} /></div>
              <div>
                <Label>Quick picks</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[{ label: 'Soft Pink', c: '#fff5fb' },{ label: 'White', c: '#ffffff' },{ label: 'Off-White', c: '#fafafa' },{ label: 'Lavender', c: '#f5f0ff' },{ label: 'Dark Navy', c: '#1a1a2e' },{ label: 'Deep Dark', c: '#0f0f23' },{ label: 'Dark Rose', c: '#1a0a2e' },{ label: 'Charcoal', c: '#16213e' }].map(({ label: lbl, c }) => (
                    <button key={c} title={lbl} onClick={() => { const { h, s, l } = hexToHsl(c); handleBgColorChange(h, s, l); }} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: c, cursor: 'pointer', flexShrink: 0, boxShadow: theme.bgColor === c ? '0 0 0 2px white, 0 0 0 3.5px var(--fem-base)' : '0 1px 4px rgba(0,0,0,0.15)', transition: 'box-shadow .15s' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <FemSlider label="Panel Opacity" value={theme.fgOpacity} unit="%" onChange={v => setTheme({ fgOpacity: v })} />
        </CollapsibleSection>

        <CollapsibleSection title="App Icons & Background Image" defaultOpen={true}>
          <ImageUploadCard label="Top-Left Logo" currentUrl={theme.logoTopUrl} defaultSrc={topImgDefault} onUpload={url => setTheme({ logoTopUrl: url, presetName: '' } as any)} onClear={() => setTheme({ logoTopUrl: '' })} />
          <ImageUploadCard label="Bottom-Left Avatar" currentUrl={theme.logoBottomUrl} defaultSrc={bottomImgDefault} onUpload={url => setTheme({ logoBottomUrl: url, presetName: '' } as any)} onClear={() => setTheme({ logoBottomUrl: '' })} />
          <div style={{ borderTop: '1px solid var(--fem-a15)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Label>Background Image</Label>
              <PillToggle on={bgImageEnabled} onToggle={() => { if (bgImageEnabled) { setTheme({ bgMode: 'color', presetName: '' } as any); } else if (theme.bgImageUrl) { setTheme({ bgMode: 'image' }); } else { handleUploadBg(); } }} />
            </div>
            {theme.bgImageUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 80, flexShrink: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--fem-a25)', boxShadow: 'var(--fem-inset-sm)', opacity: bgImageEnabled ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <img src={theme.bgImageUrl} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={handleUploadBg} disabled={uploading} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a30)', color: 'var(--fem-muted)', boxShadow: 'var(--fem-glow-sm)', transition: 'all .15s', opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Loading…' : '↑ Replace'}</button>
                  <button onClick={() => setTheme({ bgImageUrl: '', bgMode: 'color', presetName: '' } as any)} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--fem-a20)', color: 'var(--fem-dim)', transition: 'all .15s' }}>Remove</button>
                </div>
              </div>
            ) : (
              <button onClick={handleUploadBg} disabled={uploading} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: 'var(--fem-island-bg)', border: '1px solid var(--fem-a30)', color: 'var(--fem-muted)', boxShadow: 'var(--fem-glow-sm)', transition: 'all .15s', opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Loading…' : '↑ Upload Image'}</button>
            )}
            {bgImageEnabled && <div style={{ marginTop: 10 }}><FemSlider label="Image Opacity" value={theme.bgOpacity} unit="%" onChange={v => setTheme({ bgOpacity: v })} /></div>}
          </div>
        </CollapsibleSection>

        {/* ── SYNTAX THEME ─────────────────────────────────────────────────── */}
        <CollapsibleSection title="Syntax Theme" defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SYNTAX_THEMES.map(st => (
              <SyntaxThemeCard
                key={st.label}
                st={st}
                active={activeSyntaxThemeLabel === st.label}
                onApply={() => setTheme({ syntaxTheme: st.label } as any)}
              />
            ))}
          </div>
        </CollapsibleSection>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => {
            handleThemeColorChange(315, 100, 75);
            setShadowSizeLocal(100);
            setShadowStrengthLocal(100);
            setTheme({ bgColor: '#fff5fb', bgMode: 'color', bgImageUrl: '', fgOpacity: 100, bgOpacity: 100, shadowSize: 100, shadowStrength: 100, logoTopUrl: '', logoBottomUrl: '', presetName: '', syntaxTheme: DEFAULT_SYNTAX_THEME } as any);
          }}
            style={{ padding: '6px 16px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--fem-a20)', color: 'var(--fem-dim)', transition: 'all .15s' }}>
            Reset to default
          </button>
        </div>
      </div>
    </div>
  );
}