
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

  useEffect(() => { setMounted(true); }, []);

  const salesQuery = useMemoFirebase(() => query(collection(firestore, "sales"), orderBy("saleDateTime", "desc")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);

  const { data: allSales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection(productsQuery);

  const getStatus = (stock: number, ideal: number) => {
    const idealVal = ideal || 10;
    if (stock < idealVal * 0.25) return "danger";
    if (stock < idealVal * 0.5) return "warning";
    return "ok";
  };

  const filteredSales = useMemo(() => {
    if (!allSales || !mounted) return [];
    const now = new Date();
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || new Date();
      if (dateFilter === "today") return saleDate.toDateString() === now.toDateString();
      if (dateFilter === "yesterday") {
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        return saleDate.toDateString() === yesterday.toDateString();
      }
      if (dateFilter === "custom" && customDate) {
        const [y, m, d] = customDate.split('-').map(Number);
        return saleDate.toDateString() === new Date(y, m - 1, d).toDateString();
      }
      if (dateFilter === "month") return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [allSales, dateFilter, customDate, mounted]);

  const categoryStats = useMemo(() => {
    if (!allProducts || !mounted) return [];
    const stats: Record<string, any> = {};
    allProducts.forEach(p => {
      const cat = p.category || "General";
      const key = cat.toLowerCase();
      if (!stats[key]) stats[key] = { category: cat, totalRevenue: 0, unitsSold: 0, productCount: 0, stockCritical: 0, products: [] };
      stats[key].productCount++;
      if (getStatus(p.stock, p.idealStock) === "danger") stats[key].stockCritical++;
      stats[key].products.push(p);
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
    return Object.values(stats).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredSales, allProducts, mounted]);

  if (!mounted || isLoadingSales || isLoadingProducts) return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase">Reporte Inteligente</h1>
          <p className="text-muted-foreground">Análisis basado en stock ideal.</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="w-[180px] rounded-2xl h-12 font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="yesterday">Ayer</SelectItem>
              <SelectItem value="custom">Día Específico</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Histórico</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === "custom" && <Input type="date" className="h-12 rounded-2xl" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-white border-none rounded-3xl p-6">
          <p className="text-[10px] font-black uppercase opacity-70">Ingresos Periodo</p>
          <p className="text-3xl font-black font-mono">${Math.round(totalRevenue).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="bg-destructive text-white border-none rounded-3xl p-6">
          <p className="text-[10px] font-black uppercase opacity-70">Peligro (Reponer)</p>
          <p className="text-3xl font-black">{allProducts?.filter(p => getStatus(p.stock, p.idealStock) === "danger").length || 0}</p>
        </Card>
        <Card className="bg-white border-none shadow-md rounded-3xl p-6">
          <p className="text-[10px] font-black uppercase text-slate-400">Salud Total</p>
          <p className="text-3xl font-black text-slate-800">{Math.round((allProducts?.filter(p => getStatus(p.stock, p.idealStock) === "ok").length || 0) / (allProducts?.length || 1) * 100)}%</p>
        </Card>
      </div>

      <Accordion type="multiple" className="space-y-4">
        {categoryStats.map((cat, idx) => (
          <AccordionItem key={idx} value={`cat-${idx}`} className="border-none">
            <Card className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
              <AccordionTrigger className="hover:no-underline p-6 text-left">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-black text-primary">{cat.category[0]}</div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg uppercase tracking-tighter">{cat.category}</h3>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[8px] font-black">{cat.productCount} Prod.</Badge>
                      {cat.stockCritical > 0 && <Badge variant="destructive" className="text-[8px] font-black">REPONER YA</Badge>}
                    </div>
                  </div>
                  <div className="text-right pr-4">
                    <p className="text-[9px] font-black text-slate-400">Ventas</p>
                    <p className="text-lg font-black font-mono">${cat.totalRevenue.toLocaleString('es-CL')}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2 bg-slate-50/50">
                <div className="space-y-2">
                  {cat.products.map((p: any) => {
                    const status = getStatus(p.stock, p.idealStock);
                    return (
                      <div key={p.id} className="bg-white p-4 rounded-2xl flex items-center justify-between border">
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-[9px] text-slate-400">Stock: {p.stock} / Normal: {p.idealStock}</p>
                        </div>
                        {status === "danger" ? <ShieldAlert className="text-destructive w-5 h-5" /> : status === "warning" ? <AlertTriangle className="text-amber-500 w-5 h-5" /> : <ShieldCheck className="text-green-500 w-5 h-5" />}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
