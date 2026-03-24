"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2, ListFilter, Table as TableIcon, CalendarDays, ChevronRight, Clock, Tag, AlertTriangle, Trophy, CheckCircle2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: sales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: products, isLoading: isLoadingProducts } = useCollection(productsQuery);

  const productRanking = useMemo(() => {
    if (!sales || !mounted) return [];
    const ranking: Record<string, { name: string, quantity: number, total: number, category: string }> = {};
    
    sales.forEach(sale => {
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
  }, [sales, mounted]);

  const categoryStats = useMemo(() => {
    if (!sales || !products || !mounted) return [];
    
    const stats: Record<string, { category: string, totalRevenue: number, unitsSold: number, productCount: number, stockCritical: number }> = {};
    
    // Contar productos por categoría
    products.forEach(p => {
      const cat = p.category || "General";
      const key = cat.toLowerCase().trim();
      if (!stats[key]) {
        stats[key] = { category: cat, totalRevenue: 0, unitsSold: 0, productCount: 0, stockCritical: 0 };
      }
      stats[key].productCount++;
      if (p.stock < 5) stats[key].stockCritical++;
    });

    // Sumar ventas por categoría
    sales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        const cat = item.category || "General";
        const key = cat.toLowerCase().trim();
        if (!stats[key]) {
          stats[key] = { category: cat, totalRevenue: 0, unitsSold: 0, productCount: 0, stockCritical: 0 };
        }
        stats[key].totalRevenue += Math.round(item.price * item.quantity);
        stats[key].unitsSold += item.quantity;
      });
    });
    
    return Object.values(stats).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [sales, products, mounted]);

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Compilando reportes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Panel de Inteligencia</h1>
          <p className="text-muted-foreground">Analiza el rendimiento de tus categorías y stock.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg bg-primary text-white rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 font-black uppercase text-[10px] tracking-widest">Categoría Líder</CardDescription>
            <CardTitle className="text-2xl font-black truncate">{categoryStats[0]?.category || "---"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-mono">${Math.round(categoryStats[0]?.totalRevenue || 0).toLocaleString('es-CL')}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Total Productos</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-800">{products?.length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">En todo el inventario</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white rounded-3xl border-l-4 border-destructive">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Stock Crítico</CardDescription>
            <CardTitle className="text-3xl font-black text-destructive">{products?.filter(p => p.stock < 5).length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Necesitan reposición</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-accent text-white rounded-3xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-accent-foreground/70 font-black uppercase text-[10px] tracking-widest">Unidades Vendidas</CardDescription>
            <CardTitle className="text-3xl font-black">
              {categoryStats.reduce((sum, c) => sum + c.unitsSold, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs opacity-70 font-bold uppercase tracking-widest">Volumen total histórico</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="bg-white border p-1 rounded-2xl h-14 w-full md:w-auto grid grid-cols-2 md:inline-flex mb-8 gap-2 shadow-sm">
          <TabsTrigger value="ranking" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Trophy className="w-4 h-4 mr-2" /> Top Productos
          </TabsTrigger>
          <TabsTrigger value="categorias" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <Tag className="w-4 h-4 mr-2" /> Categorías
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 space-y-4">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Los 10 Más Vendidos
              </h3>
              <div className="grid gap-3">
                {productRanking.map((prod, idx) => (
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
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <CardTitle className="text-lg font-black mb-6 uppercase tracking-tighter">Recaudación por Categoría</CardTitle>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="totalRevenue" fill="#3366CC" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <CardTitle className="text-lg font-black mb-6 uppercase tracking-tighter">Unidades por Categoría</CardTitle>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryStats} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="unitsSold" nameKey="category">
                      {categoryStats.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4">
             <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">Desglose Detallado de Stock y Ventas</h3>
             {categoryStats.map((cat, idx) => (
                <Card key={idx} className="border-none shadow-md rounded-2xl p-0 overflow-hidden bg-white">
                   <div className="flex flex-col md:flex-row">
                      <div className="p-6 md:w-1/3 flex items-center gap-4 bg-slate-50/50">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{backgroundColor: COLORS[idx % COLORS.length]}}>
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
                                  {cat.stockCritical} Alertas
                                </Badge>
                              )}
                           </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ventas Totales</p>
                          <p className="text-2xl font-black text-primary font-mono">${cat.totalRevenue.toLocaleString('es-CL')}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidades</p>
                          <p className="text-2xl font-black text-slate-700">{cat.unitsSold}</p>
                        </div>
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Salud de Stock</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full",
                                  cat.stockCritical > 0 ? "bg-destructive" : "bg-green-500"
                                )} 
                                style={{ width: `${Math.max(10, 100 - (cat.stockCritical / cat.productCount * 100))}%` }}
                              />
                            </div>
                            <span className="text-xs font-black text-slate-500">
                              {cat.stockCritical > 0 ? 'Reponer' : 'OK'}
                            </span>
                          </div>
                        </div>
                      </div>
                   </div>
                </Card>
             ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
