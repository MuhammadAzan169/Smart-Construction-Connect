interface StatusBadgeProps {
  status: "active" | "pending" | "banned" | "completed" | "accepted" | "verified" | "rejected";
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success" },
  verified: { label: "Verified", className: "bg-success/10 text-success" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  accepted: { label: "Accepted", className: "bg-primary/10 text-primary" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  banned: { label: "Banned", className: "bg-destructive/10 text-destructive" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
