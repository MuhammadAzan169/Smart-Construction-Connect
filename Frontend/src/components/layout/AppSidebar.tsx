import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Building2, Users, Package, Bot,
  Settings, ChevronLeft, ChevronRight, Heart, FileText,
  BarChart3, ShieldCheck, Activity, HardHat,
} from "lucide-react";

const roleMenus: Record<UserRole, { label: string; icon: React.ElementType; path: string }[]> = {
  client: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Browse Companies", icon: Building2, path: "/companies" },
    { label: "AI Assistant", icon: Bot, path: "/ai-chat" },
    { label: "My Requests", icon: FileText, path: "/requests" },
    { label: "Saved", icon: Heart, path: "/saved" },
  ],
  company: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "Projects", icon: Building2, path: "/projects" },
    { label: "Analytics", icon: BarChart3, path: "/analytics" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ],
  supplier: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Products", icon: Package, path: "/products" },
    { label: "Orders", icon: FileText, path: "/orders" },
    { label: "Analytics", icon: BarChart3, path: "/analytics" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ],
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Users", icon: Users, path: "/users" },
    { label: "Companies", icon: Building2, path: "/companies" },
    { label: "Approvals", icon: ShieldCheck, path: "/approvals" },
    { label: "Activity", icon: Activity, path: "/activity" },
  ],
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;
  const items = roleMenus[user.role];

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2 }}
      className="relative flex flex-col border-r border-sidebar-border bg-sidebar"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-bg">
          <HardHat className="h-5 w-5 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap text-sm font-semibold text-sidebar-foreground"
            >
              Smart Connect
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/60 shadow-sm transition-colors hover:text-sidebar-foreground"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
}
