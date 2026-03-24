
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, History, BarChart3, ShoppingCart, Store, Notebook } from "lucide-react";
import { cn } from "@/lib/utils";

const NavItems = [
  { name: "Venta", href: "/", icon: ShoppingCart },
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Historial", href: "/history", icon: History },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Notas", href: "/notes", icon: Notebook },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t md:top-0 md:bottom-auto md:h-16 md:flex md:items-center md:px-8 shadow-sm">
      <div className="flex md:hidden w-full justify-around py-2">
        {NavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all",
              pathname === item.href ? "text-primary scale-110" : "text-slate-400 hover:text-primary"
            )}
          >
            <item.icon className={cn("w-6 h-6", pathname === item.href && "fill-primary/10")} />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-8 w-full max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 mr-auto group">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
            <Store className="w-6 h-6" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-headline font-black text-xl tracking-tighter text-slate-800">SmartSale</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Point of Sale</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {NavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-2xl text-sm font-bold transition-all duration-300",
                pathname === item.href 
                  ? "bg-primary text-white shadow-xl shadow-primary/30 scale-105" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
