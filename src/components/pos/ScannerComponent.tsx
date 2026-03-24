
"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, Camera, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export function ScannerComponent({ onScan }: { onScan: (decodedText: string) => void }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for camera permissions initially
    if (isEnabled) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setHasCameraPermission(true))
        .catch((err) => {
          setHasCameraPermission(false);
          setIsEnabled(false);
          toast({
            variant: "destructive",
            title: "Acceso a cámara denegado",
            description: "Por favor, habilita los permisos de cámara en tu navegador.",
          });
        });
    }
  }, [isEnabled, toast]);

  useEffect(() => {
    if (isEnabled && hasCameraPermission && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 15, 
          qrbox: { width: 250, height: 150 }, 
          rememberLastUsedCamera: true,
          aspectRatio: 1.777778
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScan(decodedText);
          // Briefly disable scanner to prevent double scans
          setIsEnabled(false);
          // Auto re-enable after a short delay
          setTimeout(() => setIsEnabled(true), 2000);
        },
        (error) => {
          // Errors are expected during scanning process
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        scannerRef.current = null;
      }
    };
  }, [isEnabled, hasCameraPermission, onScan]);

  return (
    <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-900 flex flex-col items-center justify-center border-4 border-slate-100 shadow-2xl">
      {!isEnabled ? (
        <div className="text-center p-8 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto border-4 border-primary/20 animate-pulse">
            <Scan className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-white font-bold text-lg">Escáner de Códigos EAN</p>
            <p className="text-slate-400 text-sm max-w-[200px] mx-auto">Coloca el código de barras frente a la cámara.</p>
          </div>
          <Button onClick={() => setIsEnabled(true)} className="rounded-full px-10 h-14 text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
            <Camera className="mr-3 w-6 h-6" />
            Activar Cámara
          </Button>
          
          {hasCameraPermission === false && (
            <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive/20 text-destructive-foreground">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Permiso Requerido</AlertTitle>
              <AlertDescription>
                Habilita la cámara en la configuración del sitio para escanear.
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <>
          <div id="qr-reader" className="w-full h-full" />
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
            <div className="w-64 h-32 border-2 border-primary shadow-[0_0_0_1000px_rgba(0,0,0,0.3)] relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/50 animate-bounce"></div>
            </div>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            className="absolute top-4 right-4 rounded-full shadow-lg"
            onClick={() => setIsEnabled(false)}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Cerrar Escáner
          </Button>
        </>
      )}
    </div>
  );
}
