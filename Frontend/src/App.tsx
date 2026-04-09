import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import AIChatPage from "./pages/AIChatPage";
import SupplierAIChatPage from "./pages/SupplierAIChatPage";
import AdminAIChatPage from "./pages/AdminAIChatPage";
import ClientAIChatPage from "./pages/ClientAIChatPage";
import CompanyAIChatPage from "./pages/CompanyAIChatPage";
import PricingPage from "./pages/PricingPage";
import SaaSPlansPage from "./pages/SaaSPlansPage";
import CompaniesPage from "./pages/CompaniesPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import RequestsPage from "./pages/RequestsPage";
import InventoryPage from "./pages/InventoryPage";
import UsersPage from "./pages/UsersPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import ActivityPage from "./pages/ActivityPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import MessagesPage from "./pages/MessagesPage";
import AdminMessagesPage from "./pages/AdminMessagesPage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { type ReactNode } from "react";

const queryClient = new QueryClient();

/** Page-level error boundary wrapper — catches crashes per-page without tearing down the app. */
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<PageBoundary><Dashboard /></PageBoundary>} />
            <Route path="/companies" element={<PageBoundary><CompaniesPage /></PageBoundary>} />
            <Route path="/companies/:id" element={<PageBoundary><CompanyProfilePage /></PageBoundary>} />
            <Route path="/suppliers/:id" element={<PageBoundary><SupplierProfilePage /></PageBoundary>} />
            <Route path="/requests" element={<PageBoundary><RequestsPage /></PageBoundary>} />
            <Route path="/ai-chat" element={<PageBoundary><AIChatPage /></PageBoundary>} />
            <Route path="/supplier-ai" element={<PageBoundary><SupplierAIChatPage /></PageBoundary>} />
            <Route path="/admin-ai" element={<PageBoundary><AdminAIChatPage /></PageBoundary>} />
            <Route path="/client-ai" element={<PageBoundary><ClientAIChatPage /></PageBoundary>} />
            <Route path="/company-ai" element={<PageBoundary><CompanyAIChatPage /></PageBoundary>} />
            <Route path="/pricing" element={<PageBoundary><PricingPage /></PageBoundary>} />
            <Route path="/plans" element={<PageBoundary><SaaSPlansPage /></PageBoundary>} />
            <Route path="/products" element={<PageBoundary><InventoryPage /></PageBoundary>} />
            <Route path="/users" element={<PageBoundary><UsersPage /></PageBoundary>} />
            <Route path="/approvals" element={<PageBoundary><ApprovalsPage /></PageBoundary>} />
            <Route path="/activity" element={<PageBoundary><ActivityPage /></PageBoundary>} />
            <Route path="/analytics" element={<PageBoundary><AnalyticsPage /></PageBoundary>} />
            <Route path="/settings" element={<PageBoundary><SettingsPage /></PageBoundary>} />
            <Route path="/messages" element={<PageBoundary><MessagesPage /></PageBoundary>} />
            <Route path="/admin-messages" element={<PageBoundary><AdminMessagesPage /></PageBoundary>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
