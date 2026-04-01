import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { mockNotifications } from "@/data/mockData";
import { useAuthStore } from "@/stores/authStore";
import { Bell } from "lucide-react";

export default function ActivityPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  if (user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">This section is available for Admin accounts.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity</h1>
        <p className="text-sm text-muted-foreground">Recent platform events and notifications.</p>
      </div>

      <div className="grid gap-4">
        {mockNotifications.map((n) => (
          <GlassCard key={n.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {n.read ? (
                      <Badge variant="outline" className="rounded-lg">
                        Read
                      </Badge>
                    ) : (
                      <Badge className="rounded-lg">New</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                </div>
              </div>
              <p className="whitespace-nowrap text-xs text-muted-foreground">{n.time}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
