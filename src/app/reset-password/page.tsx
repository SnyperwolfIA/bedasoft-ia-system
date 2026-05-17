'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'LAS CONTRASEÑAS NO COINCIDEN.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        // Store session and redirect
        if (data.token) localStorage.setItem('bedasoft_token', data.token);
        if (data.user) localStorage.setItem('bedasoft_user', JSON.stringify(data.user));
        setMessage({ type: 'success', text: 'CONTRASEÑA ACTUALIZADA. REDIRIGIENDO...' });
        setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'FALLO CRÍTICO DE CONEXIÓN.' });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p style={{ color: '#ff6b63', fontFamily: 'JetBrains Mono', fontSize: '0.75rem', textAlign: 'center' }}>
        TOKEN INVÁLIDO — Solicite un nuevo enlace de recuperación.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
      <h2 className="tech-font" style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 900, color: 'white', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        Nueva Contraseña
      </h2>

      {message && (
        <div style={{
          padding: '0.9rem 1.2rem', borderRadius: '12px', fontSize: '0.7rem',
          fontFamily: 'JetBrains Mono', textAlign: 'center',
          background: message.type === 'success' ? 'rgba(0,242,254,0.08)' : 'rgba(255,69,58,0.08)',
          border: `1px solid ${message.type === 'success' ? 'rgba(0,242,254,0.2)' : 'rgba(255,69,58,0.2)'}`,
          color: message.type === 'success' ? '#00f2fe' : '#ff6b63',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {message.text}
        </div>
      )}

      <div className="input-group">
        <label>Nueva Contraseña</label>
        <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono', marginTop: '0.4rem' }}>
          8+ caracteres, Mayús, Minús, Número y Símbolo
        </p>
      </div>

      <div className="input-group">
        <label>Confirmar Contraseña</label>
        <input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      </div>

      <button type="submit" className="btn-primary tech-font" disabled={loading}>
        {loading ? 'PROCESANDO...' : 'ESTABLECER NUEVA CONTRASEÑA'}
      </button>

      <p style={{ textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase' }}
        onClick={() => window.location.href = '/'}>
        ← Volver al Login
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  return (
    <main
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem',
        position: 'relative', overflow: 'hidden',
        opacity: isMounted ? 1 : 0, transition: 'opacity 0.8s',
      }}
    >
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#050508' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '70%', background: 'rgba(0,242,254,0.06)', borderRadius: '50%', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'rgba(118,75,162,0.07)', borderRadius: '50%', filter: 'blur(120px)' }} />
        <div className="hud-overlay" style={{ opacity: 0.4 }} />
        <div className="scanline" />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', zIndex: 10, marginBottom: '2.5rem' }}>
        <h1 className="imposing-title">BEDASOFT IA</h1>
        <p className="subtitle tech-font">Recovery Protocol</p>
      </div>

      {/* Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: '460px', zIndex: 10 }}>
        <Suspense fallback={<p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: 'JetBrains Mono' }}>Cargando...</p>}>
          <ResetForm />
        </Suspense>
      </div>

      <div style={{ marginTop: '2rem', zIndex: 10, textAlign: 'center', opacity: 0.3 }}>
        <p className="tech-font" style={{ fontSize: '0.6rem', letterSpacing: '0.5em', textTransform: 'uppercase' }}>Bedasoft Engine v2.0</p>
      </div>
    </main>
  );
}
