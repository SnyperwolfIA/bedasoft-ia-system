'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Briefcase, Send, Cpu, Loader2, Bot, User, Sparkles, Settings, Globe, Mail, Key, ShieldCheck, MessagesSquare, Sun, Moon
} from 'lucide-react';

export default function JiraNeuralPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Sync initial theme
    const savedTheme = localStorage.getItem('bedasoft_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.body.classList.add('light-dashboard-theme');
        document.body.classList.remove('dark-dashboard-theme', 'bg-black');
      } else {
        document.body.classList.add('dark-dashboard-theme');
        document.body.classList.remove('light-dashboard-theme', 'bg-black');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('bedasoft_theme', nextTheme);
    
    if (nextTheme === 'light') {
      document.body.classList.add('light-dashboard-theme');
      document.body.classList.remove('dark-dashboard-theme', 'bg-black');
    } else {
      document.body.classList.add('dark-dashboard-theme');
      document.body.classList.remove('light-dashboard-theme', 'bg-black');
    }
  };
  
  // Onboarding State
  const [setupData, setSetupData] = useState({ jiraUrl: '', jiraEmail: '', jiraToken: '' });
  const [setupLoading, setSetupLoading] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([
    { role: 'ai', text: 'SISTEMA JIRANEURAL ACTIVO. Enlace inteligente con Atlassian establecido. ¿Qué proyecto gestionamos hoy?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = () => {
      const savedUser = localStorage.getItem('bedasoft_user');
      if (!savedUser) { 
        if (window.location.search.includes('sso_token') || window.location.search.includes('iframe=true')) return false;
        router.push('/'); 
        return true; 
      }
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      checkConfig(parsedUser.email);
      return true;
    };

    if (!checkUser()) {
      const interval = setInterval(() => {
        if (checkUser()) clearInterval(interval);
      }, 200);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }, []);

  const checkConfig = async (email: string) => {
    try {
      const res = await fetch(`/api/auth/user?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.user?.jiraUrl) {
        setConfig({
          url: data.user.jiraUrl,
          email: data.user.jiraEmail,
          role: data.user.jiraRole || 'user'
        });
      }
    } catch (e) {
      console.error('Error checking config', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupLoading(true);
    try {
      const sanitizedUrl = setupData.jiraUrl.replace(/\/$/, '');
      const res = await fetch('/api/jiraneural/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...setupData, 
          jiraUrl: sanitizedUrl,
          userEmail: user?.email 
        })
      });
      const data = await res.json();
      if (data.success) {
        // El API de config ahora devuelve el mensaje con el rol detectado
        // Refrescamos para obtener el objeto completo
        checkConfig(user?.email);
      } else {
        alert(`Error: ${data.error || 'No se pudo sincronizar'}`);
      }
    } catch (err: any) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !user) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', text: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch('/api/jiraneural/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, userEmail: user.email, history: chatMessages })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.response }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: '⚠️ ERROR DE COMUNICACIÓN NEURAL.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const renderMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b style="color: #00ffff; font-weight: 800;">$1</b>')
      .replace(/\n/g, '<br/>');
  };

  if (loading) return null;

  return (
    <main className="flex flex-col items-center h-[calc(100vh-120px)] text-white relative z-[100] overflow-hidden">
      
      {/* Floating Theme Switcher for IFrame users */}
      <div className="absolute top-6 right-8 z-50 flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-white/60 hover:text-white backdrop-blur-md"
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
      </div>
      
      {/* Background Effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] opacity-10 blur-[100px] bg-primary/20 rounded-full animate-pulse" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 w-full max-w-5xl">
        
        {!config ? (
          /* ONBOARDING FORM */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-black/80 backdrop-blur-3xl border border-primary/20 rounded-[40px] p-10 shadow-[0_0_80px_rgba(0,255,255,0.1)]"
          >
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-primary/30">
                <Settings className="w-8 h-8 text-primary animate-spin-slow" />
              </div>
              <h2 className="font-orbitron text-xl tracking-widest text-white">ENLACE JIRANEURAL</h2>
              <p className="tech-font text-[9px] text-primary/60 uppercase mt-2">Configuración de credenciales de instancia</p>
            </div>

            <form onSubmit={handleSetup} className="space-y-6">
              <div className="space-y-2">
                <label className="tech-font text-[9px] text-white/40 uppercase pl-2">URL de Instancia Atlassian</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                  <input 
                    required
                    placeholder="https://tu-dominio.atlassian.net"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs tech-font focus:border-primary/50 transition-all outline-none"
                    value={setupData.jiraUrl}
                    onChange={e => setSetupData({...setupData, jiraUrl: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Email de Administrador</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                  <input 
                    required
                    type="email"
                    placeholder="admin@empresa.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs tech-font focus:border-primary/50 transition-all outline-none"
                    value={setupData.jiraEmail}
                    onChange={e => setSetupData({...setupData, jiraEmail: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="tech-font text-[9px] text-white/40 uppercase pl-2">API Token Secreto</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                  <input 
                    required
                    type="password"
                    placeholder="ATATT..."
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs tech-font focus:border-primary/50 transition-all outline-none"
                    value={setupData.jiraToken}
                    onChange={e => setSetupData({...setupData, jiraToken: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={setupLoading}
                className="w-full bg-primary hover:bg-primary/80 text-black py-4 rounded-xl tech-font text-xs font-bold tracking-widest transition-all shadow-[0_0_30px_rgba(0,255,255,0.2)]"
              >
                {setupLoading ? 'SINCRONIZANDO...' : 'VINCULAR INSTANCIA'}
              </button>
            </form>
          </motion.div>
        ) : (
          /* CHAT INTERFACE */
          <div className="w-full h-[80%] flex flex-col bg-black/80 backdrop-blur-3xl border border-primary/20 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,255,255,0.05)] relative">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <Briefcase className="text-primary w-5 h-5" />
                <div>
                  <h1 className="font-orbitron text-sm tracking-[0.2em] uppercase text-white/90">JiraNeural Sync</h1>
                  <div className="flex items-center gap-2 mt-1">
                     <ShieldCheck className={`w-3 h-3 ${config.role === 'admin' ? 'text-primary' : 'text-white/30'} animate-pulse`} />
                     <span className="tech-font text-[8px] text-primary/50 uppercase tracking-widest">
                       {config.role === 'admin' ? 'Acceso Administrador' : 'Acceso Estándar'}: {config.url}
                     </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scrollbar-hide">
              <AnimatePresence>
                {chatMessages.map((m, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: m.role === 'ai' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`flex gap-4 max-w-[85%] ${m.role === 'ai' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${m.role === 'ai' ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/20'}`}>
                        {m.role === 'ai' ? <Bot className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-white/70" />}
                      </div>
                      <div className={`relative p-5 rounded-3xl ${
                        m.role === 'ai' 
                          ? 'bg-white/[0.03] border border-white/10 rounded-tl-none' 
                          : 'bg-primary/10 border border-primary/20 rounded-tr-none'
                      }`}>
                        <div 
                          className="text-[15px] leading-relaxed font-light"
                          dangerouslySetInnerHTML={{ __html: renderMessage(m.text) }} 
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-4 items-center bg-white/[0.03] border border-white/10 p-4 rounded-3xl rounded-tl-none">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="tech-font text-[10px] uppercase tracking-widest text-primary/60">Analizando en JiraNeural...</span>
                  </div>
                </div>
              )}

              {/* Teams Integration Card */}
              <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center gap-3">
                <span className="tech-font text-[8px] text-white/30 uppercase tracking-[0.3em]">Enlace Neural con Teams</span>
                <a 
                  href="https://teams.microsoft.com/l/chat/0/0?users=28:aa1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d&topicName=JiraNeural%20Sync&message=Hola%20Agente%20Jira.%20Deseo%20gestionar%20mis%20proyectos." 
                  target="_blank" 
                  className="w-full max-w-md py-3 bg-[#4b53bc] hover:bg-[#5a64d1] text-[10px] tech-font rounded-xl flex items-center justify-center gap-3 transition-all border border-white/20 shadow-[0_0_20px_rgba(75,83,188,0.2)] group"
                >
                  <div className="relative">
                    <MessagesSquare size={16} className="group-hover:scale-110 transition-transform" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#4b53bc] animate-pulse" />
                  </div>
                  <span className="font-bold tracking-widest uppercase text-white">Abrir Agente Jira en Teams</span>
                </a>
                <p className="text-[7px] tech-font text-white/20 uppercase tracking-widest">Conversación persistente y segura</p>
              </div>

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/[0.02] border-t border-white/5">
              <form onSubmit={handleChatSend} className="relative group max-w-4xl mx-auto">
                <div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-all rounded-full" />
                <div className="relative flex items-center bg-black/40 border border-white/10 group-focus-within:border-primary/50 rounded-2xl p-2 transition-all">
                  <input 
                    className="flex-1 bg-transparent border-none outline-none px-6 py-3 text-sm placeholder:text-white/20"
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    placeholder="Escribe un comando para JiraNeural..." 
                    disabled={chatLoading} 
                  />
                  <button 
                    type="submit" 
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-primary hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed text-black w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
