
'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();

  // Memoize the doc ref for authorization check
  const authDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'authorizedUsers', user.uid);
  }, [firestore, user]);

  const { data: authDoc, isLoading: isAuthDocLoading } = useDoc(authDocRef);

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  if (isUserLoading || isAuthDocLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Verificando acceso...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
          <Lock className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black">Acceso Requerido</h2>
          <p className="text-muted-foreground max-w-xs">Iniciando sesión de forma segura para tu terminal de punto de venta...</p>
        </div>
        <Button onClick={() => initiateAnonymousSignIn(auth)} className="h-12 px-8 rounded-xl font-bold">
          Intentar Re-conectar
        </Button>
      </div>
    );
  }

  if (!authDoc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center text-accent shadow-inner">
          <ShieldCheck className="w-12 h-12" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-3xl font-black text-slate-800">Activar Sistema POS</h2>
          <p className="text-muted-foreground">
            Para poder acceder al inventario y registrar ventas, este dispositivo debe estar autorizado.
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 w-full max-w-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Tu ID de Usuario</p>
          <p className="text-xs font-mono font-bold text-slate-600 truncate">{user.uid}</p>
        </div>
        <Button 
          onClick={() => {
            if (user && firestore) {
               const docRef = doc(firestore, 'authorizedUsers', user.uid);
               setDocumentNonBlocking(docRef, { 
                 uid: user.uid,
                 activatedAt: serverTimestamp(),
                 name: "Operador de Caja" 
               }, { merge: true });
            }
          }} 
          className="w-full max-w-sm h-16 text-lg rounded-2xl font-black bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
        >
          AUTORIZAR ESTE TERMINAL
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
