import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionReveal } from "@/components/shared/AnimationPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { companyDirectory, getPackageKeys, humanizeToken } from "@/data/companyData";
import { ArrowLeft, Building2, MapPin, Star } from "lucide-react";

function previewList(items: string[], max: number) {
  const cleaned = items.filter((x) => x && x !== "—");
  const shown = cleaned.slice(0, max);
  const more = Math.max(0, cleaned.length - shown.length);
  return {
    text: shown.join(" • "),
    more,
  };
}

function formatSqFt(value: number) {
  return `${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)} PKR/sq ft`;
}

function packagePriceRange(company: (typeof companyDirectory)[number], pkgId: string) {
  const rows = (company.raw.flattened_operational_areas ?? []).filter((x) => x.package === pkgId);
  const prices = rows.map((x) => x.price_per_sqft).filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
}

export default function CompanyProfilePage() {
  const navigate = useNavigate();
  const params = useParams();

  const company = useMemo(() => {
    const id = params.id;
    if (!id) return undefined;
    return companyDirectory.find((c) => c.id === id);
  }, [params.id]);

  if (!company) {
    return (
      <GlassCard interactive={false} className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Company not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">This company ID doesn’t exist in the current dataset.</p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/companies">Back to browse</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

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
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {company.verified ? <StatusBadge status="verified" /> : null}
          </div>

          <h1 className="mt-4 truncate text-2xl font-bold text-foreground">{company.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {company.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-semibold text-foreground">{company.rating}</span>
              <span>({company.reviews} reviews)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Established {company.yearEstablished ?? "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <MatchScoreRing score={company.matchScore} size={64} />
          <Button type="button">Request quote</Button>
        </div>
      </motion.div>

      <SectionReveal>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <GlassCard className="overflow-hidden p-0">
          <div className="group relative h-56 overflow-hidden">
            <img src={company.image} alt={company.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent" />
          </div>
          <div className="space-y-4 p-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">OVERVIEW</p>
              <p className="mt-2 text-sm text-foreground">
                Company details are loaded dynamically from the provided dataset. Pricing is shown per sq ft and varies by city/area and package.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">SPECIALTIES</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {company.specialization.length ? (
                  company.specialization.map((s) => (
                    <Badge key={s} variant="secondary" className="rounded-lg">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">OPERATIONAL AREAS</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(company.cities.length ? company.cities : [company.location]).slice(0, 6).map((city) => (
                  <Badge key={city} variant="secondary" className="rounded-lg">
                    {city}
                  </Badge>
                ))}
                {(company.cities.length ? company.cities : [company.location]).length > 6 ? (
                  <Badge variant="secondary" className="rounded-lg">
                    +{(company.cities.length ? company.cities : [company.location]).length - 6}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-2 grid gap-1 text-sm text-foreground sm:grid-cols-2">
                <p>
                  Areas: <span className="font-semibold">{previewList(company.areas, 3).text || "—"}</span>
                  {previewList(company.areas, 3).more ? (
                    <span className="text-muted-foreground"> (+{previewList(company.areas, 3).more})</span>
                  ) : null}
                </p>
                <p>
                  Societies: <span className="font-semibold">{previewList(company.societies, 3).text || "—"}</span>
                  {previewList(company.societies, 3).more ? (
                    <span className="text-muted-foreground"> (+{previewList(company.societies, 3).more})</span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICING RANGE</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{company.priceRange}</p>
                <p className="mt-1 text-xs text-muted-foreground">Rates may vary by area, package, and specs.</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">COMPLETED PROJECTS</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {company.completedProjects != null ? company.completedProjects.toLocaleString() : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Reported historical deliveries.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">SERVICES</p>
              <p className="mt-2 text-sm text-foreground">Packages and pricing are available below.</p>
            </div>

            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">PACKAGES</p>
              <p className="mt-2 text-sm text-foreground">Compare scope and per-area pricing by package.</p>

              <div className="mt-4">
                <Tabs defaultValue={getPackageKeys(company.raw)[0] ?? "standard"}>
                  <TabsList className="flex flex-wrap">
                    {getPackageKeys(company.raw).map((k) => (
                      <TabsTrigger key={k} value={k}>
                        {humanizeToken(k)}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {getPackageKeys(company.raw).map((pkgId) => {
                    const scope = (company.raw.package_scope ?? {})[pkgId] ?? {};
                    const materials = (company.raw.materials_used ?? {})[pkgId] ?? {};
                    const range = packagePriceRange(company, pkgId);
                    const samples = (company.raw.flattened_operational_areas ?? [])
                      .filter((x) => x.package === pkgId)
                      .slice()
                      .sort((a, b) => (a.price_per_sqft ?? 0) - (b.price_per_sqft ?? 0))
                      .slice(0, 8);

                    return (
                      <TabsContent key={pkgId} value={pkgId} className="mt-4 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border bg-background/30 p-4">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground">PRICE RANGE</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {range
                                ? range.min === range.max
                                  ? formatSqFt(range.min)
                                  : `${formatSqFt(range.min)} - ${formatSqFt(range.max)}`
                                : "—"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Calculated from all listed operational areas.</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-background/30 p-4">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground">SCOPE</p>
                            <div className="mt-2 space-y-1 text-sm text-foreground">
                              <p>
                                Design: <span className="font-semibold">{scope.design_included ? "Included" : "Not included"}</span>
                              </p>
                              <p>
                                Fixtures: <span className="font-semibold">{scope.fixtures ? humanizeToken(scope.fixtures) : "—"}</span>
                              </p>
                              <p>
                                Ceiling: <span className="font-semibold">{scope.ceiling ? humanizeToken(scope.ceiling) : "—"}</span>
                              </p>
                              <p>
                                Kitchen: <span className="font-semibold">{scope.kitchen ? humanizeToken(scope.kitchen) : "—"}</span>
                              </p>
                              <p>
                                Bathroom: <span className="font-semibold">{scope.bathroom ? humanizeToken(scope.bathroom) : "—"}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/30 p-4">
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground">MATERIALS</p>
                          <div className="mt-2 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                            <p>
                              Cement: <span className="font-semibold">{materials.cement ?? "—"}</span>
                            </p>
                            <p>
                              Steel: <span className="font-semibold">{materials.steel ?? "—"}</span>
                            </p>
                            <p>
                              Bricks: <span className="font-semibold">{materials.bricks ?? "—"}</span>
                            </p>
                            <p>
                              Wiring: <span className="font-semibold">{materials.wiring ?? "—"}</span>
                            </p>
                            <p>
                              Plumbing: <span className="font-semibold">{materials.plumbing ?? "—"}</span>
                            </p>
                            <p>
                              Paint: <span className="font-semibold">{materials.paint ?? "—"}</span>
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>City</TableHead>
                                <TableHead>Area</TableHead>
                                <TableHead>Society</TableHead>
                                <TableHead className="w-40 text-right">Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {samples.map((x) => (
                                <TableRow key={`${x.location}:${x.package}`}>
                                  <TableCell className="text-sm text-foreground whitespace-nowrap">{x.city || "—"}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{x.area || "—"}</TableCell>
                                  <TableCell className="text-sm text-foreground whitespace-nowrap">{x.subarea || "—"}</TableCell>
                                  <TableCell className="text-right text-sm font-medium text-foreground">
                                    {formatSqFt(x.price_per_sqft)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {samples.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                                    No pricing rows available for this package.
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Contact</p>
            <div className="mt-3 space-y-1 text-sm text-foreground">
              <p>
                Phone: <span className="font-semibold">{company.raw.contact?.phone ?? "—"}</span>
              </p>
              <p>
                Email: <span className="font-semibold">{company.raw.contact?.email ?? "—"}</span>
              </p>
              <p>
                Website: <span className="font-semibold">{company.raw.contact?.website ?? "—"}</span>
              </p>
            </div>
          </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Availability / Status</p>
            <p className="mt-2 text-sm text-muted-foreground">Availability signals are not included in the dataset.</p>
          </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
          >
          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">Ratings & Reviews</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {company.rating} average rating across {company.reviews} reviews.
            </p>
          </GlassCard>
          </motion.div>
        </div>
      </div>
      </SectionReveal>
    </motion.div>
  );
}
