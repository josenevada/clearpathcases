import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Lock, Shield, CheckCircle2, Loader2, UploadCloud, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface PlaidBankConnectProps {
  caseId: string;
  clientName: string;
  checklistItemId: string;
  onSuccess: (result: PlaidResult) => void;
  onManualUploadClick: () => void;
  manualUploadContent: React.ReactNode;
}

export interface PlaidResult {
  statementsRetrieved: number;
  accounts: Array<{ name: string; type: string; mask: string }>;
  institutionName: string;
}

type PlaidState = 'idle' | 'loading-token' | 'link-open' | 'exchanging' | 'success' | 'error' | 'disconnecting';

const PlaidBankConnect = ({
  caseId,
  clientName,
  checklistItemId,
  onSuccess,
  onManualUploadClick,
  manualUploadContent,
}: PlaidBankConnectProps) => {
  const [state, setState] = useState<PlaidState>('idle');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [result, setResult] = useState<PlaidResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    setState('exchanging');
    try {
      const res = await supabase.functions.invoke('plaid-exchange-token', {
        body: {
          public_token: publicToken,
          case_id: caseId,
          client_name: clientName,
          checklist_item_id: checklistItemId,
        },
      });

      if (res.error || !res.data?.success) {
        throw new Error(res.error?.message || res.data?.error || 'Exchange failed');
      }

      const plaidResult: PlaidResult = {
        statementsRetrieved: res.data.statements_retrieved,
        accounts: res.data.accounts,
        institutionName: res.data.institution_name,
      };

      setResult(plaidResult);
      setState('success');
      onSuccess(plaidResult);
    } catch (err: any) {
      console.error('Plaid exchange error:', err);
      setState('error');
      setErrorMsg("We couldn't connect to your bank automatically. Please upload your statements manually using the option below.");
      setShowManual(true);
    }
  }, [caseId, clientName, checklistItemId, onSuccess]);

  const handlePlaidExit = useCallback(() => {
    if (state === 'link-open') {
      setState('idle');
    }
  }, [state]);

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  });

  const handleConnectClick = async () => {
    setState('loading-token');
    setErrorMsg('');

    try {
      const res = await supabase.functions.invoke('plaid-create-link-token', {
        body: { case_id: caseId, client_name: clientName },
      });

      if (res.error || !res.data?.link_token) {
        throw new Error(res.error?.message || res.data?.error || 'Failed to initialize');
      }

      setLinkToken(res.data.link_token);
      // Need to wait for next render when token is set
      setTimeout(() => {
        setState('link-open');
      }, 100);
    } catch (err: any) {
      console.error('Link token error:', err);
      setState('error');
      setErrorMsg("We couldn't connect to your bank automatically. Please upload your statements manually using the option below.");
      setShowManual(true);
    }
  };

  // Open plaid link once token is ready
  if (state === 'link-open' && plaidReady && linkToken) {
    setTimeout(() => openPlaidLink(), 0);
  }

  const handleDisconnect = async () => {
    setState('disconnecting');
    try {
      await supabase.functions.invoke('plaid-disconnect', {
        body: { case_id: caseId, client_name: clientName },
      });
      setState('idle');
      setResult(null);
      setLinkToken(null);
    } catch {
      setState('success'); // keep showing success on disconnect failure
    }
  };

  // ─── SUCCESS STATE ─────────────────────────────────────────
  if (state === 'success' && result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="surface-card glow-success p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-foreground mb-1">
              Your bank statements have been retrieved
            </h3>
            <p className="text-muted-foreground">
              {result.statementsRetrieved} months of statements from {result.institutionName} retrieved successfully
            </p>
          </div>

          {/* Connected accounts summary */}
          <div className="space-y-2 text-left">
            {result.accounts.map((acct, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{acct.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{acct.type} · ····{acct.mask}</p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                  <Zap className="w-2.5 h-2.5 mr-0.5" /> Plaid Connected
                </Badge>
              </div>
            ))}
          </div>

          <button
            onClick={handleDisconnect}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={state === 'disconnecting'}
          >
            Disconnect Bank
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── LOADING / EXCHANGING STATE ─────────────────────────────
  if (state === 'exchanging') {
    return (
      <div className="surface-card p-8 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
        <div>
          <p className="text-foreground font-medium">Retrieving your statements</p>
          <p className="text-sm text-muted-foreground">This takes about 15 seconds…</p>
        </div>
      </div>
    );
  }

  // ─── IDLE / ERROR STATE — show both options ────────────────
  return (
    <div className="space-y-4">
      {/* Option 1: Connect automatically */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-bold text-foreground">Get your statements automatically</h3>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Connect your bank account and we'll retrieve the last 6 months of statements in seconds. No downloading required.
        </p>

        {/* Trust signals */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" /> Encrypted
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary" /> Read only
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> No login stored
          </span>
        </div>

        {state === 'error' && errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-warning leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <Button
          onClick={handleConnectClick}
          size="lg"
          className="w-full"
          disabled={state === 'loading-token' || state === 'link-open'}
        >
          {state === 'loading-token' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" /> Connect Bank Account
            </>
          )}
        </Button>
      </div>

      {/* Option 2: Upload manually */}
      <div className="rounded-xl border border-border p-5 space-y-3 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold text-foreground">Upload statements manually</h3>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
            Traditional method
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Download your statements from your bank's website and upload them here.
        </p>

        {(showManual || state === 'error') ? (
          <div className="pt-2">
            {manualUploadContent}
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => { setShowManual(true); onManualUploadClick(); }}
            className="w-full"
          >
            Upload Manually
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlaidBankConnect;
