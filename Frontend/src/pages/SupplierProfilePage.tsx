import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockMaterials } from "@/data/mockData";
import { ArrowLeft, MapPin, Package, Star } from "lucide-react";

type Material = (typeof mockMaterials)[number];

type SupplierSummary = {
  id: string;
  name: string;
  materials: Material[];
  categories: string[];
  minPrice: number | null;
  maxPrice: number | null;
};

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

function supplierId(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function SupplierProfilePage() {
  const navigate = useNavigate();
  const params = useParams();

  const supplier: SupplierSummary | undefined = useMemo(() => {
    const id = params.id;
    if (!id) return undefined;

    const groups = new Map<string, Material[]>();
    for (const m of mockMaterials) {
      const list = groups.get(m.supplier) ?? [];
      list.push(m);
      groups.set(m.supplier, list);
    }

    for (const [name, items] of groups.entries()) {
      if (supplierId(name) !== id) continue;
      const categories = Array.from(new Set(items.map((x) => x.category))).sort();
      const prices = items.map((x) => x.price).filter((x) => typeof x === "number" && Number.isFinite(x));
      const minPrice = prices.length ? Math.min(...prices) : null;
      const maxPrice = prices.length ? Math.max(...prices) : null;
      return { id, name, materials: items, categories, minPrice, maxPrice };
    }

    return undefined;
  }, [params.id]);

  if (!supplier) {
    return (
      <GlassCard interactive={false} className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Supplier not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This supplier ID doesn’t exist in the current dataset.</p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/companies">Back to browse</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <h1 className="mt-4 truncate text-2xl font-bold text-foreground">{supplier.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Location —
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              Rating — (reviews —)
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="h-4 w-4" />
              {supplier.materials.length} materials
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button">Request quote</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <GlassCard interactive={false} className="p-6">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">MATERIAL TYPES</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {supplier.categories.map((c) => (
              <Badge key={c} variant="secondary" className="rounded-lg">
                {c}
              </Badge>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICING</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {supplier.minPrice == null || supplier.maxPrice == null
                  ? "Pricing —"
                  : supplier.minPrice === supplier.maxPrice
                    ? formatPKR(supplier.minPrice)
                    : `${formatPKR(supplier.minPrice)} - ${formatPKR(supplier.maxPrice)}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Based on listed material unit prices.</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">AVAILABILITY</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Stock varies by item</p>
              <p className="mt-1 text-xs text-muted-foreground">See each item’s stock below.</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">MATERIAL LIST</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {supplier.materials.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border bg-background/30 p-4">
                  <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Category: {m.category}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Stock</span>
                    <span className="font-semibold text-foreground">
                      {m.stock.toLocaleString()} {m.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold text-foreground">{formatPKR(m.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Contact</p>
            <p className="mt-2 text-sm text-muted-foreground">Contact information is not available in the current mock dataset.</p>
          </GlassCard>

          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Service area</p>
            <p className="mt-2 text-sm text-muted-foreground">Location data is not available in the current mock dataset.</p>
          </GlassCard>

          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Reviews</p>
            <p className="mt-2 text-sm text-muted-foreground">Ratings/reviews are not available in the current mock dataset.</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
