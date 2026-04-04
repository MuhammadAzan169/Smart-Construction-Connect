import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Search, ArrowLeft, Users, ShieldCheck, Ban, UserPlus } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinDate: string;
  phone?: string;
};

export default function UsersPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    api.admin.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">This section is available for Admin accounts.</p>
      </GlassCard>
    );
  }

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await api.admin.updateUserStatus(userId, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    } catch {}
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const roleCounts = useMemo(() => {
    const counts = { total: users.length, active: 0, pending: 0, banned: 0 };
    for (const u of users) {
      if (u.status === "active") counts.active++;
      else if (u.status === "pending") counts.pending++;
      else if (u.status === "banned") counts.banned++;
    }
    return counts;
  }, [users]);

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default" as const;
      case "company": return "secondary" as const;
      case "supplier": return "outline" as const;
      default: return "secondary" as const;
    }
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
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage all platform users.</p>
        </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={roleCounts.total} icon={Users} />
        <StatCard title="Active" value={roleCounts.active} icon={ShieldCheck} />
        <StatCard title="Pending" value={roleCounts.pending} icon={UserPlus} trend={roleCounts.pending > 0 ? "up" : undefined} change={roleCounts.pending > 0 ? "Needs review" : ""} />
        <StatCard title="Banned" value={roleCounts.banned} icon={Ban} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
      <GlassCard className="p-0">
        <div className="border-b border-border p-5">
          <p className="text-sm font-semibold text-foreground">All users ({filtered.length})</p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No users found</TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(u.role)} className="capitalize text-[10px]">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status as any} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.joinDate}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {u.status === "pending" && (
                          <Button variant="default" size="sm" onClick={() => handleStatusChange(u.id, "active")}>
                            Approve
                          </Button>
                        )}
                        {u.status === "active" && u.role !== "admin" && (
                          <Button variant="destructive" size="sm" onClick={() => handleStatusChange(u.id, "banned")}>
                            Ban
                          </Button>
                        )}
                        {u.status === "banned" && (
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(u.id, "active")}>
                            Unban
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
      </motion.div>
    </motion.div>
  );
}
