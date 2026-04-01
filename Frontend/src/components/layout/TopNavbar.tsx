import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Bell, Moon, Sun, LogOut, Search } from "lucide-react";
import { useState } from "react";
import { mockNotifications } from "@/data/mockData";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/GlassCard";

export function TopNavbar() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showNotif, setShowNotif] = useState(false);
  const unread = mockNotifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/30 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <div className="relative hidden max-w-md flex-1 sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="h-9 bg-background/40 pl-9" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button onClick={toggleTheme} variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

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
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Button>
          <AnimatePresence>
            {showNotif && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                className="absolute right-0 top-11 z-50 w-80"
              >
                <GlassCard interactive={false} className="p-2">
                  <div className="mb-2 px-3 py-2 text-xs font-semibold text-muted-foreground">NOTIFICATIONS</div>
                  {mockNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent ${!n.read ? "bg-accent/50" : ""}`}
                    >
                      <p className="font-medium text-foreground">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-xs text-subtle">{n.time}</p>
                    </div>
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
          <Button
            onClick={logout}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
