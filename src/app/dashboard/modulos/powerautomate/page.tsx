'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Cpu, ArrowLeft, ArrowDown, Download, Send, Sparkles, Loader2, Bot, HelpCircle,
  Mail, FolderOpen, MessagesSquare, FileSpreadsheet, CheckSquare, Zap, Settings,
  Sun, Moon, Check, AlertTriangle, Layers, Info
} from 'lucide-react';

interface ConnectorInfo {
  name: string;
  color: string;
  icon: any;
}

const CONNECTOR_METADATA: Record<string, ConnectorInfo> = {
  shared_office365: { name: 'Office 365 Outlook', color: 'bg-blue-600/20 border-blue-500/40 text-blue-400', icon: Mail },
  shared_sharepointonline: { name: 'SharePoint Online', color: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400', icon: FolderOpen },
  shared_teams: { name: 'Microsoft Teams', color: 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400', icon: MessagesSquare },
  shared_excelonline: { name: 'Excel Online', color: 'bg-teal-600/20 border-teal-500/40 text-teal-400', icon: FileSpreadsheet },
  shared_todo: { name: 'Microsoft To-Do', color: 'bg-sky-600/20 border-sky-500/40 text-sky-400', icon: CheckSquare }
};

export default function PowerAutomateGeneratorPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Flow details states
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Editable fields to refine flow title and description
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Examples array to let users test quickly
  const EXAMPLES = [
    "Cuando se recibe una nueva factura por correo en Outlook, extraer datos, guardarla en la biblioteca de SharePoint y notificar por Teams al canal de contabilidad.",
    "Cada vez que un empleado solicita vacaciones, validar las fechas, guardarlo en el archivo Excel de SharePoint y enviarle un correo de confirmación automático.",
    "Al crearse un nuevo archivo en la carpeta 'Contratos' de SharePoint, generar una tarea en Microsoft To-Do para revisión y avisar a RRHH."
  ];

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

  const handleGenerateFlow = async (e?: React.FormEvent, promptToUse?: string) => {
    if (e) e.preventDefault();
    const activePrompt = promptToUse || promptInput;
    if (!activePrompt.trim()) return;

    setLoading(true);
    setError(null);
    setFlowData(null);
    setDownloadSuccess(false);

    try {
      const response = await fetch('/api/powerautomate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt })
      });
      const data = await response.json();

      if (data.success && data.flow) {
        setFlowData(data.flow);
        setEditTitle(data.flow.title);
        setEditDescription(data.flow.description);
      } else {
        setError(data.error || 'No se pudo generar la estructura de automatización.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error en la comunicación con el servidor. Por favor, reinténtalo.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPackage = async () => {
    if (!flowData) return;
    setExporting(true);
    setDownloadSuccess(false);

    try {
      const response = await fetch('/api/powerautomate/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle || flowData.title,
          description: editDescription || flowData.description,
          connectors: flowData.connectors,
          flowDefinition: flowData.flowDefinition
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `${(editTitle || flowData.title).toLowerCase().replace(/[^a-z0-9]/g, '_')}_powerautomate.zip`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 8000);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Error al exportar el paquete ZIP.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al generar la descarga del archivo ZIP.');
    } finally {
      setExporting(false);
    }
  };

  const getConnectorMetadata = (connector: string): ConnectorInfo => {
    return CONNECTOR_METADATA[connector] || {
      name: connector.replace('shared_', '').toUpperCase(),
      color: 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300',
      icon: Settings
    };
  };

  if (!user) return null;

  return (
    <main className="flex flex-col items-center min-h-screen text-white relative z-[100] pb-20">
      
      {/* Floating Theme Switcher */}
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

      {/* Cybernetic Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-[500px] h-[500px] opacity-10 blur-[120px] bg-purple-500/20 rounded-full" />
        <div className="absolute bottom-10 right-10 w-[600px] h-[600px] opacity-10 blur-[150px] bg-cyan-500/20 rounded-full" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 relative z-10 w-full max-w-6xl">
        
        {/* Navigation back button */}
        <div className="w-full flex justify-start mb-6">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="back-btn group hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 
            Volver al Panel Central
          </button>
        </div>

        {/* Title Console Header */}
        <div className="flex flex-col items-center text-center mb-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-3 tech-font text-[9px] tracking-[0.5em] text-cyan-400/50 uppercase">
            <div className="w-6 h-[1px] bg-cyan-500/20" />
            AUTOMATION GENERATOR CORE
            <div className="w-6 h-[1px] bg-cyan-500/20" />
          </div>
          <h1 className="font-orbitron text-2xl md:text-3xl tracking-[0.15em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 drop-shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            Power Automate IA
          </h1>
          <p className="tech-font text-[10px] text-white/50 uppercase tracking-widest mt-3 leading-relaxed">
            Escribe las directrices de tu automatización en lenguaje natural. Nuestro motor cognitivo generará al instante un paquete de importación ZIP de Microsoft Power Automate 100% nativo y totalmente editable.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          
          {/* LEFT SIDE: Prompt Input Area */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-mask !p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-orbitron text-xs tracking-wider uppercase text-white/80">Directriz de Flujo</h2>
                  <p className="text-[8px] tech-font text-white/40 uppercase tracking-widest">Describe tu proceso de negocio</p>
                </div>
              </div>

              <form onSubmit={(e) => handleGenerateFlow(e)} className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 blur-lg group-focus-within:from-cyan-500/10 group-focus-within:to-purple-500/10 transition-all rounded-2xl" />
                  <textarea 
                    className="w-full h-44 bg-black/40 border border-white/10 group-focus-within:border-cyan-500/50 rounded-2xl p-4 text-xs font-light leading-relaxed placeholder:text-white/20 focus:outline-none transition-all resize-none text-white/95"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Ej. Cuando se reciba una solicitud de vacaciones por correo, actualizar el archivo Excel de vacaciones de la empresa restando los días correspondientes, mandar un correo de aprobación/rechazo al solicitante y crear un recordatorio de calendario."
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !promptInput.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-xl text-[10px] tech-font font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_30px_rgba(6,182,212,0.15)] flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      Procesando Directriz...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-black group-hover:scale-110 transition-transform animate-pulse" />
                      Generar Arquitectura de Flujo
                    </>
                  )}
                </button>
              </form>

              {/* Dynamic suggestion chips */}
              <div className="mt-8">
                <span className="text-[8px] tech-font text-white/30 uppercase tracking-widest block mb-3">Plantillas de ejemplo sugeridas:</span>
                <div className="space-y-2">
                  {EXAMPLES.map((example, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPromptInput(example);
                        handleGenerateFlow(undefined, example);
                      }}
                      className="w-full text-left p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-[9.5px] font-light leading-relaxed text-white/50 hover:text-white transition-all duration-300"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Educational Info card on importing */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="tech-font text-[9px] tracking-wider uppercase text-purple-300">¿Cómo importar mi flujo?</h4>
                  <p className="text-[9px] text-white/40 leading-relaxed">
                    1. Descarga el paquete ZIP generado pulsando el botón.<br/>
                    2. Dirígete a <b>Power Automate</b> &gt; <b>Mis flujos</b>.<br/>
                    3. Haz clic en <b>Importar paquete (heredado)</b>.<br/>
                    4. Sube tu archivo ZIP y asocia las credenciales de tus conectores (ej. Outlook, SharePoint).<br/>
                    5. ¡Importa y edita el flujo de forma nativa e interactiva sin límites!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Visual step flowchart & export */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-mask !p-12 h-full min-h-[500px] flex flex-col items-center justify-center text-center space-y-6 shadow-xl relative overflow-hidden"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 border border-cyan-500/20 rounded-full animate-ping absolute" />
                    <div className="w-16 h-16 border-2 border-dashed border-cyan-500/40 border-t-purple-500 rounded-full animate-spin flex items-center justify-center">
                      <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-orbitron text-xs tracking-widest uppercase text-white">Sintetizando Conexiones...</h3>
                    <p className="tech-font text-[8px] text-cyan-400/60 uppercase tracking-widest animate-pulse">
                      Traduciendo lenguaje natural a Logic Apps JSON v2016
                    </p>
                  </div>
                  <div className="w-64 bg-white/5 h-[2px] rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 absolute w-1/2 animate-shimmer" style={{
                      animation: 'shimmer 2s infinite linear'
                    }} />
                  </div>
                </motion.div>
              )}

              {error && !loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-mask border border-red-500/20 bg-red-950/10 !p-8 min-h-[450px] flex flex-col items-center justify-center text-center space-y-4 shadow-xl relative overflow-hidden"
                >
                  <AlertTriangle className="w-12 h-12 text-red-400 animate-bounce" />
                  <h3 className="font-orbitron text-xs tracking-widest uppercase text-red-400">Error del Sistema Neural</h3>
                  <p className="text-[10px] tech-font text-white/50 max-w-md uppercase tracking-wider leading-relaxed">
                    {error}
                  </p>
                  <button
                    onClick={() => setError(null)}
                    className="px-6 py-2 border border-red-500/40 hover:bg-red-500/10 text-[8px] tech-font uppercase tracking-widest text-red-300 rounded-lg transition-all"
                  >
                    Cerrar Alerta y Reintentar
                  </button>
                </motion.div>
              )}

              {!flowData && !loading && !error && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-mask border-dashed border-white/10 !p-8 h-full min-h-[500px] flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden"
                >
                  <div className="w-16 h-16 bg-white/[0.02] border border-white/10 rounded-full flex items-center justify-center mb-6 text-white/30">
                    <Layers className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="font-orbitron text-xs tracking-widest uppercase text-white/60">Esperando Directriz</h3>
                  <p className="text-[9px] tech-font text-white/30 max-w-sm uppercase tracking-widest leading-loose mt-2">
                    Escribe tu flujo comercial o selecciona una de las plantillas sugeridas a la izquierda para renderizar y visualizar la arquitectura del flujo de trabajo.
                  </p>
                </motion.div>
              )}

              {flowData && !loading && !error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Editable flow definition header */}
                  <div className="glass-mask !p-6 flex flex-col gap-4 shadow-lg mb-6 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-transparent border-none outline-none font-orbitron text-sm tracking-wider uppercase text-white focus:ring-1 focus:ring-cyan-500/40 rounded px-1 w-full max-w-md font-bold"
                            title="Haz clic para editar el título del flujo"
                          />
                        </div>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="bg-transparent border-none outline-none text-[9.5px] text-white/50 w-full mt-1.5 focus:ring-1 focus:ring-cyan-500/40 rounded px-1 resize-none h-10 leading-relaxed font-light"
                          title="Haz clic para editar la descripción"
                        />
                      </div>

                      <button
                        onClick={handleExportPackage}
                        disabled={exporting}
                        className={`px-5 py-3 rounded-xl text-[9px] tech-font font-bold tracking-widest uppercase transition-all shrink-0 flex items-center gap-2 hover:scale-[1.02] active:scale-95 ${
                          downloadSuccess 
                            ? 'bg-green-500 text-black shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                            : 'bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                        }`}
                      >
                        {exporting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                            Comprimiendo...
                          </>
                        ) : downloadSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-black stroke-[3px]" />
                            ¡Paquete Descargado!
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-black" />
                            Descargar Paquete ZIP
                          </>
                        )}
                      </button>
                    </div>

                    {/* Tech stats bar */}
                    <div className="flex flex-wrap items-center gap-6 text-[8px] tech-font text-white/40 uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                        Arquitectura: <span className="text-white">API Connection Logic Apps V1</span>
                      </div>
                      <div className="w-[1px] h-3.5 bg-white/10 hidden sm:block" />
                      <div>
                        Acciones Sintetizadas: <span className="text-white font-bold">{(flowData.actions || []).length}</span>
                      </div>
                      <div className="w-[1px] h-3.5 bg-white/10 hidden sm:block" />
                      <div className="flex gap-2.5 items-center">
                        Conectores:
                        <div className="flex gap-1.5">
                          {(flowData.connectors || []).map((conn: string, idx: number) => {
                            const meta = getConnectorMetadata(conn);
                            return (
                              <span key={idx} className="text-[7.5px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/80">
                                {meta.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* VISUAL DIAGRAM CARD FLOW */}
                  <div className="glass-mask !p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl rounded-full" />
                    
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-8">
                      <h4 className="font-orbitron text-[10px] tracking-wider uppercase text-cyan-400/80">Visualizador de Arquitectura del Flujo</h4>
                      <span className="tech-font text-[7.5px] text-white/20 uppercase tracking-widest">Vista previa del Diseñador</span>
                    </div>

                    <div className="flex flex-col items-center space-y-6">
                      
                      {/* 1. TRIGGER COMPONENT */}
                      {flowData.trigger && (
                        <div className="w-full max-w-lg">
                          <div className="relative group/trigger">
                            <div className="absolute inset-0 bg-green-500/5 border border-green-500/20 blur-md rounded-2xl" />
                            <div className="relative p-5 rounded-2xl bg-black/40 border border-green-500/30 flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-green-400 animate-pulse" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded tech-font uppercase tracking-widest font-bold">
                                    Disparador
                                  </span>
                                  {flowData.trigger.connector && (
                                    <span className={`text-[7.5px] px-1.5 py-0.5 rounded border tech-font ${getConnectorMetadata(flowData.trigger.connector).color}`}>
                                      {getConnectorMetadata(flowData.trigger.connector).name}
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-orbitron text-xs text-white uppercase tracking-wider pt-1">{flowData.trigger.name}</h5>
                                <p className="text-[10px] text-white/50 font-light leading-relaxed">{flowData.trigger.description}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Directional Flow Arrow */}
                      <div className="flex flex-col items-center gap-1 my-2">
                        <div className="w-[1.5px] h-6 bg-gradient-to-b from-green-500/40 to-cyan-500/40" />
                        <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <ArrowDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                        </div>
                        <div className="w-[1.5px] h-6 bg-gradient-to-b from-cyan-500/40 to-purple-500/40" />
                      </div>

                      {/* 2. ACTIONS SEQUENCE */}
                      <div className="w-full max-w-lg space-y-4">
                        {(flowData.actions || []).map((action: any, index: number) => {
                          const meta = getConnectorMetadata(action.connector);
                          const IconComp = meta.icon;
                          const isLast = index === flowData.actions.length - 1;

                          return (
                            <div key={index} className="flex flex-col items-center">
                              <div className="w-full relative group">
                                <div className="absolute inset-0 bg-cyan-500/5 blur-md rounded-2xl group-hover:bg-cyan-500/10 transition-all" />
                                <div className="relative p-5 rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-500/30 transition-all flex items-start gap-4">
                                  
                                  {/* Step Badge Indicator */}
                                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-400 text-black font-orbitron text-[9px] flex items-center justify-center font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                    {index + 1}
                                  </div>

                                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center shrink-0 ml-1">
                                    <IconComp className="w-5 h-5 text-cyan-400" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[7.5px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded tech-font uppercase tracking-widest font-bold">
                                        Acción
                                      </span>
                                      <span className={`text-[7.5px] px-1.5 py-0.5 rounded border tech-font ${meta.color}`}>
                                        {meta.name}
                                      </span>
                                      <span className="text-[7.5px] text-white/20 tech-font">ID: {action.id}</span>
                                    </div>
                                    <h5 className="font-orbitron text-xs text-white/90 uppercase tracking-wider pt-1">{action.name}</h5>
                                    <p className="text-[10px] text-white/40 font-light leading-relaxed">{action.description}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Action separator arrow */}
                              {!isLast && (
                                <div className="flex flex-col items-center gap-1 my-1.5">
                                  <div className="w-[1.5px] h-6 bg-gradient-to-b from-purple-500/40 to-cyan-500/40" />
                                  <ArrowDown className="w-3.5 h-3.5 text-purple-400/60" />
                                  <div className="w-[1.5px] h-6 bg-gradient-to-b from-cyan-500/40 to-purple-500/40" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>

                  {/* Flow successfully completed visual helper */}
                  {downloadSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-950/20 border border-green-500/30 p-5 rounded-2xl flex items-start gap-3"
                    >
                      <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="tech-font text-[9.5px] text-green-400 uppercase tracking-wider font-bold">Flujo Exportado Exitosamente</h4>
                        <p className="text-[9.5px] text-white/50 leading-relaxed font-light">
                          El archivo comprimido ha sido descargado en tu sistema. Ya puedes importarlo de manera nativa en Microsoft Power Automate siguiendo las instrucciones descritas abajo.
                        </p>
                      </div>
                    </motion.div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </main>
  );
}
