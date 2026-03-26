"use client";

import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, History, ShoppingBag, DollarSign, Loader2, Package, ChevronRight, Trash2, Eraser, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function HistoryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [saleToDelete, setSaleToDelete] = useState<any | null>(null);
  const [bulkDeleteType, setBulkDeleteType] = useState<'day' | 'month' | 'all' | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const salesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "sales"), orderBy("saleDateTime", "desc"));
  }, [firestore]);

  const { data: sales, isLoading } = useCollection(salesQuery);

  const handleExport = () => {
    if (!sales) return;
    const flattened = sales.flatMap(s => {
      const date = s.saleDateTime?.toDate?.() || new Date();
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
    exportToExcel("Historial_AltodelBosque", flattened, "Ventas");
    toast({ title: "Exportación exitosa", description: "Se ha descargado el historial en Excel." });
  };

  const confirmDeleteIndividual = () => {
    if (!saleToDelete) return;
    const docRef = doc(firestore, "sales", saleToDelete.id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Venta eliminada", description: "El registro ha sido borrado de la base de datos." });
    setSaleToDelete(null);
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteType || !sales) return;
    
    setIsCleaning(true);
    const type = bulkDeleteType;
    setBulkDeleteType(null);

    const now = new Date();
    let targets: any[] = [];

    if (type === 'day') {
      targets = sales.filter(s => {
        const d = s.saleDateTime?.toDate?.();
        if (!d) return false;
        return d.toDateString() === now.toDateString();
      });
    } else if (type === 'month') {
      targets = sales.filter(s => {
        const d = s.saleDateTime?.toDate?.();
        if (!d) return false;
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (type === 'all') {
      targets = sales;
    }

    if (targets.length === 0) {
      toast({ title: "Sin registros", description: "No se encontraron ventas para borrar en este rango." });
      setIsCleaning(false);
    } else {
      targets.forEach(t => {
        deleteDocumentNonBlocking(doc(firestore, "sales", t.id));
      });
      
      toast({ 
        title: "Limpieza completada", 
        description: `Se han eliminado ${targets.length} registros del historial y reportes.` 
      });
      
      setTimeout(() => setIsCleaning(false), 500);
    }
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {isCleaning && (
        <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <h2 className="text-xl font-black text-primary tracking-tighter uppercase">Limpiando Datos</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-2">
            Actualizando historial y reportes...
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <History className="w-8 h-8" />
            Historial
          </h1>
          <p className="text-muted-foreground">Gestiona tus ventas. Borrar datos afectará a tus reportes.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isCleaning || !sales?.length} className="flex-1 md:flex-none border-destructive text-destructive hover:bg-destructive/5 h-11 rounded-2xl">
                <Eraser className="w-4 h-4 mr-2" /> Limpiar Historial
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
              <DropdownMenuLabel className="font-black text-[10px] uppercase tracking-widest opacity-50 px-3 py-2">Opciones de Borrado</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={() => setBulkDeleteType('day')} className="rounded-xl py-3 cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                <Calendar className="w-4 h-4 mr-2" /> Borrar Hoy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkDeleteType('month')} className="rounded-xl py-3 cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                <History className="w-4 h-4 mr-2" /> Borrar este Mes
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={() => setBulkDeleteType('all')} className="rounded-xl py-3 cursor-pointer text-destructive font-bold focus:bg-destructive focus:text-white">
                <Trash2 className="w-4 h-4 mr-2" /> BORRAR TODO
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" onClick={handleExport} disabled={!sales?.length || isCleaning} className="flex-1 md:flex-none h-11 rounded-2xl">
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Loader2 className="w-12 h-12 animate-spin mb-2" />
            <p>Cargando historial...</p>
          </div>
        ) : !sales || sales.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl shadow-inner border-2 border-dashed border-slate-200">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-400">Sin Ventas Registradas</h3>
            <p className="text-slate-400">Las ventas aparecerán aquí una vez que cobres.</p>
          </div>
        ) : (
          sales.map((sale) => {
            const date = sale.saleDateTime?.toDate?.() || new Date();
            return (
              <Card key={sale.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl group">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="items" className="border-none">
                    <div className="flex flex-col md:flex-row">
                      <div className="bg-slate-50 p-6 flex flex-col justify-center border-r border-slate-100 md:min-w-[180px] group-hover:bg-primary/5 transition-colors">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                          <Calendar className="w-3 h-3" />
                          {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </div>
                        <div className="text-2xl font-black text-slate-700">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-2 truncate max-w-[140px]">
                          #{sale.id?.slice(-8)}
                        </div>
                      </div>
                      
                      <div className="flex-1 p-6 flex flex-col justify-center gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-2 bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full border border-primary/10">
                              <ShoppingBag className="w-3 h-3" />
                              {sale.productSaleItemIds?.length || 0} Prod.
                            </div>
                            <div className="flex items-center gap-2 bg-accent/10 text-accent text-[10px] font-bold px-3 py-1.5 rounded-full border border-accent/10">
                              <DollarSign className="w-3 h-3" />
                              {sale.manualSaleItemIds?.length || 0} Manuales
                            </div>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isCleaning}
                            className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSaleToDelete(sale);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {sale.itemsSummary && (
                           <AccordionTrigger className="hover:no-underline py-0 justify-start gap-2 text-primary font-bold text-xs">
                             <ChevronRight className="w-3 h-3" /> Ver Detalle de Productos
                           </AccordionTrigger>
                        )}
                      </div>

                      <div className="p-6 flex items-center justify-end md:min-w-[200px] bg-primary/5 border-l border-primary/5 group-hover:bg-primary/10 transition-colors">
                        <div className="text-right">
                          <p className="text-[10px] text-primary/60 font-black uppercase tracking-widest mb-1">Total</p>
                          <p className="text-4xl font-black text-primary font-mono tracking-tighter leading-none">${Math.round(sale.totalAmount).toLocaleString('es-CL')}</p>
                        </div>
                      </div>
                    </div>
                    
                    <AccordionContent className="bg-slate-50/50 p-6 pt-0 border-t border-slate-100">
                      <div className="space-y-3 mt-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Package className="w-3 h-3" /> Artículos en esta boleta
                        </h4>
                        <div className="grid gap-2">
                          {sale.itemsSummary?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">
                                  {item.type === 'manual' ? 'Entrada Manual' : `Cód: ${item.id}`}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black text-primary">
                                  {item.quantity} x ${Math.round(item.price).toLocaleString('es-CL')}
                                </div>
                                <div className="text-sm font-black text-slate-700">
                                  ${Math.round(item.price * item.quantity).toLocaleString('es-CL')}
                                </div>
                              </div>
                            </div>
                          ))}
                          {!sale.itemsSummary && (
                            <p className="text-xs text-slate-400 italic">No hay desglose disponible para esta venta.</p>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog open={!!saleToDelete} onOpenChange={() => setSaleToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-destructive flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              ¿Eliminar Registro?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 pt-2">
              Esta acción borrará definitivamente la venta <span className="font-mono font-bold text-slate-800">#{saleToDelete?.id?.slice(-8)}</span>.
              <br/><br/>
              <span className="text-destructive font-bold uppercase text-[10px] tracking-widest">Aviso:</span> Esta venta ya no aparecerá en tus reportes e ingresos totales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="rounded-2xl h-12 flex-1 border-slate-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteIndividual} className="rounded-2xl h-12 flex-1 bg-destructive hover:bg-destructive/90 font-black">
              ELIMINAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!bulkDeleteType} onOpenChange={() => setBulkDeleteType(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-destructive flex items-center gap-2">
              <Eraser className="w-6 h-6" />
              Limpieza Masiva
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 pt-2">
              {bulkDeleteType === 'day' && "¿Borrar TODAS las ventas de hoy? Esto pondrá a cero tus reportes diarios."}
              {bulkDeleteType === 'month' && "¿Borrar TODAS las ventas de este mes? Tus reportes mensuales se verán afectados."}
              {bulkDeleteType === 'all' && "¡ATENCIÓN! Esto borrará el HISTORIAL Y REPORTES COMPLETOS. Tus ingresos acumulados volverán a cero."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="rounded-2xl h-12 flex-1 border-slate-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="rounded-2xl h-12 flex-1 bg-destructive hover:bg-destructive/90 font-black">
              CONFIRMAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
