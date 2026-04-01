
"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickProductRegistration } from "@/ai/flows/quick-product-registration";
import { Sparkles, Loader2, Barcode, Target, AlertTriangle } from "lucide-react";
import { useFirestore, setDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection } from "firebase/firestore";
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
  const firestore = useFirestore();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [idealStock, setIdealStock] = useState("10");
  const [warningStock, setWarningStock] = useState("");
  const [category, setCategory] = useState("");
  const [distributor, setDistributor] = useState("");
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
      price === "" && setPrice(Math.round(result.suggestedPrice).toString());
      category === "" && setCategory(result.suggestedCategory);
      distributor === "" && setDistributor(result.suggestedDistributor || "");
      setIdealStock(result.suggestedIdealStock.toString());
      setWarningStock("");
      toast({ title: "IA: Datos sugeridos" });
    } catch (e) {
      toast({ title: "IA no disponible", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!name || !price) {
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
      idealStock: idealStock ? parseInt(idealStock) : null,
      warningStock: warningStock ? parseInt(warningStock) : null,
      category: finalCategory,
      distributor: distributor.trim()
    };

    setDocumentNonBlocking(docRef, data, { merge: true });
    onAdded(data);
    onClose();
    toast({ title: "Producto Guardado" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md border-none shadow-2xl rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="p-6 pb-2 shrink-0 bg-white border-b z-10">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black text-primary">
            <Barcode className="w-6 h-6" />
            Nuevo Producto
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Button variant="outline" className="w-full flex items-center justify-center gap-2 h-12 border-accent text-accent font-bold" onClick={handleAI} disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Auto-completar con IA
          </Button>

          <div className="space-y-4">
            <div className="grid gap-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Nombre</Label>
                <Input className="h-12 rounded-xl bg-slate-50 border-none font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Coca Cola" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="font-bold text-xs uppercase text-slate-500">Categoría</Label>
                  <Input value={category} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setCategory(e.target.value)} placeholder="Ej: Bebidas" />
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold text-xs uppercase text-slate-500">Distribuidora</Label>
                  <Input value={distributor} className="h-12 rounded-xl bg-slate-50 border-none font-bold" onChange={e => setDistributor(e.target.value)} placeholder="Empresa..." />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="font-bold text-xs uppercase text-slate-500">Precio Venta ($)</Label>
                  <Input type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold text-xs uppercase text-slate-500">Stock Inicial (u.)</Label>
                  <Input type="number" className="h-12 rounded-xl bg-slate-50 border-none font-black" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="grid gap-2">
                  <Label className="font-bold text-[9px] uppercase text-slate-400 flex items-center gap-1"><Target className="w-3 h-3"/> Ideal</Label>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl bg-primary/5 border-none font-black text-primary text-center" 
                    value={idealStock} 
                    onChange={e => { setIdealStock(e.target.value); setWarningStock(""); }} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold text-[9px] uppercase text-slate-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Aviso</Label>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl bg-destructive/5 border-none font-black text-destructive text-center" 
                    value={warningStock} 
                    onChange={e => { setWarningStock(e.target.value); setIdealStock(""); }} 
                  />
                </div>
            </div>
          </div>
          <div className="h-4" />
        </div>

        <DialogFooter className="flex flex-row items-center gap-2 p-6 shrink-0 bg-white border-t z-10">
          <Button variant="ghost" className="rounded-xl flex-1 h-12" onClick={onClose}>Descartar</Button>
          <Button className="rounded-xl flex-1 bg-primary font-black h-12" onClick={handleSave}>REGISTRAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
