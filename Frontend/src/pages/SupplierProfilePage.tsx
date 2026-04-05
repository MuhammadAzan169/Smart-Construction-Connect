import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { PdfViewerDialog } from "@/components/shared/PdfViewerDialog";
import { SectionReveal } from "@/components/shared/AnimationPrimitives";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, Eye,
  MapPin, MessageSquare, Package, Phone, Mail, Globe,
  ShieldCheck, Star, AlertTriangle, Layers, TrendingUp,
  BarChart3, Truck, Tag,
} from "lucide-react";

type SupplierMaterial = {
  name: string;
  category: string;
  brand: string;
  price: number;
  unit: string;
  stock: number;
  image_urls?: string[];
  description?: string;
};

type SupplierData = {
  supplier_id: string;
  supplier_name: string;
  description: string;
  logo: string;
  logo_url?: string;
  dp_url?: string;
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
  verification_status?: string;
  verification?: Record<string, { status: string }>;
  verification_documents?: Record<string, string>;
};

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

/* ------------------------------------------------------------------ */

export default function SupplierProfilePage() {
  const navigate = useNavigate();
  const params = useParams();
  const user = useAuthStore((s) => s.user);
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<SupplierMaterial | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    api.suppliers
      .get(params.id)
      .then((data) => setSupplier(data as unknown as SupplierData))
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className="space-y-6 p-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  /* ---------- Not Found ---------- */
  if (!supplier) {
    return (
      <GlassCard interactive={false} className="p-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-destructive/10">
            <Package className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
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

  /* ---------- Derived Data ---------- */
  const supplierCity = supplier.city || supplier.location?.city || "—";
  const supplierArea = supplier.area || supplier.location?.area || "";
  const supplierLogo = supplier.logo_url || supplier.logo || "";
  const isVerified = supplier.verification_status === "verified";

  const categories = Array.from(new Set(supplier.materials.map((m) => m.category))).sort();
  const filteredMaterials = activeCategory
    ? supplier.materials.filter((m) => m.category === activeCategory)
    : supplier.materials;
  const prices = supplier.materials.map((m) => m.price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const lowStockCount = supplier.materials.filter((m) => m.stock > 0 && m.stock <= 50).length;
  const totalStock = supplier.materials.reduce((sum, m) => sum + m.stock, 0);

  /* ================================================================ */
  return (
    <>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* ===== BACK BUTTON ===== */}
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* ===== HERO BANNER ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Banner image */}
            <div className="group relative h-52 overflow-hidden sm:h-60">
              {supplier.dp_url ? (
                <img src={supplier.dp_url} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : supplierLogo ? (
                <img src={supplierLogo} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            </div>

            {/* Logo + info overlay */}
            <div className="relative -mt-16 px-6 pb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                {supplierLogo && (
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-lg">
                    <img src={supplierLogo} alt={`${supplier.supplier_name} logo`} className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">{supplier.supplier_name}</h1>
                    {isVerified && <StatusBadge status="verified" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{supplier.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary/70" />
                      {supplierCity}{supplierArea ? `, ${supplierArea}` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-foreground">{supplier.rating}</span>/5
                      <span className="text-muted-foreground">({supplier.review_count})</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-primary/70" />
                      {supplier.materials.length} materials
                    </span>
                  </div>
                </div>

                {user && user.role !== "admin" && (
                  <div className="shrink-0 pt-2 sm:pt-0">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => {
                        const contactEmail = supplier.contact?.email || "";
                        if (!contactEmail) return;
                        api.messages
                          .startConversation(contactEmail, supplier.supplier_name, `Hi, I'm interested in your materials/products.`)
                          .then(() => navigate(`/messages`));
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Send Message
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== QUICK STATS ROW ===== */}
        <SectionReveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickStat icon={<Layers className="h-5 w-5" />} label="Categories" value={String(categories.length)} accent="primary" />
            <QuickStat icon={<Tag className="h-5 w-5" />} label="Price Range" value={minPrice == null || maxPrice == null ? "Contact" : minPrice === maxPrice ? formatPKR(minPrice) : `${formatPKR(minPrice)} – ${formatPKR(maxPrice)}`} accent="primary" />
            <QuickStat icon={<Truck className="h-5 w-5" />} label="Cities Served" value={String(supplier.cities_served.length)} accent="primary" />
            <QuickStat icon={<BarChart3 className="h-5 w-5" />} label="Total Stock" value={totalStock.toLocaleString()} accent={lowStockCount > 0 ? "warning" : "primary"} subtitle={lowStockCount > 0 ? `${lowStockCount} low stock` : undefined} />
          </div>
        </SectionReveal>

        {/* ===== MAIN CONTENT 2-COLUMN ===== */}
        <SectionReveal>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* LEFT — Materials */}
            <div className="space-y-6">
              {/* Category filter pills */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <SectionHeader icon={<Layers className="h-4 w-4" />} title="Material Categories" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeCategory === null
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    All ({supplier.materials.length})
                  </button>
                  {categories.map((c) => {
                    const count = supplier.materials.filter((m) => m.category === c).length;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setActiveCategory(activeCategory === c ? null : c)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          activeCategory === c
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {c} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Materials grid */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <SectionHeader icon={<Package className="h-4 w-4" />} title="Materials Catalog" subtitle={`${filteredMaterials.length} items`} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {filteredMaterials.map((m, idx) => {
                    const isLowStock = m.stock > 0 && m.stock <= 50;
                    const isOutOfStock = m.stock === 0;
                    const hasImages = m.image_urls && m.image_urls.length > 0;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.3 }}
                      >
                        <button
                          type="button"
                          className={`group w-full text-left rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                            isOutOfStock
                              ? "border-destructive/30 opacity-70"
                              : isLowStock
                                ? "border-amber-400/30"
                                : "border-border hover:border-primary/30"
                          }`}
                          onClick={() => { setSelectedMaterial(m); setGalleryIdx(0); }}
                        >
                          {hasImages ? (
                            <div className="relative h-36 overflow-hidden bg-secondary/20">
                              <img src={m.image_urls![0]} alt={m.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                              {m.image_urls!.length > 1 && (
                                <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                                  +{m.image_urls!.length - 1} photos
                                </span>
                              )}
                              {isOutOfStock && (
                                <Badge variant="destructive" className="absolute top-2 left-2 text-[10px]">Out of Stock</Badge>
                              )}
                              {isLowStock && (
                                <Badge variant="outline" className="absolute top-2 left-2 border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px]">
                                  <AlertTriangle className="mr-1 h-3 w-3" /> Low Stock
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex h-28 items-center justify-center bg-secondary/10">
                              <Package className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}

                          <div className="p-4 space-y-2.5">
                            <div>
                              <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] font-normal">{m.category}</Badge>
                                <span className="text-xs text-muted-foreground">{m.brand}</span>
                              </div>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">per {m.unit}</span>
                              <span className="text-sm font-bold text-foreground">{formatPKR(m.price)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Stock</span>
                              <span className={`text-xs font-semibold ${isOutOfStock ? "text-destructive" : isLowStock ? "text-amber-500" : "text-green-600 dark:text-green-400"}`}>
                                {m.stock.toLocaleString()} {m.unit}
                              </span>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT — Sidebar */}
            <div className="space-y-5">
              {/* Contact */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <SectionHeader icon={<Phone className="h-4 w-4" />} title="Contact Information" />
                  <div className="mt-4 space-y-3">
                    {supplier.contact.phone && (
                      <a href={`tel:${supplier.contact.phone}`} className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-secondary/50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-4 w-4 text-primary" /></div>
                        <span className="text-foreground">{supplier.contact.phone}</span>
                      </a>
                    )}
                    {supplier.contact.email && (
                      <a href={`mailto:${supplier.contact.email}`} className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-secondary/50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-4 w-4 text-primary" /></div>
                        <span className="text-foreground break-all">{supplier.contact.email}</span>
                      </a>
                    )}
                    {supplier.contact.website && (
                      <div className="flex items-center gap-3 rounded-lg p-2 text-sm">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Globe className="h-4 w-4 text-primary" /></div>
                        <span className="text-foreground break-all">{supplier.contact.website}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Cities Served */}
              {supplier.cities_served.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<Truck className="h-4 w-4" />} title="Delivery Areas" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {supplier.cities_served.map((city) => (
                        <Badge key={city} variant="secondary" className="gap-1 rounded-lg">
                          <MapPin className="h-3 w-3" />
                          {city}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Supplier Stats */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Supplier Summary" />
                  <div className="mt-4 space-y-3">
                    <StatRow label="Status" value={isVerified ? <StatusBadge status="verified" /> : <StatusBadge status="pending" />} />
                    <Separator />
                    <StatRow label="Rating" value={
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {supplier.rating}/5
                      </span>
                    } />
                    <StatRow label="Reviews" value={<span className="font-semibold text-foreground">{supplier.review_count}</span>} />
                    <Separator />
                    <StatRow label="Materials" value={<span className="font-semibold text-foreground">{supplier.materials.length}</span>} />
                    <StatRow label="Categories" value={<span className="font-semibold text-foreground">{categories.length}</span>} />
                    {lowStockCount > 0 && (
                      <StatRow label="Low Stock" value={<span className="font-semibold text-amber-500">{lowStockCount}</span>} />
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Verification Documents */}
              {isVerified && (() => {
                const vDocs = supplier.verification_documents ?? {};
                const vStatus = supplier.verification ?? {};
                const docLabels: Record<string, string> = {
                  secp_certificate: "SECP Certificate",
                  ntn_certificate: "NTN Certificate",
                  registration_certificate: "Registration Certificate",
                  business_license: "Business License",
                };
                const docs = Object.entries(vDocs)
                  .filter(([, url]) => !!url)
                  .map(([key, url]) => {
                    const docType = key.replace(/_url$/, "");
                    return { docType, url, status: vStatus[docType]?.status ?? "pending" };
                  });
                if (!docs.length) return null;
                return (
                  <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.35 }}>
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Verification Documents" />
                      <div className="mt-3 space-y-2">
                        {docs.map((doc) => (
                          <div key={doc.docType} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/50 p-3 transition-colors hover:bg-secondary/30">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground">{docLabels[doc.docType] ?? doc.docType}</p>
                              <span className={`text-[10px] font-medium ${doc.status === "approved" ? "text-green-500" : doc.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                                {doc.status === "approved" ? "Verified" : doc.status === "rejected" ? "Rejected" : "Pending"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setPdfViewer({ url: doc.url, title: docLabels[doc.docType] ?? doc.docType })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" title="View">
                                <Eye className="h-4 w-4" />
                              </button>
                              <a href={doc.url} download={`${doc.docType}.pdf`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" title="Download">
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </div>
        </SectionReveal>
      </motion.div>

      {/* ===== PDF Viewer ===== */}
      {pdfViewer && (
        <PdfViewerDialog open onClose={() => setPdfViewer(null)} url={pdfViewer.url} title={pdfViewer.title} />
      )}

      {/* ===== Material Detail Modal ===== */}
      <Dialog open={!!selectedMaterial} onOpenChange={(open) => { if (!open) setSelectedMaterial(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogTitle className="sr-only">{selectedMaterial?.name ?? "Material"}</DialogTitle>
          {selectedMaterial && (
            <div>
              {selectedMaterial.image_urls && selectedMaterial.image_urls.length > 0 && (
                <div className="relative h-72 bg-secondary/20">
                  <img
                    src={selectedMaterial.image_urls[galleryIdx]}
                    alt={selectedMaterial.name}
                    className="h-full w-full object-cover"
                  />
                  {selectedMaterial.image_urls.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                        onClick={() => setGalleryIdx((prev) => (prev - 1 + selectedMaterial.image_urls!.length) % selectedMaterial.image_urls!.length)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                        onClick={() => setGalleryIdx((prev) => (prev + 1) % selectedMaterial.image_urls!.length)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                        {selectedMaterial.image_urls.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`rounded-full transition-all ${i === galleryIdx ? "h-2 w-5 bg-white" : "h-2 w-2 bg-white/50 hover:bg-white/70"}`}
                            onClick={() => setGalleryIdx(i)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="absolute top-3 right-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {galleryIdx + 1} / {selectedMaterial.image_urls.length}
                  </div>
                </div>
              )}
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{selectedMaterial.name}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{selectedMaterial.category}</Badge>
                    <span className="text-sm text-muted-foreground">{selectedMaterial.brand}</span>
                  </div>
                </div>
                {selectedMaterial.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{selectedMaterial.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Price per {selectedMaterial.unit}</p>
                    <p className="mt-1.5 text-lg font-bold text-foreground">{formatPKR(selectedMaterial.price)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Stock Available</p>
                    <p className={`mt-1.5 text-lg font-bold ${selectedMaterial.stock === 0 ? "text-destructive" : selectedMaterial.stock <= 50 ? "text-amber-500" : "text-green-600 dark:text-green-400"}`}>
                      {selectedMaterial.stock.toLocaleString()} {selectedMaterial.unit}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ================================================================== */
/*  Helper Components                                                  */
/* ================================================================== */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <span className="text-xs text-muted-foreground">· {subtitle}</span>}
      </div>
    </div>
  );
}

function QuickStat({ icon, label, value, accent, subtitle }: { icon: React.ReactNode; label: string; value: string; accent: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent === "warning" ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-[10px] text-amber-500">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
