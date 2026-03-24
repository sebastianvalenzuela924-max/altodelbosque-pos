"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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
    setIsEnabled(true);

    // Pequeño retardo para asegurar que el contenedor DOM existe
    setTimeout(async () => {
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader", {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ]
          });
        }

        const config = {
          fps: 25, // Mayor velocidad de procesamiento
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Rectángulo optimizado para códigos de barras (ancho y bajo)
            const width = Math.min(viewfinderWidth * 0.8, 400);
            const height = Math.min(viewfinderHeight * 0.3, 150);
            return { width, height };
          },
          aspectRatio: 1.0,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // Usa hardware dedicado si está disponible
          },
        };

        // Solicitar cámara trasera con enfoque optimizado si el navegador lo permite
        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            onScan(decodedText);
          },
          () => {} // Ignorar frames fallidos para no saturar la consola
        );
        setIsLoading(false);
      } catch (err: any) {
        console.error("Error iniciando escáner:", err);
        setError("Error de cámara. Por favor, revisa los permisos del navegador.");
        setIsEnabled(false);
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Error de Cámara",
          description: "No se pudo acceder a la cámara trasera.",
        });
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-3xl overflow-hidden bg-slate-950 border-4 border-white shadow-2xl flex flex-col items-center justify-center">
      {isEnabled && (
        <div id="qr-reader" className="w-full h-full [&_video]:object-cover" />
      )}

      {!isEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-6 bg-slate-900 text-center z-10">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/30">
            <Scan className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold text-lg">Escáner de Productos</h3>
            <p className="text-slate-400 text-xs px-4">
              Enfoca el código de barras dentro del recuadro.
            </p>
          </div>
          
          <Button 
            onClick={startScanner} 
            disabled={isLoading}
            className="rounded-2xl px-8 h-14 text-md font-bold bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
            ) : (
              <Camera className="mr-2 w-5 h-5" />
            )}
            ACTIVAR CÁMARA
          </Button>
          
          {error && (
            <Alert variant="destructive" className="mt-4 mx-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-[10px]">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isEnabled && !isLoading && (
        <>
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
             {/* Marco de enfoque */}
             <div className="w-[80%] max-w-[400px] h-[30%] max-h-[150px] relative border-2 border-primary/50 rounded-lg bg-primary/5">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary"></div>
                
                {/* Línea de escaneo láser */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
             </div>
          </div>
          
          <Button 
            variant="destructive" 
            size="sm" 
            className="absolute top-4 right-4 rounded-full z-30 px-4 h-9 font-bold shadow-lg"
            onClick={stopScanner}
          >
            <XCircle className="w-4 h-4 mr-2" />
            DETENER
          </Button>
        </>
      )}
      
      {isLoading && isEnabled && (
        <div className="absolute inset-0 z-40 bg-black flex items-center justify-center">
             <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 5%; }
          50% { top: 95%; }
        }
        #qr-reader__scan_region {
          display: flex;
          justify-content: center;
          align-items: center;
        }
      `}</style>
    </div>
  );
}
