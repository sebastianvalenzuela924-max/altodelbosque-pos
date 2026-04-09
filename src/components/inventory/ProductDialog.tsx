
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Tag, Target, AlertTriangle, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ProductDialogProps {
  product?: any | null;
  categories?: string[];
  distributors?: string[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductDialog({ product, categories = [], distributors = [], open, onClose, onSaved }: ProductDialogProps) {
  const firestore = useFirestore();
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    price: "",
    stock: "",
    idealStock: "",
    warningStock: "",
    category: "",
    distributor: ""
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id || "",
        name: product.name || "",
        price: (product.price !== undefined && product.price !== null) ? Math.round(product.price).toString() : "",
        stock: (product.stock !== undefined && product.stock !== null) ? product.stock.toString() : "",
        idealStock: (product.idealStock !== undefined && product.idealStock !== null) ? product.idealStock.toString() : "",
        warningStock: (product.warningStock !== undefined && product.warningStock !== null) ? product.warningStock.toString() : "",
        category: product.category || "",
        distributor: product.distributor || ""
      });
    } else {
      setFormData({
        id: "",
        name: "",
        price: "",
        stock: "",
        idealStock: "10",
        warningStock: "",
        category: "",
        distributor: ""
      });
    }
  }, [product, open]);

  const handleSave = () => {
    if (!formData.name || !formData.price) {
      toast({ title: "Faltan datos", description: "El nombre y precio son obligatorios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const finalId = formData.id.trim() || `INT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const newPriceValue = Math.round(parseFloat(formData.price)) || 0;

    // Registrar cambio de precio si el producto ya existía y el precio cambió
    if (product?.id && product.price !== undefined && Math.round(product.price) !== newPriceValue) {
      addDocumentNonBlocking(collection(firestore, "priceChangeLogs"), {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: formData.name,
        oldPrice: Math.round(product.price),
        newPrice: newPriceValue,
        timestamp: serverTimestamp()
      });
    }
    
    if (product?.id && product.id !== finalId) {
      const oldDocRef = doc(firestore, "products", product.id);
      deleteDocumentNonBlocking(oldDocRef);
    }

    const docRef = doc(firestore, "products", finalId);
    
    const enteredCat = formData.category.trim();
    const existingCatMatch = categories.find(c => c.toLowerCase() === enteredCat.toLowerCase());
    const finalCategory = existingCatMatch || (enteredCat ? (enteredCat.charAt(0).toUpperCase() + enteredCat.slice(1)) : "General");

    const enteredDist = formData.distributor.trim();
    const existingDistMatch = distributors.find(d => d.toLowerCase() === enteredDist.toLowerCase());
    const finalDistributor = existingDistMatch || enteredDist;

    const data = {
      id: finalId,
      name: formData.name,
      price: newPriceValue,
      stock: parseInt(formData.stock) || 0,
      idealStock: formData.idealStock !== "" ? parseInt(formData.idealStock) : null,
      warningStock: formData.warningStock !== "" ? parseInt(formData.warningStock) : null,
      category: finalCategory,
      distributor: finalDistributor
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    toast({ 
      title: product?.id ? (product.id !== finalId ? "Código Actualizado" : "Producto Actualizado") : "Producto Creado", 
      description: `Se guardó correctamente.` 
    });
    
    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[95vw] sm:max-w-lg border-none shadow-2xl rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col gap-0"
      >
        <DialogHeader className="p-6 pb-2 shrink-0 bg-white border-b z-10">
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-primary">
            <Package className="w-6 h-6" />
            {product?.id && product.name ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="id" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Código / Barcode</Label>
              <Input 
                id="id" 
                value={formData.id} 
                className="h-12 rounded-xl bg-slate-50 border-none font-mono font-bold focus-visible:ring-primary" 
                onChange={e => setFormData({ ...formData, id: e.target.value })} 
                placeholder="EAN-13 o Manual" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Precio Venta ($)</Label>
              <Input id="price" type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0" />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="name" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Nombre del Producto</Label>
            <Input id="name" value={formData.name} className="h-12 rounded-xl bg-slate-50 border-none font-bold text-lg" onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Empanada de Pino" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category" className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-2">
                <Tag className="w-3 h-3" /> Categoría
              </Label>
              <Input id="category" value={formData.category} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Ej: Bebidas" />
              
              {categories.length > 0 && (
                <div className="grid gap-2 mt-1">
                  <ScrollArea className="w-full whitespace-nowrap pb-2">
                    <div className="flex gap-1.5">
                      {categories.map((cat) => (
                        <Badge 
                          key={cat} 
                          variant={formData.category.toLowerCase() === cat.toLowerCase() ? "default" : "secondary"} 
                          className="cursor-pointer rounded-lg px-2.5 py-0.5 font-bold text-[8px] uppercase" 
                          onClick={() => setFormData({ ...formData, category: cat })}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="h-1" />
                  </ScrollArea>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="distributor" className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-3 h-3" /> Distribuidora
              </Label>
              <Input id="distributor" value={formData.distributor} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setFormData({ ...formData, distributor: e.target.value })} placeholder="Ej: Coca Cola" />
              
              {distributors.length > 0 && (
                <div className="grid gap-2 mt-1">
                  <ScrollArea className="w-full whitespace-nowrap pb-2">
                    <div className="flex gap-1.5">
                      {distributors.map((dist) => (
                        <Badge 
                          key={dist} 
                          variant={formData.distributor.toLowerCase() === dist.toLowerCase() ? "default" : "secondary"} 
                          className="cursor-pointer rounded-lg px-2.5 py-0.5 font-bold text-[8px] uppercase" 
                          onClick={() => setFormData({ ...formData, distributor: dist })}
                        >
                          {dist}
                        </Badge>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="h-1" />
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stock" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Stock Actual (Unidades)</Label>
              <Input id="stock" type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
               <p className="text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">Niveles de Alerta</p>
               <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="idealStock" className="font-bold text-slate-500 text-[9px] uppercase tracking-widest flex items-center gap-1">
                    <Target className="w-3 h-3" /> Ideal (Meta)
                  </Label>
                  <p className="text-[7px] text-slate-400 font-bold leading-tight">Meta de stock para sugerir compras.</p>
                  <Input 
                    id="idealStock" 
                    type="number" 
                    className="h-12 rounded-xl bg-white border-none font-black text-primary text-center" 
                    value={formData.idealStock} 
                    onChange={e => { setFormData({ ...formData, idealStock: e.target.value, warningStock: "" }); }} 
                    placeholder="Ejem: 10" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="warningStock" className="font-bold text-slate-500 text-[9px] uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Aviso (Gatillo)
                  </Label>
                  <p className="text-[7px] text-slate-400 font-bold leading-tight">Gatillo crítico para mostrar alerta.</p>
                  <Input 
                    id="warningStock" 
                    type="number" 
                    className="h-12 rounded-xl bg-white border-none font-black text-destructive text-center" 
                    value={formData.warningStock} 
                    onChange={e => { setFormData({ ...formData, warningStock: e.target.value, idealStock: "" }); }} 
                    placeholder="Ejem: 5" 
                  />
                </div>
               </div>
            </div>
          </div>
          <div className="h-4" />
        </div>

        <DialogFooter className="gap-2 p-6 shrink-0 bg-white border-t z-10 flex flex-row items-center">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl flex-1 h-12 font-bold">Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 rounded-xl flex-1 h-12 font-black shadow-lg shadow-primary/20">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            GUARDAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
