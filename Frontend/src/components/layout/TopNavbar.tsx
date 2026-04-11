import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useLanguageStore } from "@/stores/languageStore";
import { Bell, Moon, Sun, LogOut, Search, ArrowLeft, Building2, Package, Languages, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/GlassCard";
import { ConfirmModal } from "@/components/shared/AnimationPrimitives";
import { useTranslation } from "react-i18next";

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
  const { language, toggleLanguage } = useLanguageStore();
  const { t } = useTranslation();
  const [showNotif, setShowNotif] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
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

  // Close notification panel on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
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
        title: r.status === "pending" ? t("nav.newQuoteRequest") : t("nav.requestStatus", { status: r.status }),
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
          <SidebarTrigger className="lg:hidden" />

          {canGoBack && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                aria-label={t("common.back")}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("common.back")}</span>
              </Button>
            </motion.div>
          )}

          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground sm:hidden"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          <div ref={searchRef} className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("nav.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length) setShowSearch(true); }}
              className="h-9 bg-background/40 ps-9 transition-all focus:bg-background/60 focus:ring-1 focus:ring-primary/30"
            />
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute start-0 top-11 z-50 w-full"
                >
                  <GlassCard interactive={false} className="max-h-80 overflow-y-auto p-2">
                    {searchLoading && <p className="px-3 py-2 text-xs text-muted-foreground" role="status">{t("nav.searching")}</p>}
                    {!searchLoading && searchResults.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">{t("common.noResults")}</p>
                    )}
                    <ul role="listbox" className="list-none p-0 m-0">
                    {searchResults.map((r, i) => (
                      <li key={String(r.slug ?? r.id ?? i)} role="option">
                        <motion.button
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors hover:bg-accent"
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
                      </li>
                    ))}
                    </ul>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <motion.div whileTap={{ scale: 0.9, rotate: 15 }}>
            <Button onClick={toggleTheme} variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" aria-label={t("nav.themeToggle")}>
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

          {/* Language toggle */}
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button onClick={toggleLanguage} variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" aria-label={t("nav.languageToggle")}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={language}
                  initial={{ opacity: 0, y: -8, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center"
                >
                  {language === "en" ? (
                    <span className="text-xs font-bold leading-none">اردو</span>
                  ) : (
                    <Languages className="h-4 w-4" />
                  )}
                </motion.div>
              </AnimatePresence>
            </Button>
          </motion.div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <Button
              onClick={() => setShowNotif(!showNotif)}
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 text-muted-foreground"
              aria-label={`${t("nav.notifications")}${unread > 0 ? ` (${unread})` : ""}`}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute end-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background"
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
                  className="absolute end-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-2 border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-border bg-secondary/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{t("nav.notifications")}</span>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNotif(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      aria-label="Close notifications"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="max-h-72 overflow-y-auto scroll-styled">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary border border-border">
                          <Bell className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">No notifications</p>
                          <p className="text-xs text-muted-foreground mt-0.5">You're all caught up!</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 space-y-0.5">
                        {notifications.map((n, i) => (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary cursor-pointer ${
                              !n.read ? "bg-primary/10 border border-primary/20" : "bg-secondary/40 border border-transparent"
                            }`}
                          >
                            <div className="mt-1.5 shrink-0">
                              {!n.read
                                ? <span className="block h-2 w-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
                                : <span className="block h-2 w-2 rounded-full bg-border" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-snug truncate">{n.message}</p>
                              <p className="mt-1.5 text-[10px] text-muted-foreground/70 font-medium">{n.time}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="flex items-center justify-between border-t-2 border-border bg-secondary/60 px-4 py-2.5">
                      <span className="text-[11px] text-muted-foreground">
                        {unread > 0 ? `${unread} unread` : "All read"}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-primary hover:underline transition-colors"
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                      >
                        Mark all read
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User */}
          <div className="ms-2 flex items-center gap-3 border-s border-border ps-4">
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
                className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Mobile search bar */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky top-16 z-30 overflow-hidden border-b border-border bg-background/80 backdrop-blur-xl sm:hidden"
          >
            <div className="relative px-4 py-2">
              <Search className="absolute start-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("nav.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length) setShowSearch(true); }}
                className="h-10 bg-background/40 ps-9 transition-all focus:bg-background/60 focus:ring-1 focus:ring-primary/30"
              />
              {showSearch && searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-border bg-card p-2">
                  {searchResults.map((r: Record<string, unknown>, i: number) => (
                    <button
                      key={i}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors hover:bg-accent"
                      onClick={() => {
                        navigate(r.type === "supplier" ? `/suppliers/${r.id}` : `/companies/${r.id}`);
                        setShowSearch(false);
                        setShowMobileSearch(false);
                        setSearchQuery("");
                      }}
                    >
                      {r.type === "supplier" ? <Package className="h-4 w-4 shrink-0 text-orange-500" /> : <Building2 className="h-4 w-4 shrink-0 text-primary" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{String(r.name ?? "")}</p>
                        <p className="truncate text-xs text-muted-foreground">{String(r.location ?? r.city ?? "")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={showLogout}
        onOpenChange={setShowLogout}
        title={t("auth.signOutConfirm")}
        description={t("auth.signOutDesc")}
        confirmText={t("common.signOut")}
        variant="destructive"
        onConfirm={() => { logout(); navigate("/login"); }}
      />
    </>
  );
}
