import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem, SectionReveal, SkeletonCard } from "@/components/shared/AnimationPrimitives";
import { TiltCard } from "@/components/shared/TiltCard";
import { api } from "@/lib/api";
import type { QuoteRequest } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Database,
  FileCheck,
  FileText,
  MapPin,
  Package,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

function ClientDashboard() {
  const user = useAuthStore((s) => s.user);
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [requestStats, setRequestStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });
  const [recentRequests, setRecentRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.companies.list().then((res) => setCompanies(res.items)).catch(() => {}),
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

  const statCards = [
    { label: "Total Requests", value: requestStats.total, icon: FileText,    color: "text-blue-400",    bg: "bg-blue-500/15",    border: "" },
    { label: "Pending Reply",  value: requestStats.pending, icon: Clock,     color: "text-warning",     bg: "bg-warning/15",    border: requestStats.pending > 0 ? "border-warning/30" : "" },
    { label: "Accepted",       value: requestStats.accepted, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "" },
    { label: "Completed",      value: requestStats.completed, icon: FileCheck, color: "text-primary",    bg: "bg-primary/15",    border: "" },
  ];

  const statusStyle = {
    pending:   { color: "text-warning",     bg: "bg-warning/10",     icon: Clock },
    accepted:  { color: "text-success",     bg: "bg-success/10",     icon: CheckCircle2 },
    rejected:  { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
    completed: { color: "text-primary",     bg: "bg-primary/10",     icon: FileCheck },
  } as const;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">

      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 h-40 w-72 rounded-full bg-blue-500/8 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-400 shadow-lg shadow-primary/25">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">
                Welcome back, {firstName} 👋
              </h1>
              <p className="text-sm text-muted-foreground">
                Find your perfect construction partner · Track your requests
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/requests" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> My Requests
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/companies" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Browse Companies
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.07 }}>
            <GlassCard interactive={false} className={`flex items-center gap-4 p-4 ${s.border}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground">{loading ? "…" : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* AI Top Picks — 2/3 */}
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">AI-Matched Companies</p>
                  <p className="text-xs text-muted-foreground">Ranked by match score, rating & verification</p>
                </div>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/companies" className="flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {loading ? (
                <>{[0,1,2,3].map(i => <SkeletonCard key={i} className="rounded-2xl h-28" />)}</>
              ) : topPicks.length === 0 ? (
                <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">No companies found.</p>
              ) : topPicks.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                >
                  <Link to={`/companies/${c.id}`}>
                    <TiltCard tiltMaxAngleX={5} tiltMaxAngleY={5} scale={1.015}>
                      <GlassCard className="p-4 transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {c.logo ? (
                                <img src={c.logo} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-border" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-amber-400/20 text-primary text-sm font-bold">
                                  {c.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                                <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />{c.location}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {c.specialization.slice(0, 2).map((s) => (
                                <Badge key={s} variant="secondary" className="rounded-lg text-[10px] px-2">{s}</Badge>
                              ))}
                            </div>
                          </div>
                          <MatchScoreRing score={c.matchScore} size={44} />
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="font-semibold text-foreground">{c.rating.toFixed(1)}</span>
                            <span>({c.reviews})</span>
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

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">

          {/* Recent Requests */}
          <GlassCard interactive={false} className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Recent Requests</p>
                  <p className="text-xs text-muted-foreground">Latest quote activity</p>
                </div>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/requests" className="flex items-center gap-1">
                  All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">{[0,1,2].map(i => <SkeletonCard key={i} className="rounded-xl h-14" />)}</div>
            ) : recentRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-5 text-center">
                <FileText className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No requests yet — browse companies to get started.</p>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/companies">Browse</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentRequests.map((req, i) => {
                  const style = statusStyle[req.status] ?? statusStyle.pending;
                  const StatusIcon = style.icon;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.22 }}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-background/30 px-3 py-2.5"
                    >
                      <div className={`mt-0.5 rounded-lg p-1 ${style.bg}`}>
                        <StatusIcon className={`h-3 w-3 ${style.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{req.project_title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {req.location || "Location TBD"}{req.budget ? ` · ${req.budget}` : ""}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <Button asChild variant="ghost" className="mt-1 w-full text-xs" size="sm">
                  <Link to="/requests" className="flex items-center justify-center gap-1">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            )}
          </GlassCard>

          {/* Upgrade Card */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Upgrade to Premium</p>
                  <p className="text-[10px] text-muted-foreground">Unlock the full platform</p>
                </div>
              </div>
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Basic</span>
                  <span className="text-xs font-bold text-muted-foreground">Free</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-2 ring-1 ring-primary/20">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">Pro</span>
                    <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary">Popular</span>
                  </div>
                  <span className="text-xs font-bold text-primary">PKR 4,999/mo</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/8 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Premium</span>
                  <span className="text-xs font-bold text-amber-500">PKR 12,999/mo</span>
                </div>
              </div>
              <Button asChild size="sm" className="w-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground hover:opacity-90">
                <Link to="/plans" className="flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> View Plans
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
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
  const acceptedRequests = useMemo(() => requests.filter((r) => r.status === "accepted").length, [requests]);
  const recentRequests = useMemo(() => requests.slice(0, 5), [requests]);
  const firstName = user?.display_name?.split(" ")[0] ?? "Company";
  const verified = profile?.verification_status === "verified";

  const statCards = [
    { label: "Active Packages",  value: activePackages || "—", icon: Package,   color: "text-amber-400",   bg: "bg-amber-500/15" },
    { label: "Covered Cities",   value: coveredCities  || "—", icon: MapPin,    color: "text-cyan-400",    bg: "bg-cyan-500/15"  },
    { label: "Pending Requests", value: pendingRequests,        icon: Clock,     color: "text-warning",     bg: "bg-warning/15",  border: pendingRequests > 0 ? "border-warning/30" : "" },
    { label: "Total Requests",   value: requests.length,        icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  ] as const;

  const reqStatusStyle: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
    pending:   { color: "text-warning",     bg: "bg-warning/10",     icon: Clock },
    accepted:  { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
    rejected:  { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
    completed: { color: "text-primary",     bg: "bg-primary/10",     icon: FileCheck },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">

      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-1/4 h-40 w-64 rounded-full bg-cyan-500/6 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">{firstName}'s Dashboard</h1>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Construction Company</p>
                {!loadingProfile && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${verified ? "bg-emerald-500/15 text-emerald-400" : "bg-warning/15 text-warning"}`}>
                    {verified ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {verified ? "Verified" : "Pending Verification"}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/settings" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Settings
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/pricing" className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Manage Packages
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.07 }}>
            <GlassCard interactive={false} className={`flex items-center gap-4 p-4 ${"border" in s && s.border ? s.border : ""}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground">
                  {s.label === "Active Packages" || s.label === "Covered Cities" ? (loadingProfile ? "…" : s.value) : (loadingReqs ? "…" : s.value)}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Requests Timeline — 2/3 */}
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Client Requests</p>
                  <p className="text-xs text-muted-foreground">Incoming project inquiries</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pendingRequests > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    {pendingRequests} pending
                  </span>
                )}
                <Button asChild variant="link" className="h-auto p-0 text-xs">
                  <Link to="/requests" className="flex items-center gap-1">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {loadingReqs ? (
              <div className="space-y-2">{[0,1,2].map(i => <SkeletonCard key={i} className="rounded-xl h-16" />)}</div>
            ) : recentRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No requests yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Complete your profile and add packages to attract clients.</p>
                </div>
                <Button asChild size="sm" variant="secondary"><Link to="/pricing">Set up packages</Link></Button>
              </div>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-1">
                  {recentRequests.map((req, i) => {
                    const style = reqStatusStyle[req.status] ?? reqStatusStyle.pending;
                    const StatusIcon = style.icon;
                    return (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.22 }}
                        className="relative flex items-start gap-3 py-2"
                      >
                        <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                          <StatusIcon className={`h-3.5 w-3.5 ${style.color}`} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-xl border border-border bg-background/30 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{req.client_name}</p>
                              <p className="truncate text-xs text-muted-foreground">{req.project_title} · {req.location || "—"}</p>
                            </div>
                            <StatusBadge status={req.status} />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <Button asChild variant="ghost" className="mt-2 w-full text-xs" size="sm">
                  <Link to="/requests" className="flex items-center justify-center gap-1">
                    View all requests <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          <GlassCard interactive={false} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">Request Summary</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Pending",  val: pendingRequests,  color: "bg-warning" },
                { label: "Accepted", val: acceptedRequests, color: "bg-emerald-500" },
                { label: "Total",    val: requests.length,  color: "bg-primary" },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2.5">
                  <div className={`h-2 w-2 rounded-full ${r.color}`} />
                  <p className="flex-1 text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-xs font-semibold text-foreground">{loadingReqs ? "…" : r.val}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-1.5">
              <Button asChild size="sm" variant="outline" className="flex-1 text-xs"><Link to="/requests">Requests</Link></Button>
              <Button asChild size="sm" variant="outline" className="flex-1 text-xs"><Link to="/settings">Profile</Link></Button>
            </div>
          </GlassCard>

          {/* Upgrade Card */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/15 blur-2xl" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Upgrade Plan</p>
                  <p className="text-[10px] text-muted-foreground">Grow your business</p>
                </div>
              </div>
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Basic</span>
                  <span className="text-xs font-bold text-muted-foreground">Free</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 ring-1 ring-emerald-500/20">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">Pro</span>
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">Popular</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">PKR 4,999/mo</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/8 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Premium</span>
                  <span className="text-xs font-bold text-cyan-400">PKR 12,999/mo</span>
                </div>
              </div>
              <Button asChild size="sm" className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90">
                <Link to="/plans" className="flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> View Plans
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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
  const firstName = user?.display_name?.split(" ")[0] ?? "Supplier";

  const statCards = [
    { label: "Total Materials", value: materials.length || "—", icon: Package,   color: "text-amber-400",  bg: "bg-amber-500/15" },
    { label: "Categories",      value: categoryCount   || "—", icon: BarChart3,  color: "text-purple-400", bg: "bg-purple-500/15" },
    { label: "Cities Served",   value: citiesCount     || "—", icon: MapPin,     color: "text-cyan-400",   bg: "bg-cyan-500/15" },
    { label: "Low Stock",       value: lowStockCount,           icon: TrendingUp, color: lowStockCount > 0 ? "text-destructive" : "text-emerald-400",
      bg: lowStockCount > 0 ? "bg-destructive/15" : "bg-emerald-500/15",
      border: lowStockCount > 0 ? "border-destructive/25" : "" },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">

      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-1/3 h-40 w-72 rounded-full bg-purple-500/6 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">{firstName}'s Supplier Hub</h1>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Material Supplier</p>
                {lowStockCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    <AlertTriangle className="h-2.5 w-2.5" />{lowStockCount} low stock
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/settings" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Settings
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/products" className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Manage Inventory
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.07 }}>
            <GlassCard interactive={false} className={`flex items-center gap-4 p-4 ${"border" in s && s.border ? s.border : ""}`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground">{loadingSupplier ? "…" : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Inventory Overview — 2/3 */}
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Inventory Overview</p>
                  <p className="text-xs text-muted-foreground">Stock levels and pricing</p>
                </div>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/products" className="flex items-center gap-1">Manage all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>

            {loadingSupplier ? (
              <div className="space-y-2">{[0,1,2,3].map(i => <SkeletonCard key={i} className="rounded-xl h-16" />)}</div>
            ) : materials.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No materials yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add your first product to start receiving orders.</p>
                </div>
                <Button asChild size="sm" variant="secondary"><Link to="/products">Add materials</Link></Button>
              </div>
            ) : (
              <div className="space-y-2">
                {materials.slice(0, 6).map((m, i) => {
                  const stock = m.stock as number;
                  const stockPct = Math.min(100, Math.round((stock / 500) * 100));
                  const isLow = stock <= 50;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.22 }}
                      className="rounded-xl border border-border bg-background/30 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{m.name as string}</p>
                            {isLow && <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">Low</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{m.category as string} · {m.brand as string}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                              <div className={`h-full rounded-full ${isLow ? "bg-destructive" : "bg-emerald-500"}`} style={{ width: `${stockPct}%` }} />
                            </div>
                            <p className={`shrink-0 text-[10px] font-medium ${isLow ? "text-destructive" : "text-muted-foreground"}`}>
                              {stock} {m.unit as string}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-foreground">
                          {new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(m.price as number)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                {materials.length > 6 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">+{materials.length - 6} more items</p>
                )}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          <GlassCard interactive={false} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">Quick Actions</p>
            </div>
            <div className="space-y-1.5">
              {[
                { to: "/products", label: "Inventory & Pricing", icon: Package },
                { to: "/settings", label: "Supplier Settings",   icon: Building2 },
              ].map((item) => (
                <Button key={item.to} asChild variant="ghost" size="sm" className="h-9 w-full justify-start gap-2 text-xs">
                  <Link to={item.to}><item.icon className="h-3.5 w-3.5 text-muted-foreground" />{item.label}</Link>
                </Button>
              ))}
            </div>
          </GlassCard>

          {/* Upgrade Card */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-500/15 blur-2xl" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Upgrade Plan</p>
                  <p className="text-[10px] text-muted-foreground">Expand your reach</p>
                </div>
              </div>
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Basic</span>
                  <span className="text-xs font-bold text-muted-foreground">Free</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 ring-1 ring-amber-500/20">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">Pro</span>
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">Popular</span>
                  </div>
                  <span className="text-xs font-bold text-amber-400">PKR 4,999/mo</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/8 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Premium</span>
                  <span className="text-xs font-bold text-orange-400">PKR 12,999/mo</span>
                </div>
              </div>
              <Button asChild size="sm" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90">
                <Link to="/plans" className="flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> View Plans
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<{ timestamp: string; action: string; target: string; details: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api.admin.getStats().then(setStats).catch(() => {}),
      api.admin.getActivity().then(setActivity).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const recentActivity = activity.slice(0, 6);
  const totalPending = (stats?.pending_approvals ?? 0) + (stats?.pending_doc_verifications ?? 0);
  const firstName = user?.display_name?.split(" ")[0] ?? "Admin";

  const actionLabel = (a: string) =>
    a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const activityIcon = (action: string) => {
    if (action.includes("approve") || action.includes("active")) return { icon: UserCheck, color: "text-green-500", bg: "bg-green-500/10" };
    if (action.includes("reject") || action.includes("ban")) return { icon: UserX, color: "text-destructive", bg: "bg-destructive/10" };
    if (action.includes("login") || action.includes("register")) return { icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" };
    return { icon: Activity, color: "text-primary", bg: "bg-primary/10" };
  };

  /* Skeleton */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-3xl bg-secondary/40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary/40" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-56 animate-pulse rounded-2xl bg-secondary/40" />
            <div className="h-64 animate-pulse rounded-2xl bg-secondary/40" />
          </div>
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-2xl bg-secondary/40" />
            <div className="h-40 animate-pulse rounded-2xl bg-secondary/40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-1/3 h-32 w-64 rounded-full bg-highlight/8 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-highlight shadow-lg shadow-primary/25">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Platform oversight · Approvals · Activity
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {totalPending > 0 && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {totalPending} pending action{totalPending !== 1 ? "s" : ""}
              </motion.div>
            )}
            <Button asChild size="sm">
              <Link to="/users" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Manage Users
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/approvals" className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Approvals
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats grid (single row, 4+4 → 8 compact cards) ─── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* User counts */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlassCard interactive={false} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{stats?.total_users ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassCard interactive={false} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{stats?.clients ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Clients</p>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <GlassCard interactive={false} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{stats?.companies ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Companies</p>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard interactive={false} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{stats?.suppliers ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Suppliers</p>
            </div>
          </GlassCard>
        </motion.div>
        {/* Action-required cards */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GlassCard interactive={false} className={`flex items-center gap-4 p-4 ${(stats?.pending_approvals ?? 0) > 0 ? "border-warning/30 bg-warning/5" : ""}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${(stats?.pending_approvals ?? 0) > 0 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-2xl font-extrabold ${(stats?.pending_approvals ?? 0) > 0 ? "text-warning" : "text-foreground"}`}>
                {stats?.pending_approvals ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Account Approvals</p>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassCard interactive={false} className={`flex items-center gap-4 p-4 ${(stats?.pending_doc_verifications ?? 0) > 0 ? "border-blue-500/20 bg-blue-500/5" : ""}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${(stats?.pending_doc_verifications ?? 0) > 0 ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-2xl font-extrabold ${(stats?.pending_doc_verifications ?? 0) > 0 ? "text-blue-400" : "text-foreground"}`}>
                {stats?.pending_doc_verifications ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Doc Reviews</p>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <GlassCard interactive={false} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <ShieldX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{stats?.banned_users ?? 0}</p>
              <p className="text-xs text-muted-foreground">Banned Users</p>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <GlassCard interactive={false} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{(stats?.dataset_companies ?? 0) + (stats?.dataset_suppliers ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Dataset Records</p>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left col 2/3 */}
        <div className="space-y-4 lg:col-span-2">
          {/* Activity Feed */}
          <GlassCard interactive={false} className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Recent Activity</p>
                  <p className="text-xs text-muted-foreground">Latest platform events</p>
                </div>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/activity" className="flex items-center gap-1">
                  Full log <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {recentActivity.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-5">
                <Activity className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              </div>
            ) : (
              <div className="relative pl-4">
                {/* Timeline line */}
                <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-1">
                  {recentActivity.map((entry, i) => {
                    const { icon: AIcon, color, bg } = activityIcon(entry.action);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.25 }}
                        className="relative flex items-start gap-3 py-2"
                      >
                        <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg}`}>
                          <AIcon className={`h-3.5 w-3.5 ${color}`} />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{actionLabel(entry.action)}</p>
                            <p className="shrink-0 text-[10px] text-muted-foreground/60">
                              {new Date(entry.timestamp).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {entry.target}{entry.details ? ` — ${entry.details}` : ""}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right sidebar 1/3 */}
        <div className="space-y-4">
          {/* Quick actions */}
          <GlassCard interactive={false} className="p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">Quick Actions</p>
            </div>
            <div className="space-y-1.5">
              {[
                { to: "/users", label: "Manage Users", icon: Users, badge: null },
                {
                  to: "/approvals", label: "Approvals", icon: ShieldCheck,
                  badge: totalPending > 0 ? totalPending : null,
                },
                { to: "/analytics", label: "Analytics", icon: BarChart3, badge: null },
                { to: "/activity", label: "Activity Log", icon: Activity, badge: null },
                { to: "/companies", label: "Browse Companies", icon: Building2, badge: null },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-all hover:border-border hover:bg-secondary/40 hover:text-foreground"
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </span>
                  {item.badge !== null ? (
                    <Badge variant="destructive" className="text-[10px]">{item.badge}</Badge>
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 opacity-40" />
                  )}
                </Link>
              ))}
            </div>
          </GlassCard>

          {/* Role distribution */}
          <GlassCard interactive={false} className="p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Role Distribution</p>
                <p className="text-xs text-muted-foreground">of {stats?.total_users ?? 0} users</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Clients", count: stats?.clients ?? 0, color: "bg-cyan-500" },
                { label: "Companies", count: stats?.companies ?? 0, color: "bg-emerald-500" },
                { label: "Suppliers", count: stats?.suppliers ?? 0, color: "bg-amber-500" },
              ].map((item) => {
                const total = stats?.total_users ?? 1;
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={`h-full rounded-full ${item.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Dataset health */}
          <GlassCard interactive={false} className="p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Dataset</p>
                <p className="text-xs text-muted-foreground">AI training data</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Companies", value: stats?.dataset_companies ?? "—", color: "text-emerald-400" },
                { label: "Suppliers", value: stats?.dataset_suppliers ?? "—", color: "text-amber-400" },
              ].map((d) => (
                <div key={d.label} className="rounded-xl border border-border bg-background/20 p-3 text-center">
                  <p className={`text-xl font-extrabold ${d.color}`}>{d.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{d.label}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
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
