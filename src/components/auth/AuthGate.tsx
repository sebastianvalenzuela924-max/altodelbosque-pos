'use client';

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * AuthGate: Un componente de cliente que carga dinámicamente el AuthWrapper
 * con ssr: false. Esta es la solución recomendada por Next.js para evitar
 * errores de hidratación cuando un componente depende de APIs del navegador
 * o estados de Firebase que no existen en el servidor.
 */
const DynamicAuthWrapper = dynamic(
  () => import('./AuthWrapper').then((mod) => mod.AuthWrapper),
  { 
    ssr: false, 
    loading: () => <div className="min-h-screen bg-background" /> 
  }
);

export function AuthGate({ children }: { children: React.ReactNode }) {
  return <DynamicAuthWrapper>{children}</DynamicAuthWrapper>;
}
