
"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickProductRegistration } from "@/ai/flows/quick-product-registration";
import { Sparkles, Loader2, Barcode, Save, Tag, Target } from "lucide-react";
import { useFirestore, setDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  const firestore = useFirestore();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [idealStock, setIdealStock] = useState("10");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const productsQuery = useMemoFirebase(() => {
    return collection(firestore, "products");
  }, [firestore]);
  
  const { data: products } = useCollection(productsQuery);

  const existingCategories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category || "General"));
    return Array.from(cats).sort();
  }, [products]);

  const handleAI = async () => {
    setLoading(true);
    try {
      const result = await quickProductRegistration({ 
        barcode,
        existingProductNames: products?.map(p => p.name).slice(0, 20)
      });
      setName(result.suggestedName);
      setPrice(Math.round(result.suggestedPrice).toString());
      setCategory(result.suggestedCategory);
      setIdealStock(result.suggestedIdealStock.toString());
      toast({ title: "IA: Datos sugeridos" });
    } catch (e) {
      toast({ title: "IA no disponible", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!name || !price || !idealStock) {
      toast({ title: "Faltan datos", variant: "destructive" });
      return;
    }
    
    const enteredCat = category.trim();
    const existingMatch = existingCategories.find(c => c.toLowerCase() === enteredCat.toLowerCase());
    const finalCategory = existingMatch || (enteredCat ? (enteredCat.charAt(0).toUpperCase() + enteredCat.slice(1)) : "General");

    const docRef = doc(firestore, "products", barcode);
    const data = {
      id: barcode,
      name,
      price: Math.round(parseFloat(price)) || 0,
      stock: parseInt(stock) || 0,
      idealStock: parseInt(idealStock) || 10,
      category: finalCategory
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    onAdded(data);
    onClose();
    toast({ title: "Producto Guardado" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md border-none shadow-2xl rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="p-6 pb-2 shrink-0 bg-white z-10">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black text-primary">
            <Barcode className="w-6 h-6" />
            Nuevo Producto
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-6 py-4 grid gap-5">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 h-12 border-accent text-accent font-bold" onClick={handleAI} disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Auto-completar con IA
              </Button>

              <div className="space-y-4 pb-4">
                <div className="grid gap-2">
                    <Label className="font-bold text-xs uppercase text-slate-500">Nombre</Label>
                    <Input className="h-12 rounded-xl bg-slate-50 border-none font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Coca Cola" />
                </div>

                <div className="grid gap-2">
                    <Label className="font-bold text-xs uppercase text-slate-500">Categoría</Label>
                    <Input value={category} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setCategory(e.target.value)} placeholder="Categoría..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="font-bold text-xs uppercase text-slate-500">Precio ($)</Label>
                      <Input type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={price} onChange={e => setPrice(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label className="font-bold text-xs uppercase text-slate-500">Normal (Ideal)</Label>
                      <Input type="number" className="h-12 rounded-xl bg-primary/5 border-none font-black text-primary" value={idealStock} onChange={e => setIdealStock(e.target.value)} />
                    </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex flex-row items-center gap-2 p-6 pt-4 bg-white border-t shrink-0 z-10">
          <Button variant="ghost" className="rounded-xl flex-1 h-12" onClick={onClose}>Descartar</Button>
          <Button className="rounded-xl flex-1 bg-primary font-black h-12" onClick={handleSave}>REGISTRAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
