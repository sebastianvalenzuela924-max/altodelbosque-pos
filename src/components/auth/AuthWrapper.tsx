'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper: Garantiza paridad absoluta entre servidor y cliente para evitar errores de hidratación.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Referencia al documento de autorización (memoizada)
  const authDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'authorizedUsers', user.uid);
  }, [firestore, user]);

  const { data: authDoc, isLoading: isAuthDocLoading } = useDoc(authDocRef);

  // 1. Establecer montado en el cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 2. Login anónimo automático
  useEffect(() => {
    if (isMounted && !isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [isMounted, user, isUserLoading, auth]);

  // 3. Autorización automática silenciosa
  useEffect(() => {
    if (!isMounted || !user || !firestore || isAuthDocLoading) return;

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
        // Errores gestionados por el listener global de Firebase
      });
    }
  }, [isMounted, user, firestore, authDoc, isAuthDocLoading]);

  // Durante SSR y el PRIMER render del cliente (hidratación), devolvemos un cascarón vacío idéntico.
  if (!isMounted) {
    return <div className="min-h-screen bg-background" />;
  }

  // Pantalla de carga mientras se verifica la identidad y la base de datos
  if (isUserLoading || isAuthDocLoading || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
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

  // Una vez autorizado y montado, renderizamos el contenido real
  return <>{children}</>;
}
