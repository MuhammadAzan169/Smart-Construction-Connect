import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { useAuthStore } from "@/stores/authStore";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";

export function DashboardLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-4 w-full max-w-md"
        >
          <GlassCard interactive={false} className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10">
              <span className="text-3xl">⏳</span>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">Pending approval</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Your {user.role} account is awaiting admin verification. You’ll be notified once access is granted.
            </p>
            <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <TopNavbar />
        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
