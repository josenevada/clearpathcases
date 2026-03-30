import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Eye, EyeOff, Send, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import GoogleSignInButton, { OAuthDivider } from '@/components/GoogleSignInButton';
import { useAuth } from '@/lib/auth';

import OnboardingChecklistConfig from '@/components/onboarding/OnboardingChecklistConfig';

const STEPS = ['Create Account', 'Your Practice', 'Configure Checklist', 'First Case', 'Invite Your Team', 'All Set'];

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firmName, setFirmName] = useState('');

  // Step 2
  const [caseVolume, setCaseVolume] = useState('');
  const [chapterFocus, setChapterFocus] = useState('');

  // Step 3
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [chapterType, setChapterType] = useState<'7' | '13'>('7');
  const [filingDeadline, setFilingDeadline] = useState('');

  const [firmId, setFirmId] = useState<string | null>(null);
  const isResumeOnboarding = searchParams.get('resume') === 'onboarding' && Boolean(session?.user) && !user;
  const onboardingSessionUser = isResumeOnboarding ? session?.user ?? null : null;

  useEffect(() => {
    if (!onboardingSessionUser) return;
    setFullName(onboardingSessionUser.user_metadata?.full_name || onboardingSessionUser.user_metadata?.name || '');
    setEmail(onboardingSessionUser.email || '');
  }, [onboardingSessionUser]);

  const provisionWorkspace = async ({
    firmName: wsFirmName,
    fullName: wsFullName,
    email: wsEmail,
  }: {
    firmName: string;
    fullName: string;
    email: string;
  }): Promise<string> => {
    const selectedPlan = sessionStorage.getItem('selected_plan') || 'starter';

    const { data, error } = await supabase.functions.invoke('provision-workspace', {
      body: {
        firmName: wsFirmName,
        fullName: wsFullName,
        email: wsEmail,
        planName: selectedPlan,
      },
    });

    if (error || !data?.firmId) {
      const msg = data?.error || error?.message || 'Failed to set up workspace';
      throw new Error(msg);
    }

    return data.firmId;
  };

  // Handle Google OAuth redirect — skip to step 1 (Your Practice) since account is already created
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
        accountUserId: authData.user.id,
        accountEmail: email,
        accountName: fullName,
        workspaceName: firmName,
      });

      setFirmId(resolvedFirmId);
      sessionStorage.removeItem('selected_plan');
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async () => {
    if (!clientName || !clientEmail || !filingDeadline || !firmId) return;
    setLoading(true);
    try {
      const caseCode = `${clientName.split(' ')[0]?.charAt(0) || ''}${clientName.split(' ').pop() || ''}-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const { error } = await supabase.from('cases').insert({
        firm_id: firmId,
        client_name: clientName,
        client_email: clientEmail,
        chapter_type: chapterType,
        filing_deadline: filingDeadline,
        case_code: caseCode,
        urgency: 'normal',
      });
      if (error) throw error;
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create case');
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
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h2 className="font-display font-bold text-2xl text-foreground">Tell Us About Your Practice</h2>
              <div>
                <Label className="font-body mb-3 block">How many bankruptcy cases per month?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['1–5', '6–15', '16–30', '30+'].map(v => (
                    <button key={v} onClick={() => setCaseVolume(v)}
                      className={`surface-card p-4 text-center font-body text-sm cursor-pointer transition-colors ${caseVolume === v ? 'border-primary/50 bg-primary/5 text-foreground' : 'text-muted-foreground'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="font-body mb-3 block">Primary chapter types?</Label>
                <div className="grid grid-cols-3 gap-3">
                  {['Mostly Chapter 7', 'Mostly Chapter 13', 'Both equally'].map(v => (
                    <button key={v} onClick={() => setChapterFocus(v)}
                      className={`surface-card p-4 text-center font-body text-sm cursor-pointer transition-colors ${chapterFocus === v ? 'border-primary/50 bg-primary/5 text-foreground' : 'text-muted-foreground'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep(2)}>Next</Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <OnboardingChecklistConfig onNext={() => setStep(3)} onSkip={() => setStep(3)} />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h2 className="font-display font-bold text-2xl text-foreground">Create your first case</h2>
              <p className="text-sm text-muted-foreground font-body">Set up a real client case to see how ClearPath works.</p>
              <div>
                <Label className="font-body">Client Name</Label>
                <Input className={inputClasses} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label className="font-body">Client Email</Label>
                <Input className={inputClasses} type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" />
              </div>
              <div>
                <Label className="font-body">Chapter Type</Label>
                <div className="flex gap-3 mt-1">
                  {(['7', '13'] as const).map(ch => (
                    <button key={ch} onClick={() => setChapterType(ch)}
                      className={`surface-card px-6 py-3 font-body text-sm cursor-pointer ${chapterType === ch ? 'border-primary/50 bg-primary/5 text-foreground' : 'text-muted-foreground'}`}>
                      Chapter {ch}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="font-body">Filing Deadline</Label>
                <Input className={inputClasses} type="date" value={filingDeadline} onChange={e => setFilingDeadline(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreateCase} disabled={loading || !clientName || !clientEmail || !filingDeadline}>
                {loading ? 'Creating…' : 'Create Case & Continue'}
              </Button>
              <p className="text-sm text-muted-foreground text-center cursor-pointer hover:text-foreground" onClick={() => setStep(4)}>
                Skip for now
              </p>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-2xl text-foreground">Invite Your Team</h2>
                  <p className="text-sm text-muted-foreground font-body">Add a paralegal or attorney to your workspace.</p>
                </div>
              </div>
              <InviteTeamForm firmId={firmId} onDone={() => setStep(5)} />
              <p className="text-sm text-muted-foreground text-center cursor-pointer hover:text-foreground" onClick={() => setStep(5)}>
                Skip for now
              </p>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display font-bold text-2xl text-foreground">Your ClearPath account is ready</h2>
              <div className="surface-card p-6 text-left space-y-3">
                <p className="text-sm text-muted-foreground font-body"><span className="text-foreground font-bold">1.</span> Create a case and copy the client portal link.</p>
                <p className="text-sm text-muted-foreground font-body"><span className="text-foreground font-bold">2.</span> Send the link to your client so they can start uploading.</p>
                <p className="text-sm text-muted-foreground font-body"><span className="text-foreground font-bold">3.</span> Review documents as they come in and request corrections if needed.</p>
              </div>
              <Button size="lg" onClick={() => navigate('/paralegal')}>Go to Dashboard</Button>
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

/* Inline invite form used in onboarding step 3 */
const InviteTeamForm = ({ firmId, onDone }: { firmId: string | null; onDone: () => void }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('paralegal');
  const [message, setMessage] = useState('Welcome to our ClearPath workspace. Please create your account to get started.');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email || !firmId) return;
    setSending(true);
    try {
      // Get firm name
      const { data: firm } = await supabase.from('firms').select('name').eq('id', firmId).single();

      const { data: invite, error: insertError } = await supabase
        .from('team_invitations')
        .insert({ firm_id: firmId, email, role, invited_by: 'Account owner', personal_message: message })
        .select()
        .single();
      if (insertError) throw insertError;

      await supabase.functions.invoke('send-invitation', {
        body: {
          invitationId: invite.id,
          firmName: firm?.name || 'Your firm',
          inviterName: 'Account owner',
          recipientEmail: email,
          role,
          personalMessage: message,
        },
      });

      toast.success(`Invitation sent to ${email}`);
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="surface-card p-5 text-center space-y-3">
        <Check className="w-6 h-6 text-primary mx-auto" />
        <p className="text-sm text-foreground font-body">Invitation sent to <span className="font-semibold">{email}</span></p>
        <Button variant="outline" size="sm" onClick={() => { setSent(false); setEmail(''); }}>Invite Another</Button>
        <div>
          <Button onClick={onDone} className="mt-2">Continue</Button>
        </div>
      </div>
    );
  }

  const inputClasses = "border border-foreground/[0.12] bg-background focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="surface-card p-5 space-y-4">
      <div>
        <Label className="font-body">Email Address</Label>
        <Input type="email" className={inputClasses} value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@lawfirm.com" />
      </div>
      <div>
        <Label className="font-body">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className={inputClasses}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paralegal">Paralegal</SelectItem>
            <SelectItem value="attorney">Attorney</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="font-body">Personal Message (optional)</Label>
        <Textarea className={`${inputClasses} font-body text-sm`} value={message} onChange={e => setMessage(e.target.value)} rows={2} />
      </div>
      <Button onClick={handleSend} disabled={sending || !email} className="w-full">
        <Send className="w-4 h-4 mr-2" />
        {sending ? 'Sending…' : 'Send Invitation'}
      </Button>
    </div>
  );
};

export default Signup;
