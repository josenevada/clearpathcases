import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Logo from '@/components/Logo';
import FirmProfileTab from '@/components/settings/FirmProfileTab';
import DocumentTemplatesTab from '@/components/settings/DocumentTemplatesTab';
import IntakeQuestionsTab from '@/components/settings/IntakeQuestionsTab';
import BillingTab from '@/components/settings/BillingTab';
import TeamTab from '@/components/settings/TeamTab';
import DataRetentionTab from '@/components/settings/DataRetentionTab';
import SupportTab from '@/components/settings/SupportTab';
import WhiteLabelTab from '@/components/settings/WhiteLabelTab';
import BrandingTab from '@/components/settings/BrandingTab';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/lib/subscription';
import { useThemePreference } from '@/hooks/use-theme';

const FirmSettings = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'profile';
  const { refresh } = useSubscription();
  const { theme, setTheme } = useThemePreference();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('confirm-checkout-session', {
            body: { session_id: sessionId },
          });
          if (error) throw error;
          if (data?.confirmed) {
            toast.success('You are all set — welcome to ClearPath!');
            await refresh();
          }
        } catch {
          toast.error('Failed to confirm subscription');
        } finally {
          searchParams.delete('session_id');
          searchParams.delete('success');
          setSearchParams(searchParams, { replace: true });
        }
      })();
    } else if (searchParams.get('success') === 'true') {
      toast.success('You are all set. Welcome to ClearPath!');
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body hidden sm:block">Firm Settings</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/paralegal')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <h1 className="font-display font-bold text-2xl text-foreground mb-6">Firm Settings</h1>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="bg-secondary/50 border border-border mb-6">
              <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Firm Profile</TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Document Templates</TabsTrigger>
              <TabsTrigger value="questions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Intake Questions</TabsTrigger>
              <TabsTrigger value="display" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Display</TabsTrigger>
              <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Billing</TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Team</TabsTrigger>
              <TabsTrigger value="retention" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Data Retention</TabsTrigger>
              <TabsTrigger value="support" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Support</TabsTrigger>
              <TabsTrigger value="whitelabel" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">White Label</TabsTrigger>
              <TabsTrigger value="branding" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-body">Branding</TabsTrigger>
            </TabsList>
            <TabsContent value="profile"><FirmProfileTab /></TabsContent>
            <TabsContent value="templates"><DocumentTemplatesTab /></TabsContent>
            <TabsContent value="questions"><IntakeQuestionsTab /></TabsContent>
            <TabsContent value="display">
              <div className="space-y-6">
                <div>
                  <h2 className="font-display font-bold text-lg text-foreground mb-1">Display Preferences</h2>
                  <p className="text-sm text-muted-foreground font-body">Choose how ClearPath looks for your team and clients.</p>
                </div>
                <div className="surface-card p-5 space-y-4">
                  <h3 className="font-display font-bold text-foreground">Theme</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setTheme('dark'); toast.success('Switched to dark mode'); }}
                      className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <div className="text-left">
                        <span className="block text-sm font-bold font-body">Dark</span>
                        <span className="block text-xs text-muted-foreground">Professional, focused</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setTheme('light'); toast.success('Switched to light mode'); }}
                      className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
                        theme === 'light'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <div className="text-left">
                        <span className="block text-sm font-bold font-body">Light</span>
                        <span className="block text-xs text-muted-foreground">Clean, approachable</span>
                      </div>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-body">
                    This setting applies to both the staff dashboard and the client portal.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="billing"><BillingTab /></TabsContent>
            <TabsContent value="team"><TeamTab /></TabsContent>
            <TabsContent value="retention"><DataRetentionTab /></TabsContent>
            <TabsContent value="support"><SupportTab /></TabsContent>
            <TabsContent value="whitelabel"><WhiteLabelTab /></TabsContent>
            <TabsContent value="branding"><BrandingTab /></TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default FirmSettings;
