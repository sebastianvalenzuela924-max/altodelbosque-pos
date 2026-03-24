"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Plus, Minus, X, Divide, CornerDownLeft, Trash2, Hash } from "lucide-react";

export function CalculatorComponent({ baseValue, onResult }: { baseValue: number, onResult: (amount: number) => void }) {
  const [display, setDisplay] = useState(Math.round(baseValue).toString());
  const [equation, setEquation] = useState("");
  const [isReset, setIsReset] = useState(true);

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

  const handleCalculate = () => {
    try {
      const fullEq = equation + display;
      const result = eval(fullEq.replace('×', '*').replace('÷', '/'));
      setDisplay(Math.round(result).toString());
      setEquation("");
      setIsReset(false);
    } catch (e) {
      setDisplay("0");
    }
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

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-3">
        <div className="bg-white rounded-xl p-4 shadow-inner border text-right">
          <div className="text-[10px] text-muted-foreground h-4 uppercase font-black tracking-widest">{equation || "Calculando"}</div>
          <div className="text-3xl font-black font-mono text-primary truncate mt-1">
            ${parseInt(display).toLocaleString('es-CL')}
          </div>
        </div>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest" onClick={clear}>
            <Hash className="w-3 h-3 mr-2 text-primary" />
            Base Caja
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest" onClick={forceZero}>
            <Trash2 className="w-3 h-3 mr-2 text-destructive" />
            Empezar 0
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="secondary" className="h-14 text-lg font-bold" onClick={() => setDisplay("0")}>CE</Button>
          <Button variant="outline" className="h-14 text-lg font-bold" onClick={() => handleOperator("÷")}><Divide className="w-5 h-5"/></Button>
          <Button variant="outline" className="h-14 text-lg font-bold" onClick={() => handleOperator("×")}><X className="w-5 h-5"/></Button>
          <Button variant="outline" className="h-14 text-lg font-bold" onClick={() => handleOperator("-")}><Minus className="w-5 h-5"/></Button>

          {[7, 8, 9].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-xl font-bold" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="outline" className="h-14 text-lg font-bold" onClick={() => handleOperator("+")}><Plus className="w-5 h-5"/></Button>

          {[4, 5, 6].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-xl font-bold" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          <Button variant="primary" className="h-14 text-lg font-bold row-span-2 bg-accent hover:bg-accent/90" onClick={handleCalculate}>=</Button>

          {[1, 2, 3].map((n) => (
            <Button key={n} variant="secondary" className="h-14 text-xl font-bold" onClick={() => handleNumber(n.toString())}>{n}</Button>
          ))}
          
          <Button variant="secondary" className="h-14 text-xl font-bold col-span-2" onClick={() => handleNumber("0")}>0</Button>
          <Button variant="secondary" className="h-14 text-xl font-bold" onClick={() => handleNumber(".")}>.</Button>
        </div>

        <Button 
          className="w-full h-16 text-lg font-bold bg-primary hover:bg-primary/90 rounded-2xl shadow-lg mt-2"
          onClick={() => {
            const amount = parseInt(display);
            if (!isNaN(amount)) {
              onResult(amount);
              clear();
            }
          }}
        >
          <CornerDownLeft className="mr-2 w-6 h-6" />
          Ajustar Caja
        </Button>
      </CardContent>
    </Card>
  );
}
