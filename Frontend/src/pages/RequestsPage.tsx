import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { mockRequests } from "@/data/mockData";
import { useAuthStore } from "@/stores/authStore";
import { Check, FileText, X } from "lucide-react";

type RequestStatus = (typeof mockRequests)[number]["status"] | "rejected";

export default function RequestsPage() {
  const user = useAuthStore((s) => s.user);
  const [requests, setRequests] = useState(() =>
    mockRequests.map((r) => ({ ...r, status: r.status as RequestStatus })),
  );

  const isCompany = user?.role === "company";
  const isClient = user?.role === "client";

  const title = isCompany ? "Incoming requests" : "My requests";
  const subtitle = isCompany
    ? "Review, accept, or reject new project inquiries."
    : "Track status and updates across your quote requests.";

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const accepted = requests.filter((r) => r.status === "accepted").length;
    const completed = requests.filter((r) => r.status === "completed").length;
    return { pending, accepted, completed };
  }, [requests]);

  const setStatus = (id: string, status: RequestStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  if (!user) return null;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <GlassCard interactive={false} className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-warning" />
            Pending: <span className="font-semibold text-foreground">{stats.pending}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Accepted: <span className="font-semibold text-foreground">{stats.accepted}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            Completed: <span className="font-semibold text-foreground">{stats.completed}</span>
          </div>
        </GlassCard>
      </motion.div>

      <div className="grid gap-4">
        {requests.map((req, idx) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.06, 0.4), duration: 0.3 }}
          >
          <GlassCard className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{req.project}</p>
                    <p className="truncate text-xs text-muted-foreground">{req.location}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Client</p>
                    <p className="text-sm text-foreground">{req.clientName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Budget</p>
                    <p className="text-sm text-foreground">{req.budget}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Date</p>
                    <p className="text-sm text-foreground">{req.date}</p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                {isCompany && req.status === "pending" ? (
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      className="flex-1 sm:flex-none"
                      onClick={() => setStatus(req.id, "accepted")}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      className="flex-1 sm:flex-none"
                      variant="destructive"
                      onClick={() => setStatus(req.id, "rejected")}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full sm:w-auto">
                    View details
                  </Button>
                )}

                {isClient && req.status === "accepted" && (
                  <p className="text-xs text-muted-foreground">Company accepted. Next: schedule a call.</p>
                )}
              </div>
            </div>
          </GlassCard>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
