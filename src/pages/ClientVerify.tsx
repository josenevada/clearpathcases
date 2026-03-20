import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { getClientSession, setClientSession } from '@/lib/auth';

const ClientVerify = () => {
  const { caseCode } = useParams<{ caseCode: string }>();
  const navigate = useNavigate();
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [caseId, setCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!caseCode) return;

    // Check for existing valid session
    const existingSession = getClientSession(caseCode);
    if (existingSession?.verified) {
      navigate(`/client-portal/${caseCode}/${existingSession.caseId}`, { replace: true });
      return;
    }

    // Verify case code exists
    const checkCase = async () => {
      const { data } = await supabase
        .from('cases')
        .select('id')
        .eq('case_code', caseCode)
        .maybeSingle();

      if (data) {
        setCaseId(data.id);
      }
      setLoading(false);
    };

    checkCase();
  }, [caseCode, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseCode || !dob) return;

    setError('');

    const { data } = await supabase
      .from('cases')
      .select('id, client_dob')
      .eq('case_code', caseCode)
      .maybeSingle();

    if (!data) {
      setError('Case not found. Please check your link.');
      return;
    }

    // Compare DOB
    if (data.client_dob === dob) {
      setClientSession(caseCode, data.id);
      navigate(`/client-portal/${caseCode}/${data.id}`, { replace: true });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setError('Please contact your attorney\'s office for help accessing your portal.');
      } else {
        setError('Date of birth does not match our records. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!caseId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <Logo size="lg" />
        <p className="text-muted-foreground mt-6 text-center">
          This link doesn't match any active case. Please check the link your attorney's office sent you.
        </p>
      </div>
    );
  }

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
          <h2 className="font-display font-bold text-xl text-foreground mt-6 mb-2">
            Welcome to your document portal
          </h2>
          <p className="text-muted-foreground font-body text-sm">
            To protect your information, please verify your date of birth.
          </p>
        </div>

        {attempts < 3 ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-sm">Date of Birth</Label>
              <Input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="mt-1 bg-input border-border rounded-[10px] h-11"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full h-11">
              Continue
            </Button>
          </form>
        ) : (
          <div className="surface-card p-6 text-center">
            <p className="text-foreground font-medium mb-2">
              Please contact your attorney's office for help accessing your portal.
            </p>
            <p className="text-sm text-muted-foreground">
              They can provide you with an updated link or verify your information.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ClientVerify;
