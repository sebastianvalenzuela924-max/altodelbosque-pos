
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2, ListFilter, Table as TableIcon, CalendarDays, ChevronRight, Clock, Tag, AlertTriangle, Trophy, CheckCircle2, Filter, ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import React from 'react';

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState<string>("");
  const firestore = useFirestore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Consultas a Firestore
  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: allSales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection(productsQuery);

  // Lógica de cálculo de estado de stock (coincidente con Inventario)
  const getProductStatus = (stock: number, ideal: number) => {
    const idealVal = ideal || 10;
    if (stock < idealVal * 0.25) return "danger";
    if (stock < idealVal * 0.5) return "warning";
    return "ok";
  };

  // Filtrado de ventas por fecha
  const filteredSales = useMemo(() => {
    if (!allSales || !mounted) return [];
    const now = new Date();
    
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || new Date();
      
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
      return true; // "all"
    });
  }, [allSales, dateFilter, customDate, mounted]);

  // Estadísticas por categoría
  const categoryStats = useMemo(() => {
    if (!allProducts || !mounted) return [];
    
    const stats: Record<string, any> = {};
    
    // Inicializar categorías con info de productos
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
      
      stats[key].productCount++;
      if (getProductStatus(p.stock, p.idealStock) === "danger") {
        stats[key].stockCritical++;
      }
      stats[key].products.push(p);
    });

    // Sumar ventas reales filtradas
    filteredSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        const key = (item.category || "General").toLowerCase();
        if (stats[key]) {
          stats[key].totalRevenue += Math.round(item.price * item.quantity);
          stats[key].unitsSold += item.quantity;
        }
      });
    });

    return Object.values(stats).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredSales, allProducts, mounted]);

  // Top productos vendidos
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
      .slice(0, 5);
  }, [filteredSales]);

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
        <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Analizando Datos...</p>
      </div>
    );
  }

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalSalesCount = filteredSales.length;
  const criticalProductsCount = allProducts?.filter(p => getProductStatus(p.stock, p.idealStock) === "danger").length || 0;
  const inventoryHealth = allProducts?.length ? Math.round((allProducts.filter(p => getProductStatus(p.stock, p.idealStock) === "ok").length / allProducts.length) * 100) : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            Reportes
          </h1>
          <p className="text-muted-foreground text-sm font-bold mt-1">
            Análisis de rendimiento basado en stock ideal.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="w-[180px] rounded-2xl h-12 border-none bg-slate-100 font-bold focus:ring-primary shadow-sm">
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
            <div className="animate-in slide-in-from-right-2 duration-300">
              <Input 
                type="date" 
                className="h-12 rounded-2xl bg-slate-100 border-none font-bold" 
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
            <CardDescription className="text-white/60 font-black text-[10px] uppercase tracking-widest">Ingresos Periodo</CardDescription>
            <CardTitle className="text-3xl font-black font-mono tracking-tighter">
              ${Math.round(totalRevenue).toLocaleString('es-CL')}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 text-slate-100 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-16 h-16" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Ventas Realizadas</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-800">{totalSalesCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 text-red-50 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-16 h-16 text-red-100" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Reponer Urgente</CardDescription>
            <CardTitle className={cn("text-3xl font-black", criticalProductsCount > 0 ? "text-destructive" : "text-slate-800")}>
              {criticalProductsCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 text-green-50 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-16 h-16 text-green-100" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Salud Inventario</CardDescription>
            <CardTitle className={cn("text-3xl font-black", inventoryHealth > 80 ? "text-green-600" : "text-amber-600")}>
              {inventoryHealth}%
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full md:w-auto grid grid-cols-2">
          <TabsTrigger value="categories" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ListFilter className="w-4 h-4 mr-2" /> Por Categoría
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Trophy className="w-4 h-4 mr-2" /> Top Productos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 mt-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Filter className="w-3 h-3" /> Desglose detallado por secciones
            </h2>
          </div>

          <Accordion type="multiple" className="space-y-3">
            {categoryStats.map((cat, idx) => {
              const revenuePercentage = totalRevenue > 0 ? Math.round((cat.totalRevenue / totalRevenue) * 100) : 0;
              const hasCritical = cat.stockCritical > 0;

              return (
                <AccordionItem key={idx} value={`cat-${idx}`} className="border-none">
                  <Card className={cn(
                    "border-none shadow-md rounded-3xl overflow-hidden transition-all duration-300",
                    hasCritical ? "bg-red-50/50" : "bg-white"
                  )}>
                    <AccordionTrigger className="hover:no-underline p-4 md:p-6 text-left">
                      <div className="flex items-center gap-4 w-full">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner",
                          hasCritical ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
                        )}>
                          {cat.category[0].toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-lg uppercase tracking-tighter text-slate-800 truncate">{cat.category}</h3>
                            {hasCritical && <Badge className="bg-destructive text-[8px] font-black uppercase tracking-tighter animate-pulse">¡RECONSTITUIR!</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">{cat.productCount} Prod.</Badge>
                            <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/10">{revenuePercentage}% del Total</Badge>
                          </div>
                        </div>

                        <div className="text-right pr-4 shrink-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Recaudado</p>
                          <p className="text-xl font-black font-mono text-primary leading-none tracking-tighter">
                            ${Math.round(cat.totalRevenue).toLocaleString('es-CL')}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-6 pb-6 pt-2 bg-slate-50/50">
                      <div className="grid gap-2 mt-2">
                        <div className="flex items-center justify-between px-2 mb-2">
                          <span className="text-[10px] font-black uppercase text-slate-400">Existencias en esta sección</span>
                          <span className="text-[10px] font-bold text-slate-400">Total Vendido: {cat.unitsSold} u.</span>
                        </div>
                        {cat.products.map((p: any) => {
                          const status = getProductStatus(p.stock, p.idealStock);
                          return (
                            <div key={p.id} className={cn(
                              "bg-white p-4 rounded-2xl flex items-center justify-between border transition-all",
                              status === 'danger' ? "border-red-200 shadow-sm" : "border-slate-100"
                            )}>
                              <div className="flex items-center gap-3">
                                {status === 'danger' ? <ShieldAlert className="w-5 h-5 text-destructive" /> : 
                                 status === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : 
                                 <ShieldCheck className="w-5 h-5 text-green-500" />}
                                <div>
                                  <p className="font-bold text-sm text-slate-700">{p.name}</p>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase">
                                    Stock: <span className={cn(status === 'danger' ? "text-destructive font-black" : "text-slate-500")}>{p.stock}</span> / Normal: {p.idealStock}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-slate-700 font-mono">${Math.round(p.price).toLocaleString('es-CL')}</p>
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
            <CardHeader>
              <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                Los más vendidos
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Ranking basado en unidades despachadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <Package className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest">No hay ventas registradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-transform group-hover:scale-110",
                        idx === 0 ? "bg-amber-100 text-amber-600 shadow-md shadow-amber-200/50" : 
                        idx === 1 ? "bg-slate-100 text-slate-500" :
                        idx === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-300"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-700">{p.name}</p>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-1000" 
                            style={{ width: `${(p.quantity / topProducts[0].quantity) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">{p.quantity} u.</p>
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

