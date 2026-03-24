
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2, BarChart3, ListFilter } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    if (!sales || !mounted) return { daily: 0, monthly: 0, totalSales: 0, itemCount: 0, unitsSold: 0 };

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

    // Unidades totales basadas en el resumen de items
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

  const chartData = useMemo(() => {
    if (!sales || !mounted) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toLocaleDateString('es-ES', { weekday: 'short' });
      const amount = sales
        .filter(s => {
          const sd = s.saleDateTime?.toDate?.() || new Date();
          return sd.toDateString() === d.toDateString();
        })
        .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      return { name: dayStr, amount: Math.round(amount) };
    });
  }, [sales, mounted]);

  const topProductsDetailed = useMemo(() => {
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

    return Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [sales, mounted]);

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

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
          <h1 className="text-3xl font-black text-primary">Análisis de Negocio</h1>
          <p className="text-muted-foreground">Analiza qué productos se venden más y tu rendimiento diario.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg bg-primary text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 font-black uppercase text-[10px] tracking-widest">Hoy</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between">
              ${Math.round(stats.daily).toLocaleString('es-CL')}
              <DollarSign className="w-8 h-8 opacity-20" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-primary-foreground/80 mt-2">
              <ArrowUpRight className="w-4 h-4 mr-1" /> Ingresos del día actual
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-accent text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-accent-foreground/70 font-black uppercase text-[10px] tracking-widest">Mensual</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between">
              ${Math.round(stats.monthly).toLocaleString('es-CL')}
              <TrendingUp className="w-8 h-8 opacity-20" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-accent-foreground/80 mt-2">
              <Calendar className="w-4 h-4 mr-1" /> Acumulado del mes
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Transacciones</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between text-primary">
              {stats.totalSales}
              <ShoppingBag className="w-8 h-8 text-primary/10" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-slate-400 mt-2">
              Total de boletas emitidas
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
              Cantidad total de artículos
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="bg-white border p-1 rounded-2xl h-14 w-full md:w-auto grid grid-cols-2 md:inline-flex mb-6">
          <TabsTrigger value="ventas" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" /> Rendimiento
          </TabsTrigger>
          <TabsTrigger value="productos" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <ListFilter className="w-4 h-4 mr-2" /> Top Productos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="pb-0 pt-8 px-8">
              <CardTitle className="text-2xl font-black text-slate-800">Ingresos Últimos 7 Días</CardTitle>
              <CardDescription>Visualización del flujo de caja semanal.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] p-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}
                    formatter={(value: any) => [`$${value.toLocaleString('es-CL')}`, 'Ingresos']}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40}>
                     {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 6 ? '#8B4ADF' : '#3366CC'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productos" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 border-none shadow-xl bg-white rounded-3xl">
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-black text-slate-800">Ranking de Ventas</CardTitle>
                <CardDescription>Los 10 productos con mayor rotación (unidades).</CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="space-y-4">
                  {topProductsDetailed.length > 0 ? (
                    topProductsDetailed.map((product, idx) => (
                      <div key={idx} className="flex items-center gap-4 group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shrink-0`} style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-end mb-1">
                            <span className="font-bold text-slate-700 truncate">{product.name}</span>
                            <span className="text-xs font-black text-primary">{product.quantity} uds.</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-1000" 
                              style={{ 
                                width: `${(product.quantity / topProductsDetailed[0].quantity) * 100}%`,
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
                      <p>No hay datos de productos registrados aún.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5 border-none shadow-xl bg-white rounded-3xl">
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-black text-slate-800">Distribución de Ingresos</CardTitle>
                <CardDescription>Aporte monetario por producto.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex flex-col items-center justify-center p-8">
                {topProductsDetailed.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topProductsDetailed.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="total"
                      >
                        {topProductsDetailed.slice(0, 5).map((entry, index) => (
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
