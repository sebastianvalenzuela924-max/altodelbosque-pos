
"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, increment, serverTimestamp } from "firebase/firestore";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileSpreadsheet, Edit3, Plus, Trash2, Package, Scan, Loader2, MousePointer2, Filter, X, Truck, FileText, Sparkles, ShoppingCart } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuggestionsView } from "@/components/inventory/SuggestionsView";

type SortOption = "name" | "stock-asc" | "stock-desc" | "status-critical" | "price-asc" | "price-desc" | "category-asc" | "category-desc" | "distributor-asc";

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
  
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const scanBlockedRef = useRef(false);
  
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [quickStockProduct, setQuickStockProduct] = useState<any | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickInvoiceNumber, setQuickInvoiceNumber] = useState("");
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  
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
          if (aS === "peligro" && bS !== "peligro") return -1;
          if (aS !== "peligro" && bS === "peligro") return 1;
          return 0;
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchTerm, sortBy, categoryFilter, distributorFilter, statusFilter]);

  const handlePointerDown = (product: any) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setQuickStockProduct(product);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
              <h1 className="text-2xl font-black text-primary flex items-center gap-2">Inventario</h1>
              <p className="text-muted-foreground text-[10px] font-bold flex items-center gap-2 mt-1">
                <MousePointer2 className="w-3 h-3 text-accent" /> Clic: Editar • Mantener: Carga Rápida
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl text-xs" onClick={handleExport} disabled={!products?.length}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-green-600" /> Exportar
              </Button>
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl text-xs" onClick={() => setIsScannerOpen(true)}>
                <Scan className="w-3.5 h-3.5 mr-1.5" /> Escanear
              </Button>
              <Button className="flex-1 md:flex-none bg-accent hover:bg-accent/90 h-10 rounded-xl font-black text-xs" onClick={() => { setSelectedProduct(null); setIsDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> NUEVO
              </Button>
            </div>
          </div>

          <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 p-3 border-b space-y-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  className="w-full pl-10 pr-10 h-10 bg-white rounded-xl font-bold border-none shadow-sm text-sm" 
                  placeholder="Buscar..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-fit bg-white border-none h-8 font-bold text-[10px] rounded-xl shadow-sm px-3">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                  <SelectTrigger className="w-fit bg-white border-none h-8 font-bold text-[10px] rounded-xl shadow-sm px-3">
                    <SelectValue placeholder="Distribuidora" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas</SelectItem>
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
                      <TableHead className="px-3 py-3 font-black uppercase text-[9px]">Producto</TableHead>
                      <TableHead className="px-3 py-3 font-black uppercase text-[9px]">Stock</TableHead>
                      <TableHead className="px-3 py-3 font-black uppercase text-[9px]">Categoría</TableHead>
                      <TableHead className="px-3 py-3 font-black uppercase text-[9px]">P. Venta</TableHead>
                      <TableHead className="px-3 py-3 font-black uppercase text-[9px]">Estado</TableHead>
                      <TableHead className="px-3 py-3 text-right font-black uppercase text-[9px]">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : processedProducts.map((p) => {
                      const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
                      return (
                        <TableRow 
                          key={p.id} 
                          onPointerDown={() => handlePointerDown(p)}
                          onPointerUp={() => clearTimeout(longPressTimer.current!)}
                          onClick={() => !isLongPress.current && (setSelectedProduct(p), setIsDialogOpen(true))}
                          className={cn("transition-colors border-b select-none cursor-pointer h-12 hover:bg-slate-50", 
                            status === "peligro" ? "bg-red-50/50" : status === "precaución" ? "bg-amber-50/50" : "bg-green-50/20"
                          )}
                        >
                          <TableCell className="px-3 py-2">
                            <div className="flex flex-col min-w-0">
                              <p className="font-bold text-xs truncate max-w-[150px]">{p.name}</p>
                              <p className="text-[8px] font-mono text-slate-400">#{p.id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-black text-sm">{p.stock}</span>
                              <span className="text-[8px] text-slate-400 font-bold">Ref: {p.warningStock || p.idealStock || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Badge variant="outline" className="text-[8px] font-black uppercase">{p.category || "General"}</Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <span className="font-black text-slate-800 text-xs">${Math.round(p.price).toLocaleString('es-CL')}</span>
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Badge className={cn("text-[8px] font-black uppercase rounded-full px-2 py-0.5 border-none", 
                              status === "peligro" ? "bg-destructive text-white" : status === "precaución" ? "bg-amber-600 text-white" : "bg-green-700 text-white"
                            )}>{status === "peligro" ? "Peligro" : status === "precaución" ? "Bajo" : "OK"}</Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setProductToDelete(p); }}>
                              <Trash2 className="w-3.5 h-3.5" />
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
          <DialogHeader><DialogTitle className="font-black text-primary">Carga Rápida</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 text-center">
            <p className="font-bold text-slate-600">{quickStockProduct?.name}</p>
            <div className="grid gap-2">
              <Label className="font-black text-[10px] uppercase text-slate-400">Sumar Unidades</Label>
              <Input 
                type="number" 
                className="h-16 rounded-2xl bg-primary/5 border-none text-center text-4xl font-black text-primary" 
                placeholder="+0" 
                value={quickAddValue} 
                onChange={e => setQuickAddValue(e.target.value)} 
              />
              <Input 
                className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs" 
                placeholder="Factura (Opcional)" 
                value={quickInvoiceNumber} 
                onChange={e => setQuickInvoiceNumber(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setQuickStockProduct(null)}>Cancelar</Button>
            <Button className="bg-primary font-black rounded-xl h-12" onClick={() => {
              const val = parseInt(quickAddValue);
              if (!isNaN(val) && val !== 0) {
                updateDocumentNonBlocking(doc(firestore, "products", quickStockProduct.id), { stock: increment(val) });
                addDocumentNonBlocking(collection(firestore, "inventoryLogs"), {
                  id: crypto.randomUUID(),
                  productId: quickStockProduct.id,
                  productName: quickStockProduct.name,
                  quantity: val,
                  invoiceNumber: quickInvoiceNumber.trim(),
                  timestamp: serverTimestamp(),
                  type: 'restock'
                });
                toast({ title: "Stock Actualizado" });
                setQuickStockProduct(null);
                setQuickAddValue("");
                setQuickInvoiceNumber("");
              }
            }}>Añadir</Button>
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

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-destructive">¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteDocumentNonBlocking(doc(firestore, "products", productToDelete.id)); setProductToDelete(null); }} className="rounded-2xl bg-destructive font-black">ELIMINAR</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
      <InventoryContent />
    </Suspense>
  );
}
