"use client";

import { useEffect, useState } from "react";
import { db, Sale } from "@/lib/firebase";
import { collection, query, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { DollarSign, Package, TrendingUp, Calendar, ShoppingBag, ArrowUpRight } from "lucide-react";

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState({
    daily: 0,
    monthly: 0,
    totalSales: 0,
    itemCount: 0,
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const q = query(collection(db, "ventas"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    } as Sale));
    setSales(data);

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const daily = data
      .filter(s => s.timestamp >= startOfDay)
      .reduce((sum, s) => sum + s.total, 0);

    const monthly = data
      .filter(s => s.timestamp >= startOfMonth)
      .reduce((sum, s) => sum + s.total, 0);

    const itemCount = data.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);

    setStats({
      daily,
      monthly,
      totalSales: data.length,
      itemCount
    });
  };

  // Group by day for the chart (last 7 days)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const amount = sales
      .filter(s => s.timestamp.toDateString() === d.toDateString())
      .reduce((sum, s) => sum + s.total, 0);
    return { name: dayStr, amount };
  });

  // Top products calculation
  const productStats: Record<string, number> = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      productStats[item.name] = (productStats[item.name] || 0) + item.quantity;
    });
  });

  const topProductsData = Object.entries(productStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#3366CC', '#8B4ADF', '#10b981', '#f59e0b', '#ef4444'];

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
              ${stats.daily.toFixed(2)}
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
              ${stats.monthly.toFixed(2)}
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
            <CardTitle className="text-lg">Productos Más Vendidos</CardTitle>
            <CardDescription>Top 5 por cantidad de unidades</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center">
            {topProductsData.length > 0 ? (
              <>
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
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                No hay datos suficientes
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
