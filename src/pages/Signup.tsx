import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STEPS = ['Create Account', 'Your Practice', 'First Case', 'All Set'];

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const handleCreateAccount = async () => {
    if (!fullName || !email || !password || !firmName) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authError) throw authError;

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const slug = firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const selectedPlan = sessionStorage.getItem('selected_plan') || 'starter';

      // Create firm
      const { data: firmData, error: firmError } = await supabase
        .from('firms')
        .insert({
          name: firmName,
          primary_contact_name: fullName,
          primary_contact_email: email,
          slug,
          subscription_status: 'trial',
          trial_ends_at: trialEndsAt,
          plan_name: selectedPlan,
        })
        .select()
        .single();
      if (firmError) throw firmError;
      setFirmId(firmData.id);

      // Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user?.id,
          email,
          full_name: fullName,
          role: 'paralegal',
          firm_id: firmData.id,
        });
      if (userError) throw userError;

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
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <Logo size="md" />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mt-8 mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= step ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">{s}</span>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h2 className="font-display font-bold text-2xl text-foreground">Create Your Account</h2>
              <div>
                <Label className="font-body">Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <Label className="font-body">Work Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@lawfirm.com" />
              </div>
              <div>
                <Label className="font-body">Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label className="font-body">Firm Name</Label>
                <Input value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Smith & Associates" />
              </div>
              <Button className="w-full" onClick={handleCreateAccount} disabled={loading}>
                {loading ? 'Creating…' : 'Create Account'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account? <a href="/login" className="text-primary hover:underline">Sign in</a>
              </p>
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
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h2 className="font-display font-bold text-2xl text-foreground">Create Your First Case</h2>
              <p className="text-sm text-muted-foreground font-body">Let's set up a real case so you can see how ClearPath works.</p>
              <div>
                <Label className="font-body">Client Name</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Maria Rodriguez" />
              </div>
              <div>
                <Label className="font-body">Client Email</Label>
                <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="maria@email.com" />
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
                <Input type="date" value={filingDeadline} onChange={e => setFilingDeadline(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreateCase} disabled={loading || !clientName || !clientEmail || !filingDeadline}>
                {loading ? 'Creating…' : 'Create Case & Continue'}
              </Button>
              <p className="text-sm text-muted-foreground text-center cursor-pointer hover:text-foreground" onClick={() => setStep(3)}>
                Skip for now
              </p>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
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

export default Signup;
