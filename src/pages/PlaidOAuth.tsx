import { useEffect } from 'react';

const PlaidOAuth = () => {
  useEffect(() => {
    const saved = localStorage.getItem('plaid_oauth_case_code');
    const search = window.location.search; // preserves ?oauth_state_id=...

    let caseCode: string | null = null;
    let caseId: string | null = null;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        caseCode = parsed.caseCode || null;
        caseId = parsed.caseId || null;
      } catch {
        // Legacy format: plain string (treat as caseCode fallback)
        caseCode = saved;
      }
    }

    if (caseCode && caseId && search.includes('oauth_state_id')) {
      // Go straight back into the wizard so PlaidBankConnect can resume
      window.location.replace(`/client-portal/${caseCode}/${caseId}${search}`);
    } else if (caseCode && search.includes('oauth_state_id')) {
      window.location.replace(`/client/${caseCode}${search}`);
    } else {
      window.location.replace('/');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground font-body animate-pulse">
        Completing bank connection...
      </p>
    </div>
  );
};

export default PlaidOAuth;
