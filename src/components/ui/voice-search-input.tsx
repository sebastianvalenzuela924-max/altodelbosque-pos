"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

const normalizeVoiceTranscription = (text: string) => {
  let normalized = text.toLowerCase();

  // El motor de voz a veces agrega guiones o junta palabras
  normalized = normalized.replace(/coca-cola/gi, 'coca cola');
  normalized = normalized.replace(/cocacola/gi, 'coca cola');

  const replacements: Record<string, string> = {
    "crispo": "kryzpo",
    "coca cola 0": "coca cola zero",
    "coca cola cero": "coca cola zero",
    "coca 0": "coca zero",
    "coca cero": "coca zero",
    "eme ele": "ml",
    "m l": "ml",
    "cien ml": "100ml",
    "ciento ml": "100ml",
    "un litro": "1L",
    "dos litros": "2L",
    "tres litros": "3L",
  };

  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    normalized = normalized.replace(regex, value);
  }

  normalized = normalized.replace(/(\d+)\s*litros?/gi, '$1L');
  normalized = normalized.replace(/(\d+)\s*l\b/gi, '$1L');
  normalized = normalized.replace(/(\d+)\s*ml\b/gi, '$1ml');

  return normalized;
};

export function VoiceSearchInput({ value, onChange, placeholder = "Buscar...", className, inputClassName }: VoiceSearchInputProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "es-CL";

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          const text = finalTranscript || interimTranscript;
          if (text) {
             onChange(normalizeVoiceTranscription(text));
          }
        };

        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onerror = () => setIsListening(false);
      }
    }
  }, [onChange]);

  const startListening = (e: React.PointerEvent) => {
    e.preventDefault();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Ignore
      }
    }
  };

  const stopListening = (e: React.PointerEvent) => {
    e.preventDefault();
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
      <Input 
        className={cn("pl-11 pr-14 h-12 bg-white rounded-2xl border-none shadow-sm font-bold w-full", inputClassName)} 
        placeholder={placeholder} 
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className={cn(
          "absolute right-2 p-2 rounded-full transition-all duration-300 flex items-center justify-center select-none touch-none",
          isListening 
            ? "bg-red-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse scale-125 z-20 border-2 border-white" 
            : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 z-10"
        )}
        onPointerDown={startListening}
        onPointerUp={stopListening}
        onPointerLeave={stopListening}
        onContextMenu={(e) => e.preventDefault()}
        title="Mantén presionado para buscar por voz"
      >
        <Mic className={cn("transition-all duration-300", isListening ? "w-6 h-6" : "w-5 h-5")} />
      </button>
    </div>
  );
}
