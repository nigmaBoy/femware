import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { loadPersistedJson, savePersistedJson } from '../stores/persistedJson';

export interface FemTheme {
  hue: number;
  sat: number;
  lit: number;
  bgColor: string;
  bgMode: 'color' | 'image' | 'astolfo';
  bgImageUrl: string;
  fgOpacity: number;
  bgOpacity: number;
  shadowSize: number;
  shadowStrength: number;
  logoTopUrl: string;
  logoBottomUrl: string;
  presetName?: string;
}

const DEFAULTS: FemTheme = {
  hue: 315, sat: 100, lit: 75,
  bgColor: '#fff5fb', bgMode: 'color', bgImageUrl: '',
  fgOpacity: 100, bgOpacity: 100, shadowSize: 100, shadowStrength: 100,
  logoTopUrl: '', logoBottomUrl: '', presetName: '',
};

const FILE = 'fem-theme.json';

export interface DerivedTheme {
  h: number; s: number; l: number;
  base: string; dark: string; darker: string; muted: string; dim: string;
  a08: string; a12: string; a15: string; a18: string; a20: string;
  a22: string; a25: string; a28: string; a30: string; a33: string;
  a40: string; a45: string; a50: string; a55: string; a65: string; a80: string;
  glowSm: string; glowMd: string; glowLg: string;
  insetSm: string; insetMd: string; insetLg: string; insetXl: string;
  islandBg: string; islandShadow: string;
}

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

export function derive(t: FemTheme): DerivedTheme {
  const { hue: h, sat: s, lit: l, fgOpacity, shadowSize, shadowStrength } = t;
  const fo = fgOpacity / 100;
  const ss = (shadowSize ?? 100) / 100;
  const sf = ((shadowStrength ?? 100) / 100) * 1.5;
  const ibgS = s * 0.15;
  const ibgL = 98;
  const islandBg = fo < 1 ? `hsla(${h},${ibgS}%,${ibgL}%,${fo})` : `hsl(${h},${ibgS}%,${ibgL}%)`;
  return {
    h, s, l,
    base:   hsl(h, s, l),
    dark:   hsl(h, s, Math.max(30, l - 25)),
    darker: hsl(h, s, Math.max(20, l - 38)),
    muted:  hsl(h, Math.max(0, s * 0.45), Math.min(80, l + 8)),
    dim:    hsl(h, Math.max(0, s * 0.28), Math.min(88, l + 16)),
    a08: hsl(h,s,l,0.08), a12: hsl(h,s,l,0.12), a15: hsl(h,s,l,0.15),
    a18: hsl(h,s,l,0.18), a20: hsl(h,s,l,0.20), a22: hsl(h,s,l,0.22),
    a25: hsl(h,s,l,0.25), a28: hsl(h,s,l,0.28), a30: hsl(h,s,l,0.30),
    a33: hsl(h,s,l,0.33), a40: hsl(h,s,l,0.40), a45: hsl(h,s,l,0.45),
    a50: hsl(h,s,l,0.50), a55: hsl(h,s,l,0.55), a65: hsl(h,s,l,0.65),
    a80: hsl(h,s,l,0.80),
    glowSm: `0 0 8px ${hsl(h,s,l,0.4)}`,
    glowMd: `0 0 16px ${hsl(h,s,l,0.5)}`,
    glowLg: `0 6px 22px ${hsl(h,s,l,0.28)}, 0 2px 6px ${hsl(h,s,l,0.18)}`,
    insetSm: `inset 0 0 ${10*ss}px ${hsl(h,s,l,0.20*fo*sf)}`,
    insetMd: `inset 0 0 ${20*ss}px ${hsl(h,s,l,0.45*fo*sf)}`,
    insetLg: `inset 0 0 ${30*ss}px ${hsl(h,s,l,0.60*fo*sf)}`,
    insetXl: `inset 0 0 ${40*ss}px ${hsl(h,s,l,0.80*fo*sf)}`,
    islandBg,
    islandShadow: `inset 0px 0px ${40*ss}px ${hsl(h,s,l,0.8*fo*sf)}`,
  };
}

