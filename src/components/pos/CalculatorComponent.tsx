"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Plus, Minus, X, Divide, ChevronRight, CornerDownLeft } from "lucide-react";

export function CalculatorComponent({ onAddManual }: { onAddManual: (amount: number) => void }) {
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");

  const handleNumber = (n: string) => {
    setDisplay(display === "0" ? n : display + n);
  };

  const handleOperator = (op: string) => {
    setEquation(display + " " + op + " ");
    setDisplay("0");
  };

  const handleCalculate = () => {
    try {
      const fullEq = equation + display;
      const result = eval(fullEq.replace('×', '*').replace('÷', '/'));
      setDisplay(result.toString());
      setEquation("");
    } catch (e) {
      setDisplay("Error");
    }
  };

  const clear = () => {
    setDisplay("0");
    setEquation("");
  };

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-3">
        <div className="bg-white rounded-xl p-4 shadow-inner border text-right">
          <div className="text-xs text-muted-foreground h-4">{equation}</div>
          <div className="text-3xl font-bold font-mono text-primary truncate">{display}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="h-14 text-lg font-bold" onClick={clear}>C</Button>
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
          className="w-full h-16 text-lg font-bold bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
          onClick={() => {
            const amount = parseFloat(display);
            if (!isNaN(amount) && amount > 0) {
              onAddManual(amount);
              clear();
            }
          }}
        >
          <CornerDownLeft className="mr-2 w-6 h-6" />
          Agregar al Total
        </Button>
      </CardContent>
    </Card>
  );
}
