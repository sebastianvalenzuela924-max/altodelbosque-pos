'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper definitivo: garantiza paridad total entre servidor y cliente.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Referencia al documento de autorización
  const authDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'authorizedUsers', user.uid);
  }, [firestore, user]);

  const { data: authDoc, isLoading: isAuthDocLoading } = useDoc(authDocRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Login anónimo automático
  useEffect(() => {
    if (mounted && !isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [mounted, user, isUserLoading, auth]);

  // Autorización automática silenciosa
  useEffect(() => {
    if (!mounted || !user || !firestore || isAuthDocLoading) return;

    if (authDoc) {
      setIsAuthorized(true);
    } else {
      const docRef = doc(firestore, 'authorizedUsers', user.uid);
      setDoc(docRef, { 
        uid: user.uid,
        activatedAt: serverTimestamp(),
        autoActivated: true,
        lastSession: serverTimestamp()
      }, { merge: true })
      .then(() => setIsAuthorized(true))
      .catch(() => {
        // Errores gestionados por el listener global
      });
    }
  }, [mounted, user, firestore, authDoc, isAuthDocLoading]);

  // Durante SSR y el PRIMER render del cliente, el componente es estático y vacío
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
              <div className="w-2 bg-primary rounded-full animate-ping" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">SmartSale POS</h2>
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
