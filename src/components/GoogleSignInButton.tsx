import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335" />
  </svg>
);

interface GoogleSignInButtonProps {
  label?: string;
}

const GoogleSignInButton = ({ label = 'Continue with Google' }: GoogleSignInButtonProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error('Google sign-in failed. Please try again.');
        setLoading(false);
        return;
      }

      if (result.redirected) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('role, firm_id')
        .eq('email', session.user.email)
        .maybeSingle();

      if (existingUser?.firm_id) {
        if (existingUser.role === 'super_admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/paralegal');
        }
      } else {
        sessionStorage.setItem('google_oauth_user', JSON.stringify({
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
          userId: session.user.id,
        }));
        navigate('/signup?from=google');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
      className="w-full h-11 flex items-center justify-center gap-3 rounded-[10px] border border-foreground/[0.12] bg-background hover:bg-foreground/[0.04] transition-colors text-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <GoogleIcon />
      {loading ? 'Connecting…' : label}
    </button>
  );
};

export const OAuthDivider = () => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-border" />
    <span className="text-xs text-muted-foreground font-body uppercase tracking-wider">or</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export default GoogleSignInButton;
