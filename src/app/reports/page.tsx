
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2, ListFilter, Table as TableIcon, CalendarDays, ChevronRight } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const { data: sales, isLoading } = useCollection(salesQuery);

  const stats = useMemo(() => {
    if (!sales || !mounted) return { daily: 0, monthly: 0, totalSales: 0, unitsSold: 0 };

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const daily = sales
      .filter(s => {
        const d = s.saleDateTime?.toDate?.() || new Date();
        return d >= startOfDay;
      })
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const monthly = sales
      .filter(s => {
        const d = s.saleDateTime?.toDate?.() || new Date();
        return d >= startOfMonth;
      })
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const unitsSold = sales.reduce((sum, s) => {
      if (s.itemsSummary) {
        return sum + s.itemsSummary.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0);
      }
      return sum + (s.productSaleItemIds?.length || 0);
    }, 0);

    return {
      daily,
      monthly,
      totalSales: sales.length,
      unitsSold
    };
  }, [sales, mounted]);

  // Agrupación de ventas por día (Día a Día)
  const dailyBreakdown = useMemo(() => {
    if (!sales || !mounted) return [];
    
    const groups: Record<string, { date: Date, products: Record<string, { name: string, quantity: number, total: number }> }> = {};
    
    sales.forEach(sale => {
      const d = sale.saleDateTime?.toDate?.() || new Date();
      const dateKey = d.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = { date: d, products: {} };
      }
      
      if (sale.itemsSummary) {
        sale.itemsSummary.forEach((item: any) => {
          const prodKey = item.id === 'manual' ? `Manual: ${item.name}` : item.name;
          if (!groups[dateKey].products[prodKey]) {
            groups[dateKey].products[prodKey] = { name: prodKey, quantity: 0, total: 0 };
          }
          groups[dateKey].products[prodKey].quantity += item.quantity || 0;
          groups[dateKey].products[prodKey].total += Math.round(item.price * item.quantity) || 0;
        });
      }
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sales, mounted]);

  // Agrupación de ventas por mes
  const monthlyBreakdown = useMemo(() => {
    if (!sales || !mounted) return [];
    
    const groups: Record<string, { monthYear: string, date: Date, products: Record<string, { name: string, quantity: number, total: number }> }> = {};
    
    sales.forEach(sale => {
      const d = sale.saleDateTime?.toDate?.() || new Date();
      const monthKey = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!groups[monthKey]) {
        groups[monthKey] = { monthYear: monthKey, date: d, products: {} };
      }
      
      if (sale.itemsSummary) {
        sale.itemsSummary.forEach((item: any) => {
          const prodKey = item.id === 'manual' ? `Manual: ${item.name}` : item.name;
          if (!groups[monthKey].products[prodKey]) {
            groups[monthKey].products[prodKey] = { name: prodKey, quantity: 0, total: 0 };
          }
          groups[monthKey].products[prodKey].quantity += item.quantity || 0;
          groups[monthKey].products[prodKey].total += Math.round(item.price * item.quantity) || 0;
        });
      }
    });

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sales, mounted]);

  const allProductsRanking = useMemo(() => {
    if (!sales || !mounted) return [];
    const productStats: Record<string, { name: string, quantity: number, total: number }> = {};
    
    sales.forEach(sale => {
      if (sale.itemsSummary) {
        sale.itemsSummary.forEach((item: any) => {
          const key = item.id === 'manual' ? `Manual: ${item.name}` : item.name;
          if (!productStats[key]) {
            productStats[key] = { name: key, quantity: 0, total: 0 };
          }
          productStats[key].quantity += item.quantity || 0;
          productStats[key].total += Math.round(item.price * item.quantity) || 0;
        });
      }
    });

    return Object.values(productStats).sort((a, b) => b.quantity - a.quantity);
  }, [sales, mounted]);

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  const getDateLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "HOY";
    if (date.toDateString() === yesterday.toDateString()) return "AYER";
    return null;
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">Analizando ventas y productos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Análisis de Negocio</h1>
          <p className="text-muted-foreground">Monitoreo detallado día a día de tus ventas y productos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg bg-primary text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 font-black uppercase text-[10px] tracking-widest">Ventas Hoy</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between">
              ${Math.round(stats.daily).toLocaleString('es-CL')}
              <DollarSign className="w-8 h-8 opacity-20" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-primary-foreground/80 mt-2">
              <ArrowUpRight className="w-4 h-4 mr-1" /> Total recaudado hoy
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-accent text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-accent-foreground/70 font-black uppercase text-[10px] tracking-widest">Ventas Mes</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between">
              ${Math.round(stats.monthly).toLocaleString('es-CL')}
              <TrendingUp className="w-8 h-8 opacity-20" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-accent-foreground/80 mt-2">
              <Calendar className="w-4 h-4 mr-1" /> Acumulado este mes
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Boletas Emitidas</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between text-primary">
              {stats.totalSales}
              <ShoppingBag className="w-8 h-8 text-primary/10" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-slate-400 mt-2">
              Historial completo
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Unidades Vendidas</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between text-accent">
              {stats.unitsSold}
              <Package className="w-8 h-8 text-accent/10" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-slate-400 mt-2">
              Total productos físicos
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="diario" className="w-full">
        <TabsList className="bg-white border p-1 rounded-2xl h-14 w-full md:w-auto grid grid-cols-3 md:inline-flex mb-6 gap-2">
          <TabsTrigger value="diario" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <TableIcon className="w-4 h-4 mr-2" /> Día a Día
          </TabsTrigger>
          <TabsTrigger value="mensual" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <CalendarDays className="w-4 h-4 mr-2" /> Mensual
          </TabsTrigger>
          <TabsTrigger value="ranking" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <ListFilter className="w-4 h-4 mr-2" /> Más Vendidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diario" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
               <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Desglose Histórico por Día</h2>
            </div>
            {dailyBreakdown.length > 0 ? (
              dailyBreakdown.map((day, dayIdx) => {
                const label = getDateLabel(day.date);
                return (
                  <Card key={dayIdx} className={cn(
                    "border-none shadow-md overflow-hidden rounded-2xl transition-all hover:shadow-lg",
                    label === 'HOY' && "ring-2 ring-primary ring-offset-2"
                  )}>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="day-detail" className="border-none">
                        <AccordionTrigger className="hover:no-underline px-6 py-5 bg-slate-50/50">
                          <div className="flex items-center gap-4 text-left w-full">
                            <div className={cn(
                              "p-3 rounded-xl shrink-0",
                              label === 'HOY' ? "bg-primary text-white" : "bg-primary/10 text-primary"
                            )}>
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-slate-800 uppercase tracking-tighter truncate text-lg">
                                  {day.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h3>
                                {label && (
                                  <span className={cn(
                                    "text-[9px] font-black px-2 py-0.5 rounded-full",
                                    label === 'HOY' ? "bg-primary text-white" : "bg-slate-200 text-slate-600"
                                  )}>
                                    {label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-bold">
                                {Object.values(day.products).length} productos distintos vendidos
                              </p>
                            </div>
                            <div className="text-right mr-4 shrink-0">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Día</p>
                              <p className="text-2xl font-black text-primary font-mono tracking-tighter">
                                ${Object.values(day.products).reduce((sum, p) => sum + p.total, 0).toLocaleString('es-CL')}
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-0 border-t border-slate-100 bg-white">
                          <div className="divide-y divide-slate-50">
                            <div className="grid grid-cols-12 gap-4 p-4 px-8 bg-slate-50/30 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <div className="col-span-6">Producto</div>
                              <div className="col-span-2 text-center">Cant.</div>
                              <div className="col-span-4 text-right">Recaudado</div>
                            </div>
                            {Object.values(day.products).sort((a, b) => b.quantity - a.quantity).map((prod, pIdx) => (
                              <div key={pIdx} className="grid grid-cols-12 gap-4 p-4 px-8 hover:bg-slate-50/50 transition-colors items-center">
                                <div className="col-span-6 flex flex-col">
                                  <span className="font-bold text-slate-700 text-sm">{prod.name}</span>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-full">
                                    {prod.quantity}
                                  </span>
                                </div>
                                <div className="col-span-4 text-right font-black font-mono text-slate-600">
                                  ${prod.total.toLocaleString('es-CL')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed">
                <Package className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                <p className="text-slate-400 font-bold">No hay ventas registradas aún.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mensual" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
               <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Resumen Mensual</h2>
            </div>
            {monthlyBreakdown.length > 0 ? (
              monthlyBreakdown.map((month, mIdx) => (
                <Card key={mIdx} className="border-none shadow-md overflow-hidden rounded-2xl transition-all hover:shadow-lg">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="month-detail" className="border-none">
                      <AccordionTrigger className="hover:no-underline px-6 py-6 bg-accent/5">
                        <div className="flex items-center gap-4 text-left w-full">
                          <div className="bg-accent/10 p-3 rounded-xl text-accent shrink-0">
                            <CalendarDays className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-slate-800 uppercase tracking-tighter truncate text-xl">
                              {month.monthYear}
                            </h3>
                            <p className="text-xs text-muted-foreground font-bold">
                              Rendimiento total del periodo
                            </p>
                          </div>
                          <div className="text-right mr-4 shrink-0">
                            <p className="text-[10px] font-black uppercase text-accent tracking-widest">Recaudación Mes</p>
                            <p className="text-3xl font-black text-accent font-mono tracking-tighter">
                              ${Object.values(month.products).reduce((sum, p) => sum + p.total, 0).toLocaleString('es-CL')}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0 border-t border-slate-100 bg-white">
                        <div className="divide-y divide-slate-50">
                          <div className="grid grid-cols-12 gap-4 p-4 px-8 bg-slate-50/30 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <div className="col-span-6">Producto</div>
                            <div className="col-span-2 text-center">Unidades</div>
                            <div className="col-span-4 text-right">Aporte</div>
                          </div>
                          {Object.values(month.products).sort((a, b) => b.quantity - a.quantity).map((prod, pIdx) => (
                            <div key={pIdx} className="grid grid-cols-12 gap-4 p-4 px-8 hover:bg-slate-50/50 transition-colors items-center">
                              <div className="col-span-6 flex flex-col">
                                <span className="font-bold text-slate-700">{prod.name}</span>
                              </div>
                              <div className="col-span-2 text-center">
                                <span className="bg-accent/10 text-accent text-[10px] font-black px-2 py-1 rounded-full">
                                  {prod.quantity}
                                </span>
                              </div>
                              <div className="col-span-4 text-right font-black font-mono text-slate-600">
                                ${prod.total.toLocaleString('es-CL')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                <p className="text-slate-400 font-bold">No hay suficientes datos mensuales.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ranking" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 border-none shadow-xl bg-white rounded-3xl">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-2xl font-black text-slate-800">Ranking de Rotación</CardTitle>
                <CardDescription>Productos ordenados por cantidad total de unidades vendidas.</CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="space-y-4">
                  {allProductsRanking.length > 0 ? (
                    allProductsRanking.map((product, idx) => (
                      <div key={idx} className="flex items-center gap-4 group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-sm`} style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-end mb-1">
                            <span className="font-bold text-slate-700 truncate">{product.name}</span>
                            <span className="text-xs font-black text-primary">{product.quantity} unidades</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-1000" 
                              style={{ 
                                width: `${(product.quantity / allProductsRanking[0].quantity) * 100}%`,
                                backgroundColor: COLORS[idx % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 opacity-30">
                      <Package className="w-12 h-12 mx-auto mb-2" />
                      <p>Esperando datos de venta para generar el ranking.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5 border-none shadow-xl bg-white rounded-3xl">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-2xl font-black text-slate-800">Impacto en Ingresos</CardTitle>
                <CardDescription>Distribución porcentual de la recaudación por producto (Top 10).</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex flex-col items-center justify-center p-8">
                {allProductsRanking.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allProductsRanking.slice(0, 10)}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="total"
                      >
                        {allProductsRanking.slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}
                        formatter={(value: any) => [`$${value.toLocaleString('es-CL')}`, 'Recaudado']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    Sin datos suficientes.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
