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
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error al detener el escáner:", err);
      }
    }
    setIsEnabled(false);
    setIsLoading(false);
  };

  const startScanner = async () => {
    setError(null);
    setIsLoading(true);
    
    // Paso 1: Mostrar el contenedor en el DOM
    setIsEnabled(true);

    // Paso 2: Pequeño retardo para asegurar que el DOM se ha renderizado
    setTimeout(async () => {
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader");
        }

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          // No forzamos aspectRatio para evitar errores de restricciones en algunos móviles
        };

        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            onScan(decodedText);
            toast({ title: "Código detectado", description: decodedText });
          },
          () => {
            // Callback de error de escaneo (silencioso)
          }
        );
        setIsLoading(false);
      } catch (err: any) {
        console.error("Error iniciando escáner:", err);
        setError(err.message || "No se pudo acceder a la cámara.");
        setIsEnabled(false);
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Error de Cámara",
          description: "Asegúrate de dar permisos y que ninguna otra app esté usando la cámara.",
        });
      }
    }, 300); // Retardo para que el div#qr-reader esté listo
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-3xl overflow-hidden bg-black border-4 border-white shadow-2xl flex flex-col items-center justify-center">
      {/* El elemento del escáner debe estar en el DOM cuando se llama a start() */}
      {isEnabled && (
        <div 
          id="qr-reader" 
          className="w-full h-full" 
        />
      )}

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
            onClick={startScanner} 
            disabled={isLoading}
            className="rounded-2xl px-12 h-16 text-lg font-black bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/40 transition-all active:scale-95"
          >
            {isLoading ? (
              <Loader2 className="mr-3 w-6 h-6 animate-spin" />
            ) : (
              <Camera className="mr-3 w-6 h-6" />
            )}
            {isLoading ? "CONECTANDO..." : "ACTIVAR CÁMARA"}
          </Button>
          
          {error && (
            <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/20 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Error de Acceso</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isEnabled && !isLoading && (
        <>
          {/* Capas personalizadas de la interfaz del escáner */}
          <div className="absolute inset-0 pointer-events-none z-20">
             <div className="absolute inset-0 border-[40px] border-black/40 flex items-center justify-center">
                <div className="w-[250px] h-[150px] relative border-2 border-primary/30 rounded-lg overflow-hidden">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/60 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-[bounce_2s_infinite]"></div>
                </div>
             </div>
          </div>
          
          <Button 
            variant="destructive" 
            size="sm" 
            className="absolute top-4 right-4 rounded-full shadow-2xl font-bold z-30 px-4 h-10"
            onClick={stopScanner}
          >
            <XCircle className="w-5 h-5 mr-2" />
            DETENER
          </Button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/10">
              Buscando código EAN...
            </span>
          </div>
        </>
      )}
      
      {isLoading && isEnabled && (
        <div className="absolute inset-0 z-40 bg-black flex items-center justify-center">
             <div className="flex flex-col items-center gap-4">
               <Loader2 className="w-12 h-12 text-primary animate-spin" />
               <p className="text-white text-xs font-bold animate-pulse">CARGANDO CÁMARA...</p>
             </div>
        </div>
      )}
    </div>
  );
}