"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package } from "lucide-react";

interface ProductDialogProps {
  product?: any | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductDialog({ product, open, onClose, onSaved }: ProductDialogProps) {
  const firestore = useFirestore();
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    price: "",
    stock: ""
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id,
        name: product.name || "",
        price: product.price?.toString() || "",
        stock: product.stock?.toString() || "0"
      });
    } else {
      setFormData({
        id: "",
        name: "",
        price: "",
        stock: "0"
      });
    }
  }, [product, open]);

  const handleSave = () => {
    if (!formData.id || !formData.name || !formData.price) {
      toast({ title: "Error", description: "Por favor complete todos los campos obligatorios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const docRef = doc(firestore, "products", formData.id);
    const data = {
      id: formData.id,
      name: formData.name,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock) || 0
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    
    toast({ title: "Éxito", description: "Operación enviada correctamente." });
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {product?.id ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="id">Código de Barras (EAN-13)</Label>
            <Input 
              id="id" 
              value={formData.id} 
              disabled={!!product?.id}
              onChange={e => setFormData({ ...formData, id: e.target.value })} 
              placeholder="Ej: 7791234567890" 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del Producto</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder="Ej: Coca Cola 2.25L" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Precio de Venta ($)</Label>
              <Input 
                id="price" 
                type="number" 
                value={formData.price} 
                onChange={e => setFormData({ ...formData, price: e.target.value })} 
                placeholder="0.00" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stock">Stock Actual</Label>
              <Input 
                id="stock" 
                type="number" 
                value={formData.stock} 
                onChange={e => setFormData({ ...formData, stock: e.target.value })} 
                placeholder="0" 
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {product?.id ? "Actualizar" : "Crear Producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
