
"use client";

import { useState, useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, FileSpreadsheet, Edit3, AlertTriangle, Plus, Trash2, Package, Scan, Loader2, Check, X, ArrowUp, ArrowDown, ChevronDown, ListFilter, ShieldAlert, ShieldCheck, ShieldQuestion, DollarSign } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SortOption = "name" | "stock-asc" | "stock-desc" | "status-critical" | "price-asc" | "price-desc" | "category-asc" | "category-desc";

export default function InventoryPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const { toast } = useToast();

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"), orderBy("name"));
  }, [firestore]);

  const { data: products, isLoading } = useCollection(productsQuery);

  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category || "General"));
    return Array.from(cats).sort();
  }, [products]);

  const getProductStatus = (stock: number, ideal: number) => {
    const idealVal = ideal || 10;
    if (stock < idealVal * 0.25) return "peligro";
    if (stock < idealVal * 0.5) return "precaución";
    return "ok";
  };

  const processedProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.includes(searchTerm);
      const matchesCategory = categoryFilter === "all" || (p.category || "General") === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "stock-asc": return a.stock - b.stock;
        case "stock-desc": return b.stock - a.stock;
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "status-critical":
          const aStatus = getProductStatus(a.stock, a.idealStock);
          const bStatus = getProductStatus(b.stock, b.idealStock);
          if (aStatus === "peligro" && bStatus !== "peligro") return -1;
          if (aStatus !== "peligro" && bStatus === "peligro") return 1;
          if (aStatus === "precaución" && bStatus === "ok") return -1;
          return 0;
        case "category-asc": return (a.category || "").localeCompare(b.category || "");
        case "category-desc": return (b.category || "").localeCompare(a.category || "");
        case "name":
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchTerm, sortBy, categoryFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <Package className="w-8 h-8" />
            Inventario
          </h1>
          <p className="text-muted-foreground text-sm font-bold">Gestión de stock inteligente.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none h-11 rounded-2xl" onClick={() => setIsScannerOpen(true)}>
            <Scan className="w-4 h-4 mr-2" /> Escanear
          </Button>
          <Button className="flex-1 md:flex-none bg-accent hover:bg-accent/90 h-11 rounded-2xl font-black" onClick={() => { setSelectedProduct(null); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> NUEVO
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-6 border-b">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-12 h-12 bg-white rounded-2xl font-bold" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow className="border-none">
                <TableHead className="px-6 font-black uppercase text-[10px] tracking-widest">Producto</TableHead>
                
                <TableHead className="px-6">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest focus:outline-none">
                        Stock / Ideal <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border-none shadow-2xl p-1 z-[100]">
                      <DropdownMenuItem onClick={() => setSortBy("stock-asc")} className="rounded-lg font-bold text-xs py-2">Menos stock primero</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("stock-desc")} className="rounded-lg font-bold text-xs py-2">Más stock primero</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>

                <TableHead className="px-6">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest focus:outline-none">
                        Categoría <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border-none shadow-2xl p-1 z-[100]">
                      <DropdownMenuItem onClick={() => setCategoryFilter("all")} className="rounded-lg font-bold text-xs py-2">Todas</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[9px] uppercase tracking-widest opacity-50">Ordenar</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setSortBy("category-asc")} className="rounded-lg font-bold text-xs py-2">A-Z</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("category-desc")} className="rounded-lg font-bold text-xs py-2">Z-A</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[9px] uppercase tracking-widest opacity-50">Filtrar</DropdownMenuLabel>
                      {categories.map(cat => (
                        <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)} className="rounded-lg font-bold text-xs py-2">{cat}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>

                <TableHead className="px-6">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest focus:outline-none">
                        Estado <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border-none shadow-2xl p-1 z-[100]">
                      <DropdownMenuItem onClick={() => setSortBy("status-critical")} className="rounded-lg font-black text-xs py-2 text-destructive">
                        <ShieldAlert className="w-3 h-3 mr-2" /> Críticos primero
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                
                <TableHead className="px-6 text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></TableCell></TableRow>
              ) : processedProducts.map((p) => {
                const status = getProductStatus(p.stock, p.idealStock);
                return (
                  <TableRow 
                    key={p.id} 
                    className={cn(
                      "transition-colors", 
                      status === "peligro" ? "bg-destructive/5" : 
                      status === "precaución" ? "bg-amber-50" : 
                      status === "ok" ? "bg-green-50/40 hover:bg-green-50/60" : "hover:bg-slate-50"
                    )}
                  >
                    <TableCell className="px-6">
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">#{p.id}</p>
                    </TableCell>

                    <TableCell className="px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-lg">{p.stock}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Normal: {p.idealStock || 10}</span>
                      </div>
                    </TableCell>

                    <TableCell className="px-6">
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 bg-white/50">{p.category || "General"}</Badge>
                    </TableCell>

                    <TableCell className="px-6">
                      {status === "peligro" ? (
                        <Badge variant="destructive" className="flex items-center gap-1 rounded-full px-3 py-1 font-black text-[9px] uppercase">
                          <ShieldAlert className="w-3 h-3" /> Peligro
                        </Badge>
                      ) : status === "precaución" ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 border-none flex items-center gap-1 rounded-full px-3 py-1 font-black text-[9px] uppercase text-white">
                          <ShieldQuestion className="w-3 h-3" /> Precaución
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-none flex items-center gap-1 rounded-full px-3 py-1 font-black text-[9px] uppercase">
                          <ShieldCheck className="w-3 h-3" /> OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-full" onClick={() => { setSelectedProduct(p); setIsDialogOpen(true); }}>
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

      <ProductDialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} product={selectedProduct} categories={categories} onSaved={() => {}} />

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="p-0 overflow-hidden rounded-3xl"><ScannerComponent onScan={(b) => { setPendingBarcode(b); setIsScannerOpen(false); }} /></DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingBarcode} onOpenChange={() => setPendingBarcode(null)}>
        <AlertDialogContent className="rounded-3xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Código Detectado</AlertDialogTitle>
            <AlertDialogDescription className="text-center py-4 font-mono font-bold text-3xl">{pendingBarcode}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl h-12 flex-1">DESCARTAR</AlertDialogCancel>
            <AlertDialogAction onClick={() => { 
              const existing = products?.find(p => p.id === pendingBarcode);
              if (existing) { setSelectedProduct(existing); setIsDialogOpen(true); }
              else { setSelectedProduct({ id: pendingBarcode }); setIsDialogOpen(true); }
              setPendingBarcode(null);
            }} className="rounded-2xl h-12 flex-1">EDITAR / CREAR</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>Se borrará {productToDelete?.name} definitivamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteDocumentNonBlocking(doc(firestore, "products", productToDelete.id)); setProductToDelete(null); }} className="rounded-2xl bg-destructive">ELIMINAR</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
