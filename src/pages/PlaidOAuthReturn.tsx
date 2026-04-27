import { useEffect } from 'react';

const PlaidOAuthReturn = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStateId = params.get('oauth_state_id');
    const savedCaseCode = localStorage.getItem('plaid_oauth_case_code');
    if (oauthStateId && savedCaseCode) {
      window.location.replace(
        `/client/${savedCaseCode}${window.location.search}`
      );
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground font-body">Resuming bank connection…</div>
    </div>
  );
};

export default PlaidOAuthReturn;
