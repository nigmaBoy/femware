import { useState, useEffect } from 'react';
import { loadAuthState, saveAuthState, loginWithLicense } from '../../stores/authStore';

interface Props {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: Props) {
  const [licenseKey, setLicenseKey] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuthState().then(state => {
      if (state?.isRemembered && state.licenseKey) {
        setLicenseKey(state.licenseKey);
        setRememberMe(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const session = await loginWithLicense(licenseKey);
      if (session) {
        await saveAuthState(rememberMe, licenseKey, rememberMe ? session : undefined);
        onLogin();
      } else {
        setError('Could not connect to Cosmic');
      }
    } catch {
      setError('Connection failed, try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div data-tauri-drag-region className="fw-island" style={{ width: 340, padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <img src="/src/assets/top img.png" style={{ width: 64, height: 64, borderRadius: 12, border: '2px solid #f698d9', objectFit: 'cover' }} />
        <h1 style={{ fontFamily: 'Segoe UI', fontSize: 22, fontWeight: 700, color: '#a0275e' }}>FemWare</h1>
        <p style={{ fontSize: 13, color: '#c45c8a', marginTop: -8 }}>Powered by Cosmic</p>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" placeholder="License key (optional)" value={licenseKey} onChange={e => setLicenseKey(e.target.value)} autoComplete="off" style={{ width: '100%', padding: '8px 12px', background: '#fff5f8', border: 'none', borderRadius: 8, color: '#d66ba0', fontSize: 13, boxShadow: 'inset 0 0 15px rgba(246,152,217,.6)', outline: 'none' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div onClick={() => setRememberMe(!rememberMe)} style={{ width: 36, height: 20, borderRadius: 10, background: rememberMe ? '#f698d9' : '#fce8f3', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: rememberMe ? 18 : 2, transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 13, color: '#c45c8a' }}>Remember me</span>
          </label>
          {error && <p style={{ fontSize: 12, color: '#e05080', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ padding: '9px 0', background: '#fff0f5', border: 'none', borderRadius: 4, color: '#a0275e', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: 'inset 0 0 12px rgba(246,152,217,.6)', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Connecting...' : 'Launch FemWare'}
          </button>
        </form>
      </div>
    </div>
  );
}