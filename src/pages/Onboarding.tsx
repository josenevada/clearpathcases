import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Onboarding = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      const { data: existing } = await supabase
        .from('users')
        .select('firm_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (existing?.firm_id) {
        navigate(existing.role === 'super_admin' ? '/admin/dashboard' : '/paralegal', { replace: true });
        return;
      }

      const meta = (user.user_metadata || {}) as Record<string, string>;
      setFullName(meta.full_name || meta.name || '');
      setEmail(user.email || '');
      setUserId(user.id);
      setChecking(false);
    })();
  }, [navigate]);

  const callProvision = async (payload: any, attempt = 0): Promise<Response> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/provision-workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok && attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
        return callProvision(payload, attempt + 1);
      }
      return res;
    } catch (err) {
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
        return callProvision(payload, attempt + 1);
      }
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !firmName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!userId) return;

    setLoading(true);
    try {
      const selectedPlan =
        sessionStorage.getItem('selected_plan') ||
        localStorage.getItem('selected_plan') ||
        'starter';

      const res = await callProvision({
        userId,
        firmName: firmName.trim(),
        fullName: fullName.trim(),
        email,
        planName: selectedPlan,
      });
      const data = await res.json();
      if (!res.ok || !data?.firmId) {
        throw new Error(data?.error || 'Failed to set up workspace');
      }

      sessionStorage.removeItem('selected_plan');
      localStorage.removeItem('selected_plan');
      window.location.replace('/paralegal');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set up workspace');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-body">Loading…</div>
      </div>
    );
  }

  const inputClasses = "border border-foreground/[0.12] bg-background focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <Logo size="md" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-lg mt-10"
      >
        <div className="space-y-4">
          <h2 className="font-display font-bold text-2xl text-foreground">
            Finish setting up your workspace
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            Just a couple details and you're in.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="font-body">Your Full Name</Label>
              <Input
                className={inputClasses}
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div>
              <Label className="font-body">Firm Name</Label>
              <Input
                className={inputClasses}
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="Smith & Associates"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Finishing…' : 'Finish Setup'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