function injectCssVars(d: DerivedTheme) {
  const r = document.documentElement.style;
  r.setProperty('--fem-h', String(d.h));
  r.setProperty('--fem-s', `${d.s}%`);
  r.setProperty('--fem-l', `${d.l}%`);
  r.setProperty('--fem-base', d.base);
  r.setProperty('--fem-dark', d.dark);
  r.setProperty('--fem-darker', d.darker);
  r.setProperty('--fem-muted', d.muted);
  r.setProperty('--fem-dim', d.dim);
  (['08','12','15','18','20','22','25','28','30','33','40','45','50','55','65','80'] as const)
    .forEach(k => r.setProperty(`--fem-a${k}`, (d as any)[`a${k}`]));
  r.setProperty('--fem-glow-sm', d.glowSm);
  r.setProperty('--fem-glow-md', d.glowMd);
  r.setProperty('--fem-glow-lg', d.glowLg);
  r.setProperty('--fem-inset-sm', d.insetSm);
  r.setProperty('--fem-inset-md', d.insetMd);
  r.setProperty('--fem-inset-lg', d.insetLg);
  r.setProperty('--fem-inset-xl', d.insetXl);
  r.setProperty('--fem-island-bg', d.islandBg);
  r.setProperty('--fem-island-shadow', d.islandShadow);
  const hRot = d.h - 315;
  r.setProperty('--fem-icon-filter',
    `brightness(0) saturate(100%) invert(73%) sepia(36%) saturate(937%) hue-rotate(${hRot+286}deg) brightness(101%) contrast(96%)`);
  r.setProperty('--fem-icon-filter-inactive',
    `brightness(0) saturate(100%) invert(80%) sepia(15%) saturate(600%) hue-rotate(${hRot+286}deg) brightness(95%) contrast(90%)`);
}

// ─── Module-level initial theme — gets populated by preloadTheme() before first render
let _initialTheme: FemTheme = DEFAULTS;

export async function preloadTheme(): Promise<void> {
  const saved = await loadPersistedJson<FemTheme | null>(FILE, null);
  if (saved) _initialTheme = { ...DEFAULTS, ...saved };
  injectCssVars(derive(_initialTheme));
}

interface ThemeCtx {
  theme: FemTheme;
  derived: DerivedTheme;
  setTheme: (patch: Partial<FemTheme>) => void;
  islandStyle: React.CSSProperties;
  appBgStyle: React.CSSProperties;
  astolfoUrl: string;
}

const Ctx = createContext<ThemeCtx | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  astolfoAssetUrl?: string;
}

export function ThemeProvider({ children, astolfoAssetUrl = '' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<FemTheme>(_initialTheme);

  const derived = derive(theme);

  useEffect(() => {
    injectCssVars(derived);
  }, [theme]);

  const setTheme = useCallback((patch: Partial<FemTheme>) => {
    setThemeState(prev => {
      const next = { ...prev, ...patch };
      savePersistedJson(FILE, next).catch(() => {});
      return next;
    });
  }, []);

  const islandStyle: React.CSSProperties = {
    background: derived.islandBg,
    boxShadow: derived.islandShadow,
    borderRadius: 6,
  };

  const bgOpacity = theme.bgOpacity / 100;
  let appBgStyle: React.CSSProperties = {};

  if (theme.bgMode === 'color') {
    appBgStyle = { background: hexWithOpacity(theme.bgColor, bgOpacity) };
  } else {
    const url = theme.bgMode === 'astolfo' ? astolfoAssetUrl : theme.bgImageUrl;
    appBgStyle = {
      backgroundImage: url ? `url(${url})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: bgOpacity,
    };
  }

  return (
    <Ctx.Provider value={{ theme, derived, setTheme, islandStyle, appBgStyle, astolfoUrl: astolfoAssetUrl }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFemTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFemTheme must be used inside ThemeProvider');
  return ctx;
}

function hexWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  if (isNaN(r)) return hex;
  return `rgba(${r},${g},${b},${opacity})`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max+min)/2;
  if (max !== min) {
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h=((g-b)/d+(g<b?6:0))/6; break;
      case g: h=((b-r)/d+2)/6; break;
      case b: h=((r-g)/d+4)/6; break;
    }
  }
  return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn=s/100, ln=l/100;
  const a=sn*Math.min(ln,1-ln);
  const f=(n:number)=>{
    const k=(n+h/30)%12;
    const color=ln-a*Math.max(-1,Math.min(k-3,9-k,1));
    return Math.round(255*color).toString(16).padStart(2,'0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}