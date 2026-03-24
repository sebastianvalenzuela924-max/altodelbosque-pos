"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2, ListFilter, Table as TableIcon, CalendarDays, ChevronRight, Clock, Tag, AlertTriangle } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [rankingFilter, setRankingFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');
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

  const stats = useMemo(() => {
    if (!sales || !mounted) return { daily: 0, monthly: 0, totalSales: 0, unitsSold: 0 };
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daily = sales.filter(s => (s.saleDateTime?.toDate?.() || new Date()) >= startOfDay).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const monthly = sales.filter(s => (s.saleDateTime?.toDate?.() || new Date()) >= startOfMonth).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const unitsSold = sales.reduce((sum, s) => sum + (s.itemsSummary?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0);
    return { daily, monthly, totalSales: sales.length, unitsSold };
  }, [sales, mounted]);

  const categoryStats = useMemo(() => {
    if (!sales || !mounted) return [];
    const stats: Record<string, { category: string, total: number, units: number }> = {};
    sales.forEach(sale => {
      sale.itemsSummary?.forEach((item: any) => {
        const cat = item.category || (products?.find(p => p.id === item.id)?.category) || "General";
        if (!stats[cat]) stats[cat] = { category: cat, total: 0, units: 0 };
        stats[cat].total += Math.round(item.price * item.quantity) || 0;
        stats[cat].units += item.quantity || 0;
      });
    });
    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [sales, products, mounted]);

  const stockAlertsByCategory = useMemo(() => {
    if (!products || !mounted) return [];
    const alerts: Record<string, { category: string, lowStockCount: number, products: any[] }> = {};
    products.forEach(p => {
      if (p.stock < 5) {
        const cat = p.category || "General";
        if (!alerts[cat]) alerts[cat] = { category: cat, lowStockCount: 0, products: [] };
        alerts[cat].lowStockCount++;
        alerts[cat].products.push(p);
      }
    });
    return Object.values(alerts).sort((a, b) => b.lowStockCount - a.lowStockCount);
  }, [products, mounted]);

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">Analizando ventas y categorías...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Reportes de Categorías</h1>
          <p className="text-muted-foreground">Analiza el rendimiento por tipo de producto.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg bg-primary text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 font-black uppercase text-[10px] tracking-widest">Recaudación Categoría Top</CardDescription>
            <CardTitle className="text-2xl font-black flex items-center justify-between">
              {categoryStats[0]?.category || "N/A"}
              <Tag className="w-6 h-6 opacity-20" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">${Math.round(categoryStats[0]?.total || 0).toLocaleString('es-CL')}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Alertas de Reposición</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between text-destructive">
              {products?.filter(p => p.stock < 5).length || 0}
              <AlertTriangle className="w-8 h-8 opacity-20" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-400">Productos con stock crítico</div>
          </CardContent>
        </Card>

        {/* ... Otros stats ... */}
      </div>

      <Tabs defaultValue="categorias" className="w-full">
        <TabsList className="bg-white border p-1 rounded-2xl h-14 w-full md:w-auto grid grid-cols-2 md:inline-flex mb-6 gap-2">
          <TabsTrigger value="categorias" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <Tag className="w-4 h-4 mr-2" /> Por Categoría
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" /> Necesitan Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <CardTitle className="text-xl font-black mb-6">Ventas por Categoría ($)</CardTitle>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="total" fill="#3366CC" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <CardTitle className="text-xl font-black mb-6">Distribución de Unidades</CardTitle>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryStats} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="units" nameKey="category">
                      {categoryStats.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '16px'}} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4">
             {categoryStats.map((cat, idx) => (
                <Card key={idx} className="border-none shadow-md rounded-2xl p-6 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black" style={{backgroundColor: COLORS[idx % COLORS.length]}}>
                         {cat.category[0]}
                      </div>
                      <div>
                         <h3 className="font-black text-slate-800">{cat.category}</h3>
                         <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{cat.units} unidades vendidas</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-2xl font-black text-primary font-mono">${cat.total.toLocaleString('es-CL')}</p>
                   </div>
                </Card>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          <div className="grid gap-6">
             {stockAlertsByCategory.length > 0 ? (
                stockAlertsByCategory.map((alert, idx) => (
                   <Card key={idx} className="border-none shadow-lg rounded-3xl overflow-hidden">
                      <div className="bg-destructive/10 p-4 px-6 flex items-center justify-between border-b border-destructive/10">
                         <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            <h3 className="font-black text-destructive uppercase tracking-tighter text-lg">{alert.category}</h3>
                         </div>
                         <Badge variant="destructive" className="rounded-full px-3 py-1 font-black uppercase text-[10px]">
                            {alert.lowStockCount} por reponer
                         </Badge>
                      </div>
                      <div className="p-0">
                         {alert.products.map((p, pIdx) => (
                            <div key={pIdx} className="p-4 px-8 border-b last:border-none flex items-center justify-between hover:bg-slate-50 transition-colors">
                               <div>
                                  <p className="font-bold text-slate-700">{p.name}</p>
                                  <p className="text-[10px] font-mono text-slate-400">SKU: {p.id}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-xs font-black uppercase text-slate-400">Stock Actual</p>
                                  <p className="text-xl font-black text-destructive">{p.stock}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   </Card>
                ))
             ) : (
                <div className="text-center py-20 bg-white rounded-3xl shadow-inner border-2 border-dashed border-slate-200">
                   <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-200" />
                   <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Stock Completo</h3>
                   <p className="text-slate-400">No hay productos por debajo del límite de seguridad.</p>
                </div>
             )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}