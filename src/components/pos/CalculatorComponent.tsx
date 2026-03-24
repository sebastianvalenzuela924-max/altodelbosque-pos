
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, Divide, CheckCircle2, Trash2, RotateCcw, Banknote, Delete, Loader2, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorComponentProps {
  baseValue: number;
  isProcessing?: boolean;
  onFinalize: (amount: number) => void;
  onClearCart?: () => void;
}

export function CalculatorComponent({ 
  baseValue, 
  isProcessing = false,
  onFinalize,
  onClearCart
}: CalculatorComponentProps) {
  const [display, setDisplay] = useState(Math.round(baseValue).toString());
  const [equation, setEquation] = useState("");
  const [isReset, setIsReset] = useState(true);
  const [startedFromBase, setStartedFromBase] = useState(true);
  
  const [isCashMode, setIsCashMode] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  useEffect(() => {
    if (isReset && !isCashMode && equation === "" && startedFromBase) {
      setDisplay(Math.round(baseValue).toString());
    }
  }, [baseValue, isReset, isCashMode, equation, startedFromBase]);

  const calculateResult = (forceEquation?: string) => {
    const currentVal = isReset ? "" : display;
    const eqToEval = forceEquation || (equation + currentVal);
    
    if (!eqToEval.trim()) return Math.round(baseValue);
    
    try {
      let sanitized = eqToEval.trim();
      while (sanitized.match(/[+\-×÷]\s*$/)) {
        sanitized = sanitized.replace(/[+\-×÷]\s*$/, "").trim();
      }
      
      if (!sanitized) return parseInt(display || "0");
      
      const evalString = sanitized.replace(/×/g, '*').replace(/÷/g, '/');
      const result = eval(evalString);
      return Math.round(result ?? 0);
    } catch (e) {
      return parseInt(display || "0");
    }
  };

  const handleNumber = (n: string) => {
    if (isCashMode) {
      setCashReceived(prev => prev === "0" ? n : prev + n);
      return;
    }

    if (isReset) {
      setDisplay(n);
      setIsReset(false);
      if (equation === "") setStartedFromBase(false);
    } else {
      setDisplay(display === "0" ? n : display + n);
    }
  };

  const handleOperator = (op: string) => {
    if (isCashMode) return;
    const currentVal = display || "0";

    if (isReset && equation !== "" && !startedFromBase) {
      setEquation(prev => {
        const parts = prev.trim().split(" ");
        if (parts.length > 1) {
          return parts.slice(0, -1).join(" ") + " " + op + " ";
        }
        return prev;
      });
      return;
    }

    if (equation === "") {
      setEquation(currentVal + " " + op + " ");
    } else {
      const result = calculateResult();
      setEquation(prev => prev + (isReset ? "" : currentVal) + " " + op + " ");
      setDisplay(result.toString());
    }
    
    setIsReset(true);
    setStartedFromBase(false);
  };

  const handleCalculate = () => {
    if (isCashMode) return;
    const result = calculateResult();
    setDisplay(result.toString());
    setEquation("");
    setIsReset(true);
    setStartedFromBase(false);
  };

  const clear = () => {
    if (isCashMode) {
      setCashReceived("");
      return;
    }
    setDisplay(Math.round(baseValue).toString());
    setEquation("");
    setIsReset(true);
    setStartedFromBase(true);
  };

  const handleFinalizeNormal = () => {
    const amount = calculateResult();
    if (!isNaN(amount)) {
      onFinalize(amount);
      setDisplay("0");
      setEquation("");
      setIsReset(true);
      setIsCashMode(false);
      setCashReceived("");
      setStartedFromBase(false);
    }
  };

  const toggleCashMode = () => {
    if (!isCashMode) {
      const result = calculateResult();
      setDisplay(result.toString());
      setEquation("");
    }
    setIsCashMode(!isCashMode);
    setCashReceived("");
  };

  const totalToPay = calculateResult();
  const receivedAmount = parseInt(cashReceived || "0");
  const changeAmount = receivedAmount > 0 ? receivedAmount - totalToPay : 0;
  const isShowingBaseValue = startedFromBase && equation === "" && isReset;

  return (
    <div className="space-y-4">
        {/* Pantalla Unificada del Total */}
        <div className={cn(
          "rounded-2xl p-4 shadow-inner border text-right transition-all duration-300 min-h-[120px] flex flex-col justify-center",
          isCashMode ? "bg-green-50 border-green-200" : isShowingBaseValue ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-200"
        )}>
          {!isCashMode ? (
            <>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {isShowingBaseValue ? "Total en Caja" : equation ? "Calculando..." : "Monto Final"}
                </span>
                <span className="text-[9px] font-mono text-slate-300 uppercase">Terminal V1</span>
              </div>
              
              <div className="text-xs font-mono text-slate-400 mb-1 overflow-hidden truncate h-4">
                {equation || (isShowingBaseValue ? "Monto base del inventario" : "")}
              </div>

              <div className={cn(
                "text-4xl sm:text-5xl font-black font-mono tracking-tighter transition-colors",
                isShowingBaseValue ? "text-primary" : "text-slate-800"
              )}>
                ${parseInt(display || "0").toLocaleString('es-CL')}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between items-center pb-1 border-b border-green-100">
                <span className="text-[10px] font-black uppercase text-green-600">A Pagar:</span>
                <span className="text-lg font-black font-mono text-slate-600">${totalToPay.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[10px] font-black uppercase text-green-600">Recibido:</span>
                <span className="text-2xl font-black font-mono text-primary">${receivedAmount.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t-2 border-green-200">
                <span className="text-[10px] font-black uppercase text-green-600">Vuelto:</span>
                <span className={cn(
                  "text-3xl font-black font-mono",
                  changeAmount < 0 ? "text-destructive" : "text-green-600"
                )}>
                  ${Math.max(0, changeAmount).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Teclado Integrado */}
        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="h-14 rounded-xl font-bold bg-slate-50" onClick={clear}>CE</Button>
          <Button variant="outline" className="h-14 rounded-xl font-bold" onClick={() => handleOperator("÷")} disabled={isCashMode}><Divide className="w-5 h-5"/></Button>
          <Button variant="outline" className="h-14 rounded-xl font-bold" onClick={() => handleOperator("×")} disabled={isCashMode}><X className="w-5 h-5"/></Button>
          <Button variant="outline" className="h-14 rounded-xl font-bold" onClick={() => handleOperator("-")} disabled={isCashMode}><Minus className="w-5 h-5"/></Button>

          {[7, 8, 9].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" className="h-14 rounded-xl font-bold" onClick={() => handleOperator("+")} disabled={isCashMode}><Plus className="w-5 h-5"/></Button>

          {[4, 5, 6].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" className="h-14 rounded-xl font-bold bg-slate-100" onClick={handleCalculate} disabled={isCashMode}><Equal className="w-5 h-5"/></Button>

          {[1, 2, 3].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          
          <Button 
            className={cn(
              "h-14 rounded-xl font-black text-[10px] uppercase flex flex-col items-center justify-center row-span-2 border-2",
              isCashMode ? "bg-green-600 text-white border-green-700" : "bg-white border-green-600 text-green-600"
            )}
            onClick={toggleCashMode}
          >
            <Banknote className="w-5 h-5 mb-0.5" />
            {isCashMode ? "Caja" : "Efectivo"}
          </Button>

          <Button variant="secondary" className="h-14 text-2xl font-black col-span-2 rounded-xl" onClick={() => handleNumber("0")}>0</Button>
          <Button variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(".")}>.</Button>
        </div>

        {/* Acción Final */}
        <Button 
            className={cn(
              "w-full h-24 text-2xl font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4 mt-4",
              isProcessing ? "bg-slate-400" : "bg-primary hover:bg-primary/90"
            )}
            onClick={handleFinalizeNormal}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
            {isProcessing ? "PROCESANDO..." : "COBRAR VENTA"}
        </Button>
    </div>
  );
}
