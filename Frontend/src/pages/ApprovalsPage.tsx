import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { ArrowLeft, ShieldCheck, Building2, Package, Users } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinDate: string;
};

export default function ApprovalsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin only.</p>
      </GlassCard>
    );
  }

  const pendingUsers = users.filter((u) => u.status === "pending");
  const recentlyApproved = users.filter((u) => u.status === "active").slice(0, 5);
  const recentlyRejected = users.filter((u) => u.status === "banned").slice(0, 5);

  const pendingCompanies = pendingUsers.filter((u) => u.role === "company");
  const pendingSuppliers = pendingUsers.filter((u) => u.role === "supplier");
  const pendingOther = pendingUsers.filter((u) => u.role !== "company" && u.role !== "supplier");

  const handleApprove = async (userId: string) => {
    try {
      await api.admin.updateUserStatus(userId, "active");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u)));
    } catch {}
  };

  const handleReject = async (userId: string) => {
    try {
      await api.admin.updateUserStatus(userId, "banned");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "banned" } : u)));
    } catch {}
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review and approve pending company and supplier accounts.</p>
      </motion.div>

      {/* Summary banner */}
      <div className="grid gap-3 sm:grid-cols-3">
        <GlassCard interactive={false} className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{pendingUsers.length}</p>
            <p className="text-xs text-muted-foreground">Total Pending</p>
          </div>
        </GlassCard>
        <GlassCard interactive={false} className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{pendingCompanies.length}</p>
            <p className="text-xs text-muted-foreground">Companies</p>
          </div>
        </GlassCard>
        <GlassCard interactive={false} className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{pendingSuppliers.length}</p>
            <p className="text-xs text-muted-foreground">Suppliers</p>
          </div>
        </GlassCard>
      </div>

      {loading ? (
        <GlassCard interactive={false} className="p-6">
          <p className="text-muted-foreground">Loading...</p>
        </GlassCard>
      ) : pendingUsers.length === 0 ? (
        <GlassCard interactive={false} className="p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-success" />
          <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
          <p className="mt-1 text-sm text-muted-foreground">No pending approvals at this time.</p>
        </GlassCard>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({pendingUsers.length})</TabsTrigger>
            <TabsTrigger value="companies">Companies ({pendingCompanies.length})</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers ({pendingSuppliers.length})</TabsTrigger>
            {pendingOther.length > 0 && <TabsTrigger value="other">Other ({pendingOther.length})</TabsTrigger>}
          </TabsList>
          {[
            { key: "all", list: pendingUsers },
            { key: "companies", list: pendingCompanies },
            { key: "suppliers", list: pendingSuppliers },
            { key: "other", list: pendingOther },
          ].map(({ key, list }) => (
            <TabsContent key={key} value={key}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((u, idx) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.08, 0.5), duration: 0.35 }}
            >
            <GlassCard className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {u.role === "company" ? <Building2 className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{u.role}</Badge>
                  <StatusBadge status={u.status as any} />
                </div>
                <span className="text-xs text-muted-foreground">{u.joinDate}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="default" size="sm" className="flex-1" onClick={() => handleApprove(u.id)}>
                  Approve
                </Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleReject(u.id)}>
                  Reject
                </Button>
              </div>
            </GlassCard>
            </motion.div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </motion.div>
  );
}
