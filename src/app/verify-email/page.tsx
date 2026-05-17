'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no encontrado.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify?token=${token}`);
        const data = await res.json();
        if (data.success) {
          setStatus('success');
          setMessage('Tu cuenta ha sido activada correctamente.');
          setTimeout(() => router.push('/'), 5000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Error al verificar el token.');
        }
      } catch (e) {
        setStatus('error');
        setMessage('Error de conexión con el servidor.');
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#020205] text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md bg-black/60 border border-white/10 rounded-[40px] p-12 text-center backdrop-blur-3xl"
      >
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-primary/5 border border-primary/20 flex items-center justify-center relative">
            {status === 'loading' && <Loader2 className="w-10 h-10 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-10 h-10 text-green-400" />}
            {status === 'error' && <XCircle className="w-10 h-10 text-red-500" />}
            <div className="absolute -inset-4 bg-primary/10 blur-xl rounded-full opacity-50" />
          </div>
        </div>

        <h1 className="font-orbitron text-xl tracking-widest uppercase mb-4">
          {status === 'loading' && 'Verificando Protocolo'}
          {status === 'success' && 'Acceso Verificado'}
          {status === 'error' && 'Fallo de Protocolo'}
        </h1>

        <p className="tech-font text-xs text-white/40 uppercase tracking-widest mb-10 leading-relaxed">
          {message}
        </p>

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[9px] tech-font text-primary animate-pulse">
              <ShieldCheck className="w-4 h-4" />
              SISTEMA LISTO PARA OPERAR
            </div>
            <p className="text-[8px] tech-font text-white/20 uppercase tracking-[0.4em]">Redireccionando en 5 segundos...</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-4 w-full bg-primary text-black py-4 rounded-xl tech-font text-[10px] font-bold uppercase tracking-widest"
            >
              Ir al Login
            </button>
          </div>
        )}

        {status === 'error' && (
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-white/5 border border-white/10 text-white/60 py-4 rounded-xl tech-font text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Volver al Inicio
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
