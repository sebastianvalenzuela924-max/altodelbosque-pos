
"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, increment } from "firebase/firestore";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileSpreadsheet, Edit3, Plus, Trash2, Package, Scan, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, MousePointer2, Filter, X } from "lucide-react";
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

type SortOption = "name" | "stock-asc" | "stock-desc" | "status-critical" | "price-asc" | "price-desc" | "category-asc" | "category-desc";

function InventoryContent() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const scanBlockedRef = useRef(false);
  
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [quickStockProduct, setQuickStockProduct] = useState<any | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
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

  useEffect(() => {
    const isAnyModalOpen = isDialogOpen || isScannerOpen || (pendingBarcode !== null) || !!productToDelete || !!quickStockProduct;
    if (!isAnyModalOpen) {
      if (typeof document !== 'undefined') {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
      }
    }
  }, [isDialogOpen, isScannerOpen, pendingBarcode, productToDelete, quickStockProduct]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"), orderBy("name"));
  }, [firestore]);

  const { data: products, isLoading } = useCollection(productsQuery);

  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category || "General"));
    return Array.from(cats).sort();
  }, [products]);

  const getProductStatus = (stock: number, ideal: number, warning?: number) => {
    if (warning !== undefined && warning > 0) {
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
      Stock_Ideal: p.idealStock || 10,
      Stock_Aviso: p.warningStock || 0,
      Categoria: p.category || "General",
      Estado: getProductStatus(p.stock, p.idealStock, p.warningStock).toUpperCase()
    }));
    exportToExcel("Inventario_AltodelBosque", data, "Productos");
    toast({ title: "Exportación exitosa", description: "Se ha descargado el inventario en Excel." });
  };

  const processedProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || String(p.id).includes(q);
      const matchesCategory = categoryFilter === "all" || (p.category || "General") === categoryFilter;
      const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "stock-asc": return a.stock - b.stock;
        case "stock-desc": return b.stock - a.stock;
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "status-critical":
          const aStatus = getProductStatus(a.stock, a.idealStock, a.warningStock);
          const bStatus = getProductStatus(b.stock, b.idealStock, b.warningStock);
          if (aStatus === "peligro" && bStatus !== "peligro") return -1;
          if (aStatus !== "peligro" && bStatus === "peligro") return 1;
          if (aStatus === "precaución" && bStatus === "ok") return -1;
          return 0;
        case "category-asc": return (a.category || "").localeCompare(b.category || "");
        case "category-desc": return (b.category || "").localeCompare(b.category || "");
        case "name":
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchTerm, sortBy, categoryFilter, statusFilter]);

  const handlePointerDown = (product: any) => {
    longPressTimer.current = setTimeout(() => {
      setQuickStockProduct(product);
      setQuickAddValue("");
    }, 600);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleQuickAdd = () => {
    const val = parseInt(quickAddValue);
    if (isNaN(val) || val === 0) return;

    const docRef = doc(firestore, "products", quickStockProduct.id);
    updateDocumentNonBlocking(docRef, {
      stock: increment(val)
    });

    toast({ 
      title: "Stock Actualizado", 
      description: `Se han añadido ${val} unidades a ${quickStockProduct.name}.` 
    });
    setQuickStockProduct(null);
  };

  const handleScanResult = (barcode: string) => {
    if (scanBlockedRef.current || pendingBarcode !== null) return;
    scanBlockedRef.current = true;
    setPendingBarcode(barcode);
    setIsScannerOpen(false);
  };

  const handleDiscardPending = () => {
    setPendingBarcode(null);
    setTimeout(() => {
      scanBlockedRef.current = false;
    }, 500);
  };

  const handleConfirmScanAndEdit = () => {
    const barcode = pendingBarcode?.trim();
    if (!barcode) return;
    const existing = products?.find(p => p.id === barcode);
    setSelectedProduct(existing || { id: barcode });
    setPendingBarcode(null);
    setTimeout(() => {
      scanBlockedRef.current = false;
      setIsDialogOpen(true);
    }, 200);
  };

  const handleCloseProductDialog = () => {
    setIsDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleOpenScanner = () => {
    setPendingBarcode(null);
    scanBlockedRef.current = false;
    setIsScannerOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <Package className="w-8 h-8" />
            Inventario
          </h1>
          <p className="text-muted-foreground text-sm font-bold flex items-center gap-2">
            <MousePointer2 className="w-4 h-4 text-accent" />
            Mantén presionado un producto para carga rápida.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none h-11 rounded-2xl" onClick={handleExport} disabled={!products?.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none h-11 rounded-2xl" onClick={handleOpenScanner}>
            <Scan className="w-4 h-4 mr-2" /> Escanear
          </Button>
          <Button className="flex-1 md:flex-none bg-accent hover:bg-accent/90 h-11 rounded-2xl font-black" onClick={() => { setSelectedProduct(null); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> NUEVO
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-6 border-b space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="pl-12 pr-10 h-12 bg-white rounded-2xl font-bold border-none shadow-sm" 
              placeholder="Buscar por nombre o código..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl shadow-sm border border-slate-100 flex-1 md:flex-none">
              <Filter className="w-3 h-3 text-slate-400" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="border-none h-8 p-0 focus:ring-0 shadow-none font-bold text-xs min-w-[120px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="all" className="text-xs font-bold">Todas las Categorías</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs font-bold">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl shadow-sm border border-slate-100 flex-1 md:flex-none">
              <ShieldCheck className="w-3 h-3 text-slate-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-none h-8 p-0 focus:ring-0 shadow-none font-bold text-xs min-w-[120px]">
                  <SelectValue placeholder="Estado de Stock" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="all" className="text-xs font-bold">Cualquier Estado</SelectItem>
                  <SelectItem value="peligro" className="text-xs font-bold text-destructive">Peligro (Crítico)</SelectItem>
                  <SelectItem value="precaución" className="text-xs font-bold text-amber-600">Precaución (Bajo)</SelectItem>
                  <SelectItem value="ok" className="text-xs font-bold text-green-600">Estado OK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl shadow-sm border border-slate-100 flex-1 md:flex-none ml-auto">
              <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                <SelectTrigger className="border-none h-8 p-0 focus:ring-0 shadow-none font-bold text-xs min-w-[140px]">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="name" className="text-xs font-bold">Nombre (A-Z)</SelectItem>
                  <SelectItem value="status-critical" className="text-xs font-bold">Urgencia de Reposición</SelectItem>
                  <SelectItem value="stock-asc" className="text-xs font-bold">Menor Stock</SelectItem>
                  <SelectItem value="stock-desc" className="text-xs font-bold">Mayor Stock</SelectItem>
                  <SelectItem value="price-asc" className="text-xs font-bold">Precio más bajo</SelectItem>
                  <SelectItem value="price-desc" className="text-xs font-bold">Precio más alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-none">
                <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Producto</TableHead>
                <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Stock / Meta</TableHead>
                <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Categoría</TableHead>
                <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Estado</TableHead>
                <TableHead className="px-6 text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></TableCell></TableRow>
              ) : processedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No se encontraron productos con estos filtros
                  </TableCell>
                </TableRow>
              ) : processedProducts.map((p) => {
                const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
                return (
                  <TableRow 
                    key={p.id} 
                    onPointerDown={() => handlePointerDown(p)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className={cn(
                      "transition-colors border-b select-none touch-none", 
                      status === "peligro" ? "bg-red-100 hover:bg-red-200" : 
                      status === "precaución" ? "bg-amber-100 hover:bg-amber-200" : 
                      status === "ok" ? "bg-green-100 hover:bg-green-200" : "hover:bg-slate-50"
                    )}
                  >
                    <TableCell className="px-6">
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">#{p.id}</p>
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-lg">{p.stock}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {p.warningStock ? `Aviso: < ${p.warningStock}` : `Ideal: ${p.idealStock || 10}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-300 bg-white/50">{p.category || "General"}</Badge>
                    </TableCell>
                    <TableCell className="px-6">
                      {status === "peligro" ? (
                        <Badge className="bg-destructive text-white border-none flex items-center gap-1 rounded-full px-3 py-1 font-black text-[9px] uppercase">
                          <ShieldAlert className="w-3 h-3" /> Peligro
                        </Badge>
                      ) : status === "precaución" ? (
                        <Badge className="bg-amber-600 hover:bg-amber-700 border-none flex items-center gap-1 rounded-full px-3 py-1 font-black text-[9px] uppercase text-white">
                          <ShieldQuestion className="w-3 h-3" /> Precaución
                        </Badge>
                      ) : (
                        <Badge className="bg-green-700 text-white border-none flex items-center gap-1 rounded-full px-3 py-1 font-black text-[9px] uppercase">
                          <ShieldCheck className="w-3 h-3" /> OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20 rounded-full" onClick={() => { setSelectedProduct(p); setIsDialogOpen(true); }}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full" onClick={() => setProductToDelete(p)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!quickStockProduct} onOpenChange={(open) => !open && setQuickStockProduct(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-[90vw] sm:max-w-sm p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-primary uppercase">Carga Rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center py-4">
            <p className="font-bold text-slate-600">{quickStockProduct?.name}</p>
            <div className="grid gap-2">
              <Label className="font-black text-[10px] uppercase text-slate-400">¿Cuánto vas a sumar?</Label>
              <Input type="number" className="h-16 rounded-2xl bg-primary/5 border-none text-center text-4xl font-black text-primary" placeholder="+0" value={quickAddValue} onChange={e => setQuickAddValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setQuickStockProduct(null)}>Cancelar</Button>
            <Button onClick={handleQuickAdd} className="bg-primary hover:bg-primary/90 font-black">Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDialog open={isDialogOpen} onClose={handleCloseProductDialog} product={selectedProduct} categories={categories} onSaved={() => {}} />

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-3xl max-w-[90vw] sm:max-w-2xl border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Escáner de Inventario</DialogTitle>
            <DialogDescription>Escanea un código de barras.</DialogDescription>
          </DialogHeader>
          <ScannerComponent onScan={handleScanResult} />
        </DialogContent>
      </Dialog>

      <Dialog open={pendingBarcode !== null} onOpenChange={(open) => !open && handleDiscardPending()}>
        <DialogContent 
          className="rounded-3xl p-8 max-w-[90vw] sm:max-w-lg border-none shadow-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary text-center">Código Detectado</DialogTitle>
            <DialogDescription className="text-center py-4 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Puedes corregir el código si es necesario:</Label>
              <Input 
                className="font-mono font-bold text-3xl text-center text-slate-800 bg-slate-100 h-16 rounded-2xl border-2 border-slate-200 focus-visible:ring-primary"
                value={pendingBarcode || ""} 
                onChange={(e) => setPendingBarcode(e.target.value)}
              />
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={handleConfirmScanAndEdit} className="rounded-2xl h-14 w-full font-black bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20">
              EDITAR / CREAR PRODUCTO
            </Button>
            <p className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest mt-4">
              Pulsa la X o fuera para salir
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="rounded-3xl max-w-[90vw] sm:max-w-md border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-destructive">¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>Se borrará {productToDelete?.name} definitivamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl font-bold">Cancelar</AlertDialogCancel>
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
