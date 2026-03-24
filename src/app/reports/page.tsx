"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2, ListFilter, Table as TableIcon, CalendarDays, ChevronRight, Clock, Tag, AlertTriangle, Trophy, CheckCircle2, Filter, ChevronDown } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs-fix"; // Assuming tabs are standard from UI
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Definición local de Tabs para evitar problemas de importación si no existiera un barril específico
import * as TabsPrimitive from "@radix-ui/react-tabs"

const TabsRoot = TabsPrimitive.Root
const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props} />
))
const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} {...props} />
))
const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)} {...props} />
))

import React from 'react';

type DateFilter = "today" | "month" | "all";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
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

  // Filtrado de ventas por fecha
  const filteredSales = useMemo(() => {
    if (!allSales || !mounted) return [];
    const now = new Date();
    
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || new Date();
      if (dateFilter === "today") {
        return saleDate.toDateString() === now.toDateString();
      }
      if (dateFilter === "month") {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      return true; // "all"
    });
  }, [allSales, dateFilter, mounted]);

  const productRanking = useMemo(() => {
    if (!filteredSales || !mounted) return [];
    const ranking: Record<string, { name: string, quantity: number, total: number, category: string }> = {};
    
    filteredSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        if (item.type === 'manual') return;
        const id = item.id;
        if (!ranking[id]) {
          ranking[id] = { name: item.name, quantity: 0, total: 0, category: item.category || "General" };
        }
        ranking[id].quantity += item.quantity;
        ranking[id].total += Math.round(item.price * item.quantity);
      });
    });

    return Object.values(ranking).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [filteredSales, mounted]);

  const categoryStats = useMemo(() => {
    if (!allProducts || !mounted) return [];
    
    const stats: Record<string, { 
      category: string, 
      totalRevenue: number, 
      unitsSold: number, 
      productCount: number, 
      stockCritical: number,
      products: any[]
    }> = {};
    
    // Agrupar productos por categoría para el desglose
    allProducts.forEach(p => {
      const cat = p.category || "General";
      const key = cat.toLowerCase().trim();
      if (!stats[key]) {
        stats[key] = { category: cat, totalRevenue: 0, unitsSold: 0, productCount: 0, stockCritical: 0, products: [] };
      }
      stats[key].productCount++;
      if (p.stock < 5) stats[key].stockCritical++;
      stats[key].products.push(p);
    });

    // Sumar ventas históricas (o filtradas) por categoría
    // Aquí usamos filteredSales para que el gráfico de ingresos responda al filtro de fecha
    filteredSales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        const cat = item.category || "General";
        const key = cat.toLowerCase().trim();
        if (stats[key]) {
          stats[key].totalRevenue += Math.round(item.price * item.quantity);
          stats[key].unitsSold += item.quantity;
        }
      });
    });
    
    return Object.values(stats).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredSales, allProducts, mounted]);

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Sincronizando datos...</p>
      </div>
    );
  }

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalUnits = filteredSales.reduce((sum, s) => {
    return sum + (s.itemsSummary?.reduce((acc: number, i: any) => acc + (i.quantity || 0), 0) || 0);
  }, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Panel de Inteligencia</h1>
          <p className="text-muted-foreground">Analiza el rendimiento y stock de tu negocio.</p>
        </div>

        <div className="bg-white p-1 rounded-2xl flex items-center border shadow-sm w-full md:w-auto">
          <div className="pl-3 text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
          </div>
          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="border-none shadow-none focus:ring-0 w-full md:w-[180px] font-bold h-10">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Todo el Historial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg bg-primary text-white rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 font-black uppercase text-[10px] tracking-widest">
              {dateFilter === 'today' ? 'Ventas Hoy' : dateFilter === 'month' ? 'Ventas Mes' : 'Total Histórico'}
            </CardDescription>
            <CardTitle className="text-3xl font-black font-mono">${Math.round(totalRevenue).toLocaleString('es-CL')}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-[10px] font-bold uppercase opacity-70 tracking-widest flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Rendimiento {dateFilter === 'all' ? 'total' : 'del periodo'}
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Unidades Vendidas</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-800">{totalUnits}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Productos despachados</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white rounded-3xl border-l-4 border-destructive">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Stock Crítico</CardDescription>
            <CardTitle className="text-3xl font-black text-destructive">{allProducts?.filter(p => p.stock < 5).length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Necesitan reposición</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-accent text-white rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-accent-foreground/70 font-black uppercase text-[10px] tracking-widest">Total Inventario</CardDescription>
            <CardTitle className="text-3xl font-black">
              {allProducts?.length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs opacity-70 font-bold uppercase tracking-widest">Productos registrados</div>
          </CardContent>
        </Card>
      </div>

      <TabsRoot defaultValue="categorias" className="w-full">
        <TabsList className="bg-white border p-1 rounded-2xl h-14 w-full md:w-auto grid grid-cols-2 md:inline-flex mb-8 gap-2 shadow-sm">
          <TabsTrigger value="categorias" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Tag className="w-4 h-4 mr-2" /> Categorías y Desglose
          </TabsTrigger>
          <TabsTrigger value="ranking" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Trophy className="w-4 h-4 mr-2" /> Top Más Vendidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-6">
          <div className="grid gap-3">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2 px-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Los 10 Productos con mayor salida
            </h3>
            {productRanking.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay datos de ventas para este periodo</p>
              </div>
            ) : (
              productRanking.map((prod, idx) => (
                <Card key={idx} className="border-none shadow-md rounded-2xl bg-white overflow-hidden group">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-12 h-16 flex items-center justify-center font-black text-lg",
                      idx === 0 ? "bg-amber-100 text-amber-600" : 
                      idx === 1 ? "bg-slate-100 text-slate-500" :
                      idx === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-400"
                    )}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-700">{prod.name}</p>
                        <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest border-slate-200">
                          {prod.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Unidades</p>
                          <p className="text-lg font-black text-slate-700">{prod.quantity}</p>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-[9px] font-black uppercase text-primary tracking-widest">Ingresos</p>
                          <p className="text-xl font-black text-primary font-mono">${prod.total.toLocaleString('es-CL')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <CardTitle className="text-lg font-black mb-6 uppercase tracking-tighter">Recaudación ({dateFilter})</CardTitle>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="totalRevenue" fill="#3366CC" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <CardTitle className="text-lg font-black mb-6 uppercase tracking-tighter">Volumen por Categoría</CardTitle>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryStats} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="unitsSold" nameKey="category">
                      {categoryStats.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">Desglose de Inventario por Categoría</h3>
            <Accordion type="multiple" className="space-y-4">
              {categoryStats.map((cat, idx) => (
                <AccordionItem key={idx} value={`cat-${idx}`} className="border-none">
                  <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
                    <AccordionTrigger className="hover:no-underline p-0 data-[state=open]:bg-slate-50 transition-colors">
                      <div className="flex flex-col md:flex-row w-full text-left">
                        <div className="p-6 md:w-1/3 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0" style={{backgroundColor: COLORS[idx % COLORS.length]}}>
                             {cat.category[0].toUpperCase()}
                          </div>
                          <div>
                             <h3 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{cat.category}</h3>
                             <div className="flex gap-2 mt-1">
                                <Badge variant="secondary" className="text-[9px] font-black uppercase bg-slate-200">
                                  {cat.productCount} Prod.
                                </Badge>
                                {cat.stockCritical > 0 && (
                                  <Badge variant="destructive" className="text-[9px] font-black uppercase">
                                    {cat.stockCritical} Críticos
                                  </Badge>
                                )}
                             </div>
                          </div>
                        </div>
                        
                        <div className="flex-1 p-6 grid grid-cols-2 md:grid-cols-3 gap-6 border-t md:border-t-0 md:border-l border-slate-100">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingresos Periodo</p>
                            <p className="text-xl font-black text-primary font-mono">${cat.totalRevenue.toLocaleString('es-CL')}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Venta Unidades</p>
                            <p className="text-xl font-black text-slate-700">{cat.unitsSold}</p>
                          </div>
                          <div className="space-y-1 col-span-2 md:col-span-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Salud de Stock</p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    cat.stockCritical > 0 ? "bg-destructive" : "bg-green-500"
                                  )} 
                                  style={{ width: `${Math.max(10, 100 - (cat.stockCritical / cat.productCount * 100))}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-[10px] font-black uppercase",
                                cat.stockCritical > 0 ? "text-destructive" : "text-green-600"
                              )}>
                                {cat.stockCritical > 0 ? 'Reponer' : 'Óptimo'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-6 pt-0 bg-slate-50/50 border-t border-slate-100">
                      <div className="mt-6 space-y-3">
                        <div className="grid grid-cols-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <div className="col-span-2">Producto</div>
                          <div className="text-center">Stock Actual</div>
                          <div className="text-right">Estado</div>
                        </div>
                        <div className="space-y-2">
                          {cat.products.map((p: any) => (
                            <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                              <div className="flex-1 col-span-2">
                                <p className="font-bold text-slate-700 text-sm">{p.name}</p>
                                <p className="text-[9px] font-mono text-slate-400">COD: {p.id}</p>
                              </div>
                              <div className="flex-1 text-center font-black text-lg text-slate-600">
                                {p.stock}
                              </div>
                              <div className="flex-1 text-right">
                                {p.stock < 5 ? (
                                  <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">
                                    <AlertTriangle className="w-2 h-2 mr-1" /> Crítico
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">
                                    <CheckCircle2 className="w-2 h-2 mr-1" /> OK
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
