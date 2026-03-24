"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, Divide, CheckCircle2, Trash2, RotateCcw, Calculator, Banknote, Delete, ShoppingCart } from "lucide-react";
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
  
  // Estados para el cálculo de vuelto
  const [isCashMode, setIsCashMode] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  // Sincronizar con el valor base de la caja (total del carrito)
  useEffect(() => {
    if (isReset && !isCashMode) {
      setDisplay(Math.round(baseValue).toString());
    }
  }, [baseValue, isReset, isCashMode]);

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
    // Si ya hay una ecuación, la calculamos primero para seguir sumando
    if (equation && !isReset) {
      const result = calculateResult();
      setEquation(result + " " + op + " ");
    } else {
      setEquation(display + " " + op + " ");
    }
    setDisplay("0");
    setIsReset(true);
  };

  const calculateResult = () => {
    if (!equation) return parseInt(display || "0");
    try {
      const fullEq = equation + (isReset ? "0" : display);
      // eslint-disable-next-line no-eval
      const result = eval(fullEq.replace('×', '*').replace('÷', '/'));
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
    setIsReset(false);
  };

  const clear = () => {
    if (isCashMode) {
      setCashReceived("");
      return;
    }
    setDisplay(Math.round(baseValue).toString());
    setEquation("");
    setIsReset(true);
  };

  const forceZero = () => {
    setDisplay("0");
    setEquation("");
    setIsReset(false);
    setIsCashMode(false);
    setCashReceived("");
  };

  const handleFinalizeNormal = () => {
    const amount = calculateResult();
    if (!isNaN(amount)) {
      setIsReset(true);
      setEquation("");
      setDisplay("0"); 
      setIsCashMode(false);
      setCashReceived("");
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
  
  // Determinar si lo que se muestra es puramente el monto de la caja
  const isOnlyBaseValue = isReset && !equation && parseInt(display) === Math.round(baseValue) && baseValue > 0;

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        {/* Pantalla de la Calculadora */}
        <div className={cn(
          "rounded-xl p-4 shadow-inner border text-right transition-all duration-300 min-h-[100px] flex flex-col justify-end",
          isCashMode ? "bg-green-50 border-green-200" : isOnlyBaseValue ? "bg-primary/5 border-primary/20" : "bg-white"
        )}>
          {!isCashMode ? (
            <>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1">
                  {isOnlyBaseValue && (
                    <span className="text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                      Monto de Caja
                    </span>
                  )}
                  {equation && (
                    <span className="text-[9px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Operación
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase font-black tracking-widest">
                  {equation || "Calculadora"}
                </div>
              </div>
              <div className={cn(
                "text-3xl font-black font-mono truncate transition-colors",
                isOnlyBaseValue ? "text-primary" : "text-slate-700"
              )}>
                ${parseInt(display || "0").toLocaleString('es-CL')}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between items-center border-b border-green-100 pb-1">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Total:</span>
                <span className="text-lg font-black font-mono text-slate-700">${totalToPay.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Recibido:</span>
                <span className="text-2xl font-black font-mono text-primary">${receivedAmount.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-green-200">
                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Vuelto:</span>
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

        {/* Botones de Control Rápido */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl border-primary/30" onClick={clear}>
            <RotateCcw className="w-3 h-3 mr-2 text-primary" />
            {isCashMode ? "Limpiar Pago" : "Monto caja"}
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl border-destructive/30" onClick={forceZero}>
            <Trash2 className="w-3 h-3 mr-2 text-destructive" />
            Todo a Cero
          </Button>
        </div>

        {/* Teclado Numérico */}
        <div className="grid grid-cols-4 gap-2">
          <Button variant="secondary" className="h-12 text-lg font-bold rounded-xl" onClick={clear}>
            {isCashMode ? <Delete className="w-5 h-5"/> : "CE"}
          </Button>
          <Button variant="outline" disabled={isCashMode} className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("÷")}><Divide className="w-5 h-5"/></Button>
          <Button variant="outline" disabled={isCashMode} className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("×")}><X className="w-5 h-5"/></Button>
          <Button variant="outline" disabled={isCashMode} className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("-")}><Minus className="w-5 h-5"/></Button>

          {[7, 8, 9].map((n) => (
            <Button key={n} variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" disabled={isCashMode} className="h-12 text-lg font-bold rounded-xl" onClick={() => handleOperator("+")}><Plus className="w-5 h-5"/></Button>

          {[4, 5, 6].map((n) => (
            <Button key={n} variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button 
            variant="primary" 
            disabled={isCashMode}
            className="h-12 text-lg font-bold row-span-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-800" 
            onClick={handleCalculate}
          >
            =
          </Button>

          {[1, 2, 3].map((n) => (
            <Button key={n} variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          
          <Button variant="secondary" className="h-12 text-xl font-bold col-span-2 rounded-xl" onClick={() => handleNumber("0")}>0</Button>
          <Button variant="secondary" className="h-12 text-xl font-bold rounded-xl" onClick={() => handleNumber(".")}>.</Button>
          
          <Button 
            className={cn(
              "h-12 rounded-xl font-black text-[10px] uppercase tracking-tighter flex flex-col items-center justify-center leading-none",
              isCashMode ? "bg-green-600 text-white hover:bg-green-700" : "bg-white border-2 border-green-600 text-green-600 hover:bg-green-50"
            )}
            onClick={toggleCashMode}
          >
            <Banknote className="w-4 h-4 mb-0.5" />
            {isCashMode ? "CALCULAR" : "EFECTIVO"}
          </Button>
        </div>

        {/* Botones de Finalización */}
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
