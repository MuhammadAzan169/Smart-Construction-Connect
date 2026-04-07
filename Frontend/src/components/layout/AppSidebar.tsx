import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  FileText,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  Users,
  LayoutDashboard,
  CreditCard,
  LogOut,
} from "lucide-react";
import { ConfirmModal } from "@/components/shared/AnimationPrimitives";

const roleMenus: Record<UserRole, { label: string; icon: React.ElementType; path: string }[]> = {
  client: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "AI Consultant", icon: Bot, path: "/client-ai" },
    { label: "Browse Companies", icon: Building2, path: "/companies" },
    { label: "Messages", icon: MessageSquare, path: "/messages" },
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ],
  company: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "AI Advisor", icon: Bot, path: "/company-ai" },
    { label: "Browse Suppliers", icon: Package, path: "/companies" },
    { label: "Messages", icon: MessageSquare, path: "/messages" },
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "Packages & Pricing", icon: CreditCard, path: "/pricing" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ],
  supplier: [
    { label: "Dashboard",    icon: LayoutDashboard, path: "/dashboard" },
    { label: "Inventory",    icon: Package,          path: "/products" },
    { label: "AI Analyst",   icon: Bot,              path: "/supplier-ai" },
    { label: "Messages",     icon: MessageSquare,    path: "/messages" },
    { label: "Requests",     icon: FileText,         path: "/requests" },
    { label: "Settings",     icon: Settings,         path: "/settings" },
  ],
  admin: [
    { label: "Dashboard",               icon: LayoutDashboard, path: "/dashboard" },
    { label: "AI Assistant",            icon: Bot,             path: "/admin-ai" },
    { label: "Users",                   icon: Users,           path: "/users" },
    { label: "Chat Oversight",          icon: MessageSquare,   path: "/admin-messages" },
    { label: "Companies",               icon: Building2,       path: "/companies?tab=companies" },
    { label: "Materials & Suppliers",   icon: Package,         path: "/companies?tab=materials" },
    { label: "Approvals",               icon: ShieldCheck,     path: "/approvals" },
    { label: "Activity",                icon: Activity,        path: "/activity" },
    { label: "Analytics",               icon: BarChart3,       path: "/analytics" },
    { label: "Settings",                icon: Settings,        path: "/settings" },
  ],
};

export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  if (!user) return null;
  const items = roleMenus[user.role];

  return (
    <>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r-0">
        <SidebarHeader className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Smart Construction Connect" className="h-14">
                <Link to="/dashboard" className="flex items-center gap-2">
                  <img
                    src="/Logo.png"
                    alt="Smart Construction Connect"
                    className="h-10 w-10 shrink-0 rounded-xl object-contain group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">Smart Construction Connect</span>
                    <span className="truncate text-xs text-muted-foreground">Construction SaaS</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item, i) => {
                  const [itemPath, itemQuery] = item.path.split("?");
                  const active =
                    location.pathname === itemPath &&
                    (!itemQuery || location.search === `?${itemQuery}`);
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.path}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="mb-2 rounded-2xl border border-sidebar-border bg-background/30 p-3">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{user.display_name || user.name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sign out" onClick={() => setShowLogout(true)}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

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
