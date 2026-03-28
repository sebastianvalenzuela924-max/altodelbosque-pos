"use client";

import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, increment } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, History, ShoppingBag, Loader2, ChevronRight, Trash2, Eraser, AlertCircle, X, ChevronLeft, Check, Banknote, CreditCard, PackagePlus, ArrowDownToLine, FileText, Edit3, Search } from "lucide-react";
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

export default function HistoryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Estados de limpieza unificados en un solo flujo
  const [cleanStep, setCleanStep] = useState<CleanStep>('idle');
  const [bulkType, setBulkType] = useState<BulkDeleteType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [deleteContext, setDeleteContext] = useState<'sales' | 'inventoryLogs'>('sales');

  // Estado para edición de factura
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const logsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "inventoryLogs"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: allSales, isLoading: isSalesLoading } = useCollection(salesQuery);
  const { data: allLogs, isLoading: isLogsLoading } = useCollection(logsQuery);
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

  const handleExport = () => {
    const sheets = [];

    if (filteredSales.length > 0) {
      const flattenedSales = filteredSales.flatMap(s => {
        const date = s.saleDateTime?.toDate?.() || (s.saleDateTime ? new Date(s.saleDateTime) : new Date());
        return s.itemsSummary?.map((item: any) => ({
          ID_Venta: s.id,
          Fecha: date.toLocaleDateString(),
          Hora: date.toLocaleTimeString(),
          Metodo_Pago: s.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta',
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

    if (sheets.length > 0) {
      exportSheetsToExcel(`Historial_AltodelBosque_${dateFilter}`, sheets);
      toast({ 
        title: "Exportación exitosa", 
        description: `Se han exportado ${filteredSales.length} ventas y ${filteredLogs.length} ingresos.` 
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
    
    const now = new Date();
    const targets = (deleteContext === 'sales' ? allSales : allLogs)?.filter(s => {
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
  };

  const handleSaveInvoice = () => {
    if (!editingLog) return;
    const logRef = doc(firestore, "inventoryLogs", editingLog.id);
    updateDocumentNonBlocking(logRef, {
      invoiceNumber: editInvoiceNumber.trim()
    });
    toast({ title: "Factura actualizada" });
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
          <p className="text-muted-foreground text-xs font-bold">Registro de transacciones e ingresos de mercadería.</p>
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
              disabled={!filteredSales.length && !filteredLogs.length} 
              className="h-11 rounded-2xl border-slate-200 px-4 font-bold gap-2 text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setCleanStep('options')}
              className="h-11 w-11 p-0 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5"
            >
              <Eraser className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white rounded-2xl p-1 border shadow-sm h-14">
          <TabsTrigger value="ventas" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShoppingBag className="w-4 h-4 mr-2" /> Ventas Realizadas
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-accent data-[state=active]:text-white">
            <PackagePlus className="w-4 h-4 mr-2" /> Ingresos de Stock
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
              
              return (
                <Card key={sale.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl group bg-white">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="items" className="border-none">
                      <div className="flex items-center p-3 md:p-4 gap-2 md:gap-6">
                        <div className="min-w-[65px] md:min-w-[70px] flex flex-col">
                          <span className="text-xs font-black text-slate-800">
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">
                            #{sale.id?.slice(-5)}
                          </span>
                        </div>
                        
                        <div className="flex-1 flex items-center gap-2 md:gap-3 min-w-0 overflow-hidden">
                          <div className="flex flex-col gap-1 shrink-0">
                             <Badge variant="outline" className="text-[8px] md:text-[9px] font-black uppercase bg-slate-50 border-slate-100 px-1.5 md:px-2 py-0.5 shrink-0 w-fit">
                              {totalItems} Art.
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[8px] font-black uppercase px-1.5 md:px-2 py-0.5 shrink-0 w-fit border-none",
                                isCash ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                              )}
                            >
                              {isCash ? <Banknote className="w-3 h-3 mr-1 inline" /> : <CreditCard className="w-3 h-3 mr-1 inline" />}
                              <span className="hidden sm:inline">{isCash ? 'Efectivo' : 'Tarjeta'}</span>
                            </Badge>
                          </div>
                          
                          <AccordionTrigger className="hover:no-underline py-0 justify-start gap-1 md:gap-2 text-primary font-bold text-[10px] uppercase tracking-tighter shrink-0 [&>svg:last-child]:hidden">
                            <ChevronRight className="w-3 h-3" /> Detalle
                          </AccordionTrigger>
                        </div>

                        <div className="text-right min-w-[120px] md:min-w-[130px] flex items-center justify-end gap-2 md:gap-3 shrink-0">
                          <span className={cn(
                            "text-base md:text-lg font-black font-mono tracking-tighter leading-none",
                            isCash ? "text-green-600" : "text-primary"
                          )}>
                            ${Math.round(sale.totalAmount).toLocaleString('es-CL')}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-destructive bg-destructive/10 hover:bg-destructive hover:text-white rounded-full transition-all" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteContext('sales');
                              setItemToDelete(sale);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <AccordionContent className="bg-slate-50/50 px-4 pb-4 pt-2 border-t border-slate-100">
                        <div className="space-y-1.5 mt-2">
                          {sale.itemsSummary?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 text-xs">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-700">{item.name}</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                                  {item.type === 'manual' ? 'Cobro Manual' : `Cód: ${item.id}`}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-slate-500 mr-2 text-[10px]">{item.quantity} x ${Math.round(item.price).toLocaleString('es-CL')}</span>
                                <span className={cn("font-black", isCash ? "text-green-600" : "text-primary")}>
                                  ${Math.round(item.price * item.quantity).toLocaleString('es-CL')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full mt-4 sm:hidden font-black text-[10px] uppercase h-10 rounded-xl"
                          onClick={() => {
                            setDeleteContext('sales');
                            setItemToDelete(sale);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar Venta
                        </Button>
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
            {logSearchTerm && (
              <button 
                onClick={() => setLogSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isLogsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
               <Loader2 className="w-8 h-8 animate-spin mb-2 text-accent" />
               <p className="text-[10px] font-black uppercase tracking-widest">Cargando ingresos...</p>
             </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <PackagePlus className="w-12 h-12 mx-auto mb-3 text-slate-100" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin resultados</h3>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const date = log.timestamp?.toDate?.() || (log.timestamp ? new Date(log.timestamp) : new Date());
              return (
                <Card key={log.id} className="p-3 md:p-4 border-none shadow-sm rounded-2xl bg-white flex flex-col sm:flex-row sm:items-center gap-3 transition-all">
                  <div className="flex items-center gap-3 md:gap-6 flex-1">
                    <div className="min-w-[70px] flex flex-col">
                      <span className="text-xs font-black text-slate-800">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">
                        {date.toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                        <ArrowDownToLine className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 leading-tight">{log.productName}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cód: {log.productId}</p>
                        {log.invoiceNumber && (
                          <div className="flex items-center gap-1 mt-1 text-primary">
                            <FileText className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Factura: {log.invoiceNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-right flex flex-col items-end mr-2 md:mr-4">
                      <span className="text-xl font-black text-accent">+{log.quantity}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">Unidades</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-primary rounded-full bg-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm" 
                        onClick={() => {
                          setEditingLog(log);
                          setEditInvoiceNumber(log.invoiceNumber || "");
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-destructive bg-destructive/10 hover:bg-destructive hover:text-white rounded-full transition-all shadow-sm" 
                        onClick={() => {
                          setDeleteContext('inventoryLogs');
                          setItemToDelete(log);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGOS Y COMPONENTES RESTANTES SIN CAMBIOS... */}
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
              
              <div className="bg-slate-50 p-1 rounded-xl grid grid-cols-2 gap-1 mb-4">
                <Button 
                  variant={deleteContext === 'sales' ? 'default' : 'ghost'} 
                  className="h-8 rounded-lg text-[9px] font-black uppercase"
                  onClick={() => setDeleteContext('sales')}
                >Ventas</Button>
                <Button 
                  variant={deleteContext === 'inventoryLogs' ? 'default' : 'ghost'} 
                  className="h-8 rounded-lg text-[9px] font-black uppercase"
                  onClick={() => setDeleteContext('inventoryLogs')}
                >Stock</Button>
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
                  <AlertCircle className="w-8 h-8 text-destructive animate-pulse" />
                </div>
                <h2 className="text-xl font-black text-destructive uppercase">¿Estás seguro?</h2>
                <p className="text-xs font-bold text-slate-500 leading-relaxed px-4">
                  Se eliminarán permanentemente los registros de: <br/>
                  <span className="text-slate-800 font-black text-sm uppercase">
                    {bulkType === 'day' ? 'Hoy' : bulkType === 'month' ? 'Este Mes' : 'Todo el Historial'} ({deleteContext === 'sales' ? 'Ventas' : 'Stock'})
                  </span>
                  <br/><br/>
                  <span className="bg-destructive/5 text-destructive px-3 py-1 rounded-lg">Esta acción es irreversible</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl font-bold flex items-center gap-2"
                  onClick={() => setCleanStep('options')}
                >
                  <ChevronLeft className="w-4 h-4" /> Volver
                </Button>
                <Button 
                  variant="destructive" 
                  className="h-14 rounded-2xl font-black uppercase tracking-tighter flex items-center gap-2"
                  onClick={handleExecuteBulkDelete}
                >
                  <Check className="w-4 h-4" /> CONFIRMAR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BORRADO INDIVIDUAL */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="rounded-3xl p-8 border-none shadow-2xl max-w-[90vw] sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
               <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-black text-destructive uppercase">Eliminar Registro</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold py-2">
              Se borrará este registro de {deleteContext === 'sales' ? 'venta' : 'ingreso de stock'} definitivamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" className="rounded-xl h-12 flex-1 font-bold" onClick={() => setItemToDelete(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl h-12 flex-1 font-black uppercase"
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
              }}
            >
              ELIMINAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDICIÓN DE FACTURA */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="rounded-3xl p-6 border-none shadow-2xl max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary uppercase flex items-center gap-2">
              <FileText className="w-5 h-5" /> Editar Factura
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              Actualiza el número de factura para este ingreso de stock.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400">Producto</p>
              <p className="text-sm font-bold text-slate-700">{editingLog?.productName}</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Número de Factura</Label>
              <Input 
                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-lg" 
                placeholder="Ej: 999888"
                value={editInvoiceNumber}
                onChange={(e) => setEditInvoiceNumber(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setEditingLog(null)}>Cancelar</Button>
            <Button className="rounded-xl bg-primary font-black" onClick={handleSaveInvoice}>GUARDAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
