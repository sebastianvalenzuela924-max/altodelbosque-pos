
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Tag, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ProductDialogProps {
  product?: any | null;
  categories?: string[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductDialog({ product, categories = [], open, onClose, onSaved }: ProductDialogProps) {
  const firestore = useFirestore();
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    price: "",
    stock: "",
    idealStock: "",
    category: ""
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id || "",
        name: product.name || "",
        price: product.price ? Math.round(product.price).toString() : "",
        stock: product.stock !== undefined ? product.stock.toString() : "",
        idealStock: product.idealStock !== undefined ? product.idealStock.toString() : "10",
        category: product.category || ""
      });
    } else {
      setFormData({
        id: "",
        name: "",
        price: "",
        stock: "",
        idealStock: "10",
        category: ""
      });
    }
  }, [product, open]);

  const handleSave = () => {
    if (!formData.id || !formData.name || !formData.price || !formData.idealStock) {
      toast({ title: "Error", description: "Completa los campos obligatorios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const docRef = doc(firestore, "products", formData.id);
    
    const enteredCat = formData.category.trim();
    const existingMatch = categories.find(c => c.toLowerCase() === enteredCat.toLowerCase());
    const finalCategory = existingMatch || (enteredCat ? (enteredCat.charAt(0).toUpperCase() + enteredCat.slice(1)) : "General");

    const data = {
      id: formData.id,
      name: formData.name,
      price: Math.round(parseFloat(formData.price)) || 0,
      stock: parseInt(formData.stock) || 0,
      idealStock: parseInt(formData.idealStock) || 10,
      category: finalCategory
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    
    toast({ title: "Guardado", description: `Producto actualizado.` });
    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[95vw] sm:max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-primary">
            <Package className="w-6 h-6" />
            {product?.id && product.name ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-1">
          <div className="grid gap-6 py-4 px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="id" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Código</Label>
                <Input id="id" value={formData.id} disabled={!!product?.id && !!product?.name} className="h-12 rounded-xl bg-slate-50 border-none font-mono font-bold" onChange={e => setFormData({ ...formData, id: e.target.value })} placeholder="EAN" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Precio ($)</Label>
                <Input id="price" type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0" />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Nombre</Label>
              <Input id="name" value={formData.name} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Bebida 1.5L" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category" className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-2">
                <Tag className="w-3 h-3" /> Categoría
              </Label>
              <Input id="category" value={formData.category} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Escribe o selecciona..." />
              {categories.length > 0 && (
                <div className="w-full overflow-hidden">
                  <ScrollArea className="w-full whitespace-nowrap pb-2">
                    <div className="flex gap-2">
                      {categories.map((cat) => (
                        <Badge key={cat} variant={formData.category.toLowerCase() === cat.toLowerCase() ? "default" : "secondary"} className="cursor-pointer rounded-lg px-3 py-1 font-bold text-[10px] uppercase" onClick={() => setFormData({ ...formData, category: cat })}>
                          {cat}
                        </Badge>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="h-1" />
                  </ScrollArea>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stock" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Stock Actual</Label>
                <Input id="stock" type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idealStock" className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-1">
                  <Target className="w-3 h-3" /> Stock Ideal
                </Label>
                <Input id="idealStock" type="number" className="h-12 rounded-xl bg-primary/5 border-primary/20 font-black text-primary" value={formData.idealStock} onChange={e => setFormData({ ...formData, idealStock: e.target.value })} placeholder="10" />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 mt-auto">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl flex-1">Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 rounded-xl flex-1 h-12 font-black">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            GUARDAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
