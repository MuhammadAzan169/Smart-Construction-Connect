import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import {
  ArrowLeft, BarChart3, Building2, Users, Package, TrendingUp,
  Activity, RefreshCw, Database, MapPin, Star, AlertTriangle,
  CheckCircle2, Clock, Bot, Loader2,
} from "lucide-react";

type Analytics = {
  users: {
    total: number;
    by_role: Record<string, number>;
    active: number;
    pending: number;
    banned: number;
    recent_signups: number;
  };
  companies: {
    total: number;
    verified: number;
    pending: number;
    avg_rating: number;
    top_cities: { name: string; count: number }[];
    total_reviews: number;
  };
  suppliers: {
    total: number;
    verified: number;
    pending: number;
    avg_rating: number;
    top_cities: { name: string; count: number }[];
    total_materials: number;
  };
  activity: {
    total_entries: number;
    recent_week: number;
    by_action: Record<string, number>;
  };
  ai_usage: {
    total_chats: number;
    recent_week: number;
  };
  events: {
    total: number;
    by_type: Record<string, number>;
  };
};

type TopCompany = {
  company_id: string;
  company_name: string;
  city: string;
  rating: number;
  review_count: number;
  composite_score: number;
  verification_status: string;
};

type SupplyDemand = {
  city: string;
  companies: number;
  suppliers: number;
  ratio: number;
  status: string;
};

type EmbeddingStats = {
  initialized: boolean;
  total_entities: number;
  vocab_size: number;
  companies: number;
  suppliers: number;
};

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

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost" size="sm"
            className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
          <p className="text-sm text-muted-foreground">Comprehensive overview of platform performance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && !analytics ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : analytics ? (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Users} title="Total Users" value={analytics.users.total} />
            <StatCard icon={Building2} title="Companies" value={analytics.companies.total} />
            <StatCard icon={Package} title="Suppliers" value={analytics.suppliers.total} />
            <StatCard icon={Star} title="Avg Rating" value={analytics.companies.avg_rating.toFixed(1)} />
            <StatCard icon={Bot} title="AI Chats" value={analytics.ai_usage.total_chats} />
            <StatCard icon={Activity} title="Events (Week)" value={analytics.activity.recent_week} />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="companies">Companies</TabsTrigger>
              <TabsTrigger value="supply-demand">Supply & Demand</TabsTrigger>
              <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* User Breakdown */}
                <GlassCard interactive={false} className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> User Breakdown
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.users.by_role).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground capitalize">{role}s</span>
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-500">Active</span>
                        <span className="font-bold">{analytics.users.active}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-500">Pending</span>
                        <span className="font-bold">{analytics.users.pending}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-destructive">Banned</span>
                        <span className="font-bold">{analytics.users.banned}</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {analytics.users.recent_signups} signups this week
                    </div>
                  </div>
                </GlassCard>

                {/* Company Stats */}
                <GlassCard interactive={false} className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Companies
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Verified</span>
                      <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">{analytics.companies.verified}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pending Verification</span>
                      <Badge variant="secondary" className="text-xs">{analytics.companies.pending}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total Reviews</span>
                      <span className="font-bold">{analytics.companies.total_reviews.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">TOP CITIES</p>
                      {analytics.companies.top_cities.slice(0, 4).map((c) => (
                        <div key={c.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {c.name}
                          </span>
                          <span className="font-bold">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* Supplier Stats */}
                <GlassCard interactive={false} className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-500" /> Suppliers
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Verified</span>
                      <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">{analytics.suppliers.verified}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total Materials</span>
                      <span className="font-bold">{analytics.suppliers.total_materials}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <span className="font-bold flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /> {analytics.suppliers.avg_rating}</span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">TOP CITIES</p>
                      {analytics.suppliers.top_cities.slice(0, 4).map((c) => (
                        <div key={c.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {c.name}
                          </span>
                          <span className="font-bold">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* AI & Activity */}
              <div className="grid gap-4 md:grid-cols-2">
                <GlassCard interactive={false} className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" /> AI Usage
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{analytics.ai_usage.total_chats}</p>
                      <p className="text-xs text-muted-foreground">Total Chats</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{analytics.ai_usage.recent_week}</p>
                      <p className="text-xs text-muted-foreground">This Week</p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard interactive={false} className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Activity Summary
                  </h3>
                  <div className="space-y-1.5">
                    {Object.entries(analytics.activity.by_action)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([action, count]) => (
                        <div key={action} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{action.replace(/_/g, " ")}</span>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </GlassCard>
              </div>
            </TabsContent>

            {/* Top Companies Tab */}
            <TabsContent value="companies" className="space-y-4">
              <GlassCard interactive={false} className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Top Performing Companies
                </h3>
                <div className="space-y-3">
                  {topCompanies.map((c, i) => (
                    <div key={c.company_id} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-secondary/30 transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.company_name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {c.city || "—"}
                          <Star className="h-3 w-3 text-amber-400" /> {c.rating}/5 ({c.review_count} reviews)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{c.composite_score}</p>
                        <p className="text-[10px] text-muted-foreground">score</p>
                      </div>
                      {c.verification_status === "verified" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                    </div>
                  ))}
                  {topCompanies.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No company data available.</p>
                  )}
                </div>
              </GlassCard>
            </TabsContent>

            {/* Supply Demand Tab */}
            <TabsContent value="supply-demand" className="space-y-4">
              <GlassCard interactive={false} className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Supply-Demand Analysis by City
                </h3>
                <div className="space-y-2">
                  {supplyDemand.map((sd) => (
                    <div key={sd.city} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{sd.city}</p>
                        <p className="text-xs text-muted-foreground">
                          {sd.companies} companies · {sd.suppliers} suppliers · ratio {sd.ratio}
                        </p>
                      </div>
                      <Badge
                        className={
                          sd.status === "balanced"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : sd.status === "high_demand"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-blue-500/10 text-blue-500"
                        }
                      >
                        {sd.status === "balanced" ? "Balanced" : sd.status === "high_demand" ? "High Demand" : "Oversupplied"}
                      </Badge>
                    </div>
                  ))}
                  {supplyDemand.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
                  )}
                </div>
              </GlassCard>
            </TabsContent>

            {/* Embeddings Tab */}
            <TabsContent value="embeddings" className="space-y-4">
              <GlassCard interactive={false} className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" /> Embeddings Index
                </h3>
                {embeddingStats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{embeddingStats.total_entities}</p>
                        <p className="text-xs text-muted-foreground">Total Entities</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{embeddingStats.vocab_size}</p>
                        <p className="text-xs text-muted-foreground">Vocabulary Size</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{embeddingStats.companies}</p>
                        <p className="text-xs text-muted-foreground">Companies</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{embeddingStats.suppliers}</p>
                        <p className="text-xs text-muted-foreground">Suppliers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={embeddingStats.initialized ? "default" : "secondary"}>
                        {embeddingStats.initialized ? "Initialized" : "Not Initialized"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRebuildEmbeddings}
                        disabled={rebuilding}
                      >
                        {rebuilding ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                        Rebuild Index
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading embeddings stats...</p>
                )}
              </GlassCard>

              {/* Event Type Breakdown */}
              {analytics?.events && (
                <GlassCard interactive={false} className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Event Log ({analytics.events.total} total)
                  </h3>
                  <div className="space-y-1.5">
                    {Object.entries(analytics.events.by_type)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{type}</span>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </GlassCard>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <GlassCard interactive={false} className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load analytics data.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>Retry</Button>
        </GlassCard>
      )}
    </motion.div>
  );
}
