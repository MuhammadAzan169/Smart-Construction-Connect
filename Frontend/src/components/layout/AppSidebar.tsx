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
  Bot,
  Building2,
  FileText,
  HardHat,
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
    { label: "Browse Companies", icon: Building2, path: "/companies" },
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "AI Assistant", icon: Bot, path: "/ai-chat" },
    { label: "Pricing", icon: CreditCard, path: "/pricing" },
  ],
  company: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Browse Suppliers", icon: Package, path: "/companies" },
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "Packages & Pricing", icon: CreditCard, path: "/pricing" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ],
  supplier: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Browse Companies", icon: Building2, path: "/companies" },
    { label: "Inventory", icon: Package, path: "/products" },
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ],
  admin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Users", icon: Users, path: "/users" },
    { label: "Companies", icon: Building2, path: "/companies?tab=companies" },
    { label: "Materials & Suppliers", icon: Package, path: "/companies?tab=materials" },
    { label: "Approvals", icon: ShieldCheck, path: "/approvals" },
    { label: "Activity", icon: Activity, path: "/activity" },
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
      <Sidebar variant="floating" collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Smart Construction Connect" className="h-11">
                <Link to="/dashboard" className="flex items-center gap-3">
                  <motion.div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
                    whileHover={{ scale: 1.05, rotate: 4 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <HardHat className="h-5 w-5" />
                  </motion.div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">Smart Connect</span>
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
