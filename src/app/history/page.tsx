
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, History, ShoppingBag, DollarSign, Loader2, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HistoryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

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
        Producto: "Venta sin desglose (antigua)",
        Cantidad: 1,
        Precio_Unitario: Math.round(s.totalAmount),
        Subtotal: Math.round(s.totalAmount),
        Tipo: "Desconocido",
        Total_Venta: Math.round(s.totalAmount)
      }];
    });
    exportToExcel("Historial_Detallado_SmartSale", flattened, "Ventas");
    toast({ title: "Exportación exitosa", description: "Se ha descargado el historial detallado en Excel." });
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <History className="w-8 h-8" />
            Historial
          </h1>
          <p className="text-muted-foreground">Revisa qué productos se vendieron en cada transacción.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!sales?.length} className="w-full md:w-auto">
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar Historial Detallado
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Loader2 className="w-12 h-12 animate-spin mb-2" />
            <p>Cargando historial...</p>
          </div>
        ) : !sales || sales.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl shadow-inner border-2 border-dashed">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-400">Sin Ventas Registradas</h3>
            <p className="text-slate-400">Las ventas que realices aparecerán aquí.</p>
          </div>
        ) : (
          sales.map((sale) => {
            const date = sale.saleDateTime?.toDate?.() || new Date();
            return (
              <Card key={sale.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl group">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="items" className="border-none">
                    <div className="flex flex-col md:flex-row">
                      <div className="bg-slate-50 p-6 flex flex-col justify-center border-r md:min-w-[180px] group-hover:bg-primary/5 transition-colors">
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
                        
                        {sale.itemsSummary && (
                           <AccordionTrigger className="hover:no-underline py-0 justify-start gap-2 text-primary font-bold text-xs">
                             <ChevronRight className="w-3 h-3" /> Ver Detalle de Productos
                           </AccordionTrigger>
                        )}
                      </div>

                      <div className="p-6 flex items-center justify-end md:min-w-[200px] bg-primary/5 border-l border-primary/5 group-hover:bg-primary/10 transition-colors">
                        <div className="text-right">
                          <p className="text-[10px] text-primary/60 font-black uppercase tracking-widest mb-1">Total</p>
                          <p className="text-4xl font-black text-primary font-mono tracking-tighter">${Math.round(sale.totalAmount).toLocaleString('es-CL')}</p>
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
                            <p className="text-xs text-slate-400 italic">No hay desglose disponible para esta venta antigua.</p>
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
    </div>
  );
}
