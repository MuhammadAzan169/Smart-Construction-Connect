import { useEffect, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import {
  ArrowLeft, BarChart3, Building2, Users, Package, TrendingUp,
  Activity, RefreshCw, Database, MapPin, Star, AlertTriangle,
  CheckCircle2, Clock, Bot, Loader2, ShieldCheck, ShieldAlert,
  UserCheck, UserX, MessageSquare, Zap, ArrowRight, Trophy,
} from "lucide-react";

// â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Analytics = {
  users: { total: number; by_role: Record<string, number>; active: number; pending: number; banned: number; recent_signups: number };
  companies: { total: number; verified: number; pending: number; avg_rating: number; top_cities: { name: string; count: number }[]; total_reviews: number };
  suppliers: { total: number; verified: number; pending: number; avg_rating: number; top_cities: { name: string; count: number }[]; total_materials: number };
  activity: { total_entries: number; recent_week: number; by_action: Record<string, number> };
  ai_usage: { total_chats: number; recent_week: number };
  events: { total: number; by_type: Record<string, number> };
};
type TopCompany = { company_id: string; company_name: string; slug: string; city: string; rating: number; review_count: number; composite_score: number; verification_status: string; ai_scores?: Record<string, number> };
type SupplyDemand = { city: string; companies: number; suppliers: number; ratio: number; status: string };
type EmbeddingStats = { initialized: boolean; total_entities: number; vocab_size: number; companies: number; suppliers: number };

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Bar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function BigStat({ icon: Icon, label, value, sub, color = "text-primary", bg = "bg-primary/10" }: {
  icon: ElementType; label: string; value: number | string; sub?: string; color?: string; bg?: string;
}) {
  return (
    <GlassCard interactive={false} className="p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <motion.p
          className="text-2xl font-bold text-foreground leading-tight"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {value}
        </motion.p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </GlassCard>
  );
}

