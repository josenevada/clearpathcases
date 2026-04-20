// CLIENT FACING — no billing UI permitted
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { getClientSession, setClientSession } from '@/lib/auth';

const MIN_AGE = 18;
const MAX_AGE = 110;

const validateDob = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 'Please enter a valid date.';
  const year = parseInt(parts[0], 10);
  if (isNaN(year) || parts[0].length !== 4) return 'Please enter a 4-digit year.';
  const today = new Date();
  const birthDate = new Date(dateStr);
  if (isNaN(birthDate.getTime())) return 'Please enter a valid date.';
  const age = today.getFullYear() - birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
  if (age < MIN_AGE) return `You must be at least ${MIN_AGE} years old.`;
  if (age > MAX_AGE) return 'Please enter a valid birth year.';
  return null;
};

const ClientVerify = () => {
  const { caseCode } = useParams<{ caseCode: string }>();
  const navigate = useNavigate();
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dobError, setDobError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [isSpouseLink, setIsSpouseLink] = useState(false);

  useEffect(() => {
    if (!caseCode) return;

    const existingSession = getClientSession(caseCode);
    if (existingSession?.verified) {
      const suffix = isSpouseLink ? '?debtor=spouse' : '';
      navigate(`/client-portal/${caseCode}/${existingSession.caseId}${suffix}`, { replace: true });
      return;
    }

    const checkCase = async () => {
      console.log('[ClientVerify] Looking up caseCode:', caseCode);

      // Try primary case_code first
      const { data: primaryMatch } = await supabase
        .from('cases')
        .select('id')
        .eq('case_code', caseCode)
        .neq('status', 'closed')
        .maybeSingle();

      if (primaryMatch) {
        setCaseId(primaryMatch.id);
        setIsSpouseLink(false);
      } else {
        // Fall back to spouse_case_code
        const { data: spouseMatch } = await supabase
          .from('cases')
          .select('id')
          .eq('spouse_case_code', caseCode)
          .neq('status', 'closed')
          .maybeSingle();
        if (spouseMatch) {
          setCaseId(spouseMatch.id);
          setIsSpouseLink(true);
        }
      }
      setLoading(false);
    };

    checkCase();
  }, [caseCode, navigate, isSpouseLink]);

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDob(value);
    if (dobError) {
      const err = validateDob(value);
      setDobError(err);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseCode || !dob) return;

    const validationError = validateDob(dob);
    if (validationError) {
      setDobError(validationError);
      return;
    }
    setDobError(null);
    setError('');

    // Look up the row by either code; client_dob lives on cases, spouse_dob on client_info
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id, client_dob')
      .or(`case_code.eq.${caseCode},spouse_case_code.eq.${caseCode}`)
      .maybeSingle();

    if (!caseRow) {
      setError('Case not found. Please check your link.');
      return;
    }

    let expectedDob: string | null = caseRow.client_dob;
    if (isSpouseLink) {
      const { data: info } = await supabase
        .from('client_info')
        .select('spouse_dob')
        .eq('case_id', caseRow.id)
        .maybeSingle();
      expectedDob = info?.spouse_dob ?? null;
    }

    if (expectedDob === dob) {
      setClientSession(caseCode, caseRow.id);
      const suffix = isSpouseLink ? '?debtor=spouse' : '';
      navigate(`/client-portal/${caseCode}/${caseRow.id}${suffix}`, { replace: true });
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
        <Logo size="lg" clickable={false} />
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
          <Logo size="lg" clickable={false} />
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
                onChange={handleDobChange}
                max={new Date(new Date().getFullYear() - MIN_AGE, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
                min={new Date(new Date().getFullYear() - MAX_AGE, 0, 1).toISOString().split('T')[0]}
                className="mt-1 bg-input border-border rounded-[10px] h-11"
                required
              />
              {dobError && (
                <p className="text-sm text-destructive mt-1">{dobError}</p>
              )}
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
