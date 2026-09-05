import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft, Ban, Building2, CheckCircle2, ChevronDown, Loader2,
  MessageSquare, MoreHorizontal, Package, Search, ShieldCheck, UserPlus, Users,
  UserX, Clock, Filter,
} from "lucide-react";

/* ------------------------------------------------------------------ */
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinDate: string;
  phone?: string;
};

const ROLE_COLORS: Record<string, string> = {
  admin:    "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  company:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  supplier: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  client:   "bg-secondary text-secondary-foreground",
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  admin:    <ShieldCheck className="h-4 w-4" />,
  company:  <Building2 className="h-4 w-4" />,
  supplier: <Package className="h-4 w-4" />,
  client:   <Users className="h-4 w-4" />,
};

const STATUS_ROW_COLORS: Record<string, string> = {
  pending: "border-s-amber-400",
  banned:  "border-s-destructive",
  active:  "border-s-transparent",
};

/* ================================================================== */
export default function UsersPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    api.admin
      .getUsers()
      .then((d) => setUsers((d.items ?? []) as UserRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Guard ---------- */
  if (!user || user.role !== "admin") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  /* ---------- Actions ---------- */
  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionLoading(userId);
    try {
      await api.admin.updateUserStatus(userId, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    } catch {}
    setActionLoading(null);
  };

  /* ---------- Derived ---------- */
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const counts = useMemo(() => {
    const c = { total: users.length, active: 0, pending: 0, banned: 0 };
    for (const u of users) {
      if (u.status === "active") c.active++;
      else if (u.status === "pending") c.pending++;
      else if (u.status === "banned") c.banned++;
    }
    return c;
  }, [users]);

  /* ================================================================ */
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ===== PAGE HEADER ===== */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.35 }}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 gap-1.5"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{t("users.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("users.subtitle")}</p>
      </motion.div>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Total Users"
          value={counts.total}
          color="blue"
          onClick={() => setFilterStatus("all")}
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Active"
          value={counts.active}
          color="emerald"
          onClick={() => setFilterStatus("active")}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending"
          value={counts.pending}
          color="amber"
          badge={counts.pending > 0 ? "Needs review" : undefined}
          onClick={() => setFilterStatus("pending")}
        />
        <SummaryCard
          icon={<Ban className="h-5 w-5" />}
          label="Banned"
          value={counts.banned}
          color="red"
          onClick={() => setFilterStatus("banned")}
        />
      </div>

      {/* ===== FILTERS BAR ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>

        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40 gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>

        {(search || filterRole !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => { setSearch(""); setFilterRole("all"); setFilterStatus("all"); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* ===== USER TABLE / CARDS ===== */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Table header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {filtered.length === users.length ? `All Users` : `Filtered Results`}
              </h2>
              <p className="text-xs text-muted-foreground">{filtered.length} of {users.length} users</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading users…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <UserX className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No users found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((u, idx) => {
                const isLoading = actionLoading === u.id;
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.25 }}
                    className={`flex flex-wrap items-center gap-4 border-s-4 px-5 py-4 transition-colors hover:bg-secondary/30 ${STATUS_ROW_COLORS[u.status] ?? "border-s-transparent"}`}
                  >
                    {/* Avatar */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${ROLE_COLORS[u.role] ?? "bg-secondary text-secondary-foreground"}`}>
                      {u.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>

                    {/* Name + email */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{u.name}</p>
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium capitalize ${ROLE_COLORS[u.role] ?? "bg-secondary text-secondary-foreground"}`}>
                          {ROLE_ICON[u.role]}
                          {u.role}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusBadge status={u.status as "pending" | "active" | "banned"} />
                    </div>

                    {/* Join date */}
                    <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      Joined {u.joinDate}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {u.role !== "admin" && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => {
                                  api.messages.startConversation(u.email, u.name, `Hi ${u.name}, this is admin reaching out.`).then(() => navigate("/messages")).catch(() => {});
                                }}
                              >
                                <MessageSquare className="h-4 w-4" /> Message
                              </DropdownMenuItem>
                            )}
                            {u.status === "pending" && (
                              <DropdownMenuItem
                                className="gap-2 text-green-600 focus:text-green-600"
                                onClick={() => handleStatusChange(u.id, "active")}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Approve
                              </DropdownMenuItem>
                            )}
                            {u.status === "pending" && (
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleStatusChange(u.id, "banned")}
                              >
                                <UserX className="h-4 w-4" /> Reject
                              </DropdownMenuItem>
                            )}
                            {u.status === "active" && u.role !== "admin" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-destructive focus:text-destructive"
                                  onClick={() => handleStatusChange(u.id, "banned")}
                                >
                                  <Ban className="h-4 w-4" /> Ban User
                                </DropdownMenuItem>
                              </>
                            )}
                            {u.status === "banned" && (
                              <DropdownMenuItem
                                className="gap-2 text-green-600 focus:text-green-600"
                                onClick={() => handleStatusChange(u.id, "active")}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Unban
                              </DropdownMenuItem>
                            )}
                            {u.status === "active" && u.role === "admin" && (
                              <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                                <ShieldCheck className="h-4 w-4" /> Admin Account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ================================================================== */
function SummaryCard({
  icon, label, value, color, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "emerald" | "amber" | "red";
  badge?: string;
  onClick?: () => void;
}) {
  const colors = {
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    amber:   "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    red:     "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm text-start transition-colors hover:bg-secondary/40 w-full"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge && (
          <span className="mt-0.5 inline-block text-[10px] font-medium text-amber-600 dark:text-amber-400">{badge}</span>
        )}
      </div>
    </button>
  );
}
