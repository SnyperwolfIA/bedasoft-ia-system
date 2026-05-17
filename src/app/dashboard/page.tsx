'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Receipt, LogOut, LayoutGrid, Plus, Users, Briefcase
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'inactive' | 'loading'>('loading');

  useEffect(() => {
    const checkUser = () => {
      const savedUser = localStorage.getItem('bedasoft_user');
      if (!savedUser) { 
        // Si hay un token SSO o estamos en un iframe, no redirigimos, dejamos que el SSOHandler trabaje
        if (window.location.search.includes('sso_token') || window.location.search.includes('iframe=true')) {
          return false;
        }
        router.push('/'); 
        return true; 
      }
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      checkLicense(parsedUser.email);
      return true;
    };

    if (!checkUser()) {
      const interval = setInterval(() => {
        if (checkUser()) clearInterval(interval);
      }, 200);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }, []);

  const checkLicense = async (email: string) => {
    try {
      const res = await fetch(`/api/auth/license-check?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data && data.success) {
        setLicenseStatus(data.status);
      } else {
        // Si la API dice que no éxito pero no hay error de red, asumimos activo para no bloquear
        setLicenseStatus('active');
      }
    } catch (e) {
      console.error('License check failed', e);
      setLicenseStatus('active'); // Fallback en caso de error de red
    }
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      localStorage.removeItem('bedasoft_user');
      localStorage.removeItem('bedasoft_token');
      router.push('/');
    });
  };

  const ALL_MODULES = [
    { 
      id: 'facturacion', 
      title: 'FACTURACIÓN IA', 
      icon: Receipt, 
      path: '/dashboard/modulos/facturacion',
      color: 'text-white'
    },
    { 
      id: 'rrhh', 
      title: 'RRHH IA', 
      icon: Users, 
      path: '/dashboard/modulos/rrhh',
      color: 'text-primary'
    },
    { 
      id: 'jiraneural', 
      title: 'JiraNeural Sync', 
      icon: Briefcase, 
      path: '/dashboard/modulos/jiraneural',
      color: 'text-primary',
      badge: 'Enterprise Ready',
      animate: true
    }
  ];

  if (!user || licenseStatus === 'loading') return null;

  if (licenseStatus === 'inactive') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-8 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-24 h-24 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
            <LogOut size={48} className="text-red-500" />
          </div>
          <h1 className="font-orbitron text-3xl tracking-widest text-red-500 uppercase">SISTEMA BLOQUEADO</h1>
          <p className="tech-font text-xs text-white/40 uppercase tracking-widest leading-loose">
            La licencia de suscripción de su organización ha expirado o ha sido suspendida. 
            Contacte con el departamento técnico de <span className="text-white">Bedasoft IA</span> para restaurar el servicio.
          </p>
          <div className="pt-8">
            <button onClick={handleLogout} className="text-[10px] tech-font uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all underline">Cerrar Sesión</button>
          </div>
        </div>
      </div>
    );
  }

  // Filtrar módulos activos (si es admin ve todo o lo que tenga asignado)
  const activeModulesList = user.activeModules?.split(',').map((m: string) => m.trim()) || [];
  const visibleModules = ALL_MODULES.filter(m => activeModulesList.includes(m.id) || user.jiraRole === 'admin');

  return (
    <main className="flex flex-col min-h-screen text-white relative">
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center relative z-10">
        <div className="grid-hub">
          {visibleModules.map((module) => (
            <div key={module.id} className={`hub-card group ${module.badge ? 'border-primary/40 bg-primary/5' : ''}`} onClick={() => router.push(module.path)}>
              <module.icon className={`hub-card-icon mb-4 ${module.color} ${module.animate ? 'animate-pulse' : ''}`} />
              <h3 className={`hub-card-title ${module.color}`}>{module.title}</h3>
              {module.badge && (
                <div className="absolute top-4 right-4 flex gap-1">
                  <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
                  <span className="text-[7px] tech-font text-primary/60 uppercase tracking-widest">{module.badge}</span>
                </div>
              )}
            </div>
          ))}

          {/* Card Admin (Solo si es admin) */}
          {user.jiraRole === 'admin' && (
            <div className="hub-card group border-accent/40 bg-accent/5" onClick={() => router.push('/dashboard/admin')}>
              <LayoutGrid className="hub-card-icon mb-4 text-accent" />
              <h3 className="hub-card-title text-accent">PANEL DE CONTROL</h3>
              <div className="absolute top-4 right-4 flex gap-1">
                <span className="text-[7px] tech-font text-accent/60 uppercase tracking-widest">Master Admin</span>
              </div>
            </div>
          )}
          
          <div className="hub-card group opacity-20 grayscale cursor-not-allowed">
            <Plus className="hub-card-icon mb-4" />
            <h3 className="hub-card-title">MÁS MÓDULOS</h3>
          </div>
        </div>
      </div>
    </main>
  );
}
