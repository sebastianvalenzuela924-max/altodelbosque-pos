
"use client";

import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, increment, Timestamp } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, History, ShoppingBag, Loader2, ChevronRight, Trash2, Eraser, AlertCircle, X, ChevronLeft, Check, Banknote, CreditCard, PackagePlus, ArrowDownToLine, FileText, Edit3, Search, PackageMinus, Box, Clock, Lock, Tag, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportSheetsToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";
type BulkDeleteType = 'day' | 'month' | 'all';
type CleanStep = 'idle' | 'options' | 'confirming';

const DELETE_PASSWORD = "Miler";

export default function HistoryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [cleanStep, setCleanStep] = useState<CleanStep>('idle');
  const [bulkType, setBulkType] = useState<BulkDeleteType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [deleteContext, setDeleteContext] = useState<'sales' | 'inventoryLogs' | 'priceChangeLogs'>('sales');
  const [securityKey, setSecurityKey] = useState("");

  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const logsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "inventoryLogs"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const priceLogsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "priceChangeLogs"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: allSales, isLoading: isSalesLoading } = useCollection(salesQuery);
  const { data: allLogs, isLoading: isLogsLoading } = useCollection(logsQuery);
  const { data: allPriceLogs, isLoading: isPriceLogsLoading } = useCollection(priceLogsQuery);
  const { data: allProducts } = useCollection(productsQuery);

  const productMap = useMemo(() => {
    const map = new Map();
    if (allProducts) {
      allProducts.forEach(p => map.set(String(p.id).trim(), p));
    }
    return map;
  }, [allProducts]);

  const applyDateFilter = (items: any[], dateField: string) => {
    if (!items || !isMounted) return [];
    const now = new Date();
    
    return items.filter(item => {
      const itemDate = item[dateField]?.toDate?.() || (item[dateField] ? new Date(item[dateField]) : new Date());
      
      if (dateFilter === "today") {
        return itemDate.toDateString() === now.toDateString();
      }
      if (dateFilter === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return itemDate.toDateString() === yesterday.toDateString();
      }
      if (dateFilter === "custom" && customDate) {
        const [y, m, d] = customDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        return itemDate.toDateString() === targetDate.toDateString();
      }
      if (dateFilter === "month") {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const filteredSales = useMemo(() => applyDateFilter(allSales || [], "saleDateTime"), [allSales, dateFilter, customDate, isMounted]);
  
  const filteredLogs = useMemo(() => {
    const dateFiltered = applyDateFilter(allLogs || [], "timestamp");
    if (!logSearchTerm.trim()) return dateFiltered;
    
    const term = logSearchTerm.toLowerCase().trim();
    return dateFiltered.filter(l => 
      l.productName?.toLowerCase().includes(term) || 
      l.invoiceNumber?.toLowerCase().includes(term)
    );
  }, [allLogs, dateFilter, customDate, isMounted, logSearchTerm]);

  const filteredPriceLogs = useMemo(() => {
    const dateFiltered = applyDateFilter(allPriceLogs || [], "timestamp");
    if (!logSearchTerm.trim()) return dateFiltered;
    const term = logSearchTerm.toLowerCase().trim();
    return dateFiltered.filter(l => l.productName?.toLowerCase().includes(term));
  }, [allPriceLogs, dateFilter, customDate, isMounted, logSearchTerm]);

  const groupedLogsByInvoice = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredLogs.forEach(log => {
      const inv = log.invoiceNumber?.trim() || "SIN_FACTURA";
      if (!groups[inv]) groups[inv] = [];
      groups[inv].push(log);
    });
    
    return Object.entries(groups).map(([invoice, logs]) => {
      const minTimestamp = Math.min(...logs.map(l => l.timestamp?.toDate?.() || 0));
      return { invoice, logs, minTime: minTimestamp };
    }).sort((a, b) => b.minTime - a.minTime);
  }, [filteredLogs]);

  const handleExport = () => {
    const sheets = [];

    if (filteredSales.length > 0) {
      const flattenedSales = filteredSales.flatMap(s => {
        const date = s.saleDateTime?.toDate?.() || (s.saleDateTime ? new Date(s.saleDateTime) : new Date());
        return s.itemsSummary?.map((item: any) => ({
          ID_Venta: s.id,
          Fecha: date.toLocaleDateString(),
          Hora: date.toLocaleTimeString(),
          Metodo_Pago: s.paymentMethod === 'cash' ? 'Efectivo' : s.paymentMethod === 'card' ? 'Tarjeta' : 'Descontado',
          Producto: item.name,
          Cantidad: item.quantity,
          Precio: Math.round(item.price),
          Subtotal: Math.round(item.price * item.quantity),
          Total_Venta: Math.round(s.totalAmount)
        })) || [];
      });
      sheets.push({ name: "Ventas", data: flattenedSales });
    }

    if (filteredLogs.length > 0) {
      const flattenedLogs = filteredLogs.map(l => {
        const date = l.timestamp?.toDate?.() || (l.timestamp ? new Date(l.timestamp) : new Date());
        return {
          ID_Ingreso: l.id,
          Fecha: date.toLocaleDateString(),
          Hora: date.toLocaleTimeString(),
          Producto: l.productName,
          Cantidad_Ingresada: l.quantity,
          Codigo_Producto: l.productId,
          Factura: l.invoiceNumber || "N/A",
          Tipo: l.type === 'restock' ? 'Reposición' : 'Ajuste'
        };
      });
      sheets.push({ name: "Ingresos de Stock", data: flattenedLogs });
    }

    if (filteredPriceLogs.length > 0) {
      const flattenedPriceLogs = filteredPriceLogs.map(l => {
        const date = l.timestamp?.toDate?.() || (l.timestamp ? new Date(l.timestamp) : new Date());
        return {
          ID_Cambio: l.id,
          Fecha: date.toLocaleDateString(),
          Hora: date.toLocaleTimeString(),
          Producto: l.productName,
          Precio_Anterior: Math.round(l.oldPrice),
          Precio_Nuevo: Math.round(l.newPrice),
          Diferencia: Math.round(l.newPrice - l.oldPrice)
        };
      });
      sheets.push({ name: "Cambios de Precios", data: flattenedPriceLogs });
    }

    if (sheets.length > 0) {
      exportSheetsToExcel(`Historial_AltodelBosque_${dateFilter}`, sheets);
      toast({ 
        title: "Exportación exitosa", 
        description: `Se han exportado los registros del periodo.` 
      });
    } else {
      toast({ 
        title: "Nada que exportar", 
        description: "No hay registros en el periodo seleccionado.",
        variant: "destructive"
      });
    }
  };

  const handleExecuteBulkDelete = () => {
    if (!bulkType) return;
    if (securityKey !== DELETE_PASSWORD) {
      toast({ title: "Clave incorrecta", description: "No tienes permiso para borrar el historial.", variant: "destructive" });
      return;
    }
    
    const now = new Date();
    const targets = (deleteContext === 'sales' ? allSales : deleteContext === 'inventoryLogs' ? allLogs : allPriceLogs)?.filter(s => {
      const dField = deleteContext === 'sales' ? 'saleDateTime' : 'timestamp';
      const d = s[dField]?.toDate?.() || (s[dField] ? new Date(s[dField]) : null);
      if (!d) return false;

      if (bulkType === 'day') return d.toDateString() === now.toDateString();
      if (bulkType === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (bulkType === 'all') return true;
      return false;
    });

    if (!targets || targets.length === 0) {
      toast({ title: "Nada que borrar", description: "No hay registros en este periodo." });
      setCleanStep('idle');
      setSecurityKey("");
      return;
    }

    targets.forEach(t => {
      if (deleteContext === 'inventoryLogs' && t.productId && t.quantity) {
        const productRef = doc(firestore, "products", String(t.productId).trim());
        updateDocumentNonBlocking(productRef, {
          stock: increment(-t.quantity)
        });
      }

      if (deleteContext === 'sales' && t.itemsSummary) {
        t.itemsSummary.forEach((item: any) => {
          if (item.type === 'product' && item.id) {
            const productRef = doc(firestore, "products", String(item.id).trim());
            const product = productMap.get(String(item.id).trim());
            const noAlerts = product?.warningStock === 0 || product?.idealStock === 0;
            updateDocumentNonBlocking(productRef, {
              stock: increment(noAlerts ? -item.quantity : item.quantity)
            });
          }
        });
      }

      deleteDocumentNonBlocking(doc(firestore, deleteContext, t.id));
    });

    toast({ 
      title: "Limpieza completada", 
      description: `Se han borrado ${targets.length} registros.` 
    });
    setCleanStep('idle');
    setSecurityKey("");
  };

  const handleSaveInvoice = () => {
    if (!editingLog) return;
    
    const newDateTime = new Date(`${editDate}T${editTime}`);
    const logRef = doc(firestore, "inventoryLogs", editingLog.id);
    
    updateDocumentNonBlocking(logRef, {
      invoiceNumber: editInvoiceNumber.trim(),
      timestamp: Timestamp.fromDate(newDateTime)
    });
    
    toast({ title: "Registro actualizado", description: "Los cambios se guardaron correctamente." });
    setEditingLog(null);
  };

  if (!isMounted) return <div className="min-h-screen bg-background" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2 uppercase tracking-tighter">
            <History className="w-6 h-6" />
            Historial
          </h1>
          <p className="text-muted-foreground text-xs font-bold">Registro de transacciones, stock y cambios de precios.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
            <SelectTrigger className="w-[140px] rounded-2xl h-11 border-none bg-slate-100 font-bold shadow-sm">
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

          {dateFilter === "custom" && (
            <Input 
              type="date" 
              className="h-11 rounded-2xl bg-slate-100 border-none font-bold w-[140px]" 
              value={customDate} 
              onChange={(e) => setCustomDate(e.target.value)} 
            />
          )}

          <div className="flex gap-2 ml-auto">
            <Button 
              variant="outline" 
              onClick={handleExport} 
              disabled={!filteredSales.length && !filteredLogs.length && !filteredPriceLogs.length} 
              className="h-11 rounded-2xl border-slate-200 px-4 font-bold gap-2 text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => { setSecurityKey(""); setCleanStep('options'); }}
              className="h-11 w-11 p-0 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5"
            >
              <Eraser className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white rounded-2xl p-1 border shadow-sm h-14">
          <TabsTrigger value="ventas" className="rounded-xl font-bold uppercase text-[8px] sm:text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShoppingBag className="w-4 h-4 mr-1 sm:mr-2" /> Ventas
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl font-bold uppercase text-[8px] sm:text-[10px] tracking-widest data-[state=active]:bg-accent data-[state=active]:text-white">
            <PackagePlus className="w-4 h-4 mr-1 sm:mr-2" /> Stock
          </TabsTrigger>
          <TabsTrigger value="prices" className="rounded-xl font-bold uppercase text-[8px] sm:text-[10px] tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Tag className="w-4 h-4 mr-1 sm:mr-2" /> Precios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="mt-6 space-y-2">
          {isSalesLoading ? (
             <div className="flex flex-col items-center justify-center py-20 opacity-30">
               <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
               <p className="text-[10px] font-black uppercase tracking-widest">Cargando ventas...</p>
             </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-100" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin ventas</h3>
            </div>
          ) : (
            filteredSales.map((sale) => {
              const date = sale.saleDateTime?.toDate?.() || (sale.saleDateTime ? new Date(sale.saleDateTime) : new Date());
              const totalItems = (sale.productSaleItemIds?.length || 0) + (sale.manualSaleItemIds?.length || 0);
              const isCash = sale.paymentMethod === 'cash';
              const isCard = sale.paymentMethod === 'card';
              
              return (
                <Card key={sale.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl group bg-white">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="items" className="border-none">
                      <AccordionTrigger asChild className="hover:no-underline p-0 w-full [&>svg]:hidden">
                        <div className="flex items-center p-3 md:p-4 gap-2 md:gap-6 w-full cursor-pointer">
                          <div className="min-w-[65px] md:min-w-[70px] flex flex-col text-left">
                            <span className="text-xs font-black text-slate-800">
                              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 uppercase">
                              #{sale.id?.slice(-5)}
                            </span>
                          </div>
                          
                          <div className="flex-1 flex items-center gap-2 md:gap-3 min-w-0 overflow-hidden text-left">
                            <div className="flex flex-col gap-1 shrink-0">
                               <Badge variant="outline" className="text-[8px] md:text-[9px] font-black uppercase bg-slate-50 border-slate-100 px-1.5 md:px-2 py-0.5 shrink-0 w-fit">
                                {totalItems} Art.
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[8px] font-black uppercase px-1.5 md:px-2 py-0.5 shrink-0 w-fit border-none",
                                  isCash ? "bg-green-100 text-green-700" : isCard ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                                )}
                              >
                                {isCash ? <Banknote className="w-3 h-3 mr-1 inline" /> : isCard ? <CreditCard className="w-3 h-3 mr-1 inline" /> : <PackageMinus className="w-3 h-3 mr-1 inline" />}
                                <span className="hidden sm:inline">{isCash ? 'Efectivo' : isCard ? 'Tarjeta' : 'Descontado'}</span>
                              </Badge>
                            </div>
                            
                            <div className="text-primary font-bold text-[10px] uppercase tracking-tighter flex items-center gap-1">
                              <ChevronRight className="w-3 h-3" /> Ver Detalle
                            </div>
                          </div>

                          <div className="text-right min-w-[120px] md:min-w-[130px] flex items-center justify-end gap-2 md:gap-3 shrink-0">
                            <span className={cn(
                              "text-base md:text-lg font-black font-mono tracking-tighter leading-none",
                              isCash ? "text-green-600" : isCard ? "text-primary" : "text-amber-600"
                            )}>
                              {sale.paymentMethod === 'deduction' ? "ADMIN" : `$${Math.round(sale.totalAmount).toLocaleString('es-CL')}`}
                            </span>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-destructive bg-destructive/10 hover:bg-destructive hover:text-white rounded-full transition-all" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteContext('sales');
                                  setSecurityKey("");
                                  setItemToDelete(sale);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      
                      <AccordionContent className="bg-slate-50/50 px-4 pb-4 pt-2 border-t border-slate-100">
                        <div className="space-y-1.5 mt-2">
                          {sale.itemsSummary?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-xs">
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-slate-700">{item.name}</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                                  {item.type === 'manual' ? 'Cobro Manual' : `Cód: ${item.id}`}
                                </span>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className="font-black text-slate-500 mr-2 text-[10px]">{item.quantity} x ${Math.round(item.price).toLocaleString('es-CL')}</span>
                                <span className={cn("font-black", isCash ? "text-green-600" : isCard ? "text-primary" : "text-amber-600")}>
                                  ${Math.round(item.price * item.quantity).toLocaleString('es-CL')}
                                </span>
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
          )}
        </TabsContent>

        <TabsContent value="stock" className="mt-6 space-y-4">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              className="pl-11 h-12 bg-white rounded-2xl border-none shadow-sm font-bold" 
              placeholder="Buscar por producto o factura..." 
              value={logSearchTerm}
              onChange={(e) => setLogSearchTerm(e.target.value)}
            />
          </div>

          {isLogsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
               <Loader2 className="w-8 h-8 animate-spin mb-2 text-accent" />
               <p className="text-[10px] font-black uppercase tracking-widest">Cargando ingresos...</p>
             </div>
          ) : groupedLogsByInvoice.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <PackagePlus className="w-12 h-12 mx-auto mb-3 text-slate-100" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin resultados</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedLogsByInvoice.map(({ invoice, logs, minTime }) => {
                const invoiceDate = new Date(minTime);
                const totalUnits = logs.reduce((sum, l) => sum + (l.quantity || 0), 0);
                const isNoInvoice = invoice === "SIN_FACTURA";
                
                return (
                  <Card key={invoice} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl bg-white">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value={invoice} className="border-none">
                        <AccordionTrigger asChild className="hover:no-underline p-0 w-full [&>svg]:hidden">
                          <div className="flex items-center p-3 md:p-4 gap-4 w-full cursor-pointer">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                              {isNoInvoice ? <Box className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            
                            <div className="flex-1 min-w-0 text-left">
                              <h3 className="font-black text-xs md:text-sm text-slate-800 uppercase tracking-tighter truncate">
                                {isNoInvoice ? "Carga Sin Factura" : `Factura: ${invoice}`}
                              </h3>
                              <div className="flex gap-2 mt-0.5">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Inicio: {invoiceDate.toLocaleDateString()}</span>
                                <span className="text-[8px] font-black text-accent uppercase">{totalUnits} Unidades</span>
                              </div>
                            </div>

                            <div className="text-accent font-black text-[10px] uppercase tracking-tighter flex items-center gap-1">
                              <ChevronRight className="w-4 h-4" /> Detalle
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="bg-slate-50/50 px-2 md:px-4 pb-4 pt-2 border-t border-slate-100">
                          <div className="space-y-1.5 mt-2">
                            {logs.map((log) => {
                              const date = log.timestamp?.toDate?.() || new Date();
                              return (
                                <div key={log.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-xs">
                                  <div className="flex-1 min-w-0 mr-4 text-left">
                                    <p className="font-bold text-slate-700">{log.productName}</p>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase">Fecha: {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Cód: {log.productId}</p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-black text-accent text-sm">+{log.quantity}</span>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-primary rounded-full hover:bg-primary/10"
                                        onClick={() => {
                                          setEditingLog(log);
                                          setEditInvoiceNumber(log.invoiceNumber || "");
                                          const d = log.timestamp?.toDate?.() || new Date();
                                          setEditDate(d.toISOString().split('T')[0]);
                                          setEditTime(d.toTimeString().split(' ')[0].slice(0, 5));
                                        }}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive rounded-full hover:bg-destructive/10"
                                        onClick={() => {
                                          setDeleteContext('inventoryLogs');
                                          setSecurityKey("");
                                          setItemToDelete(log);
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prices" className="mt-6 space-y-4">
           <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              className="pl-11 h-12 bg-white rounded-2xl border-none shadow-sm font-bold" 
              placeholder="Buscar por nombre de producto..." 
              value={logSearchTerm}
              onChange={(e) => setLogSearchTerm(e.target.value)}
            />
          </div>

          {isPriceLogsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
               <Loader2 className="w-8 h-8 animate-spin mb-2 text-amber-500" />
               <p className="text-[10px] font-black uppercase tracking-widest">Cargando cambios...</p>
             </div>
          ) : filteredPriceLogs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <Tag className="w-12 h-12 mx-auto mb-3 text-slate-100" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin cambios de precios</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPriceLogs.map((log) => {
                const date = log.timestamp?.toDate?.() || new Date();
                const isIncrease = log.newPrice > log.oldPrice;
                const diff = log.newPrice - log.oldPrice;
                
                return (
                  <Card key={log.id} className="p-4 border-none shadow-sm rounded-2xl bg-white flex items-center gap-4 group">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isIncrease ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {isIncrease ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-xs sm:text-sm text-slate-800 uppercase truncate">{log.productName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">
                          {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Badge variant="outline" className="text-[8px] font-mono border-slate-100">#{log.productId?.slice(-5)}</Badge>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 line-through">${Math.round(log.oldPrice).toLocaleString('es-CL')}</span>
                        <span className="text-base font-black text-primary">${Math.round(log.newPrice).toLocaleString('es-CL')}</span>
                      </div>
                      <p className={cn("text-[9px] font-black uppercase mt-0.5", isIncrease ? "text-green-600" : "text-red-600")}>
                        {isIncrease ? "+" : ""}{Math.round(diff).toLocaleString('es-CL')} (DIF)
                      </p>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                      onClick={() => {
                        setDeleteContext('priceChangeLogs');
                        setSecurityKey("");
                        setItemToDelete(log);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGOS DE LIMPIEZA CON CLAVE */}
      <Dialog open={cleanStep !== 'idle'} onOpenChange={(open) => !open && setCleanStep('idle')}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          {cleanStep === 'options' ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-primary flex items-center gap-2 uppercase">
                  <Eraser className="w-5 h-5" /> Limpiar Historial
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-400">
                  Selecciona qué registros deseas borrar permanentemente.
                </DialogDescription>
              </DialogHeader>
              
              <div className="bg-slate-50 p-1 rounded-xl grid grid-cols-3 gap-1 mb-4">
                <Button 
                  variant={deleteContext === 'sales' ? 'default' : 'ghost'} 
                  className="h-8 rounded-lg text-[8px] sm:text-[9px] font-black uppercase"
                  onClick={() => setDeleteContext('sales')}
                >Ventas</Button>
                <Button 
                  variant={deleteContext === 'inventoryLogs' ? 'default' : 'ghost'} 
                  className="h-8 rounded-lg text-[8px] sm:text-[9px] font-black uppercase"
                  onClick={() => setDeleteContext('inventoryLogs')}
                >Stock</Button>
                <Button 
                  variant={deleteContext === 'priceChangeLogs' ? 'default' : 'ghost'} 
                  className="h-8 rounded-lg text-[8px] sm:text-[9px] font-black uppercase"
                  onClick={() => setDeleteContext('priceChangeLogs')}
                >Precios</Button>
              </div>

              <div className="grid gap-2">
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl font-bold justify-between px-6 bg-slate-50 hover:bg-slate-100 border-none group"
                  onClick={() => { setBulkType('day'); setCleanStep('confirming'); }}
                >
                  Borrar registros de Hoy
                  <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                </Button>
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl font-bold justify-between px-6 bg-slate-50 hover:bg-slate-100 border-none group"
                  onClick={() => { setBulkType('month'); setCleanStep('confirming'); }}
                >
                  Borrar registros del Mes
                  <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                </Button>
                <Button 
                  variant="destructive" 
                  className="h-14 rounded-2xl font-black justify-between px-6 uppercase tracking-tighter"
                  onClick={() => { setBulkType('all'); setCleanStep('confirming'); }}
                >
                  BORRAR TODO EL HISTORIAL
                  <AlertCircle className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="ghost" className="w-full rounded-xl h-12 font-bold text-slate-400" onClick={() => setCleanStep('idle')}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                  <Lock className="w-8 h-8 text-destructive animate-pulse" />
                </div>
                <h2 className="text-xl font-black text-destructive uppercase">Confirmación de Seguridad</h2>
                <p className="text-xs font-bold text-slate-500 leading-relaxed px-4">
                  Para borrar permanentemente los registros de <span className="font-black">{bulkType === 'day' ? 'Hoy' : bulkType === 'month' ? 'Este Mes' : 'Todo el Historial'}</span>, ingresa la clave:
                </p>
                
                <div className="w-full max-w-xs space-y-2">
                  <Input 
                    type="password"
                    placeholder="Clave"
                    className="h-12 rounded-xl text-center font-black text-lg border-2 border-destructive/20 focus-visible:ring-destructive"
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                  />
                  {securityKey !== "" && securityKey !== DELETE_PASSWORD && (
                    <p className="text-[10px] font-black text-destructive uppercase">Clave Incorrecta</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl font-bold flex items-center gap-2"
                  onClick={() => { setSecurityKey(""); setCleanStep('options'); }}
                >
                  <ChevronLeft className="w-4 h-4" /> Volver
                </Button>
                <Button 
                  variant="destructive" 
                  className="h-14 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2"
                  disabled={securityKey !== DELETE_PASSWORD}
                  onClick={handleExecuteBulkDelete}
                >
                  <Check className="w-4 h-4" /> CONFIRMAR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BORRADO INDIVIDUAL CON CLAVE */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
               <Lock className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-black text-destructive uppercase">Clave de Seguridad</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold py-2">
              Ingresa la clave para eliminar este registro definitivamente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] space-y-1">
                <p className="font-black text-slate-400 uppercase">Registro a eliminar:</p>
                <p className="font-bold text-slate-700">
                  {deleteContext === 'sales' ? `Venta #${itemToDelete?.id?.slice(-5)} - $${Math.round(itemToDelete?.totalAmount || 0).toLocaleString('es-CL')}` : 
                   deleteContext === 'inventoryLogs' ? `Carga: ${itemToDelete?.productName} (+${itemToDelete?.quantity})` :
                   `Cambio Precio: ${itemToDelete?.productName} ($${Math.round(itemToDelete?.newPrice)})`}
                </p>
             </div>
             <Input 
                type="password"
                placeholder="Clave"
                className="h-12 rounded-xl text-center font-black text-lg border-2 border-destructive/20 focus-visible:ring-destructive"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
              />
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="ghost" className="rounded-xl h-12 flex-1 font-bold" onClick={() => setItemToDelete(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl h-12 flex-1 font-black uppercase"
              disabled={securityKey !== DELETE_PASSWORD}
              onClick={() => {
                if (deleteContext === 'inventoryLogs' && itemToDelete.productId && itemToDelete.quantity) {
                  const productRef = doc(firestore, "products", String(itemToDelete.productId).trim());
                  updateDocumentNonBlocking(productRef, {
                    stock: increment(-itemToDelete.quantity)
                  });
                }

                if (deleteContext === 'sales' && itemToDelete.itemsSummary) {
                  itemToDelete.itemsSummary.forEach((item: any) => {
                    if (item.type === 'product' && item.id) {
                      const productRef = doc(firestore, "products", String(item.id).trim());
                      const product = productMap.get(String(item.id).trim());
                      const noAlerts = product?.warningStock === 0 || product?.idealStock === 0;
                      updateDocumentNonBlocking(productRef, {
                        stock: increment(noAlerts ? -item.quantity : item.quantity)
                      });
                    }
                  });
                }

                deleteDocumentNonBlocking(doc(firestore, deleteContext, itemToDelete.id));
                toast({ title: "Registro eliminado" });
                setItemToDelete(null);
                setSecurityKey("");
              }}
            >
              ELIMINAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDICIÓN DE LOG DE STOCK */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary uppercase flex items-center gap-2">
              <Edit3 className="w-5 h-5" /> Editar Registro
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              Modifica los detalles de este ingreso de stock.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
              <p className="text-[10px] font-black uppercase text-slate-400">Producto</p>
              <p className="text-sm font-bold text-slate-700">{editingLog?.productName}</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 text-left">Número de Factura</Label>
              <Input 
                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-lg" 
                placeholder="Ej: 999888"
                value={editInvoiceNumber}
                onChange={(e) => setEditInvoiceNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Fecha
                </Label>
                <Input 
                  type="date"
                  className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs" 
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Hora
                </Label>
                <Input 
                  type="time"
                  className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs" 
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setEditingLog(null)}>Cancelar</Button>
            <Button className="rounded-xl bg-primary font-black" onClick={handleSaveInvoice}>GUARDAR CAMBIOS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
