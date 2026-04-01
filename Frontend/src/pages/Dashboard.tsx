import { useMemo } from "react";
import { Link } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mockCompanies,
  mockMaterials,
  mockNotifications,
  mockRequests,
  mockUsers,
} from "@/data/mockData";
import { cn } from "@/lib/utils";
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
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Companies" value={mockCompanies.length} icon={Building2} />
        <StatCard title="Verified" value={verifiedCount} icon={ShieldCheck} />
        <StatCard title="Requests" value={mockRequests.length} icon={FileText} />
        <StatCard title="Best Match" value={`${bestMatchScore}%`} icon={TrendingUp} trend="up" change="Recommended" />
      </div>

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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {topPicks.map((c) => (
                <GlassCard key={c.id} className="p-4">
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
  const pending = useMemo(() => mockRequests.filter((r) => r.status === "pending"), []);
  const accepted = useMemo(() => mockRequests.filter((r) => r.status === "accepted"), []);

  const phases = [
    { name: "Foundation", progress: 100 },
    { name: "Structure", progress: 75 },
    { name: "Electrical", progress: 30 },
    { name: "Finishing", progress: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage requests, track work, and keep your profile premium.</p>
        </div>
        <Button asChild>
          <Link to="/requests">Open requests</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Incoming Requests" value={pending.length} icon={FileText} trend="up" change={`${pending.length} pending`} />
        <StatCard title="Accepted" value={accepted.length} icon={ShieldCheck} />
        <StatCard title="Avg Rating" value="4.7" icon={Star} />
        <StatCard title="Profile Views" value={247} icon={TrendingUp} trend="up" change="+18% (demo)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Incoming requests</p>
              <p className="mt-1 text-xs text-muted-foreground">Respond quickly to improve conversion.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/requests">View all</Link>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRequests.slice(0, 5).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.clientName}</TableCell>
                    <TableCell className="text-foreground">{r.project}</TableCell>
                    <TableCell className="text-muted-foreground">{r.budget}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/requests">Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        <GlassCard interactive={false} className="p-5">
          <p className="text-sm font-semibold text-foreground">Active project progress</p>
          <p className="mt-1 text-xs text-muted-foreground">Phase snapshot (demo).</p>

          <div className="mt-5 space-y-4">
            {phases.map((p, idx) => (
              <div key={p.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{p.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.progress}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.08 }}
                    className={cn("h-full rounded-full", p.progress >= 70 ? "gradient-bg" : "bg-primary/60")}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button asChild variant="outline" className="w-full">
              <Link to="/pricing" className="flex items-center justify-between">
                Upgrade for Premium visibility <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function SupplierDashboard() {
  const lowStockThreshold = 50;

  const lowStock = useMemo(() => mockMaterials.filter((m) => m.stock <= lowStockThreshold), []);
  const categories = useMemo(() => new Set(mockMaterials.map((m) => m.category)).size, []);
  const totalStock = useMemo(() => mockMaterials.reduce((acc, m) => acc + m.stock, 0), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor stock levels and update pricing efficiently.</p>
        </div>
        <Button asChild>
          <Link to="/products">Open inventory</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Products" value={mockMaterials.length} icon={Package} />
        <StatCard title="Categories" value={categories} icon={TrendingUp} />
        <StatCard title="Total Stock" value={totalStock.toLocaleString()} icon={TrendingUp} trend="up" change="Stable" />
        <StatCard title="Low Stock" value={lowStock.length} icon={TrendingDown} trend="down" change="Attention" />
      </div>

      <GlassCard className="p-0">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">Low stock alerts</p>
            <p className="mt-1 text-xs text-muted-foreground">Items below {lowStockThreshold} units.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/products">Manage</Link>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No low stock items.
                  </TableCell>
                </TableRow>
              ) : (
                lowStock.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.category}</TableCell>
                    <TableCell className="text-foreground">{formatPKR(m.price)}</TableCell>
                    <TableCell className="font-medium text-warning">
                      {m.stock.toLocaleString()} {m.unit}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}

function AdminDashboard() {
  const pendingUsers = useMemo(() => mockUsers.filter((u) => u.status === "pending"), []);
  const verifiedCompanies = useMemo(() => mockCompanies.filter((c) => c.verified).length, []);
  const unverifiedCompanies = useMemo(() => mockCompanies.filter((c) => !c.verified).length, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Oversight, approvals, and platform activity.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/approvals">Review approvals</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/users">Users</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={mockUsers.length} icon={Users} />
        <StatCard title="Pending Approvals" value={pendingUsers.length} icon={ShieldCheck} />
        <StatCard title="Verified Companies" value={verifiedCompanies} icon={Building2} />
        <StatCard title="Events" value={mockNotifications.length} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Pending approvals</p>
              <p className="mt-1 text-xs text-muted-foreground">Companies and suppliers awaiting verification.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/approvals">Open</Link>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No pending approvals.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingUsers.slice(0, 4).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{u.role}</TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/approvals">Review</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Recent activity</p>
              <p className="mt-1 text-xs text-muted-foreground">System notifications and events.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/activity">View all</Link>
            </Button>
          </div>

          <div className="divide-y divide-border">
            {mockNotifications.slice(0, 5).map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                </div>
                <div className="text-right">
                  {n.read ? (
                    <Badge variant="outline" className="rounded-lg">
                      Read
                    </Badge>
                  ) : (
                    <Badge className="rounded-lg">New</Badge>
                  )}
                  <p className="mt-2 whitespace-nowrap text-xs text-muted-foreground">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard interactive={false} className="p-5">
        <p className="text-sm font-semibold text-foreground">Company verification status</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Verified: <span className="font-semibold text-foreground">{verifiedCompanies}</span> • Unverified:{" "}
          <span className="font-semibold text-foreground">{unverifiedCompanies}</span>
        </p>
      </GlassCard>
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
