"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Scan, Camera, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export function ScannerComponent({ onScan }: { onScan: (decodedText: string) => void }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerInstance = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  const stopScanner = async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try {
        await scannerInstance.current.stop();
      } catch (err) {
        console.error("Error al detener el escáner:", err);
      }
    }
    setIsEnabled(false);
  };

  const startScanner = async () => {
    setIsLoading(true);
    try {
      // Solicitar permiso explícitamente primero para asegurar que el navegador muestre el diálogo
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // Detenemos los tracks inmediatamente ya que solo queríamos el permiso; html5-qrcode abrirá su propio stream
      stream.getTracks().forEach(track => track.stop());
      
      setHasCameraPermission(true);

      if (!scannerInstance.current) {
        scannerInstance.current = new Html5Qrcode("qr-reader");
      }

      await scannerInstance.current.start(
        { facingMode: "environment" }, 
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          onScan(decodedText);
          toast({ title: "Código detectado", description: decodedText });
        },
        () => {
          // Errores de escaneo silenciosos
        }
      );
      setIsEnabled(true);
    } catch (err) {
      console.error("Error iniciando cámara:", err);
      setHasCameraPermission(false);
      toast({
        variant: "destructive",
        title: "Permiso de Cámara Requerido",
        description: "Por favor, permite el acceso a la cámara en tu navegador para poder escanear.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleToggle = async () => {
    if (isEnabled) {
      await stopScanner();
    } else {
      await startScanner();
    }
  };

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-3xl overflow-hidden bg-black border-4 border-white shadow-2xl flex flex-col items-center justify-center">
      {/* 
        Mantenemos el contenedor siempre en el DOM pero oculto si no está activo 
        para evitar problemas de inicialización de la librería.
      */}
      <div 
        id="qr-reader" 
        className="w-full h-full" 
        style={{ display: isEnabled ? 'block' : 'none' }} 
      />

      {!isEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-6 bg-slate-900/90 text-center z-10">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/30 animate-pulse">
            <Scan className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-black text-xl tracking-tight">Escáner de Productos</h3>
            <p className="text-slate-400 text-sm max-w-[240px] mx-auto leading-relaxed">
              Usa la cámara trasera para identificar productos mediante su código de barras.
            </p>
          </div>
          
          <Button 
            onClick={handleToggle} 
            disabled={isLoading}
            className="rounded-2xl px-12 h-16 text-lg font-black bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/40 transition-all active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="mr-3 w-6 h-6 animate-spin" />
            ) : (
              <Camera className="mr-3 w-6 h-6" />
            )}
            {isLoading ? "SOLICITANDO ACCESO..." : "ACTIVAR CÁMARA"}
          </Button>
          
          {hasCameraPermission === false && (
            <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/20 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Acceso Denegado</AlertTitle>
              <AlertDescription>
                Debes habilitar los permisos en los ajustes de tu navegador (icono de candado en la barra de direcciones).
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isEnabled && (
        <>
          <div className="absolute inset-0 pointer-events-none z-20">
            <div className="absolute inset-0 border-[60px] border-black/60 flex items-center justify-center">
              <div className="w-full h-full max-w-[280px] max-h-[180px] relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-[bounce_2s_infinite]"></div>
              </div>
            </div>
          </div>
          
          <Button 
            variant="destructive" 
            size="sm" 
            className="absolute top-6 right-6 rounded-full shadow-2xl font-bold z-30 px-4 h-10"
            onClick={handleToggle}
          >
            <XCircle className="w-5 h-5 mr-2" />
            DETENER
          </Button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-white/10">
              Escáner EAN Activo
            </span>
          </div>
        </>
      )}
    </div>
  );
}
