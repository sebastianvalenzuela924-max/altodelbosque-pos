
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { CalculatorComponent } from "@/components/pos/CalculatorComponent";
import { QuickAddDialog } from "@/components/pos/QuickAddDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, CheckCircle2, Scan, Calculator, Loader2, Clock, RotateCcw, Search, Plus, PackageSearch, Check } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, collection, serverTimestamp, increment, query } from "firebase/firestore";
import { cn } from "@/lib/utils";

// Componente de búsqueda extraído para evitar pérdida de foco al re-renderizar
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
            placeholder="Ej: Bebida, Pan, Helado..." 
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
                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">Stock: {p.stock} • {p.category || 'Sin categoría'}</p>
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
        
        {!query && (
          <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest px-4">
            Busca productos registrados para añadir rápido
          </p>
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
  const [isScanLocked, setIsScanLocked] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
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
    
    toast({ 
      title: "Añadido", 
      description: `${product.name} - $${Math.round(product.price).toLocaleString('es-CL')}` 
    });
  };

  const handleScan = (barcode: string) => {
    const cleanBarcode = String(barcode).trim();
    if (!cleanBarcode || isLoadingInventory || isScanLocked) return;

    const now = Date.now();
    
    if (lastScanRef.current && lastScanRef.current.code === cleanBarcode && (now - lastScanRef.current.time < 2000)) {
      return;
    }

    lastScanRef.current = { code: cleanBarcode, time: now };
    setIsScanLocked(true);
    
    const product = productMap.get(cleanBarcode);

    if (product) {
      handleAddItem(product);
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 800);
    } else {
      setPendingBarcode(cleanBarcode);
      toast({ 
        variant: "destructive",
        title: "Nuevo Código", 
        description: `El código ${cleanBarcode} no está en inventario.`
      });
    }

    setTimeout(() => {
      setIsScanLocked(false);
    }, 1500);
  };

  const handleFinalize = (manualFinalAmount?: number) => {
    let currentManualItems = [...manualProducts];
    let currentCartTotal = total;

    if (manualFinalAmount !== undefined) {
      const diff = Math.round(manualFinalAmount) - Math.round(currentCartTotal);
      if (diff !== 0) {
        currentManualItems.push({ description: "Ajuste Manual", amount: diff });
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

    // Limpiar estados de la caja
    setItems([]);
    setManualProducts([]);
    setSearchQuery("");
    
    toast({ title: "Venta Finalizada", description: "Venta guardada correctamente." });
    
    // Pequeño delay para asegurar que el feedback visual sea claro
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
    toast({ title: "Caja Vaciada", description: "Se han eliminado todos los items." });
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-7 flex flex-col h-full gap-6">
        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <PackageSearch className="w-4 h-4" /> Búsqueda Rápida de Inventario
          </h3>
          <ProductSearchBox 
            query={searchQuery} 
            setQuery={setSearchQuery} 
            results={searchResults} 
            onAdd={handleAddItem} 
          />
        </section>

        <Card className="flex-1 flex flex-col border-none shadow-2xl bg-white overflow-hidden rounded-3xl min-h-[600px]">
          <CardHeader className="bg-primary text-white py-4 md:py-6 relative z-10">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <ShoppingCart className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
                <CardTitle className="text-xl md:text-2xl truncate">Caja</CardTitle>
                {(items.length > 0 || manualProducts.length > 0) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearCart}
                    className="bg-white/10 hover:bg-white/20 text-white border-none rounded-full px-3 h-7 text-[9px] font-black uppercase tracking-widest shrink-0"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Vaciar
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[9px] md:text-xs uppercase font-bold opacity-70 whitespace-nowrap">Terminal</span>
                <span className="text-xs md:text-sm font-mono tracking-widest">
                  {currentTime || "--:--"}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 bg-slate-50 relative">
            {isLoadingInventory && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Sincronizando...</p>
                </div>
              </div>
            )}
            
            <ScrollArea className="h-[450px]">
              <div className="divide-y divide-slate-200">
                {items.length === 0 && manualProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                      <ShoppingCart className="w-12 h-12" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider">Caja Vacía</h3>
                    </div>
                  </div>
                )}
                
                {items.map((item) => (
                  <div key={item.id} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="bg-primary/10 text-primary text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Inv</span>
                        <p className="font-bold text-sm sm:text-base text-slate-800 truncate">{item.name}</p>
                      </div>
                      <p className="text-primary font-black text-lg sm:text-xl mt-1 font-mono">${Math.round(item.price * item.quantity).toLocaleString('es-CL')}</p>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                      <div className="flex items-center bg-slate-100 rounded-full p-1 shadow-inner scale-90 sm:scale-100">
                        <Button variant="ghost" size="icon" className="rounded-full w-7 h-7 sm:w-8 sm:h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, -1)}>
                          <MinusCircle className="w-5 h-5" />
                        </Button>
                        <span className="font-black w-6 sm:w-8 text-center text-base sm:text-lg">{item.quantity}</span>
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
                  <div key={`manual-${idx}`} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4 bg-accent/5 border-l-4 border-accent">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="bg-accent/10 text-accent text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Manual</span>
                        <p className="font-bold text-sm sm:text-base text-slate-800 truncate">{item.description}</p>
                      </div>
                      <p className="text-accent font-black text-lg sm:text-xl mt-1 font-mono">${Math.round(item.amount).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8" onClick={() => removeManual(idx)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex flex-col gap-6 bg-white border-t p-6 sm:p-8">
            <div className="w-full text-right">
              <p className="text-xs font-black uppercase text-primary tracking-widest">Total</p>
              <p className="text-4xl sm:text-6xl font-black text-primary font-mono tracking-tighter leading-none">${Math.round(total).toLocaleString('es-CL')}</p>
            </div>
            
            <Button 
              className={cn(
                "w-full h-20 sm:h-24 text-xl sm:text-2xl font-black rounded-3xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4",
                isProcessing ? "bg-slate-400" : "bg-primary hover:bg-primary/90"
              )}
              onClick={() => handleFinalize()}
              disabled={(items.length === 0 && manualProducts.length === 0) || isProcessing}
            >
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
              {isProcessing ? "PROCESANDO..." : "COBRAR"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Scan className="w-4 h-4" /> Escáner
            </h3>
            {isScanLocked && (
              <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 animate-pulse">
                <Clock className="w-3 h-3" /> Procesando...
              </span>
            )}
          </div>
          <div className="relative group overflow-hidden rounded-3xl">
            <div className={cn(
              "transition-all duration-300",
              isScanLocked && !scanSuccess ? "opacity-40 grayscale" : "opacity-100"
            )}>
              <ScannerComponent onScan={handleScan} />
            </div>
            
            {/* Overlay de éxito verde */}
            <div className={cn(
              "absolute inset-0 z-50 pointer-events-none transition-all duration-500 flex items-center justify-center bg-green-500/20 border-[8px] border-green-500 rounded-3xl",
              scanSuccess ? "opacity-100 scale-100" : "opacity-0 scale-110"
            )}>
              <div className="bg-green-500 text-white p-6 rounded-full shadow-2xl animate-in zoom-in-50 duration-300">
                <Check className="w-16 h-16 stroke-[4]" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <PackageSearch className="w-4 h-4" /> Búsqueda por Nombre
          </h3>
          <ProductSearchBox 
            query={searchQuery} 
            setQuery={setSearchQuery} 
            results={searchResults} 
            onAdd={handleAddItem} 
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <Calculator className="w-4 h-4" /> Cobro Manual
          </h3>
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
            <CalculatorComponent 
              baseValue={Math.round(total)} 
              isProcessing={isProcessing}
              onFinalize={handleFinalize} 
              onClearCart={handleClearCart}
            />
          </div>
        </section>
      </div>

      {pendingBarcode && (
        <QuickAddDialog 
          barcode={pendingBarcode} 
          open={!!pendingBarcode} 
          onClose={() => setPendingBarcode(null)}
          onAdded={(p) => {
            handleAddItem(p);
            setScanSuccess(true);
            setTimeout(() => setScanSuccess(false), 800);
          }}
        />
      )}
    </div>
  );
}
