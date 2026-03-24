"use client";

import { useEffect, useState } from "react";
import { db, Sale } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, History, ShoppingBag, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

export default function HistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "ventas"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as Sale));
      setSales(data);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const flattened = sales.map(s => ({
      ID_Venta: s.id,
      Fecha: s.timestamp.toLocaleDateString(),
      Hora: s.timestamp.toLocaleTimeString(),
      Total: s.total,
      "Items Registrados": s.items.map(i => `${i.name} (x${i.quantity})`).join("; "),
      "Items Manuales": s.manualProducts.length
    }));
    exportToExcel("Historial_Ventas_SmartSale", flattened, "Ventas");
    toast({ title: "Exportación exitosa", description: "Se ha descargado el historial completo en Excel." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <History className="w-8 h-8" />
            Historial
          </h1>
          <p className="text-muted-foreground">Revisa el detalle de todas las transacciones realizadas.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={sales.length === 0} className="w-full md:w-auto">
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Exportar Historial
        </Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Clock className="w-12 h-12 animate-pulse mb-2" />
            <p>Cargando historial...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl shadow-inner border-2 border-dashed">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-400">Sin Ventas Registradas</h3>
            <p className="text-slate-400">Las ventas que realices aparecerán aquí.</p>
          </div>
        ) : (
          sales.map((sale) => (
            <Card key={sale.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl group">
              <div className="flex flex-col md:flex-row">
                <div className="bg-slate-50 p-6 flex flex-col justify-center border-r md:min-w-[180px] group-hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                    <Calendar className="w-3 h-3" />
                    {sale.timestamp.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="text-2xl font-black text-slate-700">
                    {sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-2 truncate max-w-[140px]">
                    #{sale.id?.slice(-8)}
                  </div>
                </div>
                <div className="flex-1 p-6">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-primary/5 text-primary text-xs font-bold px-3 py-1.5 rounded-full border border-primary/10">
                        <ShoppingBag className="w-3 h-3" />
                        {item.name} <span className="text-primary/40 ml-1">x{item.quantity}</span>
                      </div>
                    ))}
                    {sale.manualProducts.map((p, idx) => (
                      <div key={`m-${idx}`} className="flex items-center gap-2 bg-accent/5 text-accent text-xs font-bold px-3 py-1.5 rounded-full border border-accent/10">
                        <DollarSign className="w-3 h-3" />
                        Ingreso Manual <span className="ml-1 opacity-60">${p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 flex items-center justify-end md:min-w-[200px] bg-primary/5 border-l border-primary/5 group-hover:bg-primary/10 transition-colors">
                  <div className="text-right">
                    <p className="text-[10px] text-primary/60 font-black uppercase tracking-widest mb-1">Total Cobrado</p>
                    <p className="text-4xl font-black text-primary font-mono tracking-tighter">${sale.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
