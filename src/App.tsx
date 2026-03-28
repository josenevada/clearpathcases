import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { seedIfNeeded } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SubscriptionProvider } from "@/lib/subscription";
import { ThemeProvider } from "@/hooks/use-theme";
import MarketingLanding from "./pages/MarketingLanding";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import ClientVerify from "./pages/ClientVerify";
import ClientWizard from "./pages/ClientWizard";
import ParalegalDashboard from "./pages/ParalegalDashboard";
import CaseDetail from "./pages/CaseDetail";
import FirmSettings from "./pages/FirmSettings";
import AdminDashboard from "./pages/AdminDashboard";
import Security from "./pages/Security";
import Packets from "./pages/Packets";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import InviteSignup from "./pages/InviteSignup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-body">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    seedIfNeeded();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <Routes>
                <Route path="/" element={<MarketingLanding />} />
                <Route path="/security" element={<Security />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/portal" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/invite/:invitationId" element={<InviteSignup />} />

                {/* Client routes */}
                <Route path="/client/:caseCode" element={<ClientVerify />} />
                <Route path="/client-portal/:caseCode/:caseId" element={<ClientWizard />} />

                {/* Protected firm staff routes */}
                <Route path="/paralegal" element={
                  <ProtectedRoute>
                    <ParalegalDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/paralegal/case/:caseId" element={
                  <ProtectedRoute>
                    <CaseDetail />
                  </ProtectedRoute>
                } />
                <Route path="/paralegal/settings" element={
                  <ProtectedRoute>
                    <FirmSettings />
                  </ProtectedRoute>
                } />
                <Route path="/paralegal/packets" element={
                  <ProtectedRoute>
                    <Packets />
                  </ProtectedRoute>
                } />

                {/* Super admin route */}
                <Route path="/admin/dashboard" element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
