
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { CalculatorComponent } from "@/components/pos/CalculatorComponent";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, Scan, RotateCcw, Search, Plus, PackageSearch, Check, ReceiptText } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, collection, serverTimestamp, increment, query } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// Función para emitir un "beep" de confirmación usando Web Audio API
const playSuccessSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Frecuencia de confirmación (La5)
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); // Volumen suave
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    // Silencioso si falla (por ejemplo, restricciones de auto-play)
  }
};

function ProductSearchBox({ 
  query, 
  setQuery, 
  results, 
  onAdd 
}: { 
  query: string; 
  setQuery: (q: string) => void; 
  results: any[]; 
  onAdd: (p: any) => void 
}) {
  return (
    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-10 h-12 bg-slate-50 border-none rounded-2xl focus-visible:ring-primary shadow-inner font-bold" 
            placeholder="Buscar por nombre..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
            {results.length > 0 ? (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onAdd(p);
                    setQuery("");
                  }}
                  className="w-full flex items-center justify-between p-3 bg-white hover:bg-primary/5 border border-slate-100 rounded-2xl transition-all group active:scale-[0.98]"
                >
                  <div className="text-left">
                    <p className="font-bold text-slate-700 text-sm group-hover:text-primary transition-colors">{p.name}</p>
                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">Stock: {p.stock} • {p.category || 'General'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-black text-sm">${Math.round(p.price).toLocaleString('es-CL')}</span>
                    <div className="bg-primary/10 p-2 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function POSPage() {
  const firestore = useFirestore();
  const [items, setItems] = useState<any[]>([]);
  const [manualProducts, setManualProducts] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const { toast } = useToast();

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);
  
  const { data: allProducts, isLoading: isLoadingInventory } = useCollection(productsQuery);

  const productMap = useMemo(() => {
    const map = new Map();
    if (allProducts) {
      allProducts.forEach(p => {
        const key = String(p.id).trim();
        map.set(key, p);
      });
    }
    return map;
  }, [allProducts]);

  const searchResults = useMemo(() => {
    if (!searchQuery || !allProducts) return [];
    const q = searchQuery.toLowerCase().trim();
    return allProducts
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [allProducts, searchQuery]);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0) +
           manualProducts.reduce((sum, item) => sum + item.amount, 0);
  }, [items, manualProducts]);

  const handleAddItem = (product: any) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1,
        category: product.category || "General"
      }];
    });
    
    // Feedback sonoro
    playSuccessSound();

    // Feedback visual de escaneo exitoso
    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 800);
  };

  const handleScan = (barcode: string) => {
    const cleanBarcode = String(barcode).trim();
    if (!cleanBarcode || isLoadingInventory) return;

    // LÓGICA DE LENTITUD Y DUPLICADOS:
    // Evita registrar el mismo producto más de una vez cada 3 segundos.
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === cleanBarcode && (now - lastScanRef.current.time < 3000)) {
      return;
    }

    lastScanRef.current = { code: cleanBarcode, time: now };
    
    const product = productMap.get(cleanBarcode);

    if (product) {
      handleAddItem(product);
    }
  };

  const handleFinalize = (manualFinalAmount?: number, paymentMethod: 'cash' | 'card' = 'card') => {
    let currentManualItems = [...manualProducts];
    let currentCartTotal = total;

    if (manualFinalAmount !== undefined) {
      const diff = Math.round(manualFinalAmount) - Math.round(currentCartTotal);
      if (diff !== 0) {
        currentManualItems.push({ description: "Ajuste Manual / Calculadora", amount: diff });
      }
    }

    if (items.length === 0 && currentManualItems.length === 0) return;
    
    setIsProcessing(true);
    const salesRef = collection(firestore, "sales");
    const saleId = crypto.randomUUID();
    
    const finalTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0) +
                       currentManualItems.reduce((sum, item) => sum + item.amount, 0);

    const saleData = {
      id: saleId,
      totalAmount: Math.round(finalTotal),
      saleDateTime: serverTimestamp(),
      paymentMethod,
      productSaleItemIds: items.map(i => i.id),
      manualSaleItemIds: currentManualItems.map((_, idx) => `manual-${idx}`),
      itemsSummary: [
        ...items.map(i => ({ 
          name: i.name, 
          quantity: i.quantity, 
          price: i.price, 
          id: i.id,
          type: 'product',
          category: i.category
        })),
        ...currentManualItems.map(m => ({
          name: m.description,
          quantity: 1,
          price: m.amount,
          id: 'manual',
          type: 'manual',
          category: 'Manual'
        }))
      ]
    };

    addDocumentNonBlocking(salesRef, saleData);

    items.forEach(item => {
      const itemRef = collection(doc(firestore, "sales", saleId), "productSaleItems");
      addDocumentNonBlocking(itemRef, {
        id: crypto.randomUUID(),
        saleId: saleId,
        productId: item.id,
        productName: item.name,
        unitPrice: Math.round(item.price),
        quantity: item.quantity,
        subtotal: Math.round(item.price * item.quantity),
        category: item.category
      });

      const productRef = doc(firestore, "products", item.id);
      updateDocumentNonBlocking(productRef, {
        stock: increment(-item.quantity)
      });
    });

    currentManualItems.forEach(mp => {
      const manualRef = collection(doc(firestore, "sales", saleId), "manualSaleItems");
      addDocumentNonBlocking(manualRef, {
        id: crypto.randomUUID(),
        saleId: saleId,
        description: mp.description,
        amount: Math.round(mp.amount)
      });
    });

    setItems([]);
    setManualProducts([]);
    setSearchQuery("");
    
    toast({ title: `Venta Finalizada (${paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'})` });
    
    setTimeout(() => {
      setIsProcessing(false);
    }, 500);
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

  const handleClearCart = () => {
    setItems([]);
    setManualProducts([]);
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-5 flex flex-col gap-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Scan className="w-4 h-4" /> Escáner
            </h3>
          </div>
          <div className="relative group overflow-hidden rounded-3xl">
            <ScannerComponent onScan={handleScan} />
            
            <div className={cn(
              "absolute inset-0 z-50 pointer-events-none transition-all duration-500 flex items-center justify-center bg-green-500/20 border-[8px] border-green-500 rounded-3xl",
              scanSuccess ? "opacity-100 scale-100" : "opacity-0 scale-110"
            )}>
              <div className="bg-green-50 text-white p-6 rounded-full shadow-2xl animate-in zoom-in-50 duration-300">
                <Check className="w-16 h-16 stroke-[4]" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <PackageSearch className="w-4 h-4" /> Buscar Producto
          </h3>
          <ProductSearchBox 
            query={searchQuery} 
            setQuery={setSearchQuery} 
            results={searchResults} 
            onAdd={handleAddItem} 
          />
        </section>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <Card className="flex-1 flex flex-col border-none shadow-2xl bg-white overflow-hidden rounded-3xl">
          <CardHeader className="bg-primary text-white py-4 relative z-10">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <ReceiptText className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
                <CardTitle className="text-xl md:text-2xl truncate">Terminal</CardTitle>
                {(items.length > 0 || manualProducts.length > 0) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearCart}
                    className="bg-white/10 hover:bg-white/20 text-white border-none rounded-full px-2 h-6 text-[8px] font-black uppercase tracking-widest shrink-0"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Vaciar
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs md:text-sm font-mono tracking-widest">
                  {currentTime || "--:--"}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 flex flex-col relative bg-slate-50">
            <ScrollArea className="flex-1 max-h-[300px] md:max-h-[350px]">
              <div className="divide-y divide-slate-100">
                {items.length === 0 && manualProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 md:py-20 px-6 text-center space-y-4 opacity-40">
                    <ShoppingCart className="w-10 h-10 md:w-12 md:h-12 text-slate-300" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Esperando productos...</p>
                  </div>
                )}
                
                {items.map((item) => (
                  <div key={item.id} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4 bg-white hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                      <p className="text-primary font-black text-lg mt-1 font-mono">${Math.round(item.price * item.quantity).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <div className="flex items-center bg-slate-100 rounded-full p-1 scale-90 sm:scale-100">
                        <Button variant="ghost" size="icon" className="rounded-full w-7 h-7 sm:w-8 sm:h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, -1)}>
                          <MinusCircle className="w-5 h-5" />
                        </Button>
                        <span className="font-black w-6 sm:w-8 text-center text-sm">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="rounded-full w-7 h-7 sm:w-8 sm:h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, 1)}>
                          <PlusCircle className="w-5 h-5" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {manualProducts.map((item, idx) => (
                  <div key={`manual-${idx}`} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4 bg-accent/5 border-l-4 border-accent animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="bg-accent/10 text-accent text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Manual</span>
                        <p className="font-bold text-sm text-slate-800 truncate">{item.description}</p>
                      </div>
                      <p className="text-accent font-black text-lg mt-1 font-mono">${Math.round(item.amount).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8" onClick={() => removeManual(idx)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator className="bg-slate-200" />

            <div className="p-4 md:p-6 bg-white">
               <CalculatorComponent 
                baseValue={Math.round(total)} 
                isProcessing={isProcessing}
                onFinalize={handleFinalize} 
                onClearCart={handleClearCart}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
