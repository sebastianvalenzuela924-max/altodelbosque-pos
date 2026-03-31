
"use client";

import { useMemo, useState } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, ArrowRight, CheckCircle2, Filter, Info, Package, Send, Sparkles, TrendingUp, Truck, ListFilter, Clock, ShoppingCart, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

interface SuggestionsViewProps {
  products: Product[];
  categories: string[];
  distributors: string[];
}

type Priority = 'Crítico' | 'Por reponer' | 'Sin rotación';
type ViewMode = 'general' | 'category' | 'distributor';

export function SuggestionsView({ products, categories, distributors }: SuggestionsViewProps) {
  const firestore = useFirestore();
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("general");

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"), limit(500));
  }, [firestore]);

  const { data: allSales } = useCollection(salesQuery);

  const analysis = useMemo(() => {
    if (!products) return [];

    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    
    const salesMap: Record<string, { d7: number, d14: number, d30: number }> = {};
    
    allSales?.forEach(sale => {
      const saleDate = sale.saleDateTime?.toDate?.()?.getTime() || 0;
      const diff = now - saleDate;
      
      sale.itemsSummary?.forEach((item: any) => {
        if (!item.id) return;
        if (!salesMap[item.id]) salesMap[item.id] = { d7: 0, d14: 0, d30: 0 };
        
        if (diff <= 7 * dayMs) salesMap[item.id].d7 += item.quantity;
        if (diff <= 14 * dayMs) salesMap[item.id].d14 += item.quantity;
        if (diff <= 30 * dayMs) salesMap[item.id].d30 += item.quantity;
      });
    });

    return products
      .filter(p => p.status !== 'inactive')
      .map(p => {
        const sales = salesMap[p.id] || { d7: 0, d14: 0, d30: 0 };
        const rotationScore = (sales.d7 / 7 * 0.5) + (sales.d14 / 14 * 0.3) + (sales.d30 / 30 * 0.2);
        
        let priority: Priority | 'Ignore' = 'Ignore';
        let reason = "";
        let suggestedQty = 0;

        const stock = p.stock || 0;
        const hasWarning = p.warningStock !== undefined && p.warningStock !== null && p.warningStock > 0;
        const hasIdeal = p.idealStock !== undefined && p.idealStock !== null && p.idealStock > 0;

        if (stock <= 0) {
          priority = 'Crítico';
          reason = "Sin stock o negativo";
          suggestedQty = hasIdeal ? p.idealStock! : (hasWarning ? p.warningStock! * 2 : 5);
        } else if (hasWarning && stock <= p.warningStock!) {
          priority = 'Crítico';
          reason = "Bajo nivel de aviso";
          suggestedQty = Math.max(p.warningStock! * 2, Math.ceil(rotationScore * 14));
        }

        if (priority === 'Ignore' && stock > 0) {
           if (hasWarning) {
              if (stock <= p.warningStock! + 2) {
                 priority = 'Por reponer';
                 reason = `Cerca del umbral de aviso (+${stock - p.warningStock!})`;
                 suggestedQty = Math.max(5, Math.ceil(rotationScore * 10));
              }
           } else if (hasIdeal) {
              if (stock < p.idealStock! * 0.6) {
                 priority = 'Por reponer';
                 reason = "Bajo nivel respecto al ideal";
                 suggestedQty = Math.max(0, p.idealStock! - stock);
              }
           }
        }

        if (priority === 'Ignore' && sales.d30 === 0 && (hasWarning || hasIdeal)) {
          priority = 'Sin rotación';
          reason = "Sin ventas en 30 días";
        }

        return {
          ...p,
          priority,
          reason,
          suggestedQty: Math.max(0, suggestedQty),
          rotationScore,
          salesRecent: sales.d7
        };
      })
      .filter(p => p.priority !== 'Ignore')
      .filter(p => priorityFilter === 'all' || p.priority === priorityFilter)
      .sort((a, b) => {
        const order = { 'Crítico': 0, 'Por reponer': 1, 'Sin rotación': 2 };
        return order[a.priority as Priority] - order[b.priority as Priority];
      });
  }, [products, allSales, priorityFilter]);

  const filtered = useMemo(() => {
    return analysis.filter(p => {
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesDistributor = distributorFilter === 'all' || p.distributor === distributorFilter;
      return matchesCategory && matchesDistributor;
    });
  }, [analysis, categoryFilter, distributorFilter]);

  const summary = useMemo(() => {
    return {
      critical: analysis.filter(p => p.priority === 'Crítico').length,
      restock: analysis.filter(p => p.priority === 'Por reponer').length,
      noRotation: analysis.filter(p => p.priority === 'Sin rotación').length,
      distributors: new Set(analysis.filter(p => p.priority !== 'Sin rotación').map(p => p.distributor)).size
    };
  }, [analysis]);

  const generateSummaryText = (itemsToShare: any[], groupName?: string) => {
    if (itemsToShare.length === 0) return "";

    let header = `*RESUMEN DE COMPRA SUGERIDA*\n`;
    if (groupName) header += `*${groupName}*\n`;
    header += `----------------------------\n`;

    const grouped: Record<string, any[]> = {};
    itemsToShare.forEach(p => {
      const dist = p.distributor || "General";
      if (!grouped[dist]) grouped[dist] = [];
      grouped[dist].push(p);
    });

    let text = header;
    Object.entries(grouped).forEach(([dist, items]) => {
      if (!groupName) text += `*📦 Distribuidor: ${dist}*\n`;
      items.forEach(i => {
        if (i.priority !== 'Sin rotación') {
          text += `- ${i.suggestedQty}u. x ${i.name} (St: ${i.stock})\n`;
        } else {
          text += `- (REVISAR) ${i.name} [Sin rotación]\n`;
        }
      });
      text += "\n";
    });
    
    text += `Total productos: ${itemsToShare.length}`;
    return text;
  };

  const handleWhatsApp = (itemsToShare?: any[], groupName?: string) => {
    const list = itemsToShare || filtered;
    const text = encodeURIComponent(generateSummaryText(list, groupName));
    if (!text) return;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: any) => (
    <Card key={p.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden rounded-2xl bg-white mb-2">
      <div className="p-3 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            "w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0",
            p.priority === 'Crítico' ? "bg-red-100 text-red-600" : 
            p.priority === 'Por reponer' ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
          )}>
            {p.priority === 'Crítico' ? <AlertCircle className="w-5 h-5 md:w-6 md:h-6" /> : <Package className="w-5 h-5 md:w-6 md:h-6" />}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-[10px] md:text-xs uppercase text-slate-800 truncate leading-none">{p.name}</h4>
            <div className="flex gap-2 mt-1">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 px-1 rounded">{p.distributor || 'Sin Prov.'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6 shrink-0 text-right">
          <div className="flex flex-col items-end">
            <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Stock</p>
            <div className="flex items-center gap-1">
              <span className={cn("font-black text-[10px] md:text-xs", p.stock <= 0 ? "text-red-600" : "text-slate-800")}>{p.stock}</span>
              <span className="text-[8px] text-slate-400">/ {p.warningStock || p.idealStock || 0}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">
            <p className="text-[7px] font-black text-primary uppercase leading-none mb-1">Pedir</p>
            <span className="font-black text-xs md:text-sm text-primary">+{p.suggestedQty}</span>
          </div>

          <div className="flex flex-col items-end min-w-[70px] md:min-w-[90px]">
            <Badge className={cn(
              "text-[7px] md:text-[8px] font-black uppercase rounded-lg px-1.5 py-0.5 border-none mb-1",
              p.priority === 'Crítico' ? "bg-red-600 text-white" : p.priority === 'Por reponer' ? "bg-amber-600 text-white" : "bg-slate-400 text-white"
            )}>{p.priority}</Badge>
            <p className="text-[7px] font-bold text-slate-400 italic max-w-[80px] md:max-w-[110px] leading-tight text-right truncate">
              {p.reason}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  const activeGroups = useMemo(() => {
    const groups = viewMode === 'distributor' ? distributors : categories;
    return groups.filter(g => filtered.some(p => (viewMode === 'distributor' ? (p.distributor || "General") : (p.category || "General")) === g));
  }, [distributors, categories, filtered, viewMode]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm bg-red-600 text-white rounded-2xl">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-white/70 font-black text-[9px] uppercase tracking-widest">Críticos</CardDescription>
            <CardTitle className="text-2xl font-black">{summary.critical}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-amber-600 text-white rounded-2xl">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-white/70 font-black text-[9px] uppercase tracking-widest">Por reponer</CardDescription>
            <CardTitle className="text-2xl font-black">{summary.restock}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-slate-500 text-white rounded-2xl">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-white/70 font-black text-[9px] uppercase tracking-widest">Sin rotación</CardDescription>
            <CardTitle className="text-2xl font-black">{summary.noRotation}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-accent text-white rounded-2xl">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-white/70 font-black text-[9px] uppercase tracking-widest">Proveedores</CardDescription>
            <CardTitle className="text-2xl font-black">{summary.distributors}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 p-4 border-b space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Sugerencias de Compra
            </h3>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl font-bold gap-2 text-[10px] md:text-xs" onClick={() => setViewMode(viewMode === 'general' ? 'distributor' : viewMode === 'distributor' ? 'category' : 'general')}>
                <ListFilter className="w-4 h-4" /> 
                {viewMode === 'general' ? 'Vista Lista' : viewMode === 'distributor' ? 'Por Distribuidor' : 'Por Categoría'}
              </Button>
              <Button className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 h-10 rounded-xl font-black gap-2 text-[10px] md:text-xs text-white" onClick={() => handleWhatsApp()}>
                <Send className="w-4 h-4" /> Enviar Todo
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Crítico">Crítico</SelectItem>
                <SelectItem value="Por reponer">Por reponer</SelectItem>
                <SelectItem value="Sin rotación">Sin rotación</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Categorías</SelectItem>
                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={distributorFilter} onValueChange={setDistributorFilter}>
              <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Proveedores</SelectItem>
                {distributors.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/30">
          <ScrollArea className="h-[500px] w-full pr-4">
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-100" />
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nada que reponer</h3>
                <p className="text-xs text-slate-400">Prueba cambiando los filtros.</p>
              </div>
            ) : viewMode === 'general' ? (
              <div className="space-y-1">
                {filtered.map(renderProductItem)}
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {activeGroups.map(group => {
                   const groupItems = filtered.filter(p => (viewMode === 'distributor' ? (p.distributor || "General") : (p.category || "General")) === group);
                   return (
                    <AccordionItem key={group} value={group} className="border-none">
                      <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-100/50 pr-4">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline font-black text-[10px] uppercase text-slate-600 flex-1 justify-start">
                            <div className="flex items-center gap-2">
                              {viewMode === 'distributor' ? <Truck className="w-4 h-4 text-primary" /> : <ListFilter className="w-4 h-4 text-primary" />}
                              <span>{group}</span>
                              <Badge variant="outline" className="ml-2 bg-white text-[8px] border-slate-200">
                                {groupItems.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWhatsApp(groupItems, group);
                            }}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                        <AccordionContent className="p-2 pb-0">
                          <div className="space-y-1">
                            {groupItems.map(renderProductItem)}
                          </div>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                   );
                })}
              </Accordion>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
