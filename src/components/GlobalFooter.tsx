'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Cpu, Shield, Globe } from 'lucide-react';

export default function GlobalFooter() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isIframe = typeof window !== 'undefined' && window.location.search.includes('iframe=true');

  if (isHome || isIframe) return null;

  return (
    <footer className="w-full py-8 px-12 mt-auto relative overflow-hidden border-t border-white/5 bg-black/20 backdrop-blur-md">
      <div className="max-w-[1800px] mx-auto flex flex-col items-center gap-6">
        
        {/* Branding & Version */}
        <div className="flex items-center gap-8 opacity-40">
           <div className="flex items-center gap-2">
             <Cpu className="w-3 h-3" />
             <span className="tech-font text-[9px] uppercase tracking-[0.5em]">Neural Engine v3.0.4</span>
           </div>
           <div className="w-1 h-1 rounded-full bg-white/20" />
           <div className="flex items-center gap-2">
             <Shield className="w-3 h-3" />
             <span className="tech-font text-[9px] uppercase tracking-[0.5em]">Secure Protocol: Active</span>
           </div>
           <div className="w-1 h-1 rounded-full bg-white/20" />
           <div className="flex items-center gap-2">
             <Globe className="w-3 h-3" />
             <span className="tech-font text-[9px] uppercase tracking-[0.5em]">Node: Madrid-HQ-01</span>
           </div>
        </div>

        {/* Legal & Tech Info */}
        <div className="flex flex-col items-center">
          <p className="font-orbitron text-[10px] opacity-20 tracking-[1.2em] uppercase text-center mb-4">
            Neural Infrastructure Framework | Bedasoft Intelligence System
          </p>
          <div className="flex gap-12 text-[8px] tech-font uppercase tracking-[0.3em] text-white/20">
            <span>© 2026 Bedasoft IA</span>
            <span className="text-primary/30">Latency: 14ms</span>
            <span className="text-primary/30">Uptime: 99.998%</span>
          </div>
        </div>

        {/* Energy Pulse line */}
        <motion.div 
          className="absolute bottom-0 left-0 h-[2px] bg-primary"
          initial={{ width: '0%', left: '0%' }}
          animate={{ width: ['0%', '100%', '0%'], left: ['0%', '0%', '100%'] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </footer>
  );
}
