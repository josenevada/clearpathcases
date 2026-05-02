import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Eye, EyeOff, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import GoogleSignInButton, { OAuthDivider } from '@/components/GoogleSignInButton';
import { useAuth } from '@/lib/auth';

const STEPS = ['Create Account', 'All Set'];

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 0
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firmName, setFirmName] = useState('');

  const [firmId, setFirmId] = useState<string | null>(null);
  const isResumeOnboarding = searchParams.get('resume') === 'onboarding' && Boolean(session?.user) && !user;
  const onboardingSessionUser = isResumeOnboarding ? session?.user ?? null : null;

  useEffect(() => {
    if (!onboardingSessionUser) return;
    setFullName(onboardingSessionUser.user_metadata?.full_name || onboardingSessionUser.user_metadata?.name || '');
    setEmail(onboardingSessionUser.email || '');
  }, [onboardingSessionUser]);

  const provisionWorkspace = async ({
    userId: wsUserId,
    firmName: wsFirmName,
    fullName: wsFullName,
    email: wsEmail,
  }: {
    userId: string;
    firmName: string;
    fullName: string;
    email: string;
  }): Promise<string> => {
    const selectedPlan = sessionStorage.getItem('selected_plan') || 'starter';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const res = await fetch(`${supabaseUrl}/functions/v1/provision-workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: wsUserId,
        firmName: wsFirmName,
        fullName: wsFullName,
        email: wsEmail,
        planName: selectedPlan,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data?.firmId) {
      throw new Error(data?.error || 'Failed to set up workspace');
    }

    return data.firmId;
  };

  // Handle Google OAuth redirect — go directly to success screen
  useEffect(() => {
    if (searchParams.get('from') !== 'google') return;
    const raw = sessionStorage.getItem('google_oauth_user');
    if (!raw) return;

    const googleUser = JSON.parse(raw);
    sessionStorage.removeItem('google_oauth_user');

    (async () => {
      setLoading(true);
      try {
        const defaultFirmName = googleUser.email.split('@')[1]?.split('.')[0] || 'My Firm';
        setFullName(googleUser.fullName);
        setEmail(googleUser.email);
        setFirmName('');

        const resolvedFirmId = await provisionWorkspace({
          userId: googleUser.userId,
          firmName: defaultFirmName,
          fullName: googleUser.fullName,
          email: googleUser.email,
        });

        setFirmId(resolvedFirmId);
        sessionStorage.removeItem('selected_plan');
        setStep(1);
      } catch (err: any) {
        console.error('Google onboarding error:', err);
        toast.error(err.message || 'Failed to set up account');
        setStep(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  const handleCreateAccount = async () => {
    if (!fullName || !firmName || (!isResumeOnboarding && (!email || !password))) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isResumeOnboarding) {
        if (!onboardingSessionUser?.id || !email) {
          throw new Error('Please sign in again to finish setup.');
        }

        const resolvedFirmId = await provisionWorkspace({
          userId: onboardingSessionUser.id,
          firmName,
          fullName,
          email,
        });

        setFirmId(resolvedFirmId);
        sessionStorage.removeItem('selected_plan');
        setStep(1);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/login?verified=true`,
        },
      });
      if (authError) throw authError;

      const repeatedSignup = (authData.user?.identities ?? []).length === 0;
      if (repeatedSignup) {
        toast.error('This email already has an account. Sign in to finish setting up your workspace.');
        navigate(`/login?resume=onboarding&email=${encodeURIComponent(email)}`);
        return;
      }

      if (!authData.user?.id) {
        throw new Error('Failed to create account. Please try again.');
      }

      const resolvedFirmId = await provisionWorkspace({
        userId: authData.user.id,
        firmName,
        fullName,
        email,
      });

      setFirmId(resolvedFirmId);
      sessionStorage.removeItem('selected_plan');
      setStep(1);
    } catch (err: any) {
      await supabase.auth.signOut();
      toast.error(err.message || 'Account setup failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const inputClasses = "border border-foreground/[0.12] bg-background focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <Logo size="md" />

      {/* Step indicator */}
      <div className="mt-8 mb-10">
        <p className="text-sm text-muted-foreground font-body">
          Step <span className="text-foreground font-semibold">{step + 1}</span> of {STEPS.length} — <span className="text-foreground">{STEPS[step]}</span>
        </p>
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h2 className="font-display font-bold text-2xl text-foreground">
                {isResumeOnboarding ? 'Finish Setting Up Your Workspace' : 'Create Your Account'}
              </h2>
              {isResumeOnboarding && (
                <p className="text-sm text-muted-foreground font-body">
                  Your account already exists — finish the workspace setup and continue onboarding.
                </p>
              )}
              {!isResumeOnboarding && (
                <>
                  <GoogleSignInButton label="Continue with Google" />
                  <OAuthDivider />
                </>
              )}
              <div>
                <Label className="font-body">Full Name</Label>
                <Input className={inputClasses} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <Label className="font-body">Work Email</Label>
                <Input
                  className={`${inputClasses}${isResumeOnboarding ? ' opacity-60' : ''}`}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@lawfirm.com"
                  disabled={isResumeOnboarding}
                />
              </div>
              {!isResumeOnboarding && (
                <div>
                  <Label className="font-body">Password</Label>
                  <div className="relative">
                    <Input
                      className={`${inputClasses} pr-10`}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <Label className="font-body">Firm Name</Label>
                <Input className={inputClasses} value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Smith & Associates" />
              </div>
              <Button className="w-full" onClick={handleCreateAccount} disabled={loading}>
                {loading ? (isResumeOnboarding ? 'Finishing…' : 'Creating…') : (isResumeOnboarding ? 'Finish Setup' : 'Create Account')}
              </Button>
              {!isResumeOnboarding && (
                <p className="text-sm text-muted-foreground text-center">
                  Already have an account? <a href="/login" className="text-primary hover:underline">Sign in</a>
                </p>
              )}
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display font-bold text-2xl text-foreground">Your account is ready.</h2>
              <p className="text-[15px] text-muted-foreground font-body" style={{ lineHeight: '1.7' }}>
                Create your first case in 60 seconds — just enter your client's name and email and ClearPath handles the rest.
              </p>
              <div className="surface-card p-6 text-left space-y-3">
                <p className="text-sm text-muted-foreground font-body"><span className="text-foreground font-bold">1.</span> Create a case and copy the client portal link.</p>
                <p className="text-sm text-muted-foreground font-body"><span className="text-foreground font-bold">2.</span> Send the link — your client uploads everything from their phone.</p>
                <p className="text-sm text-muted-foreground font-body"><span className="text-foreground font-bold">3.</span> Open the case to find documents organized and ready to review.</p>
              </div>
              <Button size="lg" className="w-full landing-btn-glow" onClick={() => navigate('/paralegal')}>
                Go to Dashboard →
              </Button>
              <p className="text-sm text-muted-foreground font-body">
                Your 14-day free trial ends on {trialEndDate}. No credit card needed until then.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Signup;
