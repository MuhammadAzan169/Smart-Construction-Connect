import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { useAuthStore } from "@/stores/authStore";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-4 max-w-md rounded-2xl border border-border bg-card p-8 text-center card-shadow"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Pending Approval</h2>
          <p className="mb-6 text-muted-foreground">
            Your {user.role} account is awaiting admin approval. You'll be notified once verified.
          </p>
          <button
            onClick={() => useAuthStore.getState().logout()}
            className="rounded-lg bg-secondary px-6 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
          >
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <TopNavbar />
        <main className="flex-1 overflow-auto p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
