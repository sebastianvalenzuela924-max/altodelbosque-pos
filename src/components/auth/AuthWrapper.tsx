'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper: Gestiona la identidad del terminal de forma fluida.
 * Eliminamos esperas artificiales para evitar bloqueos en la interfaz.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  // Login anónimo automático si no hay sesión iniciada
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Registro/Sincronización del terminal en segundo plano
  useEffect(() => {
    if (!user || !firestore) return;

    const docRef = doc(firestore, 'authorizedUsers', user.uid);
    // Operación no bloqueante para asegurar que el terminal esté registrado
    setDoc(docRef, { 
      uid: user.uid,
      lastSession: serverTimestamp(),
      status: 'active'
    }, { merge: true }).catch(() => {
      // Errores silenciados para no interrumpir el flujo de usuario
    });
  }, [user, firestore]);

  // Pantalla de carga mínima mientras se establece la sesión inicial
  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-700">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
            </div>
          </div>
          <div className="text-center px-6">
            <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">AltodelBosque POS</h2>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1">
              Iniciando Terminal...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Una vez que hay un usuario (anónimo o no), mostramos la terminal
  return <>{children}</>;
}
