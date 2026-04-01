import { Link, useLocation } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
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
  ShieldCheck,
  Users,
  LayoutDashboard,
  CreditCard,
  LogOut,
} from "lucide-react";

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
    { label: "Requests", icon: FileText, path: "/requests" },
    { label: "Packages & Pricing", icon: CreditCard, path: "/pricing" },
  ],
  supplier: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Inventory", icon: Package, path: "/products" },
    { label: "Pricing", icon: CreditCard, path: "/pricing" },
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
  const { user, logout } = useAuthStore();
  const location = useLocation();

  if (!user) return null;
  const items = roleMenus[user.role];

  return (
    <Sidebar variant="floating" collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Smart Construction Connect" className="h-11">
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <HardHat className="h-5 w-5" />
                </div>
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
              {items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.path}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={logout}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
