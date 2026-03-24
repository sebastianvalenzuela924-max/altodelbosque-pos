"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { CalculatorComponent } from "@/components/pos/CalculatorComponent";
import { QuickAddDialog } from "@/components/pos/QuickAddDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, CheckCircle2, Scan, Calculator } from "lucide-react";
import { db, finalizeSale, getProducts, Product, SaleItem, ManualProduct } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function POSPage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [manualProducts, setManualProducts] = useState<ManualProduct[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadInventory();
    // Set time on mount to avoid hydration mismatch
    setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    // Optional: Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  const loadInventory = async () => {
    const prods = await getProducts();
    setInventory(prods);
  };

  const handleScan = async (barcode: string) => {
    const existing = items.find(i => i.id === barcode);
    if (existing) {
      updateQuantity(barcode, 1);
      toast({ title: "Cantidad actualizada", description: `${existing.name} +1` });
      return;
    }

    const docRef = doc(db, 'productos', barcode);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const p = docSnap.data() as Product;
      setItems(prev => [...prev, { id: barcode, name: p.name, price: p.price, quantity: 1 }]);
      toast({ title: "Producto Agregado", description: p.name });
    } else {
      setQuickAddBarcode(barcode);
    }
  };

  const addManual = (amount: number) => {
    setManualProducts(prev => [...prev, { description: "Venta Manual", amount }]);
    toast({ title: "Monto Agregado", description: `$${amount.toFixed(2)}` });
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const removeManual = (index: number) => {
    setManualProducts(prev => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0) +
                manualProducts.reduce((sum, item) => sum + item.amount, 0);

  const handleFinalize = async () => {
    if (items.length === 0 && manualProducts.length === 0) return;
    setIsProcessing(true);

    try {
      await finalizeSale({
        total,
        items,
        manualProducts
      });
      setItems([]);
      setManualProducts([]);
      toast({ title: "Venta Finalizada", description: "El stock ha sido actualizado.", variant: "default" });
      loadInventory();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo procesar la venta.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
      {/* Left Column: Cart & Total */}
      <div className="lg:col-span-7 flex flex-col h-full gap-4">
        <Card className="flex-1 flex flex-col border-none shadow-2xl bg-white overflow-hidden rounded-3xl min-h-[600px]">
          <CardHeader className="bg-primary text-white py-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl flex items-center gap-3">
                <ShoppingCart className="w-8 h-8" />
                Caja Registradora
              </CardTitle>
              <div className="flex flex-col items-end">
                <span className="text-xs uppercase font-bold opacity-70">Sesión Activa</span>
                <span className="text-sm font-mono tracking-widest">
                  {currentTime || "--:--"}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 bg-slate-50">
            <ScrollArea className="h-[450px]">
              <div className="divide-y divide-slate-200">
                {items.length === 0 && manualProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                      <ShoppingCart className="w-12 h-12" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Carrito Vacío</h3>
                      <p className="text-slate-400 text-sm">Escanea un producto o usa la calculadora para empezar.</p>
                    </div>
                  </div>
                )}
                
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex items-center gap-4 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded uppercase">EAN</span>
                        <p className="font-bold text-lg text-slate-800 line-clamp-1">{item.name}</p>
                      </div>
                      <p className="text-xs text-slate-400 font-mono tracking-tighter">{item.id}</p>
                      <p className="text-primary font-black text-xl mt-1 font-mono">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="flex items-center bg-slate-100 rounded-full p-1 shadow-inner">
                        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, -1)}>
                          <MinusCircle className="w-5 h-5" />
                        </Button>
                        <span className="font-black w-8 text-center text-lg">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, 1)}>
                          <PlusCircle className="w-5 h-5" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {manualProducts.map((item, idx) => (
                  <div key={`manual-${idx}`} className="p-4 flex items-center gap-4 bg-accent/5 border-l-4 border-accent">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-accent/10 text-accent text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Manual</span>
                        <p className="font-bold text-lg text-slate-800">Ingreso Manual</p>
                      </div>
                      <p className="text-accent font-black text-xl mt-1 font-mono">${item.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full" onClick={() => removeManual(idx)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex flex-col gap-6 bg-white border-t p-8">
            <div className="w-full flex justify-between items-end">
              <div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-1">Subtotal {items.length + manualProducts.length} items</p>
                <p className="text-slate-800 font-medium">IVA Incluido (Exento)</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black uppercase text-primary tracking-widest">Total General</p>
                <p className="text-6xl font-black text-primary font-mono tracking-tighter leading-none">${total.toFixed(2)}</p>
              </div>
            </div>
            
            <Button 
              className={cn(
                "w-full h-24 text-2xl font-black rounded-3xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4",
                isProcessing ? "bg-slate-400 cursor-not-allowed" : "bg-primary hover:bg-primary/90 shadow-primary/20"
              )}
              onClick={handleFinalize}
              disabled={(items.length === 0 && manualProducts.length === 0) || isProcessing}
            >
              <CheckCircle2 className="w-10 h-10" />
              {isProcessing ? "PROCESANDO..." : "FINALIZAR COBRO"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Right Column: Scanner & Tools */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <Scan className="w-4 h-4" /> Escáner de Barras
          </h3>
          <ScannerComponent onScan={handleScan} />
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <Calculator className="w-4 h-4" /> Calculadora POS
          </h3>
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50">
            <CalculatorComponent onAddManual={addManual} />
          </div>
        </section>
      </div>

      {quickAddBarcode && (
        <QuickAddDialog 
          barcode={quickAddBarcode} 
          open={!!quickAddBarcode} 
          onClose={() => setQuickAddBarcode(null)}
          onAdded={(p) => {
            setItems(prev => [...prev, { id: p.id, name: p.name, price: p.price, quantity: 1 }]);
            loadInventory();
            toast({ title: "Registrado y Agregado", description: p.name });
          }}
        />
      )}
    </div>
  );
}
