
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Tag, Target, HelpCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    warningStock: "",
    category: ""
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
        category: product.category || ""
      });
    } else {
      setFormData({
        id: "",
        name: "",
        price: "",
        stock: "",
        idealStock: "10",
        warningStock: "",
        category: ""
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
    const docRef = doc(firestore, "products", finalId);
    
    const enteredCat = formData.category.trim();
    const existingMatch = categories.find(c => c.toLowerCase() === enteredCat.toLowerCase());
    const finalCategory = existingMatch || (enteredCat ? (enteredCat.charAt(0).toUpperCase() + enteredCat.slice(1)) : "General");

    const data = {
      id: finalId,
      name: formData.name,
      price: Math.round(parseFloat(formData.price)) || 0,
      stock: parseInt(formData.stock) || 0,
      idealStock: formData.idealStock ? parseInt(formData.idealStock) : null,
      warningStock: formData.warningStock ? parseInt(formData.warningStock) : null,
      category: finalCategory
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    toast({ 
      title: product?.id ? "Producto Actualizado" : "Producto Creado", 
      description: `Se guardó correctamente con el código: ${finalId}` 
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
              <div className="flex items-center gap-2">
                <Label htmlFor="id" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Código</Label>
              </div>
              <Input 
                id="id" 
                value={formData.id} 
                disabled={!!product?.id && !!product?.name} 
                className="h-12 rounded-xl bg-slate-50 border-none font-mono font-bold" 
                onChange={e => setFormData({ ...formData, id: e.target.value })} 
                placeholder="Opcional (EAN)" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Precio ($)</Label>
              <Input id="price" type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0" />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="name" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Nombre del Producto</Label>
            <Input id="name" value={formData.name} className="h-12 rounded-xl bg-slate-50 border-none font-bold text-lg" onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Empanada de Pino" autoFocus />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category" className="font-bold text-slate-500 text-xs uppercase tracking-widest flex items-center gap-2">
              <Tag className="w-3 h-3" /> Categoría
            </Label>
            <Input id="category" value={formData.category} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Escribe o selecciona..." />
            {categories.length > 0 && (
              <ScrollArea className="w-full whitespace-nowrap pb-2 mt-2">
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <Badge key={cat} variant={formData.category.toLowerCase() === cat.toLowerCase() ? "default" : "secondary"} className="cursor-pointer rounded-lg px-3 py-1 font-bold text-[10px] uppercase" onClick={() => setFormData({ ...formData, category: cat })}>
                      {cat}
                    </Badge>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1" />
              </ScrollArea>
            )}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stock" className="font-bold text-slate-500 text-xs uppercase tracking-widest">Stock Actual</Label>
              <Input id="stock" type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
               <p className="text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">Configuración de Alerta (Elige una)</p>
               
               <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="idealStock" className="font-bold text-slate-500 text-[9px] uppercase tracking-widest flex items-center gap-1">
                    <Target className="w-3 h-3" /> Por % (Ideal)
                  </Label>
                  <Input 
                    id="idealStock" 
                    type="number" 
                    className="h-12 rounded-xl bg-white border-none font-black text-primary text-center" 
                    value={formData.idealStock} 
                    onChange={e => setFormData({ ...formData, idealStock: e.target.value, warningStock: "" })} 
                    placeholder="Ejem: 10" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="warningStock" className="font-bold text-slate-500 text-[9px] uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Fijo (Aviso)
                  </Label>
                  <Input 
                    id="warningStock" 
                    type="number" 
                    className="h-12 rounded-xl bg-white border-none font-black text-destructive text-center" 
                    value={formData.warningStock} 
                    onChange={e => setFormData({ ...formData, warningStock: e.target.value, idealStock: "" })} 
                    placeholder="Ejem: 5" 
                  />
                </div>
               </div>
               <p className="text-[8px] text-center text-slate-400 font-bold italic">
                 {formData.warningStock ? "Usando 'Aviso': Peligro si el stock baja de este número." : "Usando 'Ideal': Peligro si el stock baja del 25% del ideal."}
               </p>
            </div>
          </div>
          
          <div className="h-4" />
        </div>

        <DialogFooter className="gap-2 p-6 shrink-0 bg-white border-t z-10 flex flex-row items-center">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl flex-1 h-12 font-bold">Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 rounded-xl flex-1 h-12 font-black shadow-lg shadow-primary/20">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            GUARDAR PRODUCTO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
