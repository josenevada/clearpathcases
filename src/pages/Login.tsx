import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import GoogleSignInButton, { OAuthDivider } from '@/components/GoogleSignInButton';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [loginError, setLoginError] = useState('');
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setVerified(true);
    }
    if (searchParams.get('expired') === 'true') {
      toast.error('Your session expired. Please sign in again.');
    }
    if (searchParams.get('resume') === 'onboarding') {
      toast.info('Sign in to finish setting up your workspace.');
    }
  }, [searchParams]);

  // Central redirect handler — fires when auth state confirms a valid session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user && !redirectingRef.current) {
          if (searchParams.get('resume') === 'onboarding') {
            redirectingRef.current = true;
            navigate('/signup?resume=onboarding', { replace: true });
            return;
          }

          // Skip redirect if user needs onboarding (Google OAuth new user)
          if (sessionStorage.getItem('google_oauth_needs_onboarding')) {
            return;
          }
          redirectingRef.current = true;
          // Use setTimeout to avoid Supabase deadlock on nested calls
          setTimeout(async () => {
            const { data: userData } = await supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();

            if (userData?.role === 'super_admin') {
              navigate('/admin/dashboard', { replace: true });
            } else {
              navigate('/paralegal', { replace: true });
            }
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  // If user is already authenticated (e.g. navigated back to /login), redirect
  useEffect(() => {
    if (user && !redirectingRef.current) {
      redirectingRef.current = true;
      if (searchParams.get('resume') === 'onboarding') {
        navigate('/signup?resume=onboarding', { replace: true });
      } else if (user.role === 'super_admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/paralegal', { replace: true });
      }
    }
  }, [user, navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setLoginError(signInError.message);
        setLoading(false);
        return;
      }

      // Do NOT redirect here — onAuthStateChange listener handles it
    } catch {
      setLoginError('Something went wrong — please try again.');
      setLoading(false);
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

        {verified && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-primary/10 border border-primary/20">
            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground font-body">
              Your email has been verified. Please sign in to continue.
            </p>
          </div>
        )}

        {!showForgot ? (
          <div>
            <GoogleSignInButton />
            <OAuthDivider />
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
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 bg-input border-border rounded-[10px] h-11 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {loginError && (
              <p className="text-sm text-destructive font-body">{loginError}</p>
            )}
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
          </div>
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
