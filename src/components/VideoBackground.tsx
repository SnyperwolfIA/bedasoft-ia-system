'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pathname = usePathname();
  const [targetTime, setTargetTime] = useState(0);

  useEffect(() => {
    // Sistema de navegación inteligente por carpetas
    if (pathname === '/') {
      setTargetTime(0.1); // Inicio (Cerrado)
    } else if (pathname.includes('/modulos/')) {
      setTargetTime(8); // Profundidad máxima (Cualquier Módulo IA)
    } else if (pathname.includes('/dashboard')) {
      setTargetTime(4); // Punto medio (Hub de Control)
    }
  }, [pathname]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let interval: NodeJS.Timeout;

    const updateVideo = () => {
      const diff = targetTime - video.currentTime;

      if (Math.abs(diff) < 0.2) {
        video.pause();
        return;
      }

      if (diff > 0) {
        video.playbackRate = 1.2;
        video.play();
        interval = setInterval(() => {
          if (video.currentTime >= targetTime) {
            video.pause();
            clearInterval(interval);
          }
        }, 50);
      } else {
        video.pause();
        interval = setInterval(() => {
          if (video.currentTime <= targetTime) {
            video.currentTime = targetTime;
            clearInterval(interval);
          } else {
            video.currentTime -= 0.15;
          }
        }, 40);
      }
    };

    updateVideo();
    return () => { if (interval) clearInterval(interval); };
  }, [targetTime]);

  const isDashboard = pathname.startsWith('/dashboard');

  if (isDashboard) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 0, 
          background: 'transparent',
          pointerEvents: 'none'
        }} 
      >
        <div 
          className="dashboard-bg-gradient"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            pointerEvents: 'none' 
          }} 
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#000' }}>
      <video
        ref={videoRef}
        src="/Nucleo.mp4"
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.3,
          filter: 'brightness(0.4) contrast(1.2)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 20%, #000 120%)', pointerEvents: 'none', opacity: 0.8 }} />
    </div>
  );
}
