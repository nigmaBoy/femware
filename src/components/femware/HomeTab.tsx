import { useEffect, useRef, useState } from 'react';
import { useFemTheme } from '../../context/themeContext';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(18px)',
      transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function LinkCard({ href, title, sub }: { href: string; title: string; sub: string }) {
  const { derived } = useFemTheme();
  const [hov, setHov] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '16px 18px', borderRadius: 14,
        textDecoration: 'none', cursor: 'pointer', transition: 'all 0.2s',
        background: hov ? derived.a12 : derived.islandBg,
        border: `1px solid ${hov ? derived.a55 : derived.a22}`,
        boxShadow: hov
          ? `inset 0 0 28px ${derived.a33}, 0 6px 22px ${derived.a28}, 0 2px 6px ${derived.a18}`
          : `inset 0 0 18px ${derived.a28}, 0 4px 16px ${derived.a18}, 0 2px 5px ${derived.a12}`,
        flex: 1,
      }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: hov ? 'var(--fem-darker)' : 'var(--fem-dark)', transition: 'color 0.2s' }}>{title}</span>
      <span style={{ fontSize: 11, color: 'var(--fem-muted)', fontWeight: 400, lineHeight: 1.5 }}>{sub}</span>
      <span style={{
        marginTop: 6, fontSize: 10, fontWeight: 600,
        color: 'var(--fem-base)', letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {href.replace('https://', '')}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 8L8 2M8 2H4M8 2V6" stroke="var(--fem-base)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </a>
  );
}

function Blobs() {
  return (
    <>
      <style>{`
        @keyframes blobFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(18px,-12px) scale(1.04)} 66%{transform:translate(-10px,8px) scale(0.97)} }
        @keyframes blobFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-14px,10px) scale(1.03)} 66%{transform:translate(12px,-8px) scale(0.98)} }
        @keyframes blobFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(8px,14px) scale(1.05)} }
        @keyframes heroFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 6 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, var(--fem-a22) 0%, transparent 70%)', animation: 'blobFloat1 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, var(--fem-a22) 0%, transparent 70%)', animation: 'blobFloat2 11s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, var(--fem-a15) 0%, transparent 70%)', animation: 'blobFloat3 7s ease-in-out infinite' }} />
      </div>
    </>
  );
}

export function HomeTab() {
  const { islandStyle, derived } = useFemTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ ...islandStyle, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth', display: 'flex', flexDirection: 'column' }}>

        {/* HERO */}
        <div style={{
          position: 'relative', minHeight: 220,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px 24px 32px',
          borderBottom: `1px solid var(--fem-a18)`,
          boxShadow: `inset 0 -14px 32px var(--fem-a12)`,
          overflow: 'hidden',
        }}>
          <Blobs />
          <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: `1px solid var(--fem-a12)`, animation: 'spin-slow 30s linear infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: `1px dashed var(--fem-a12)`, animation: 'spin-slow 20s linear infinite reverse', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', animation: 'heroFadeIn 0.7s ease forwards' }}>
            <div style={{
              display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
              color: 'var(--fem-base)', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: 20,
              background: 'var(--fem-a12)', border: `1px solid var(--fem-a25)`,
              marginBottom: 14, animation: 'shimmer 3s ease-in-out infinite',
            }}>
              passion project
            </div>
            <h1 style={{
              fontFamily: "'Silva Marine', sans-serif",
              fontSize: 42, fontWeight: 400, margin: '0 0 8px',
              color: 'var(--fem-base)',
              textShadow: `0 0 40px var(--fem-a40), 0 0 80px var(--fem-a20)`,
              letterSpacing: '0.04em', lineHeight: 1.1,
            }}>
              FemWare
            </h1>
            <p style={{ fontSize: 12, color: 'var(--fem-muted)', fontWeight: 400, margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
              A custom UI built for Cosmic. Made with love, maintained by me ❤
            </p>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '20px 20px 14px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>

          <FadeIn delay={0}>
            <div style={{ display: 'flex', gap: 10 }}>
              <LinkCard href="https://discord.gg/PGcBBchSc8" title="My Discord" sub="where i post the random shit i make — scripts, UIs, whatever i feel like." />
              <LinkCard href="https://discord.gg/cosmic" title="Cosmic" sub="The Cosmic exploit server. Go here for support, updates, and the injector." />
            </div>
          </FadeIn>

          <FadeIn delay={40}>
            <div style={{
              borderRadius: 14, padding: '12px 18px',
              background: derived.islandBg,
              border: `1px solid var(--fem-a20)`,
              boxShadow: `inset 0 0 20px var(--fem-a20), 0 4px 16px var(--fem-a12), 0 2px 5px var(--fem-a08)`,
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--fem-muted)', lineHeight: 1.6 }}>
                the original concept for{' '}
                <span style={{ color: 'var(--fem-base)', fontWeight: 600 }}>FemWare</span>
                {' '}was designed by{' '}
                <span style={{ color: 'var(--fem-base)', fontWeight: 600 }}>yvexy</span>
                {' '}as a joke. my friend fedejens showed it to me and i thought it was a funny concept soo i made it. and uhh here we are.
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={80}>
            <div style={{
              borderRadius: 14, padding: '16px 18px',
              background: derived.islandBg,
              border: `1px solid var(--fem-a25)`,
              boxShadow: `inset 0 0 24px var(--fem-a22), 0 4px 18px var(--fem-a15), 0 2px 6px var(--fem-a12)`,
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'var(--fem-a12)', border: `1px solid var(--fem-a25)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="var(--fem-base)" strokeWidth="1.2"/>
                  <path d="M8 5v4M8 11v.5" stroke="var(--fem-base)" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fem-darker)', marginBottom: 5 }}>Heads up</div>
                <div style={{ fontSize: 11, color: 'var(--fem-muted)', lineHeight: 1.65 }}>
                  FemWare is a personal passion project — built for fun, not profit. It's rough around the edges and things will break.
                  If you run into bugs or something feels off, drop it in{' '}
                  <a href="https://discord.gg/PGcBBchSc8" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--fem-base)', fontWeight: 600, textDecoration: 'none' }}>
                    my Discord
                  </a>
                  {' '}and I'll take a look when I can.
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200} style={{ marginTop: 'auto' }}>
            <div style={{
              borderTop: `1px solid var(--fem-a18)`, paddingTop: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 10, color: 'var(--fem-dim)', fontWeight: 400 }}>
                thatonedudetsts · built with too much free time
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fem-base)', fontFamily: "'Silva Marine', sans-serif", letterSpacing: '0.04em' }}>
                FemWare ♡
              </span>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}