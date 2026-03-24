'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthWrapper simplificado.
 * Maneja la autenticación anónima y la auto-autorización en segundo plano
 * para que el usuario entre directo a la aplicación.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Referencia al documento de autorización del usuario actual
  const authDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'authorizedUsers', user.uid);
  }, [firestore, user]);

  const { data: authDoc, isLoading: isAuthDocLoading } = useDoc(authDocRef);

  // 1. Manejar inicio de sesión anónimo automático
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // 2. Auto-autorizar si el usuario está logueado pero no tiene documento en authorizedUsers
  useEffect(() => {
    if (user && firestore && !isAuthDocLoading && !authDoc && !isAuthorizing) {
      setIsAuthorizing(true);
      const docRef = doc(firestore, 'authorizedUsers', user.uid);
      
      // Creamos el documento de autorización automáticamente
      setDocumentNonBlocking(docRef, { 
        uid: user.uid,
        activatedAt: serverTimestamp(),
        name: "Terminal Auto-Autorizada",
        autoActivated: true
      }, { merge: true });
      
      // Damos un pequeño respiro para que Firestore procese (opcional, useDoc lo detectará)
      setTimeout(() => setIsAuthorizing(false), 1000);
    }
  }, [user, firestore, authDoc, isAuthDocLoading, isAuthorizing]);

  // Mostrar cargando solo durante los procesos iniciales
  if (isUserLoading || isAuthDocLoading || (user && !authDoc)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-primary animate-pulse">SmartSale POS</p>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Iniciando terminal...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario ni auth, algo falló en la conexión inicial
  if (!user && !isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-destructive font-bold">Error de conexión con el servidor.</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded-lg font-bold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
