'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Receipt, LogOut, ChevronLeft, Send, TrendingUp,
  Cpu, Loader2, FileText, ChevronRight, ChevronLeft as ChevLeft, Search, Cloud, MessagesSquare, Sun, Moon
} from 'lucide-react';

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

export default function FacturacionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
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
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([
    { role: 'ai', text: '¡Hola! Soy tu Asistente de Facturación Neural. ¿Qué proceso iniciamos hoy?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 5, totalPages: 1 });
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [stats, setStats] = useState<number[]>(new Array(12).fill(0));

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
      fetchStats(parsedUser.email);
      fetchInvoices(parsedUser.email, 1);
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

  const fetchStats = async (email: string) => {
    try {
      const res = await fetch(`/api/billing/stats?userEmail=${encodeURIComponent(email)}`);
      const d = await res.json();
      if (d.success) setStats(d.monthlyTotals);
    } catch {}
  };

  const fetchInvoices = async (email: string, page: number) => {
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/api/billing/invoices?userEmail=${encodeURIComponent(email)}&page=${page}&limit=5`);
      const d = await res.json();
      if (d.success) {
        setInvoices(d.invoices);
        setPagination(d.pagination);
      }
    } catch {} finally {
      setInvoicesLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (!user) return;
    fetchInvoices(user.email, newPage);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !user) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', text: msg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch('/api/billing/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, userEmail: user.email, history: chatMessages })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.response }]);
      
      // LOGIC UPGRADE: Auto-refresh data on AI actions
      if (data.action) {
        fetchStats(user.email);
        fetchInvoices(user.email, 1);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: '⚠️ Error de conexión.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.numFactura.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.client?.name || 'Venta Directa').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.numPedido || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const invDate = new Date(inv.createdAt || inv.issueDate || new Date()).toISOString().split('T')[0];
    const matchesDate = !dateFilter || invDate === dateFilter;
    
    return matchesSearch && matchesDate;
  });

  const renderMessage = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>');
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      localStorage.removeItem('bedasoft_user');
      localStorage.removeItem('bedasoft_token');
      router.push('/');
    });
  };

  const maxStat = Math.max(...stats, 1);
  if (!user) return null;

  return (
    <main className="flex flex-col min-h-screen text-white relative z-[100]">
      
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
      
      {/* Header local eliminado - Ahora se usa el GlobalHeader */}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center relative mt-16">
        <div className="glass-mask max-w-7xl">
          <motion.div key="billing" className="w-full" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          
          <div className="billing-grid">
            {/* Chat Box */}
            <div className="chat-box" style={{ background: 'rgba(10,10,20,0.95)', borderColor: 'rgba(0,255,255,0.2)' }}>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                <Cpu className="text-primary animate-pulse w-5 h-5" />
                <span className="tech-font text-xs tracking-widest uppercase" style={{ color: '#00ffff' }}>Asistente de Facturación Neural</span>
              </div>
              <div className="chat-messages-area">
                {chatMessages.map((m, i) => (
                  <div key={i} className={m.role === 'ai' ? 'chat-message-ai' : 'chat-message-user'}>
                    <div dangerouslySetInnerHTML={{ __html: renderMessage(m.text) }} />
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <div className="tech-font text-[8px] text-white/30 uppercase tracking-[0.3em] text-center mb-1">Enlace Neural con Microsoft Teams</div>
                <a 
                  href={`https://teams.microsoft.com/l/chat/0/0?users=28:1cbb0b14-cfd9-4e8d-a65e-f5e64c949bb0&topicName=Bedasoft%20IA%20Agent&message=Hola%20Agente%20Bedasoft.%20Deseo%20continuar%20con%20la%20gestion%20de%20facturacion.`} 
                  target="_blank" 
                  className="w-full py-4 bg-[#4b53bc] hover:bg-[#5a64d1] text-[11px] tech-font rounded-xl flex items-center justify-center gap-3 transition-all border border-white/20 shadow-[0_0_20px_rgba(75,83,188,0.2)] group"
                >
                  <div className="relative">
                    <MessagesSquare size={18} className="group-hover:scale-110 transition-transform" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-[#4b53bc] animate-pulse" />
                  </div>
                  <span className="font-bold tracking-widest uppercase">Abrir Agente en Teams</span>
                </a>
                <p className="text-[7px] tech-font text-white/20 text-center uppercase tracking-widest">La conversacion permanecera activa en su historial de Teams</p>
              </div>
              <form onSubmit={handleChatSend} className="chat-input-wrapper">
                <input className="chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Escribe un comando..." disabled={chatLoading} />
                <button type="submit" className="chat-send-btn" style={{ background: '#00ffff' }}><Send size={16} /></button>
              </form>
            </div>

            {/* Analytics Box */}
            <div className="analytics-box" style={{ background: 'rgba(10,10,20,0.95)', borderColor: 'rgba(0,255,255,0.2)' }}>
              <div className="chart-bar-container">
                {stats.map((val, i) => (
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-bar" style={{ height: `${Math.max((val / maxStat) * 100, 5)}%`, background: 'linear-gradient(to top, rgba(0,255,255,0.1), #00ffff)' }} />
                    <span className="chart-month" style={{ color: 'rgba(255,255,255,0.5)' }}>{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Listado de Facturas - VISIBILIDAD RADICAL */}
          <div className="invoice-list" style={{ marginTop: '5rem' }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-3">
                  <FileText className="text-primary w-6 h-6" />
                  <span className="font-orbitron text-[14px] tracking-[0.5em] uppercase text-white">Registro Maestro</span>
              </div>

              {/* Neural Filters Console */}
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative group w-full md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text"
                    placeholder="FILTRAR PROTOCOLO..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-primary/20 rounded-lg py-3 pl-12 pr-4 text-[10px] tech-font text-white outline-none focus:border-primary/60 focus:bg-black/60 transition-all uppercase tracking-widest"
                  />
                  <div className="absolute bottom-0 left-0 h-[1px] bg-primary scale-x-0 group-focus-within:scale-x-100 transition-transform origin-left w-full" />
                </div>

                {/* Date Filter */}
                <div className="relative group w-full md:w-48">
                  <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 group-focus-within:text-primary transition-colors rotate-90" />
                  <input 
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full bg-black/40 border border-primary/20 rounded-lg py-3 pl-12 pr-4 text-[10px] tech-font text-white outline-none focus:border-primary/60 focus:bg-black/60 transition-all uppercase tracking-widest"
                    style={{ colorScheme: 'dark' }}
                  />
                  <div className="absolute bottom-0 left-0 h-[1px] bg-primary scale-x-0 group-focus-within:scale-x-100 transition-transform origin-left w-full" />
                </div>
              </div>
            </div>
            
            {invoicesLoading ? (
               <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
            ) : filteredInvoices.length === 0 ? (
               <div className="text-center py-10 tech-font text-white/20 text-[10px] tracking-[0.3em] uppercase">No se han encontrado registros coincidentes</div>
            ) : (
               filteredInvoices.map((inv, idx) => (
                <div key={idx} className="invoice-item forced-visibility">
                  <div className="invoice-info">
                     <div className="invoice-col">
                        <span className="invoice-label" style={{ color: '#00ffff', opacity: 0.8 }}>ID_FACTURA</span>
                        <span className="invoice-value" style={{ color: 'white', fontWeight: 900, fontSize: '1rem' }}>{inv.numFactura}</span>
                     </div>
                     <div className="invoice-col">
                        <span className="invoice-label" style={{ color: '#00ffff', opacity: 0.8 }}>Nº_PEDIDO</span>
                        <span className="invoice-value" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{inv.numPedido || 'N/A'}</span>
                     </div>
                     <div className="invoice-col">
                        <span className="invoice-label" style={{ color: '#00ffff', opacity: 0.8 }}>FECHA_REGISTRO</span>
                        <span className="invoice-value" style={{ color: 'white', fontSize: '0.85rem' }}>{new Date(inv.createdAt || inv.issueDate || new Date()).toLocaleDateString()}</span>
                     </div>
                     <div className="invoice-col">
                        <span className="invoice-label" style={{ color: '#00ffff', opacity: 0.8 }}>CLIENTE</span>
                        <span className="invoice-value" style={{ color: 'white', fontWeight: 700 }}>{inv.client?.name || 'Venta Directa'}</span>
                     </div>
                     <div className="invoice-col">
                        <span className="invoice-label" style={{ color: '#00ffff', opacity: 0.8 }}>TOTAL_BRUTO</span>
                        <span className="invoice-value" style={{ color: 'white', fontWeight: 900 }}>{inv.total.toFixed(2)}€</span>
                     </div>
                  </div>
                   <div className="invoice-actions">
                      {inv.sharepointUrl ? (
                        <a href={inv.sharepointUrl} target="_blank" className="invoice-btn" style={{ background: '#00a1f1', width: '120px', gap: '8px' }} title="Abrir en SharePoint">
                          <Cloud size={16} className="text-white" />
                          <span className="tech-font text-[9px] uppercase tracking-widest font-bold">SharePoint</span>
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 text-white/20 tech-font text-[8px] uppercase tracking-widest">
                          <Loader2 size={12} className="animate-spin" />
                          Sincronizando...
                        </div>
                      )}
                   </div>
                </div>
              ))
            )}

            {/* Paginación - VISIBILIDAD FORZADA */}
            {pagination.totalPages > 1 && (
              <div className="pagination forced-visibility">
                <button className="page-nav-btn" style={{ color: '#00ffff' }} onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1}>
                  <ChevLeft size={20} />
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                  <button 
                    key={p} 
                    className={`page-link ${p === pagination.page ? 'active' : ''}`} 
                    style={p === pagination.page ? { background: '#00ffff', color: 'black' } : { borderColor: 'rgba(0,255,255,0.3)', color: 'white' }}
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </button>
                ))}
                <button className="page-nav-btn" style={{ color: '#00ffff' }} onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === pagination.totalPages}>
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Footer local eliminado - Ahora se usa el GlobalFooter */}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
