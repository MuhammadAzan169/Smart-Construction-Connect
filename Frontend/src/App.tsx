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

const queryClient = new QueryClient();

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompanyProfilePage />} />
            <Route path="/suppliers/:id" element={<SupplierProfilePage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/ai-chat" element={<AIChatPage />} />
            <Route path="/supplier-ai" element={<SupplierAIChatPage />} />
            <Route path="/admin-ai" element={<AdminAIChatPage />} />
            <Route path="/client-ai" element={<ClientAIChatPage />} />
            <Route path="/company-ai" element={<CompanyAIChatPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/plans" element={<SaaSPlansPage />} />
            <Route path="/products" element={<InventoryPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/admin-messages" element={<AdminMessagesPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
