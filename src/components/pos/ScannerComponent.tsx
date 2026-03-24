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
    setIsEnabled(true);

    setTimeout(async () => {
      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader");
        }

        // Configuración optimizada para mayor distancia y nitidez
        const config = {
          fps: 20, // Mayor frecuencia de escaneo
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Área de escaneo ancha y más grande para facilitar detección lejana
            const width = Math.min(viewfinderWidth * 0.85, 450);
            const height = Math.min(viewfinderHeight * 0.45, 250);
            return { width, height };
          },
          aspectRatio: 1.777778, // Forzar 16:9 para mejor campo de visión
        };

        await scannerRef.current.start(
          { 
            facingMode: "environment",
            // Solicitamos resolución HD para permitir detección desde más lejos
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          },
          config,
          (decodedText) => {
            onScan(decodedText);
          },
          () => {} // Ignorar errores de frame no detectado
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
          description: "Permite el acceso a la cámara y asegúrate de estar en un sitio iluminado.",
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
    <div className="relative w-full aspect-square md:aspect-video rounded-3xl overflow-hidden bg-black border-4 border-white shadow-2xl flex flex-col items-center justify-center">
      {isEnabled && (
        <div id="qr-reader" className="w-full h-full" />
      )}

      {!isEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-6 bg-slate-900 text-center z-10">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/30">
            <Scan className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold text-lg">Escáner de Barra</h3>
            <p className="text-slate-400 text-xs px-4">
              Enfoca el código de barras. No acerques demasiado el teléfono para evitar desenfoque.
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
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-[10px]">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isEnabled && !isLoading && (
        <>
          <div className="absolute inset-0 pointer-events-none z-20">
             <div className="absolute inset-0 border-[30px] border-black/40 flex items-center justify-center">
                <div className="w-[85%] max-w-[450px] h-[45%] max-h-[250px] relative border-2 border-primary/50 rounded-lg bg-primary/5">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/60 animate-pulse"></div>
                </div>
             </div>
          </div>
          
          <Button 
            variant="destructive" 
            size="sm" 
            className="absolute top-4 right-4 rounded-full z-30 px-4 h-9 font-bold"
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
    </div>
  );
}
