import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/components/shared/GlassCard";
import { StaggerList, StaggerItem, ConfirmModal } from "@/components/shared/AnimationPrimitives";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ImageIcon, Loader2, Package, Pencil, Plus, Save, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";

type Material = {
  name: string;
  category: string;
  brand: string;
  price: number;
  unit: string;
  stock: number;
  description: string;
  image_urls: string[];
};

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

const categoryOptions = [
  "Cement", "Steel", "Bricks", "Aggregate", "Paint", "Tiles", "Wood",
  "Electrical", "Plumbing", "Glass", "Doors & Windows", "Hardware",
  "Waterproofing", "Concrete", "Marble & Granite", "Other",
];

const unitOptions = ["bag", "ton", "kg", "cft", "sqft", "ft", "piece", "sheet", "bucket", "tin", "roll", "liter", "set", "meter", "gallon", "truck", "bundle"];

const emptyMaterial: Material = { name: "", category: "", brand: "", price: 0, unit: "bag", stock: 0, description: "", image_urls: [] };

export default function InventoryPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingMaterialIdx, setEditingMaterialIdx] = useState<number>(-1);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const materialImageInputRef = useRef<HTMLInputElement>(null);

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
          ...emptyMaterial,
          name: m.name ?? "",
          category: m.category ?? "",
          brand: m.brand ?? "",
          price: typeof m.price === "number" ? m.price : 0,
          unit: m.unit ?? "",
          stock: typeof m.stock === "number" ? m.stock : 0,
          description: m.description ?? "",
          image_urls: Array.isArray(m.image_urls) ? m.image_urls : [],
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

  const saveMaterials = async (mats: Material[]) => {
    if (!supplierSlug) return;
    setSaving(true);
    try {
      await api.suppliers.updateMaterials(supplierSlug, mats as unknown as Record<string, unknown>[]);
      setDirty(false);
      toast({ title: "Materials saved" });
    } catch {
      toast({ variant: "destructive", title: "Failed to save materials" });
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = async (idx: number) => {
    const newMats = materials.filter((_, i) => i !== idx);
    setMaterials(newMats);
    await saveMaterials(newMats);
  };

  const commitMaterial = async () => {
    if (!editingMaterial || !editingMaterial.name.trim() || !editingMaterial.category) return;
    const mat = { ...editingMaterial, price: Math.max(0, Math.round(editingMaterial.price)), stock: Math.max(0, Math.round(editingMaterial.stock)) };
    const newMats = editingMaterialIdx >= 0
      ? materials.map((m, i) => (i === editingMaterialIdx ? mat : m))
      : [...materials, mat];
    setMaterials(newMats);
    setEditingMaterial(null);
    setEditingMaterialIdx(-1);
    await saveMaterials(newMats);
  };

  const handleSave = async () => {
    await saveMaterials(materials);
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
          <h1 className="text-2xl font-bold text-foreground">{t("inventory.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => { setEditingMaterial({ ...emptyMaterial }); setEditingMaterialIdx(-1); }}
          >
            <Plus className="h-4 w-4" /> Add Material
          </Button>
          {dirty && (
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
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

      {/* ── Add / Edit Material Panel ───────────────────────────────────────── */}
      {editingMaterial && (
        <GlassCard interactive={false} className="p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">
            {editingMaterialIdx >= 0 ? "Edit Material" : "Add New Material"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Material name *</Label>
              <Input
                value={editingMaterial.name}
                onChange={(e) => setEditingMaterial((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                placeholder="e.g., Portland Cement OPC"
                className="bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category *</Label>
              <Select
                value={editingMaterial.category || "__none__"}
                onValueChange={(v) => setEditingMaterial((prev) => prev ? { ...prev, category: v === "__none__" ? "" : v } : prev)}
              >
                <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select category</SelectItem>
                  {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Brand</Label>
              <Input
                value={editingMaterial.brand}
                onChange={(e) => setEditingMaterial((prev) => prev ? { ...prev, brand: e.target.value } : prev)}
                placeholder="e.g., DG Cement"
                className="bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Select
                value={editingMaterial.unit || "bag"}
                onValueChange={(v) => setEditingMaterial((prev) => prev ? { ...prev, unit: v } : prev)}
              >
                <SelectTrigger className="bg-background/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Price (PKR)</Label>
              <NumberInput
                min={0}
                step={100}
                value={editingMaterial.price || ""}
                onChange={(e) => setEditingMaterial((prev) => prev ? { ...prev, price: Number(e.target.value) || 0 } : prev)}
                placeholder="e.g., 1250"
                className="bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stock</Label>
              <NumberInput
                min={0}
                value={editingMaterial.stock || ""}
                onChange={(e) => setEditingMaterial((prev) => prev ? { ...prev, stock: Number(e.target.value) || 0 } : prev)}
                placeholder="e.g., 500"
                className="bg-background/40"
              />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={editingMaterial.description}
              onChange={(e) => setEditingMaterial((prev) => prev ? { ...prev, description: e.target.value } : prev)}
              placeholder="Brief description of this material…"
              className="bg-background/40 min-h-[60px]"
            />
          </div>

          {/* Image upload */}
          <div className="mt-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Images (up to 5)</Label>
            <div className="flex flex-wrap gap-2">
              {editingMaterial.image_urls.map((url, imgIdx) => (
                <div key={imgIdx} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => setEditingMaterial((prev) => prev ? { ...prev, image_urls: prev.image_urls.filter((_, i) => i !== imgIdx) } : prev)}
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
              {editingMaterial.image_urls.length < 5 && (
                <button
                  type="button"
                  className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  onClick={() => materialImageInputRef.current?.click()}
                >
                  <ImageIcon className="h-5 w-5" />
                  <span className="mt-1 text-[10px]">Add</span>
                </button>
              )}
            </div>
            <input
              ref={materialImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !editingMaterial || !supplierSlug) return;
                try {
                  const url = await api.upload.gallery(file, supplierSlug, "material", String(editingMaterialIdx >= 0 ? editingMaterialIdx : materials.length), "supplier");
                  setEditingMaterial((prev) => prev ? { ...prev, image_urls: [...prev.image_urls, url] } : prev);
                } catch {
                  toast({ variant: "destructive", title: "Image upload failed" });
                }
                if (materialImageInputRef.current) materialImageInputRef.current.value = "";
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setEditingMaterial(null); setEditingMaterialIdx(-1); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editingMaterial.name.trim() || !editingMaterial.category || saving}
              onClick={commitMaterial}
            >
              {saving ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {editingMaterialIdx >= 0 ? "Update" : "Add"} Material
            </Button>
          </div>
        </GlassCard>
      )}

      {materials.length === 0 && !editingMaterial ? (
        <GlassCard interactive={false} className="p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold text-foreground">No materials yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Your inventory is empty.</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => { setEditingMaterial({ ...emptyMaterial }); setEditingMaterialIdx(-1); }}
          >
            Add your first material
          </Button>
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
                {/* Material image thumbnail */}
                {m.image_urls?.[0] && (
                  <img
                    src={m.image_urls[0]}
                    alt={m.name}
                    className="mb-4 h-36 w-full rounded-xl object-cover"
                  />
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Brand: {m.brand || "—"} · Unit: {m.unit || "—"}</p>
                    {m.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-lg">{m.category}</Badge>
                      <Badge variant={lowStock ? "destructive" : "outline"} className="rounded-lg">
                        Stock: {m.stock.toLocaleString()} {m.unit}
                      </Badge>
                      {m.image_urls?.length > 0 && (
                        <Badge variant="outline" className="rounded-lg text-[10px]">
                          {m.image_urls.length} image{m.image_urls.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICE</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{formatPKR(m.price)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Price (PKR)</Label>
                    <NumberInput
                      min={0}
                      step={100}
                      value={m.price}
                      onChange={(e) => updateField(idx, "price", Number(e.target.value))}
                      className="bg-background/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Stock ({m.unit})</Label>
                    <NumberInput
                      min={0}
                      value={m.stock}
                      onChange={(e) => updateField(idx, "stock", Number(e.target.value))}
                      className="bg-background/40"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingMaterial({ ...emptyMaterial, ...m, image_urls: [...(m.image_urls || [])] });
                        setEditingMaterialIdx(idx);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteIdx(idx)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="secondary" size="sm" onClick={() => updateField(idx, "price", Math.max(0, m.price - 50))}>-50</Button>
                    <Button type="button" size="sm" onClick={() => updateField(idx, "price", m.price + 50)}>+50</Button>
                  </div>
                </div>

                {lowStock && (
                  <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    Low stock: prioritize restock to avoid order delays.
                  </div>
                )}
              </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Confirm Delete ─────────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteIdx !== null}
        onOpenChange={(open) => { if (!open) setDeleteIdx(null); }}
        title="Remove material?"
        description="This material will be permanently removed from your inventory."
        confirmText="Remove"
        variant="destructive"
        onConfirm={() => { if (deleteIdx !== null) { removeMaterial(deleteIdx); setDeleteIdx(null); } }}
      />
    </motion.div>
  );
}
