"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, X, Divide, CheckCircle2, RotateCcw, Banknote, Loader2, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorComponentProps {
  baseValue: number;
  isProcessing?: boolean;
  onFinalize: (amount: number) => void;
  onClearCart: () => void;
}

/**
 * Calculadora Inteligente para POS.
 * Mantiene un "Ajuste Manual" sobre el total de la caja.
 * Si el usuario suma o resta montos, la calculadora guarda esa diferencia.
 * Al añadir productos (baseValue cambia), el total se actualiza manteniendo el ajuste.
 */
export function CalculatorComponent({ 
  baseValue, 
  isProcessing = false,
  onFinalize,
  onClearCart
}: CalculatorComponentProps) {
  // El ajuste manual es la diferencia entre el total real de productos y lo que el usuario quiere cobrar
  const [manualAdjustment, setManualAdjustment] = useState(0);
  
  // Estado interno del teclado de la calculadora
  const [display, setDisplay] = useState(""); 
  const [equation, setEquation] = useState(""); 
  const [isReset, setIsReset] = useState(true); 

  // Modo Efectivo / Vuelto
  const [isCashMode, setIsCashMode] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  // El total final que se muestra y se cobra (Caja + Ajuste Manual)
  const currentTotal = Math.round(baseValue + manualAdjustment);

  // Sincronización: Si se vacía la caja manualmente desde fuera, reseteamos el ajuste
  useEffect(() => {
    if (baseValue === 0) {
      setManualAdjustment(0);
      setEquation("");
      setDisplay("");
      setIsReset(true);
    }
  }, [baseValue]);

  const calculateResult = (eq: string, currentDisp: string): number => {
    const valToEval = isReset ? "" : currentDisp;
    const fullEq = (eq + valToEval).trim();
    
    if (!fullEq) return currentTotal;

    try {
      let sanitized = fullEq;
      // Limpiar operadores al final
      while (sanitized.match(/[+\-×÷]\s*$/)) {
        sanitized = sanitized.replace(/[+\-×÷]\s*$/, "").trim();
      }
      if (!sanitized) return currentTotal;

      const evalString = sanitized.replace(/×/g, '*').replace(/÷/g, '/');
      // eslint-disable-next-line no-eval
      const result = eval(evalString);
      return Math.round(result ?? 0);
    } catch {
      return currentTotal;
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
    } else {
      setDisplay(display === "0" ? n : display + n);
    }
  };

  const handleOperator = (op: string) => {
    if (isCashMode) return;
    
    // Si empezamos una operación desde cero, tomamos el total actual como base
    const startVal = (isReset && equation === "") ? currentTotal.toString() : (display || "0");
    
    if (equation === "") {
      setEquation(startVal + " " + op + " ");
    } else {
      const result = calculateResult(equation, display);
      setEquation(result.toString() + " " + op + " ");
      setManualAdjustment(result - baseValue);
    }
    setIsReset(true);
    setDisplay("");
  };

  const handleCalculate = () => {
    if (isCashMode || equation === "") return;
    const result = calculateResult(equation, display);
    setManualAdjustment(result - baseValue);
    setEquation("");
    setDisplay("");
    setIsReset(true);
  };

  const clear = () => {
    if (isCashMode) {
      setCashReceived("");
      return;
    }
    setManualAdjustment(0);
    setEquation("");
    setDisplay("");
    setIsReset(true);
  };

  const handleFinalizeNormal = () => {
    // Si hay una ecuación pendiente, la resolvemos antes de cobrar
    const finalAmount = equation !== "" ? calculateResult(equation, display) : currentTotal;
    onFinalize(finalAmount);
    
    // Reset de estado tras cobro
    setManualAdjustment(0);
    setEquation("");
    setDisplay("");
    setIsReset(true);
    setIsCashMode(false);
    setCashReceived("");
  };

  const toggleCashMode = () => {
    if (!isCashMode && equation !== "") {
      handleCalculate();
    }
    setIsCashMode(!isCashMode);
    setCashReceived("");
  };

  const receivedAmount = parseInt(cashReceived || "0");
  const changeAmount = receivedAmount > 0 ? receivedAmount - currentTotal : 0;
  
  // Lógica de visualización del visor principal
  const displayToUser = isCashMode 
    ? "" // No se usa en modo cash
    : (equation !== "" && !isReset) 
      ? display // Mostramos lo que el usuario escribe
      : (equation !== "" && isReset)
        ? calculateResult(equation, "").toString() // Resultado parcial del operador
        : currentTotal.toString(); // Total final sincronizado

  return (
    <div className="space-y-3 md:space-y-4">
        {/* Pantalla Unificada del Total */}
        <div className={cn(
          "rounded-2xl p-3 md:p-4 shadow-inner border text-right transition-all duration-300 min-h-[90px] md:min-h-[110px] flex flex-col justify-center",
          isCashMode ? "bg-green-50 border-green-200" : (manualAdjustment === 0 && equation === "") ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-slate-200"
        )}>
          {!isCashMode ? (
            <>
              <div className="flex justify-between items-center mb-0.5 md:mb-1">
                <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {equation ? "Operación en curso" : manualAdjustment !== 0 ? "Cobro con Ajuste" : "Total en Caja"}
                </span>
                <span className="text-[8px] md:text-[9px] font-mono text-slate-300 uppercase tracking-tighter">Terminal AltodelBosque</span>
              </div>
              
              <div className="text-[10px] font-mono text-slate-400 mb-0.5 overflow-hidden truncate h-3 md:h-4">
                {equation || (manualAdjustment !== 0 ? `Ajuste manual: $${manualAdjustment.toLocaleString('es-CL')}` : "Sincronizado con productos")}
              </div>

              <div className={cn(
                "text-3xl md:text-5xl font-black font-mono tracking-tighter transition-colors",
                (manualAdjustment === 0 && equation === "") ? "text-primary" : "text-slate-800"
              )}>
                ${parseInt(displayToUser || "0").toLocaleString('es-CL')}
              </div>
            </>
          ) : (
            <div className="space-y-0.5 md:space-y-1">
              <div className="flex justify-between items-center pb-0.5 border-b border-green-100">
                <span className="text-[8px] md:text-[10px] font-black uppercase text-green-600">A Pagar:</span>
                <span className="text-base md:text-lg font-black font-mono text-slate-600">${currentTotal.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[8px] md:text-[10px] font-black uppercase text-green-600">Recibido:</span>
                <span className="text-xl md:text-2xl font-black font-mono text-primary">${receivedAmount.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5 border-t-2 border-green-200">
                <span className="text-[8px] md:text-[10px] font-black uppercase text-green-600">Vuelto:</span>
                <span className={cn(
                  "text-2xl md:text-3xl font-black font-mono",
                  changeAmount < 0 ? "text-destructive" : "text-green-600"
                )}>
                  ${Math.max(0, changeAmount).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Teclado Integrado */}
        <div className="grid grid-cols-4 gap-1 md:gap-2">
          <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold bg-slate-50 text-xs md:text-sm" onClick={clear}>CE</Button>
          <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold" onClick={() => handleOperator("÷")} disabled={isCashMode}><Divide className="w-4 h-4 md:w-5 md:h-5"/></Button>
          <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold" onClick={() => handleOperator("×")} disabled={isCashMode}><X className="w-4 h-4 md:w-5 md:h-5"/></Button>
          <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold" onClick={() => handleOperator("-")} disabled={isCashMode}><Minus className="w-4 h-4 md:w-5 md:h-5"/></Button>

          {[7, 8, 9].map((n) => (
            <Button key={n} variant="secondary" className="h-11 md:h-14 text-xl md:text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold" onClick={() => handleOperator("+")} disabled={isCashMode}><Plus className="w-4 h-4 md:w-5 md:h-5"/></Button>

          {[4, 5, 6].map((n) => (
            <Button key={n} variant="secondary" className="h-11 md:h-14 text-xl md:text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold bg-slate-100" onClick={handleCalculate} disabled={isCashMode}><Equal className="w-4 h-4 md:w-5 md:h-5"/></Button>

          {[1, 2, 3].map((n) => (
            <Button key={n} variant="secondary" className="h-11 md:h-14 text-xl md:text-2xl font-black rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          
          <Button 
            className={cn(
              "h-11 md:h-14 rounded-xl font-black text-[8px] md:text-[10px] uppercase flex flex-col items-center justify-center row-span-2 border-2 transition-all",
              isCashMode ? "bg-green-600 text-white border-green-700" : "bg-white border-green-600 text-green-600 hover:bg-green-50"
            )}
            onClick={toggleCashMode}
          >
            <Banknote className="w-4 h-4 md:w-5 md:h-5 mb-0.5" />
            {isCashMode ? "Pagar" : "Efectivo"}
          </Button>

          <Button variant="secondary" className="h-11 md:h-14 text-xl md:text-2xl font-black col-span-2 rounded-xl" onClick={() => handleNumber("0")}>0</Button>
          <Button variant="secondary" className="h-11 md:h-14 text-xl md:text-2xl font-black rounded-xl" onClick={() => handleNumber(".")}>.</Button>
        </div>

        {/* Acciones Finales Unificadas */}
        <div className="flex gap-2 mt-1 md:mt-2">
          <Button 
              variant="outline"
              className="h-14 md:h-18 w-14 md:w-18 flex flex-col items-center justify-center gap-1 border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive rounded-2xl shrink-0 transition-all active:scale-95"
              onClick={onClearCart}
              disabled={isProcessing}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[7px] md:text-[9px] font-black uppercase leading-tight">Vaciar<br/>Caja</span>
          </Button>
          
          <Button 
              className={cn(
                "flex-1 h-14 md:h-18 text-lg md:text-2xl font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-4",
                isProcessing ? "bg-slate-400" : "bg-primary hover:bg-primary/90"
              )}
              onClick={handleFinalizeNormal}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 md:w-8 md:h-8 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 md:w-8 md:h-8" />
              )}
              <span className="truncate">{isProcessing ? "PROCESANDO..." : "COBRAR VENTA"}</span>
          </Button>
        </div>
    </div>
  );
}
