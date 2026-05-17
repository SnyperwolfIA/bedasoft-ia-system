'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Users, Send, Cpu, Loader2, Bot, User, Sparkles
} from 'lucide-react';

export default function RRHHPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([
    { role: 'ai', text: 'SISTEMA RRHH ACTIVO. Hola, soy tu Asistente de Gestión de Talento. Tengo acceso a los documentos de convenio y vacaciones. ¿Qué consulta deseas realizar?' }
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
      setUser(JSON.parse(savedUser));
      return true;
    };

    if (!checkUser()) {
      const interval = setInterval(() => {
        if (checkUser()) clearInterval(interval);
      }, 200);
      setTimeout(() => clearInterval(interval), 10000);
    }
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
      const res = await fetch('/api/rrhh/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, userEmail: user.email, history: chatMessages })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.response }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: '⚠️ ERROR DE ENLACE NEURAL. Verifica tu conexión.' }]);
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
    <main className="flex flex-col items-center h-[calc(100vh-120px)] text-white relative z-[100] overflow-hidden">
      
      {/* Background Neural Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] opacity-10 blur-[100px] bg-primary/20 rounded-full animate-pulse" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10 w-full max-w-5xl">
        
        {/* Module ID Tag - Moved closer and styled for perfect centering */}
        <div className="flex items-center gap-3 mb-4 tech-font text-[9px] tracking-[0.5em] text-primary/30 uppercase">
          <div className="w-8 h-[1px] bg-primary/20" />
          Neural RRHH Interface
          <div className="w-8 h-[1px] bg-primary/20" />
        </div>

        {/* Full Screen Chat Container - Perfectly centered */}
        <div className="w-full h-[80%] flex flex-col bg-black/80 backdrop-blur-3xl border border-primary/20 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,255,255,0.05)] relative">
          
          {/* Internal Glow Corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full" />

          {/* Header Console simplified */}
          <div className="flex items-center justify-between px-10 py-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <Users className="text-primary w-5 h-5" />
              <div>
                <h1 className="font-orbitron text-sm tracking-[0.2em] uppercase text-white/90">Gestión de Talento</h1>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
                   <span className="tech-font text-[8px] text-primary/50 uppercase tracking-widest">Análisis Documental Habilitado</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 tech-font text-[8px] text-white/20">
              <span>Drive: Conectado</span>
              <div className="w-[1px] h-3 bg-white/10" />
              <span>Model: Gemini-3</span>
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
                      {m.role === 'ai' && (
                        <div className="absolute -left-1.5 top-0 w-3 h-3 bg-white/[0.03] border-l border-t border-white/10 rotate-[-45deg]" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {chatLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex gap-4 items-center bg-white/[0.03] border border-white/10 p-4 rounded-3xl rounded-tl-none">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="tech-font text-[10px] uppercase tracking-widest text-primary/60">Analizando Documentación...</span>
                </div>
              </motion.div>
            )}
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
                  placeholder="Pregunta sobre el convenio, vacaciones o normativa interna..." 
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
              <div className="mt-4 flex justify-center gap-4 text-[9px] tech-font text-white/30 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> IA de Análisis Documental</span>
                <span className="flex items-center gap-1">Encripción de Punto a Punto</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
