'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper optimizado para evitar errores de hidratación.
 * Maneja la autenticación y autorización automática en segundo plano.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Referencia al documento de autorización del usuario actual
  const authDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'authorizedUsers', user.uid);
  }, [firestore, user]);

  const { data: authDoc, isLoading: isAuthDocLoading } = useDoc(authDocRef);

  // 1. Evitar errores de hidratación: marcar como montado en el cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Iniciar sesión anónima automáticamente si no hay usuario
  useEffect(() => {
    if (mounted && !isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [mounted, user, isUserLoading, auth]);

  // 3. Gestionar la autorización automática (DBAC)
  useEffect(() => {
    if (!mounted || !user || !firestore || isAuthDocLoading) return;

    if (authDoc) {
      setIsAuthorized(true);
    } else {
      // Si el documento no existe, intentamos crearlo (Auto-activación)
      const docRef = doc(firestore, 'authorizedUsers', user.uid);
      setDoc(docRef, { 
        uid: user.uid,
        activatedAt: serverTimestamp(),
        autoActivated: true,
        lastSession: serverTimestamp()
      }, { merge: true })
      .then(() => setIsAuthorized(true))
      .catch(() => {
        // El error se manejará por las reglas de seguridad o el hook useDoc
      });
    }
  }, [mounted, user, firestore, authDoc, isAuthDocLoading]);

  // Durante SSR y el primer render del cliente, mostramos un estado mínimo estable
  // Usamos min-h-screen para que coincida con la estructura de carga posterior
  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  // Pantalla de carga mientras se verifica la identidad y autorización
  if (isUserLoading || isAuthDocLoading || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
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
