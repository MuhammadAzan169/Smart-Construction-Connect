import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem, SectionReveal } from "@/components/shared/AnimationPrimitives";
import { TiltCard } from "@/components/shared/TiltCard";
import { api } from "@/lib/api";
import type { QuoteRequest } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Package,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

function ClientDashboard() {
  const user = useAuthStore((s) => s.user);
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [requestStats, setRequestStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });
  const [recentRequests, setRecentRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.companies.list().then(setCompanies).catch(() => {}),
      api.requests.stats().then((s) => setRequestStats(s as typeof requestStats)).catch(() => {}),
      api.requests.list().then((r) => setRecentRequests(r.slice(0, 5))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const topPicks = useMemo(() => {
    return companies
      .filter((c) => c.company_name && c.company_id)
      .map((c) => {
        const scores = c.ai_scores as { timeline_reliability?: number; budget_accuracy?: number; quality_consistency?: number } | undefined;
        const parts = [scores?.timeline_reliability, scores?.budget_accuracy, scores?.quality_consistency]
          .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
        const matchScore = parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 80;
        const legal = c.legal_info as { registered?: boolean; secp_registered?: boolean } | undefined;
        const verified = c.verification_status === "verified" || (Boolean(legal?.registered) && Boolean(legal?.secp_registered));
        const exp = c.experience as { specializations?: string[] } | undefined;
        const feedback = c.customer_feedback as { average_rating?: number; review_count?: number } | undefined;
        const areas = (c.flattened_operational_areas as { city?: string }[] | undefined) ?? [];
        const city = areas[0]?.city ?? (c.city as string) ?? "—";
        return {
          id: c.company_id as string,
          name: c.company_name as string,
          location: city,
          rating: feedback?.average_rating ?? (c.rating as number) ?? 0,
          reviews: feedback?.review_count ?? (c.review_count as number) ?? 0,
          specialization: (exp?.specializations ?? []).slice(0, 3),
          matchScore,
          verified,
          logo: c.logo_url as string | null,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);
  }, [companies]);

  const firstName = user?.display_name?.split(" ")[0] ?? "there";

  const statusStyle = {
    pending:   { color: "text-warning",     bg: "bg-warning/10",     icon: Clock },
    accepted:  { color: "text-success",     bg: "bg-success/10",     icon: CheckCircle2 },
    rejected:  { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
    completed: { color: "text-primary",     bg: "bg-primary/10",     icon: FileCheck },
  } as const;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's a summary of your project requests and top construction matches.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/requests">My Requests</Link>
          </Button>
          <Button asChild>
            <Link to="/companies" className="flex items-center gap-1.5">
              Browse Companies <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Request Stats ───────────────────────────────────── */}
      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
        <StaggerItem>
          <StatCard
            title="Total Requests"
            value={loading ? "…" : requestStats.total}
            icon={FileText}
            change={requestStats.total === 0 ? "Send your first request" : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Pending Reply"
            value={loading ? "…" : requestStats.pending}
            icon={Clock}
            trend={requestStats.pending > 0 ? "up" : undefined}
            change={requestStats.pending > 0 ? "Awaiting company response" : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Accepted"
            value={loading ? "…" : requestStats.accepted}
            icon={CheckCircle2}
            trend={requestStats.accepted > 0 ? "up" : undefined}
            change={requestStats.accepted > 0 ? "Company confirmed" : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Completed"
            value={loading ? "…" : requestStats.completed}
            icon={FileCheck}
            trend={requestStats.completed > 0 ? "up" : undefined}
            change={requestStats.completed > 0 ? "Projects finished" : undefined}
          />
        </StaggerItem>
      </StaggerList>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Top company picks — 2/3 width */}
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Top matches for you</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ranked by AI match score, rating, and verification status.
                </p>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/companies" className="flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {loading ? (
                <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">Loading companies…</p>
              ) : topPicks.length === 0 ? (
                <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">No companies found.</p>
              ) : topPicks.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                >
                  <Link to={`/companies/${c.id}`}>
                    <TiltCard tiltMaxAngleX={5} tiltMaxAngleY={5} scale={1.01}>
                      <GlassCard className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {c.logo ? (
                                <img src={c.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                  {c.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.location}</p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {c.specialization.slice(0, 2).map((s) => (
                                <Badge key={s} variant="secondary" className="rounded-lg text-[10px]">{s}</Badge>
                              ))}
                            </div>
                          </div>
                          <MatchScoreRing score={c.matchScore} size={44} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="font-semibold text-foreground">{c.rating.toFixed(1)}</span>
                            <span>({c.reviews} reviews)</span>
                          </div>
                          <StatusBadge status={c.verified ? "verified" : "pending"} />
                        </div>
                      </GlassCard>
                    </TiltCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Recent Requests sidebar — 1/3 width */}
        <GlassCard interactive={false} className="p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">My Recent Requests</p>
              <p className="mt-1 text-xs text-muted-foreground">Your latest quote requests and status.</p>
            </div>
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link to="/requests" className="flex items-center gap-1">
                All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-4 flex-1">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : recentRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No requests yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Find a company and send your first quote request to get started.
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary" className="mt-1">
                  <Link to="/companies">Browse companies</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((req, i) => {
                  const style = statusStyle[req.status] ?? statusStyle.pending;
                  const StatusIcon = style.icon;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.25 }}
                      className="rounded-xl border border-border bg-background/30 px-3 py-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 rounded-md p-1 ${style.bg}`}>
                          <StatusIcon className={`h-3.5 w-3.5 ${style.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{req.project_title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {req.location || "Location TBD"}{req.budget ? ` · ${req.budget}` : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                            {new Date(req.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <Button asChild variant="outline" className="mt-2 w-full" size="sm">
                  <Link to="/requests" className="flex items-center justify-center gap-1.5">
                    View all requests <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function CompanyDashboard() {
  const user = useAuthStore((s) => s.user);
  const companySlug = user?.companyFile ?? user?.company_slug ?? "";
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingReqs, setLoadingReqs] = useState(true);

  useEffect(() => {
    if (companySlug) {
      api.companies.getProfile(companySlug)
        .then((d) => setProfile(d))
        .catch(() => {})
        .finally(() => setLoadingProfile(false));
    } else {
      setLoadingProfile(false);
    }
    api.requests.list()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoadingReqs(false));
  }, [companySlug]);

  const activePackages = useMemo(() => {
    const scope = profile?.package_scope as Record<string, unknown> | undefined;
    return scope ? Object.keys(scope).length : 0;
  }, [profile]);

  const coveredCities = useMemo(() => {
    const areas = (profile?.flattened_operational_areas as { city?: string }[] | undefined) ?? [];
    return new Set(areas.map((r) => r.city).filter(Boolean)).size;
  }, [profile]);

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);
  const recentRequests = useMemo(() => requests.slice(0, 4), [requests]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your packages, service areas, and incoming requests.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link to="/settings">Settings</Link>
          </Button>
          <Button asChild>
            <Link to="/pricing">Manage packages</Link>
          </Button>
        </div>
      </div>

      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
        <StaggerItem>
          <StatCard title="Active Packages" value={loadingProfile ? "…" : (activePackages || "—")} icon={Package} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Covered Cities" value={loadingProfile ? "…" : (coveredCities || "—")} icon={Building2} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Pending Requests" value={loadingReqs ? "…" : pendingRequests} icon={FileText} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Total Requests" value={loadingReqs ? "…" : requests.length} icon={Activity} trend="up" change="All time" />
        </StaggerItem>
      </StaggerList>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Recent Requests</p>
                <p className="mt-1 text-xs text-muted-foreground">Latest client requests received.</p>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/requests" className="flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {loadingReqs ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading requests…</p>
              ) : recentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                recentRequests.map((req, i) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.25 }}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background/30 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{req.client_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{req.project_title} · {req.location || "—"}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </motion.div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <Package className="h-7 w-7 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Packages & Pricing</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Configure service tiers and costs.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/pricing" className="flex items-center justify-between">
                Manage packages <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-7 w-7 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Company Settings</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Profile, logo, contact & social.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/settings" className="flex items-center justify-between">
                Open settings <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function SupplierDashboard() {
  const user = useAuthStore((s) => s.user);
  const supplierSlug = user?.supplierFile;
  const [supplier, setSupplier] = useState<Record<string, unknown> | null>(null);
  const [loadingSupplier, setLoadingSupplier] = useState(!!supplierSlug);

  useEffect(() => {
    if (!supplierSlug) { setLoadingSupplier(false); return; }
    let cancelled = false;
    api.suppliers.getProfile(supplierSlug)
      .then((data) => { if (!cancelled) setSupplier(data as Record<string, unknown>); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSupplier(false); });
    return () => { cancelled = true; };
  }, [supplierSlug]);

  const materials = useMemo(() => (supplier?.materials as Record<string, unknown>[] | undefined) ?? [], [supplier]);
  const categoryCount = useMemo(() => new Set(materials.map((m) => m.category as string)).size, [materials]);
  const citiesCount = useMemo(() => ((supplier?.cities_served as string[] | undefined) ?? []).length, [supplier]);
  const lowStockCount = useMemo(() => materials.filter((m) => typeof m.stock === "number" && (m.stock as number) <= 50).length, [materials]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your inventory, pricing, and supplier profile.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link to="/settings">Settings</Link>
          </Button>
          <Button asChild>
            <Link to="/products">Manage inventory</Link>
          </Button>
        </div>
      </div>

      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
        <StaggerItem>
          <StatCard title="Total Materials" value={loadingSupplier ? "…" : (materials.length || "—")} icon={Package} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Categories" value={loadingSupplier ? "…" : (categoryCount || "—")} icon={Building2} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Cities Served" value={loadingSupplier ? "…" : (citiesCount || "—")} icon={TrendingUp} />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Low Stock Items"
            value={loadingSupplier ? "…" : lowStockCount}
            icon={Activity}
            trend={lowStockCount > 0 ? "down" : undefined}
            change={lowStockCount > 0 ? "Needs restock" : "All good"}
          />
        </StaggerItem>
      </StaggerList>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Inventory Overview</p>
                <p className="mt-1 text-xs text-muted-foreground">Your current material listings and stock levels.</p>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/products" className="flex items-center gap-1">
                  Manage all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {loadingSupplier ? (
              <div className="mt-4 flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading inventory…</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No materials yet. Add your first product.</p>
                <Button asChild variant="secondary" className="mt-3">
                  <Link to="/products">Add materials</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {materials.slice(0, 5).map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.25 }}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background/30 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{m.name as string}</p>
                      <p className="text-xs text-muted-foreground">{m.category as string} · {m.brand as string}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(m.price as number)}
                      </p>
                      <p className={`text-xs ${(m.stock as number) <= 50 ? "text-destructive" : "text-muted-foreground"}`}>
                        {m.stock as number} {m.unit as string} in stock
                      </p>
                    </div>
                  </motion.div>
                ))}
                {materials.length > 5 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">+{materials.length - 5} more items</p>
                )}
              </div>
            )}
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <Package className="h-7 w-7 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Inventory &amp; Pricing</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Update stock and material prices.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/products" className="flex items-center justify-between">
                Open inventory <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-7 w-7 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Supplier Settings</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Profile, contact, cities &amp; legal.</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/settings" className="flex items-center justify-between">
                Open settings <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<{ timestamp: string; action: string; target: string; details: string }[]>([]);
  const [pendingUsers, setPendingUsers] = useState<{ user_id: string; display_name: string; email: string; role: string; status: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api.admin.getStats().then(setStats).catch(() => {}),
      api.admin.getActivity().then(setActivity).catch(() => {}),
      api.admin.getUsers().then((users) => setPendingUsers(users.filter((u) => u.status?.toLowerCase() === "pending").slice(0, 5) as typeof pendingUsers)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      await api.admin.updateUserStatus(userId, "active");
      setPendingUsers((prev) => prev.filter((u) => u.user_id !== userId));
      if (stats) setStats({ ...stats, pending_approvals: Math.max(0, (stats.pending_approvals ?? 1) - 1) });
    } catch {}
  };

  const handleReject = async (userId: string) => {
    try {
      await api.admin.updateUserStatus(userId, "banned");
      setPendingUsers((prev) => prev.filter((u) => u.user_id !== userId));
      if (stats) setStats({ ...stats, pending_approvals: Math.max(0, (stats.pending_approvals ?? 1) - 1), banned_users: (stats.banned_users ?? 0) + 1 });
    } catch {}
  };

  const recentActivity = activity.slice(0, 6);

  const actionLabel = (a: string) => a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Oversight, approvals, and platform activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/users">Manage Users</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/approvals">Approvals</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/activity">Activity Log</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Stat cards */}
          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            <StaggerItem><StatCard title="Total Users" value={stats?.total_users ?? "—"} icon={Users} /></StaggerItem>
            <StaggerItem><StatCard title="Clients" value={stats?.clients ?? "—"} icon={Users} /></StaggerItem>
            <StaggerItem><StatCard title="Companies" value={stats?.companies ?? "—"} icon={Building2} /></StaggerItem>
            <StaggerItem><StatCard title="Suppliers" value={stats?.suppliers ?? "—"} icon={Package} /></StaggerItem>
          </StaggerList>

          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08} delay={0.2}>
            <StaggerItem>
              <StatCard
                title="Pending Account Approvals"
                value={stats?.pending_approvals ?? 0}
                icon={ShieldCheck}
                trend={(stats?.pending_approvals ?? 0) > 0 ? "up" : undefined}
                change={(stats?.pending_approvals ?? 0) > 0 ? "Needs review" : "All clear"}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Pending Doc Reviews"
                value={stats?.pending_doc_verifications ?? 0}
                icon={FileCheck}
                trend={(stats?.pending_doc_verifications ?? 0) > 0 ? "up" : undefined}
                change={(stats?.pending_doc_verifications ?? 0) > 0 ? "Docs awaiting review" : "All clear"}
              />
            </StaggerItem>
            <StaggerItem><StatCard title="Banned Users" value={stats?.banned_users ?? 0} icon={Activity} /></StaggerItem>
            <StaggerItem><StatCard title="Dataset Companies" value={stats?.dataset_companies ?? "—"} icon={Building2} /></StaggerItem>
          </StaggerList>

          {/* Main content grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left: Pending Approvals */}
            <div className="lg:col-span-2 space-y-4">
              <GlassCard interactive={false} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Pending Approvals</p>
                    <p className="mt-1 text-xs text-muted-foreground">Review and approve new accounts.</p>
                  </div>
                  <Button asChild variant="link" className="h-auto p-0 text-xs">
                    <Link to="/approvals" className="flex items-center gap-1">
                      View all <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  {pendingUsers.length === 0 ? (
                    (stats?.pending_approvals ?? 0) > 0 ? (
                      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-center">
                        <ShieldCheck className="mx-auto h-8 w-8 text-warning" />
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {stats.pending_approvals} accounts awaiting approval
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          These users are waiting for access. Review them on the Approvals page.
                        </p>
                        <Button asChild size="sm" className="mt-3">
                          <Link to="/approvals">Go to Approvals</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                        <ShieldCheck className="mx-auto h-8 w-8 text-success" />
                        <p className="mt-2 text-sm text-muted-foreground">No pending approvals. All clear!</p>
                      </div>
                    )
                  ) : (
                    pendingUsers.map((u, i) => (
                      <motion.div
                        key={u.user_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.25 }}
                        className="flex items-center justify-between rounded-2xl border border-border bg-background/30 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{u.display_name}</p>
                            <Badge variant="secondary" className="text-[10px] capitalize">{u.role}</Badge>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex gap-2 ml-3">
                          <Button size="sm" onClick={() => handleApprove(u.user_id)}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(u.user_id)}>Reject</Button>
                        </div>
                      </motion.div>
                    )).concat(
                      (stats?.pending_approvals ?? 0) > pendingUsers.length ? [
                        <div key="more" className="pt-1 text-center text-xs text-muted-foreground">
                          Showing {pendingUsers.length} of {stats.pending_approvals} — <Link to="/approvals" className="text-primary underline-offset-2 hover:underline">View all</Link>
                        </div>
                      ] : []
                    )
                  )}
                </div>
              </GlassCard>

              {/* Recent Activity */}
              <GlassCard interactive={false} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Recent Activity</p>
                    <p className="mt-1 text-xs text-muted-foreground">Latest platform events and user actions.</p>
                  </div>
                  <Button asChild variant="link" className="h-auto p-0 text-xs">
                    <Link to="/activity" className="flex items-center gap-1">
                      View all <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
                  ) : (
                    recentActivity.map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.25 }}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-background/30 px-4 py-3"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{actionLabel(entry.action)}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.target} — {entry.details}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Right sidebar: Quick actions */}
            <div className="space-y-4">
              <GlassCard className="p-5">
                <p className="text-sm font-semibold text-foreground mb-4">Quick Actions</p>
                <div className="space-y-2">
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to="/users">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Manage Users</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to="/approvals">
                      <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Approvals</span>
                      <Badge
                        variant={((stats?.pending_approvals ?? 0) + (stats?.pending_doc_verifications ?? 0)) > 0 ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {(stats?.pending_approvals ?? 0) + (stats?.pending_doc_verifications ?? 0)}
                      </Badge>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to="/companies">
                      <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Browse Companies</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to="/activity">
                      <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Activity Log</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <p className="text-sm font-semibold text-foreground mb-1">Platform Overview</p>
                <p className="text-xs text-muted-foreground mb-4">Role distribution at a glance.</p>
                <div className="space-y-3">
                  {[
                    { label: "Clients", count: stats?.clients ?? 0, total: stats?.total_users ?? 1, color: "bg-blue-500" },
                    { label: "Companies", count: stats?.companies ?? 0, total: stats?.total_users ?? 1, color: "bg-emerald-500" },
                    { label: "Suppliers", count: stats?.suppliers ?? 0, total: stats?.total_users ?? 1, color: "bg-amber-500" },
                  ].map((item) => {
                    const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-foreground font-medium">{item.label}</span>
                          <span className="text-muted-foreground">{item.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${item.color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <p className="text-sm font-semibold text-foreground mb-1">Dataset Health</p>
                <p className="text-xs text-muted-foreground mb-3">AI training data counts.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{stats?.dataset_companies ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Companies</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/30 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{stats?.dataset_suppliers ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Suppliers</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  switch (user.role) {
    case "company":
      return <CompanyDashboard />;
    case "supplier":
      return <SupplierDashboard />;
    case "admin":
      return <AdminDashboard />;
    case "client":
    default:
      return <ClientDashboard />;
  }
}
