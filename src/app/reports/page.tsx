
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

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
    if (!sales || !mounted) return { daily: 0, monthly: 0, totalSales: 0, itemCount: 0 };

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

    const itemCount = sales.reduce((sum, s) => sum + (s.productSaleItemIds?.length || 0), 0);

    return {
      daily,
      monthly,
      totalSales: sales.length,
      itemCount
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

  const topProductsData = useMemo(() => {
    if (!sales || !mounted) return [];
    const productStats: Record<string, number> = {};
    sales.forEach(sale => {
      sale.productSaleItemIds?.forEach((id: string) => {
        productStats[id] = (productStats[id] || 0) + 1;
      });
    });

    return Object.entries(productStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name: `Prod ${name.slice(-4)}`, value }));
  }, [sales, mounted]);

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444'];

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">Analizando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-primary">Reportes de Negocio</h1>
          <p className="text-muted-foreground">Análisis de rendimiento y ventas en tiempo real.</p>
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
              <ArrowUpRight className="w-4 h-4 mr-1" /> Ventas del día actual
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
              Total de tickets emitidos
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Unidades</CardDescription>
            <CardTitle className="text-3xl font-black flex items-center justify-between text-accent">
              {stats.itemCount}
              <Package className="w-8 h-8 text-accent/10" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-slate-400 mt-2">
              Total productos vendidos
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Ingresos Últimos 7 Días</CardTitle>
            <CardDescription>Monto total de ventas por día</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
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

        <Card className="lg:col-span-4 border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Distribución de Ventas</CardTitle>
            <CardDescription>Top IDs de producto más frecuentes</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center">
            {topProductsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProductsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {topProductsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                No hay suficientes datos de ventas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
