"use client";

import { useState } from "react";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileSpreadsheet, Edit3, AlertTriangle, Plus, Trash2, Package, Scan, Loader2 } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { ScannerComponent } from "@/components/pos/ScannerComponent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function InventoryPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const { toast } = useToast();

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"), orderBy("name"));
  }, [firestore]);

  const { data: products, isLoading } = useCollection(productsQuery);

  const filtered = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.includes(searchTerm)
  ) || [];

  const handleExport = () => {
    if (!products) return;
    const dataForExport = products.map(p => ({
      "Código Barras": p.id,
      "Nombre": p.name,
      "Precio ($)": p.price,
      "Stock": p.stock,
      "Estado": p.stock < 5 ? "Stock Bajo" : "Normal"
    }));
    exportToExcel("Inventario_SmartSale", dataForExport, "Inventario");
    toast({ title: "Exportación exitosa", description: "Se ha descargado el archivo Excel del inventario." });
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const handleAddNew = (barcode?: string) => {
    const existing = products?.find(p => p.id === barcode);
    if (existing) {
      handleEdit(existing);
    } else {
      setSelectedProduct(barcode ? { id: barcode, name: "", price: 0, stock: 0 } : null);
      setIsDialogOpen(true);
    }
    setIsScannerOpen(false);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;
    const docRef = doc(firestore, "products", productToDelete.id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Eliminado", description: "El producto ha sido marcado para eliminación." });
    setProductToDelete(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <Package className="w-8 h-8" />
            Inventario
          </h1>
          <p className="text-muted-foreground">Gestión por código de barras y control de stock.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none border-primary text-primary" onClick={() => setIsScannerOpen(true)}>
            <Scan className="w-4 h-4 mr-2" /> Escanear Código
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none" onClick={handleExport} disabled={!products?.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar
          </Button>
          <Button className="flex-1 md:flex-none bg-accent hover:bg-accent/90" onClick={() => handleAddNew()}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-10 h-11 bg-white border-none shadow-sm" 
                placeholder="Buscar por nombre o código de barras (EAN)..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="font-bold py-4">Código EAN</TableHead>
                  <TableHead className="font-bold py-4">Nombre</TableHead>
                  <TableHead className="font-bold py-4">Precio</TableHead>
                  <TableHead className="font-bold py-4 text-center">Stock</TableHead>
                  <TableHead className="font-bold py-4">Estado</TableHead>
                  <TableHead className="font-bold py-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p>Cargando inventario...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      No se encontraron productos. Escanea uno para empezar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className={p.stock < 5 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs font-bold text-primary">{p.id}</TableCell>
                      <TableCell className="font-bold">{p.name}</TableCell>
                      <TableCell className="text-primary font-black text-lg">${p.price.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-bold">{p.stock}</TableCell>
                      <TableCell>
                        {p.stock < 5 ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" /> Stock Bajo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none w-fit">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleEdit(p)}>
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setProductToDelete(p)}>
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
        onSaved={() => {}} 
      />

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              Escanear Producto para Registro
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ScannerComponent onScan={handleAddNew} />
            <p className="text-center text-sm text-muted-foreground mt-4">
              Apunta la cámara al código de barras del producto.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el producto <strong>{productToDelete?.name}</strong> del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
