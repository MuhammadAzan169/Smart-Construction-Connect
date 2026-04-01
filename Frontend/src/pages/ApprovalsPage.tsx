import { useMemo, useState } from "react";

import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockCompanies, mockUsers } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

type PendingUser = (typeof mockUsers)[number];

type CompanyApproval = (typeof mockCompanies)[number];

export default function ApprovalsPage() {
  const user = useAuthStore((s) => s.user);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>(() => mockUsers.filter((u) => u.status === "pending"));
  const [unverifiedCompanies, setUnverifiedCompanies] = useState<CompanyApproval[]>(() => mockCompanies.filter((c) => !c.verified));

  const totals = useMemo(() => {
    return {
      pendingUsers: pendingUsers.length,
      unverifiedCompanies: unverifiedCompanies.length,
    };
  }, [pendingUsers, unverifiedCompanies]);

  if (!user) return null;

  if (user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">This section is available for Admin accounts.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground">Verify suppliers and companies before they go live.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard interactive={false} className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">PENDING USERS</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{totals.pendingUsers}</p>
        </GlassCard>
        <GlassCard interactive={false} className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">UNVERIFIED COMPANIES</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{totals.unverifiedCompanies}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-0">
        <div className="border-b border-border p-5">
          <p className="text-sm font-semibold text-foreground">Pending user approvals</p>
          <p className="mt-1 text-xs text-muted-foreground">Companies and suppliers created via signup require verification.</p>
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
              {pendingUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No pending users.
                  </TableCell>
                </TableRow>
              ) : (
                pendingUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.joinDate}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => setPendingUsers((prev) => prev.filter((x) => x.id !== u.id))}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setPendingUsers((prev) => prev.filter((x) => x.id !== u.id))}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="border-b border-border p-5">
          <p className="text-sm font-semibold text-foreground">Company verification</p>
          <p className="mt-1 text-xs text-muted-foreground">Approve company profiles to enable verified browsing and matching.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unverifiedCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    All companies are verified.
                  </TableCell>
                </TableRow>
              ) : (
                unverifiedCompanies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.location}</TableCell>
                    <TableCell className={cn("font-medium", c.matchScore >= 85 ? "text-success" : "text-warning")}>
                      {c.matchScore}%
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.verified ? "verified" : "pending"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setUnverifiedCompanies((prev) => prev.filter((x) => x.id !== c.id))}>
                        Verify
                      </Button>
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
