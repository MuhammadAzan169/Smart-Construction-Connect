import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { PdfViewerDialog } from "@/components/shared/PdfViewerDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionReveal } from "@/components/shared/AnimationPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCompanyDirectory, getPackageKeys, humanizeToken, type CompanyDirectoryItem, type CompanyProject } from "@/data/companyData";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import {
  ArrowLeft, Building2, Briefcase, CheckCircle, ChevronLeft, ChevronRight,
  CreditCard, Download, Eye, FileText, HardHat, MapPin, MessageSquare,
  Phone, Mail, Globe, Shield, ShieldCheck, Star, Users, Wrench,
  BarChart3, Layers, ClipboardCheck, HeartHandshake, Banknote, Package2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSqFt(value: number) {
  return `${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)} PKR/sq ft`;
}

function packagePriceRange(company: CompanyDirectoryItem, pkgId: string) {
  const rows = (company.raw.flattened_operational_areas ?? []).filter((x) => x.package === pkgId);
  const prices = rows.map((x) => x.price_per_sqft).filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

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

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-bold text-foreground">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function CompanyProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const user = useAuthStore((s) => s.user);
  const [company, setCompany] = useState<CompanyDirectoryItem | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [selectedProject, setSelectedProject] = useState<CompanyProject | null>(null);
  const [projectGalleryIdx, setProjectGalleryIdx] = useState(0);

  useEffect(() => {
    const id = params.id;
    if (!id) { setLoading(false); return; }
    fetchCompanyDirectory()
      .then((dir) => setCompany(dir.find((c) => c.id === id || (c.raw as unknown as { slug?: string }).slug === id)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading company profile…</p>
      </div>
    );
  }

  /* ---------- Not Found ---------- */
  if (!company) {
    return (
      <GlassCard interactive={false} className="p-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-destructive/10">
            <Building2 className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Company not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This company ID doesn't exist in the current dataset.</p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/companies">Back to browse</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  /* ---------- Derived Data ---------- */
  const pkgKeys = getPackageKeys(company.raw);

  return (
    <>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* ===== BACK + ACTIONS BAR ===== */}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <MatchScoreRing score={company.matchScore} size={48} />
            <Button type="button" size="sm">Request quote</Button>
            {user && user.role !== "admin" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const contactEmail = company.raw.contact?.email || "";
                  if (!contactEmail) return;
                  api.messages
                    .startConversation(contactEmail, company.name, `Hi, I'm interested in your construction services.`)
                    .then(() => navigate(`/messages`));
                }}
              >
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            )}
          </div>
        </div>

        {/* ===== HERO BANNER ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="group relative h-52 overflow-hidden sm:h-64">
              <img
                src={(company.raw as Record<string, unknown>).dp_url as string || company.image}
                alt={company.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            </div>

            <div className="relative -mt-16 px-6 pb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                {company.raw.logo_url && (
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-lg">
                    <img src={company.raw.logo_url} alt={`${company.name} logo`} className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">{company.name}</h1>
                    {company.verified && <StatusBadge status="verified" />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary/70" />
                      {company.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-foreground">{company.rating}</span>/5
                      <span>({company.reviews})</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-primary/70" />
                      Est. {company.yearEstablished ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== QUICK STATS ROW ===== */}
        <SectionReveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickStat icon={<Briefcase className="h-5 w-5" />} label="Total Projects" value={company.raw.experience?.total_projects?.toLocaleString() ?? "—"} />
            <QuickStat icon={<HardHat className="h-5 w-5" />} label="Houses Completed" value={company.raw.experience?.houses_completed?.toLocaleString() ?? "—"} />
            <QuickStat icon={<BarChart3 className="h-5 w-5" />} label="Ongoing Projects" value={company.raw.experience?.ongoing_projects?.toLocaleString() ?? "—"} />
            <QuickStat icon={<CreditCard className="h-5 w-5" />} label="Price Range" value={company.priceRange || "—"} />
          </div>
        </SectionReveal>

        {/* ===== MAIN CONTENT 2-COLUMN ===== */}
        <SectionReveal>
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* ===== LEFT COLUMN ===== */}
            <div className="space-y-6">
              {/* Overview */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <SectionHeader icon={<FileText className="h-4 w-4" />} title="Overview" />
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {company.raw.description || `${company.name} is a construction company based in ${company.location}. Pricing is shown per sq ft and varies by city/area and package.`}
                </p>

                {/* Specialties */}
                {company.specialization.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specialties</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {company.specialization.map((s) => (
                        <Badge key={s} variant="secondary" className="rounded-lg">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience specializations */}
                {company.raw.experience?.specializations && company.raw.experience.specializations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Experience Areas</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {company.raw.experience.specializations.map((s) => (
                        <Badge key={s} variant="outline" className="rounded-lg">{humanizeToken(s)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Legal & Registration */}
              {company.raw.legal_info && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <SectionHeader icon={<Shield className="h-4 w-4" />} title="Legal & Registration" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoItem icon={<Shield className="h-4 w-4" />} label="Registered" value={company.raw.legal_info.registered ? "Yes" : "No"} />
                    <InfoItem icon={<FileText className="h-4 w-4" />} label="SECP" value={company.raw.legal_info.secp_registered ? "Yes" : "No"} />
                    {company.raw.legal_info.ntn && <InfoItem icon={<FileText className="h-4 w-4" />} label="NTN" value={company.raw.legal_info.ntn} />}
                    {company.raw.legal_info.year_established && <InfoItem icon={<Building2 className="h-4 w-4" />} label="Established" value={String(company.raw.legal_info.year_established)} />}
                  </div>
                </div>
              )}

              {/* Operational Areas */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <SectionHeader icon={<MapPin className="h-4 w-4" />} title="Operational Areas" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {(company.cities.length ? company.cities : [company.location]).slice(0, 8).map((city) => (
                    <Badge key={city} variant="secondary" className="gap-1 rounded-lg">
                      <MapPin className="h-3 w-3" /> {city}
                    </Badge>
                  ))}
                  {(company.cities.length ? company.cities : [company.location]).length > 8 && (
                    <Badge variant="outline" className="rounded-lg">
                      +{(company.cities.length ? company.cities : [company.location]).length - 8} more
                    </Badge>
                  )}
                </div>
                {(company.areas.length > 0 || company.societies.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {company.areas.slice(0, 6).map((area) => (
                      <span key={area} className="rounded-md bg-secondary/70 px-2 py-0.5 text-xs text-foreground">{area}</span>
                    ))}
                    {company.areas.length > 6 && <span className="text-xs text-muted-foreground">+{company.areas.length - 6} areas</span>}
                    {company.societies.length > 0 && company.areas.length > 0 && <span className="text-xs text-muted-foreground px-1">·</span>}
                    {company.societies.slice(0, 6).map((soc) => (
                      <span key={soc} className="rounded-md border border-border bg-background/30 px-2 py-0.5 text-xs text-muted-foreground">{soc}</span>
                    ))}
                    {company.societies.length > 6 && <span className="text-xs text-muted-foreground">+{company.societies.length - 6} societies</span>}
                  </div>
                )}
              </div>

              {/* Services & Capabilities — combined */}
              <div className="grid gap-6 sm:grid-cols-2">
                {company.raw.construction_capability && typeof company.raw.construction_capability === "object" && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<Wrench className="h-4 w-4" />} title="Capabilities" />
                    <div className="mt-3 space-y-2">
                      {Object.entries(company.raw.construction_capability).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{humanizeToken(key)}</span>
                          <span className="font-medium text-foreground">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {company.raw.services && typeof company.raw.services === "object" && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<Layers className="h-4 w-4" />} title="Services" />
                    <div className="mt-3 space-y-2">
                      {Object.entries(company.raw.services).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${value ? "text-green-500" : "text-muted-foreground/30"}`} />
                          <span className={value ? "text-foreground" : "text-muted-foreground"}>{humanizeToken(key)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment + Quality + After Handover — row */}
              <div className="grid gap-6 sm:grid-cols-3">
                {company.raw.payment_terms && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<Banknote className="h-4 w-4" />} title="Payment" />
                    <div className="mt-3 space-y-2 text-sm">
                      {company.raw.payment_terms.advance_percentage != null && (
                        <div><span className="text-muted-foreground">Advance:</span> <span className="font-medium text-foreground">{company.raw.payment_terms.advance_percentage}%</span></div>
                      )}
                      {company.raw.payment_terms.installments && (
                        <div><span className="text-muted-foreground">Installments:</span> <span className="font-medium text-foreground">{humanizeToken(company.raw.payment_terms.installments)}</span></div>
                      )}
                      {company.raw.payment_terms.price_type && (
                        <div><span className="text-muted-foreground">Pricing:</span> <span className="font-medium text-foreground">{humanizeToken(company.raw.payment_terms.price_type)}</span></div>
                      )}
                      {company.raw.payment_terms.variation_clause != null && (
                        <div><span className="text-muted-foreground">Variation:</span> <span className="font-medium text-foreground">{company.raw.payment_terms.variation_clause ? "Yes" : "No"}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {company.raw.quality_control && typeof company.raw.quality_control === "object" && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<ClipboardCheck className="h-4 w-4" />} title="Quality" />
                    <div className="mt-3 space-y-2">
                      {Object.entries(company.raw.quality_control).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${value ? "text-green-500" : "text-muted-foreground/30"}`} />
                          <span className={`${value ? "text-foreground" : "text-muted-foreground"} text-xs`}>{humanizeToken(key)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {company.raw.after_handover_support && typeof company.raw.after_handover_support === "object" && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<HeartHandshake className="h-4 w-4" />} title="After Handover" />
                    <div className="mt-3 space-y-2">
                      {Object.entries(company.raw.after_handover_support).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs">{humanizeToken(key)}</span>
                          <span className="font-medium text-foreground text-xs">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ===== PACKAGES ===== */}
              {pkgKeys.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <SectionHeader icon={<Package2 className="h-4 w-4" />} title="Packages" subtitle="Scope & pricing by package" />

                  <div className="mt-4">
                    <Tabs defaultValue={pkgKeys[0]}>
                      <TabsList className="flex flex-wrap">
                        {pkgKeys.map((k) => (
                          <TabsTrigger key={k} value={k}>{humanizeToken(k)}</TabsTrigger>
                        ))}
                      </TabsList>

                      {pkgKeys.map((pkgId) => {
                        const scope = (company.raw.package_scope ?? {})[pkgId] ?? {};
                        const materials = (company.raw.materials_used ?? {})[pkgId] ?? {};
                        const range = packagePriceRange(company, pkgId);
                        const samples = (company.raw.flattened_operational_areas ?? [])
                          .filter((x) => x.package === pkgId)
                          .sort((a, b) => (a.price_per_sqft ?? 0) - (b.price_per_sqft ?? 0))
                          .slice(0, 8);

                        return (
                          <TabsContent key={pkgId} value={pkgId} className="mt-4 space-y-4">
                            {/* Price & Scope cards */}
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="rounded-xl border border-border bg-secondary/10 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price Range</p>
                                <p className="mt-2 text-base font-bold text-foreground">
                                  {range
                                    ? range.min === range.max ? formatSqFt(range.min) : `${formatSqFt(range.min)} – ${formatSqFt(range.max)}`
                                    : "—"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">Based on listed operational areas.</p>
                              </div>
                              <div className="rounded-xl border border-border bg-secondary/10 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope</p>
                                <div className="mt-2 space-y-1 text-sm text-foreground">
                                  <p>Design: <span className="font-medium">{scope.design_included ? "Included" : "Not included"}</span></p>
                                  <p>Fixtures: <span className="font-medium">{scope.fixtures ? humanizeToken(scope.fixtures) : "—"}</span></p>
                                  <p>Ceiling: <span className="font-medium">{scope.ceiling ? humanizeToken(scope.ceiling) : "—"}</span></p>
                                  <p>Kitchen: <span className="font-medium">{scope.kitchen ? humanizeToken(scope.kitchen) : "—"}</span></p>
                                  <p>Bathroom: <span className="font-medium">{scope.bathroom ? humanizeToken(scope.bathroom) : "—"}</span></p>
                                </div>
                              </div>
                            </div>

                            {/* Materials */}
                            <div className="rounded-xl border border-border bg-secondary/10 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Materials Used</p>
                              <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-foreground sm:grid-cols-2">
                                <p>Cement: <span className="font-medium">{materials.cement ?? "—"}</span></p>
                                <p>Steel: <span className="font-medium">{materials.steel ?? "—"}</span></p>
                                <p>Bricks: <span className="font-medium">{materials.bricks ?? "—"}</span></p>
                                <p>Wiring: <span className="font-medium">{materials.wiring ?? "—"}</span></p>
                                <p>Plumbing: <span className="font-medium">{materials.plumbing ?? "—"}</span></p>
                                <p>Paint: <span className="font-medium">{materials.paint ?? "—"}</span></p>
                              </div>
                            </div>

                            {/* Pricing table */}
                            <div className="overflow-x-auto rounded-xl border border-border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>City</TableHead>
                                    <TableHead>Area</TableHead>
                                    <TableHead>Society</TableHead>
                                    <TableHead className="w-40 text-end">Price</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {samples.map((x) => (
                                    <TableRow key={`${x.location}:${x.package}`}>
                                      <TableCell className="text-sm whitespace-nowrap">{x.city || "—"}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{x.area || "—"}</TableCell>
                                      <TableCell className="text-sm whitespace-nowrap">{x.subarea || "—"}</TableCell>
                                      <TableCell className="text-end text-sm font-medium">{formatSqFt(x.price_per_sqft)}</TableCell>
                                    </TableRow>
                                  ))}
                                  {samples.length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-sm text-muted-foreground">No pricing rows available.</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </div>
                </div>
              )}

            </div>

            {/* ===== RIGHT SIDEBAR ===== */}
            <div className="space-y-5">
              {/* Contact */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <SectionHeader icon={<Phone className="h-4 w-4" />} title="Contact" />
                  <div className="mt-4 space-y-3">
                    {company.raw.contact?.phone && (
                      <a href={`tel:${company.raw.contact.phone}`} className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-secondary/50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Phone className="h-4 w-4 text-primary" /></div>
                        <span className="text-foreground">{company.raw.contact.phone}</span>
                      </a>
                    )}
                    {company.raw.contact?.email && (
                      <a href={`mailto:${company.raw.contact.email}`} className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-secondary/50">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Mail className="h-4 w-4 text-primary" /></div>
                        <span className="text-foreground break-all">{company.raw.contact.email}</span>
                      </a>
                    )}
                    {company.raw.contact?.website && (
                      <div className="flex items-center gap-3 rounded-lg p-2 text-sm">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Globe className="h-4 w-4 text-primary" /></div>
                        <span className="text-foreground break-all">{company.raw.contact.website}</span>
                      </div>
                    )}
                    {!company.raw.contact?.phone && !company.raw.contact?.email && !company.raw.contact?.website && (
                      <p className="text-sm text-muted-foreground">No contact information available.</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* AI Confidence */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="AI Confidence" />
                  {company.raw.ai_scores ? (
                    <div className="mt-4 space-y-4">
                      {company.raw.ai_scores.timeline_reliability != null && (
                        <ScoreBar label="Timeline Reliability" score={company.raw.ai_scores.timeline_reliability} />
                      )}
                      {company.raw.ai_scores.budget_accuracy != null && (
                        <ScoreBar label="Budget Accuracy" score={company.raw.ai_scores.budget_accuracy} />
                      )}
                      {company.raw.ai_scores.quality_consistency != null && (
                        <ScoreBar label="Quality Consistency" score={company.raw.ai_scores.quality_consistency} />
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">AI scores not yet calculated.</p>
                  )}
                </div>
              </motion.div>

              {/* Ratings */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <SectionHeader icon={<Star className="h-4 w-4" />} title="Ratings & Reviews" />
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30">
                      <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{company.rating}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.round(company.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{company.reviews} reviews</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Verification Documents */}
              {company.verified && (() => {
                const raw = company.raw as Record<string, unknown>;
                const vDocs = (raw.verification_documents ?? {}) as Record<string, string>;
                const vStatus = (raw.verification ?? {}) as Record<string, { status: string }>;
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

              {/* ===== PROJECT PORTFOLIO ===== */}
              {company.raw.projects && company.raw.projects.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.35 }}>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <SectionHeader icon={<HardHat className="h-4 w-4" />} title="Project Portfolio" subtitle={`${company.raw.projects.length} projects`} />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {company.raw.projects.map((proj, idx) => (
                        <motion.div
                          key={proj.id || idx}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.04, 0.25), duration: 0.3 }}
                        >
                          <button
                            type="button"
                            className="group w-full text-start rounded-xl border border-border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30"
                            onClick={() => { setSelectedProject(proj); setProjectGalleryIdx(0); }}
                          >
                            {proj.image_urls?.[0] ? (
                              <div className="relative h-28 overflow-hidden">
                                <img src={proj.image_urls[0]} alt={proj.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                {proj.image_urls.length > 1 && (
                                  <span className="absolute bottom-1.5 end-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                                    +{proj.image_urls.length - 1}
                                  </span>
                                )}
                                <Badge variant={proj.status === "completed" ? "secondary" : "default"} className="absolute top-1.5 start-1.5 text-[10px]">
                                  {proj.status || "completed"}
                                </Badge>
                              </div>
                            ) : (
                              <div className="flex h-20 items-center justify-center bg-secondary/10">
                                <HardHat className="h-7 w-7 text-muted-foreground/30" />
                              </div>
                            )}
                            <div className="p-2.5">
                              <p className="truncate text-xs font-semibold text-foreground">{proj.title}</p>
                              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="truncate">{proj.city}</span>
                                <span>·</span>
                                <span>{proj.year}</span>
                              </div>
                              {proj.plot_size && (
                                <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{proj.type} · {proj.plot_size}</p>
                              )}
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </SectionReveal>
      </motion.div>

      {/* ===== PDF Viewer ===== */}
      {pdfViewer && (
        <PdfViewerDialog open onClose={() => setPdfViewer(null)} url={pdfViewer.url} title={pdfViewer.title} />
      )}

      {/* ===== Project Detail Modal ===== */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => { if (!open) setSelectedProject(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogTitle className="sr-only">{selectedProject?.title ?? "Project"}</DialogTitle>
          {selectedProject && (
            <div>
              {selectedProject.image_urls && selectedProject.image_urls.length > 0 && (
                <div className="relative h-72 bg-secondary/20">
                  <img
                    src={selectedProject.image_urls[projectGalleryIdx]}
                    alt={selectedProject.title}
                    className="h-full w-full object-cover"
                  />
                  {selectedProject.image_urls.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                        onClick={() => setProjectGalleryIdx((prev) => (prev - 1 + selectedProject.image_urls.length) % selectedProject.image_urls.length)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                        onClick={() => setProjectGalleryIdx((prev) => (prev + 1) % selectedProject.image_urls.length)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-3 start-1/2 -translate-x-1/2 flex items-center gap-2">
                        {selectedProject.image_urls.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`rounded-full transition-all ${i === projectGalleryIdx ? "h-2 w-5 bg-white" : "h-2 w-2 bg-white/50 hover:bg-white/70"}`}
                            onClick={() => setProjectGalleryIdx(i)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="absolute top-3 end-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {projectGalleryIdx + 1} / {selectedProject.image_urls.length}
                  </div>
                </div>
              )}
              <div className="p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">{selectedProject.title}</h3>
                    <Badge variant={selectedProject.status === "completed" ? "secondary" : "default"} className="text-[10px]">
                      {selectedProject.status || "completed"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedProject.city} · {selectedProject.year}
                  </p>
                </div>
                {selectedProject.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{selectedProject.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {selectedProject.type && (
                    <div className="rounded-xl border border-border bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedProject.type}</p>
                    </div>
                  )}
                  {selectedProject.plot_size && (
                    <div className="rounded-xl border border-border bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">Plot Size</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedProject.plot_size}</p>
                    </div>
                  )}
                  {selectedProject.budget_range && (
                    <div className="rounded-xl border border-border bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedProject.budget_range}</p>
                    </div>
                  )}
                  {selectedProject.duration_months && (
                    <div className="rounded-xl border border-border bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedProject.duration_months} months</p>
                    </div>
                  )}
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
/*  Small sub-components                                               */
/* ================================================================== */

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/20 p-3 text-sm">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{score}/10</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-secondary">
        <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
