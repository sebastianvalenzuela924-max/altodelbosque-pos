"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, Divide, CheckCircle2, Trash2, RotateCcw, Banknote, Delete, Loader2 } from "lucide-react";
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
  
  // Estados para el cálculo de vuelto
  const [isCashMode, setIsCashMode] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  // Sincronizar con el valor base de la caja (total del carrito)
  useEffect(() => {
    if (isReset && !isCashMode && equation === "") {
      setDisplay(Math.round(baseValue).toString());
      setStartedFromBase(true);
    }
  }, [baseValue, isReset, isCashMode, equation]);

  const handleNumber = (n: string) => {
    if (isCashMode) {
      setCashReceived(prev => prev === "0" ? n : prev + n);
      return;
    }

    if (isReset) {
      setDisplay(n);
      setIsReset(false);
      // Si el usuario empieza a escribir, ya no es solo el monto de caja puro
      if (equation === "") setStartedFromBase(false);
    } else {
      setDisplay(display === "0" ? n : display + n);
    }
  };

  const handleOperator = (op: string) => {
    if (isCashMode) return;
    
    // Si ya hay un operador al final y no hemos escrito un número nuevo, lo reemplazamos
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

    const valToAdd = display;
    const nextFullEq = equation + valToAdd;
    
    // Calculamos el subtotal para mostrarlo en el display en lugar de 0
    try {
      const sanitized = nextFullEq.replace(/×/g, '*').replace(/÷/g, '/');
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      setDisplay(Math.round(result).toString());
    } catch (e) {
      // Si falla el eval, mantenemos el display actual
    }

    setEquation(nextFullEq + " " + op + " ");
    setIsReset(true);
    setStartedFromBase(false);
  };

  const calculateResult = () => {
    if (!equation) return parseInt(display || "0");
    try {
      // La ecuación completa es lo que llevamos + lo que hay en display
      const fullEq = equation + (isReset ? "0" : display);
      const sanitizedEq = fullEq.replace(/×/g, '*').replace(/÷/g, '/');
      // eslint-disable-next-line no-eval
      const result = eval(sanitizedEq);
      return Math.round(result);
    } catch (e) {
      return parseInt(display || "0");
    }
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

  const forceZero = () => {
    setDisplay("0");
    setEquation("");
    setIsReset(true);
    setIsCashMode(false);
    setCashReceived("");
    setStartedFromBase(false);
  };

  const handleFinalizeNormal = () => {
    const amount = calculateResult();
    if (!isNaN(amount)) {
      setIsReset(true);
      setEquation("");
      setDisplay("0"); 
      setIsCashMode(false);
      setCashReceived("");
      setStartedFromBase(true);
      onFinalize(amount);
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
  
  // Determinar si lo que se muestra es puramente el monto de la caja inicial
  const isShowingBaseValue = startedFromBase && equation === "" && isReset;

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        {/* Pantalla de la Calculadora */}
        <div className={cn(
          "rounded-2xl p-4 shadow-inner border text-right transition-all duration-300 min-h-[140px] flex flex-col justify-end",
          isCashMode ? "bg-green-50 border-green-200" : isShowingBaseValue ? "bg-primary/10 border-primary/30" : "bg-white"
        )}>
          {!isCashMode ? (
            <>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1">
                  {isShowingBaseValue && (
                    <span className="text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                      Monto de Caja
                    </span>
                  )}
                  {equation && (
                    <span className="text-[9px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Operación en curso
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase font-black tracking-widest max-w-[200px] truncate">
                  {equation ? "Historial de sumas" : "Calculadora"}
                </div>
              </div>
              
              {/* Historial de la suma arriba del número principal */}
              <div className="text-sm font-mono text-slate-400 mb-2 overflow-hidden text-ellipsis whitespace-nowrap min-h-[1.25rem]">
                {equation || (isShowingBaseValue ? "" : "Entrada manual...")}
              </div>

              <div className={cn(
                "text-4xl sm:text-5xl font-black font-mono truncate transition-colors",
                isShowingBaseValue ? "text-primary" : "text-slate-800"
              )}>
                ${parseInt(display || "0").toLocaleString('es-CL')}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-green-100 pb-1">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Total:</span>
                <span className="text-xl font-black font-mono text-slate-700">${totalToPay.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Recibido:</span>
                <span className="text-3xl font-black font-mono text-primary">${receivedAmount.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-green-300">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest font-bold">Vuelto:</span>
                <span className={cn(
                  "text-4xl font-black font-mono",
                  changeAmount < 0 ? "text-destructive" : "text-green-600"
                )}>
                  ${Math.max(0, changeAmount).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botones de Control Rápido */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11 text-[10px] font-black uppercase tracking-widest rounded-xl border-primary/30 hover:bg-primary/5" onClick={clear}>
            <RotateCcw className="w-4 h-4 mr-2 text-primary" />
            Monto caja
          </Button>
          <Button variant="outline" className="flex-1 h-11 text-[10px] font-black uppercase tracking-widest rounded-xl border-destructive/30 hover:bg-destructive/5" onClick={forceZero}>
            <Trash2 className="w-4 h-4 mr-2 text-destructive" />
            Todo a Cero
          </Button>
        </div>

        {/* Teclado Numérico */}
        <div className="grid grid-cols-4 gap-2">
          <Button variant="secondary" className="h-14 text-lg font-bold rounded-xl" onClick={clear}>
            {isCashMode ? <Delete className="w-5 h-5"/> : "CE"}
          </Button>
          <Button variant="outline" disabled={isCashMode} className="h-14 text-lg font-bold rounded-xl" onClick={() => handleOperator("÷")}><Divide className="w-5 h-5"/></Button>
          <Button variant="outline" disabled={isCashMode} className="h-14 text-lg font-bold rounded-xl" onClick={() => handleOperator("×")}><X className="w-5 h-5"/></Button>
          <Button variant="outline" disabled={isCashMode} className="h-14 text-lg font-bold rounded-xl" onClick={() => handleOperator("-")}><Minus className="w-5 h-5"/></Button>

          {[7, 8, 9].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" disabled={isCashMode} className="h-14 text-lg font-bold rounded-xl" onClick={() => handleOperator("+")}><Plus className="w-5 h-5"/></Button>

          {[4, 5, 6].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button 
            variant="primary" 
            disabled={isCashMode}
            className="h-14 text-2xl font-black row-span-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-800" 
            onClick={handleCalculate}
          >
            =
          </Button>

          {[1, 2, 3].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          
          <Button variant="secondary" className="h-14 text-2xl font-black col-span-2 rounded-xl" onClick={() => handleNumber("0")}>0</Button>
          <Button variant="secondary" className="h-14 text-2xl font-black rounded-xl" onClick={() => handleNumber(".")}>.</Button>
          
          <Button 
            className={cn(
              "h-14 rounded-xl font-black text-[10px] uppercase tracking-tighter flex flex-col items-center justify-center leading-none shadow-md",
              isCashMode ? "bg-green-600 text-white hover:bg-green-700" : "bg-white border-2 border-green-600 text-green-600 hover:bg-green-50"
            )}
            onClick={toggleCashMode}
          >
            <Banknote className="w-5 h-5 mb-0.5" />
            {isCashMode ? "VOLVER" : "EFECTIVO"}
          </Button>
        </div>

        {/* Botones de Finalización */}
        <div className="space-y-3 mt-4">
          <Button 
            className={cn(
              "w-full h-20 text-2xl font-black rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4",
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
            {isProcessing ? "PROCESANDO..." : "COBRAR"}
          </Button>

          <Button 
            variant="ghost"
            className="w-full h-12 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl text-destructive hover:bg-destructive/10"
            onClick={onClearCart}
            disabled={isProcessing}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Vaciar Caja Completa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
