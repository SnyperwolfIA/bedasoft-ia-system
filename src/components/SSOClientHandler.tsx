'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export default function SSOClientHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const ssoToken = searchParams.get('sso_token');
    
    if (ssoToken) {
      console.log("[SSO] Detectado token en URL. Iniciando auto-login...");
      
      // Guardamos el token
      localStorage.setItem('bedasoft_token', ssoToken);
      
      // Intentamos recuperar los datos del usuario para llenar localStorage
      const fetchUserData = async () => {
        try {
          const response = await fetch('/api/auth/verify-token', {
            headers: {
              'Authorization': `Bearer ${ssoToken}`
            }
          });
          
          const data = await response.json();
          
          if (data.success) {
            console.log("[SSO] Usuario verificado correctamente:", data.user.email);
            localStorage.setItem('bedasoft_user', JSON.stringify(data.user));
            
            // Limpiar el token de la URL sin recargar la página (evita el rebote del middleware)
            const params = new URLSearchParams(searchParams);
            params.delete('sso_token');
            // Mantenemos el flag de iframe para que el middleware no nos eche
            if (!params.has('iframe')) params.set('iframe', 'true');
            
            const newUrl = pathname + '?' + params.toString();
            
            window.history.replaceState({}, '', newUrl);
            
            // Notificar a la aplicación que la sesión está lista
            window.dispatchEvent(new Event('storage')); 
            
            // Forzar un pequeño delay y refrescar estado local si es necesario
            setTimeout(() => {
              // Si estamos en una página que necesita el usuario, esto disparará su useEffect
              router.refresh();
            }, 100);
          } else {
            console.error("[SSO] Error al verificar token:", data.error);
          }
        } catch (error) {
          console.error("[SSO] Error de red en verificación:", error);
        }
      };
      
      fetchUserData();
    }
  }, [searchParams, pathname]);

  return null;
}
