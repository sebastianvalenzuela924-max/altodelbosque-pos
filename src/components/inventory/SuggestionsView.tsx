
"use client";

import { useMemo, useState } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Package, Send, Sparkles, Truck, Loader2, ListFilter, LayoutGrid, Search, Target, AlertTriangle, Box, Check } from "lucide-react";
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
          const key = String(item.id).trim();
          const current = map.get(key) || 0;
          map.set(key, current + (item.quantity || 0));
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

        const hasIdeal = p.idealStock !== undefined && p.idealStock !== null && p.idealStock > 0;
        const hasWarning = p.warningStock !== undefined && p.warningStock !== null && p.warningStock > 0;

        if (!hasIdeal && !hasWarning) {
          return { ...p, priority: 'OK' as Priority, rotation: 'Ninguna' as RotationType, totalSold: 0, suggestedQty: 0, reason: "Sin alertas" };
        }

        if (stock <= (p.warningStock || 0)) {
          priority = 'Crítico';
        } else if (hasWarning && stock <= p.warningStock! + 2) {
          priority = 'Por reponer';
        } else if (hasIdeal && stock < p.idealStock!) {
          priority = 'Por reponer';
        }

        if (totalSold >= 15) rotation = 'Alta';
        else if (totalSold >= 3) rotation = 'Media';
        else if (totalSold > 0) rotation = 'Baja';

        if (priority !== 'OK') {
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
              suggestedQty = 2;
              reason = "Mínimo: Baja Rotación";
            }
          }
        }

        if (hasIdeal && stock >= p.idealStock!) {
          priority = 'OK';
          suggestedQty = 0;
          reason = "Stock OK";
        }

        return { ...p, priority, rotation, totalSold, suggestedQty: Math.max(0, Math.round(suggestedQty)), reason };
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
    return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
  }, [filtered, viewMode]);

  const generateSummaryText = (itemsToShare: any[], groupName?: string) => {
    if (itemsToShare.length === 0) return "";
    let text = `*COMPRA SUGERIDA*\n${groupName ? `*${groupName}*\n` : ''}----------------------------\n`;
    itemsToShare.forEach(p => {
      if (p.suggestedQty > 0) {
        text += `- ${p.suggestedQty}u.   ${p.name} (${Math.round(p.price).toLocaleString('es-CL')}$) Stock:${p.stock}\n`;
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
    <Card key={p.id} className="border-none shadow-sm rounded-2xl mb-2 bg-white overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <Checkbox 
          checked={selectedIds.includes(p.id)} 
          onCheckedChange={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} 
        />
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", 
          p.priority === 'Crítico' ? "bg-red-100 text-red-600" : p.priority === 'Por reponer' ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-700"
        )}>
          <Package className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-bold text-xs uppercase text-slate-800 break-words flex-1 leading-tight">{p.name}</h4>
            <Badge className={cn("text-[8px] font-black uppercase h-4 shrink-0", 
              p.priority === 'Crítico' ? "bg-red-600 text-white" : p.priority === 'Por reponer' ? "bg-amber-600 text-white" : "bg-green-700 text-white"
            )}>{p.priority}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <div className="flex gap-1 items-center bg-slate-50 px-1.5 py-0.5 rounded border">
              <span className="text-[8px] font-black text-slate-400 uppercase">Stock:</span>
              <span className="text-[9px] font-black">{p.stock}u.</span>
            </div>
            <div className="flex gap-1 items-center bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
              <span className="text-[8px] font-black text-primary uppercase">PVP: ${Math.round(p.price).toLocaleString('es-CL')}</span>
            </div>
            {(p.idealStock > 0 || p.warningStock > 0) && (
              <div className="flex gap-1 items-center bg-slate-50 px-1.5 py-0.5 rounded border">
                <span className="text-[8px] font-black text-slate-400 uppercase">
                  {p.idealStock > 0 ? "Ideal:" : "Aviso:"}
                </span>
                <span className="text-[9px] font-black">{p.idealStock || p.warningStock}u.</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
            <p className="text-[9px] font-black text-primary uppercase tracking-tighter flex items-center gap-1"><Sparkles className="w-3 h-3" /> {p.reason}</p>
            {p.suggestedQty > 0 && (
              <Badge className="bg-primary text-white font-black text-[10px] px-2 py-1 rounded-lg">Pedir: {p.suggestedQty} u.</Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-2">
        <button 
          onClick={() => {
            setPriorityFilter(priorityFilter === 'Crítico' ? 'suggestions' : 'Crítico');
            setRotationFilter('all');
          }} 
          className={cn("text-white py-1.5 rounded-xl flex flex-col items-center transition-all", priorityFilter === 'Crítico' ? "bg-red-600 ring-2 ring-red-400" : "bg-red-600/90")}
        >
          <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Críticos</span>
          <span className="text-sm font-black font-mono mt-0.5">{summaryStats.criticos}</span>
        </button>
        <button 
          onClick={() => {
            setPriorityFilter(priorityFilter === 'Por reponer' ? 'suggestions' : 'Por reponer');
            setRotationFilter('all');
          }} 
          className={cn("text-white py-1.5 rounded-xl flex flex-col items-center transition-all", priorityFilter === 'Por reponer' ? "bg-amber-600 ring-2 ring-amber-400" : "bg-amber-600/90")}
        >
          <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Reponer</span>
          <span className="text-sm font-black font-mono mt-0.5">{summaryStats.reponer}</span>
        </button>
        <button 
          onClick={() => {
            const isActivating = rotationFilter !== 'Alta';
            setRotationFilter(isActivating ? 'Alta' : 'all');
            setPriorityFilter(isActivating ? 'all' : 'suggestions');
          }} 
          className={cn("text-white py-1.5 rounded-xl flex flex-col items-center transition-all", rotationFilter === 'Alta' ? "bg-blue-600 ring-2 ring-blue-400" : "bg-blue-600/90")}
        >
          <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Alta Rot.</span>
          <span className="text-sm font-black font-mono mt-0.5">{summaryStats.altaRot}</span>
        </button>
        <button 
          onClick={() => {
            setPriorityFilter(priorityFilter === 'OK' ? 'suggestions' : 'OK');
            setRotationFilter('all');
          }} 
          className={cn("py-1.5 rounded-xl flex flex-col items-center border transition-all", priorityFilter === 'OK' ? "bg-green-100 text-green-700 ring-2 ring-green-400" : "bg-green-100 text-green-700")}
        >
          <span className="text-[7px] font-black uppercase tracking-wider opacity-80">Estado OK</span>
          <span className="text-sm font-black font-mono mt-0.5">{summaryStats.ok}</span>
        </button>
      </div>

      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 p-4 border-b space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-500 uppercase flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Sugerencias de Compra</h3>
            <Button className="bg-green-600 text-white font-black h-9 rounded-xl text-[10px] uppercase gap-2" onClick={() => handleWhatsApp()}>
              <Send className="w-4 h-4" /> Enviar WSP
            </Button>
          </div>
          <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1">
            <Button variant={viewMode === 'general' ? 'default' : 'ghost'} className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => setViewMode('general')}><LayoutGrid className="w-3 h-3 mr-1" /> General</Button>
            <Button variant={viewMode === 'category' ? 'default' : 'ghost'} className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => setViewMode('category')}><ListFilter className="w-3 h-3 mr-1" /> Categoría</Button>
            <Button variant={viewMode === 'distributor' ? 'default' : 'ghost'} className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => setViewMode('distributor')}><Truck className="w-3 h-3 mr-1" /> Distribuidora</Button>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-11 h-11 bg-white rounded-xl border-none shadow-sm" placeholder="Buscar producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-fit bg-white h-8 text-[9px] rounded-lg uppercase px-3"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="suggestions">Sugerencias</SelectItem><SelectItem value="all">Ver Todo</SelectItem><SelectItem value="Crítico">Crítico</SelectItem><SelectItem value="Por reponer">Por reponer</SelectItem><SelectItem value="OK">OK</SelectItem></SelectContent>
              </Select>
              <div className="flex gap-1 ml-auto">
                <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-primary" onClick={() => setSelectedIds(filtered.map(f => f.id))}>Todos</Button>
                <Button variant="ghost" className="h-8 text-[9px] font-black uppercase text-destructive" onClick={() => setSelectedIds([])}>Limpiar</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/30">
          <ScrollArea className="h-[500px] w-full">
            {viewMode === 'general' ? (
              <div className="space-y-1">{filtered.map(renderProductItem)}</div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {Object.entries(groupedData).map(([groupName, items]) => (
                  <AccordionItem key={groupName} value={groupName} className="border-none">
                    <AccordionTrigger asChild className="p-0 hover:no-underline w-full">
                      <div className="flex items-center px-4 py-3 bg-slate-50/50 justify-between w-full cursor-pointer rounded-xl">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Checkbox checked={items.every(i => selectedIds.includes(i.id))} onCheckedChange={(checked) => {
                            const ids = items.map(i => i.id);
                            setSelectedIds(prev => checked ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id)));
                          }} onClick={(e) => e.stopPropagation()} />
                          <span className="font-black text-xs uppercase text-slate-700 truncate text-left">{groupName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Badge variant="outline" className="text-[8px] font-black bg-white border-slate-200">{items.length}</Badge>
                          <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-green-600 gap-1" onClick={(e) => { e.stopPropagation(); handleWhatsApp(items, groupName); }}>
                            <Send className="w-3 h-3" /> WSP
                          </Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-2 space-y-1">{items.map(renderProductItem)}</AccordionContent>
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
