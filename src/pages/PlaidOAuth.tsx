import { useEffect } from 'react';

const PlaidOAuth = () => {
  useEffect(() => {
    const savedCaseCode = localStorage.getItem('plaid_oauth_case_code');
    const search = window.location.search; // preserves ?oauth_state_id=...

    if (savedCaseCode) {
      window.location.replace(`/client/${savedCaseCode}${search}`);
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
