
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, X, Divide, CheckCircle2, RotateCcw, Banknote, Loader2, Equal, PackageMinus, PackagePlus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorComponentProps {
  baseValue: number;
  isProcessing?: boolean;
  hasLastOperation?: boolean;
  onFinalize: (amount: number, method: 'cash' | 'card' | 'deduction') => void;
  onStockEntry: () => void;
  onClearCart: () => void;
  onUndo: () => void;
}

/**
 * Calculadora Reactiva para POS AltodelBosque.
 * El primer valor es SIEMPRE el total de la caja (baseValue) y es dinámico.
 */
export function CalculatorComponent({ 
  baseValue, 
  isProcessing = false,
  hasLastOperation = true, // Siempre activo como solicitado
  onFinalize,
  onStockEntry,
  onClearCart,
  onUndo
}: CalculatorComponentProps) {
  const [manualOps, setManualOps] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [isCashMode, setIsCashMode] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  const evaluateTotal = (base: number, ops: string, input: string): number => {
    try {
      let expression = `${base} ${ops} ${input}`.trim();
      if (expression.match(/[+\-×÷]\s*$/)) expression = expression.replace(/[+\-×÷]\s*$/, "").trim();
      if (!expression) return base;
      const evalString = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
      const result = eval(evalString);
      return Math.round(result || 0);
    } catch (e) { return base; }
  };

  const currentTotal = useMemo(() => evaluateTotal(baseValue, manualOps, currentInput), [baseValue, manualOps, currentInput]);

  useEffect(() => {
    if (baseValue === 0) {
      setManualOps("");
      setCurrentInput("");
      setCashReceived("");
    }
  }, [baseValue]);

  const handleNumber = (n: string) => {
    if (isCashMode) setCashReceived(prev => (prev === "0" ? n : prev + n));
    else setCurrentInput(prev => (prev === "0" ? n : prev + n));
  };

  const handleOperator = (op: string) => {
    if (isCashMode) return;
    if (currentInput) {
      setManualOps(prev => `${prev} ${currentInput} ${op} `);
      setCurrentInput("");
    } else {
      setManualOps(prev => {
        const trimmed = prev.trim();
        if (trimmed.match(/[+\-×÷]$/)) return trimmed.replace(/[+\-×÷]$/, op) + " ";
        return `${prev} ${op} `;
      });
    }
  };

  const handleEqual = () => {
    if (isCashMode) return;
    if (currentInput) {
      setManualOps(prev => `${prev} ${currentInput}`);
      setCurrentInput("");
    }
  };

  const clear = () => {
    if (isCashMode) setCashReceived("");
    else { setManualOps(""); setCurrentInput(""); }
  };

  const toggleCashMode = () => { setIsCashMode(!isCashMode); setCashReceived(""); };

  const handleFinalizeInternal = () => {
    onFinalize(currentTotal, isCashMode ? 'cash' : 'card');
    setManualOps(""); setCurrentInput(""); setCashReceived(""); setIsCashMode(false);
  };

  const handleDeductInternal = () => {
    onFinalize(currentTotal, 'deduction');
    setManualOps(""); setCurrentInput(""); setCashReceived(""); setIsCashMode(false);
  };

  const receivedAmount = parseInt(cashReceived || "0");
  const changeAmount = receivedAmount > 0 ? receivedAmount - currentTotal : 0;

  return (
    <div className="space-y-3">
      <div className={cn(
        "rounded-3xl p-4 shadow-inner border text-right transition-all duration-300 min-h-[110px] md:min-h-[130px] flex flex-col justify-center",
        isCashMode ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
      )}>
        {!isCashMode ? (
          <>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ecuación Terminal</span>
              <span className="text-[9px] font-mono text-primary font-black uppercase">Caja Dinámica</span>
            </div>
            <div className="text-xs font-mono text-slate-400 mb-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <span className="text-primary font-black">{baseValue}</span>
              <span className="text-slate-500"> {manualOps} {currentInput}</span>
            </div>
            <div className="text-4xl md:text-6xl font-black font-mono tracking-tighter text-slate-800">${currentTotal.toLocaleString('es-CL')}</div>
          </>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center pb-1 border-b border-green-100">
              <span className="text-[10px] font-black uppercase text-green-600">Total Venta:</span>
              <span className="text-lg font-black font-mono text-slate-600">${currentTotal.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[10px] font-black uppercase text-green-600">Recibido:</span>
              <span className="text-2xl font-black font-mono text-primary">${receivedAmount.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t-2 border-green-200">
              <span className="text-[10px] font-black uppercase text-green-600">Vuelto:</span>
              <span className={cn("text-3xl font-black font-mono", changeAmount < 0 ? "text-destructive" : "text-green-600")}>${Math.max(0, changeAmount).toLocaleString('es-CL')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button variant="outline" className="h-12 md:h-14 rounded-2xl font-bold bg-slate-100 text-slate-500" onClick={clear}>CE</Button>
        <Button variant="outline" className="h-12 md:h-14 rounded-2xl font-bold" onClick={() => handleOperator("÷")} disabled={isCashMode}><Divide className="w-5 h-5"/></Button>
        <Button variant="outline" className="h-12 md:h-14 rounded-2xl font-bold" onClick={() => handleOperator("×")} disabled={isCashMode}><X className="w-5 h-5"/></Button>
        <Button variant="outline" className="h-12 md:h-14 rounded-2xl font-bold" onClick={() => handleOperator("-")} disabled={isCashMode}><Minus className="w-5 h-5"/></Button>
        {[7, 8, 9].map((n) => (<Button key={n} variant="secondary" className="h-12 md:h-14 text-2xl font-black rounded-2xl bg-white shadow-sm border" onClick={() => handleNumber(n.toString())}>{n}</Button>))}
        <Button variant="outline" className="h-12 md:h-14 rounded-2xl font-bold" onClick={() => handleOperator("+")} disabled={isCashMode}><Plus className="w-5 h-5"/></Button>
        {[4, 5, 6].map((n) => (<Button key={n} variant="secondary" className="h-12 md:h-14 text-2xl font-black rounded-2xl bg-white shadow-sm border" onClick={() => handleNumber(n.toString())}>{n}</Button>))}
        <Button variant="outline" className="h-12 md:h-14 rounded-2xl font-bold" onClick={handleEqual} disabled={isCashMode}><Equal className="w-5 h-5"/></Button>
        {[1, 2, 3].map((n) => (<Button key={n} variant="secondary" className="h-12 md:h-14 text-2xl font-black rounded-2xl bg-white shadow-sm border" onClick={() => handleNumber(n.toString())}>{n}</Button>))}
        <Button className={cn("h-12 md:h-14 rounded-2xl font-black text-[10px] uppercase flex flex-col items-center justify-center border-2 transition-all", isCashMode ? "bg-green-600 text-white border-green-700" : "bg-white border-green-600 text-green-600 hover:bg-green-50")} onClick={toggleCashMode}><Banknote className="w-5 h-5 mb-0.5" />{isCashMode ? "Pagar" : "Efectivo"}</Button>
        <Button variant="secondary" className="h-12 md:h-14 text-2xl font-black col-span-2 rounded-2xl bg-white shadow-sm border" onClick={() => handleNumber("0")}>0</Button>
        <Button variant="secondary" className="h-12 md:h-14 text-2xl font-black rounded-2xl bg-white shadow-sm border" onClick={() => handleNumber(".")}>.</Button>
        <Button variant="ghost" className="h-12 md:h-14 rounded-2xl opacity-0 cursor-default" disabled>.</Button>
      </div>

      <div className="pt-2">
        <Button className={cn("w-full h-16 md:h-20 text-xl md:text-3xl font-black rounded-3xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4", isProcessing ? "bg-slate-400" : "bg-primary hover:bg-primary/90")} onClick={handleFinalizeInternal} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin" /> : <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />}<span>{isProcessing ? "PROCESANDO..." : "COBRAR VENTA"}</span></Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-14 flex flex-col items-center justify-center gap-1 border-destructive/20 text-destructive hover:bg-destructive/5 rounded-2xl transition-all" onClick={onClearCart} disabled={isProcessing}><RotateCcw className="w-4 h-4" /><span className="text-[8px] font-black uppercase">Vaciar</span></Button>
        <Button variant="outline" className="h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 shadow-sm" onClick={onUndo} disabled={isProcessing}><Undo2 className="w-4 h-4" /><span className="text-[8px] font-black uppercase">Volver atrás</span></Button>
        <Button variant="outline" className="h-14 flex flex-col items-center justify-center gap-1 border-amber-200 text-amber-600 hover:bg-amber-50 rounded-2xl transition-all" onClick={handleDeductInternal} disabled={isProcessing}><PackageMinus className="w-4 h-4" /><span className="text-[8px] font-black uppercase">Descontar</span></Button>
        <Button variant="outline" className="h-14 flex flex-col items-center justify-center gap-1 border-accent/20 text-accent hover:bg-accent/5 rounded-2xl transition-all" onClick={onStockEntry} disabled={isProcessing}><PackagePlus className="w-4 h-4" /><span className="text-[8px] font-black uppercase">Ingreso</span></Button>
      </div>
    </div>
  );
}
