import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Bell, Moon, Sun, LogOut, Search, ArrowLeft, Building2, Package } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/GlassCard";
import { ConfirmModal } from "@/components/shared/AnimationPrimitives";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export function TopNavbar() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();
  const location = useLocation();

  // Close search dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); setShowSearch(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await api.search(searchQuery.trim(), undefined, 8);
        setSearchResults(results);
        setShowSearch(true);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const requests = await api.requests.list();
      const items: Notification[] = requests.slice(0, 5).map((r) => ({
        id: r.id,
        title: r.status === "pending" ? "New Quote Request" : `Request ${r.status}`,
        message: `${r.client_name} — ${r.project_title}`,
        time: new Date(r.updated_at || r.created_at).toLocaleDateString(),
        read: r.status !== "pending",
      }));
      setNotifications(items);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unread = notifications.filter((n) => !n.read).length;
  const canGoBack = location.pathname !== "/dashboard";

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/30 px-4 backdrop-blur-xl sm:px-6"
      >
        <div className="flex flex-1 items-center gap-3">
          <SidebarTrigger className="md:hidden" />

          {canGoBack && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </motion.div>
          )}

          <div ref={searchRef} className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies & suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length) setShowSearch(true); }}
              className="h-9 bg-background/40 pl-9 transition-all focus:bg-background/60 focus:ring-1 focus:ring-primary/30"
            />
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-11 z-50 w-full"
                >
                  <GlassCard interactive={false} className="max-h-80 overflow-y-auto p-2">
                    {searchLoading && <p className="px-3 py-2 text-xs text-muted-foreground">Searching...</p>}
                    {!searchLoading && searchResults.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No results found</p>
                    )}
                    {searchResults.map((r, i) => (
                      <motion.button
                        key={String(r.slug ?? r.id ?? i)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => {
                          const route = r.type === "supplier" ? `/suppliers/${r.slug ?? r.id}` : `/companies/${r.slug ?? r.id}`;
                          navigate(route);
                          setShowSearch(false);
                          setSearchQuery("");
                        }}
                      >
                        {r.type === "supplier" ? <Package className="h-4 w-4 shrink-0 text-orange-500" /> : <Building2 className="h-4 w-4 shrink-0 text-primary" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{String(r.name ?? "")}</p>
                          <p className="truncate text-xs text-muted-foreground">{String(r.location ?? r.city ?? "")} {r.score != null ? `· ${Math.round(Number(r.score) * 100)}% match` : ""}</p>
                        </div>
                      </motion.button>
                    ))}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <motion.div whileTap={{ scale: 0.9, rotate: 15 }}>
            <Button onClick={toggleTheme} variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ opacity: 0, rotate: -90, scale: 0 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.div>
              </AnimatePresence>
            </Button>
          </motion.div>

          {/* Notifications */}
          <div className="relative">
            <Button
              onClick={() => setShowNotif(!showNotif)}
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-muted-foreground"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive"
                />
              )}
            </Button>
            <AnimatePresence>
              {showNotif && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="absolute right-0 top-11 z-50 w-80"
                >
                  <GlassCard interactive={false} className="p-2">
                    <div className="mb-2 px-3 py-2 text-xs font-semibold text-muted-foreground">NOTIFICATIONS</div>
                    {notifications.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent ${!n.read ? "bg-accent/50" : ""}`}
                      >
                        <p className="font-medium text-foreground">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-xs text-subtle">{n.time}</p>
                      </motion.div>
                    ))}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User */}
          <div className="ml-2 flex items-center gap-3 border-l border-border pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{user?.role}</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setShowLogout(true)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <ConfirmModal
        open={showLogout}
        onOpenChange={setShowLogout}
        title="Sign out?"
        description="You'll need to sign in again to access your workspace."
        confirmText="Sign out"
        variant="destructive"
        onConfirm={() => { logout(); navigate("/login"); }}
      />
    </>
  );
}
