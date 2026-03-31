import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { mockCompanies, mockRequests } from "@/data/mockData";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import { Building2, FileText, Star, TrendingUp, Search, SlidersHorizontal, Heart } from "lucide-react";
import { useState } from "react";

function ClientContent() {
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string[]>([]);

  const filtered = mockCompanies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back 👋</h1>
        <p className="text-muted-foreground">Find the perfect construction partner for your project.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Companies Available" value={mockCompanies.length} icon={Building2} />
        <StatCard title="My Requests" value={mockRequests.length} icon={FileText} />
        <StatCard title="Avg. Rating" value="4.5" icon={Star} />
        <StatCard title="Best Match" value="94%" icon={TrendingUp} trend="up" change="+2% this week" />
      </div>

      {/* Search + filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies by name or location..."
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Company cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((company, i) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            className="group overflow-hidden rounded-2xl border border-border bg-card card-shadow transition-shadow hover:card-shadow-hover"
          >
            <div className="relative h-40 overflow-hidden">
              <img src={company.image} alt={company.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute right-3 top-3">
                <button
                  onClick={() => setSaved(s => s.includes(company.id) ? s.filter(x => x !== company.id) : [...s, company.id])}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm transition-colors hover:bg-card"
                >
                  <Heart className={`h-4 w-4 ${saved.includes(company.id) ? "fill-destructive text-destructive" : "text-foreground"}`} />
                </button>
              </div>
              {company.verified && (
                <div className="absolute left-3 top-3">
                  <StatusBadge status="verified" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{company.name}</h3>
                  <p className="text-sm text-muted-foreground">{company.location}</p>
                </div>
                <MatchScoreRing score={company.matchScore} size={48} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {company.specialization.map((s) => (
                  <span key={s} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{s}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  <span className="font-medium text-foreground">{company.rating}</span>
                  <span>({company.reviews})</span>
                </div>
                <span className="text-xs text-muted-foreground">{company.priceRange}</span>
              </div>
              <button className="mt-4 h-9 w-full rounded-lg gradient-bg text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Request Quote
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CompanyContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Dashboard</h1>
        <p className="text-muted-foreground">Manage your requests, projects, and profile.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Incoming Requests" value={5} icon={FileText} trend="up" change="+3 this week" />
        <StatCard title="Active Projects" value={3} icon={Building2} />
        <StatCard title="Average Rating" value="4.7" icon={Star} />
        <StatCard title="Profile Views" value={247} icon={TrendingUp} trend="up" change="+18%" />
      </div>

      {/* Requests table */}
      <div className="rounded-2xl border border-border bg-card card-shadow">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Recent Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Project</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Budget</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockRequests.map((req) => (
                <tr key={req.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{req.clientName}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{req.project}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{req.location}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{req.budget}</td>
                  <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{req.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Milestones */}
      <div className="rounded-2xl border border-border bg-card p-6 card-shadow">
        <h2 className="mb-4 font-semibold text-foreground">Active Project Progress</h2>
        <div className="space-y-4">
          {["Foundation", "Structure", "Electrical", "Finishing"].map((phase, i) => (
            <div key={phase}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-foreground">{phase}</span>
                <span className="text-muted-foreground">{[100, 75, 30, 0][i]}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${[100, 75, 30, 0][i]}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="h-full rounded-full gradient-bg"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupplierContent() {
  const materials = [
    { name: "Bestway Cement 50kg", category: "Cement", price: "PKR 1,350", stock: 500, trend: "up" },
    { name: "TOR Steel Bar 60G", category: "Steel", price: "PKR 285,000/ton", stock: 45, trend: "down" },
    { name: "A+ Red Bricks", category: "Bricks", price: "PKR 18/pc", stock: 50000, trend: "up" },
    { name: "ICI Dulux Paint 20L", category: "Paint", price: "PKR 12,500", stock: 120, trend: "up" },
    { name: "Pak Cable 7/29", category: "Electrical", price: "PKR 28,000/roll", stock: 80, trend: "down" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Dashboard</h1>
          <p className="text-muted-foreground">Manage your inventory and pricing.</p>
        </div>
        <button className="h-10 rounded-xl gradient-bg px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
          + Add Product
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Products" value={8} icon={Building2} />
        <StatCard title="Active Orders" value={12} icon={FileText} trend="up" change="+5 today" />
        <StatCard title="Revenue (MTD)" value="PKR 2.4M" icon={TrendingUp} trend="up" change="+14%" />
        <StatCard title="Low Stock Items" value={2} icon={Star} />
      </div>

      <div className="rounded-2xl border border-border bg-card card-shadow">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Product Inventory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Stock</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, i) => (
                <tr key={i} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{m.name}</td>
                  <td className="px-6 py-4"><span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{m.category}</span></td>
                  <td className="px-6 py-4 text-sm text-foreground">{m.price}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{m.stock.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20">Edit</button>
                      <button className="rounded-md bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminContent() {
  const { mockUsers: users } = require("@/data/mockData");
  return <AdminDashboard />;
}

function AdminDashboard() {
  const allUsers = [
    { id: "U-001", name: "Ahmed Khan", email: "ahmed@example.com", role: "client", status: "active" as const, joinDate: "2026-01-15" },
    { id: "U-002", name: "Karachi Builders", email: "info@001builders.com", role: "company", status: "active" as const, joinDate: "2026-01-10" },
    { id: "U-003", name: "Punjab Cement Traders", email: "sales@pct.com", role: "supplier", status: "pending" as const, joinDate: "2026-03-01" },
    { id: "U-004", name: "Fatima Ali", email: "fatima@example.com", role: "client", status: "active" as const, joinDate: "2026-02-20" },
    { id: "U-005", name: "Elite Builders", email: "contact@elite.com", role: "company", status: "active" as const, joinDate: "2025-12-05" },
    { id: "U-006", name: "Steel Hub PK", email: "info@steelhub.pk", role: "supplier", status: "banned" as const, joinDate: "2025-11-10" },
    { id: "U-007", name: "Multan Homes", email: "info@multanhomes.pk", role: "company", status: "pending" as const, joinDate: "2026-03-25" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform management and oversight.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={allUsers.length} icon={Building2} />
        <StatCard title="Pending Approvals" value={allUsers.filter(u => u.status === "pending").length} icon={FileText} />
        <StatCard title="Active Companies" value={allUsers.filter(u => u.role === "company" && u.status === "active").length} icon={Star} />
        <StatCard title="Banned Accounts" value={allUsers.filter(u => u.status === "banned").length} icon={TrendingUp} />
      </div>

      <div className="rounded-2xl border border-border bg-card card-shadow">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">User Management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-6 py-4"><span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground">{u.role}</span></td>
                  <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{u.joinDate}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {u.status === "pending" && (
                        <button className="rounded-md bg-success/10 px-3 py-1 text-xs font-medium text-success transition-colors hover:bg-success/20">Approve</button>
                      )}
                      {u.status !== "banned" ? (
                        <button className="rounded-md bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20">Ban</button>
                      ) : (
                        <button className="rounded-md bg-success/10 px-3 py-1 text-xs font-medium text-success transition-colors hover:bg-success/20">Unban</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();

  const content = () => {
    switch (user?.role) {
      case "client": return <ClientContent />;
      case "company": return <CompanyContent />;
      case "supplier": return <SupplierContent />;
      case "admin": return <AdminDashboard />;
      default: return <ClientContent />;
    }
  };

  return (
    <DashboardLayout>
      {content()}
    </DashboardLayout>
  );
}
