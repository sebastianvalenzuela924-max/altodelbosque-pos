
"use client";

import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, Loader2, ListFilter, Trophy, CheckCircle2, Filter, ShieldAlert, ShieldCheck, AlertTriangle, Tag, ArrowRight, Wallet, Banknote, CreditCard, Ghost, Search, X, UtensilsCrossed, Plus, Edit3, Trash2, Check, Scale } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import React from 'react';

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  
  // Estados para Control de Pan
  const [breadBought, setBreadBought] = useState("");
  const [breadRemaining, setBreadRemaining] = useState("");
  const [editingBreadLog, setEditingBreadLog] = useState<any | null>(null);
  
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

  const getProductStatus = (stock: number, ideal: number, warning?: number) => {
    if (warning === 0 || ideal === 0) return "ok";
    if (warning !== undefined && warning !== null && warning > 0) {
      return stock < warning ? "danger" : "ok";
    }
    const idealVal = ideal || 10;
    if (stock < idealVal * 0.25) return "danger";
    if (stock < idealVal * 0.5) return "warning";
    return "ok";
  };

  const filteredSales = useMemo(() => {
    if (!allSales || !mounted) return [];
    const now = new Date();
    
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || (sale.saleDateTime ? new Date(sale.saleDateTime) : new Date());
      
      if (dateFilter === "today") {
        return saleDate.toDateString() === now.toDateString();
      }
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

  const totalRevenue = filteredSales
    .filter(s => s.paymentMethod !== 'deduction')
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    
  const totalCash = filteredSales
    .filter(s => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    
  const totalCard = filteredSales
    .filter(s => s.paymentMethod === 'card')
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const categoryStats = useMemo(() => {
    if (!allProducts || !mounted) return [];
    
    const stats: Record<string, any> = {};
    const productSoldMap: Record<string, number> = {};

    filteredSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        if (item.id) {
          productSoldMap[item.id] = (productSoldMap[item.id] || 0) + item.quantity;
        }
      });
    });
    
    allProducts.forEach(p => {
      const soldThisPeriod = productSoldMap[p.id] || 0;
      if (soldThisPeriod <= 0) return;

      const cat = p.category || "General";
      const key = cat.toLowerCase();
      
      if (!stats[key]) {
        stats[key] = {
          category: cat,
          totalRevenue: 0,
          unitsSold: 0,
          productCount: 0,
          stockCritical: 0,
          products: []
        };
      }
      
      stats[key].productCount++;
      if (getProductStatus(p.stock, p.idealStock, p.warningStock) === "danger") {
        stats[key].stockCritical++;
      }
      stats[key].products.push({ ...p, soldThisPeriod });
    });

    filteredSales.forEach(sale => {
      const isMonetary = sale.paymentMethod !== 'deduction';
      sale.itemsSummary?.forEach((item: any) => {
        const key = (item.category || "General").toLowerCase();
        if (stats[key]) {
          if (isMonetary) {
            stats[key].totalRevenue += Math.round(item.price * item.quantity);
          }
          stats[key].unitsSold += item.quantity;
        }
      });
    });

    return Object.values(stats)
      .map((cat: any) => ({
        ...cat,
        products: cat.products.sort((a: any, b: any) => b.soldThisPeriod - a.soldThisPeriod)
      }))
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
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
          if (isMonetary) {
            productCounts[item.id].revenue += (item.price * item.quantity);
          }
        }
      });
    });
    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);
  }, [filteredSales]);

  const handleSaveBreadLog = () => {
    if (!breadBought || !breadRemaining) {
      toast({ title: "Datos incompletos", description: "Ingresa cuántos compraste y cuántos quedaron.", variant: "destructive" });
      return;
    }

    const bought = parseInt(breadBought);
    const remaining = parseInt(breadRemaining);
    
    if (isNaN(bought) || isNaN(remaining)) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const logId = editingBreadLog?.id || todayStr;
    const docRef = doc(firestore, "breadLogs", logId);

    const logData = {
      id: logId,
      date: editingBreadLog?.date || todayStr,
      bought,
      remaining,
      timestamp: serverTimestamp()
    };

    setDocumentNonBlocking(docRef, logData, { merge: true });
    
    toast({ title: "Control de Pan guardado", description: "Los datos se han registrado correctamente." });
    setBreadBought("");
    setBreadRemaining("");
    setEditingBreadLog(null);
  };

  const handleEditBreadLog = (log: any) => {
    setEditingBreadLog(log);
    setBreadBought(log.bought.toString());
    setBreadRemaining(log.remaining.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBreadLog = (id: string) => {
    deleteDocumentNonBlocking(doc(firestore, "breadLogs", id));
    toast({ title: "Registro eliminado" });
  };

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
        <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Analizando Datos...</p>
      </div>
    );
  }

  const totalInventoryValue = allProducts?.reduce((sum, p) => {
    const noAlerts = p.warningStock === 0 || p.idealStock === 0;
    if (noAlerts) return sum;
    return sum + (Math.round(p.price) * (p.stock || 0));
  }, 0) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
            <TrendingUp className="w-7 h-7 md:w-8 md:h-8" />
            Reportes
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm font-bold mt-1">
            Análisis de rendimiento y control diario de productos.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="flex-1 md:w-[180px] rounded-2xl h-11 md:h-12 border-none bg-slate-100 font-bold focus:ring-primary shadow-sm">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="yesterday">Ayer</SelectItem>
              <SelectItem value="custom">Día Específico</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Historial Completo</SelectItem>
            </SelectContent>
          </Select>
          
          {dateFilter === "custom" && (
            <div className="flex-1 md:flex-none animate-in slide-in-from-right-2 duration-300">
              <Input 
                type="date" 
                className="h-11 md:h-12 rounded-2xl bg-slate-100 border-none font-bold w-full" 
                value={customDate} 
                onChange={(e) => setCustomDate(e.target.value)} 
              />
            </div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-primary text-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60 font-black text-[10px] uppercase tracking-widest">Ingresos Totales</CardDescription>
            <CardTitle className="text-2xl font-black font-mono tracking-tighter">
              ${Math.round(totalRevenue).toLocaleString('es-CL')}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-md bg-green-600 text-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Banknote className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60 font-black text-[10px] uppercase tracking-widest">Cobrado en Efectivo</CardDescription>
            <CardTitle className="text-2xl font-black font-mono tracking-tighter">
              ${Math.round(totalCash).toLocaleString('es-CL')}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-md bg-blue-600 text-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <CreditCard className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60 font-black text-[10px] uppercase tracking-widest">Cobrado con Tarjeta</CardDescription>
            <CardTitle className="text-2xl font-black font-mono tracking-tighter">
              ${Math.round(totalCard).toLocaleString('es-CL')}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-md bg-accent text-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60 font-black text-[10px] uppercase tracking-widest">Valor Inventario</CardDescription>
            <CardTitle className="text-2xl font-black font-mono tracking-tighter">
              ${Math.round(totalInventoryValue).toLocaleString('es-CL')}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full grid grid-cols-3">
          <TabsTrigger value="sales" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShoppingBag className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Ventas
          </TabsTrigger>
          <TabsTrigger value="bread" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <UtensilsCrossed className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Control Pan
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Trophy className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Top Ventas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 mt-6">
          <Accordion type="multiple" className="space-y-3">
            {categoryStats.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay ventas en este periodo</p>
              </div>
            ) : (
              categoryStats.map((cat, idx) => {
                const hasCritical = cat.stockCritical > 0;
                return (
                  <AccordionItem key={idx} value={`cat-${idx}`} className="border-none">
                    <Card className={cn(
                      "border-none shadow-md rounded-3xl overflow-hidden transition-all duration-300",
                      hasCritical ? "bg-red-50/50" : "bg-white"
                    )}>
                      <AccordionTrigger className="hover:no-underline p-2 md:p-6 text-left">
                        <div className="flex items-center gap-2 md:gap-4 w-full min-w-0">
                          <div className={cn(
                            "w-8 h-8 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-black text-base md:text-xl shadow-inner shrink-0",
                            hasCritical ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
                          )}>
                            {cat.category[0].toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-xs md:text-lg uppercase tracking-tighter text-slate-800 truncate">{cat.category}</h3>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[7px] md:text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/20 rounded-lg px-1.5 py-0">
                                {cat.unitsSold} u. vendidas
                              </Badge>
                            </div>
                          </div>

                          <div className="text-right shrink-0 min-w-[70px] md:min-w-[120px] pr-1 md:pr-2">
                            <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Recaudado</p>
                            <p className="text-sm md:text-xl font-black font-mono text-primary leading-none tracking-tighter">
                              ${Math.round(cat.totalRevenue).toLocaleString('es-CL')}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-1 md:px-6 pb-4 md:pb-6 pt-0 bg-slate-50/50">
                        <div className="grid gap-1 mt-1 md:mt-2">
                          {cat.products.map((p: any) => {
                            const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
                            return (
                              <div key={p.id} className={cn(
                                "bg-white p-2 rounded-xl flex items-center justify-between border shadow-sm gap-2",
                                status === 'danger' ? "border-red-200" : "border-slate-100"
                              )}>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-[9px] md:text-xs text-slate-700 truncate">{p.name}</p>
                                  <p className="text-[7px] text-slate-400 font-bold uppercase">Stock: {p.stock}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[8px] md:text-sm font-black text-primary">{p.soldThisPeriod} u.</p>
                                  <p className="text-[8px] md:text-sm font-black font-mono">${(Math.round(p.price) * p.soldThisPeriod).toLocaleString('es-CL')}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                );
              })
            )}
          </Accordion>
        </TabsContent>

        <TabsContent value="bread" className="space-y-6 mt-6">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-amber-600 text-white p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="w-8 h-8" />
                  <div>
                    <CardTitle className="text-xl md:text-2xl font-black uppercase tracking-tighter">Registrar Pan de Hoy</CardTitle>
                    <CardDescription className="text-amber-100 font-bold text-xs uppercase">Control de quiebre y merma diaria.</CardDescription>
                  </div>
                </div>
                {editingBreadLog && (
                  <Button variant="ghost" onClick={() => { setEditingBreadLog(null); setBreadBought(""); setBreadRemaining(""); }} className="text-white hover:bg-white/20 font-black text-xs uppercase rounded-xl border border-white/30">
                    <X className="w-4 h-4 mr-2" /> Cancelar Edición
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="grid gap-3">
                    <Label className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-600" /> ¿Cuánto Pan compré hoy?
                    </Label>
                    <Input 
                      type="number" 
                      className="h-16 rounded-2xl bg-slate-50 border-none text-3xl font-black text-slate-700 text-center focus-visible:ring-amber-600" 
                      placeholder="0"
                      value={breadBought}
                      onChange={(e) => setBreadBought(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-600" /> ¿Cuánto Pan quedó?
                    </Label>
                    <Input 
                      type="number" 
                      className="h-16 rounded-2xl bg-slate-50 border-none text-3xl font-black text-slate-700 text-center focus-visible:ring-amber-600" 
                      placeholder="0"
                      value={breadRemaining}
                      onChange={(e) => setBreadRemaining(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-slate-200">
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Resultado Calculado</p>
                   <div className="text-6xl md:text-8xl font-black text-amber-600 tracking-tighter">
                    {Math.max(0, (parseInt(breadBought || "0") - parseInt(breadRemaining || "0")))}
                   </div>
                   <p className="text-sm font-bold text-slate-600 uppercase">Unidades Vendidas / Consumidas</p>
                   
                   <Button 
                    className={cn(
                      "w-full h-16 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg shadow-amber-600/20",
                      editingBreadLog ? "bg-primary" : "bg-amber-600 hover:bg-amber-700"
                    )}
                    onClick={handleSaveBreadLog}
                   >
                     {editingBreadLog ? <Check className="w-6 h-6 mr-3" /> : <Plus className="w-6 h-6 mr-3" />}
                     {editingBreadLog ? "GUARDAR CAMBIOS" : "REGISTRAR PAN"}
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <TrendingUp className="w-4 h-4" /> Historial de Control
            </h3>
            
            {isLoadingBread ? (
              <div className="py-20 flex justify-center opacity-30"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : allBreadLogs?.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-100">
                <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-slate-100" />
                <p className="text-slate-400 font-bold uppercase text-xs">Sin registros de pan todavía</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {allBreadLogs?.map((log) => {
                  const date = new Date(log.date + 'T12:00:00');
                  const sold = log.bought - log.remaining;
                  return (
                    <Card key={log.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group">
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 flex flex-col items-center justify-center shrink-0 border border-slate-100">
                            <span className="text-[8px] font-black uppercase text-slate-400 leading-none">{date.toLocaleDateString('es-CL', { month: 'short' })}</span>
                            <span className="text-lg font-black text-slate-800 leading-none">{date.getDate()}</span>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Pan del {date.toLocaleDateString('es-CL', { weekday: 'long' })}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-[10px] font-bold text-green-600">Comp: {log.bought}</span>
                              <span className="text-[10px] font-bold text-amber-600">Sobra: {log.remaining}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Total Venta</p>
                              <p className="text-xl font-black text-primary leading-none">{sold} u.</p>
                           </div>
                           <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-400 hover:text-primary hover:bg-primary/10" onClick={() => handleEditBreadLog(log)}>
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-400 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteBreadLog(log.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                           </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="p-4 md:p-6 bg-amber-50/30">
              <CardTitle className="text-lg md:text-xl font-black text-amber-600 flex items-center gap-2">
                <Trophy className="w-5 h-5 md:w-6 md:h-6" />
                Los más vendidos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {topProducts.length === 0 ? (
                <div className="text-center py-20">
                   <Package className="w-16 h-16 mx-auto mb-4 text-slate-100" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sin ventas en este periodo</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                        idx === 0 ? "bg-amber-100 text-amber-600" : 
                        idx === 1 ? "bg-slate-100 text-slate-500" :
                        idx === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-300"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs md:text-sm text-slate-700 truncate">{p.name}</p>
                        <div className="w-full h-1 bg-slate-100 rounded-full mt-2">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${(p.quantity / topProducts[0].quantity) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 min-w-[100px]">
                        <p className="text-xs font-black text-primary">{p.quantity} u.</p>
                        <p className="text-[10px] font-bold text-slate-400 font-mono">${Math.round(p.revenue).toLocaleString('es-CL')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
