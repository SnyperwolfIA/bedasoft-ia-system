'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, LogOut, ChevronLeft, ShieldCheck, Activity, Search, Sun, Moon } from 'lucide-react';

export default function GlobalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [time, setTime] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const isHome = pathname === '/';
  const isIframe = typeof window !== 'undefined' && window.location.search.includes('iframe=true');
  const isDashboard = pathname === '/dashboard';
  
  useEffect(() => {
    const savedUser = localStorage.getItem('bedasoft_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    // Load active theme from localStorage
    const savedTheme = localStorage.getItem('bedasoft_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }

    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sync theme selection to body element classes dynamically
  useEffect(() => {
    if (pathname.startsWith('/dashboard')) {
      if (theme === 'light') {
        document.body.classList.add('light-dashboard-theme');
        document.body.classList.remove('dark-dashboard-theme', 'bg-black');
      } else {
        document.body.classList.add('dark-dashboard-theme');
        document.body.classList.remove('light-dashboard-theme', 'bg-black');
      }
    } else {
      document.body.classList.remove('light-dashboard-theme', 'dark-dashboard-theme');
      document.body.classList.add('bg-black');
    }
  }, [pathname, theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('bedasoft_theme', nextTheme);
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      localStorage.removeItem('bedasoft_user');
      setUser(null);
      router.push('/');
    });
  };

  if (isHome || isIframe) return null;

  return (
    <header className="sticky top-0 z-[200] w-full bg-transparent">
      {/* HUD Container */}
      <div className={`relative left-1/2 -translate-x-1/2 w-full max-w-[1400px] px-6 group ${isDashboard ? 'py-6' : 'py-3'}`}>
        
        {/* Outer HUD Border Layer (Decorative Glow) */}
        <div className="absolute -inset-[1px] bg-primary/20 astra-hud-border blur-[2px] opacity-50 group-hover:opacity-100 transition-opacity" />

        {/* Main Header Glass Panel with Astra Shape */}
        <div className="astra-hud-border astra-hud-glow overflow-hidden border border-primary/20 bg-black/90 backdrop-blur-3xl relative">
          
          {isDashboard ? (
            <>
              {/* Top Bar: Telemetry, Branding, Profile */}
              <div className="flex justify-between items-stretch px-10 py-6">
                
                {/* LEFT: TELEMETRY (DENSE) */}
                <div className="w-1/4 flex flex-col gap-3 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
                    <span className="tech-font text-[9px] text-white/90 uppercase tracking-widest font-bold">System Status: Optimal</span>
                  </div>
                  
                  <div className="space-y-2 max-w-[180px]">
                    {[
                      { label: 'Core Temp', value: '32°C', color: 'bg-primary', width: '32%' },
                      { label: 'Uplink', value: '98%', color: 'bg-primary shadow-[0_0_8px_#00ffff]', width: '98%' },
                      { label: 'Latency', value: '12ms', color: 'bg-accent', width: '15%' }
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[7px] tech-font text-white/40 uppercase tracking-tighter">
                          <span>{stat.label}</span>
                          <span>{stat.value}</span>
                        </div>
                        <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div className={`h-full ${stat.color}`} initial={{ width: 0 }} animate={{ width: stat.width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CENTER: BRANDING HUB (PREMIUM) */}
                <div className="flex flex-col items-center justify-center relative flex-1">
                   <div className="flex items-center gap-6 mb-2">
                     <div className="relative">
                       <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125" />
                       <img 
                          src="/images/logo_official.png" 
                          alt="Bedasoft" 
                          className="h-16 w-auto cursor-pointer relative z-10 hover:scale-105 transition-transform"
                          onClick={() => router.push('/dashboard')}
                       />
                     </div>
                   </div>
                   <h2 className="font-orbitron text-xl tracking-[0.8em] text-white uppercase ml-[0.8em] font-black">Bedasoft</h2>
                   <span className="font-orbitron text-[8px] tracking-[1.2em] text-primary/40 uppercase ml-[1.2em] mt-1">Intelligence System</span>
                </div>

                {/* RIGHT: OPERATOR & SECURITY */}
                <div className="w-1/4 flex flex-col items-end gap-4 justify-center">
                  {user && (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] tech-font text-white/60 uppercase tracking-widest">{user.name}</span>
                        <span className="text-[8px] tech-font text-primary/60 uppercase tracking-widest font-bold">Admin Level 4</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-center relative astra-hud-glow">
                        <ShieldCheck className="w-5 h-5 text-primary/80" />
                      </div>
                    </div>
                  )}
                  
                  <div className="relative w-full max-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                    <input 
                      type="text" 
                      placeholder="PROTOCOL SEARCH..." 
                      className="w-full bg-white/5 border border-white/5 rounded-md py-1.5 pl-8 pr-3 text-[8px] tech-font text-white outline-none focus:border-primary/20 transition-all uppercase tracking-widest"
                    />
                  </div>
                </div>

              </div>

              {/* BOTTOM HUD ACTION BAR */}
              <div className="border-t border-white/5 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent px-10 py-3 flex justify-between items-center">
                
                <div className="flex items-center gap-8">
                  {/* ADMIN CONTROL LINK */}
                  {user?.jiraRole === 'admin' && (
                    <button
                      onClick={() => router.push('/dashboard/admin')}
                      className="group flex items-center gap-3 tech-font text-[9px] uppercase tracking-[0.4em] text-accent hover:text-white transition-all pl-2"
                    >
                      <Activity className="w-3 h-3 text-accent" />
                      ADMIN CONTROL
                      <div className="h-1 w-1 rounded-full bg-accent animate-pulse" />
                    </button>
                  )}

                  <div className="tech-font text-[8px] uppercase tracking-[0.4em] text-white/20 flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    COMMAND CENTER ACTIVE
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Theme Switcher Button */}
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-white/60 hover:text-white"
                    title={`Cambiar a Tema ${theme === 'dark' ? 'Claro' : 'Oscuro'}`}
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[7.5px] tech-font uppercase tracking-widest">Tema Claro</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-[7.5px] tech-font uppercase tracking-widest">Tema Oscuro</span>
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 tech-font text-[9px] uppercase tracking-[0.4em] text-white/10 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    EXIT
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* SIMPLE HEADER INSIDE MODULES */
            <div className="flex justify-between items-center px-8 py-3.5 flex-wrap md:flex-nowrap gap-4">
              {/* LEFT: BACK BUTTON & BRANDING */}
              <div className="flex items-center gap-5">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="group flex items-center gap-2 tech-font text-[9px] uppercase tracking-[0.4em] text-primary hover:text-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span>VOLVER</span>
                </button>
                
                <div className="h-4 w-[1px] bg-white/10 hidden md:block" />
                
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
                  <img 
                    src="/images/logo_official.png" 
                    alt="Bedasoft" 
                    className="h-8 w-auto hover:scale-105 transition-transform" 
                  />
                  <span className="font-orbitron text-xs tracking-[0.3em] text-white uppercase font-black">Bedasoft</span>
                </div>
              </div>

              {/* CENTER: MODULE TITLE */}
              <div className="tech-font text-[9px] tracking-[0.45em] text-primary/80 uppercase font-black">
                {pathname.includes('facturacion') && 'FACTURACIÓN IA'}
                {pathname.includes('rrhh') && 'TALENTO & RRHH IA'}
                {pathname.includes('jiraneural') && 'JiraNeural Sync'}
                {pathname.includes('admin') && 'CONTROL PANEL'}
              </div>

              {/* RIGHT: OPERATOR & EXIT */}
              <div className="flex items-center gap-5">
                {user && (
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] tech-font text-white/60 uppercase tracking-widest hidden sm:block">{user.name}</span>
                    <div className="w-7 h-7 rounded border border-primary/20 bg-primary/5 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-primary/80" />
                    </div>
                  </div>
                )}
                
                <div className="h-4 w-[1px] bg-white/10" />

                {/* Theme Switcher Button */}
                <button
                  onClick={toggleTheme}
                  className="w-7 h-7 rounded border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
                  title={`Cambiar a Tema ${theme === 'dark' ? 'Claro' : 'Oscuro'}`}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 text-yellow-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </button>

                <div className="h-4 w-[1px] bg-white/10" />
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 tech-font text-[9px] uppercase tracking-[0.4em] text-white/30 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">EXIT</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
