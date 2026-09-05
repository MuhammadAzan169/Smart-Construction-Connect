import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import {
  Activity, ArrowLeft, Bot, Shield, CreditCard, UserPlus,
  Search, Filter, RefreshCw, Loader2, Building2, Package,
} from "lucide-react";

type LogEntry = {
  timestamp: string;
  action: string;
  target: string;
  details: string;
};

type EventEntry = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
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
  company_registered: Building2,
  supplier_registered: Package,
  packages_updated: CreditCard,
  materials_updated: CreditCard,
  pricing_updated: CreditCard,
};

const actionColors: Record<string, string> = {
  user_signup: "bg-blue-500/10 text-blue-500",
  user_approved: "bg-emerald-500/10 text-emerald-500",
  user_active: "bg-emerald-500/10 text-emerald-500",
  user_banned: "bg-destructive/10 text-destructive",
  ai_chat: "bg-violet-500/10 text-violet-500",
  ai_chat_summary: "bg-violet-500/10 text-violet-500",
  company_profile_updated: "bg-amber-500/10 text-amber-500",
  company_registered: "bg-primary/10 text-primary",
  supplier_registered: "bg-orange-500/10 text-orange-500",
};

export default function ActivityPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.admin.getActivity().then(setLog).catch(() => {}),
      api.events.log().then((d) => setEvents(d as unknown as EventEntry[])).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const actionTypes = useMemo(() => {
    const types = new Set(log.map((e) => e.action));
    return Array.from(types).sort();
  }, [log]);

  const filtered = useMemo(() => {
    let result = log;
    if (activeFilter) {
      result = result.filter((e) => e.action === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.details.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q),
      );
    }
    return result;
  }, [log, activeFilter, searchQuery]);

  if (!user || user.role !== "admin") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin only.</p>
      </GlassCard>
    );
  }

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
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
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
          <h1 className="text-2xl font-bold text-foreground">{t("activityPage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("activityPage.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 me-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </motion.div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={activeFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(null)}
          >
            <Filter className="h-3 w-3 me-1" /> All
          </Button>
          {actionTypes.slice(0, 6).map((type) => (
            <Button
              key={type}
              variant={activeFilter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(activeFilter === type ? null : type)}
            >
              {type.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlassCard interactive={false} className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{log.length}</p>
          <p className="text-xs text-muted-foreground">Total Entries</p>
        </GlassCard>
        <GlassCard interactive={false} className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{actionTypes.length}</p>
          <p className="text-xs text-muted-foreground">Action Types</p>
        </GlassCard>
        <GlassCard interactive={false} className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{events.length}</p>
          <p className="text-xs text-muted-foreground">Event Log</p>
        </GlassCard>
        <GlassCard interactive={false} className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Showing</p>
        </GlassCard>
      </div>

      {/* Activity List */}
      <GlassCard interactive={false} className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {log.length === 0 ? "No activity recorded yet." : "No entries match your filter."}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry, i) => {
              const Icon = actionIcons[entry.action] || Activity;
              const colorClass = actionColors[entry.action] || "bg-primary/10 text-primary";
              const time = new Date(entry.timestamp).toLocaleString();
              return (
                <motion.div
                  key={`${entry.timestamp}-${i}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.3 }}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-background/30 p-4 transition-colors hover:border-primary/20"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{entry.details}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.action.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.target}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{time}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
