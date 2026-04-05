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
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { ArrowLeft, Building2, Briefcase, CheckCircle, CreditCard, FileText, HardHat, MapPin, MessageSquare, Phone, Mail, Globe, Shield, Star, Users } from "lucide-react";

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
  const user = useAuthStore((s) => s.user);

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
          {user && user.role !== "admin" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const contactEmail = company.raw.contact?.email || "";
                if (!contactEmail) return;
                api.messages
                  .startConversation(contactEmail, company.name, `Hi, I'm interested in your construction services.`)
                  .then((res) => navigate(`/messages`));
              }}
            >
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Message
            </Button>
          )}
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
                {company.raw.description || `${company.name} is a construction company based in ${company.location}. Pricing is shown per sq ft and varies by city/area and package.`}
              </p>
            </div>

            {/* Legal & Registration Info */}
            {company.raw.legal_info && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">LEGAL & REGISTRATION</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Registered: <span className="font-semibold">{company.raw.legal_info.registered ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    SECP: <span className="font-semibold">{company.raw.legal_info.secp_registered ? "Yes" : "No"}</span>
                  </div>
                  {company.raw.legal_info.ntn && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      NTN: <span className="font-semibold">{company.raw.legal_info.ntn}</span>
                    </div>
                  )}
                  {company.raw.legal_info.year_established && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Established: <span className="font-semibold">{company.raw.legal_info.year_established}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Experience */}
            {company.raw.experience && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">EXPERIENCE</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {company.raw.experience.total_projects != null && (
                    <div className="rounded-2xl border border-border bg-background/30 p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{company.raw.experience.total_projects}</p>
                      <p className="text-xs text-muted-foreground">Total Projects</p>
                    </div>
                  )}
                  {company.raw.experience.houses_completed != null && (
                    <div className="rounded-2xl border border-border bg-background/30 p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{company.raw.experience.houses_completed}</p>
                      <p className="text-xs text-muted-foreground">Houses Completed</p>
                    </div>
                  )}
                  {company.raw.experience.ongoing_projects != null && (
                    <div className="rounded-2xl border border-border bg-background/30 p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{company.raw.experience.ongoing_projects}</p>
                      <p className="text-xs text-muted-foreground">Ongoing Projects</p>
                    </div>
                  )}
                </div>
                {company.raw.experience.specializations && company.raw.experience.specializations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {company.raw.experience.specializations.map((s) => (
                      <Badge key={s} variant="outline" className="rounded-lg">{humanizeToken(s)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    <MapPin className="mr-1 h-3 w-3" />
                    {city}
                  </Badge>
                ))}
                {(company.cities.length ? company.cities : [company.location]).length > 6 ? (
                  <Badge variant="secondary" className="rounded-lg">
                    +{(company.cities.length ? company.cities : [company.location]).length - 6}
                  </Badge>
                ) : null}
              </div>

              {(company.areas.length > 0 || company.societies.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {company.areas.slice(0, 4).map((area) => (
                    <span key={area} className="rounded-md bg-secondary/70 px-2 py-0.5 text-xs text-foreground">{area}</span>
                  ))}
                  {company.areas.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{company.areas.length - 4} areas</span>
                  )}
                  {company.societies.length > 0 && company.areas.length > 0 && (
                    <span className="text-xs text-muted-foreground px-1">·</span>
                  )}
                  {company.societies.slice(0, 4).map((soc) => (
                    <span key={soc} className="rounded-md border border-border bg-background/30 px-2 py-0.5 text-xs text-muted-foreground">{soc}</span>
                  ))}
                  {company.societies.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{company.societies.length - 4} societies</span>
                  )}
                </div>
              )}
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
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">CONSTRUCTION CAPABILITY</p>
              {company.raw.construction_capability && typeof company.raw.construction_capability === "object" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(company.raw.construction_capability).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{humanizeToken(key)}</span>
                      <span className="font-semibold text-foreground">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">No construction capability data available.</p>}
            </div>

            {/* Services */}
            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">SERVICES</p>
              {company.raw.services && typeof company.raw.services === "object" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(company.raw.services).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`h-3.5 w-3.5 ${value ? "text-green-500" : "text-muted-foreground/30"}`} />
                      <span className={value ? "text-foreground" : "text-muted-foreground"}>{humanizeToken(key)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">No services data available.</p>}
            </div>

            {/* Payment Terms */}
            {company.raw.payment_terms && (
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">PAYMENT TERMS</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {company.raw.payment_terms.advance_percentage != null && (
                    <div className="text-sm"><span className="text-muted-foreground">Advance: </span><span className="font-semibold text-foreground">{company.raw.payment_terms.advance_percentage}%</span></div>
                  )}
                  {company.raw.payment_terms.installments && (
                    <div className="text-sm"><span className="text-muted-foreground">Installments: </span><span className="font-semibold text-foreground">{humanizeToken(company.raw.payment_terms.installments)}</span></div>
                  )}
                  {company.raw.payment_terms.price_type && (
                    <div className="text-sm"><span className="text-muted-foreground">Price type: </span><span className="font-semibold text-foreground">{humanizeToken(company.raw.payment_terms.price_type)}</span></div>
                  )}
                  {company.raw.payment_terms.variation_clause != null && (
                    <div className="text-sm"><span className="text-muted-foreground">Variation clause: </span><span className="font-semibold text-foreground">{company.raw.payment_terms.variation_clause ? "Yes" : "No"}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Quality Control */}
            {company.raw.quality_control && typeof company.raw.quality_control === "object" && (
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">QUALITY CONTROL</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(company.raw.quality_control).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`h-3.5 w-3.5 ${value ? "text-green-500" : "text-muted-foreground/30"}`} />
                      <span className={value ? "text-foreground" : "text-muted-foreground"}>{humanizeToken(key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* After Handover Support */}
            {company.raw.after_handover_support && typeof company.raw.after_handover_support === "object" && (
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">AFTER HANDOVER SUPPORT</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(company.raw.after_handover_support).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{humanizeToken(key)}</span>
                      <span className="font-semibold text-foreground">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="mt-3 space-y-3 text-sm text-foreground">
              {company.raw.contact?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{company.raw.contact.phone}</span>
                </div>
              )}
              {company.raw.contact?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{company.raw.contact.email}</span>
                </div>
              )}
              {company.raw.contact?.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{company.raw.contact.website}</span>
                </div>
              )}
              {!company.raw.contact?.phone && !company.raw.contact?.email && !company.raw.contact?.website && (
                <p className="text-sm text-muted-foreground">No contact information available.</p>
              )}
            </div>
          </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
          <GlassCard interactive={false} className="p-6">
            <p className="text-sm font-semibold text-foreground">AI Confidence Scores</p>
            {company.raw.ai_scores ? (
              <div className="mt-3 space-y-3">
                {company.raw.ai_scores.timeline_reliability != null && (
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Timeline Reliability</span>
                      <span className="font-semibold text-foreground">{company.raw.ai_scores.timeline_reliability}/10</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(company.raw.ai_scores.timeline_reliability / 10) * 100}%` }} />
                    </div>
                  </div>
                )}
                {company.raw.ai_scores.budget_accuracy != null && (
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Budget Accuracy</span>
                      <span className="font-semibold text-foreground">{company.raw.ai_scores.budget_accuracy}/10</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(company.raw.ai_scores.budget_accuracy / 10) * 100}%` }} />
                    </div>
                  </div>
                )}
                {company.raw.ai_scores.quality_consistency != null && (
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quality Consistency</span>
                      <span className="font-semibold text-foreground">{company.raw.ai_scores.quality_consistency}/10</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(company.raw.ai_scores.quality_consistency / 10) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">AI scores not yet calculated.</p>
            )}
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
