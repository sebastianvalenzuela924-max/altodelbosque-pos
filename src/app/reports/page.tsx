
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Calendar, Loader2, Trophy, Share2, DollarSign, Calculator, Info, CheckCircle2, RotateCcw, AlertTriangle, ChevronDown, Search, Plus } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// --- CALCULADORA DE PRECIOS COMPONENT ---
function PriceCalculator({ products = [] }: { products?: any[] }) {
  const [productName, setProductName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasVat, setHasVat] = useState(true);
  const [totalPrice, setTotalPrice] = useState("");
  const [units, setUnits] = useState("1");
  const [profitPercent, setProfitPercent] = useState(30);
  const [customProfit, setCustomProfit] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const IVA = 1.19;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
      .slice(0, 5);
  }, [products, searchQuery]);

  const calculations = useMemo(() => {
    const price = parseFloat(totalPrice) || 0;
    const qty = Math.max(1, parseInt(units) || 1);
    const profit = customProfit !== "" ? (parseFloat(customProfit) || 0) : profitPercent;

    const totalNeto = hasVat ? price / IVA : price;
    const costoNeto = totalNeto / qty;
    const precioVentaSinIVA = costoNeto * (1 + profit / 100);
    const precioFinal = precioVentaSinIVA * IVA;
    const gananciaPesos = precioVentaSinIVA - costoNeto;
    const margenReal = precioVentaSinIVA > 0 ? (gananciaPesos / precioVentaSinIVA) * 100 : 0;
    const precioMinimo = costoNeto * IVA;
    const precioRedondeado = Math.ceil(precioFinal / 10) * 10;

    return {
      costoNeto,
      precioVentaSinIVA,
      precioFinal,
      gananciaPesos,
      margenReal,
      precioMinimo,
      precioRedondeado,
      totalNeto,
      profit
    };
  }, [totalPrice, units, profitPercent, customProfit, hasVat]);

  const handleSelectProduct = (p: any) => {
    setProductName(p.name);
    setTotalPrice(Math.round(p.price).toString());
    setSearchQuery("");
    setIsSearching(false);
  };

  const reset = () => {
    setProductName("");
    setSearchQuery("");
    setHasVat(true);
    setTotalPrice("");
    setUnits("1");
    setProfitPercent(30);
    setCustomProfit("");
    setShowResults(false);
  };

  const getMargenColor = (m: number) => {
    if (m >= 30) return "bg-green-100 text-green-700 border-green-200";
    if (m >= 20) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Producto con Buscador */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative z-20">
          <CardHeader className="pb-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Card 1 — Buscar Producto</Label>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Nombre o código del producto..." 
                className="pl-10 h-12 rounded-xl bg-slate-50 border-none font-bold"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearching(true);
                }}
                onFocus={() => setIsSearching(true)}
              />
            </div>

            {isSearching && searchQuery.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in zoom-in-95 duration-200">
                {searchResults.length > 0 ? (
                  searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full flex items-center justify-between p-3 hover:bg-primary/5 rounded-xl transition-colors group text-left"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-700 group-hover:text-primary">{p.name}</p>
                        <p className="text-[9px] font-mono text-slate-400 uppercase">#{p.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-xs text-primary">${Math.round(p.price).toLocaleString('es-CL')}</p>
                        <p className="text-[8px] font-bold text-slate-400">STOCK: {p.stock}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin resultados</p>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  className="w-full mt-2 h-8 text-[9px] font-black uppercase text-slate-400"
                  onClick={() => setIsSearching(false)}
                >
                  Cerrar
                </Button>
              </div>
            )}

            {productName && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-xl border border-primary/10">
                <Badge className="bg-primary text-white text-[9px] font-black uppercase">Fijado</Badge>
                <span className="text-xs font-bold text-primary truncate">{productName}</span>
                <button onClick={() => setProductName("")} className="ml-auto text-slate-400 hover:text-destructive">
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Tipo de Precio */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="pb-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Card 2 — Tipo de precio</Label>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setHasVat(true)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-left flex flex-col gap-1",
                hasVat ? "border-[#3d5afe] bg-[#e8eaf6]" : "border-slate-100 bg-white"
              )}
            >
              <span className="font-black text-xs flex items-center gap-2">💰 Con IVA</span>
              <span className="text-[8px] font-bold opacity-60">Precio total con impuesto</span>
            </button>
            <button
              onClick={() => setHasVat(false)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-left flex flex-col gap-1",
                !hasVat ? "border-[#3d5afe] bg-[#e8eaf6]" : "border-slate-100 bg-white"
              )}
            >
              <span className="font-black text-xs flex items-center gap-2">📄 Sin IVA</span>
              <span className="text-[8px] font-bold opacity-60">Valor neto de factura</span>
            </button>
          </CardContent>
        </Card>

        {/* Card 3: Precio y Unidades */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="pb-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Card 3 — Precio y unidades</Label>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-slate-400">$</span>
              <Input 
                type="number" 
                placeholder="Precio total factura" 
                className="pl-10 h-14 rounded-xl bg-slate-50 border-none font-black text-2xl focus-visible:ring-[#3d5afe]"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
              />
            </div>
            
            <div className="flex justify-between items-center px-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-slate-400">Costo neto/u</span>
                <span className="text-xs font-bold text-slate-700">${Math.round(calculations.costoNeto).toLocaleString("es-CL")}</span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="flex flex-col text-right">
                <span className="text-[9px] font-black uppercase text-slate-400">Precio mín</span>
                <span className="text-xs font-bold text-amber-600">${Math.round(calculations.precioMinimo).toLocaleString("es-CL")}</span>
              </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-slate-400">#</span>
              <Input 
                type="number" 
                placeholder="Cantidad de unidades" 
                className="pl-10 h-12 rounded-xl bg-slate-50 border-none font-black text-xl"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: % Ganancia */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="pb-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Card 4 — % de ganancia</Label>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 25, 30, 35, 40, 50].map(pct => (
                <Button
                  key={pct}
                  variant="outline"
                  onClick={() => { setProfitPercent(pct); setCustomProfit(""); }}
                  className={cn(
                    "h-10 rounded-xl font-black text-[10px] transition-all",
                    profitPercent === pct && customProfit === "" ? "bg-[#3d5afe] text-white border-[#3d5afe]" : "bg-white border-slate-100"
                  )}
                >
                  {pct}%
                </Button>
              ))}
            </div>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="Otro porcentaje personalizado" 
                className="h-11 rounded-xl bg-slate-50 border-none font-bold text-sm text-center"
                value={customProfit}
                onChange={(e) => setCustomProfit(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={() => setShowResults(true)}
          className="flex-1 h-16 rounded-3xl bg-gradient-to-r from-[#3d5afe] to-[#5c7cfa] text-white font-black uppercase tracking-widest shadow-xl shadow-[#3d5afe]/20 active:scale-95 transition-all text-sm"
        >
          <Calculator className="w-5 h-5 mr-2" />
          Calcular precio de venta
        </Button>
        <Button 
          variant="outline"
          onClick={reset}
          className="h-16 px-6 rounded-3xl border-slate-200 text-slate-400 font-bold hover:bg-slate-50 active:scale-95 transition-all"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Nueva consulta
        </Button>
      </div>

      {showResults && (
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-[#3d5afe] text-white p-6 md:p-8 animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Precio de Venta Final</p>
              {productName && <h4 className="text-lg font-bold text-white/90 truncate max-w-[200px]">{productName}</h4>}
            </div>
            <Badge className={cn("rounded-full px-4 py-1 font-black text-[10px] uppercase border", getMargenColor(calculations.margenReal))}>
              Margen: {Math.round(calculations.margenReal)}%
            </Badge>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-6 mb-8 relative z-10">
            <h2 className="text-[44px] md:text-6xl font-black font-mono tracking-tighter leading-none">
              ${Math.round(calculations.precioFinal).toLocaleString("es-CL")}
            </h2>
            <div className="flex flex-col mb-1">
              <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">Sugerido (Redondeado)</span>
              <span className="text-xl md:text-2xl font-black text-white/80">${Math.round(calculations.precioRedondeado).toLocaleString("es-CL")}</span>
            </div>
          </div>

          <div className="space-y-3 bg-white/10 p-5 rounded-3xl border border-white/10 relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/70 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" /> Ganancia por unidad
              </span>
              <span className="text-base font-black text-green-400">+${Math.round(calculations.gananciaPesos).toLocaleString("es-CL")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/70 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-green-400" /> Margen real %
              </span>
              <span className="text-base font-black text-green-400">{Math.round(calculations.margenReal)}%</span>
            </div>
            <Separator className="bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/70 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-white/40" /> Costo neto por unidad
              </span>
              <span className="text-base font-black text-white">${Math.round(calculations.costoNeto).toLocaleString("es-CL")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/70 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" /> Precio mínimo sin pérdida
              </span>
              <span className="text-base font-black text-orange-400">${Math.round(calculations.precioMinimo).toLocaleString("es-CL")}</span>
            </div>
          </div>

          {calculations.margenReal < 20 && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <p className="text-xs font-black uppercase tracking-widest text-red-100">⚠️ Margen bajo — sube el % de ganancia</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/10">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/80 transition-colors">
                Ver detalle del cálculo paso a paso
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-2 text-[10px] font-mono text-white/60 leading-relaxed bg-black/20 p-4 rounded-2xl">
                <p>1. Precio factura: ${parseFloat(totalPrice).toLocaleString("es-CL")}</p>
                <p>2. {hasVat ? `Neto calculado (Total/1.19): $${Math.round(calculations.totalNeto).toLocaleString("es-CL")}` : `Precio ingresado como Neto`}</p>
                <p>3. Costo Neto unitario ($/{units}): ${Math.round(calculations.costoNeto).toLocaleString("es-CL")}</p>
                <p>4. Ganancia aplicada: {calculations.profit}% (+${Math.round(calculations.gananciaPesos).toLocaleString("es-CL")})</p>
                <p>5. Precio Venta Neto: ${Math.round(calculations.precioVentaSinIVA).toLocaleString("es-CL")}</p>
                <p>6. IVA 19% aplicado: +${Math.round(calculations.precioVentaSinIVA * 0.19).toLocaleString("es-CL")}</p>
                <p>7. Precio Final: ${Math.round(calculations.precioFinal).toLocaleString("es-CL")}</p>
              </div>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  
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

  const { data: allSales, isLoading: isLoadingSales } = useCollection(salesQuery);
  const { data: allProducts, isLoading: isLoadingProducts } = useCollection(productsQuery);

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

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full grid grid-cols-4">
          <TabsTrigger value="calculator" className="rounded-xl font-bold uppercase text-[9px] tracking-widest flex items-center gap-1">
            <Calculator className="w-3 h-3" /> Precios
          </TabsTrigger>
          <TabsTrigger value="sales" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Ventas</TabsTrigger>
          <TabsTrigger value="no-sales" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Sin Ventas</TabsTrigger>
          <TabsTrigger value="top" className="rounded-xl font-bold uppercase text-[9px] tracking-widest">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="mt-6">
          <PriceCalculator products={allProducts || []} />
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
                        <ChevronDown className="w-4 h-4 text-slate-300" />
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
              <Calculator className="w-4 h-4" /> Copiar
            </Button>
            <Button className="rounded-xl h-12 font-black uppercase text-[10px] bg-green-600 hover:bg-green-700" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank')}>
              <CheckCircle2 className="w-4 h-4" /> WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
