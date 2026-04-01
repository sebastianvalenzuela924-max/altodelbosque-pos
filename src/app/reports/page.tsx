
"use client";

import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar, ShoppingBag, Loader2, Trophy, Banknote, CreditCard, Wallet, UtensilsCrossed, Plus, Edit3, Trash2, Check, PackageX, PackageSearch, Clock, ChevronRight, Send, Copy, X, FileText, Share2, Sun, Cloud, CloudRain, AlertCircle, Sparkles, HelpCircle, Info, Lock } from "lucide-react";
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

const DELETE_PASSWORD = "Miler";

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
  const [breadToDelete, setBreadToDelete] = useState<any | null>(null);
  const [securityKey, setSecurityKey] = useState("");
  
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

  const breadAnalysis = useMemo(() => {
    if (!allBreadLogs || allBreadLogs.length === 0) return null;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowDay = tomorrow.getDay();

    const sameDayLogs = allBreadLogs.filter(l => new Date(l.date + 'T12:00:00').getDay() === tomorrowDay);
    const avgConsumoSameDay = sameDayLogs.length > 0 
      ? sameDayLogs.reduce((sum, l) => sum + (l.bought - l.remaining), 0) / sameDayLogs.length 
      : 0;

    const recentLogs = allBreadLogs.slice(0, 7);
    const avgConsumoRecent = recentLogs.reduce((sum, l) => sum + (l.bought - l.remaining), 0) / recentLogs.length;

    const recentLeftovers = allBreadLogs.slice(0, 3).reduce((sum, l) => sum + l.remaining, 0) / 3;
    const recentQuiebres = allBreadLogs.slice(0, 5).filter(l => l.quiebre).length;

    const weatherLogs = allBreadLogs.filter(l => l.clima === tomorrowWeather);
    const avgConsumoWeather = weatherLogs.length > 0 
      ? weatherLogs.reduce((sum, l) => sum + (avgConsumoSameDay > 0 ? (l.bought - l.remaining) : 0), 0) / weatherLogs.length 
      : 0;

    let base = avgConsumoSameDay > 0 ? (avgConsumoSameDay * 0.7 + avgConsumoRecent * 0.3) : avgConsumoRecent;
    
    if (avgConsumoWeather > 0) {
      base = (base * 0.6) + (avgConsumoWeather * 0.4);
    } else {
      if (tomorrowWeather === "Lluvia") base *= 0.85;
      if (tomorrowWeather === "Sol") base *= 1.05;
    }

    let sugerencia = base;
    let explanationSuffix = "Sugerencia redondeada.";

    if (recentQuiebres > 0) {
      sugerencia = Math.ceil(sugerencia); 
      explanationSuffix = "Redondeado por faltantes recientes.";
    } else if (recentLeftovers > 2) {
      sugerencia = Math.floor(sugerencia); 
      explanationSuffix = "Redondeado por sobrante alto.";
    } else {
      sugerencia = Math.round(sugerencia); 
    }

    const sugerenciaFinal = Math.max(1, sugerencia);

    const insights = [];
    if (recentLeftovers > 3) insights.push("Sobrante alto, baja el pedido.");
    if (recentQuiebres > 0) insights.push("Faltó pan recientemente.");
    if (tomorrowWeather === "Lluvia") insights.push("Con lluvia se vende menos.");

    let razon = `Promedio histórico y tendencia reciente. ${explanationSuffix}`;

    return { sugerencia: sugerenciaFinal, insights, razon };
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

  const handleDeleteBreadLog = () => {
    if (!breadToDelete) return;
    if (securityKey !== DELETE_PASSWORD) {
      toast({ title: "Clave incorrecta", variant: "destructive" });
      return;
    }

    deleteDocumentNonBlocking(doc(firestore, "breadLogs", breadToDelete.id));
    toast({ title: "Registro eliminado" });
    setBreadToDelete(null);
    setSecurityKey("");
  };

  const generateDailySummary = () => {
    const today = new Date();
    let dateLabel = "";

    if (dateFilter === "today") {
      dateLabel = today.toLocaleDateString('es-CL');
    } else if (dateFilter === "yesterday") {
      const yest = new Date(today);
      yest.setDate(today.getDate() - 1);
      dateLabel = yest.toLocaleDateString('es-CL');
    } else if (dateFilter === "custom" && customDate) {
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
          <TabsTrigger value="top" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="bread" className="mt-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <Sparkles className="w-3 h-3 text-accent" /> Recomendación Inteligente
            </h3>
            <Card className="border-none shadow-lg rounded-2xl bg-white overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="p-6 bg-slate-900 text-white flex flex-row md:flex-col items-center justify-between md:justify-center md:text-center md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800">
                   <div className="flex flex-col md:items-center">
                     <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-1">Pedido sugerido</p>
                     <h2 className="text-4xl font-black font-mono tracking-tighter leading-none">
                       {breadAnalysis?.sugerencia || "--"} <span className="text-sm">kg</span>
                     </h2>
                   </div>
                   <div className="flex gap-1.5 md:mt-4">
                      <Badge variant="outline" className="border-white/20 text-white font-black text-[7px] uppercase px-1.5 py-0.5">
                        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][(new Date().getDay() + 1) % 7]}
                      </Badge>
                      <Badge className="bg-accent text-white font-black text-[7px] uppercase px-1.5 py-0.5">
                        {tomorrowWeather}
                      </Badge>
                   </div>
                </div>
                <div className="p-5 flex-1 space-y-4">
                   <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase text-slate-400">¿Clima mañana?</p>
                     <div className="flex gap-2">
                       {(["Sol", "Nubes", "Lluvia"] as ClimaType[]).map(c => {
                         const Icon = ClimaIcons[c];
                         return (
                           <Button 
                             key={c} 
                             variant={tomorrowWeather === c ? 'default' : 'outline'}
                             className={cn("rounded-xl h-10 px-3 gap-2 font-bold flex-1", tomorrowWeather === c && "bg-accent hover:bg-accent/90 border-accent")}
                             onClick={() => setTomorrowWeather(c)}
                           >
                             <Icon className="w-3 h-3" /> <span className="text-[9px] uppercase">{c}</span>
                           </Button>
                         );
                       })}
                     </div>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                     <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                     <p className="text-[10px] font-bold text-slate-600 leading-tight italic">
                       {breadAnalysis?.razon || "Aún no hay suficientes datos."}
                     </p>
                   </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-3" ref={breadFormRef}>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <Edit3 className="w-3 h-3 text-primary" /> {editingBreadLog ? 'Editar Registro' : 'Nuevo Registro'}
            </h3>
            <Card className="border-none shadow-sm rounded-2xl bg-white p-4 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                 <Badge variant="outline" className="text-[7px] font-black uppercase bg-slate-50 text-primary border-slate-200">
                    {editingBreadLog ? editingBreadLog.date : (dateFilter === 'today' ? 'Hoy' : dateFilter === 'yesterday' ? 'Ayer' : customDate || 'Hoy')}
                 </Badge>
                 <div className="flex items-center gap-3">
                   <Label className="text-[8px] font-black uppercase text-slate-400">¿Faltó?</Label>
                   <Switch checked={breadQuiebre} onCheckedChange={setBreadQuiebre} />
                 </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-slate-400">Comprado</Label>
                  <Input type="number" step="0.1" className="h-9 rounded-xl bg-slate-50 border-none font-black text-center" value={breadBought} onChange={(e) => setBreadBought(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-slate-400">Sobrante</Label>
                  <Input type="number" step="0.1" className="h-9 rounded-xl bg-slate-50 border-none font-black text-center" value={breadRemaining} onChange={(e) => setBreadRemaining(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase text-slate-400">Clima</Label>
                  <Select value={breadClima} onValueChange={(v: ClimaType) => setBreadClima(v)}>
                    <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none font-bold text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Sol">Soleado</SelectItem>
                      <SelectItem value="Nubes">Nublado</SelectItem>
                      <SelectItem value="Lluvia">Lluvia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col justify-end">
                  <Button className="h-9 rounded-xl bg-primary font-black uppercase tracking-widest text-[9px] w-full" onClick={handleSaveBreadLog}>
                    {editingBreadLog ? 'OK' : 'Guardar'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                 <Label className="text-[8px] font-black uppercase text-slate-400">Observaciones</Label>
                 <Input 
                    className="h-9 rounded-xl bg-slate-50 border-none font-bold text-[10px] px-3" 
                    placeholder="Ejem: Día festivo..." 
                    value={breadObservation} 
                    onChange={e => setBreadObservation(e.target.value)} 
                 />
              </div>
            </Card>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <Clock className="w-3 h-3" /> Historial
            </h3>
            <div className="space-y-2">
              {allBreadLogs?.slice(0, 5).map((log) => {
                const date = new Date(log.date + 'T12:00:00');
                const ClimaIcon = ClimaIcons[log.clima as ClimaType] || Sun;
                
                return (
                  <Card key={log.id} className="border-none shadow-sm rounded-xl bg-white p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border flex flex-col items-center justify-center text-slate-800 shrink-0">
                        <span className="text-[6px] font-black uppercase text-slate-400 leading-none">{date.toLocaleDateString('es-CL', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{date.getDate()}</span>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[9px] font-black text-slate-800 uppercase truncate">{date.toLocaleDateString('es-CL', { weekday: 'short' })}</p>
                          <ClimaIcon className="w-3 h-3 text-slate-400" />
                          {log.quiebre && <Badge className="bg-destructive text-white text-[6px] font-black uppercase py-0 px-1 rounded">Faltó</Badge>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right flex flex-col">
                        <span className="text-[11px] font-black text-primary leading-tight">{log.bought}kg</span>
                        <span className="text-[9px] font-bold text-destructive/70 leading-tight">Quedó {log.remaining}</span>
                      </div>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => { 
                          setEditingBreadLog(log); 
                          setBreadBought(log.bought.toString()); 
                          setBreadRemaining(log.remaining.toString()); 
                          setBreadClima((log.clima as ClimaType) || "Sol");
                          setBreadQuiebre(!!log.quiebre);
                          setBreadObservation(log.observation || "");
                          breadFormRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}>
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive" onClick={() => { setSecurityKey(""); setBreadToDelete(log); }}>
                          <Trash2 className="w-3 h-3" />
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
                    <AccordionTrigger asChild className="p-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4 cursor-pointer">
                        <div className="min-w-0 text-left">
                          <h3 className="font-black text-sm uppercase text-slate-800 truncate">{cat.name}</h3>
                          <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/10">{cat.totalUnits} u.</Badge>
                        </div>
                        <p className="text-lg font-black font-mono text-primary">${cat.totalRev.toLocaleString('es-CL')}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 bg-slate-50/50">
                      <div className="space-y-1.5 mt-2">
                        {cat.products.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-600 text-left">{p.name}</span>
                            <div className="text-right shrink-0 ml-2">
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
                    <AccordionTrigger asChild className="p-4 hover:no-underline text-left">
                      <div className="flex items-center justify-between w-full pr-4 cursor-pointer">
                        <div className="min-w-0 text-left">
                          <h3 className="font-black text-sm uppercase text-slate-800 truncate">{cat.name}</h3>
                          <Badge variant="outline" className="text-[8px] bg-slate-50 text-slate-400 border-slate-200">{cat.products.length} productos</Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 bg-slate-50/50">
                      <div className="space-y-1.5 mt-2">
                        {cat.products.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-600 text-left">{p.name}</span>
                            <Badge variant="outline" className="text-[9px] font-black bg-white border-slate-200 shrink-0 ml-2">Stock: {p.stock}</Badge>
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
                  <div className="flex-1 min-w-0 text-left">
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

      {/* DIÁLOGOS DE SEGURIDAD PARA PAN */}
      <Dialog open={!!breadToDelete} onOpenChange={(open) => !open && setBreadToDelete(null)}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
               <Lock className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-black text-destructive uppercase">Confirmar Borrado</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold py-2">
              Ingresa la clave para eliminar el registro de pan del día {breadToDelete?.date}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <Input 
                type="password"
                placeholder="Clave"
                className="h-12 rounded-xl text-center font-black text-lg border-2 border-destructive/20 focus-visible:ring-destructive"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
              />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="ghost" className="rounded-xl h-12 font-bold" onClick={() => setBreadToDelete(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl h-12 font-black uppercase"
              disabled={securityKey !== DELETE_PASSWORD}
              onClick={handleDeleteBreadLog}
            >
              ELIMINAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
