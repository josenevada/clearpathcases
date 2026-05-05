import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { seedIfNeeded } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SubscriptionProvider } from "@/lib/subscription";

// Marketing landing kept eager — it's the LCP target on "/"
import MarketingLanding from "./pages/MarketingLanding";
import ScrollToTop from "./components/ScrollToTop";

// All other routes lazy-loaded to reduce initial JS / TBT
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ClientVerify = lazy(() => import("./pages/ClientVerify"));
const ClientWizard = lazy(() => import("./pages/ClientWizard"));
const ClientSign = lazy(() => import("./pages/ClientSign"));
const ParalegalDashboard = lazy(() => import("./pages/ParalegalDashboard"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const DocumentReviewQueue = lazy(() => import("./pages/DocumentReviewQueue"));
const FirmSettings = lazy(() => import("./pages/FirmSettings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Security = lazy(() => import("./pages/Security"));
const Packets = lazy(() => import("./pages/Packets"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const SmsConsent = lazy(() => import("./pages/SmsConsent"));
const SmsOptInPreview = lazy(() => import("./pages/SmsOptInPreview"));
const InviteSignup = lazy(() => import("./pages/InviteSignup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PlaidOAuthReturn = lazy(() => import("./pages/PlaidOAuthReturn"));
const PlaidOAuth = lazy(() => import("./pages/PlaidOAuth"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground font-body">Loading…</div>
  </div>
);

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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <SubscriptionProvider>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<MarketingLanding />} />
                <Route path="/security" element={<Security />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/sms-consent" element={<SmsConsent />} />
                <Route path="/sms-opt-in-preview" element={<SmsOptInPreview />} />
                <Route path="/portal" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/invite/:invitationId" element={<InviteSignup />} />

                {/* Client routes */}
                <Route path="/plaid-oauth" element={<PlaidOAuth />} />
                <Route path="/client" element={<PlaidOAuthReturn />} />
                <Route path="/client/:caseCode" element={<ClientVerify />} />
                <Route path="/client-portal/:caseCode/:caseId" element={<ClientWizard />} />
                <Route path="/sign/:token" element={<ClientSign />} />

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
                <Route path="/paralegal/review" element={
                  <ProtectedRoute>
                    <DocumentReviewQueue />
                  </ProtectedRoute>
                } />
                <Route path="/paralegal/settings" element={
                  <ProtectedRoute>
                    <FirmSettings />
                  </ProtectedRoute>
                } />
                <Route path="/paralegal/settings/:group/:page" element={
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
    </QueryClientProvider>
  );
};

export default App;
