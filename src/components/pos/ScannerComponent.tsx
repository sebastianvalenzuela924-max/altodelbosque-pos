"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, Camera, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScannerComponent({ onScan }: { onScan: (decodedText: string) => void }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isEnabled && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScan(decodedText);
          // Briefly disable scanner to prevent double scans
          setIsEnabled(false);
          setTimeout(() => setIsEnabled(true), 1500);
        },
        (error) => {
          // console.warn(error);
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        scannerRef.current = null;
      }
    };
  }, [isEnabled, onScan]);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center border shadow-inner">
      {!isEnabled ? (
        <div className="text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <Scan className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Cámara desactivada</p>
          <Button onClick={() => setIsEnabled(true)} className="rounded-full px-8">
            <Camera className="mr-2 w-4 h-4" />
            Activar Escáner
          </Button>
        </div>
      ) : (
        <>
          <div id="qr-reader" className="w-full h-full" />
          <Button 
            variant="destructive" 
            size="sm" 
            className="absolute top-2 right-2 rounded-full"
            onClick={() => setIsEnabled(false)}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Detener
          </Button>
        </>
      )}
    </div>
  );
}
