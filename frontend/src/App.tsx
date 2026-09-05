import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/* ── Route-level code splitting — each page loads on demand ── */
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const SupplierAIChatPage = lazy(() => import("./pages/SupplierAIChatPage"));
const AdminAIChatPage = lazy(() => import("./pages/AdminAIChatPage"));
const ClientAIChatPage = lazy(() => import("./pages/ClientAIChatPage"));
const CompanyAIChatPage = lazy(() => import("./pages/CompanyAIChatPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const CompaniesPage = lazy(() => import("./pages/CompaniesPage"));
const CompanyProfilePage = lazy(() => import("./pages/CompanyProfilePage"));
const SupplierProfilePage = lazy(() => import("./pages/SupplierProfilePage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const AdminMessagesPage = lazy(() => import("./pages/AdminMessagesPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Page Error</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This page encountered an error. Other parts of the app still work.
            </p>
            <button
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <PageBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </PageBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
                <Route path="/companies" element={<LazyPage><CompaniesPage /></LazyPage>} />
                <Route path="/companies/:id" element={<LazyPage><CompanyProfilePage /></LazyPage>} />
                <Route path="/suppliers/:id" element={<LazyPage><SupplierProfilePage /></LazyPage>} />
                <Route path="/requests" element={<LazyPage><RequestsPage /></LazyPage>} />
                <Route path="/ai-chat" element={<LazyPage><AIChatPage /></LazyPage>} />
                <Route path="/supplier-ai" element={<LazyPage><SupplierAIChatPage /></LazyPage>} />
                <Route path="/admin-ai" element={<LazyPage><AdminAIChatPage /></LazyPage>} />
                <Route path="/client-ai" element={<LazyPage><ClientAIChatPage /></LazyPage>} />
                <Route path="/company-ai" element={<LazyPage><CompanyAIChatPage /></LazyPage>} />
                <Route path="/pricing" element={<LazyPage><PricingPage /></LazyPage>} />
                <Route path="/products" element={<LazyPage><InventoryPage /></LazyPage>} />
                <Route path="/users" element={<LazyPage><UsersPage /></LazyPage>} />
                <Route path="/approvals" element={<LazyPage><ApprovalsPage /></LazyPage>} />
                <Route path="/activity" element={<LazyPage><ActivityPage /></LazyPage>} />
                <Route path="/analytics" element={<LazyPage><AnalyticsPage /></LazyPage>} />
                <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />
                <Route path="/messages" element={<LazyPage><MessagesPage /></LazyPage>} />
                <Route path="/admin-messages" element={<LazyPage><AdminMessagesPage /></LazyPage>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
