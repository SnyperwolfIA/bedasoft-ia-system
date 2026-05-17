'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, LayoutGrid, Layers, Users, Mail, Database, CheckCircle2, Cloud, HardDrive } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'ACCESO CONCEDIDO. INICIALIZANDO...' });
        localStorage.setItem('bedasoft_user', JSON.stringify(data.user));
        setTimeout(() => { router.push('/dashboard'); }, 1000);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'FALLO CRÍTICO DE CONEXIÓN.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', zIndex: 10, marginBottom: '3.5rem', position: 'relative' }}>
        <h1 className="imposing-title">BEDASOFT IA</h1>
        <p className="subtitle">Quantum Protocol v2.0</p>
      </div>

      <div className="glass-card" style={{ width: '100%', maxWidth: '460px', zIndex: 10 }}>
        {message && (
          <div style={{ marginBottom: '1.5rem', padding: '0.9rem', borderRadius: '12px', fontSize: '0.7rem', fontFamily: 'JetBrains Mono', textAlign: 'center', background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.2)', color: '#00f2fe', textTransform: 'uppercase' }}>
            {message.text}
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            <h2 className="tech-font" style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 900, color: 'white', letterSpacing: '0.15em', textTransform: 'uppercase' }}>User Access</h2>
            <div className="input-group">
              <label>Email ID</label>
              <input type="email" placeholder="operador@bedasoft.ai" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Security Key</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary tech-font" disabled={loading}>
              {loading ? 'PROCESANDO...' : 'INICIAR SESIÓN'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
