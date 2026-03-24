'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper optimizado.
 * Maneja la autenticación y autorización en segundo plano de forma invisible.
 * Bloquea el renderizado de la app hasta que el usuario tiene permisos confirmados en el servidor.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Aseguramos que el componente se ha montado en el cliente para evitar errores de hidratación
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Referencia al documento de autorización del usuario actual
  const authDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'authorizedUsers', user.uid);
  }, [firestore, user]);

  const { data: authDoc, isLoading: isAuthDocLoading } = useDoc(authDocRef);

  // 1. Iniciar sesión anónima automáticamente si no hay usuario
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // 2. Gestionar la autorización automática (DBAC)
  useEffect(() => {
    let mounted = true;

    async function ensureAuthorization() {
      if (user && firestore && !isAuthDocLoading && !authDoc && !isReady) {
        const docRef = doc(firestore, 'authorizedUsers', user.uid);
        try {
          await setDoc(docRef, { 
            uid: user.uid,
            activatedAt: serverTimestamp(),
            autoActivated: true,
            lastSession: serverTimestamp()
          }, { merge: true });
          
          if (mounted) setIsReady(true);
        } catch (error) {
          // Error silencioso, manejado por las reglas de seguridad
        }
      } else if (authDoc) {
        if (mounted) setIsReady(true);
      }
    }

    ensureAuthorization();

    return () => { mounted = false; };
  }, [user, firestore, authDoc, isAuthDocLoading, isReady]);

  // Pantalla de carga profesional e invisible
  // Solo renderizamos el contenido real una vez que el cliente está listo y autorizado
  if (!hasMounted || isUserLoading || isAuthDocLoading || !isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100vh] bg-background">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-700">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-primary tracking-tighter">SmartSale POS</h2>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1">
              Sincronizando Terminal
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
