
"use client";

import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar, ShoppingBag, Loader2, Trophy, Banknote, CreditCard, Wallet, UtensilsCrossed, Plus, Edit3, Trash2, Check, PackageX, PackageSearch, Clock, ChevronRight, Send, Copy, X, FileText, Share2, Sun, Cloud, CloudRain, AlertCircle, Sparkles, HelpCircle, Info } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";
type ClimaType = "Sol" | "Nubes" | "Lluvia";

/**
 * Helper to get a local date string in YYYY-MM-DD format.
 */
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ClimaIcons: Record<ClimaType, any> = {
  "Sol": Sun,
  "Nubes": Cloud,
  "Lluvia": CloudRain
};

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  
  // Bread states
  const [breadBought, setBreadBought] = useState("");
  const [breadRemaining, setBreadRemaining] = useState("");
  const [breadClima, setBreadClima] = useState<ClimaType>("Sol");
  const [breadQuiebre, setBreadQuiebre] = useState(false);
  const [breadObservation, setBreadObservation] = useState("");
  const [tomorrowWeather, setTomorrowWeather] = useState<ClimaType>("Sol");
  
  const [editingBreadLog, setEditingBreadLog] = useState<any | null>(null);
  const breadFormRef = useRef<HTMLDivElement>(null);

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const breadLogsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "breadLogs"), orderBy("date", "desc"));
  }, [firestore]);

  const { data: allSales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection(productsQuery);
  const { data: allBreadLogs, isLoading: isLoadingBread } = useCollection(breadLogsQuery);

  const filteredSales = useMemo(() => {
    if (!allSales || !mounted) return [];
    const now = new Date();
    
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || (sale.saleDateTime ? new Date(sale.saleDateTime) : new Date());
      
      if (dateFilter === "today") return saleDate.toDateString() === now.toDateString();
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

  const stats = useMemo(() => {
    const revenue = filteredSales.filter(s => s.paymentMethod !== 'deduction').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const cash = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const card = filteredSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const inventoryValue = allProducts?.reduce((sum, p) => (p.warningStock === 0 || p.idealStock === 0) ? sum : sum + (Math.round(p.price) * (p.stock || 0)), 0) || 0;
    const transactions = filteredSales.length;
    const totalUnits = filteredSales.reduce((sum, s) => sum + (s.itemsSummary?.reduce((iSum: number, item: any) => iSum + (item.quantity || 0), 0) || 0), 0);
    
    return { revenue, cash, card, inventoryValue, transactions, totalUnits };
  }, [filteredSales, allProducts]);

  const topProducts = useMemo(() => {
    const productCounts: Record<string, any> = {};
    filteredSales.forEach(sale => {
      const isMonetary = sale.paymentMethod !== 'deduction';
      sale.itemsSummary?.forEach((item: any) => {
        if (item.type === 'product') {
          if (!productCounts[item.id]) {
            productCounts[item.id] = { name: item.name, quantity: 0, revenue: 0 };
          }
          productCounts[item.id].quantity += item.quantity;
          if (isMonetary) productCounts[item.id].revenue += (item.price * item.quantity);
        }
      });
    });
    return Object.values(productCounts).sort((a: any, b: any) => b.quantity - a.quantity).slice(0, 3);
  }, [filteredSales]);

  const salesAnalysis = useMemo(() => {
    if (!allProducts || !mounted) return { categoriesWithSales: [], categoriesWithNoSales: [] };
    
    const soldMap: Record<string, number> = {};
    const revenueMap: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      const isMonetary = sale.paymentMethod !== 'deduction';
      sale.itemsSummary?.forEach((item: any) => {
        if (item.id) {
          soldMap[item.id] = (soldMap[item.id] || 0) + item.quantity;
          if (isMonetary) {
            revenueMap[item.id] = (revenueMap[item.id] || 0) + (item.price * item.quantity);
          }
        }
      });
    });

    const categoriesWithSales: Record<string, any> = {};
    const categoriesNoSales: Record<string, any> = {};

    allProducts.forEach(p => {
      const sold = soldMap[p.id] || 0;
      const rev = revenueMap[p.id] || 0;
      const catName = p.category || "General";
      
      if (sold > 0) {
        if (!categoriesWithSales[catName]) {
          categoriesWithSales[catName] = { name: catName, totalRev: 0, totalUnits: 0, products: [] };
        }
        categoriesWithSales[catName].totalRev += Math.round(rev);
        categoriesWithSales[catName].totalUnits += sold;
        categoriesWithSales[catName].products.push({ ...p, sold, rev });
      } else {
        if (!categoriesNoSales[catName]) {
          categoriesNoSales[catName] = { name: catName, products: [] };
        }
        categoriesNoSales[catName].products.push(p);
      }
    });

    return { 
      categoriesWithSales: Object.values(categoriesWithSales).sort((a: any, b: any) => b.totalRev - a.totalRev),
      categoriesWithNoSales: Object.values(categoriesNoSales).sort((a: any, b: any) => a.name.localeCompare(b.name))
    };
  }, [filteredSales, allProducts, mounted]);

  // LOGICA RECOMENDACION PAN
  const breadAnalysis = useMemo(() => {
    if (!allBreadLogs || allBreadLogs.length === 0) return null;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowDay = tomorrow.getDay(); // 0-6

    // 1. Promedio histórico mismo día de la semana
    const sameDayLogs = allBreadLogs.filter(l => new Date(l.date + 'T12:00:00').getDay() === tomorrowDay);
    const avgConsumoSameDay = sameDayLogs.length > 0 
      ? sameDayLogs.reduce((sum, l) => sum + (l.bought - l.remaining), 0) / sameDayLogs.length 
      : 0;

    // 2. Comportamiento reciente (últimos 7 días)
    const recentLogs = allBreadLogs.slice(0, 7);
    const avgConsumoRecent = recentLogs.reduce((sum, l) => sum + (l.bought - l.remaining), 0) / recentLogs.length;

    // 3. Análisis de sobrantes recientes (últimos 3 días)
    const recentLeftovers = allBreadLogs.slice(0, 3).reduce((sum, l) => sum + l.remaining, 0) / 3;
    
    // 4. Quiebres recientes
    const recentQuiebres = allBreadLogs.slice(0, 5).filter(l => l.quiebre).length;

    // 5. Análisis clima histórico
    const weatherLogs = allBreadLogs.filter(l => l.clima === tomorrowWeather);
    const avgConsumoWeather = weatherLogs.length > 0 
      ? weatherLogs.reduce((sum, l) => sum + (l.bought - l.remaining), 0) / weatherLogs.length 
      : 0;

    // CALCULO DE SUGERENCIA
    let base = avgConsumoSameDay > 0 ? (avgConsumoSameDay * 0.7 + avgConsumoRecent * 0.3) : avgConsumoRecent;
    
    // Ajuste por clima esperado
    if (avgConsumoWeather > 0) {
      base = (base * 0.6) + (avgConsumoWeather * 0.4);
    } else {
      if (tomorrowWeather === "Lluvia") base *= 0.85; // Menos gente con lluvia
      if (tomorrowWeather === "Sol") base *= 1.05; // Más gente con sol
    }

    // Ajuste por sobrantes excesivos
    if (recentLeftovers > 2) base *= 0.9; 
    
    // Ajuste por quiebres frecuentes
    if (recentQuiebres >= 1) base *= 1.15;

    const sugerencia = Math.max(2, Math.round(base * 10) / 10);

    // INSIGHTS
    const insights = [];
    if (recentLeftovers > 3) insights.push("Llevas varios días con sobrante alto, sugerimos bajar el pedido.");
    if (recentQuiebres > 0) insights.push("Últimamente faltó pan antes del cierre, se aumenta un poco la sugerencia.");
    if (tomorrowWeather === "Lluvia") insights.push("Con lluvia normalmente se vende menos pan.");
    if (sameDayLogs.length > 0 && avgConsumoSameDay < avgConsumoRecent) insights.push(`Los ${["Domingos","Lunes","Martes","Miércoles","Jueves","Viernes","Sábados"][tomorrowDay]} suele sobrar más pan.`);

    // Razonamiento
    let razon = `Basado en el promedio de los ${["Domingos","Lunes","Martes","Miércoles","Jueves","Viernes","Sábados"][tomorrowDay]} (${avgConsumoSameDay.toFixed(1)}kg) y la tendencia reciente.`;
    if (tomorrowWeather === "Lluvia") razon += " Ajustado a la baja por lluvia esperada.";
    if (recentQuiebres > 0) razon += " Aumentado porque recientemente faltó pan.";

    return { sugerencia, insights, razon };
  }, [allBreadLogs, tomorrowWeather]);

  const handleSaveBreadLog = () => {
    if (!breadBought || !breadRemaining) {
      toast({ title: "Faltan datos", variant: "destructive" });
      return;
    }

    let targetDateStr = "";
    if (editingBreadLog) {
      targetDateStr = editingBreadLog.date;
    } else {
      const now = new Date();
      if (dateFilter === "today") targetDateStr = getLocalDateString(now);
      else if (dateFilter === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        targetDateStr = getLocalDateString(yesterday);
      } else if (dateFilter === "custom" && customDate) {
        targetDateStr = customDate;
      } else {
        targetDateStr = getLocalDateString(now);
      }
    }

    const docRef = doc(firestore, "breadLogs", targetDateStr);

    setDocumentNonBlocking(docRef, {
      id: targetDateStr,
      date: targetDateStr,
      bought: parseFloat(breadBought) || 0,
      remaining: parseFloat(breadRemaining) || 0,
      clima: breadClima || "Sol",
      quiebre: !!breadQuiebre,
      observation: (breadObservation || "").trim(),
      timestamp: serverTimestamp()
    }, { merge: true });
    
    toast({ title: editingBreadLog ? "Registro actualizado" : "Registro guardado", description: `Fecha: ${targetDateStr}` });
    
    // Clear form
    setBreadBought(""); 
    setBreadRemaining(""); 
    setBreadObservation(""); 
    setBreadQuiebre(false); 
    setBreadClima("Sol");
    setEditingBreadLog(null);
  };

  const cancelEdit = () => {
    setEditingBreadLog(null);
    setBreadBought("");
    setBreadRemaining("");
    setBreadClima("Sol");
    setBreadQuiebre(false);
    setBreadObservation("");
  };

  const generateDailySummary = () => {
    const today = new Date();
    let targetDateStr = "";
    let dateLabel = "";

    if (dateFilter === "today") {
      targetDateStr = getLocalDateString(today);
      dateLabel = today.toLocaleDateString('es-CL');
    } else if (dateFilter === "yesterday") {
      const yest = new Date(today);
      yest.setDate(today.getDate() - 1);
      targetDateStr = getLocalDateString(yest);
      dateLabel = yest.toLocaleDateString('es-CL');
    } else if (dateFilter === "custom" && customDate) {
      targetDateStr = customDate;
      const [y, m, d] = customDate.split('-').map(Number);
      dateLabel = new Date(y, m - 1, d).toLocaleDateString('es-CL');
    } else {
      dateLabel = "Mes Seleccionado";
    }
    
    let text = `📊 *Resumen del día - ${dateLabel}*\n\n`;
    
    text += `💰 *Ingresos totales:* $${Math.round(stats.revenue).toLocaleString('es-CL')}\n`;
    text += `💵 *Efectivo:* $${Math.round(stats.cash).toLocaleString('es-CL')}\n`;
    text += `💳 *Tarjeta:* $${Math.round(stats.card).toLocaleString('es-CL')}\n`;
    text += `📦 *Valor inventario:* $${Math.round(stats.inventoryValue).toLocaleString('es-CL')}\n\n`;

    if (targetDateStr) {
      const breadLog = allBreadLogs?.find(l => l.id === targetDateStr);
      if (breadLog) {
        text += `🥖 *Control de Pan:*\n`;
        text += `- Comprado: ${breadLog.bought} kg\n`;
        text += `- Quedó: ${breadLog.remaining} kg\n`;
        text += `- Vendido: ${(breadLog.bought - breadLog.remaining).toFixed(2)} kg\n\n`;
      }
    }

    if (stats.transactions > 0) text += `🧾 *Transacciones:* ${stats.transactions}\n`;
    if (stats.totalUnits > 0) text += `📚 *Unidades vendidas:* ${stats.totalUnits}\n\n`;

    if (topProducts.length > 0) {
      text += `🏆 *Top productos:*\n`;
      topProducts.forEach((p: any) => {
        text += `- ${p.name}: ${p.quantity} u.\n`;
      });
      text += `\n`;
    }

    text += `✅ Resumen generado desde la app`;

    setSummaryText(text);
    setIsSummaryOpen(true);
  };

  if (!mounted || isLoadingSales || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-30">
        <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest">Generando Reportes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tighter uppercase flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Reportes
          </h1>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Estadísticas y control inteligente.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={generateDailySummary} className="rounded-2xl h-11 px-6 font-black uppercase text-[10px] bg-accent shadow-lg shadow-accent/20">
            <Share2 className="w-4 h-4 mr-2" /> Generar Resumen
          </Button>

          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="w-full md:w-[160px] rounded-2xl h-11 border-none bg-slate-100 font-bold">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="yesterday">Ayer</SelectItem>
              <SelectItem value="custom">Calendario</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm bg-primary text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Total Ventas</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.revenue).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="border-none shadow-sm bg-green-600 text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Efectivo</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.cash).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="border-none shadow-sm bg-blue-600 text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Tarjeta</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.card).toLocaleString('es-CL')}</p>
        </Card>
        <Card className="border-none shadow-sm bg-accent text-white rounded-2xl p-4">
          <p className="text-[8px] font-black uppercase text-white/60 mb-1">Valor Stock</p>
          <p className="text-xl font-black font-mono tracking-tighter">${Math.round(stats.inventoryValue).toLocaleString('es-CL')}</p>
        </Card>
      </section>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full grid grid-cols-4">
          <TabsTrigger value="sales" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Ventas</TabsTrigger>
          <TabsTrigger value="no-sales" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Sin Ventas</TabsTrigger>
          <TabsTrigger value="bread" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Control Pan</TabsTrigger>
          <TabsTrigger value="top" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Top</TabsTrigger>
        </TabsList>

        <TabsContent value="bread" className="mt-6 space-y-8">
          {/* BLOQUE 1: RECOMENDACIÓN INTELIGENTE */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
              <Sparkles className="w-4 h-4 text-accent" /> Análisis y Recomendación
            </h3>
            <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-8 bg-slate-900 text-white flex flex-col justify-center items-center text-center space-y-4">
                   <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20">
                     <UtensilsCrossed className="w-8 h-8" />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Sugerencia para Mañana</p>
                     <h2 className="text-6xl font-black font-mono tracking-tighter">
                       {breadAnalysis?.sugerencia || "---"} <span className="text-xl">kg</span>
                     </h2>
                   </div>
                   <div className="flex gap-2">
                      <Badge variant="outline" className="border-white/20 text-white font-black text-[9px] uppercase">
                        {["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][(new Date().getDay() + 1) % 7]}
                      </Badge>
                      <Badge className="bg-accent text-white font-black text-[9px] uppercase">Clima: {tomorrowWeather}</Badge>
                   </div>
                </div>
                <div className="p-8 space-y-6 flex flex-col justify-center">
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400">¿Cómo estará el clima mañana?</Label>
                     <div className="grid grid-cols-3 gap-2">
                       {(["Sol", "Nubes", "Lluvia"] as ClimaType[]).map(c => {
                         const Icon = ClimaIcons[c];
                         return (
                           <Button 
                             key={c} 
                             variant={tomorrowWeather === c ? 'default' : 'outline'}
                             className={cn("rounded-xl h-12 gap-2 font-bold", tomorrowWeather === c && "bg-accent hover:bg-accent/90")}
                             onClick={() => setTomorrowWeather(c)}
                           >
                             <Icon className="w-4 h-4" /> <span className="text-[10px] uppercase">{c}</span>
                           </Button>
                         );
                       })}
                     </div>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                     <div className="flex items-start gap-3">
                       <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                       <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                         {breadAnalysis?.razon || "Aún no hay suficientes datos para una recomendación precisa."}
                       </p>
                     </div>
                   </div>
                </div>
              </div>
            </Card>
          </section>

          {/* BLOQUE 2: REGISTRO DIARIO MEJORADO */}
          <section className="space-y-4" ref={breadFormRef}>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
              <Edit3 className="w-4 h-4 text-primary" /> {editingBreadLog ? 'Editando Registro' : 'Registro Diario'}
            </h3>
            <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-6">
              <div className="flex justify-between items-center pb-2 border-b">
                 <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-slate-50 text-primary border-slate-200">
                    Fecha Registro: {editingBreadLog ? editingBreadLog.date : (dateFilter === 'today' ? 'Hoy' : dateFilter === 'yesterday' ? 'Ayer' : customDate || 'Seleccionada')}
                 </Badge>
                 <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1.5">
                     <Label className="text-[9px] font-black uppercase text-slate-400">¿Pidieron más?</Label>
                     <TooltipProvider>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <HelpCircle className="w-3.5 h-3.5 text-slate-300 cursor-help" />
                         </TooltipTrigger>
                         <TooltipContent className="max-w-[200px] text-[10px] font-bold p-3">
                           Marca "SÍ" si el pan se terminó antes del cierre y hubo que pedir un refuerzo o se perdió venta. Ayuda a la IA a pedir más mañana.
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                   </div>
                   <Switch checked={breadQuiebre} onCheckedChange={setBreadQuiebre} />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Pan Comprado (kg)</Label>
                  <Input type="number" step="0.1" className="h-12 rounded-2xl bg-slate-50 border-none font-black text-lg text-center" placeholder="0.0" value={breadBought} onChange={(e) => setBreadBought(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Pan Sobrante (kg)</Label>
                  <Input type="number" step="0.1" className="h-12 rounded-2xl bg-slate-50 border-none font-black text-lg text-center" placeholder="0.0" value={breadRemaining} onChange={(e) => setBreadRemaining(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Clima del Día</Label>
                  <Select value={breadClima} onValueChange={(v: ClimaType) => setBreadClima(v)}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="Sol">Soleado</SelectItem>
                      <SelectItem value="Nubes">Nublado</SelectItem>
                      <SelectItem value="Lluvia">Lluvia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col justify-end gap-2">
                  <Button className="h-12 rounded-2xl bg-primary font-black uppercase tracking-widest text-[10px]" onClick={handleSaveBreadLog}>
                    {editingBreadLog ? 'Actualizar' : 'Guardar Registro'}
                  </Button>
                  {editingBreadLog && (
                    <Button variant="ghost" className="h-10 rounded-xl text-slate-400 font-bold uppercase text-[9px]" onClick={cancelEdit}>
                      Cancelar Edición
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Observaciones (Opcional)</Label>
                 <Textarea 
                    className="rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                    placeholder="Eje: Día festivo, evento especial..." 
                    value={breadObservation} 
                    onChange={e => setBreadObservation(e.target.value)} 
                 />
              </div>
            </Card>
          </section>

          {/* BLOQUE 3: INSIGHTS AUTOMÁTICOS */}
          {breadAnalysis && breadAnalysis.insights.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
                <HelpCircle className="w-4 h-4 text-amber-500" /> Insights y Alertas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {breadAnalysis.insights.map((insight, idx) => (
                  <Card key={idx} className="border-none shadow-sm bg-amber-50 text-amber-700 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold leading-tight">{insight}</span>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* BLOQUE 4: HISTORIAL MEJORADO */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
              <Clock className="w-4 h-4" /> Historial de Control
            </h3>
            <div className="space-y-2">
              {allBreadLogs?.map((log) => {
                const date = new Date(log.date + 'T12:00:00');
                const ClimaIcon = ClimaIcons[log.clima as ClimaType] || Sun;
                
                return (
                  <Card key={log.id} className="border-none shadow-sm rounded-2xl bg-white p-3 md:p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-50 border flex flex-col items-center justify-center text-slate-800 shrink-0">
                        <span className="text-[6px] md:text-[7px] font-black uppercase text-slate-400 leading-none">{date.toLocaleDateString('es-CL', { month: 'short' })}</span>
                        <span className="text-lg md:text-xl font-black leading-none">{date.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-800 uppercase truncate">{date.toLocaleDateString('es-CL', { weekday: 'long' })}</p>
                          <ClimaIcon className="w-3 h-3 text-slate-400" />
                          {log.quiebre && <Badge className="bg-destructive text-white text-[6px] md:text-[7px] font-black uppercase py-0 px-1 rounded whitespace-nowrap">Pidieron más?</Badge>}
                        </div>
                        {log.observation && <p className="text-[8px] text-slate-400 italic mt-0.5 truncate max-w-[120px] md:max-w-[200px]">"{log.observation}"</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 md:gap-6 shrink-0">
                      <div className="flex flex-col text-right">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                           <span className="text-[7px] font-bold text-slate-400 uppercase hidden sm:inline">Comprado:</span>
                           <span className="text-[7px] font-bold text-slate-400 uppercase sm:hidden">C:</span>
                           <span className="text-[11px] md:text-sm font-black text-primary">{log.bought}kg</span>
                        </div>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                           <span className="text-[7px] font-bold text-slate-400 uppercase hidden sm:inline">Quedó:</span>
                           <span className="text-[7px] font-bold text-slate-400 uppercase sm:hidden">Q:</span>
                           <span className="text-[11px] md:text-sm font-black text-destructive">{log.remaining}kg</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 md:gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 rounded-full" onClick={() => { 
                          setEditingBreadLog(log); 
                          setBreadBought(log.bought.toString()); 
                          setBreadRemaining(log.remaining.toString()); 
                          setBreadClima((log.clima as ClimaType) || "Sol");
                          setBreadQuiebre(!!log.quiebre);
                          setBreadObservation(log.observation || "");
                          breadFormRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}>
                          <Edit3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 rounded-full text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, "breadLogs", log.id))}>
                          <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="sales" className="mt-6 space-y-3">
          {salesAnalysis.categoriesWithSales.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin ventas en este periodo</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {salesAnalysis.categoriesWithSales.map((cat, idx) => (
                <AccordionItem key={idx} value={`sales-${idx}`} className="border-none">
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <AccordionTrigger className="p-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="min-w-0">
                          <h3 className="font-black text-sm uppercase text-slate-800 truncate">{cat.name}</h3>
                          <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/10">{cat.totalUnits} u.</Badge>
                        </div>
                        <p className="text-lg font-black font-mono text-primary">${cat.totalRev.toLocaleString('es-CL')}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 bg-slate-50/50">
                      <div className="space-y-1.5">
                        {cat.products.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-600">{p.name}</span>
                            <div className="text-right">
                              <span className="font-black text-primary mr-2">{p.sold} u.</span>
                              <span className="font-black font-mono">${Math.round(p.rev).toLocaleString('es-CL')}</span>
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
        </TabsContent>

        <TabsContent value="no-sales" className="mt-6 space-y-3">
          {salesAnalysis.categoriesWithNoSales.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Todos los productos tienen ventas</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {salesAnalysis.categoriesWithNoSales.map((cat, idx) => (
                <AccordionItem key={idx} value={`nosales-${idx}`} className="border-none">
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                    <AccordionTrigger className="p-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="min-w-0">
                          <h3 className="font-black text-sm uppercase text-slate-800 truncate">{cat.name}</h3>
                          <Badge variant="outline" className="text-[8px] bg-slate-50 text-slate-400 border-slate-200">{cat.products.length} productos</Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 bg-slate-50/50">
                      <div className="space-y-1.5">
                        {cat.products.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-600">{p.name}</span>
                            <Badge variant="outline" className="text-[9px] font-black bg-white border-slate-200">Stock: {p.stock}</Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="top" className="mt-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Ranking de Movimiento
            </h3>
            <div className="space-y-4">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs", idx < 3 ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.name}</p>
                    <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(p.quantity / (topProducts[0]?.quantity || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 min-w-[80px]">
                    <p className="text-xs font-black text-primary">{p.quantity} u.</p>
                    <p className="text-[10px] font-bold text-slate-400 font-mono">${Math.round(p.revenue).toLocaleString('es-CL')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-[90vw] sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-primary uppercase">
              <Share2 className="w-6 h-6" /> Vista Previa Resumen
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 whitespace-pre-wrap font-mono text-[10px] md:text-xs leading-relaxed max-h-[40vh] overflow-y-auto">
            {summaryText}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 mt-6">
            <Button variant="outline" className="rounded-xl h-12 font-bold gap-2" onClick={() => { navigator.clipboard.writeText(summaryText); toast({ title: "Copiado" }); }}>
              <Copy className="w-4 h-4" /> Copiar
            </Button>
            <Button className="rounded-xl h-12 font-black uppercase text-[10px] bg-green-600 hover:bg-green-700" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank')}>
              <Send className="w-4 h-4" /> WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
