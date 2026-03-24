
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Tag } from "lucide-react";

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
        category: product.category || ""
      });
    } else {
      setFormData({
        id: "",
        name: "",
        price: "",
        stock: "",
        category: ""
      });
    }
  }, [product, open]);

  const handleSave = () => {
    if (!formData.id || !formData.name || !formData.price) {
      toast({ title: "Error", description: "Completa los campos obligatorios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const docRef = doc(firestore, "products", formData.id);
    const data = {
      id: formData.id,
      name: formData.name,
      price: Math.round(parseFloat(formData.price)) || 0,
      stock: parseInt(formData.stock) || 0,
      category: formData.category.trim() || "General"
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    
    toast({ title: "Guardado", description: "Producto actualizado correctamente." });
    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-primary">
            <Package className="w-6 h-6" />
            {product?.id && product.name ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="id" className="font-bold text-slate-500">Código de Barras (EAN-13)</Label>
            <Input 
              id="id" 
              value={formData.id} 
              disabled={!!product?.id && !!product?.name}
              className="h-12 rounded-xl"
              onChange={e => setFormData({ ...formData, id: e.target.value })} 
              placeholder="Ej: 7791234567890" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name" className="font-bold text-slate-500">Nombre del Producto</Label>
            <Input 
              id="name" 
              value={formData.name} 
              className="h-12 rounded-xl"
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder="Ej: Bebida 1.5L" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category" className="font-bold text-slate-500 flex items-center gap-2">
              <Tag className="w-3 h-3" /> Categoría
            </Label>
            <div className="relative">
              <Input 
                id="category" 
                list="category-suggestions"
                value={formData.category} 
                className="h-12 rounded-xl"
                onChange={e => setFormData({ ...formData, category: e.target.value })} 
                placeholder="Selecciona o escribe una categoría" 
              />
              <datalist id="category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            {categories.length > 0 && !formData.category && (
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-2">
                Escribe para ver sugerencias
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price" className="font-bold text-slate-500">Precio ($)</Label>
              <Input 
                id="price" 
                type="number" 
                className="h-12 rounded-xl"
                value={formData.price} 
                onChange={e => setFormData({ ...formData, price: e.target.value })} 
                placeholder="Monto" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stock" className="font-bold text-slate-500">Stock</Label>
              <Input 
                id="stock" 
                type="number" 
                className="h-12 rounded-xl"
                value={formData.stock} 
                onChange={e => setFormData({ ...formData, stock: e.target.value })} 
                placeholder="Cantidad" 
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl flex-1">Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 rounded-xl flex-1 h-12 font-black">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {product?.id && product.name ? "ACTUALIZAR" : "CREAR PRODUCTO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
