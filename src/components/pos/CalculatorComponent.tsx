"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, Divide, CheckCircle2, Trash2, Hash, Loader2, RotateCcw, Calculator } from "lucide-react";
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

  // Sincronizar con el valor base de la caja (total del carrito)
  useEffect(() => {
    if (isReset) {
      setDisplay(Math.round(baseValue).toString());
    }
  }, [baseValue, isReset]);

  const handleNumber = (n: string) => {
    if (isReset) {
      setDisplay(n);
      setIsReset(false);
    } else {
      setDisplay(display === "0" ? n : display + n);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + " " + op + " ");
    setDisplay("0");
    setIsReset(false);
  };

  const calculateResult = () => {
    if (!equation) return parseInt(display || "0");
    try {
      const fullEq = equation + display;
      // eslint-disable-next-line no-eval
      const result = eval(fullEq.replace('×', '*').replace('÷', '/'));
      return Math.round(result);
    } catch (e) {
      return parseInt(display || "0");
    }
  };

  const handleCalculate = () => {
    const result = calculateResult();
    setDisplay(result.toString());
    setEquation("");
    setIsReset(false);
  };

  const clear = () => {
    setDisplay(Math.round(baseValue).toString());
    setEquation("");
    setIsReset(true);
  };

  const forceZero = () => {
    setDisplay("0");
    setEquation("");
    setIsReset(false);
  };

  const handleFinalizeNormal = () => {
    const amount = calculateResult();
    if (!isNaN(amount)) {
      setIsReset(true);
      setEquation("");
      setDisplay(amount.toString());
      onFinalize(amount);
    }
  };

  const handleFinalizeKeepAmount = () => {
    const amount = calculateResult();
    if (!isNaN(amount)) {
      setIsReset(false);
      setEquation("");
      setDisplay(amount.toString());
      onFinalize(amount);
    }
  };

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-inner border text-right">
          <div className="text-[10px] text-muted-foreground h-4 uppercase font-black tracking-widest">{equation || "Calculadora de Cobro"}</div>
          <div className="text-3xl font-black font-mono text-primary truncate mt-1">
            ${parseInt(display || "0").toLocaleString('es-CL')}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl" onClick={clear}>
            <Hash className="w-3 h-3 mr-2 text-primary" />
            Base Caja
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl" onClick={forceZero}>
            <Trash2 className="w-3 h-3 mr-2 text-destructive" />
            Empezar 0
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="secondary" className="h-12 text-lg font-bold rounded-xl" onClick={() => setDisplay("0")}>CE</Button>
          <Button variant="outline" className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("÷")}><Divide className="w-5 h-5"/></Button>
          <Button variant="outline" className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("×")}><X className="w-5 h-5"/></Button>
          <Button variant="outline" className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("-")}><Minus className="w-5 h-5"/></Button>

          {[7, 8, 9].map((n) => (
            <Button key={n} variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("+")}><Plus className="w-5 h-5"/></Button>

          {[4, 5, 6].map((n) => (
            <Button key={n} variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="primary" className="h-12 text-lg font-bold row-span-2 bg-accent hover:bg-accent/90 rounded-xl text-white" onClick={handleCalculate}>=</Button>

          {[1, 2, 3].map((n) => (
            <Button key={n} variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          
          <Button variant="secondary" className="h-12 text-xl font-bold col-span-2 rounded-xl" onClick={() => handleNumber("0")}>0</Button>
          <Button variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(".")}>.</Button>
        </div>

        <div className="space-y-2 mt-4">
          <Button 
            className={cn(
              "w-full h-16 text-xl font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3",
              isProcessing ? "bg-slate-400" : "bg-primary hover:bg-primary/90"
            )}
            onClick={handleFinalizeNormal}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
            {isProcessing ? "PROCESANDO..." : "COBRAR"}
          </Button>

          <Button 
            variant="outline"
            className={cn(
              "w-full h-14 text-xs font-black rounded-2xl border-2 border-primary text-primary hover:bg-primary/5 transition-all active:scale-95 flex items-center justify-center gap-2",
              isProcessing && "opacity-50"
            )}
            onClick={handleFinalizeKeepAmount}
            disabled={isProcessing}
          >
            <Calculator className="w-4 h-4" />
            COBRAR SIN BORRAR MONTO
          </Button>

          <Button 
            variant="ghost"
            className="w-full h-12 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl text-destructive hover:bg-destructive/10"
            onClick={onClearCart}
            disabled={isProcessing}
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            Vaciar Caja Completa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
