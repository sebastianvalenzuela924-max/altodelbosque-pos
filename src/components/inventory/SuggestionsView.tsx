
"use client";

import { useMemo, useState } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Package, Send, Sparkles, Truck, ListFilter, Trash2, CheckSquare, Search, X, CheckCircle2, Info, Target, AlertTriangle, Loader2, ArrowUpDown, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Product {
  id: string;
  name: string;
  category?: string;
  distributor?: string;
  stock: number;
  warningStock?: number;
  idealStock?: number;
  price: number;
  status?: string;
  buyByCase?: boolean;
  unitsPerCase?: number;
}

interface SuggestionsViewProps {
  products: Product[];
  categories: string[];
  distributors: string[];
}

type Priority = 'Crítico' | 'Por reponer' | 'OK';
type ViewMode = 'general' | 'category' | 'distributor';
type RotationType = 'Alta' | 'Media' | 'Baja' | 'Ninguna';

export function SuggestionsView({ products, categories, distributors }: SuggestionsViewProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [priorityFilter, setPriorityFilter] = useState<string>("suggestions");
  const [rotationFilter, setRotationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("general");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const salesQuery = useMemoFirebase(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return query(
      collection(firestore, "sales"),
      where("saleDateTime", ">=", thirtyDaysAgo)
    );
  }, [firestore]);

  const { data: recentSales, isLoading: isLoadingSales } = useCollection(salesQuery);

  const salesMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!recentSales) return map;
    recentSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        if (item.type === 'product' && item.id) {
          const current = map.get(String(item.id).trim()) || 0;
          map.set(String(item.id).trim(), current + (item.quantity || 0));
        }
      });
    });
    return map;
  }, [recentSales]);

  const analysis = useMemo(() => {
    if (!products) return [];

    return products
      .map(p => {
        let priority: Priority = 'OK';
        let suggestedQty = 0; // En unidades o cajas según p.buyByCase
        let reason = "Stock OK";
        let rotation: RotationType = 'Ninguna';

        const stock = p.stock || 0;
        const totalSold = salesMap.get(String(p.id).trim()) || 0;
        const dailyAvg = totalSold / 30;

        if (totalSold >= 15) rotation = 'Alta';
        else if (totalSold >= 3) rotation = 'Media';
        else if (totalSold > 0) rotation = 'Baja';

        const hasIdeal = p.idealStock !== undefined && p.idealStock !== null && p.idealStock > 0;
        const hasWarning = p.warningStock !== undefined && p.warningStock !== null && p.warningStock > 0;

        // Gatillo de alerta
        if (stock <= 0 || (hasWarning && stock <= p.warningStock!)) {
          priority = 'Crítico';
        } else if (hasWarning && stock <= p.warningStock! + 2) {
          priority = 'Por reponer';
        }

        // Lógica de cálculo de cantidad
        if (priority !== 'OK') {
          if (p.buyByCase && p.unitsPerCase && p.unitsPerCase > 0) {
            // SI COMPRA POR CAJA: Sugerir máximo 1 caja siempre que necesite reponer
            suggestedQty = 1;
            reason = hasIdeal ? "Meta: Nivel Ideal" : "Reponer Stock Seguro";
          } else {
            // REPOSICIÓN NORMAL (Por Unidades)
            if (hasIdeal) {
              suggestedQty = Math.max(0, p.idealStock! - stock);
              reason = "Meta: Nivel Ideal";
            } else {
              if (rotation === 'Alta') {
                suggestedQty = Math.ceil(dailyAvg * 14);
                reason = "Urgente: Alta Demanda";
              } else if (rotation === 'Media') {
                suggestedQty = Math.max(3, Math.ceil(dailyAvg * 7));
                reason = "Reponer: Venta Normal";
              } else {
                suggestedQty = 1;
                reason = "Mínimo: Baja Rotación";
              }
            }
          }
        }

        return {
          ...p,
          priority,
          rotation,
          totalSold,
          suggestedQty: Math.max(0, suggestedQty),
          reason
        };
      })
      .sort((a, b) => {
        const order = { 'Crítico': 0, 'Por reponer': 1, 'OK': 2 };
        return order[a.priority as Priority] - order[b.priority as Priority];
      });
  }, [products, salesMap]);

  const filtered = useMemo(() => {
    return analysis.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || String(p.id).includes(q);
      const matchesCategory = categoryFilter === 'all' || (p.category || "General") === categoryFilter;
      const matchesDistributor = distributorFilter === 'all' || (p.distributor || "Sin Distribuidor") === distributorFilter;
      
      let matchesPriority = true;
      if (priorityFilter === 'suggestions') {
        matchesPriority = p.priority !== 'OK' && p.suggestedQty > 0;
      } else if (priorityFilter !== 'all') {
        matchesPriority = p.priority === priorityFilter;
      }

      const matchesRotation = rotationFilter === 'all' || p.rotation === rotationFilter;
      return matchesSearch && matchesCategory && matchesDistributor && matchesPriority && matchesRotation;
    });
  }, [analysis, categoryFilter, distributorFilter, searchTerm, priorityFilter, rotationFilter]);

  const generateSummaryText = (itemsToShare: any[], groupName?: string) => {
    if (itemsToShare.length === 0) return "";
    let text = `*COMPRA SUGERIDA*\n${groupName ? `*${groupName}*\n` : ''}----------------------------\n`;
    
    itemsToShare.forEach(p => {
      if (p.suggestedQty > 0) {
        const format = p.buyByCase ? "Caja" : "u.";
        text += `- ${p.suggestedQty}${format} x ${p.name}\n`;
      }
    });
    return text;
  };

  const handleWhatsApp = (itemsToShare?: any[], groupName?: string) => {
    const list = itemsToShare || (selectedIds.length > 0 ? filtered.filter(i => selectedIds.includes(i.id)) : filtered);
    if (list.length === 0) {
      toast({ title: "Nada seleccionado", variant: "destructive" });
      return;
    }
    const text = encodeURIComponent(generateSummaryText(list, groupName));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: any) => (
    <Card key={p.id} className={cn("border-none shadow-sm rounded-2xl mb-2 bg-white")}>
      <div className="p-3 flex items-center gap-3">
        <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} />
        
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", 
          p.priority === 'Crítico' ? "bg-red-100 text-red-600" : p.priority === 'Por reponer' ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
        )}>
          {p.buyByCase ? <Box className="w-5 h-5" /> : <Package className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-xs uppercase text-slate-800 truncate pr-2">{p.name}</h4>
            <Badge className={cn("text-[8px] font-black uppercase h-4", 
              p.priority === 'Crítico' ? "bg-red-600" : p.priority === 'Por reponer' ? "bg-amber-600" : "bg-green-600"
            )}>{p.priority}</Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="flex gap-1 items-center bg-slate-50 px-1.5 py-0.5 rounded border">
              <span className="text-[8px] font-black text-slate-400 uppercase">Stock:</span>
              <span className="text-[9px] font-black">{p.stock}u.</span>
            </div>
            {p.idealStock > 0 && <span className="text-[8px] font-bold text-primary uppercase">Meta: {p.idealStock}</span>}
            {p.warningStock > 0 && <span className="text-[8px] font-bold text-destructive uppercase">Aviso: {p.warningStock}</span>}
            {p.buyByCase && <Badge variant="outline" className="text-[7px] font-black bg-blue-50 text-blue-600 border-blue-100">Caja ({p.unitsPerCase}u)</Badge>}
          </div>

          <div className="flex justify-between items-center mt-2">
            <p className="text-[9px] font-black text-primary uppercase tracking-tighter"><Sparkles className="w-3 h-3 inline mr-1" /> {p.reason}</p>
            {p.suggestedQty > 0 && (
              <Badge className="bg-primary text-white font-black text-[10px] px-2 py-1">
                Pedir: {p.suggestedQty} {p.buyByCase ? "Caja" : "u."}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 p-4 border-b space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Sugerencias de Compra
            </h3>
            <Button className="bg-green-600 text-white font-black h-9 rounded-xl text-[10px] uppercase gap-2" onClick={() => handleWhatsApp()}>
              <Send className="w-4 h-4" /> Enviar WhatsApp
            </Button>
          </div>
          <div className="space-y-3">
            <Input className="h-11 bg-white rounded-xl font-bold border-none shadow-sm" placeholder="Buscar producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-fit bg-white border-none h-8 font-black text-[9px] rounded-lg shadow-sm uppercase"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="suggestions">Sugerencias</SelectItem>
                  <SelectItem value="all">Ver Todo</SelectItem>
                  <SelectItem value="Crítico">Crítico</SelectItem>
                  <SelectItem value="Por reponer">Por reponer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rotationFilter} onValueChange={setRotationFilter}>
                <SelectTrigger className="w-fit bg-white border-none h-8 font-black text-[9px] rounded-lg shadow-sm uppercase"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Rotación: Todo</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Baja">Baja</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-primary" onClick={() => setSelectedIds(filtered.map(f => f.id))}>Sel. Todo</Button>
              <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-destructive" onClick={() => setSelectedIds([])}>Limpiar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/30">
          <ScrollArea className="h-[500px]">
            {isLoadingSales ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto w-8 h-8 opacity-20" /></div> : filtered.map(renderProductItem)}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
