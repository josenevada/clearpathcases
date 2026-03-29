import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileSignature, Loader2, CheckCircle2, AlertTriangle, Clock, Copy, Send,
  Lock, Download, Eye, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits, FEATURE_GATE_INFO } from '@/lib/plan-limits';
import UpgradeModal from '@/components/UpgradeModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Case } from '@/lib/store';

interface SignaturesTabProps {
  caseData: Case;
  onRefresh: () => void;
}

type SignMethod = 'draw' | 'type';

const SignaturesTab = ({ caseData, onRefresh }: SignaturesTabProps) => {
  const { user } = useAuth();
  const { plan, status: subStatus } = useSubscription();
  const planLimits = getPlanLimits(plan);
  const isTrial = subStatus === 'trial';
  const viewRole = user?.role === 'attorney' ? 'attorney' : 'paralegal';

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [approvedForms, setApprovedForms] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [showCountersign, setShowCountersign] = useState(false);
  const [signMethod, setSignMethod] = useState<SignMethod>('type');
  const [typedName, setTypedName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Feature gate check
  const isLocked = !isTrial && !planLimits.courtPackets;

  useEffect(() => {
    if (isLocked) { setLoading(false); return; }
    loadData();
  }, [caseData.id, isLocked]);

  const loadData = async () => {
    setLoading(true);
    const [sigReq, forms] = await Promise.all([
      supabase.from('signature_requests').select('*').eq('case_id', caseData.id).maybeSingle(),
      supabase.from('generated_federal_forms').select('*').eq('case_id', caseData.id).eq('watermark_status', 'approved'),
    ]);
    setRequest(sigReq.data);
    setApprovedForms(forms.data ?? []);

    if (sigReq.data) {
      const { data: logs } = await supabase
        .from('signature_audit_log')
        .select('*')
        .eq('signature_request_id', sigReq.data.id)
        .order('created_at', { ascending: true });
      setAuditLog(logs ?? []);
    }
    setLoading(false);
  };

  // Canvas drawing
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
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (showCountersign && signMethod === 'draw') {
      setTimeout(initCanvas, 100);
    }
  }, [showCountersign, signMethod, initCanvas]);

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
    if (canvasRef.current) setSignatureDataUrl(canvasRef.current.toDataURL('image/png'));
  };

  // Send for signature
  const handleSendForSignature = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please log in'); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/create-signature-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ case_id: caseData.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Signature request sent to client');
        await loadData();
        onRefresh();
      } else {
        toast.error(result.error || 'Failed to send signature request');
      }
    } catch {
      toast.error('Failed to send signature request');
    } finally {
      setSending(false);
    }
  };

  // Resend link
  const handleResend = async () => {
    if (!request || request.reminder_count >= 3) return;
    setSending(true);
    try {
      await supabase.from('signature_requests').update({
        reminder_count: (request.reminder_count || 0) + 1,
        last_reminder_sent_at: new Date().toISOString(),
      }).eq('id', request.id);

      // Send SMS
      if (request.client_phone) {
        const appUrl = window.location.origin;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: request.client_phone,
            message: `Reminder: ${request.client_name}, please sign your bankruptcy documents: ${appUrl}/sign/${request.client_token}`,
          }),
        });
      }

      toast.success('Reminder sent');
      await loadData();
    } catch {
      toast.error('Failed to resend');
    } finally {
      setSending(false);
    }
  };

  // Attorney countersign
  const handleCountersign = async () => {
    if (!consentChecked || !typedName.trim()) return;
    setSigning(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/process-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: request.id,
          signer_type: 'attorney',
          typed_name: typedName.trim(),
          signature_data: signMethod === 'draw' ? signatureDataUrl : null,
          ip_address: 'captured-server-side',
          user_agent: navigator.userAgent,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('All signatures complete. Packet is ready to file.');
        setShowCountersign(false);
        await loadData();
        onRefresh();
      } else {
        toast.error(result.error || 'Failed to countersign');
      }
    } catch {
      toast.error('Failed to countersign');
    } finally {
      setSigning(false);
    }
  };

  // Copy signing link
  const handleCopyLink = () => {
    if (!request?.client_token) return;
    const url = `${window.location.origin}/sign/${request.client_token}`;
    navigator.clipboard?.writeText(url);
    toast.success('Signing link copied');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Feature gate
  if (isLocked) {
    const info = FEATURE_GATE_INFO['packet'] || { name: 'E-Signatures', minTier: 'Professional', roi: '' };
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold font-display text-foreground">E-Signatures</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Native e-signatures are available on Professional and Firm plans. Upgrade to send documents for electronic signing.
        </p>
        <p className="text-sm text-primary font-medium">Eliminates DocuSign — clients sign directly in ClearPath</p>
        <Button onClick={() => window.location.href = '/paralegal/settings'} className="bg-primary text-primary-foreground">
          Upgrade Plan
        </Button>
      </div>
    );
  }

  // Prerequisites check
  const hasApprovedForms = approvedForms.length > 0;
  const prerequisites = [
    { label: 'Forms generated and approved by attorney', met: hasApprovedForms },
  ];
  const allPrereqsMet = prerequisites.every(p => p.met);

  // No request yet - show prerequisites
  if (!request) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <FileSignature className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold font-display text-foreground">E-Signatures</h2>
        </div>

        <div className="surface-card rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-foreground">Prerequisites</h3>
          {prerequisites.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              {p.met ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className={`text-sm ${p.met ? 'text-foreground' : 'text-muted-foreground'}`}>{p.label}</span>
            </div>
          ))}
        </div>

        {allPrereqsMet && (
          <Button
            onClick={handleSendForSignature}
            className="w-full bg-primary text-primary-foreground min-h-[48px]"
            disabled={sending}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send for Signature
          </Button>
        )}
      </div>
    );
  }

  // Show status based on request state
  const status = request.status;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileSignature className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold font-display text-foreground">E-Signatures</h2>
      </div>

      {/* Status banners */}
      {status === 'pending_client' && (
        <div className="rounded-2xl border border-warning/20 bg-warning/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-warning"
            />
            <h3 className="font-bold text-foreground">Waiting for {request.client_name} to sign</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Sent: {format(new Date(request.created_at), 'MMM d, yyyy · h:mm a')}</p>
            <p>Expires: {format(new Date(request.client_token_expires_at), 'MMM d, yyyy · h:mm a')}</p>
            {request.reminder_count > 0 && (
              <p className="text-warning">Reminders sent: {request.reminder_count}/3</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleResend} disabled={sending || request.reminder_count >= 3}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Resend Link ({3 - (request.reminder_count || 0)} left)
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="w-3 h-3 mr-1" /> Copy Signing Link
            </Button>
          </div>
        </div>
      )}

      {status === 'client_signed' && (
        <>
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-bold text-foreground">Client Signed</p>
              <p className="text-xs text-muted-foreground">
                {request.client_typed_name} signed on {format(new Date(request.client_signed_at), 'MMM d, yyyy · h:mm a')}
              </p>
            </div>
          </div>

          {viewRole === 'attorney' && !request.attorney_signed_at && (
            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-bold text-foreground">Attorney Countersignature Required</h3>
              </div>
              <Button onClick={() => setShowCountersign(true)} className="bg-primary text-primary-foreground">
                Sign Now
              </Button>
            </div>
          )}

          {viewRole === 'paralegal' && !request.attorney_signed_at && (
            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning" />
              <p className="text-sm text-foreground">Waiting for attorney countersignature</p>
            </div>
          )}
        </>
      )}

      {status === 'complete' && (
        <>
          <div className="rounded-2xl border border-success/20 bg-success/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-success" />
              <h3 className="font-bold text-foreground text-lg">All Signatures Complete</h3>
            </div>
          </div>

          {/* Signature summary table */}
          <div className="surface-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold text-foreground">Signature Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-3 font-medium">Signer</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Signed At</th>
                    <th className="text-left p-3 font-medium">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {request.client_signed_at && (
                    <tr className="border-b border-border">
                      <td className="p-3 text-foreground">{request.client_typed_name}</td>
                      <td className="p-3"><Badge className="bg-primary/10 text-primary text-xs">Debtor</Badge></td>
                      <td className="p-3 text-muted-foreground">{format(new Date(request.client_signed_at), 'MMM d, yyyy h:mm a')}</td>
                      <td className="p-3 text-muted-foreground">Electronic</td>
                    </tr>
                  )}
                  {request.attorney_signed_at && (
                    <tr>
                      <td className="p-3 text-foreground">{request.attorney_typed_name}</td>
                      <td className="p-3"><Badge className="bg-success/10 text-success text-xs">Attorney</Badge></td>
                      <td className="p-3 text-muted-foreground">{format(new Date(request.attorney_signed_at), 'MMM d, yyyy h:mm a')}</td>
                      <td className="p-3 text-muted-foreground">Electronic</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit trail */}
          {auditLog.length > 0 && (
            <div className="surface-card rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-foreground">Audit Trail</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {auditLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM d h:mm a')}
                    </span>
                    <span className="text-foreground">
                      {entry.event_type.replace(/_/g, ' ')}
                      {entry.actor_name ? ` — ${entry.actor_name}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Attorney countersign panel */}
      {showCountersign && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card rounded-2xl p-6 space-y-6 border-2 border-primary/20"
        >
          <h3 className="text-lg font-bold text-foreground font-display">Attorney Countersignature</h3>

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
                className="w-full h-[120px] rounded-xl border border-border bg-white cursor-crosshair touch-none"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
              <Button variant="ghost" size="sm" onClick={() => { initCanvas(); setSignatureDataUrl(''); }}>
                Clear
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder={user?.fullName || 'Your full legal name'}
              />
              {typedName && (
                <div className="p-3 rounded-xl bg-white border border-border text-center">
                  <p className="text-xl text-black italic" style={{ fontFamily: "'Dancing Script', cursive" }}>
                    {typedName}
                  </p>
                </div>
              )}
            </div>
          )}

          {signMethod === 'draw' && (
            <Input
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder={user?.fullName || 'Your full legal name'}
            />
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              By signing, I certify I have reviewed these documents, they are accurate, 
              and I am authorized to file this petition. My electronic signature is legally 
              binding under the ESIGN Act and UETA.
            </span>
          </label>

          <div className="flex gap-3">
            <Button
              onClick={handleCountersign}
              className="bg-primary text-primary-foreground flex-1"
              disabled={signing || !consentChecked || !typedName.trim()}
            >
              {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Countersign
            </Button>
            <Button variant="ghost" onClick={() => setShowCountersign(false)}>Cancel</Button>
          </div>
        </motion.div>
      )}

      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap"
        rel="stylesheet"
      />
    </div>
  );
};

export default SignaturesTab;
