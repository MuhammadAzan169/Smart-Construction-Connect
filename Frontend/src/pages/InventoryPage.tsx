import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { GlassCard } from "@/components/shared/GlassCard";
import { StaggerList, StaggerItem } from "@/components/shared/AnimationPrimitives";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Loader2, Package, Save, TrendingDown, TrendingUp } from "lucide-react";

type Material = {
  name: string;
  category: string;
  brand: string;
  price: number;
  unit: string;
  stock: number;
};

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

export default function InventoryPage() {
  const user = useAuthStore((s) => s.user);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const supplierSlug = user?.supplierFile;

  useEffect(() => {
    if (!supplierSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api.suppliers
      .getProfile(supplierSlug)
      .then((data: any) => {
        if (cancelled) return;
        const mats: Material[] = (data.materials ?? []).map((m: any) => ({
          name: m.name ?? "",
          category: m.category ?? "",
          brand: m.brand ?? "",
          price: typeof m.price === "number" ? m.price : 0,
          unit: m.unit ?? "",
          stock: typeof m.stock === "number" ? m.stock : 0,
        }));
        setMaterials(mats);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [supplierSlug]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const updatePrice = (idx: number, next: number) => {
    setMaterials((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, price: Math.max(0, Math.round(next)) } : m))
    );
    setDirty(true);
  };

  const handleSave = async () => {
    if (!supplierSlug) return;
    setSaving(true);
    try {
      await api.suppliers.updateMaterials(supplierSlug, materials);
      setDirty(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex items-start justify-between gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Material cards with pricing controls and stock visibility.</p>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </motion.div>

      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem><StatCard title="Products" value={stats.total} icon={Package} /></StaggerItem>
        <StaggerItem><StatCard title="Categories" value={stats.categories} icon={TrendingUp} /></StaggerItem>
        <StaggerItem><StatCard title="Total Stock" value={stats.totalStock.toLocaleString()} icon={TrendingUp} trend="up" change="Stable" /></StaggerItem>
        <StaggerItem><StatCard title="Low Stock" value={stats.lowStock} icon={TrendingDown} trend="down" change="Attention" /></StaggerItem>
      </StaggerList>

      {materials.length === 0 ? (
        <GlassCard interactive={false} className="p-8 text-center">
          <p className="text-sm font-semibold text-foreground">No materials found.</p>
          <p className="mt-1 text-sm text-muted-foreground">Your inventory is empty.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {materials.map((m, idx) => {
            const lowStock = m.stock <= lowStockThreshold;
            return (
              <motion.div
                key={`${m.name}-${idx}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.06, 0.5), duration: 0.35 }}
              >
              <GlassCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Brand: {m.brand || "—"}</p>

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
                    onChange={(e) => updatePrice(idx, Number(e.target.value))}
                    className="bg-background/40"
                    min={0}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => updatePrice(idx, m.price - 50)}
                    >
                      -50
                    </Button>
                    <Button
                      type="button"
                      onClick={() => updatePrice(idx, m.price + 50)}
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
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
