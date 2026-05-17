'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Briefcase, Send, Cpu, Loader2, Bot, User, Sparkles, Layout
} from 'lucide-react';

export default function JiraPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([
    { role: 'ai', text: 'ENLACE JIRA ACTIVO. Soy tu Gestor Neural de Proyectos. Puedo listar proyectos, ver tickets abiertos o crear nuevas tareas en tu instancia de Atlassian. ¿Por dónde empezamos?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('bedasoft_user');
    if (!savedUser) { router.push('/'); return; }
    setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !user) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', text: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch('/api/jira/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, userEmail: user.email, history: chatMessages })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.response }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: '⚠️ ERROR DE ENLACE JIRA. Verifica las credenciales de la instancia.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const renderMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b style="color: #00ffff; font-weight: 800;">$1</b>')
      .replace(/\n/g, '<br/>');
  };

  if (!user) return null;

  return (
    <main className="flex flex-col h-[calc(100vh-140px)] text-white relative z-[100] overflow-hidden">
      
      {/* Background Neural Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] opacity-10 blur-[100px] bg-blue-500/10 rounded-full animate-pulse" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 w-full max-w-5xl mx-auto">
        
        {/* Module ID Tag */}
        <div className="flex items-center gap-3 mb-6 tech-font text-[10px] tracking-[0.5em] text-primary/40 uppercase">
          <div className="w-12 h-[1px] bg-primary/20" />
          Project Management Core v1.2
          <div className="w-12 h-[1px] bg-primary/20" />
        </div>

        {/* Full Screen Chat Container */}
        <div className="w-full h-[75vh] flex flex-col bg-black/80 backdrop-blur-3xl border border-primary/20 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,100,255,0.1)] relative">
          
          {/* Internal Glow Corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />

          {/* Header Console */}
          <div className="flex items-center justify-between px-10 py-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <Briefcase className="text-primary w-5 h-5" />
              <div>
                <h1 className="font-orbitron text-sm tracking-[0.2em] uppercase text-white/90">Gestión de Proyectos JIRA</h1>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping" />
                   <span className="tech-font text-[8px] text-primary/50 uppercase tracking-widest">Enlace Atlassian Sincronizado</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 tech-font text-[8px] text-white/20">
              <Layout className="w-3 h-3" />
              <span>Project: SCRUM</span>
              <div className="w-[1px] h-3 bg-white/10" />
              <span>Auth: Basic Token</span>
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
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${m.role === 'ai' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/20'}`}>
                      {m.role === 'ai' ? <Bot className="w-5 h-5 text-blue-400" /> : <User className="w-5 h-5 text-white/70" />}
                    </div>
                    <div className={`relative p-5 rounded-3xl ${
                      m.role === 'ai' 
                        ? 'bg-white/[0.03] border border-white/10 rounded-tl-none' 
                        : 'bg-blue-500/10 border border-blue-500/20 rounded-tr-none'
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex gap-4 items-center bg-white/[0.03] border border-white/10 p-4 rounded-3xl rounded-tl-none">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="tech-font text-[10px] uppercase tracking-widest text-primary/60">Accediendo a la API de Jira...</span>
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white/[0.02] border-t border-white/5">
            <form onSubmit={handleChatSend} className="relative group max-w-4xl mx-auto">
              <div className="absolute inset-0 bg-blue-500/5 blur-xl group-focus-within:bg-blue-500/10 transition-all rounded-full" />
              <div className="relative flex items-center bg-black/40 border border-white/10 group-focus-within:border-primary/50 rounded-2xl p-2 transition-all">
                <input 
                  className="flex-1 bg-transparent border-none outline-none px-6 py-3 text-sm placeholder:text-white/20"
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="Crea un ticket, lista tareas o consulta proyectos..." 
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

      </div>
    </main>
  );
}
