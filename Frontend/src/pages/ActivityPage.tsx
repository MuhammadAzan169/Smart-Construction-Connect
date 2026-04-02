import { useEffect, useState } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { Activity, Bot, Shield, CreditCard, UserPlus } from "lucide-react";

type LogEntry = {
  timestamp: string;
  action: string;
  target: string;
  details: string;
};

const actionIcons: Record<string, React.ElementType> = {
  user_signup: UserPlus,
  user_approved: Shield,
  user_active: Shield,
  user_banned: Shield,
  user_pending: Shield,
  ai_chat: Bot,
  ai_chat_summary: Bot,
  company_profile_updated: CreditCard,
  supplier_profile_updated: CreditCard,
  packages_updated: CreditCard,
  materials_updated: CreditCard,
  pricing_updated: CreditCard,
};

export default function ActivityPage() {
  const user = useAuthStore((s) => s.user);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getActivity().then(setLog).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin only.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Platform-wide activity and audit trail.</p>
      </div>

      <GlassCard interactive={false} className="p-6">
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : log.length === 0 ? (
          <p className="text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {log.map((entry, i) => {
              const Icon = actionIcons[entry.action] || Activity;
              const time = new Date(entry.timestamp).toLocaleString();
              return (
                <div key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-background/30 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{entry.details}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.target}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
