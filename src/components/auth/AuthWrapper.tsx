'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper: Gestiona la identidad y autorización del terminal.
 * Espera a que el documento de autorización sea visible en Firestore antes de renderizar.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
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

  // Login anónimo automático
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Sincronización del estado de autorización basada en el snapshot de Firestore
  useEffect(() => {
    if (authDoc) {
      setIsAuthorized(true);
    }
  }, [authDoc]);

  // Creación automática del documento si no existe
  useEffect(() => {
    if (!user || !firestore || isAuthDocLoading || authDoc) return;

    const docRef = doc(firestore, 'authorizedUsers', user.uid);
    setDoc(docRef, { 
      uid: user.uid,
      activatedAt: serverTimestamp(),
      autoActivated: true,
      lastSession: serverTimestamp()
    }, { merge: true })
    .catch(() => {
      // Errores gestionados por el listener global de Firebase
    });
  }, [user, firestore, authDoc, isAuthDocLoading]);

  // Pantalla de carga mientras se sincroniza el terminal
  if (isUserLoading || isAuthDocLoading || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-700">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">AltodelBosque POS</h2>
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
