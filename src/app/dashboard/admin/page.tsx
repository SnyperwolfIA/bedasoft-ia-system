'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Users, UserPlus, Settings, Shield, Key, Trash2, Save, X, Activity, Briefcase, Receipt, Cpu
} from 'lucide-react';

export default function AdminPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user', modules: '' });

  useEffect(() => {
    const checkUser = () => {
      const savedUser = localStorage.getItem('bedasoft_user');
      if (!savedUser) { 
        if (window.location.search.includes('sso_token') || window.location.search.includes('iframe=true')) return false;
        router.push('/'); 
        return true; 
      }
      const parsed = JSON.parse(savedUser);
      if (parsed.jiraRole !== 'admin') { router.push('/dashboard'); return true; }
      setCurrentUser(parsed);
      fetchUsers();
      return true;
    };

    if (!checkUser()) {
      const interval = setInterval(() => {
        if (checkUser()) clearInterval(interval);
      }, 200);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      });
      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (e) { alert('Error al actualizar'); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewUser({ name: '', email: '', password: '', role: 'user', modules: '' });
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (e) { alert('Error al crear'); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    try {
      await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (e) { alert('Error al eliminar'); }
  };

  const toggleModule = (userId: string, moduleId: string) => {
    const user = userId === 'new' ? newUser : editingUser;
    const currentModules = user.modules || user.activeModules || '';
    const modulesArr = currentModules.split(',').map((m: string) => m.trim()).filter(Boolean);
    
    let newModules;
    if (modulesArr.includes(moduleId)) {
      newModules = modulesArr.filter((m: string) => m !== moduleId).join(',');
    } else {
      newModules = [...modulesArr, moduleId].join(',');
    }

    if (userId === 'new') {
      setNewUser({ ...newUser, modules: newModules });
    } else {
      setEditingUser({ ...editingUser, modules: newModules });
    }
  };

  const MODULES_AVAILABLE = [
    { id: 'facturacion', label: 'Facturación IA', icon: Receipt },
    { id: 'rrhh', label: 'RRHH IA', icon: Users },
    { id: 'jiraneural', label: 'JiraNeural Sync', icon: Briefcase }
  ];

  if (!currentUser) return null;

  return (
    <main className="flex flex-col min-h-screen text-white relative z-[100] p-8 lg:p-16">
      
      {/* Background Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1500px] h-[1500px] opacity-10 blur-[120px] bg-accent/20 rounded-full animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto w-full relative z-10">
        
        {/* Header Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-accent w-6 h-6" />
              <h1 className="font-orbitron text-2xl tracking-[0.3em] uppercase text-white/90">Master Control Panel</h1>
            </div>
            <p className="tech-font text-[10px] text-accent/60 uppercase tracking-widest">Gestión Centralizada de Usuarios y Protocolos de Acceso</p>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-3 bg-accent/10 border border-accent/30 hover:bg-accent/20 px-8 py-4 rounded-xl tech-font text-xs uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(255,0,255,0.1)] group"
          >
            <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Nuevo Operador
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[30px] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-8 py-6 tech-font text-[10px] text-white/40 uppercase tracking-widest">Operador</th>
                  <th className="px-8 py-6 tech-font text-[10px] text-white/40 uppercase tracking-widest">Nivel / Rol</th>
                  <th className="px-8 py-6 tech-font text-[10px] text-white/40 uppercase tracking-widest">Módulos Activos</th>
                  <th className="px-8 py-6 tech-font text-[10px] text-white/40 uppercase tracking-widest">API Sync</th>
                  <th className="px-8 py-6 tech-font text-[10px] text-white/40 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <motion.tr 
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-white/50" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name || 'Sin nombre'}</p>
                          <p className="text-[10px] text-white/30 tech-font">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] tech-font uppercase tracking-widest border ${
                        u.jiraRole === 'admin' ? 'bg-accent/10 border-accent/40 text-accent' : 'bg-white/5 border-white/20 text-white/60'
                      }`}>
                        {u.jiraRole === 'admin' ? 'MASTER ADMIN' : 'ESTÁNDAR'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-2">
                        {(u.activeModules || '').split(',').map((m: string) => m.trim()).filter(Boolean).map((m: string) => (
                          <span key={m} className="text-[8px] bg-white/5 px-2 py-0.5 rounded border border-white/10 tech-font uppercase text-white/40">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${u.jiraToken ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                        <span className="text-[9px] tech-font text-white/40 uppercase tracking-widest">
                          {u.jiraToken ? 'JIRA SYNC OK' : 'PENDIENTE'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right space-x-3">
                      <button 
                        onClick={() => { setEditingUser(u); setShowEditModal(true); }}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-white/60 hover:text-white"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser.id && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {loading && (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Cpu className="w-10 h-10 text-accent animate-spin" />
                <span className="tech-font text-[10px] uppercase tracking-[0.4em] text-accent">Sincronizando Usuarios...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {showEditModal && editingUser && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowEditModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-black border border-white/10 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleUpdateUser} className="flex flex-col h-full max-h-[90vh]">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <h2 className="font-orbitron text-xl tracking-widest text-accent">EDITAR OPERADOR</h2>
                    <p className="tech-font text-[9px] text-white/30 uppercase mt-1">UUID: {editingUser.id}</p>
                  </div>
                  <button type="button" onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-6 h-6 text-white/40" />
                  </button>
                </div>

                <div className="p-10 space-y-8 overflow-y-auto">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Nombre Completo</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent/50 transition-all"
                        value={editingUser.name || ''}
                        onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Email Sistema</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent/50 transition-all"
                        value={editingUser.email || ''}
                        onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Modules Selection */}
                  <div className="space-y-4">
                    <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Módulos Asignados</label>
                    <div className="grid grid-cols-3 gap-4">
                      {MODULES_AVAILABLE.map((m) => {
                        const isActive = (editingUser.modules || editingUser.activeModules || '').split(',').includes(m.id);
                        return (
                          <div 
                            key={m.id}
                            onClick={() => toggleModule(editingUser.id, m.id)}
                            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                              isActive ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-white/5 border-white/10 text-white/30'
                            }`}
                          >
                            <m.icon className="w-6 h-6" />
                            <span className="tech-font text-[8px] uppercase tracking-widest">{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* API JIRA Integration */}
                  <div className="space-y-4 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="w-4 h-4 text-primary" />
                      <span className="tech-font text-[10px] text-primary uppercase tracking-widest font-bold">Configuración de API (JIRA)</span>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          placeholder="Jira URL (ej: https://dominio.atlassian.net)"
                          className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs outline-none focus:border-primary/50 transition-all"
                          value={editingUser.jiraUrl || ''}
                          onChange={e => setEditingUser({...editingUser, jiraUrl: e.target.value})}
                        />
                        <input 
                          placeholder="Jira Email"
                          className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs outline-none focus:border-primary/50 transition-all"
                          value={editingUser.jiraEmail || ''}
                          onChange={e => setEditingUser({...editingUser, jiraEmail: e.target.value})}
                        />
                      </div>
                      <input 
                        type="password"
                        placeholder="API Token (ATATT...)"
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs outline-none focus:border-primary/50 transition-all"
                        value={editingUser.jiraToken || ''}
                        onChange={e => setEditingUser({...editingUser, jiraToken: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div className="flex items-center gap-4 p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                    <Shield className="w-5 h-5 text-accent" />
                    <div className="flex-1">
                      <p className="tech-font text-[9px] uppercase tracking-widest text-accent font-bold">Nivel de Acceso</p>
                      <select 
                        className="bg-transparent border-none text-sm text-white/80 outline-none w-full"
                        value={editingUser.jiraRole || 'user'}
                        onChange={e => setEditingUser({...editingUser, jiraRole: e.target.value})}
                      >
                        <option value="user">Operador Estándar</option>
                        <option value="admin">Master Administrator</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-white/5 flex justify-end gap-4">
                  <button 
                    type="button" onClick={() => setShowEditModal(false)}
                    className="px-8 py-3 rounded-xl tech-font text-[10px] uppercase tracking-widest text-white/40 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="bg-accent text-black px-10 py-3 rounded-xl tech-font text-[10px] font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(255,0,255,0.2)] hover:scale-105 transition-all"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-black border border-accent/30 rounded-[40px] shadow-2xl p-10"
            >
              <h2 className="font-orbitron text-2xl tracking-widest text-accent mb-2">NUEVO OPERADOR</h2>
              <p className="tech-font text-[10px] text-white/30 uppercase mb-10">Inicialización de protocolo de acceso</p>

              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Nombre</label>
                  <input 
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent/50 transition-all"
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Email</label>
                  <input 
                    required type="email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent/50 transition-all"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Contraseña Inicial</label>
                  <input 
                    required type="password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent/50 transition-all"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>

                {/* Quick Module Toggle */}
                <div className="space-y-3">
                   <label className="tech-font text-[9px] text-white/40 uppercase pl-2">Acceso Inicial a Módulos</label>
                   <div className="flex gap-2">
                      {MODULES_AVAILABLE.map(m => (
                        <button 
                          key={m.id} type="button"
                          onClick={() => toggleModule('new', m.id)}
                          className={`flex-1 py-2 rounded-lg border tech-font text-[8px] uppercase tracking-widest transition-all ${
                            newUser.modules.includes(m.id) ? 'bg-accent/20 border-accent/50 text-accent' : 'bg-white/5 border-white/10 text-white/20'
                          }`}
                        >
                          {m.id}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="pt-6 flex gap-4">
                   <button 
                    type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 tech-font text-[10px] uppercase tracking-widest text-white/40 hover:bg-white/5 rounded-xl"
                  >
                    Abortar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-accent text-black py-4 rounded-xl tech-font text-[10px] font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(255,0,255,0.2)] hover:scale-105 transition-all"
                  >
                    Confirmar Alta
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}
