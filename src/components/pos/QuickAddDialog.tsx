"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickProductRegistration } from "@/ai/flows/quick-product-registration";
import { Sparkles, Loader2 } from "lucide-react";
import { updateProduct } from "@/lib/firebase";

export function QuickAddDialog({ 
  barcode, 
  open, 
  onClose,
  onAdded 
}: { 
  barcode: string; 
  open: boolean; 
  onClose: () => void;
  onAdded: (product: any) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [loading, setLoading] = useState(false);

  const handleAI = async () => {
    setLoading(true);
    try {
      const result = await quickProductRegistration({ barcode });
      setName(result.suggestedName);
      setPrice(result.suggestedPrice.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !price) return;
    const p = {
      id: barcode,
      name,
      price: parseFloat(price),
      stock: parseInt(stock),
    };
    await updateProduct(barcode, p);
    onAdded(p);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuevo Producto Detectado
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm font-mono border">
            Barcode: {barcode}
          </div>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 border-accent text-accent hover:bg-accent/5"
            onClick={handleAI}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Sugerir datos con AI
          </Button>
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Coca Cola 350ml" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Precio</Label>
              <Input id="price" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stock">Stock Inicial</Label>
              <Input id="stock" type="number" value={stock} onChange={e => setStock(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar y Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
