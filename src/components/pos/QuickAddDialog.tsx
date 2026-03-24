
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickProductRegistration } from "@/ai/flows/quick-product-registration";
import { Sparkles, Loader2, Barcode, Save } from "lucide-react";
import { updateProduct } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const handleAI = async () => {
    setLoading(true);
    try {
      const result = await quickProductRegistration({ barcode });
      setName(result.suggestedName);
      setPrice(result.suggestedPrice.toString());
      toast({ title: "Datos sugeridos", description: "La IA ha identificado el producto." });
    } catch (e) {
      toast({ title: "Error de IA", description: "No se pudieron obtener sugerencias.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !price) {
      toast({ title: "Faltan datos", description: "Nombre y precio son obligatorios.", variant: "destructive" });
      return;
    }
    const p = {
      id: barcode,
      name,
      price: parseFloat(price),
      stock: parseInt(stock),
    };
    try {
      await updateProduct(barcode, p);
      onAdded(p);
      onClose();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo guardar el producto.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-black text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
                <Barcode className="w-6 h-6" />
            </div>
            Nuevo Producto
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Código Detectado</span>
            <span className="text-xl font-mono font-bold text-primary tracking-tighter">{barcode}</span>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 h-12 border-accent text-accent hover:bg-accent/5 rounded-xl font-bold"
            onClick={handleAI}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Auto-completar con IA
          </Button>

          <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name" className="font-bold text-slate-500">Nombre del Producto</Label>
                <Input id="name" className="h-12 rounded-xl" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Coca Cola 350ml" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                <Label htmlFor="price" className="font-bold text-slate-500">Precio ($)</Label>
                <Input id="price" type="number" className="h-12 rounded-xl" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="stock" className="font-bold text-slate-500">Stock Inicial</Label>
                <Input id="stock" type="number" className="h-12 rounded-xl" value={stock} onChange={e => setStock(e.target.value)} />
                </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="ghost" className="rounded-xl flex-1" onClick={onClose}>Descartar</Button>
          <Button className="rounded-xl flex-1 bg-primary hover:bg-primary/90 font-black h-12" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            REGISTRAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
