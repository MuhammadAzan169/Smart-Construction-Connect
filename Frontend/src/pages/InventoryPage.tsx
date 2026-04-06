import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { GlassCard } from "@/components/shared/GlassCard";
import { StaggerList, StaggerItem, ConfirmModal } from "@/components/shared/AnimationPrimitives";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft, Edit2, Loader2, Package, Plus, Save, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";

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

const categoryOptions = [
  "Cement", "Steel", "Bricks", "Aggregate", "Paint", "Tiles", "Wood",
  "Electrical", "Plumbing", "Glass", "Doors & Windows", "Hardware",
  "Waterproofing", "Concrete", "Marble & Granite", "Other",
];

const unitOptions = ["bag", "ton", "kg", "cft", "sq ft", "ft", "piece", "sheet", "bucket", "tin", "roll", "liter", "set"];

const emptyMaterial: Material = { name: "", category: "", brand: "", price: 0, unit: "piece", stock: 0 };

export default function InventoryPage() {
  const user = useAuthStore((s) => s.user);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Material>(emptyMaterial);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState<Material>(emptyMaterial);

  const supplierSlug = user?.supplierFile;
  const navigate = useNavigate();

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

  const updateField = (idx: number, field: keyof Material, value: string | number) => {
    setMaterials((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
    setDirty(true);
  };

  const removeMaterial = (idx: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const addMaterial = () => {
    if (!addForm.name.trim() || !addForm.category.trim()) return;
    setMaterials((prev) => [...prev, { ...addForm, name: addForm.name.trim(), brand: addForm.brand.trim(), price: Math.max(0, Math.round(addForm.price)), stock: Math.max(0, Math.round(addForm.stock)) }]);
    setAddForm(emptyMaterial);
    setShowAddDialog(false);
    setDirty(true);
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditForm({ ...materials[idx] });
  };

  const saveEdit = () => {
    if (editingIdx == null) return;
    setMaterials((prev) =>
      prev.map((m, i) => (i === editingIdx ? { ...editForm, price: Math.max(0, Math.round(editForm.price)), stock: Math.max(0, Math.round(editForm.stock)) } : m))
    );
    setEditingIdx(null);
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Material cards with pricing controls and stock visibility.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => { setAddForm(emptyMaterial); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4" /> Add Material
          </Button>
          {dirty && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </div>
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
          <p className="mt-1 text-sm text-muted-foreground">Your inventory is empty. Click "Add Material" to get started.</p>
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
                    <p className="mt-1 text-xs text-muted-foreground">Brand: {m.brand || "—"} · Unit: {m.unit || "—"}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-lg">
                        {m.category}
                      </Badge>
                      <Badge variant={lowStock ? "destructive" : "outline"} className="rounded-lg">
                        Stock: {m.stock.toLocaleString()} {m.unit}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICE</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{formatPKR(m.price)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Price (PKR)</Label>
                    <Input
                      type="number"
                      value={m.price}
                      onChange={(e) => updateField(idx, "price", Number(e.target.value))}
                      className="bg-background/40"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Stock ({m.unit})</Label>
                    <Input
                      type="number"
                      value={m.stock}
                      onChange={(e) => updateField(idx, "stock", Number(e.target.value))}
                      className="bg-background/40"
                      min={0}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(idx)}>
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteIdx(idx)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="secondary" size="sm" onClick={() => updateField(idx, "price", m.price - 50)}>-50</Button>
                    <Button type="button" size="sm" onClick={() => updateField(idx, "price", m.price + 50)}>+50</Button>
                  </div>
                </div>

                {lowStock ? (
                  <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    Low stock: prioritize restock to avoid order delays.
                  </div>
                ) : null}
              </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Add Material Dialog ────────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Material Name</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g., Bestway Cement (50kg)" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={addForm.category || "__none__"} onValueChange={(v) => setAddForm((prev) => ({ ...prev, category: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select…</SelectItem>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input value={addForm.brand} onChange={(e) => setAddForm((prev) => ({ ...prev, brand: e.target.value }))} placeholder="e.g., Bestway" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Price (PKR)</Label>
                <Input type="number" min={0} value={addForm.price || ""} onChange={(e) => setAddForm((prev) => ({ ...prev, price: Number(e.target.value) }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={addForm.unit || "piece"} onValueChange={(v) => setAddForm((prev) => ({ ...prev, unit: v }))}>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input type="number" min={0} value={addForm.stock || ""} onChange={(e) => setAddForm((prev) => ({ ...prev, stock: Number(e.target.value) }))} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button type="button" onClick={addMaterial} disabled={!addForm.name.trim() || !addForm.category.trim()}>Add Material</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Material Dialog ───────────────────────────────────────────── */}
      <Dialog open={editingIdx !== null} onOpenChange={(open) => { if (!open) setEditingIdx(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Material Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Material name" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category || "__none__"} onValueChange={(v) => setEditForm((prev) => ({ ...prev, category: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select…</SelectItem>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} placeholder="Brand" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Price (PKR)</Label>
                <Input type="number" min={0} value={editForm.price || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={editForm.unit || "piece"} onValueChange={(v) => setEditForm((prev) => ({ ...prev, unit: v }))}>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input type="number" min={0} value={editForm.stock || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, stock: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditingIdx(null)}>Cancel</Button>
            <Button type="button" onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteIdx !== null}
        onOpenChange={(open) => { if (!open) setDeleteIdx(null); }}
        title="Remove material?"
        description="This material will be removed from your inventory. Save to persist the change."
        confirmText="Remove"
        variant="destructive"
        onConfirm={() => { if (deleteIdx !== null) { removeMaterial(deleteIdx); setDeleteIdx(null); } }}
      />
    </motion.div>
  );
}
