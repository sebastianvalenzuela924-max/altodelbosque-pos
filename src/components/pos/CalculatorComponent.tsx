
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, X, Divide, CheckCircle2, RotateCcw, Banknote, Loader2, Equal, PackageMinus, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorComponentProps {
  baseValue: number;
  isProcessing?: boolean;
  onFinalize: (amount: number, method: 'cash' | 'card' | 'deduction') => void;
  onStockEntry: () => void;
  onClearCart: () => void;
}

/**
 * Calculadora Reactiva para POS AltodelBosque.
 * El primer valor es SIEMPRE el total de la caja (baseValue) y es dinámico.
 * Muestra la ecuación completa: [Caja] + [Manual 1] - [Manual 2] ...
 */
export function CalculatorComponent({ 
  baseValue, 
  isProcessing = false,
  onFinalize,
  onStockEntry,
  onClearCart
}: CalculatorComponentProps) {
  // Estado para la cadena de operaciones manuales (ej: "+ 500 - 200")
  const [manualOps, setManualOps] = useState("");
  // Estado para el número que se está escribiendo actualmente
  const [currentInput, setCurrentInput] = useState("");
  // Modo Efectivo / Vuelto
  const [isCashMode, setIsCashMode] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  // Función para evaluar la ecuación de forma segura
  const evaluateTotal = (base: number, ops: string, input: string): number => {
    try {
      // Limpiar la cadena para eval
      let expression = `${base} ${ops} ${input}`.trim();
      
      // Si termina en un operador, lo ignoramos para el cálculo del total visual
      if (expression.match(/[+\-×÷]\s*$/)) {
        expression = expression.replace(/[+\-×÷]\s*$/, "").trim();
      }

      if (!expression) return base;

      const evalString = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\s+/g, ''); // Quitar espacios para seguridad

      // eslint-disable-next-line no-eval
      const result = eval(evalString);
      return Math.round(result || 0);
    } catch (e) {
      return base;
    }
  };

  // Total final calculado en tiempo real (Base Dinámica + Operaciones)
  const currentTotal = useMemo(() => {
    return evaluateTotal(baseValue, manualOps, currentInput);
  }, [baseValue, manualOps, currentInput]);

  // Sincronización: Si se vacía la caja, reseteamos la calculadora
  useEffect(() => {
    if (baseValue === 0) {
      setManualOps("");
      setCurrentInput("");
      setCashReceived("");
    }
  }, [baseValue]);

  const handleNumber = (n: string) => {
    if (isCashMode) {
      setCashReceived(prev => (prev === "0" ? n : prev + n));
      return;
    }
    setCurrentInput(prev => (prev === "0" ? n : prev + n));
  };

  const handleOperator = (op: string) => {
    if (isCashMode) return;
    
    // Si hay un input actual, lo pasamos a la cadena de operaciones
    if (currentInput) {
      setManualOps(prev => `${prev} ${currentInput} ${op} `);
      setCurrentInput("");
    } else {
      // Si no hay input, simplemente cambiamos o añadimos el operador al final
      setManualOps(prev => {
        const trimmed = prev.trim();
        if (trimmed.match(/[+\-×÷]$/)) {
          return trimmed.replace(/[+\-×÷]$/, op) + " ";
        }
        return `${prev} ${op} `;
      });
    }
  };

  const handleEqual = () => {
    if (isCashMode) return;
    // El total ya se calcula dinámicamente en currentTotal,
    // pero al presionar "=" podemos consolidar la operación visualmente
    if (currentInput) {
      setManualOps(prev => `${prev} ${currentInput}`);
      setCurrentInput("");
    }
  };

  const clear = () => {
    if (isCashMode) {
      setCashReceived("");
      return;
    }
    setManualOps("");
    setCurrentInput("");
  };

  const toggleCashMode = () => {
    setIsCashMode(!isCashMode);
    setCashReceived("");
  };

  const handleFinalizeInternal = () => {
    onFinalize(currentTotal, isCashMode ? 'cash' : 'card');
    // Limpieza tras cobrar
    setManualOps("");
    setCurrentInput("");
    setCashReceived("");
    setIsCashMode(false);
  };

  const handleDeductInternal = () => {
    onFinalize(currentTotal, 'deduction');
    setManualOps("");
    setCurrentInput("");
    setCashReceived("");
    setIsCashMode(false);
  };

  const receivedAmount = parseInt(cashReceived || "0");
  const changeAmount = receivedAmount > 0 ? receivedAmount - currentTotal : 0;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Pantalla Unificada del Total */}
      <div className={cn(
        "rounded-2xl p-3 md:p-4 shadow-inner border text-right transition-all duration-300 min-h-[100px] md:min-h-[120px] flex flex-col justify-center",
        isCashMode ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
      )}>
        {!isCashMode ? (
          <>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Ecuación Terminal
              </span>
              <span className="text-[8px] md:text-[9px] font-mono text-primary font-black uppercase tracking-tighter">
                Caja Dinámica
              </span>
            </div>
            
            {/* Ecuación Completa */}
            <div className="text-[10px] md:text-xs font-mono text-slate-400 mb-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <span className="text-primary font-black">{baseValue}</span>
              <span className="text-slate-500"> {manualOps} {currentInput}</span>
            </div>

            <div className="text-3xl md:text-5xl font-black font-mono tracking-tighter text-slate-800">
              ${currentTotal.toLocaleString('es-CL')}
            </div>
          </>
        ) : (
          <div className="space-y-0.5 md:space-y-1">
            <div className="flex justify-between items-center pb-1 border-b border-green-100">
              <span className="text-[9px] md:text-[10px] font-black uppercase text-green-600">Total Venta:</span>
              <span className="text-base md:text-lg font-black font-mono text-slate-600">${currentTotal.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-[9px] md:text-[10px] font-black uppercase text-green-600">Recibido:</span>
              <span className="text-xl md:text-2xl font-black font-mono text-primary">${receivedAmount.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t-2 border-green-200">
              <span className="text-[9px] md:text-[10px] font-black uppercase text-green-600">Vuelto:</span>
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
        <Button variant="outline" className="h-11 md:h-14 rounded-xl font-bold bg-slate-100" onClick={handleEqual} disabled={isCashMode}><Equal className="w-4 h-4 md:w-5 md:h-5"/></Button>

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

      {/* Acciones Finales */}
      <div className="flex gap-1.5 md:gap-2 mt-1 md:mt-2">
        <Button 
            variant="outline"
            className="h-14 md:h-18 w-12 md:w-18 flex flex-col items-center justify-center gap-1 border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive rounded-2xl shrink-0 transition-all active:scale-95"
            onClick={onClearCart}
            disabled={isProcessing}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[7px] md:text-[9px] font-black uppercase leading-tight">Vaciar<br/>Caja</span>
        </Button>

        <Button 
            variant="outline"
            className="h-14 md:h-18 w-12 md:w-18 flex flex-col items-center justify-center gap-1 border-amber-200 text-amber-600 hover:bg-amber-50 rounded-2xl shrink-0 transition-all active:scale-95"
            onClick={handleDeductInternal}
            disabled={isProcessing}
        >
          <PackageMinus className="w-4 h-4" />
          <span className="text-[7px] md:text-[9px] font-black uppercase leading-tight text-center">Descontar<br/>Stock</span>
        </Button>

        <Button 
            variant="outline"
            className="h-14 md:h-18 w-12 md:w-18 flex flex-col items-center justify-center gap-1 border-accent/20 text-accent hover:bg-accent/5 rounded-2xl shrink-0 transition-all active:scale-95"
            onClick={onStockEntry}
            disabled={isProcessing}
        >
          <PackagePlus className="w-4 h-4" />
          <span className="text-[7px] md:text-[9px] font-black uppercase leading-tight text-center">Ingreso<br/>Stock</span>
        </Button>
        
        <Button 
            className={cn(
              "flex-1 h-14 md:h-18 text-base md:text-2xl font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-4",
              isProcessing ? "bg-slate-400" : "bg-primary hover:bg-primary/90"
            )}
            onClick={handleFinalizeInternal}
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
