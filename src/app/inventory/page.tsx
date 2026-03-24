
"use client";

import { useState, useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileSpreadsheet, Edit3, AlertTriangle, Plus, Trash2, Package, Scan, Loader2, Check, X, ArrowUpDown, Filter, Tag, ArrowUp, ArrowDown } from "lucide-react";
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

  const processedProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.includes(searchTerm);
      const matchesCategory = categoryFilter === "all" || (p.category || "General") === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "category-asc":
          return (a.category || "General").localeCompare(b.category || "General");
        case "category-desc":
          return (b.category || "General").localeCompare(a.category || "General");
        case "status-critical":
          const aCritical = a.stock < 5 ? 0 : 1;
          const bCritical = b.stock < 5 ? 0 : 1;
          if (aCritical !== bCritical) return aCritical - bCritical;
          return a.name.localeCompare(b.name);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchTerm, sortBy, categoryFilter]);

  const handleExport = () => {
    if (!products) return;
    const dataForExport = products.map(p => ({
      "Código Barras": p.id,
      "Nombre": p.name,
      "Categoría": p.category || "General",
      "Precio ($)": Math.round(p.price),
      "Stock": p.stock,
      "Estado": p.stock < 5 ? "Stock Bajo" : "Normal"
    }));
    exportToExcel("Inventario_SmartSale", dataForExport, "Inventario");
    toast({ title: "Exportación exitosa", description: "Se ha descargado el archivo Excel." });
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const onBarcodeDetected = (barcode: string) => {
    setPendingBarcode(barcode);
    setIsScannerOpen(false);
  };

  const confirmPendingBarcode = () => {
    if (!pendingBarcode) return;
    const barcode = pendingBarcode;
    setPendingBarcode(null);
    const existing = products?.find(p => p.id === barcode);
    if (existing) {
      handleEdit(existing);
    } else {
      setSelectedProduct({ id: barcode, name: "", price: "", stock: "", category: "" });
      setIsDialogOpen(true);
    }
  };

  const handleAddNew = (barcode?: string) => {
    setSelectedProduct(barcode ? { id: barcode, name: "", price: "", stock: "", category: "" } : null);
    setIsDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;
    const docRef = doc(firestore, "products", productToDelete.id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Eliminado", description: "Producto eliminado correctamente." });
    setProductToDelete(null);
  };

  const toggleSort = (type: 'name' | 'stock' | 'price' | 'status' | 'category') => {
    if (type === 'name') {
      setSortBy('name');
    } else if (type === 'stock') {
      setSortBy(sortBy === 'stock-asc' ? 'stock-desc' : 'stock-asc');
    } else if (type === 'price') {
      setSortBy(sortBy === 'price-asc' ? 'price-desc' : 'price-asc');
    } else if (type === 'category') {
      setSortBy(sortBy === 'category-asc' ? 'category-desc' : 'category-asc');
    } else if (type === 'status') {
      setSortBy('status-critical');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <Package className="w-8 h-8" />
            Inventario
          </h1>
          <p className="text-muted-foreground text-sm font-bold">Gestiona tus existencias y alertas de stock.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none border-primary text-primary h-11 rounded-2xl" onClick={() => setIsScannerOpen(true)}>
            <Scan className="w-4 h-4 mr-2" /> Escanear
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none h-11 rounded-2xl" onClick={handleExport} disabled={!products?.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar
          </Button>
          <Button className="flex-1 md:flex-none bg-accent hover:bg-accent/90 h-11 rounded-2xl font-black" onClick={() => handleAddNew()}>
            <Plus className="w-4 h-4 mr-2" /> NUEVO
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-6 border-b">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-12 h-12 bg-white border-none shadow-inner rounded-2xl font-bold" 
                placeholder="Buscar por nombre o código..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
              <div className="bg-white p-1 rounded-2xl flex items-center border shadow-sm w-full lg:w-auto">
                <div className="pl-3 text-muted-foreground">
                  <Tag className="w-4 h-4" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="border-none shadow-none focus:ring-0 w-full lg:w-[180px] font-bold h-10">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-white p-1 rounded-2xl flex items-center border shadow-sm w-full lg:w-auto">
                <div className="pl-3 text-muted-foreground">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="border-none shadow-none focus:ring-0 w-full lg:w-[180px] font-bold h-10">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="name">Alfabético (Nombre)</SelectItem>
                    <SelectItem value="status-critical">Stock Bajo Primero ⚠️</SelectItem>
                    <SelectItem value="stock-asc">Stock (Menor a Mayor)</SelectItem>
                    <SelectItem value="stock-desc">Stock (Mayor a Menor)</SelectItem>
                    <SelectItem value="price-asc">Precio (Menor a Mayor)</SelectItem>
                    <SelectItem value="price-desc">Precio (Mayor a Menor)</SelectItem>
                    <SelectItem value="category-asc">Categoría (A-Z)</SelectItem>
                    <SelectItem value="category-desc">Categoría (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-black py-4 uppercase text-[10px] tracking-widest px-6">Código</TableHead>
                  
                  <TableHead 
                    className="font-black py-4 uppercase text-[10px] tracking-widest px-6 cursor-pointer hover:text-primary transition-colors group"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nombre del Producto
                      {sortBy === 'name' && <ArrowDown className="w-3 h-3" />}
                    </div>
                  </TableHead>

                  <TableHead 
                    className="font-black py-4 uppercase text-[10px] tracking-widest px-6 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => toggleSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Categoría
                      {sortBy === 'category-asc' && <ArrowUp className="w-3 h-3" />}
                      {sortBy === 'category-desc' && <ArrowDown className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  
                  <TableHead 
                    className="font-black py-4 uppercase text-[10px] tracking-widest px-6 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => toggleSort('price')}
                  >
                    <div className="flex items-center gap-1">
                      Precio
                      {sortBy === 'price-asc' && <ArrowUp className="w-3 h-3" />}
                      {sortBy === 'price-desc' && <ArrowDown className="w-3 h-3" />}
                    </div>
                  </TableHead>

                  <TableHead 
                    className="font-black py-4 uppercase text-[10px] tracking-widest px-6 text-center cursor-pointer hover:text-primary transition-colors"
                    onClick={() => toggleSort('stock')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Stock
                      {sortBy === 'stock-asc' && <ArrowUp className="w-3 h-3" />}
                      {sortBy === 'stock-desc' && <ArrowDown className="w-3 h-3" />}
                    </div>
                  </TableHead>

                  <TableHead 
                    className="font-black py-4 uppercase text-[10px] tracking-widest px-6 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => toggleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Estado
                      {sortBy === 'status-critical' && <AlertTriangle className="w-3 h-3 text-destructive" />}
                    </div>
                  </TableHead>

                  <TableHead className="font-black py-4 uppercase text-[10px] tracking-widest px-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-primary">
                        <Loader2 className="w-10 h-10 animate-spin" />
                        <p className="font-black text-[10px] uppercase tracking-widest">Sincronizando inventario...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : processedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="w-12 h-12 opacity-20" />
                        <p className="font-bold">No se encontraron productos.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  processedProducts.map((p) => (
                    <TableRow key={p.id} className={cn("transition-colors", p.stock < 5 ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-slate-50")}>
                      <TableCell className="font-mono text-xs font-black text-primary px-6">{p.id}</TableCell>
                      <TableCell className="font-bold px-6">{p.name}</TableCell>
                      <TableCell className="px-6">
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-bold border-slate-200 text-slate-500 uppercase">
                          {p.category || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-primary font-black text-lg px-6 font-mono">${Math.round(p.price).toLocaleString('es-CL')}</TableCell>
                      <TableCell className="text-center font-black text-lg px-6">{p.stock}</TableCell>
                      <TableCell className="px-6">
                        {p.stock < 5 ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit rounded-full px-3 py-1 font-black text-[10px] uppercase tracking-tighter">
                            <AlertTriangle className="w-3 h-3" /> Reponer
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none w-fit rounded-full px-3 py-1 font-black text-[10px] uppercase tracking-tighter">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-xl" onClick={() => handleEdit(p)}>
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => setProductToDelete(p)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProductDialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        product={selectedProduct}
        categories={categories}
        onSaved={() => {}} 
      />

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-lg border-none rounded-3xl shadow-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Scan className="w-6 h-6" />
              Escanear para Inventario
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-slate-50">
            <ScannerComponent onScan={onBarcodeDetected} />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingBarcode} onOpenChange={() => setPendingBarcode(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
              <Scan className="w-6 h-6" />
              Código Detectado
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center py-6">
              <span className="text-4xl font-mono font-black text-slate-800 tracking-tighter block my-2">
                {pendingBarcode}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                ¿Es este el código que quieres registrar?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-2xl h-12 flex-1 border-slate-200">
              <X className="w-4 h-4 mr-2" /> DESCARTAR
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingBarcode} className="rounded-2xl h-12 flex-1 bg-primary hover:bg-primary/90 font-black">
              <Check className="w-4 h-4 mr-2" /> ACEPTAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-destructive">¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Se borrará <strong>{productToDelete?.name}</strong> definitivamente del inventario. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="rounded-2xl h-12 flex-1 border-slate-200">No, cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-2xl h-12 flex-1 bg-destructive hover:bg-destructive/90 font-black">
              SÍ, ELIMINAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
