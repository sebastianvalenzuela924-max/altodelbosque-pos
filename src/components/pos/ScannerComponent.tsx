"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Scan, Camera, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function ScannerComponent({ onScan }: { onScan: (decodedText: string) => void }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isInitializingRef = useRef(false);
  const hasScannedRef = useRef(false);
  
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        // Ignorar errores al detener manualmente
      }
    }
    setIsEnabled(false);
    setIsLoading(false);
    isInitializingRef.current = false;
    hasScannedRef.current = false;
  };

  const applyAdvancedConstraints = async (videoTrack: MediaStreamTrack) => {
    try {
      const capabilities = videoTrack.getCapabilities() as any;
      const constraints = {} as any;

      if (capabilities.zoom) {
        constraints.zoom = Math.min(2.0, capabilities.zoom.max);
      }
      
      if (capabilities.focusMode?.includes('continuous')) {
        constraints.focusMode = 'continuous';
      }

      if (Object.keys(constraints).length > 0) {
        await videoTrack.applyConstraints({ advanced: [constraints] } as any);
      }
    } catch (e) {
      // Constraints avanzados no soportados
    }
  };

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout;

    async function initScanner() {
      if (!isEnabled || !isMounted || isInitializingRef.current) return;

      checkInterval = setInterval(async () => {
        const element = document.getElementById("qr-reader");
        if (element && isMounted && !isInitializingRef.current) {
          clearInterval(checkInterval);
          isInitializingRef.current = true;
          
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
                  Html5QrcodeSupportedFormats.CODE_39,
                ]
              });
            }

            const config = {
              fps: 20,
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const width = Math.max(50, Math.min(viewfinderWidth * 0.8, 400));
                const height = Math.max(50, Math.min(viewfinderHeight * 0.4, 200));
                return { width, height };
              },
              aspectRatio: 1.0,
            };

            if (scannerRef.current && !scannerRef.current.isScanning) {
              await scannerRef.current.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                  if (hasScannedRef.current) return;
                  hasScannedRef.current = true;
                  
                  // Detener el escaneo inmediatamente para evitar duplicados
                  if (scannerRef.current?.isScanning) {
                    await scannerRef.current.stop().catch(() => {});
                  }
                  
                  onScanRef.current(decodedText);
                },
                () => {} 
              );

              const videoElement = document.querySelector("#qr-reader video") as HTMLVideoElement;
              if (videoElement && videoElement.srcObject) {
                const stream = videoElement.srcObject as MediaStream;
                const track = stream.getVideoTracks()[0];
                if (track) {
                  await applyAdvancedConstraints(track);
                }
              }
            }

            if (isMounted) {
              setIsLoading(false);
              isInitializingRef.current = false;
            }
          } catch (err: any) {
            if (isMounted) {
              setError("No se pudo acceder a la cámara. Por favor, revisa los permisos del navegador.");
              setIsEnabled(false);
              setIsLoading(false);
              isInitializingRef.current = false;
            }
          }
        }
      }, 150);
    }

    initScanner();

    return () => {
      isMounted = false;
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isEnabled]);

  const handleToggleScanner = () => {
    if (isEnabled) {
      stopScanner();
    } else {
      setError(null);
      setIsLoading(true);
      setIsEnabled(true);
      hasScannedRef.current = false;
    }
  };

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
              Apunta al código de barras del producto.
            </p>
          </div>
          
          <Button 
            onClick={handleToggleScanner} 
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
            <Alert variant="destructive" className="mt-4 mx-4 border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error de Cámara</AlertTitle>
              <AlertDescription className="text-[10px] leading-tight">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isEnabled && !isLoading && (
        <>
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
             <div className="w-[80%] max-w-[400px] h-[40%] max-h-[200px] relative border-2 border-primary/50 rounded-lg bg-primary/5">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary"></div>
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
        <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-white text-[10px] font-black tracking-[0.3em] uppercase">Iniciando Cámara...</p>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
    </div>
  );
}