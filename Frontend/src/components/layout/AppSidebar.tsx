import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
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
  MessagesSquare,
  Package,
  Settings,
  ShieldCheck,
  Users,
  LayoutDashboard,
  CreditCard,
  LogOut,
} from "lucide-react";
import { ConfirmModal } from "@/components/shared/AnimationPrimitives";

const roleMenus: Record<UserRole, { labelKey: string; icon: React.ElementType; path: string }[]> = {
  client: [
    { labelKey: "sidebar.dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { labelKey: "sidebar.aiConsultant", icon: Bot, path: "/client-ai" },
    { labelKey: "sidebar.browseCompanies", icon: Building2, path: "/companies" },
    { labelKey: "sidebar.messages", icon: MessageSquare, path: "/messages" },
    { labelKey: "sidebar.requests", icon: FileText, path: "/requests" },
    { labelKey: "sidebar.settings", icon: Settings, path: "/settings" },
  ],
  company: [
    { labelKey: "sidebar.dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { labelKey: "sidebar.aiAdvisor", icon: Bot, path: "/company-ai" },
    { labelKey: "sidebar.browseSuppliers", icon: Package, path: "/companies" },
    { labelKey: "sidebar.messages", icon: MessageSquare, path: "/messages" },
    { labelKey: "sidebar.requests", icon: FileText, path: "/requests" },
    { labelKey: "sidebar.packagesAndPricing", icon: CreditCard, path: "/pricing" },
    { labelKey: "sidebar.settings", icon: Settings, path: "/settings" },
  ],
  supplier: [
    { labelKey: "sidebar.dashboard",    icon: LayoutDashboard, path: "/dashboard" },
    { labelKey: "sidebar.inventory",    icon: Package,          path: "/products" },
    { labelKey: "sidebar.aiAnalyst",   icon: Bot,              path: "/supplier-ai" },
    { labelKey: "sidebar.messages",     icon: MessageSquare,    path: "/messages" },
    { labelKey: "sidebar.requests",     icon: FileText,         path: "/requests" },
    { labelKey: "sidebar.plansAndPricing", icon: CreditCard,    path: "/plans" },
    { labelKey: "sidebar.settings",     icon: Settings,         path: "/settings" },
  ],
  admin: [
    { labelKey: "sidebar.dashboard",               icon: LayoutDashboard, path: "/dashboard" },
    { labelKey: "sidebar.aiAssistant",            icon: Bot,             path: "/admin-ai" },
    { labelKey: "sidebar.users",                   icon: Users,           path: "/users" },
    { labelKey: "sidebar.messages",               icon: MessageSquare,   path: "/messages" },
    { labelKey: "sidebar.chatOversight",          icon: MessagesSquare,  path: "/admin-messages" },
    { labelKey: "sidebar.companies",               icon: Building2,       path: "/companies?tab=companies" },
    { labelKey: "sidebar.materialsAndSuppliers",   icon: Package,         path: "/companies?tab=materials" },
    { labelKey: "sidebar.approvals",               icon: ShieldCheck,     path: "/approvals" },
    { labelKey: "sidebar.activity",                icon: Activity,        path: "/activity" },
    { labelKey: "sidebar.analytics",               icon: BarChart3,       path: "/analytics" },
    { labelKey: "sidebar.settings",                icon: Settings,        path: "/settings" },
  ],
};

export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const { t } = useTranslation();

  if (!user) return null;
  const items = roleMenus[user.role];

  return (
    <>
      <Sidebar variant="sidebar" collapsible="icon" className="border-e-0">
        <SidebarHeader className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t("common.appName")} className="h-14">
                <Link to="/dashboard" className="flex items-center gap-2">
                  <img
                    src="/Logo.png"
                    alt={t("common.appName")}
                    className="h-10 w-10 shrink-0 rounded-xl object-contain group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{t("common.appName")}</span>
                    <span className="truncate text-xs text-muted-foreground">{t("common.tagline")}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.workspace")}</SidebarGroupLabel>
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
                        <SidebarMenuButton asChild isActive={active} tooltip={t(item.labelKey)}>
                          <Link to={item.path}>
                            <item.icon />
                            <span>{t(item.labelKey)}</span>
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
              <SidebarMenuButton tooltip={t("common.signOut")} onClick={() => setShowLogout(true)}>
                <LogOut />
                <span>{t("common.signOut")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

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
