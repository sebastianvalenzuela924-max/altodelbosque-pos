
"use client";

import { useMemo, useState } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Package, Send, Sparkles, Truck, ListFilter, Trash2, CheckSquare, Search, X, CheckCircle2, Info, Target, AlertTriangle, Loader2, ArrowUpDown } from "lucide-react";
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
}

interface SuggestionsViewProps {
  products: Product[];
  categories: string[];
  distributors: string[];
}

type Priority = 'Crítico' | 'Por reponer' | 'Sin rotación' | 'OK';
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

  // Consulta de ventas de los últimos 30 días para calcular rotación
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
      .filter(p => p.status !== 'inactive')
      .map(p => {
        let priority: Priority = 'OK';
        let suggestedQty = 0;
        let reason = "Stock normal";
        let rotation: RotationType = 'Ninguna';

        const stock = p.stock || 0;
        const totalSold = salesMap.get(String(p.id).trim()) || 0;
        const dailyAvg = totalSold / 30;

        if (totalSold >= 15) rotation = 'Alta';
        else if (totalSold >= 3) rotation = 'Media';
        else if (totalSold > 0) rotation = 'Baja';

        const hasIdeal = p.idealStock !== undefined && p.idealStock !== null && p.idealStock > 0;
        const hasWarning = p.warningStock !== undefined && p.warningStock !== null && p.warningStock > 0;

        // LÓGICA DE RECOMENDACIÓN INTELIGENTE
        if (stock <= 0 || (hasWarning && stock <= p.warningStock!)) {
          priority = 'Crítico';
          
          if (hasIdeal) {
            suggestedQty = Math.max(0, p.idealStock! - stock);
            reason = stock <= 0 ? "Stock en 0 (Meta: Ideal)" : "Bajo nivel de aviso (Meta: Ideal)";
          } else {
            // Lógica basada en rotación si no hay Ideal
            if (rotation === 'Alta') {
              suggestedQty = Math.ceil(dailyAvg * 14); // 2 semanas de stock
              reason = "Alta rotación (Reponer)";
            } else if (rotation === 'Media') {
              suggestedQty = Math.ceil(dailyAvg * 7) + 2; // 1 semana + seguridad
              reason = "Rotación media (Reponer)";
            } else if (rotation === 'Baja') {
              suggestedQty = 2;
              reason = "Baja rotación (Mínimo)";
            } else {
              suggestedQty = 1;
              reason = "Sin ventas (Mínimo)";
            }
          }
        } else if (hasWarning && stock <= p.warningStock! + (rotation === 'Alta' ? 5 : 2)) {
          priority = 'Por reponer';
          
          if (hasIdeal) {
            suggestedQty = Math.ceil((p.idealStock! - stock) * 0.5);
            reason = "Cerca de aviso (Meta: Ideal)";
          } else {
            if (rotation === 'Alta') {
              suggestedQty = Math.ceil(dailyAvg * 7);
              reason = "Alta rotación (Preventivo)";
            } else if (rotation === 'Media') {
              suggestedQty = 3;
              reason = "Rotación media (Preventivo)";
            } else {
              suggestedQty = 0;
              reason = "Baja rotación (Ok)";
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
        const order = { 'Crítico': 0, 'Por reponer': 1, 'Sin rotación': 2, 'OK': 3 };
        const pOrder = order[a.priority as Priority] - order[b.priority as Priority];
        if (pOrder !== 0) return pOrder;
        // Si tienen misma prioridad, poner arriba los de mayor rotación
        const rotOrder = { 'Alta': 0, 'Media': 1, 'Baja': 2, 'Ninguna': 3 };
        return rotOrder[a.rotation as RotationType] - rotOrder[b.rotation as RotationType];
      });
  }, [products, salesMap]);

  const filtered = useMemo(() => {
    return analysis.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || String(p.id).includes(q);
      
      const matchesCategory = categoryFilter === 'all' || (p.category || "General") === categoryFilter;
      const pDist = p.distributor?.trim() || "Sin Prov. (General)";
      const matchesDistributor = distributorFilter === 'all' || pDist === distributorFilter;
      
      let matchesPriority = true;
      if (priorityFilter === 'suggestions' && q === "") {
        matchesPriority = p.priority !== 'OK' && p.suggestedQty > 0;
      } else if (priorityFilter !== 'all' && priorityFilter !== 'suggestions') {
        matchesPriority = p.priority === priorityFilter;
      }

      const matchesRotation = rotationFilter === 'all' || p.rotation === rotationFilter;
      
      return matchesSearch && matchesCategory && matchesDistributor && matchesPriority && matchesRotation;
    });
  }, [analysis, categoryFilter, distributorFilter, searchTerm, priorityFilter, rotationFilter]);

  const summary = useMemo(() => {
    return {
      critical: analysis.filter(p => p.priority === 'Crítico').length,
      restock: analysis.filter(p => p.priority === 'Por reponer').length,
      highRotation: analysis.filter(p => p.rotation === 'Alta').length,
      ok: analysis.filter(p => p.priority === 'OK').length,
      distributors: new Set(analysis.map(p => p.distributor?.trim() || "Sin Prov. (General)")).size
    };
  }, [analysis]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allIds = filtered.map(p => p.id);
    setSelectedIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const generateSummaryText = (itemsToShare: any[], groupName?: string) => {
    if (itemsToShare.length === 0) return "";

    let header = `*RESUMEN DE COMPRA SUGERIDA*\n`;
    if (groupName) header += `*${groupName}*\n`;
    header += `----------------------------\n`;

    const grouped: Record<string, any[]> = {};
    itemsToShare.forEach(p => {
      const dist = p.distributor?.trim() || "Sin Prov. (General)";
      if (!grouped[dist]) grouped[dist] = [];
      grouped[dist].push(p);
    });

    let text = header;
    Object.entries(grouped).forEach(([dist, items]) => {
      if (!groupName) text += `*📦 Distribuidor: ${dist}*\n`;
      items.forEach(i => {
        if (i.suggestedQty > 0) {
          text += `- ${i.suggestedQty}u. x ${i.name} (St: ${i.stock}) [${i.reason}]\n`;
        }
      });
      text += "\n";
    });
    
    text += `Total productos: ${itemsToShare.length}`;
    return text;
  };

  const handleWhatsApp = (itemsToShare?: any[], groupName?: string) => {
    let listToShare = itemsToShare || filtered;
    
    if (selectedIds.length > 0 && !itemsToShare) {
      listToShare = filtered.filter(item => selectedIds.includes(item.id));
    } else if (!itemsToShare && selectedIds.length === 0) {
      toast({ 
        title: "Selección vacía", 
        description: "Selecciona al menos un producto para enviar.",
        variant: "destructive" 
      });
      return;
    }

    const text = encodeURIComponent(generateSummaryText(listToShare, groupName));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const renderProductItem = (p: any) => (
    <Card key={p.id} className={cn(
      "border-none shadow-sm hover:shadow-md transition-all overflow-hidden rounded-2xl mb-2",
      selectedIds.includes(p.id) ? "bg-primary/5 ring-1 ring-primary/20" : "bg-white",
      p.priority === 'OK' && "opacity-80"
    )}>
      <div className="p-3 flex items-center gap-3">
        <div className="shrink-0">
          <Checkbox 
            checked={selectedIds.includes(p.id)} 
            onCheckedChange={() => toggleSelection(p.id)}
            className="w-5 h-5 rounded-lg border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        <div className={cn(
          "w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0",
          p.priority === 'Crítico' ? "bg-red-100 text-red-600" : 
          p.priority === 'Por reponer' ? "bg-amber-100 text-amber-600" : 
          p.priority === 'OK' ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
        )}>
          {p.priority === 'Crítico' ? <AlertCircle className="w-5 h-5 md:w-6 md:h-6" /> : 
           p.priority === 'OK' ? <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" /> : <Package className="w-5 h-5 md:w-6 md:h-6" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-start gap-2 mb-1">
            <div className="flex flex-col">
              <h4 className="font-bold text-[11px] md:text-xs uppercase text-slate-800 leading-tight">
                {p.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className={cn(
                  "text-[7px] font-black uppercase py-0 px-1 border-none",
                  p.rotation === 'Alta' ? "bg-primary/10 text-primary" : 
                  p.rotation === 'Media' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                )}>
                  Rotación {p.rotation}
                </Badge>
                <span className="text-[10px] font-black text-primary font-mono">${Math.round(p.price).toLocaleString('es-CL')}</span>
              </div>
            </div>
            <Badge className={cn(
              "text-[7px] md:text-[8px] font-black uppercase rounded-lg px-1.5 py-0.5 border-none h-4 shrink-0",
              p.priority === 'Crítico' ? "bg-red-600 text-white" : 
              p.priority === 'Por reponer' ? "bg-amber-600 text-white" : 
              p.priority === 'OK' ? "bg-green-600 text-white" : "bg-slate-400 text-white"
            )}>{p.priority}</Badge>
          </div>
          
          <p className="text-[9px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Info className="w-3 h-3 text-primary" /> {p.reason}
          </p>
          
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
              <span className="text-[7px] font-black text-slate-400 uppercase">Stock:</span>
              <span className={cn("text-[8px] font-black", p.stock <= 0 ? "text-red-600" : "text-slate-800")}>{p.stock}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {p.warningStock > 0 && (
                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                  <span className="text-[7px] font-black text-amber-600 uppercase">Aviso:</span>
                  <span className="text-[8px] font-black text-amber-700">{p.warningStock}</span>
                </div>
              )}
              {p.idealStock > 0 && (
                <div className="flex items-center gap-1 bg-primary/5 px-1.5 py-0.5 rounded-md border border-primary/10">
                  <Target className="w-2.5 h-2.5 text-primary" />
                  <span className="text-[7px] font-black text-primary uppercase">Ideal:</span>
                  <span className="text-[8px] font-black text-primary">{p.idealStock}</span>
                </div>
              )}
            </div>

            {p.suggestedQty > 0 && (
              <div className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20">
                <span className="text-[7px] font-black text-primary uppercase">Pedir:</span>
                <span className="text-[8px] font-black text-primary">+{p.suggestedQty}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  const activeGroups = useMemo(() => {
    const currentGroups = new Set(filtered.map(p => {
      if (viewMode === 'distributor') return p.distributor?.trim() || "Sin Prov. (General)";
      if (viewMode === 'category') return p.category || "General";
      return "";
    }));
    return Array.from(currentGroups).filter(g => g !== "").sort();
  }, [filtered, viewMode]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-none shadow-sm bg-red-600 text-white rounded-2xl">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-white/70 font-black text-[8px] uppercase tracking-widest">Críticos</CardDescription>
            <CardTitle className="text-xl font-black">{summary.critical}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-amber-600 text-white rounded-2xl">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-white/70 font-black text-[8px] uppercase tracking-widest">Reponer</CardDescription>
            <CardTitle className="text-xl font-black">{summary.restock}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-primary text-white rounded-2xl">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-white/70 font-black text-[8px] uppercase tracking-widest">Alta Rot.</CardDescription>
            <CardTitle className="text-xl font-black">{summary.highRotation}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-green-600/30 text-green-800 rounded-2xl">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-green-800/60 font-black text-[8px] uppercase tracking-widest">Estado OK</CardDescription>
            <CardTitle className="text-xl font-black">{summary.ok}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-accent text-white rounded-2xl hidden lg:block">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-white/70 font-black text-[8px] uppercase tracking-widest">Distribuidores</CardDescription>
            <CardTitle className="text-xl font-black">{summary.distributors}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 p-4 border-b space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Sugerencias Inteligentes
              </h3>
              {selectedIds.length > 0 && (
                <p className="text-[10px] font-black text-primary uppercase animate-in slide-in-from-left-2">
                  {selectedIds.length} seleccionados
                </p>
              )}
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 rounded-xl font-bold gap-2 text-[10px] md:text-xs" onClick={() => setViewMode(viewMode === 'general' ? 'distributor' : viewMode === 'distributor' ? 'category' : 'general')}>
                <ListFilter className="w-4 h-4" /> 
                {viewMode === 'general' ? 'Lista' : viewMode === 'distributor' ? 'Distribuidor' : 'Categoría'}
              </Button>
              <Button 
                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 h-10 rounded-xl font-black gap-2 text-[10px] md:text-xs text-white" 
                onClick={() => handleWhatsApp()}
                disabled={isLoadingSales}
              >
                {isLoadingSales ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                className="pl-11 h-12 bg-white rounded-2xl border-none shadow-sm font-bold text-sm" 
                placeholder="Buscar por nombre o código..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border mr-2">
                <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase px-2 hover:bg-primary/5" onClick={handleSelectAll}>
                  Todo
                </Button>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase px-2 hover:bg-destructive/5" onClick={handleClearSelection}>
                  Limpiar
                </Button>
              </div>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                  <SelectValue placeholder="Ver Estados" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="suggestions">Sugerencias (Auto)</SelectItem>
                  <SelectItem value="all">Ver Todos</SelectItem>
                  <SelectItem value="Crítico">Crítico</SelectItem>
                  <SelectItem value="Por reponer">Por reponer</SelectItem>
                  <SelectItem value="OK">Estado OK</SelectItem>
                </SelectContent>
              </Select>

              <Select value={rotationFilter} onValueChange={setRotationFilter}>
                <SelectTrigger className="w-fit bg-white border-none h-9 font-bold text-[10px] rounded-xl shadow-sm px-4">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-primary" />
                  <SelectValue placeholder="Rotación" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todas las Rot.</SelectItem>
                  <SelectItem value="Alta">Alta Rotación</SelectItem>
                  <SelectItem value="Media">Rotación Media</SelectItem>
                  <SelectItem value="Baja">Baja Rotación</SelectItem>
                  <SelectItem value="Ninguna">Sin Rotación</SelectItem>
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/30">
          <ScrollArea className="h-[500px] w-full">
            {isLoadingSales ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest">Analizando ventas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-100" />
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin resultados</h3>
                <p className="text-xs text-slate-400">Prueba ajustando los filtros o la búsqueda.</p>
              </div>
            ) : viewMode === 'general' ? (
              <div className="space-y-1">
                {filtered.map(renderProductItem)}
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {activeGroups.map(group => {
                   const groupItems = filtered.filter(p => {
                      const pGroup = viewMode === 'distributor' ? (p.distributor?.trim() || "Sin Prov. (General)") : (p.category || "General");
                      return pGroup === group;
                   });
                   const selectedInGroup = groupItems.filter(p => selectedIds.includes(p.id));
                   
                   return (
                    <AccordionItem key={group} value={group} className="border-none">
                      <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-100/50 pr-4">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline font-black text-[10px] uppercase text-slate-600 flex-1 justify-start">
                            <div className="flex items-center gap-2">
                              {viewMode === 'distributor' ? <Truck className="w-4 h-4 text-primary" /> : <ListFilter className="w-4 h-4 text-primary" />}
                              <span>{group}</span>
                              <Badge variant="outline" className="ml-2 bg-white text-[8px] border-slate-200">
                                {selectedInGroup.length > 0 ? `${selectedInGroup.length}/${groupItems.length}` : groupItems.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400" onClick={(e) => { e.stopPropagation(); handleWhatsApp(groupItems, group); }}>
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
