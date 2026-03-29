
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, Loader2, ListFilter, Trophy, CheckCircle2, Filter, ShieldAlert, ShieldCheck, AlertTriangle, Tag, ArrowRight, Wallet, Banknote, CreditCard, Ghost, Search } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from 'react';

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const firestore = useFirestore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: allSales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection(productsQuery);

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

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalCash = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalCard = filteredSales.filter(s => s.paymentMethod !== 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);

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
      
      const soldThisPeriod = productSoldMap[p.id] || 0;
      
      stats[key].productCount++;
      if (getProductStatus(p.stock, p.idealStock, p.warningStock) === "danger") {
        stats[key].stockCritical++;
      }
      stats[key].products.push({ ...p, soldThisPeriod });
    });

    filteredSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        const key = (item.category || "General").toLowerCase();
        if (stats[key]) {
          stats[key].totalRevenue += Math.round(item.price * item.quantity);
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
      sale.itemsSummary?.forEach((item: any) => {
        if (item.type === 'product') {
          if (!productCounts[item.id]) {
            productCounts[item.id] = { name: item.name, quantity: 0, revenue: 0 };
          }
          productCounts[item.id].quantity += item.quantity;
          productCounts[item.id].revenue += (item.price * item.quantity);
        }
      });
    });
    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);
  }, [filteredSales]);

  const unsoldByCategories = useMemo(() => {
    if (!allProducts || !mounted) return [];
    const soldIds = new Set();
    filteredSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        if (item.id) soldIds.add(String(item.id).trim());
      });
    });

    const unsold = allProducts.filter(p => !soldIds.has(String(p.id).trim()));
    
    const groups: Record<string, any[]> = {};
    unsold.forEach(p => {
      const cat = p.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });

    return Object.entries(groups)
      .map(([category, products]) => ({
        category,
        products: products.sort((a, b) => (b.stock || 0) - (a.stock || 0))
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [filteredSales, allProducts, mounted]);

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
        <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Analizando Datos...</p>
      </div>
    );
  }

  const totalInventoryValue = allProducts?.reduce((sum, p) => sum + (Math.round(p.price) * (p.stock || 0)), 0) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
            <TrendingUp className="w-7 h-7 md:w-8 md:h-8" />
            Reportes
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm font-bold mt-1">
            Análisis de rendimiento y productos sin rotación.
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

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full grid grid-cols-3">
          <TabsTrigger value="categories" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ListFilter className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Categoría
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Trophy className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Top Ventas
          </TabsTrigger>
          <TabsTrigger value="unsold" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest data-[state=active]:bg-destructive data-[state=active]:text-white">
            <Ghost className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" /> Sin Ventas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 mt-6">
          <Accordion type="multiple" className="space-y-3">
            {categoryStats.map((cat, idx) => {
              const hasCritical = cat.stockCritical > 0;
              return (
                <AccordionItem key={idx} value={`cat-${idx}`} className="border-none">
                  <Card className={cn(
                    "border-none shadow-md rounded-3xl overflow-hidden transition-all duration-300",
                    hasCritical ? "bg-red-50/50" : "bg-white"
                  )}>
                    <AccordionTrigger className="hover:no-underline p-3 md:p-6 text-left">
                      <div className="flex items-center gap-3 md:gap-4 w-full min-w-0">
                        <div className={cn(
                          "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-black text-lg md:text-xl shadow-inner shrink-0",
                          hasCritical ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
                        )}>
                          {cat.category[0].toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-sm md:text-lg uppercase tracking-tighter text-slate-800 truncate">{cat.category}</h3>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline" className="text-[8px] md:text-[9px] font-black uppercase bg-primary/5 text-primary border-primary/20 rounded-lg px-2 py-0.5">
                              {cat.unitsSold} u. vendidas
                            </Badge>
                          </div>
                        </div>

                        <div className="text-right shrink-0 min-w-[80px] md:min-w-[120px] pr-2">
                          <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total</p>
                          <p className="text-sm md:text-xl font-black font-mono text-primary leading-none tracking-tighter">
                            ${Math.round(cat.totalRevenue).toLocaleString('es-CL')}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-1.5 md:px-6 pb-6 pt-0 bg-slate-50/50">
                      <div className="grid gap-1 mt-2">
                        {cat.products.map((p: any) => {
                          const status = getProductStatus(p.stock, p.idealStock, p.warningStock);
                          const productTotalRevenue = Math.round(p.price * p.soldThisPeriod);
                          return (
                            <div key={p.id} className={cn(
                              "bg-white p-1.5 md:p-3 rounded-xl flex items-center justify-between border transition-all gap-1 md:gap-4 shadow-sm hover:border-primary/20",
                              status === 'danger' ? "border-red-200 bg-red-50/20" : "border-slate-100"
                            )}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={cn(
                                  "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0",
                                  status === 'danger' ? "bg-red-100 text-destructive" : "bg-slate-100 text-slate-400"
                                )}>
                                  {status === 'danger' ? <ShieldAlert className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-[10px] md:text-xs text-slate-700 truncate leading-tight">{p.name}</p>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">St: {p.stock} • ${Math.round(p.price).toLocaleString('es-CL')}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 md:gap-6 shrink-0 text-right">
                                <div className="flex flex-col items-end min-w-[32px] md:min-w-[40px]">
                                  <span className="text-[9px] md:text-sm font-black text-primary">{p.soldThisPeriod}u</span>
                                </div>
                                <div className="min-w-[50px] md:min-w-[90px] flex flex-col items-end">
                                  <span className="text-[9px] md:text-sm font-black text-slate-800 font-mono tracking-tighter">
                                    ${productTotalRevenue.toLocaleString('es-CL')}
                                  </span>
                                </div>
                                <Link 
                                  href={`/inventory?search=${p.id}`}
                                  className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-primary/10 text-primary transition-colors shrink-0"
                                >
                                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>
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

        <TabsContent value="unsold" className="mt-6">
          <div className="space-y-4">
            {unsoldByCategories.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl shadow-xl">
                 <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-100" />
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">¡Excelente! Todo el stock se ha movido.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {unsoldByCategories.map((group, idx) => (
                  <AccordionItem key={idx} value={`unsold-cat-${idx}`} className="border-none">
                    <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
                      <AccordionTrigger className="hover:no-underline p-3 md:p-6 text-left">
                        <div className="flex items-center gap-3 md:gap-4 w-full min-w-0">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-black text-lg md:text-xl bg-slate-100 text-slate-400 shadow-inner shrink-0">
                            {group.category[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-sm md:text-lg uppercase tracking-tighter text-slate-800 truncate">{group.category}</h3>
                            <p className="text-[9px] font-bold uppercase text-slate-400">{group.products.length} productos sin movimiento</p>
                          </div>
                          <Ghost className="w-5 h-5 text-slate-200 mr-2" />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-1.5 md:px-6 pb-6 pt-0 bg-slate-50/50">
                        <div className="grid gap-1 mt-2">
                          {group.products.map((p) => (
                            <div key={p.id} className="bg-white p-1.5 md:p-3 rounded-xl flex items-center justify-between border border-slate-100 shadow-sm gap-1 md:gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[10px] md:text-xs text-slate-700 truncate leading-tight">{p.name}</p>
                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Cód: {p.id}</p>
                              </div>
                              <div className="text-right flex items-center gap-1.5 md:gap-4 shrink-0">
                                <div className="flex flex-col items-end min-w-[32px] md:min-w-[50px]">
                                  <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase leading-none mb-1">St</p>
                                  <p className="text-[9px] md:text-sm font-black text-slate-700">{p.stock}</p>
                                </div>
                                <div className="flex flex-col items-end min-w-[50px] md:min-w-[80px]">
                                  <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Precio</p>
                                  <p className="text-[9px] md:text-sm font-black text-primary font-mono">${Math.round(p.price).toLocaleString('es-CL')}</p>
                                </div>
                                <Link 
                                  href={`/inventory?search=${p.id}`}
                                  className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-primary transition-colors shrink-0"
                                >
                                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                                </Link>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

