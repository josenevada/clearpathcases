import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const InviteSignup = () => {
  const { invitationId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [firmName, setFirmName] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!invitationId || !token) {
        setError('This invitation link is invalid or missing its security token.');
        setLoading(false);
        return;
      }

      const { data: invRows, error: invErr } = await supabase
        .rpc('get_invitation_for_signup', { _invitation_id: invitationId, _token: token });

      const inv = Array.isArray(invRows) ? invRows[0] : invRows;
      if (invErr || !inv) {
        setError('This invitation could not be found or has already been accepted.');
        setLoading(false);
        return;
      }

      setInvitation(inv);
      if (inv.firm_name) setFirmName(inv.firm_name);
      setLoading(false);
    };

    fetchInvitation();
  }, [invitationId, token]);

  const handleSignup = async () => {
    if (!fullName || !password || !invitation) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      // Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: 'https://yourclearpath.app/login?verified=true',
        },
      });
      if (authError) throw authError;

      // Create user record linked to the inviting firm
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user?.id,
          email: invitation.email,
          full_name: fullName,
          role: invitation.role,
          firm_id: invitation.firm_id,
        });
      if (userError) throw userError;

      // Mark invitation as accepted via token-gated RPC
      await supabase.rpc('accept_team_invitation', {
        _invitation_id: invitation.id,
        _token: token,
      });

      toast.success('Account created! Please check your email to verify your account.');
      navigate('/login?verified=pending');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-body">Loading invitation…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <Logo size="md" />
        <div className="mt-8 surface-card p-8 max-w-md w-full text-center">
          <h2 className="font-display font-bold text-xl text-foreground mb-3">Invitation Not Available</h2>
          <p className="text-sm text-muted-foreground font-body mb-6">{error}</p>
          <Button variant="outline" onClick={() => navigate('/login')}>Go to Sign In</Button>
        </div>
      </div>
    );
  }

  const inputClasses = "border border-foreground/[0.12] bg-background focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <Logo size="md" />

      <div className="w-full max-w-md mt-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Invitation header */}
          <div className="surface-card p-5 border-l-4 border-primary text-center">
            <p className="text-sm text-muted-foreground font-body">
              <span className="text-foreground font-semibold">{firmName}</span> has invited you to join their ClearPath workspace as a{' '}
              <span className="text-foreground font-semibold capitalize">{invitation.role}</span>.
            </p>
            {invitation.invited_by && (
              <p className="text-xs text-muted-foreground font-body mt-2">Invited by {invitation.invited_by}</p>
            )}
          </div>

          <h2 className="font-display font-bold text-2xl text-foreground">Create Your Account</h2>

          <div>
            <Label className="font-body">Email</Label>
            <Input className={`${inputClasses} opacity-60`} value={invitation.email} disabled />
          </div>
          <div>
            <Label className="font-body">Full Name</Label>
            <Input className={inputClasses} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
          </div>
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

          <Button className="w-full" onClick={handleSignup} disabled={submitting}>
            {submitting ? 'Creating Account…' : 'Accept Invitation & Create Account'}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account? <a href="/login" className="text-primary hover:underline">Sign in</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default InviteSignup;
