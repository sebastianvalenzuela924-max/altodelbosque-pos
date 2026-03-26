"use client";

import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, History, ShoppingBag, Loader2, ChevronRight, Trash2, Eraser, AlertCircle, X, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DateFilter = "today" | "yesterday" | "month" | "all" | "custom";
type BulkDeleteType = 'day' | 'month' | 'all';
type CleanStep = 'idle' | 'options' | 'confirming';

export default function HistoryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Estados de limpieza unificados en un solo flujo
  const [cleanStep, setCleanStep] = useState<CleanStep>('idle');
  const [bulkType, setBulkType] = useState<BulkDeleteType | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<any | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const { data: allSales, isLoading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!allSales || !isMounted) return [];
    const now = new Date();
    
    return allSales.filter(sale => {
      const saleDate = sale.saleDateTime?.toDate?.() || (sale.saleDateTime ? new Date(sale.saleDateTime) : new Date());
      
      if (dateFilter === "today") {
        return saleDate.toDateString() === now.toDateString();
      }
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
  }, [allSales, dateFilter, customDate, isMounted]);

  const handleExport = () => {
    if (!filteredSales || filteredSales.length === 0) return;
    const flattened = filteredSales.flatMap(s => {
      const date = s.saleDateTime?.toDate?.() || (s.saleDateTime ? new Date(s.saleDateTime) : new Date());
      if (s.itemsSummary && s.itemsSummary.length > 0) {
        return s.itemsSummary.map((item: any) => ({
          ID_Venta: s.id,
          Fecha: date.toLocaleDateString(),
          Hora: date.toLocaleTimeString(),
          Producto: item.name,
          Cantidad: item.quantity,
          Precio_Unitario: Math.round(item.price),
          Subtotal: Math.round(item.price * item.quantity),
          Tipo: item.type === 'manual' ? 'Cobro Manual' : 'Inventario',
          Total_Venta: Math.round(s.totalAmount)
        }));
      }
      return [{
        ID_Venta: s.id,
        Fecha: date.toLocaleDateString(),
        Hora: date.toLocaleTimeString(),
        Producto: "Venta sin desglose",
        Cantidad: 1,
        Precio_Unitario: Math.round(s.totalAmount),
        Subtotal: Math.round(s.totalAmount),
        Tipo: "Desconocido",
        Total_Venta: Math.round(s.totalAmount)
      }];
    });
    exportToExcel(`Historial_${dateFilter}`, flattened, "Ventas");
    toast({ title: "Exportación exitosa" });
  };

  const handleExecuteBulkDelete = () => {
    if (!bulkType || !allSales) return;
    
    const now = new Date();
    const targets = allSales.filter(s => {
      const d = s.saleDateTime?.toDate?.() || (s.saleDateTime ? new Date(s.saleDateTime) : null);
      if (!d) return false;

      if (bulkType === 'day') return d.toDateString() === now.toDateString();
      if (bulkType === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (bulkType === 'all') return true;
      return false;
    });

    if (targets.length === 0) {
      toast({ title: "Nada que borrar", description: "No hay ventas en este periodo." });
      setCleanStep('idle');
      return;
    }

    targets.forEach(t => {
      deleteDocumentNonBlocking(doc(firestore, "sales", t.id));
    });

    toast({ 
      title: "Limpieza completada", 
      description: `Se han borrado ${targets.length} registros.` 
    });
    setCleanStep('idle');
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
          <p className="text-muted-foreground text-xs font-bold">Registro de transacciones diarias.</p>
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
            <Button variant="outline" onClick={handleExport} disabled={!filteredSales.length} className="h-11 w-11 p-0 rounded-2xl border-slate-200">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setCleanStep('options')}
              disabled={!allSales?.length} 
              className="h-11 w-11 p-0 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5"
            >
              <Eraser className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest">Cargando...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-100" />
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin registros</h3>
          </div>
        ) : (
          filteredSales.map((sale) => {
            const date = sale.saleDateTime?.toDate?.() || (sale.saleDateTime ? new Date(sale.saleDateTime) : new Date());
            const totalItems = (sale.productSaleItemIds?.length || 0) + (sale.manualSaleItemIds?.length || 0);
            
            return (
              <Card key={sale.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl group bg-white">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="items" className="border-none">
                    <div className="flex items-center p-3 md:p-4 gap-3 md:gap-6">
                      <div className="min-w-[70px] flex flex-col">
                        <span className="text-xs font-black text-slate-800">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">
                          #{sale.id?.slice(-5)}
                        </span>
                      </div>
                      
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="text-[9px] font-black uppercase bg-slate-50 border-slate-100 px-2 py-0.5 shrink-0">
                          {totalItems} Art.
                        </Badge>
                        <AccordionTrigger className="hover:no-underline py-0 justify-start gap-2 text-primary font-bold text-[10px] uppercase tracking-tighter truncate">
                          <ChevronRight className="w-3 h-3" /> Detalle
                        </AccordionTrigger>
                      </div>

                      <div className="text-right min-w-[90px] flex items-center gap-3">
                        <span className="text-lg font-black text-primary font-mono tracking-tighter leading-none">
                          ${Math.round(sale.totalAmount).toLocaleString('es-CL')}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-full" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSaleToDelete(sale);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                              <span className="font-black text-primary">${Math.round(item.price * item.quantity).toLocaleString('es-CL')}</span>
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
      </div>

      {/* DIÁLOGO ÚNICO DE LIMPIEZA PASO A PASO - EVITA BLOQUEOS DE INTERFAZ */}
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
                    {bulkType === 'day' ? 'Hoy' : bulkType === 'month' ? 'Este Mes' : 'Todo el Historial'}
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

      {/* BORRADO INDIVIDUAL - DIÁLOGO SIMPLE */}
      <Dialog open={!!saleToDelete} onOpenChange={(open) => !open && setSaleToDelete(null)}>
        <DialogContent className="rounded-3xl p-8 border-none shadow-2xl max-w-[90vw] sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
               <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-black text-destructive uppercase">Eliminar Venta</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold py-2">
              Se borrará el registro <span className="text-slate-800 font-mono">#{saleToDelete?.id?.slice(-8)}</span> definitivamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" className="rounded-xl h-12 flex-1 font-bold" onClick={() => setSaleToDelete(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl h-12 flex-1 font-black uppercase"
              onClick={() => {
                deleteDocumentNonBlocking(doc(firestore, "sales", saleToDelete.id));
                toast({ title: "Venta eliminada" });
                setSaleToDelete(null);
              }}
            >
              ELIMINAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
