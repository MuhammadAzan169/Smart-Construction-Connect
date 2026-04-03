import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { SectionReveal } from "@/components/shared/AnimationPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { ArrowLeft, MapPin, Package, Phone, Mail, Globe, Star } from "lucide-react";

type SupplierMaterial = {
  name: string;
  category: string;
  brand: string;
  price: number;
  unit: string;
  stock: number;
};

type SupplierData = {
  supplier_id: string;
  supplier_name: string;
  description: string;
  logo: string;
  logo_url?: string;
  city?: string;
  area?: string;
  location?: { city: string; area: string };
  cities_served: string[];
  contact: { phone: string; email: string; website: string };
  materials: SupplierMaterial[];
  status: string;
  rating: number;
  review_count: number;
  slug?: string;
};

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

export default function SupplierProfilePage() {
  const navigate = useNavigate();
  const params = useParams();
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    api.suppliers
      .get(params.id)
      .then(setSupplier)
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <GlassCard interactive={false} className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Supplier not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This supplier doesn't exist in the current dataset.</p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/companies">Back to browse</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  const supplierCity = supplier.city || supplier.location?.city || "—";
  const supplierArea = supplier.area || supplier.location?.area || "";

  const categories = Array.from(new Set(supplier.materials.map((m) => m.category))).sort();
  const prices = supplier.materials.map((m) => m.price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="min-w-0">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <h1 className="mt-4 truncate text-2xl font-bold text-foreground">{supplier.supplier_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{supplier.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {supplierCity}{supplierArea ? `, ${supplierArea}` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              {supplier.rating}/5 ({supplier.review_count} reviews)
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="h-4 w-4" />
              {supplier.materials.length} materials
            </span>
          </div>
        </div>
      </motion.div>

      <SectionReveal>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left — Material details */}
        <div className="space-y-6">
          <GlassCard interactive={false} className="p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">MATERIAL CATEGORIES</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Badge key={c} variant="secondary" className="rounded-lg">
                  {c}
                </Badge>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICE RANGE</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {minPrice == null || maxPrice == null
                    ? "Contact for pricing"
                    : minPrice === maxPrice
                      ? formatPKR(minPrice)
                      : `${formatPKR(minPrice)} - ${formatPKR(maxPrice)}`}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">CITIES SERVED</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {supplier.cities_served.join(", ") || "—"}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">ALL MATERIALS</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {supplier.materials.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.3 }}
                >
                <div className="rounded-2xl border border-border bg-background/30 p-4 transition-colors hover:border-primary/20">
                  <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                    <span className="text-xs text-muted-foreground">{m.brand}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price per {m.unit}</span>
                    <span className="font-semibold text-foreground">{formatPKR(m.price)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Stock</span>
                    <span className="font-semibold text-foreground">
                      {m.stock.toLocaleString()} {m.unit}
                    </span>
                  </div>
                </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right — Contact & Info */}
        <div className="space-y-4">
          <GlassCard interactive={false} className="p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">CONTACT INFORMATION</p>
            <div className="mt-4 space-y-3">
              {supplier.contact.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{supplier.contact.phone}</span>
                </div>
              )}
              {supplier.contact.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{supplier.contact.email}</span>
                </div>
              )}
              {supplier.contact.website && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{supplier.contact.website}</span>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">SUPPLIER STATS</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rating</span>
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  {supplier.rating}/5
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reviews</span>
                <span className="font-semibold text-foreground">{supplier.review_count}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Materials Listed</span>
                <span className="font-semibold text-foreground">{supplier.materials.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Categories</span>
                <span className="font-semibold text-foreground">{categories.length}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
      </SectionReveal>
    </motion.div>
  );
}
