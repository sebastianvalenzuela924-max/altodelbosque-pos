
"use client";

import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar, ShoppingBag, Loader2, Trophy, Banknote, CreditCard, Wallet, UtensilsCrossed, Plus, Edit3, Trash2, Check, PackageX, PackageSearch, Clock, ChevronRight, Send, Copy, X, FileText, Share2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  
  const [breadBought, setBreadBought] = useState("");
  const [breadRemaining, setBreadRemaining] = useState("");
  const [editingBreadLog, setEditingBreadLog] = useState<any | null>(null);

  // Estados para el Resumen de WhatsApp
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const breadLogsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "breadLogs"), orderBy("date", "desc"));
  }, [firestore]);

  const { data: allSales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection(productsQuery);
  const { data: allBreadLogs, isLoading: isLoadingBread } = useCollection(breadLogsQuery);

  const filteredSales = useMemo(() => {
    if (!allSales || !mounted) return [];
    const now = new Date();
    
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || (sale.saleDateTime ? new Date(sale.saleDateTime) : new Date());
      
      if (dateFilter === "today") return saleDate.toDateString() === now.toDateString();
      if (dateFilter === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return saleDate.toDateString() === yesterday.toDateString();
      }
      if (dateFilter === "custom" && customDate) {
        const [y, m, d] = customDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        return saleDate.toDateString() === targetDate.toDateString();
      }
      if (dateFilter === "month") {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [allSales, dateFilter, customDate, mounted]);

  const stats = useMemo(() => {
    const revenue = filteredSales.filter(s => s.paymentMethod !== 'deduction').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const cash = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const card = filteredSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const inventoryValue = allProducts?.reduce((sum, p) => (p.warningStock === 0 || p.idealStock === 0) ? sum : sum + (Math.round(p.price) * (p.stock || 0)), 0) || 0;
    const transactions = filteredSales.length;
    const totalUnits = filteredSales.reduce((sum, s) => sum + (s.itemsSummary?.reduce((iSum: number, item: any) => iSum + (item.quantity || 0), 0) || 0), 0);
    
    return { revenue, cash, card, inventoryValue, transactions, totalUnits };
  }, [filteredSales, allProducts]);

  const salesAnalysis = useMemo(() => {
    if (!allProducts || !mounted) return { categoriesWithSales: [], categoriesWithNoSales: [] };
    
    const soldMap: Record<string, number> = {};
    const revenueMap: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      const isMonetary = sale.paymentMethod !== 'deduction';
      sale.itemsSummary?.forEach((item: any) => {
        if (item.id) {
          soldMap[item.id] = (soldMap[item.id] || 0) + item.quantity;
          if (isMonetary) {
            revenueMap[item.id] = (revenueMap[item.id] || 0) + (item.price * item.quantity);
          }
        }
      });
    });

    const categoriesWithSales: Record<string, any> = {};
    const categoriesNoSales: Record<string, any> = {};

    allProducts.forEach(p => {
      const sold = soldMap[p.id] || 0;
      const rev = revenueMap[p.id] || 0;
      const catName = p.category || "General";
      
      if (sold > 0) {
        if (!categoriesWithSales[catName]) {
          categoriesWithSales[catName] = { name: catName, totalRev: 0, totalUnits: 0, products: [] };
        }
        categoriesWithSales[catName].totalRev += Math.round(rev);
        categoriesWithSales[catName].totalUnits += sold;
        categoriesWithSales[catName].products.push({ ...p, sold, rev });
      } else {
        if (!categoriesNoSales[catName]) {
          categoriesNoSales[catName] = { name: catName, products: [] };
        }
        categoriesNoSales[catName].products.push(p);
      }
    });

    return { 
      categoriesWithSales: Object.values(categoriesWithSales).sort((a: any, b: any) => b.totalRev - a.totalRev),
      categoriesWithNoSales: Object.values(categoriesNoSales).sort((a: any, b: any) => a.name.localeCompare(b.name))
    };
  }, [filteredSales, allProducts, mounted]);

  const topProducts = useMemo(() => {
    const productCounts: Record<string, any> = {};
    filteredSales.forEach(sale => {
      const isMonetary = sale.paymentMethod !== 'deduction';
      sale.itemsSummary?.forEach((item: any) => {
        if (item.type === 'product') {
          if (!productCounts[item.id]) {
            productCounts[item.id] = { name: item.name, quantity: 0, revenue: 0 };
          }
          productCounts[item.id].quantity += item.quantity;
          if (isMonetary) productCounts[item.id].revenue += (item.price * item.quantity);
        }
      });
    });
    return Object.values(productCounts).sort((a: any, b: any) => b.quantity - a.quantity).slice(0, 10);
  }, [filteredSales]);

  const handleSaveBreadLog = () => {
    if (!breadBought || !breadRemaining) {
      toast({ title: "Faltan datos", variant: "destructive" });
      return;
    }

    const todayStr = editingBreadLog?.date || new Date().toISOString().split('T')[0];
    const docRef = doc(firestore, "breadLogs", todayStr);

    setDocumentNonBlocking(docRef, {
      id: todayStr,
      date: todayStr,
      bought: parseInt(breadBought),
      remaining: parseInt(breadRemaining),
      timestamp: serverTimestamp()
    }, { merge: true });
    
    toast({ title: "Registro de Pan guardado" });
    setBreadBought(""); setBreadRemaining(""); setEditingBreadLog(null);
  };

  const generateDailySummary = () => {
    const dateLabel = dateFilter === "today" ? "Hoy" : dateFilter === "yesterday" ? "Ayer" : dateFilter === "month" ? "Este Mes" : customDate || "Periodo Seleccionado";
    const nowLabel = new Date().toLocaleDateString('es-CL');
    
    let text = `📊 *Resumen del día - ${nowLabel}*\n`;
    text += `📅 Rango: ${dateLabel}\n\n`;
    
    text += `💰 *Ingresos totales:* $${Math.round(stats.revenue).toLocaleString('es-CL')}\n`;
    text += `💵 *Efectivo:* $${Math.round(stats.cash).toLocaleString('es-CL')}\n`;
    text += `💳 *Tarjeta:* $${Math.round(stats.card).toLocaleString('es-CL')}\n`;
    text += `📦 *Valor inventario:* $${Math.round(stats.inventoryValue).toLocaleString('es-CL')}\n\n`;

    if (stats.transactions > 0) {
      text += `🧾 *Transacciones:* ${stats.transactions}\n`;
    }
    if (stats.totalUnits > 0) {
      text += `📚 *Unidades vendidas:* ${stats.totalUnits}\n\n`;
    }

    if (topProducts.length > 0) {
      text += `🏆 *Top productos:*\n`;
      topProducts.slice(0, 5).forEach((p: any) => {
        text += `- ${p.name}: ${p.quantity} u.\n`;
      });
      text += `\n`;
    } else if (stats.revenue === 0) {
      text += `⚠️ No se registraron ventas en el período seleccionado.\n\n`;
    }

    text += `✅ Resumen generado desde la app`;

    setSummaryText(text);
    setIsSummaryOpen(true);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    toast({ title: "Copiado al portapapeles", description: "Ya puedes pegarlo en WhatsApp." });
  };

  const handleSendWhatsApp = () => {
    const encodedText = encodeURIComponent(summaryText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-30">
        <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest">Generando Reportes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tighter uppercase flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Reportes
          </h1>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Estadísticas y control diario.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button 
            onClick={generateDailySummary}
            className="rounded-2xl h-11 px-6 font-black uppercase text-[10px] tracking-widest bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20"
          >
            <Share2 className="w-4 h-4 mr-2" /> Generar Resumen
          </Button>

          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="w-full md:w-[160px] rounded-2xl h-11 border-none bg-slate-100 font-bold">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="yesterday">Ayer</SelectItem>
              <SelectItem value="custom">Calendario</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === "custom" && (
            <Input type="date" className="h-11 rounded-2xl bg-slate-100 border-none font-bold w-full md:w-[160px]" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm bg-primary text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Total Ventas</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.revenue).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="border-none shadow-sm bg-green-600 text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Efectivo</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.cash).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="border-none shadow-sm bg-blue-600 text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Tarjeta</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.card).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="border-none shadow-sm bg-accent text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Valor Stock</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.inventoryValue).toLocaleString('es-CL')}</p>
        </Card>
      </section>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full grid grid-cols-4">
          <TabsTrigger value="sales" className="rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShoppingBag className="w-4 h-4 mr-2" /> Ventas
          </TabsTrigger>
          <TabsTrigger value="no-sales" className="rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <PackageX className="w-4 h-4 mr-2" /> Sin Ventas
          </TabsTrigger>
          <TabsTrigger value="bread" className="rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <UtensilsCrossed className="w-4 h-4 mr-2" /> Pan
          </TabsTrigger>
          <TabsTrigger value="top" className="rounded-xl font-bold uppercase text-[9px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Trophy className="w-4 h-4 mr-2" /> Top
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-6 space-y-3">
          {salesAnalysis.categoriesWithSales.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin ventas en este periodo</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {salesAnalysis.categoriesWithSales.map((cat, idx) => (
                <AccordionItem key={idx} value={`sales-${idx}`} className="border-none">
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <AccordionTrigger className="p-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="min-w-0">
                          <h3 className="font-black text-sm uppercase text-slate-800 truncate">{cat.name}</h3>
                          <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/10">{cat.totalUnits} u.</Badge>
                        </div>
                        <p className="text-lg font-black font-mono text-primary">${cat.totalRev.toLocaleString('es-CL')}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 bg-slate-50/50">
                      <div className="space-y-1.5">
                        {cat.products.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-600">{p.name}</span>
                            <div className="text-right">
                              <span className="font-black text-primary mr-2">{p.sold} u.</span>
                              <span className="font-black font-mono">${Math.round(p.rev).toLocaleString('es-CL')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="no-sales" className="mt-6 space-y-3">
          {salesAnalysis.categoriesWithNoSales.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Todos los productos tienen ventas</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {salesAnalysis.categoriesWithNoSales.map((cat, idx) => (
                <AccordionItem key={idx} value={`nosales-${idx}`} className="border-none">
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <AccordionTrigger className="p-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="min-w-0">
                          <h3 className="font-black text-sm uppercase text-slate-800 truncate">{cat.name}</h3>
                          <Badge variant="outline" className="text-[8px] bg-slate-50 text-slate-400 border-slate-200">{cat.products.length} productos</Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 bg-slate-50/50">
                      <div className="space-y-1.5">
                        {cat.products.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-600">{p.name}</span>
                            <Badge variant="outline" className="text-[9px] font-black bg-white border-slate-200">Stock: {p.stock}</Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="bread" className="mt-6 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">¿Cuánto Pan Compré?</Label>
                <Input type="number" className="h-12 rounded-2xl bg-slate-50 border-none font-black text-lg text-center" placeholder="0" value={breadBought} onChange={(e) => setBreadBought(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">¿Cuánto Pan Quedó?</Label>
                <Input type="number" className="h-12 rounded-2xl bg-slate-50 border-none font-black text-lg text-center" placeholder="0" value={breadRemaining} onChange={(e) => setBreadRemaining(e.target.value)} />
              </div>
              <Button className="h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 font-black uppercase tracking-widest text-xs" onClick={handleSaveBreadLog}>
                {editingBreadLog ? 'Guardar Cambios' : 'Registrar Hoy'}
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
              <Clock className="w-3 h-3" /> Historial Reciente
            </h3>
            {allBreadLogs?.map((log) => {
              const date = new Date(log.date + 'T12:00:00');
              const sold = log.bought - log.remaining;
              return (
                <Card key={log.id} className="border-none shadow-sm rounded-2xl bg-white p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border flex flex-col items-center justify-center">
                      <span className="text-[7px] font-black uppercase text-slate-400 leading-none">{date.toLocaleDateString('es-CL', { month: 'short' })}</span>
                      <span className="text-lg font-black text-slate-800 leading-none">{date.getDate()}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-800 uppercase">{date.toLocaleDateString('es-CL', { weekday: 'long' })}</p>
                      <p className="text-[8px] font-bold text-slate-400">Cerca de {log.bought} u. compradas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Consumo/Venta</p>
                      <p className="text-xl font-black text-amber-600">{sold} u.</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setEditingBreadLog(log); setBreadBought(log.bought); setBreadRemaining(log.remaining); }}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, "breadLogs", log.id))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="top" className="mt-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Ranking de Movimiento
            </h3>
            <div className="space-y-4">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs", idx < 3 ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                    <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(p.quantity / topProducts[0].quantity) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 min-w-[80px]">
                    <p className="text-xs font-black text-primary">{p.quantity} u.</p>
                    <p className="text-[10px] font-bold text-slate-400 font-mono">${Math.round(p.revenue).toLocaleString('es-CL')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE RESUMEN WHATSAPP */}
      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-[90vw] sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-primary uppercase">
              <Share2 className="w-6 h-6" /> Vista Previa Resumen
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Este es el mensaje ejecutivo que se compartirá.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 whitespace-pre-wrap font-mono text-[10px] md:text-xs leading-relaxed max-h-[40vh] overflow-y-auto">
            {summaryText}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 mt-6">
            <Button 
              variant="outline" 
              className="rounded-xl h-12 font-bold gap-2 border-slate-200" 
              onClick={handleCopySummary}
            >
              <Copy className="w-4 h-4" /> Copiar
            </Button>
            <Button 
              className="rounded-xl h-12 font-black uppercase text-[10px] tracking-widest bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 gap-2" 
              onClick={handleSendWhatsApp}
            >
              <Send className="w-4 h-4" /> WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
