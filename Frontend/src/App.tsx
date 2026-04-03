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
import PricingPage from "./pages/PricingPage";
import CompaniesPage from "./pages/CompaniesPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import RequestsPage from "./pages/RequestsPage";
import InventoryPage from "./pages/InventoryPage";
import UsersPage from "./pages/UsersPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import ActivityPage from "./pages/ActivityPage";
import SettingsPage from "./pages/SettingsPage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/products" element={<InventoryPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