// â”€â”€ main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([]);
  const [supplyDemand, setSupplyDemand] = useState<SupplyDemand[]>([]);
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.analytics.overview().then((d) => setAnalytics(d as unknown as Analytics)).catch(() => {}),
      api.analytics.topCompanies().then((d) => setTopCompanies(d as unknown as TopCompany[])).catch(() => {}),
      api.analytics.supplyDemand().then((d) => setSupplyDemand(d as unknown as SupplyDemand[])).catch(() => {}),
      api.embeddings.stats().then((d) => setEmbeddingStats(d as unknown as EmbeddingStats)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleRebuildEmbeddings = async () => {
    setRebuilding(true);
    try {
      const result = await api.embeddings.rebuild();
      setEmbeddingStats((prev) =>
        prev ? { ...prev, total_entities: result.entities_indexed, initialized: true } : prev,
      );
    } catch { /* ignore */ }
    setRebuilding(false);
  };

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin access required.</p>
      </GlassCard>
    );
  }

  const a = analytics;

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Platform Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live data across users, companies, suppliers & AI.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => navigate("/approvals")}>
            <ShieldAlert className="h-4 w-4 text-amber-500" /> Pending Approvals
            {a && (a.companies.pending + a.suppliers.pending) > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {a.companies.pending + a.suppliers.pending}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence>
        {loading && !a && (
          <motion.div className="flex flex-col items-center justify-center py-24 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading platform dataâ€¦</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Error state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!loading && !a && (
        <GlassCard interactive={false} className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Failed to load analytics data</p>
          <p className="text-xs text-muted-foreground mt-1">Check that the backend is running.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>Retry</Button>
        </GlassCard>
      )}

      {/* â”€â”€ Data loaded â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {a && (
        <>
          {/* â”€â”€ Hero KPI row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <BigStat icon={Users}           label="Total Users"        value={a.users.total}               sub={`+${a.users.recent_signups} this week`}           color="text-blue-500"    bg="bg-blue-500/10" />
            <BigStat icon={Building2}       label="Companies"          value={a.companies.total}           sub={`${a.companies.verified} verified`}               color="text-primary"     bg="bg-primary/10" />
            <BigStat icon={Package}         label="Suppliers"          value={a.suppliers.total}           sub={`${a.suppliers.total_materials} materials`}       color="text-orange-500"  bg="bg-orange-500/10" />
            <BigStat icon={Star}            label="Avg Rating"         value={a.companies.avg_rating.toFixed(1)} sub="companies"                                  color="text-amber-500"   bg="bg-amber-500/10" />
            <BigStat icon={Bot}             label="AI Chats"           value={a.ai_usage.total_chats}      sub={`${a.ai_usage.recent_week} this week`}           color="text-violet-500"  bg="bg-violet-500/10" />
            <BigStat icon={Activity}        label="Activity (7d)"      value={a.activity.recent_week}      sub={`${a.activity.total_entries} total`}              color="text-emerald-500" bg="bg-emerald-500/10" />
          </div>

          {/* â”€â”€ Alert banner: pending approvals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {(a.companies.pending + a.suppliers.pending) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3"
            >
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {a.companies.pending + a.suppliers.pending} pending approvals waiting
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.companies.pending} companies Â· {a.suppliers.pending} suppliers need review
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 border-amber-500/30 text-amber-600 hover:bg-amber-500/10" onClick={() => navigate("/approvals")}>
                Review <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="h-9 gap-1 rounded-xl p-1">
              <TabsTrigger value="overview"  className="rounded-lg text-xs px-3">Overview</TabsTrigger>
              <TabsTrigger value="companies" className="rounded-lg text-xs px-3">Companies</TabsTrigger>
              <TabsTrigger value="suppliers" className="rounded-lg text-xs px-3">Suppliers</TabsTrigger>
              <TabsTrigger value="supply-demand" className="rounded-lg text-xs px-3">Supply & Demand</TabsTrigger>
              <TabsTrigger value="activity"  className="rounded-lg text-xs px-3">Activity</TabsTrigger>
              <TabsTrigger value="system"    className="rounded-lg text-xs px-3">System</TabsTrigger>
            </TabsList>

            {/* â•â• OVERVIEW tab â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">

                {/* Users */}
                <GlassCard interactive={false} className="p-5 space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                      <Users className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    User Breakdown
                  </h3>

                  {/* Role distribution */}
                  <div className="space-y-2.5">
                    {(["client", "company", "supplier", "admin"] as const).map((role, ri) => {
                      const roleColors = ["bg-sky-400", "bg-primary", "bg-orange-400", "bg-violet-400"];
                      const color = roleColors[ri];
                      const cnt = a.users.by_role[role] ?? 0;
                      const pct = a.users.total ? (cnt / a.users.total) * 100 : 0;
                      return (
                        <div key={role}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs capitalize text-muted-foreground">{role}s</span>
                            <span className="text-xs font-semibold text-foreground">{cnt}</span>
                          </div>
                          <Bar pct={pct} color={color} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Status pills */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
                    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-emerald-500/8 py-2">
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-bold text-emerald-600">{a.users.active}</span>
                      <span className="text-[10px] text-muted-foreground">Active</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-amber-500/8 py-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-bold text-amber-600">{a.users.pending}</span>
                      <span className="text-[10px] text-muted-foreground">Pending</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-red-500/8 py-2">
                      <UserX className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-bold text-red-600">{a.users.banned}</span>
                      <span className="text-[10px] text-muted-foreground">Banned</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-border pt-2">
                    <Zap className="h-3 w-3 text-primary" />
                    <strong className="text-foreground">{a.users.recent_signups}</strong> new signups this week
                  </div>
                </GlassCard>

                {/* Companies summary */}
                <GlassCard interactive={false} className="p-5 space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Companies
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-500/8 p-3 text-center">
                      <ShieldCheck className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-600">{a.companies.verified}</p>
                      <p className="text-[10px] text-muted-foreground">Verified</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/8 p-3 text-center">
                      <ShieldAlert className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-amber-600">{a.companies.pending}</p>
                      <p className="text-[10px] text-muted-foreground">Pending</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total Reviews</span>
                      <span className="font-bold text-foreground">{a.companies.total_reviews.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" /> {a.companies.avg_rating}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top Cities</p>
                    {a.companies.top_cities.slice(0, 4).map((c, i) => {
                      const max = a.companies.top_cities[0]?.count || 1;
                      return (
                        <div key={c.name}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {c.name}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{c.count}</span>
                          </div>
                          <Bar pct={(c.count / max) * 100} color={i === 0 ? "bg-primary" : "bg-primary/40"} />
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Suppliers summary */}
                <GlassCard interactive={false} className="p-5 space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10">
                      <Package className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                    Suppliers
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-500/8 p-3 text-center">
                      <ShieldCheck className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-600">{a.suppliers.verified}</p>
                      <p className="text-[10px] text-muted-foreground">Verified</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/8 p-3 text-center">
                      <ShieldAlert className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-amber-600">{a.suppliers.pending}</p>
                      <p className="text-[10px] text-muted-foreground">Pending</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total Materials Listed</span>
                      <span className="font-bold text-foreground">{a.suppliers.total_materials}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" /> {a.suppliers.avg_rating}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top Cities</p>
                    {a.suppliers.top_cities.slice(0, 4).map((c, i) => {
                      const max = a.suppliers.top_cities[0]?.count || 1;
                      return (
                        <div key={c.name}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {c.name}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{c.count}</span>
                          </div>
                          <Bar pct={(c.count / max) * 100} color={i === 0 ? "bg-orange-500" : "bg-orange-400/40"} />
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

              </div>

              {/* AI Usage + Activity */}
              <div className="grid gap-4 md:grid-cols-2">
                <GlassCard interactive={false} className="p-5 space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                      <Bot className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    AI Usage
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-violet-500/8 p-4 text-center">
                      <p className="text-3xl font-bold text-violet-600">{a.ai_usage.total_chats}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total sessions</p>
                    </div>
                    <div className="rounded-xl bg-violet-500/5 p-4 text-center">
                      <p className="text-3xl font-bold text-foreground">{a.ai_usage.recent_week}</p>
                      <p className="text-xs text-muted-foreground mt-1">This week</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 border-t border-border pt-3">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                    {a.ai_usage.total_chats > 0
                      ? `${Math.round((a.ai_usage.recent_week / a.ai_usage.total_chats) * 100)}% of all chats are from this week`
                      : "No AI sessions recorded yet"}
                  </div>
                </GlassCard>

                <GlassCard interactive={false} className="p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    Activity Breakdown
                  </h3>
                  {Object.entries(a.activity.by_action)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 7)
                    .map(([action, count]) => {
                      const max = Math.max(...Object.values(a.activity.by_action));
                      return (
                        <div key={action}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-muted-foreground capitalize">{action.replace(/_/g, " ")}</span>
                            <span className="text-xs font-semibold text-foreground">{count}</span>
                          </div>
                          <Bar pct={(count / max) * 100} color="bg-emerald-500/60" />
                        </div>
                      );
                    })}
                </GlassCard>
              </div>
            </TabsContent>

            {/* â•â• COMPANIES tab â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="companies" className="space-y-4">
              <GlassCard interactive={false} className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Trophy className="h-4 w-4 text-amber-500" /> Top Performing Companies
                  </h3>
                  <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg" onClick={() => navigate("/companies")}>
                    View All <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {topCompanies.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No company data available.</div>
                ) : (
                  <div className="space-y-3">
                    {topCompanies.map((c, i) => {
                      const maxScore = topCompanies[0]?.composite_score || 1;
                      const medals = ["ðŸ¥‡", "ðŸ¥ˆ", "ðŸ¥‰"];
                      return (
                        <motion.div
                          key={c.company_id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="relative overflow-hidden rounded-xl border border-border p-4 hover:border-primary/20 hover:bg-secondary/30 transition-all cursor-pointer"
                          onClick={() => c.slug && navigate(`/companies/${c.slug}`)}
                        >
                          {/* Top-right score */}
                          <div className="absolute top-3 right-3 text-right">
                            <p className="text-base font-bold text-primary">{c.composite_score}</p>
                            <p className="text-[10px] text-muted-foreground">score</p>
                          </div>

                          <div className="flex items-start gap-3">
                            {/* Rank */}
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                              i === 0 ? "bg-amber-500/15 text-amber-600" :
                              i === 1 ? "bg-slate-400/15 text-slate-500" :
                              i === 2 ? "bg-orange-500/15 text-orange-600" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {i < 3 ? medals[i] : `#${i + 1}`}
                            </div>

                            <div className="flex-1 min-w-0 pr-14">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground truncate">{c.company_name}</p>
                                {c.verification_status === "verified"
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  : <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {c.city || "â€”"}</span>
                                <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-400" /> {c.rating}/5 ({c.review_count})</span>
                              </div>

                              {/* AI score pills */}
                              {c.ai_scores && Object.keys(c.ai_scores).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {Object.entries(c.ai_scores).slice(0, 3).map(([k, v]) => (
                                    <span key={k} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                                      {k.replace(/_/g, " ")}: {typeof v === "number" ? v.toFixed(1) : v}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Score bar */}
                              <div className="mt-2">
                                <Bar pct={(c.composite_score / maxScore) * 100} color={i < 3 ? "bg-amber-400" : "bg-primary/50"} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </TabsContent>

            {/* â•â• SUPPLIERS tab â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="suppliers" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <GlassCard interactive={false} className="p-5 flex flex-col gap-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Package className="h-4 w-4 text-orange-500" /> Supplier Overview
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Suppliers</span>
                      <span className="font-bold text-foreground">{a.suppliers.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Verified</span>
                      <span className="flex items-center gap-1 font-bold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {a.suppliers.verified}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Awaiting Review</span>
                      <span className="flex items-center gap-1 font-bold text-amber-600">
                        <Clock className="h-3.5 w-3.5" /> {a.suppliers.pending}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Materials</span>
                      <span className="font-bold text-foreground">{a.suppliers.total_materials}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <span className="font-bold text-foreground">{a.suppliers.avg_rating} / 5</span>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-border">
                    <Bar pct={a.suppliers.total ? (a.suppliers.verified / a.suppliers.total) * 100 : 0} color="bg-emerald-500" />
                    <p className="text-[10px] text-muted-foreground mt-1">{a.suppliers.verified} of {a.suppliers.total} verified</p>
                  </div>
                </GlassCard>

                <GlassCard interactive={false} className="p-5 md:col-span-2 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <MapPin className="h-4 w-4 text-orange-500" /> Supplier Distribution by City
                  </h3>
                  {a.suppliers.top_cities.map((c, i) => {
                    const max = a.suppliers.top_cities[0]?.count || 1;
                    return (
                      <div key={c.name}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">{c.name}</span>
                          <span className="text-sm font-bold text-foreground">{c.count}</span>
                        </div>
                        <Bar pct={(c.count / max) * 100} color={i === 0 ? "bg-orange-500" : "bg-orange-400/50"} />
                      </div>
                    );
                  })}
                  {a.suppliers.top_cities.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No city data.</p>
                  )}
                </GlassCard>
              </div>
            </TabsContent>

            {/* â•â• SUPPLY & DEMAND tab â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="supply-demand" className="space-y-4">
              <GlassCard interactive={false} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <BarChart3 className="h-4 w-4 text-primary" /> Supply vs Demand by City
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> Companies</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" /> Suppliers</span>
                  </div>
                </div>

                {supplyDemand.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
                ) : (
                  <div className="space-y-3">
                    {supplyDemand.map((sd, i) => {
                      const maxTotal = Math.max(...supplyDemand.map(s => s.companies + s.suppliers), 1);
                      const statusConf = {
                        balanced:      { label: "Balanced",     cls: "bg-emerald-500/10 text-emerald-600" },
                        high_demand:   { label: "High Demand",  cls: "bg-amber-500/10  text-amber-600" },
                        oversupplied:  { label: "Oversupplied", cls: "bg-blue-500/10   text-blue-600" },
                      }[sd.status] ?? { label: sd.status, cls: "bg-muted text-muted-foreground" };

                      return (
                        <motion.div
                          key={sd.city}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-xl border border-border p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-foreground">{sd.city}</span>
                            </div>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConf.cls}`}>
                              {statusConf.label}
                            </span>
                          </div>

                          {/* Visual bars */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                              <span className="w-20 text-[11px] text-muted-foreground shrink-0">Companies</span>
                              <div className="flex-1">
                                <Bar pct={(sd.companies / maxTotal) * 100} color="bg-primary" />
                              </div>
                              <span className="text-xs font-bold text-foreground w-6 text-right">{sd.companies}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-20 text-[11px] text-muted-foreground shrink-0">Suppliers</span>
                              <div className="flex-1">
                                <Bar pct={(sd.suppliers / maxTotal) * 100} color="bg-orange-400" />
                              </div>
                              <span className="text-xs font-bold text-foreground w-6 text-right">{sd.suppliers}</span>
                            </div>
                          </div>

                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Ratio: <strong className="text-foreground">{sd.ratio}</strong>
                            {sd.ratio > 2 ? " â€” More companies than suppliers, recruit more suppliers" : ""}
                            {sd.ratio < 0.5 ? " â€” More suppliers than companies, recruit more builders" : ""}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </TabsContent>

            {/* â•â• ACTIVITY tab â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="activity" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Activity by action */}
                <GlassCard interactive={false} className="p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Activity className="h-4 w-4 text-emerald-500" /> Platform Activity
                    <Badge variant="secondary" className="ml-auto text-xs">{a.activity.total_entries} total</Badge>
                  </h3>
                  {Object.entries(a.activity.by_action)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([action, count], i) => {
                      const max = Math.max(...Object.values(a.activity.by_action));
                      return (
                        <motion.div key={action} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-muted-foreground capitalize">{action.replace(/_/g, " ")}</span>
                            <span className="text-xs font-semibold text-foreground">{count}</span>
                          </div>
                          <Bar pct={(count / max) * 100} color="bg-emerald-500/70" />
                        </motion.div>
                      );
                    })}
                </GlassCard>

                {/* Event types */}
                <GlassCard interactive={false} className="p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <MessageSquare className="h-4 w-4 text-blue-500" /> Event Log
                    <Badge variant="secondary" className="ml-auto text-xs">{a.events.total} events</Badge>
                  </h3>
                  {Object.keys(a.events.by_type).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No events recorded.</p>
                  ) : (
                    Object.entries(a.events.by_type)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([type, count], i) => {
                        const max = Math.max(...Object.values(a.events.by_type));
                        return (
                          <motion.div key={type} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-muted-foreground">{type}</span>
                              <span className="text-xs font-semibold text-foreground">{count}</span>
                            </div>
                            <Bar pct={(count / max) * 100} color="bg-blue-500/60" />
                          </motion.div>
                        );
                      })
                  )}
                </GlassCard>
              </div>
            </TabsContent>

            {/* â•â• SYSTEM tab â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="system" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <GlassCard interactive={false} className="p-5 space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Database className="h-4 w-4 text-primary" /> AI Embeddings Index
                  </h3>

                  {!embeddingStats ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loadingâ€¦
                    </div>
                  ) : (
                    <>
                      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${embeddingStats.initialized ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {embeddingStats.initialized
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <AlertTriangle className="h-4 w-4 text-red-500" />}
                        <span className={`text-sm font-semibold ${embeddingStats.initialized ? "text-emerald-600" : "text-red-600"}`}>
                          {embeddingStats.initialized ? "Index Initialized" : "Index Not Built"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Total Entities", value: embeddingStats.total_entities, color: "text-primary" },
                          { label: "Vocabulary",     value: embeddingStats.vocab_size,      color: "text-blue-500" },
                          { label: "Companies",      value: embeddingStats.companies,        color: "text-primary" },
                          { label: "Suppliers",      value: embeddingStats.suppliers,        color: "text-orange-500" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="rounded-xl bg-muted/50 p-3 text-center">
                            <p className={`text-xl font-bold ${color}`}>{value}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="outline" size="sm" className="w-full gap-2 rounded-xl"
                        onClick={handleRebuildEmbeddings}
                        disabled={rebuilding}
                      >
                        {rebuilding
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />}
                        {rebuilding ? "Rebuildingâ€¦" : "Rebuild Index"}
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Rebuild when new companies or suppliers are added to ensure accurate AI recommendations.
                      </p>
                    </>
                  )}
                </GlassCard>

                {/* Quick actions */}
                <GlassCard interactive={false} className="p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Zap className="h-4 w-4 text-amber-500" /> Quick Admin Actions
                  </h3>
                  {[
                    { icon: ShieldAlert, label: "Review Pending Approvals", desc: `${(a.companies.pending + a.suppliers.pending)} waiting`, path: "/approvals", color: "text-amber-500 bg-amber-500/10" },
                    { icon: Users,       label: "Manage Users",             desc: `${a.users.total} total users`,                          path: "/users",     color: "text-blue-500 bg-blue-500/10" },
                    { icon: Building2,   label: "Browse Companies",         desc: `${a.companies.total} registered`,                       path: "/companies", color: "text-primary bg-primary/10" },
                    { icon: Package,     label: "Browse Suppliers",         desc: `${a.suppliers.total} registered`,                       path: "/suppliers", color: "text-orange-500 bg-orange-500/10" },
                    { icon: Bot,         label: "AI Chat Assistant",        desc: "Admin analytics chat",                                  path: "/ai-chat",   color: "text-violet-500 bg-violet-500/10" },
                  ].map(({ icon: Icon, label, desc, path, color }) => (
                    <button
                      key={path}
                      onClick={() => navigate(path)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/20 hover:bg-secondary/50 transition-all text-left"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color.split(" ")[1]}`}>
                        <Icon className={`h-4 w-4 ${color.split(" ")[0]}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </GlassCard>
              </div>
            </TabsContent>

          </Tabs>
        </>
      )}
    </motion.div>
  );
}
