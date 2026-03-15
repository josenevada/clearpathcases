import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { seedIfNeeded } from "@/lib/store";
import Landing from "./pages/Landing";
import ClientWizard from "./pages/ClientWizard";
import ParalegalDashboard from "./pages/ParalegalDashboard";
import CaseDetail from "./pages/CaseDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/client/:caseId" element={<ClientWizard />} />
            <Route path="/paralegal" element={<ParalegalDashboard />} />
            <Route path="/paralegal/case/:caseId" element={<CaseDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
