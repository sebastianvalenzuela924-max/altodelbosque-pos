
"use client";

import { useMemo, useState } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Package, Send, Sparkles, Truck, ListFilter, Trash2, CheckSquare, Search, X, CheckCircle2 } from "lucide-react";
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

export function SuggestionsView({ products, categories, distributors }: SuggestionsViewProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  // 'suggestions' es el filtro por defecto que oculta los 'OK'
  const [priorityFilter, setPriorityFilter] = useState<string>("suggestions");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("general");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        
        let priority: Priority = 'OK';
        let refType: 'AVISO' | 'IDEAL' | '' = '';
        let refValue = 0;
        let suggestedQty = 0;

        const stock = p.stock || 0;
        const hasWarning = p.warningStock !== undefined && p.warningStock !== null && p.warningStock > 0;
        const hasIdeal = p.idealStock !== undefined && p.idealStock !== null && p.idealStock > 0;

        // CRÍTICO
        if (stock <= 0) {
          priority = 'Crítico';
          refType = hasWarning ? 'AVISO' : (hasIdeal ? 'IDEAL' : '');
          refValue = hasWarning ? p.warningStock! : (hasIdeal ? p.idealStock! : 0);
          suggestedQty = hasIdeal ? p.idealStock! : (hasWarning ? p.warningStock! * 2 : 5);
        } else if (hasWarning && stock <= p.warningStock!) {
          priority = 'Crítico';
          refType = 'AVISO';
          refValue = p.warningStock!;
          suggestedQty = Math.max(p.warningStock! * 2, Math.ceil(rotationScore * 14));
        }

        // POR REPONER
        if (priority === 'OK' && stock > 0) {
           if (hasWarning) {
              if (stock <= p.warningStock! + 2) {
                 priority = 'Por reponer';
                 refType = 'AVISO';
                 refValue = p.warningStock!;
                 suggestedQty = Math.max(5, Math.ceil(rotationScore * 10));
              }
           } else if (hasIdeal) {
              if (stock < p.idealStock! * 0.6) {
                 priority = 'Por reponer';
                 refType = 'IDEAL';
                 refValue = p.idealStock!;
                 suggestedQty = Math.max(0, p.idealStock! - stock);
              }
           }
        }

        // SIN ROTACIÓN (Solo si tiene metas definidas)
        if (priority === 'OK' && sales.d30 === 0 && (hasWarning || hasIdeal)) {
          priority = 'Sin rotación';
          refType = hasWarning ? 'AVISO' : 'IDEAL';
          refValue = hasWarning ? p.warningStock! : p.idealStock!;
        }

        return {
          ...p,
          priority,
          refType,
          refValue,
          suggestedQty: Math.max(0, suggestedQty),
          rotationScore,
          salesRecent: sales.d7
        };
      })
      .sort((a, b) => {
        const order = { 'Crítico': 0, 'Por reponer': 1, 'Sin rotación': 2, 'OK': 3 };
        return order[a.priority as Priority] - order[b.priority as Priority];
      });
  }, [products, allSales]);

  const filtered = useMemo(() => {
    return analysis.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || String(p.id).includes(q);
      
      const matchesCategory = categoryFilter === 'all' || (p.category || "General") === categoryFilter;
      const pDist = p.distributor?.trim() || "Sin Prov. (General)";
      const matchesDistributor = distributorFilter === 'all' || pDist === distributorFilter;
      
      let matchesPriority = true;
      // Si hay búsqueda, ignoramos el filtro de "Ocultar OK" (suggestions)
      if (priorityFilter === 'suggestions' && q === "") {
        matchesPriority = p.priority !== 'OK';
      } else if (priorityFilter !== 'all' && priorityFilter !== 'suggestions') {
        matchesPriority = p.priority === priorityFilter;
      }
      
      return matchesSearch && matchesCategory && matchesDistributor && matchesPriority;
    });
  }, [analysis, categoryFilter, distributorFilter, searchTerm, priorityFilter]);

  const summary = useMemo(() => {
    return {
      critical: analysis.filter(p => p.priority === 'Crítico').length,
      restock: analysis.filter(p => p.priority === 'Por reponer').length,
      noRotation: analysis.filter(p => p.priority === 'Sin rotación').length,
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
        if (i.priority !== 'Sin rotación' && i.priority !== 'OK') {
          text += `- ${i.suggestedQty}u. x ${i.name} (St: ${i.stock})\n`;
        } else if (i.priority === 'Sin rotación') {
          text += `- (REVISAR) ${i.name} [Sin rotación]\n`;
        } else {
          text += `- (OPCIONAL) ${i.name} (St: ${i.stock})\n`;
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

    if (listToShare.length === 0) {
      toast({ 
        title: "Sin productos", 
        description: "No hay productos que coincidan con la selección.",
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
            <h4 className="font-bold text-[11px] md:text-xs uppercase text-slate-800 leading-tight">
              {p.name} <span className="text-primary ml-1">${Math.round(p.price).toLocaleString('es-CL')}</span>
            </h4>
            <Badge className={cn(
              "text-[7px] md:text-[8px] font-black uppercase rounded-lg px-1.5 py-0.5 border-none h-4 shrink-0",
              p.priority === 'Crítico' ? "bg-red-600 text-white" : 
              p.priority === 'Por reponer' ? "bg-amber-600 text-white" : 
              p.priority === 'OK' ? "bg-green-600 text-white" : "bg-slate-400 text-white"
            )}>{p.priority}</Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase truncate max-w-[100px]">
              {p.distributor?.trim() || 'Sin Prov. (General)'}
            </span>

            <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
              <span className="text-[7px] font-black text-slate-400 uppercase">St:</span>
              <span className={cn("text-[8px] font-black", p.stock <= 0 ? "text-red-600" : "text-slate-800")}>{p.stock}</span>
              {p.refType && (
                <span className="text-[7px] font-black text-primary/60 uppercase ml-1 px-1 bg-primary/5 rounded border border-primary/10">
                  {p.refType}: {p.refValue}
                </span>
              )}
            </div>

            {p.priority !== 'OK' && p.suggestedQty > 0 && (
              <div className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/10">
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
      {/* Resumen de prioridades */}
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
        <Card className="border-none shadow-sm bg-slate-500 text-white rounded-2xl">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-white/70 font-black text-[8px] uppercase tracking-widest">Sin Rot.</CardDescription>
            <CardTitle className="text-xl font-black">{summary.noRotation}</CardTitle>
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
                <Sparkles className="w-4 h-4 text-accent" /> Sugerencias de Compra
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
              >
                <Send className="w-4 h-4" /> Enviar
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
                  <SelectItem value="Sin rotación">Sin rotación</SelectItem>
                  <SelectItem value="OK">Estado OK</SelectItem>
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
                  {distributors.concat(["Sin Prov. (General)"]).map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/30">
          <ScrollArea className="h-[500px] w-full">
            {filtered.length === 0 ? (
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
