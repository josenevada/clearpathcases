import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, FileText, Eye, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';

type Step = 'loading' | 'verify' | 'review' | 'sign' | 'success' | 'expired' | 'error';
type SignMethod = 'draw' | 'type';

const ClientSign = () => {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [request, setRequest] = useState<any>(null);
  const [dobInput, setDobInput] = useState('');
  const [dobAttempts, setDobAttempts] = useState(0);
  const [dobError, setDobError] = useState('');
  const [reviewChecked, setReviewChecked] = useState(false);
  const [signMethod, setSignMethod] = useState<SignMethod>('type');
  const [typedName, setTypedName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Load signing request
  useEffect(() => {
    if (!token) { setStep('error'); return; }
    const loadRequest = async () => {
      const { data: rows, error } = await supabase
        .rpc('get_signature_request_by_token', { _token: token });

      const data = Array.isArray(rows) ? rows[0] : rows;
      if (error || !data) { setStep('expired'); return; }

      if (new Date(data.token_expires_at) < new Date()) {
        setStep('expired'); return;
      }

      // Normalize to the shape the rest of this component expects
      const normalized = {
        id: data.id,
        case_id: data.case_id,
        client_name: data.signer_name,
        client_token_expires_at: data.token_expires_at,
        client_signed_at: data.signed_at,
      };

      if (data.signed_at) {
        setStep('success'); setRequest(normalized); return;
      }

      setRequest(normalized);
      setStep('verify');

      // Log view event
      try {
        await supabase.from('signature_audit_log').insert({
          signature_request_id: data.id,
          event_type: 'client_viewed',
          actor_type: 'client',
          actor_name: data.signer_name,
          metadata: { user_agent: navigator.userAgent },
        });
      } catch { /* optional */ }
    };
    loadRequest();
  }, [token]);

  // Canvas drawing setup
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (step === 'sign' && signMethod === 'draw') {
      setTimeout(initCanvas, 100);
    }
  }, [step, signMethod, initCanvas]);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent) => {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawing.current = false;
    if (canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    initCanvas();
    setSignatureDataUrl('');
  };

  // DOB verification
  const handleVerify = async () => {
    if (dobAttempts >= 3) {
      setDobError('Maximum verification attempts reached. Please contact your attorney.');
      return;
    }

    // Fetch client DOB from client_info
    const { data: ci } = await supabase
      .from('client_info')
      .select('date_of_birth')
      .eq('case_id', request.case_id)
      .maybeSingle();

    if (!ci?.date_of_birth) {
      // If no DOB on file, skip verification
      setStep('review');
      return;
    }

    // Compare DOB (normalize format)
    const [iy, im, id] = dobInput.split('-').map(Number);
    const inputDate = new Date(iy, im - 1, id);
    const [sy, sm, sd] = ci.date_of_birth.split('-').map(Number);
    const storedDate = new Date(sy, sm - 1, sd);
    
    if (inputDate.getFullYear() === storedDate.getFullYear() &&
        inputDate.getMonth() === storedDate.getMonth() &&
        inputDate.getDate() === storedDate.getDate()) {
      setStep('review');
    } else {
      setDobAttempts(prev => prev + 1);
      setDobError(`Incorrect date of birth. ${3 - dobAttempts - 1} attempts remaining.`);
    }
  };

  // Submit signature
  const handleSign = async () => {
    if (!consentChecked || !typedName.trim() || confirmName.trim().toLowerCase() !== typedName.trim().toLowerCase()) return;
    setSubmitting(true);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/process-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signer_type: 'client',
          typed_name: typedName.trim(),
          signature_data: signMethod === 'draw' ? signatureDataUrl : null,
          ip_address: 'captured-server-side',
          user_agent: navigator.userAgent,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setStep('success');
      } else {
        setDobError(result.error || 'Failed to process signature');
      }
    } catch {
      setDobError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const forms = [
    { code: 'B101', title: 'Voluntary Petition for Individuals' },
    { code: 'B106Dec', title: 'Declaration About an Individual Debtor\'s Schedules' },
    { code: 'B108', title: 'Statement of Intention for Individuals' },
    { code: 'B122A1', title: 'Chapter 7 Means Test Calculation' },
  ];

  return (
    <div className="min-h-screen bg-[hsl(210,45%,11%)] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[480px]">
        <div className="text-center mb-8">
          <Logo size="md" />
        </div>

        <AnimatePresence mode="wait">
          {/* LOADING */}
          {step === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground mt-4">Loading your documents…</p>
            </motion.div>
          )}

          {/* EXPIRED */}
          {step === 'expired' && (
            <motion.div key="expired" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface-card rounded-2xl p-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground font-display">This signing link has expired</h2>
              <p className="text-muted-foreground text-sm">Please contact your attorney to request a new signing link.</p>
            </motion.div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface-card rounded-2xl p-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground font-display">Invalid link</h2>
              <p className="text-muted-foreground text-sm">This signing link is invalid. Please check the link and try again.</p>
            </motion.div>
          )}

          {/* STEP 1: VERIFY */}
          {step === 'verify' && request && (
            <motion.div key="verify" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface-card rounded-2xl p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-foreground font-display">You have documents to sign</h2>
                <p className="text-muted-foreground text-sm">
                  {request.client_name}, please verify your identity to proceed.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date of Birth</label>
                <Input
                  type="date"
                  value={dobInput}
                  onChange={e => { setDobInput(e.target.value); setDobError(''); }}
                  className="text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>

              {dobError && (
                <p className="text-sm text-destructive">{dobError}</p>
              )}

              <Button
                onClick={handleVerify}
                className="w-full bg-primary text-primary-foreground min-h-[48px]"
                disabled={!dobInput || dobAttempts >= 3}
              >
                Verify Identity
              </Button>
            </motion.div>
          )}

          {/* STEP 2: REVIEW */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface-card rounded-2xl p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-foreground font-display">Review your documents</h2>
                <p className="text-muted-foreground text-sm">Please review all documents before signing.</p>
              </div>

              <div className="space-y-3">
                {forms.map(form => (
                  <div key={form.code} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{form.code}</p>
                        <p className="text-xs text-muted-foreground">{form.title}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(form.code)} className="gap-1">
                      <Eye className="w-3 h-3" /> View
                    </Button>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={reviewChecked}
                  onCheckedChange={(checked) => setReviewChecked(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground">I have reviewed all documents listed above</span>
              </label>

              <Button
                onClick={() => setStep('sign')}
                className="w-full bg-primary text-primary-foreground min-h-[48px]"
                disabled={!reviewChecked}
              >
                Proceed to Sign
              </Button>
            </motion.div>
          )}

          {/* STEP 3: SIGN */}
          {step === 'sign' && (
            <motion.div key="sign" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface-card rounded-2xl p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-foreground font-display">Sign your documents</h2>
              </div>

              {/* Draw/Type tabs */}
              <div className="flex rounded-xl bg-secondary p-1">
                <button
                  onClick={() => setSignMethod('draw')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    signMethod === 'draw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Draw
                </button>
                <button
                  onClick={() => setSignMethod('type')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    signMethod === 'type' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Type
                </button>
              </div>

              {signMethod === 'draw' ? (
                <div className="space-y-2">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-[150px] rounded-xl border border-border bg-white cursor-crosshair touch-none"
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                  />
                  <Button variant="ghost" size="sm" onClick={clearCanvas}>Clear</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={typedName}
                    onChange={e => setTypedName(e.target.value)}
                    placeholder="Type your full legal name"
                    className="text-base"
                    style={{ fontSize: '16px' }}
                  />
                  {typedName && (
                    <div className="p-4 rounded-xl bg-white border border-border text-center">
                      <p className="text-2xl text-black italic" style={{ fontFamily: "'Dancing Script', cursive" }}>
                        {typedName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* If draw method, still need typed name */}
              {signMethod === 'draw' && (
                <Input
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="text-base"
                  style={{ fontSize: '16px' }}
                />
              )}

              {/* Consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={consentChecked}
                  onCheckedChange={(checked) => setConsentChecked(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  By checking this box and signing below, I agree to sign these documents electronically. 
                  My electronic signature is legally binding under the ESIGN Act (15 U.S.C. § 7001) and UETA.
                </span>
              </label>

              {/* Confirm name */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Confirm your full legal name
                </label>
                <Input
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                  placeholder="Re-type your full legal name"
                  className="text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>

              {dobError && <p className="text-sm text-destructive">{dobError}</p>}

              <Button
                onClick={handleSign}
                className="w-full bg-primary text-primary-foreground min-h-[48px]"
                disabled={
                  submitting ||
                  !consentChecked ||
                  !typedName.trim() ||
                  confirmName.trim().toLowerCase() !== typedName.trim().toLowerCase()
                }
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {submitting ? 'Signing…' : 'Sign Documents'}
              </Button>
            </motion.div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="surface-card rounded-2xl p-8 text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-success" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground font-display">Documents signed successfully</h2>
              <p className="text-muted-foreground text-sm">Your attorney has been notified and will countersign your documents.</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Signed: {new Date().toLocaleString('en-US')}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Document preview modal */}
        {previewDoc && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">{previewDoc}</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-center text-muted-foreground py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Document preview</p>
                <p className="text-xs mt-1">SSN-redacted version of {previewDoc}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Google Fonts for cursive signature */}
      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap"
        rel="stylesheet"
      />
    </div>
  );
};

export default ClientSign;
