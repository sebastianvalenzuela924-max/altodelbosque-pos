
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { CalculatorComponent } from "@/components/pos/CalculatorComponent";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, Scan, RotateCcw, Search, Plus, PackageSearch, Check, ReceiptText, IceCream, CupSoda, FileText, Loader2, Undo2, Mic } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, collection, serverTimestamp, increment, query, orderBy, limit, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { VoiceSearchInput } from "@/components/ui/voice-search-input";

// Función para emitir un "beep" de confirmación fuerte usando Web Audio API
const playSuccessSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15); 

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    // Silencioso si falla
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
        <VoiceSearchInput 
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre..."
          inputClassName="bg-slate-50 focus-visible:ring-primary shadow-inner pl-10"
        />

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Estado para la última operación (Undo)
  const [lastOperation, setLastOperation] = useState<any | null>(null);

  // Estados para Ingreso de Stock
  const [isStockEntryDialogOpen, setIsStockEntryDialogOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");

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

  // Normalize text to remove accents and hyphens for smarter matching
  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/-/g, " ") // Replace hyphens with spaces
      .trim();
  };

  const searchResults = useMemo(() => {
    if (!searchQuery || !allProducts) return [];
    const q = normalizeText(searchQuery);
    return allProducts
      .filter(p => normalizeText(p.name).includes(q))
      .slice(0, 5);
  }, [allProducts, searchQuery]);

  const quickAccessProducts = useMemo(() => {
    if (!allProducts) return [];
    const names = ["Granizado pequeño", "Granizado grande", "Helado soft"];
    return names.map(name => {
      const found = allProducts.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
      return { name, product: found };
    });
  }, [allProducts]);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [items, manualProducts]);

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
    playSuccessSound();
    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 800);
  };

  const handleScan = (barcode: string) => {
    const cleanBarcode = String(barcode).trim();
    if (!cleanBarcode || isLoadingInventory) return;

    const now = Date.now();
    if (lastScanRef.current && (now - lastScanRef.current.time < 1200)) return;
    if (lastScanRef.current && lastScanRef.current.code === cleanBarcode && (now - lastScanRef.current.time < 5000)) return;

    lastScanRef.current = { code: cleanBarcode, time: now };
    const product = productMap.get(cleanBarcode);
    if (product) handleAddItem(product);
  };

  const handleFinalize = (manualFinalAmount?: number, paymentMethod: 'cash' | 'card' | 'deduction' = 'card') => {
    let currentManualItems = [...manualProducts];
    let currentCartTotal = total;

    if (manualFinalAmount !== undefined && paymentMethod !== 'deduction') {
      const diff = Math.round(manualFinalAmount) - Math.round(currentCartTotal);
      if (diff !== 0) {
        currentManualItems.push({ description: "Ajuste Manual / Calculadora", amount: diff });
      }
    }

    if (items.length === 0 && currentManualItems.length === 0) return;
    
    setIsProcessing(true);
    const salesRef = collection(firestore, "sales");
    const saleId = crypto.randomUUID();
    
    const finalTotal = paymentMethod === 'deduction' ? 0 : (currentCartTotal + currentManualItems.reduce((sum, item) => sum + (item.amount || 0), 0));

    const saleData = {
      id: saleId,
      totalAmount: Math.round(finalTotal),
      saleDateTime: serverTimestamp(),
      paymentMethod,
      productSaleItemIds: items.map(i => i.id),
      manualSaleItemIds: currentManualItems.map((_, idx) => `manual-${idx}`),
      itemsSummary: [
        ...items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, id: i.id, type: 'product', category: i.category })),
        ...currentManualItems.map(m => ({ name: m.description, quantity: 1, price: m.amount, id: 'manual', type: 'manual', category: 'Manual' }))
      ]
    };

    addDocumentNonBlocking(salesRef, saleData);

    items.forEach(item => {
      const productRef = doc(firestore, "products", item.id);
      const product = productMap.get(String(item.id).trim());
      const noAlerts = product?.warningStock === 0 || product?.idealStock === 0;
      updateDocumentNonBlocking(productRef, {
        stock: increment(noAlerts ? item.quantity : -item.quantity)
      });
    });

    setLastOperation({ type: 'sale', id: saleId, data: saleData });
    setItems([]);
    setManualProducts([]);
    setSearchQuery("");
    
    setTimeout(() => {
      setIsProcessing(false);
      let toastMsg = paymentMethod === 'cash' ? "Venta Finalizada (Efectivo)" : paymentMethod === 'card' ? "Venta Finalizada (Tarjeta)" : "Stock Descontado (Administrativo)";
      toast({ title: toastMsg });
    }, 500);
  };

  const handleStockEntry = () => {
    if (items.length === 0) {
      toast({ title: "Caja vacía", description: "Añade productos para ingresar stock.", variant: "destructive" });
      return;
    }
    setIsStockEntryDialogOpen(true);
  };

  const confirmStockEntry = () => {
    setIsProcessing(true);
    const logsRef = collection(firestore, "inventoryLogs");
    const entryIds: string[] = [];
    
    items.forEach(item => {
      const logId = crypto.randomUUID();
      entryIds.push(logId);
      const productRef = doc(firestore, "products", item.id);
      updateDocumentNonBlocking(productRef, { stock: increment(item.quantity) });
      addDocumentNonBlocking(logsRef, {
        id: logId,
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        invoiceNumber: invoiceNumber.trim() || "N/A",
        timestamp: serverTimestamp(),
        type: 'restock'
      });
    });

    setLastOperation({ 
      type: 'stock', 
      ids: entryIds, 
      itemsSummary: items.map(i => ({ id: i.id, quantity: i.quantity, name: i.name, price: i.price, category: i.category })) 
    });

    toast({ title: "Stock Ingresado", description: `Se han procesado ${items.length} productos.` });
    setItems([]);
    setManualProducts([]);
    setInvoiceNumber("");
    setIsStockEntryDialogOpen(false);
    setIsProcessing(false);
  };

  const handleUndoLastOperation = async () => {
    setIsProcessing(true);
    let opToUndo = lastOperation;

    // Si no hay operación en sesión, intentar buscar la última del historial
    if (!opToUndo) {
      try {
        const salesQuery = query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"), limit(1));
        const salesSnap = await getDocs(salesQuery);
        const lastSaleDoc = salesSnap.docs[0];

        const logsQuery = query(collection(firestore, "inventoryLogs"), orderBy("timestamp", "desc"), limit(1));
        const logsSnap = await getDocs(logsQuery);
        const lastLogDoc = logsSnap.docs[0];

        const saleTime = lastSaleDoc?.data()?.saleDateTime?.toDate?.()?.getTime() || 0;
        const logTime = lastLogDoc?.data()?.timestamp?.toDate?.()?.getTime() || 0;

        if (saleTime === 0 && logTime === 0) {
          toast({ title: "Nada que deshacer", description: "No se encontraron registros recientes.", variant: "destructive" });
          setIsProcessing(false);
          return;
        }

        if (saleTime >= logTime) {
          opToUndo = { type: 'sale', id: lastSaleDoc.id, data: lastSaleDoc.data() };
        } else {
          // Revertir el último registro de stock
          const logData = lastLogDoc.data();
          opToUndo = { 
            type: 'stock', 
            ids: [lastLogDoc.id], 
            itemsSummary: [{ id: logData.productId, quantity: logData.quantity, name: logData.productName, price: 0 }] 
          };
        }
      } catch (e) {
        toast({ title: "Error al buscar historial", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
    }

    if (!opToUndo) {
      setIsProcessing(false);
      return;
    }

    if (opToUndo.type === 'sale') {
      const sale = opToUndo.data;
      const restoredItems = (sale.itemsSummary || [])
        .filter((i: any) => i.type === 'product')
        .map((i: any) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, category: i.category }));
      
      const restoredManual = (sale.itemsSummary || [])
        .filter((i: any) => i.type === 'manual')
        .map((i: any) => ({ description: i.name, amount: i.price }));

      setItems(restoredItems);
      setManualProducts(restoredManual);

      restoredItems.forEach((item: any) => {
        const productRef = doc(firestore, "products", item.id);
        const product = productMap.get(String(item.id).trim());
        const noAlerts = product?.warningStock === 0 || product?.idealStock === 0;
        updateDocumentNonBlocking(productRef, { stock: increment(noAlerts ? -item.quantity : item.quantity) });
      });

      deleteDocumentNonBlocking(doc(firestore, "sales", opToUndo.id));
      toast({ title: "Venta deshecha", description: "Los productos han vuelto a la caja." });
    } else if (opToUndo.type === 'stock') {
      setItems(opToUndo.itemsSummary);
      opToUndo.itemsSummary.forEach((item: any) => {
        const productRef = doc(firestore, "products", item.id);
        updateDocumentNonBlocking(productRef, { stock: increment(-item.quantity) });
      });
      opToUndo.ids.forEach((id: string) => {
        deleteDocumentNonBlocking(doc(firestore, "inventoryLogs", id));
      });
      toast({ title: "Ingreso deshecho", description: "Los productos han vuelto a la caja." });
    }

    setLastOperation(null);
    setIsProcessing(false);
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const removeManual = (index: number) => setManualProducts(prev => prev.filter((_, i) => i !== index));
  const handleClearCart = () => { setItems([]); setManualProducts([]); };

  if (!mounted) return <div className="min-h-screen bg-background" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500 pb-10">
      <div className="lg:col-span-5 flex flex-col gap-6">
        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
            <Scan className="w-4 h-4" /> Escáner de Precisión
          </h3>
          <div className="relative group overflow-hidden rounded-3xl">
            <ScannerComponent onScan={handleScan} />
            <div className={cn("absolute inset-0 z-50 pointer-events-none transition-all duration-500 flex items-center justify-center bg-green-500/20 border-[8px] border-green-500 rounded-3xl", scanSuccess ? "opacity-100 scale-100" : "opacity-0 scale-110")}>
              <div className="bg-green-50 text-white p-6 rounded-full shadow-2xl animate-in zoom-in-50 duration-300"><Check className="w-16 h-16 stroke-[4]" /></div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><PlusCircle className="w-3 h-3" /> Acceso Rápido</h3>
          <div className="grid grid-cols-3 gap-2">
            {quickAccessProducts.map((item, idx) => (
              <Button key={idx} variant="outline" disabled={!item.product} onClick={() => item.product && handleAddItem(item.product)} className={cn("h-auto py-3 px-2 flex flex-col gap-2 rounded-2xl border-none shadow-md transition-all active:scale-95 group", item.product ? (idx === 2 ? "bg-amber-100 hover:bg-amber-200 text-amber-700" : "bg-primary/10 hover:bg-primary/20 text-primary") : "opacity-40 grayscale cursor-not-allowed")}>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">{idx === 2 ? <IceCream className="w-4 h-4" /> : <CupSoda className="w-4 h-4" />}</div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase leading-tight text-center">{item.name}</span>
                  {item.product && <span className="text-[9px] font-black mt-0.5 opacity-60">${Math.round(item.product.price).toLocaleString('es-CL')}</span>}
                </div>
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1"><PackageSearch className="w-4 h-4" /> Buscar Producto</h3>
          <ProductSearchBox query={searchQuery} setQuery={setSearchQuery} results={searchResults} onAdd={handleAddItem} />
        </section>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-3xl flex flex-col">
          <CardHeader className="bg-primary text-white py-4 shrink-0">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <ReceiptText className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
                <CardTitle className="text-xl md:text-2xl truncate">Terminal</CardTitle>
                {(items.length > 0 || manualProducts.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearCart} className="bg-white/10 hover:bg-white/20 text-white border-none rounded-full px-2 h-6 text-[8px] font-black uppercase tracking-widest shrink-0"><RotateCcw className="w-3 h-3 mr-1" />Vaciar</Button>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0"><span className="text-xs md:text-sm font-mono tracking-widest">{currentTime || "--:--"}</span></div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex flex-col bg-slate-50">
            <ScrollArea className="h-[320px] lg:h-[480px] w-full border-b border-slate-200">
              <div className="divide-y divide-slate-100 pb-4">
                {items.length === 0 && manualProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4 opacity-40">
                    <ShoppingCart className="w-12 h-12 text-slate-300" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Esperando productos...</p>
                  </div>
                )}
                {items.map((item) => (
                  <div key={item.id} className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4 bg-white hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-slate-800 truncate">{item.name}</p>
                      <p className="text-primary font-black text-base sm:text-lg mt-1 font-mono">${Math.round(item.price * item.quantity).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                      <div className="flex items-center bg-slate-100 rounded-full p-1 scale-90 sm:scale-100">
                        <Button variant="ghost" size="icon" className="rounded-full w-7 h-7 sm:w-8 sm:h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, -1)}><MinusCircle className="w-5 h-5" /></Button>
                        <span className="font-black w-6 sm:w-8 text-center text-sm">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="rounded-full w-7 h-7 sm:w-8 sm:h-8 hover:bg-white text-slate-600" onClick={() => updateQuantity(item.id, 1)}><PlusCircle className="w-5 h-5" /></Button>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8 shrink-0" onClick={() => removeItem(item.id)}><Trash2 className="w-5 h-5" /></Button>
                    </div>
                  </div>
                ))}
                {manualProducts.map((item, idx) => (
                  <div key={`manual-${idx}`} className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4 bg-accent/5 border-l-4 border-accent animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="bg-accent/10 text-accent text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Manual</span><p className="font-bold text-xs sm:text-sm text-slate-800 truncate">{item.description}</p></div>
                      <p className="text-accent font-black text-base sm:text-lg mt-1 font-mono">${Math.round(item.amount).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8 shrink-0" onClick={() => removeManual(idx)}><Trash2 className="w-5 h-5" /></Button>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            <div className="p-4 md:p-6 bg-white shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
               <CalculatorComponent baseValue={Math.round(total)} isProcessing={isProcessing} onFinalize={handleFinalize} onStockEntry={handleStockEntry} onClearCart={handleClearCart} onUndo={handleUndoLastOperation} hasLastOperation={true} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isStockEntryDialogOpen} onOpenChange={setIsStockEntryDialogOpen}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-accent uppercase flex items-center gap-2"><FileText className="w-6 h-6" /> Ingreso de Stock</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">Registra la entrada de estos productos al inventario.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="invoice" className="text-[10px] font-black uppercase text-slate-400">Número de Factura / Guía (Opcional)</Label>
              <Input id="invoice" className="h-12 rounded-xl bg-slate-50 border-none font-bold text-lg" placeholder="Ej: 888777" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="p-3 bg-accent/5 rounded-xl border border-accent/10">
              <p className="text-[9px] font-black uppercase text-accent/60 mb-2">Resumen de Carga</p>
              <div className="space-y-1">
                {items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs"><span className="font-bold text-slate-700 truncate mr-2">{item.name}</span><span className="font-black text-accent">+{item.quantity}</span></div>
                ))}
                {items.length > 3 && <p className="text-[8px] font-bold text-slate-400 text-center mt-1 italic">...y {items.length - 3} productos más</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="rounded-xl h-12 font-bold" onClick={() => setIsStockEntryDialogOpen(false)}>Cancelar</Button>
            <Button className="rounded-xl bg-accent hover:bg-accent/90 font-black h-12 shadow-lg shadow-accent/20 text-[10px] sm:text-xs" onClick={confirmStockEntry} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}CONFIRMAR CARGA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
