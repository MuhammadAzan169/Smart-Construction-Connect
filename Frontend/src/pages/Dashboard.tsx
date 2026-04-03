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
import {
  mockCompanies,
  mockRequests,
} from "@/data/mockData";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Building2,
  FileText,
  Package,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

function ClientDashboard() {
  const topPicks = useMemo(() => {
    return [...mockCompanies].sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  }, []);

  const bestMatchScore = topPicks[0]?.matchScore ?? 0;
  const verifiedCount = useMemo(() => mockCompanies.filter((c) => c.verified).length, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Dashboard</h1>
          <p className="text-sm text-muted-foreground">Browse companies, compare options, and track requests.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/companies">Browse companies</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/requests">My requests</Link>
          </Button>
        </div>
      </div>

      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
        <StaggerItem>
          <StatCard title="Companies" value={mockCompanies.length} icon={Building2} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Verified" value={verifiedCount} icon={ShieldCheck} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Requests" value={mockRequests.length} icon={FileText} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Best Match" value={`${bestMatchScore}%`} icon={TrendingUp} trend="up" change="Recommended" />
        </StaggerItem>
      </StaggerList>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Top matches</p>
                <p className="mt-1 text-xs text-muted-foreground">Fast shortlist based on match score and verification.</p>
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/companies" className="flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 focus-highlight">
              {topPicks.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                >
                  <TiltCard tiltMaxAngleX={5} tiltMaxAngleY={5} scale={1.01}>
                    <GlassCard className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{c.location}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.specialization.slice(0, 2).map((s) => (
                          <Badge key={s} variant="secondary" className="rounded-lg">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <MatchScoreRing score={c.matchScore} size={44} />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      <span className="font-semibold text-foreground">{c.rating}</span>
                      <span>({c.reviews})</span>
                    </div>
                    <StatusBadge status={c.verified ? "verified" : "pending"} />
                  </div>
                    </GlassCard>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard interactive={false} className="p-5">
          <p className="text-sm font-semibold text-foreground">Next steps</p>
          <p className="mt-1 text-xs text-muted-foreground">Clear actions to keep your project moving.</p>

          <div className="mt-4 space-y-3">
            <Button asChild className="w-full">
              <Link to="/companies" className="flex items-center justify-between">
                Browse & compare <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/requests" className="flex items-center justify-between">
                View requests <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/pricing" className="flex items-center justify-between">
                Upgrade tier <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function CompanyDashboard() {
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? "";
  const companyKey = email;

  const pricingState = useMemo(() => {
    try {
      const raw = localStorage.getItem(`scc_pricing_v3:${companyKey}`);
      if (!raw) return null;
      return JSON.parse(raw) as { packages?: unknown[]; areaRates?: unknown[] };
    } catch { return null; }
  }, [companyKey]);

  const activePackages = (pricingState?.packages as { id: string }[] | undefined)?.length ?? 0;
  const coveredCities = useMemo(() => {
    const areas = pricingState?.areaRates as { city?: string }[] | undefined;
    if (!areas) return 0;
    return new Set(areas.map((r) => r.city).filter(Boolean)).size;
  }, [pricingState]);

  const pendingRequests = useMemo(() => mockRequests.filter((r) => r.status === "pending").length, []);
  const recentRequests = useMemo(() => mockRequests.slice(0, 4), []);

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
          <StatCard title="Active Packages" value={activePackages || "—"} icon={Package} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Covered Cities" value={coveredCities || "—"} icon={Building2} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Pending Requests" value={pendingRequests} icon={FileText} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Total Requests" value={mockRequests.length} icon={Activity} trend="up" change="All time" />
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
              {recentRequests.length === 0 ? (
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
                      <p className="truncate text-sm font-medium text-foreground">{req.clientName}</p>
                      <p className="truncate text-xs text-muted-foreground">{req.location ?? "—"}</p>
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

  useEffect(() => {
    api.admin
      .getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Oversight, approvals, and platform activity.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/users">Users</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/activity">Activity</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading stats…</p>
        </div>
      ) : stats ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            <StaggerItem><StatCard title="Total Users" value={stats.total_users} icon={Users} /></StaggerItem>
            <StaggerItem><StatCard title="Clients" value={stats.clients} icon={Users} /></StaggerItem>
            <StaggerItem><StatCard title="Companies" value={stats.companies} icon={Building2} /></StaggerItem>
            <StaggerItem><StatCard title="Suppliers" value={stats.suppliers} icon={Package} /></StaggerItem>
          </StaggerList>

          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08} delay={0.2}>
            <StaggerItem>
              <StatCard
                title="Pending Approvals"
                value={stats.pending_approvals}
                icon={ShieldCheck}
                trend={stats.pending_approvals > 0 ? "up" : undefined}
                change={stats.pending_approvals > 0 ? "Needs review" : "All clear"}
              />
            </StaggerItem>
            <StaggerItem><StatCard title="Banned Users" value={stats.banned_users} icon={Activity} /></StaggerItem>
            <StaggerItem><StatCard title="Dataset Companies" value={stats.dataset_companies} icon={Building2} /></StaggerItem>
            <StaggerItem><StatCard title="Dataset Suppliers" value={stats.dataset_suppliers} icon={Package} /></StaggerItem>
          </StaggerList>
        </motion.div>
      ) : (
        <GlassCard className="p-5">
          <p className="text-sm text-muted-foreground">Failed to load stats. Please try again later.</p>
        </GlassCard>
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
