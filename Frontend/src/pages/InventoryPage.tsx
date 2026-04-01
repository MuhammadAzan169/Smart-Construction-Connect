import { useMemo, useState } from "react";

import { GlassCard } from "@/components/shared/GlassCard";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockMaterials } from "@/data/mockData";
import { useAuthStore } from "@/stores/authStore";
import { Package, TrendingDown, TrendingUp } from "lucide-react";

type Material = (typeof mockMaterials)[number];

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

export default function InventoryPage() {
  const user = useAuthStore((s) => s.user);
  const [materials, setMaterials] = useState<Material[]>(() => [...mockMaterials]);

  const lowStockThreshold = 50;

  const stats = useMemo(() => {
    const total = materials.length;
    const lowStock = materials.filter((m) => m.stock <= lowStockThreshold).length;
    const categories = new Set(materials.map((m) => m.category)).size;
    const totalStock = materials.reduce((acc, m) => acc + m.stock, 0);
    return { total, lowStock, categories, totalStock };
  }, [materials]);

  if (!user) return null;

  if (user.role !== "supplier") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">This section is available for Supplier accounts.</p>
      </GlassCard>
    );
  }

  const updatePrice = (id: string, next: number) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, price: Math.max(0, Math.round(next)) } : m)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Material cards with pricing controls and stock visibility.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Products" value={stats.total} icon={Package} />
        <StatCard title="Categories" value={stats.categories} icon={TrendingUp} />
        <StatCard title="Total Stock" value={stats.totalStock.toLocaleString()} icon={TrendingUp} trend="up" change="Stable" />
        <StatCard title="Low Stock" value={stats.lowStock} icon={TrendingDown} trend="down" change="Attention" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {materials.map((m) => {
          const lowStock = m.stock <= lowStockThreshold;
          return (
            <GlassCard key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Supplier: {m.supplier}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-lg">
                      {m.category}
                    </Badge>
                    <Badge variant={lowStock ? "destructive" : "outline"} className="rounded-lg">
                      Stock: {m.stock.toLocaleString()} {m.unit}
                    </Badge>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICE</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{formatPKR(m.price)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <Input
                  type="number"
                  value={m.price}
                  onChange={(e) => updatePrice(m.id, Number(e.target.value))}
                  className="bg-background/40"
                  min={0}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updatePrice(m.id, m.price - 50)}
                  >
                    -50
                  </Button>
                  <Button
                    type="button"
                    onClick={() => updatePrice(m.id, m.price + 50)}
                  >
                    +50
                  </Button>
                </div>
              </div>

              {lowStock ? (
                <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  Low stock: prioritize restock to avoid order delays.
                </div>
              ) : null}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
