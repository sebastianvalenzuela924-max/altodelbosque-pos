
"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, increment, serverTimestamp } from "firebase/firestore";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileSpreadsheet, Edit3, Plus, Trash2, Package, Scan, Loader2, MousePointer2, Filter, X, Truck, FileText, Sparkles, ShoppingCart, ArrowUpDown, Lock } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuggestionsView } from "@/components/inventory/SuggestionsView";

type SortOption = "name" | "stock-asc" | "stock-desc" | "status-critical" | "price-asc" | "price-desc" | "category-asc" | "category-desc" | "distributor-asc";

const DELETE_PASSWORD = "Miler";

function InventoryContent() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [securityKey, setSecurityKey] = useState("");
  const [quickStockProduct, setQuickStockProduct] = useState<any | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickInvoiceNumber, setQuickInvoiceNumber] = useState("");
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const startPos = useRef<{ x: number, y: number } | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    const search = searchParams.get("search");
    if (search && search.trim() !== "") {
      setSearchTerm(search.trim());
      if (typeof window !== 'undefined') {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"), orderBy("name"));
  }, [firestore]);

  const { data: products, isLoading } = useCollection(productsQuery);

  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category || "General"));
    return Array.from(cats).sort();
  }, [products]);

  const distributors = useMemo(() => {
    if (!products) return [];
    const dists = new Set(products.filter(p => p.distributor).map(p => p.distributor));
    return Array.from(dists).sort();
  }, [products]);

  const getProductStatus = (stock: number, ideal: number, warning?: number) => {
    if (warning === 0 || ideal === 0) return "ok";
    if (warning !== undefined && warning !== null && warning > 0) {
      return stock < warning ? "peligro" : "ok";
    }
    const idealVal = ideal || 10;
    if (stock < idealVal * 0.25) return "peligro";
    if (stock < idealVal * 0.5) return "precaución";
    return "ok";
  };

  const handleExport = () => {
    if (!products) return;
    const data = products.map(p => ({
      ID_Producto: p.id,
      Nombre: p.name,
      Precio_Venta: Math.round(p.price),
      Stock_Actual: p.stock,
      Stock_Ideal: p.idealStock || 0,
      Stock_Aviso: p.warningStock || 0,
      Categoria: p.category || "General",
      Distribuidora: p.distributor || "N/A"
    }));
    exportToExcel("Inventario_AltodelBosque", data, "Productos");
    toast({ title: "Exportación exitosa" });
  };

  const processedProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || String(p.id).includes(q);
      const matchesCategory = categoryFilter === "all" || (p.category || "General") === categoryFilter;
      const matchesDistributor = distributorFilter === "all" || (p.distributor || "") === distributorFilter;
      const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesDistributor && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "stock-asc": return a.stock - b.stock;
        case "stock-desc": return b.stock - a.stock;
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "status-critical":
          const aS = getProductStatus(a.stock, a.idealStock, a.warningStock);
          const bS = getProductStatus(b.stock, b.idealStock, b.warningStock);
          const priority = { "peligro": 0, "precaución": 1, "ok": 2 };
          return priority[aS] - priority[bS];
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchTerm, sortBy, categoryFilter, distributorFilter, statusFilter]);

  const handlePointerDown = (e: React.PointerEvent, product: any) => {
    isLongPress.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setQuickStockProduct(product);
    }, 600);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dist = Math.sqrt(
      Math.pow(e.clientX - startPos.current.x, 2) + 
      Math.pow(e.clientY - startPos.current.y, 2)
    );
    if (dist > 10) clearTimer();
  };

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    startPos.current = null;
  };

  const handleDeleteProduct = () => {
    if (!productToDelete) return;
    if (securityKey !== DELETE_PASSWORD) {
      toast({ title: "Clave incorrecta", variant: "destructive" });
      return;
    }

    deleteDocumentNonBlocking(doc(firestore, "products", productToDelete.id));
    toast({ title: "Producto eliminado" });
    setProductToDelete(null);
    setSecurityKey("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white rounded-2xl p-1 border shadow-sm h-14">
          <TabsTrigger value="list" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" /> Inventario
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-accent data-[state=active]:text-white">
            <Sparkles className="w-4 h-4 mr-2" /> Sugerencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Package className="w-6 h-6" /> Inventario
              </h1>
              <p className="text-muted-foreground text-[10px] font-bold flex items-center gap-2 mt-1">
                <MousePointer2 className="w-3 h-3 text-accent" /> Clic: Editar • Mantener: Carga Rápida
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl text-xs font-bold" onClick={handleExport} disabled={!products?.length}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-green-600" /> Exportar
              </Button>
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl text-xs font-bold" onClick={() => setIsScannerOpen(true)}>
                <Scan className="w-3.5 h-3.5 mr-1.5" /> Escanear
              </Button>
              <Button className="flex-1 md:flex-none bg-accent hover:bg-accent/90 h-10 rounded-xl font-black text-xs" onClick={() => { setSelectedProduct(null); setIsDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> NUEVO
              </Button>
            </div>
          </div>

          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 p-4 border-b space-y-4">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  className="w-full pl-11 pr-4 h-11 bg-white rounded-2xl font-bold border-none shadow-sm text-sm" 
                  placeholder="Buscar por nombre o código..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                  <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-primary" />
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="name">Nombre (A-Z)</SelectItem>
                    <SelectItem value="stock-asc">Stock (Menor a Mayor)</SelectItem>
                    <SelectItem value="stock-desc">Stock (Mayor a Menor)</SelectItem>
                    <SelectItem value="status-critical">Urgencia (Críticos Primero)</SelectItem>
                    <SelectItem value="price-asc">Precio (Menor a Mayor)</SelectItem>
                    <SelectItem value="price-desc">Precio (Mayor a Menor)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas las Categorías</SelectItem>
                    {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                  <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                    <SelectValue placeholder="Distribuidora" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas las Dist.</SelectItem>
                    {distributors.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-none bg-slate-50/30">
                      <TableHead className="px-4 py-3 font-black uppercase text-[9px] tracking-widest">Producto</TableHead>
                      <TableHead className="px-4 py-3 font-black uppercase text-[9px] tracking-widest">Stock</TableHead>
                      <TableHead className="px-4 py-3 font-black uppercase text-[9px] tracking-widest">Categoría</TableHead>
                      <TableHead className="px-4 py-3 font-black uppercase text-[9px] tracking-widest">P. Venta</TableHead>
                      <TableHead className="px-4 py-3 font-black uppercase text-[9px] tracking-widest">Estado</TableHead>
                      <TableHead className="px-4 py-3 text-right font-black uppercase text-[9px] tracking-widest">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-30" /></TableCell></TableRow>
                    ) : processedProducts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 font-bold uppercase text-xs">Sin coincidencias</TableCell></TableRow>
                    ) : processedProducts.map((p) => {
                      const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
                      return (
                        <TableRow 
                          key={p.id} 
                          onPointerDown={(e) => handlePointerDown(e, p)}
                          onPointerUp={clearTimer}
                          onPointerMove={handlePointerMove}
                          onPointerCancel={clearTimer}
                          onContextMenu={(e) => e.preventDefault()}
                          onClick={() => {
                            if (!isLongPress.current) {
                              setSelectedProduct(p);
                              setIsDialogOpen(true);
                            }
                          }}
                          className={cn(
                            "transition-colors border-b select-none cursor-pointer h-14 hover:bg-slate-50 touch-none",
                            status === "peligro" ? "bg-red-50/70" : status === "precaución" ? "bg-amber-50/70" : "bg-green-50/30"
                          )}
                        >
                          <TableCell className="px-4 py-2">
                            <div className="flex flex-col min-w-0">
                              <p className="font-bold text-xs sm:text-sm text-slate-800 truncate max-w-[180px]">{p.name}</p>
                              <p className="text-[9px] font-mono text-slate-400 uppercase">#{p.id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <div className="flex flex-col">
                              <span className={cn("font-black text-sm", status === "peligro" ? "text-destructive" : "text-slate-800")}>{p.stock}</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Ref: {p.warningStock || p.idealStock || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge variant="outline" className="text-[9px] font-black uppercase bg-white border-slate-100">{p.category || "General"}</Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <span className="font-black text-slate-800 text-xs sm:text-sm font-mono tracking-tighter">${Math.round(p.price).toLocaleString('es-CL')}</span>
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge className={cn("text-[9px] font-black uppercase rounded-xl px-2.5 py-0.5 border-none shadow-sm", 
                              status === "peligro" ? "bg-destructive text-white" : status === "precaución" ? "bg-amber-600 text-white" : "bg-green-700 text-white"
                            )}>{status === "peligro" ? "Peligro" : status === "precaución" ? "Bajo" : "OK"}</Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full" onClick={(e) => { e.stopPropagation(); setProductToDelete(p); setSecurityKey(""); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <SuggestionsView products={products || []} categories={categories} distributors={distributors} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!quickStockProduct} onOpenChange={(open) => !open && setQuickStockProduct(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-[90vw] sm:max-w-sm p-6" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-black text-primary uppercase flex items-center gap-2">
              <Package className="w-5 h-5" /> Carga Rápida
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-center">
            <p className="font-bold text-slate-600 text-sm">{quickStockProduct?.name}</p>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="font-black text-[10px] uppercase text-slate-400">Sumar Unidades</Label>
                <Input 
                  type="number" 
                  className="h-16 rounded-2xl bg-primary/5 border-none text-center text-4xl font-black text-primary focus:ring-primary" 
                  placeholder="+0" 
                  value={quickAddValue} 
                  onChange={e => setQuickAddValue(e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-black text-[10px] uppercase text-slate-400">Número de Factura</Label>
                <Input 
                  className="h-11 rounded-xl bg-slate-50 border-none font-bold text-sm" 
                  placeholder="Opcional" 
                  value={quickInvoiceNumber} 
                  onChange={e => setQuickInvoiceNumber(e.target.value)} 
                />
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="rounded-xl h-12 font-bold" onClick={() => setQuickStockProduct(null)}>Cancelar</Button>
            <Button className="bg-primary font-black rounded-xl h-12 shadow-lg shadow-primary/20" onClick={() => {
              const val = parseInt(quickAddValue);
              if (!isNaN(val) && val !== 0) {
                updateDocumentNonBlocking(doc(firestore, "products", quickStockProduct.id), { stock: increment(val) });
                addDocumentNonBlocking(collection(firestore, "inventoryLogs"), {
                  id: crypto.randomUUID(),
                  productId: quickStockProduct.id,
                  productName: quickStockProduct.name,
                  quantity: val,
                  invoiceNumber: quickInvoiceNumber.trim() || "SIN_FACTURA",
                  timestamp: serverTimestamp(),
                  type: 'restock'
                });
                toast({ title: "Stock Actualizado", description: `Se añadieron ${val} unidades.` });
                setQuickStockProduct(null);
                setQuickAddValue("");
                setQuickInvoiceNumber("");
              }
            }}>Añadir Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} product={selectedProduct} categories={categories} onSaved={() => {}} />

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-3xl max-w-[90vw] sm:max-w-2xl border-none shadow-2xl">
          <ScannerComponent onScan={(code) => {
            setIsScannerOpen(false);
            const existing = products?.find(p => p.id === code);
            setSelectedProduct(existing || { id: code });
            setIsDialogOpen(true);
          }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
               <Lock className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-black text-destructive uppercase">Confirmar Eliminación</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold py-2">
              Esta acción borrará permanentemente <span className="font-black">"{productToDelete?.name}"</span>. Ingresa la clave para continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
             <Input 
                type="password"
                placeholder="Clave"
                className="h-12 rounded-xl text-center font-black text-lg border-2 border-destructive/20 focus-visible:ring-destructive"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
              />
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="ghost" className="rounded-xl h-12 font-bold" onClick={() => { setProductToDelete(null); setSecurityKey(""); }}>Cancelar</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl h-12 font-black uppercase"
              disabled={securityKey !== DELETE_PASSWORD}
              onClick={handleDeleteProduct}
            >
              ELIMINAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" /><p className="text-[10px] font-black uppercase tracking-widest mt-4">Preparando Inventario...</p></div>}>
      <InventoryContent />
    </Suspense>
  );
}
