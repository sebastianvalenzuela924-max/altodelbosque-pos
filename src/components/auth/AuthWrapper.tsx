'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AuthWrapper: Gestiona la identidad del terminal de forma fluida.
 * Añadimos manejo de errores y estados de tiempo de espera para evitar bloqueos.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [showRetry, setShowRetry] = useState(false);

  // Login anónimo automático si no hay sesión iniciada
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Timeout para mostrar botón de reintento si tarda mucho
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isUserLoading || !user) {
      timer = setTimeout(() => setShowRetry(true), 8000);
    } else {
      setShowRetry(false);
    }
    return () => clearTimeout(timer);
  }, [isUserLoading, user]);

  // Registro/Sincronización del terminal en segundo plano
  useEffect(() => {
    if (!user || !firestore) return;

    const docRef = doc(firestore, 'authorizedUsers', user.uid);
    setDoc(docRef, { 
      uid: user.uid,
      lastSession: serverTimestamp(),
      status: 'active'
    }, { merge: true }).catch(() => {
      // Errores de firestore silenciados aquí
    });
  }, [user, firestore]);

  const handleRetry = () => {
    window.location.reload();
  };

  if (userError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4 text-destructive">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-primary uppercase">Error de Conexión</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          No pudimos conectar con el servidor de autenticación.
        </p>
        <Button onClick={handleRetry} className="mt-6 rounded-2xl gap-2 font-bold px-8">
          <RefreshCw className="w-4 h-4" /> REINTENTAR
        </Button>
      </div>
    );
  }

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
          
          {showRetry && (
            <div className="mt-8 animate-in slide-in-from-bottom-4 duration-500">
              <Button variant="outline" onClick={handleRetry} className="rounded-2xl gap-2 text-xs font-bold border-slate-200">
                <RefreshCw className="w-3 h-3" /> ¿Tarda demasiado? Reintentar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
