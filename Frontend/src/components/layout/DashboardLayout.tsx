import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { useAuthStore } from "@/stores/authStore";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { AnimatedBackground } from "@/components/shared/AnimatedBackground";
import { useTranslation } from "react-i18next";

export function DashboardLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === "pending") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <AnimatedBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative z-10 mx-4 w-full max-w-md"
        >
          <GlassCard interactive={false} className="p-8 text-center">
            <motion.div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10"
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-3xl">⏳</span>
            </motion.div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">{t("auth.pendingApproval")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("auth.pendingApprovalDesc", { role: user.role })}
            </p>
            <Button variant="secondary" onClick={logout}>
              {t("common.signOut")}
            </Button>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="relative bg-background border-s border-border">
        <TopNavbar />
        <main className="relative flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
