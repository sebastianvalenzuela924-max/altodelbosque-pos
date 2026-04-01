
"use client";

import { useMemo, useState } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Package, Send, Sparkles, Truck, Loader2, Box, ChevronRight, ListFilter, LayoutGrid, Search, Target, AlertTriangle } from "lucide-react";
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
        let suggestedQty = 0;
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

        if (stock <= 0 || (hasWarning && stock <= p.warningStock!)) {
          priority = 'Crítico';
        } else if (hasWarning && stock <= p.warningStock! + 2) {
          priority = 'Por reponer';
        }

        if (priority !== 'OK') {
          if (p.buyByCase && p.unitsPerCase && p.unitsPerCase > 0) {
            suggestedQty = 1;
            reason = hasIdeal ? "Meta: Nivel Ideal" : "Reponer Stock";
          } else {
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

  const summaryStats = useMemo(() => {
    return {
      criticos: analysis.filter(p => p.priority === 'Crítico').length,
      reponer: analysis.filter(p => p.priority === 'Por reponer').length,
      altaRot: analysis.filter(p => p.rotation === 'Alta').length,
      ok: analysis.filter(p => p.priority === 'OK').length,
    };
  }, [analysis]);

  const filtered = useMemo(() => {
    return analysis.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || String(p.id).includes(q);
      const matchesCategory = categoryFilter === 'all' || (p.category || "General") === categoryFilter;
      const matchesDistributor = distributorFilter === 'all' || (p.distributor || "Sin Distribuidora") === distributorFilter;
      
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

  const groupedData = useMemo(() => {
    if (viewMode === 'general') return { "General": filtered };
    
    const groups: Record<string, any[]> = {};
    filtered.forEach(p => {
      const key = viewMode === 'category' ? (p.category || "General") : (p.distributor || "Sin Distribuidora");
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [filtered, viewMode]);

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
              p.priority === 'Crítico' ? "bg-red-600" : p.priority === 'Por reponer' ? "bg-amber-600" : "bg-green-700"
            )}>{p.priority}</Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="flex gap-1 items-center bg-slate-50 px-1.5 py-0.5 rounded border">
              <span className="text-[8px] font-black text-slate-400 uppercase">Stock:</span>
              <span className="text-[9px] font-black">{p.stock}u.</span>
            </div>
            {p.idealStock > 0 && (
              <div className="flex gap-1 items-center bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                <Target className="w-2.5 h-2.5 text-primary" />
                <span className="text-[8px] font-bold text-primary uppercase">Meta: {p.idealStock}</span>
              </div>
            )}
            {p.warningStock > 0 && (
              <div className="flex gap-1 items-center bg-destructive/5 px-1.5 py-0.5 rounded border border-destructive/10">
                <AlertTriangle className="w-2.5 h-2.5 text-destructive" />
                <span className="text-[8px] font-bold text-destructive uppercase">Aviso: {p.warningStock}</span>
              </div>
            )}
            {p.price > 0 && <span className="text-[8px] font-bold text-slate-500 uppercase">P. Venta: ${Math.round(p.price).toLocaleString('es-CL')}</span>}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-600 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-between min-h-[140px]">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Críticos</span>
          <span className="text-5xl font-black font-mono tracking-tighter">{summaryStats.criticos}</span>
        </div>
        <div className="bg-amber-600 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-between min-h-[140px]">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Reponer</span>
          <span className="text-5xl font-black font-mono tracking-tighter">{summaryStats.reponer}</span>
        </div>
        <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-between min-h-[140px]">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Alta Rot.</span>
          <span className="text-5xl font-black font-mono tracking-tighter">{summaryStats.altaRot}</span>
        </div>
        <div className="bg-green-100 text-green-700 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between min-h-[140px]">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Estado OK</span>
          <span className="text-5xl font-black font-mono tracking-tighter">{summaryStats.ok}</span>
        </div>
      </div>

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

          <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1">
            <Button 
              variant={viewMode === 'general' ? 'default' : 'ghost'} 
              className="h-8 rounded-lg text-[9px] font-black uppercase"
              onClick={() => setViewMode('general')}
            ><LayoutGrid className="w-3 h-3 mr-1" /> General</Button>
            <Button 
              variant={viewMode === 'category' ? 'default' : 'ghost'} 
              className="h-8 rounded-lg text-[9px] font-black uppercase"
              onClick={() => setViewMode('category')}
            ><ListFilter className="w-3 h-3 mr-1" /> Categoría</Button>
            <Button 
              variant={viewMode === 'distributor' ? 'default' : 'ghost'} 
              className="h-8 rounded-lg text-[9px] font-black uppercase"
              onClick={() => setViewMode('distributor')}
            ><Truck className="w-3 h-3 mr-1" /> Distribuidora</Button>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-11 h-11 bg-white rounded-xl font-bold border-none shadow-sm" placeholder="Buscar producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-fit bg-white border-none h-8 font-black text-[9px] rounded-lg shadow-sm uppercase px-3"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="suggestions">Sugerencias</SelectItem>
                  <SelectItem value="all">Ver Todo</SelectItem>
                  <SelectItem value="Crítico">Crítico</SelectItem>
                  <SelectItem value="Por reponer">Por reponer</SelectItem>
                  <SelectItem value="OK">Productos OK</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rotationFilter} onValueChange={setRotationFilter}>
                <SelectTrigger className="w-fit bg-white border-none h-8 font-black text-[9px] rounded-lg shadow-sm uppercase px-3"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Rotación: Todo</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Baja">Baja</SelectItem>
                </SelectContent>
              </Select>
              {viewMode === 'category' && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-fit bg-white border-none h-8 font-black text-[9px] rounded-lg shadow-sm uppercase px-3"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas las Categorías</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {viewMode === 'distributor' && (
                <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                  <SelectTrigger className="w-fit bg-white border-none h-8 font-black text-[9px] rounded-lg shadow-sm uppercase px-3"><SelectValue placeholder="Distribuidora" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas las Distribuidoras</SelectItem>
                    {distributors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-1 ml-auto">
                <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-primary px-2" onClick={() => setSelectedIds(filtered.map(f => f.id))}>Sel. Todo</Button>
                <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-destructive px-2" onClick={() => setSelectedIds([])}>Limpiar</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/30">
          <ScrollArea className="h-[500px] w-full">
            {isLoadingSales ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <Loader2 className="animate-spin mx-auto w-8 h-8" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-bold uppercase text-[10px]">Sin coincidencias</div>
            ) : viewMode === 'general' ? (
              <div className="space-y-1">
                {filtered.map(renderProductItem)}
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {Object.entries(groupedData).map(([groupName, items]) => (
                  <AccordionItem key={groupName} value={groupName} className="border-none">
                    <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                      <div className="flex items-center px-4 py-3 bg-slate-50/50 justify-between">
                         <div className="flex items-center gap-3">
                           <Checkbox 
                              checked={items.every(i => selectedIds.includes(i.id))} 
                              onCheckedChange={(checked) => {
                                const groupIds = items.map(i => i.id);
                                if (checked) setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
                                else setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
                              }}
                           />
                           <AccordionTrigger className="p-0 hover:no-underline font-black text-xs uppercase text-slate-700 tracking-tighter">
                             {groupName} <Badge variant="outline" className="ml-2 text-[8px] bg-white">{items.length}</Badge>
                           </AccordionTrigger>
                         </div>
                         <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-green-600 gap-1" onClick={() => handleWhatsApp(items, groupName)}>
                           <Send className="w-3 h-3" /> WhatsApp
                         </Button>
                      </div>
                      <AccordionContent className="p-2 space-y-1">
                        {items.map(renderProductItem)}
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
