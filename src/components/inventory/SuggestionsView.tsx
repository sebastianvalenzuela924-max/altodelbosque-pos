
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

type Priority = 'Crítico' | 'Comprar Pronto' | 'Vigilar' | 'Sin Rotación';
type ViewMode = 'general' | 'category' | 'distributor';

export function SuggestionsView({ products, categories, distributors }: SuggestionsViewProps) {
  const firestore = useFirestore();
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("general");

  // Obtener ventas recientes para calcular rotación
  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"), limit(500));
  }, [firestore]);

  const { data: allSales } = useCollection(salesQuery);

  const analysis = useMemo(() => {
    if (!products) return [];

    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Mapeo de ventas por producto en ventanas de tiempo
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
        // Rotación ponderada (más peso a lo reciente)
        const rotationScore = (sales.d7 / 7 * 0.5) + (sales.d14 / 14 * 0.3) + (sales.d30 / 30 * 0.2);
        
        let priority: Priority = 'Sin Rotación';
        let reason = "";
        let suggestedQty = 0;

        const stock = p.stock || 0;
        const hasWarning = p.warningStock !== undefined && p.warningStock !== null && p.warningStock > 0;
        const hasIdeal = p.idealStock !== undefined && p.idealStock !== null && p.idealStock > 0;

        // REGLA DE ORO: Stock 0 o negativo siempre es Crítico
        if (stock <= 0) {
          priority = 'Crítico';
          reason = "Stock agotado o negativo";
          suggestedQty = hasIdeal ? p.idealStock! : (hasWarning ? p.warningStock! * 2 : Math.max(5, Math.ceil(rotationScore * 14)));
        } 
        // Lógica para productos con STOCK AVISO
        else if (hasWarning) {
          if (stock <= p.warningStock!) {
            priority = 'Crítico';
            reason = "Stock igual o menor al nivel de aviso";
            suggestedQty = Math.max(p.warningStock! * 2, Math.ceil(rotationScore * 14));
          } else if (stock === p.warningStock! + 1 || stock === p.warningStock! + 2) {
            priority = 'Comprar Pronto';
            reason = `Cerca del umbral de aviso (+${stock - p.warningStock!})`;
            suggestedQty = Math.ceil(rotationScore * 7);
          } else if (rotationScore > 1.5) {
            priority = 'Vigilar';
            reason = "Alta velocidad de venta";
            suggestedQty = Math.ceil(rotationScore * 7);
          }
        } 
        // Lógica para productos con STOCK IDEAL (y sin aviso)
        else if (hasIdeal) {
          if (stock < p.idealStock! * 0.25 && rotationScore > 0.2) {
            priority = 'Crítico';
            reason = "Stock muy por debajo del ideal con ventas";
            suggestedQty = p.idealStock! - stock;
          } else if (stock < p.idealStock! * 0.5) {
            priority = 'Comprar Pronto';
            reason = "Bajo nivel respecto al stock ideal";
            suggestedQty = p.idealStock! - stock;
          } else if (rotationScore > 2) {
            priority = 'Vigilar';
            reason = "Rotación acelerada";
            suggestedQty = Math.ceil(rotationScore * 7);
          }
        } 
        else {
          if (sales.d30 > 0 && stock < Math.ceil(rotationScore * 3)) {
            priority = 'Comprar Pronto';
            reason = "Riesgo de quiebre por rotación (sin umbrales)";
            suggestedQty = Math.max(5, Math.ceil(rotationScore * 14));
          }
        }

        if (sales.d30 === 0 && priority !== 'Crítico') {
          priority = 'Sin Rotación';
          reason = "Sin ventas en los últimos 30 días";
        }

        return {
          ...p,
          priority,
          reason,
          suggestedQty,
          rotationScore,
          salesRecent: sales.d7
        };
      })
      .filter(p => p.priority !== 'Sin Rotación' || (priorityFilter === 'Sin Rotación'))
      .sort((a, b) => {
        const order = { 'Crítico': 0, 'Comprar Pronto': 1, 'Vigilar': 2, 'Sin Rotación': 3 };
        return order[a.priority] - order[b.priority];
      });
  }, [products, allSales, priorityFilter]);

  const filtered = useMemo(() => {
    return analysis.filter(p => {
      const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesDistributor = distributorFilter === 'all' || p.distributor === distributorFilter;
      return matchesPriority && matchesCategory && matchesDistributor;
    });
  }, [analysis, priorityFilter, categoryFilter, distributorFilter]);

  const summary = useMemo(() => {
    return {
      critical: analysis.filter(p => p.priority === 'Crítico').length,
      buySoon: analysis.filter(p => p.priority === 'Comprar Pronto').length,
      watch: analysis.filter(p => p.priority === 'Vigilar').length,
      distributors: new Set(analysis.filter(p => p.priority !== 'Sin Rotación').map(p => p.distributor)).size
    };
  }, [analysis]);

  const generateSummaryText = () => {
    const grouped: Record<string, any[]> = {};
    filtered.forEach(p => {
      const dist = p.distributor || "General";
      if (!grouped[dist]) grouped[dist] = [];
      grouped[dist].push(p);
    });

    let text = "*RESUMEN DE COMPRA SUGERIDA*\n\n";
    Object.entries(grouped).forEach(([dist, items]) => {
      text += `*Distribuidor: ${dist}*\n`;
      items.forEach(i => {
        text += `- ${i.suggestedQty} x ${i.name}\n`;
      });
      text += "\n";
    });
    text += `Total productos: ${filtered.length}`;
    return text;
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generateSummaryText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: any) => (
    <Card key={p.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden rounded-2xl bg-white mb-2">
      <div className="p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            p.priority === 'Crítico' ? "bg-red-100 text-red-600" : 
            p.priority === 'Comprar Pronto' ? "bg-amber-100 text-amber-600" :
            p.priority === 'Vigilar' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
          )}>
            {p.priority === 'Crítico' ? <AlertCircle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-[10px] md:text-xs uppercase text-slate-800 truncate leading-none">{p.name}</h4>
            <div className="flex gap-2 mt-1">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 px-1 rounded">{p.category || 'General'}</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 px-1 rounded">{p.distributor || 'Sin Prov.'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6 shrink-0 text-right">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Stock Actual</p>
            <div className="flex items-center gap-1">
              <span className={cn("font-black text-xs", p.stock <= 0 ? "text-red-600" : "text-slate-800")}>{p.stock}</span>
              <span className="text-[8px] text-slate-400">/ {p.warningStock || p.idealStock || 0}</span>
            </div>
          </div>
          <div className="flex flex-col items-end bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">
            <p className="text-[7px] font-black text-primary uppercase leading-none mb-1">Pedir</p>
            <span className="font-black text-sm text-primary">+{p.suggestedQty}</span>
          </div>
          <div className="flex flex-col items-end min-w-[80px]">
            <Badge className={cn(
              "text-[8px] font-black uppercase rounded-lg px-1.5 py-0.5 border-none mb-1",
              p.priority === 'Crítico' ? "bg-red-600 text-white" : p.priority === 'Comprar Pronto' ? "bg-amber-600 text-white" : "bg-blue-600 text-white"
            )}>{p.priority}</Badge>
            <p className="text-[7px] md:text-[8px] font-bold text-slate-400 italic max-w-[100px] leading-tight text-right">
              {p.reason}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  const activeDistributors = useMemo(() => {
    return distributors.filter(d => filtered.some(p => (p.distributor || "General") === d));
  }, [distributors, filtered]);

  const activeCategories = useMemo(() => {
    return categories.filter(c => filtered.some(p => (p.category || "General") === c));
  }, [categories, filtered]);

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
            <CardDescription className="text-white/70 font-black text-[9px] uppercase tracking-widest">Comprar Pronto</CardDescription>
            <CardTitle className="text-2xl font-black">{summary.buySoon}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-blue-600 text-white rounded-2xl">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-white/70 font-black text-[9px] uppercase tracking-widest">Vigilar</CardDescription>
            <CardTitle className="text-2xl font-black">{summary.watch}</CardTitle>
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
              <TrendingUp className="w-4 h-4" /> Análisis de Compra
            </h3>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl font-bold gap-2 text-xs" onClick={() => setViewMode(viewMode === 'general' ? 'distributor' : viewMode === 'distributor' ? 'category' : 'general')}>
                <ListFilter className="w-4 h-4" /> 
                {viewMode === 'general' ? 'Lista General' : viewMode === 'distributor' ? 'Por Distribuidor' : 'Por Categoría'}
              </Button>
              <Button className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 h-10 rounded-xl font-black gap-2 text-xs text-white" onClick={handleWhatsApp}>
                <Send className="w-4 h-4" /> WhatsApp
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas las Prioridades</SelectItem>
                <SelectItem value="Crítico">Crítico</SelectItem>
                <SelectItem value="Comprar Pronto">Comprar Pronto</SelectItem>
                <SelectItem value="Vigilar">Vigilar</SelectItem>
                <SelectItem value="Sin Rotación">Sin Rotación</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas las Categorías</SelectItem>
                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={distributorFilter} onValueChange={setDistributorFilter}>
              <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                <SelectValue placeholder="Distribuidor" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos los Distribuidores</SelectItem>
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
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay compras sugeridas</h3>
                <p className="text-xs text-slate-400">El inventario está en niveles óptimos.</p>
              </div>
            ) : viewMode === 'general' ? (
              <div className="space-y-1">
                {filtered.map(renderProductItem)}
              </div>
            ) : viewMode === 'distributor' ? (
              <Accordion type="multiple" className="space-y-2">
                {activeDistributors.map(dist => (
                  <AccordionItem key={dist} value={dist} className="border-none">
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline font-black text-[10px] uppercase text-slate-600 bg-slate-100/50">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary" />
                          <span>{dist}</span>
                          <Badge variant="outline" className="ml-2 bg-white text-[8px] border-slate-200">
                            {filtered.filter(p => (p.distributor || "General") === dist).length} ítems
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-2 pb-0">
                        <div className="space-y-1">
                          {filtered.filter(p => (p.distributor || "General") === dist).map(renderProductItem)}
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {activeCategories.map(cat => (
                  <AccordionItem key={cat} value={cat} className="border-none">
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline font-black text-[10px] uppercase text-slate-600 bg-slate-100/50">
                        <div className="flex items-center gap-2">
                          <ListFilter className="w-4 h-4 text-primary" />
                          <span>{cat}</span>
                          <Badge variant="outline" className="ml-2 bg-white text-[8px] border-slate-200">
                            {filtered.filter(p => (p.category || "General") === cat).length} ítems
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-2 pb-0">
                        <div className="space-y-1">
                          {filtered.filter(p => (p.category || "General") === cat).map(renderProductItem)}
                        </div>
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

