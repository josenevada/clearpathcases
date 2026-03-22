import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setVerified(true);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    // Fetch user role to determine redirect
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .maybeSingle();

    if (userData?.role === 'super_admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/paralegal');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset email sent. Check your inbox.');
      setShowForgot(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-muted-foreground mt-3 font-body">
            Sign in to manage your cases.
          </p>
        </div>

        {!showForgot ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-sm">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@firm.com"
                className="mt-1 bg-input border-border rounded-[10px] h-11"
                required
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 bg-input border-border rounded-[10px] h-11"
                required
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter your email and we'll send you a reset link.
            </p>
            <Input
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="you@firm.com"
              className="bg-input border-border rounded-[10px] h-11"
              required
            />
            <Button type="submit" className="w-full h-11">
              Send Reset Link
            </Button>
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
