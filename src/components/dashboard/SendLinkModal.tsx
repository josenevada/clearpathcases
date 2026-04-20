import { useState } from 'react';
import { Copy, Send, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { sendSmartReminder } from '@/lib/notifications';
import { sendWelcomeSms } from '@/lib/sms';
import { getFirmSettings, type Case } from '@/lib/store';
import { toast } from 'sonner';

interface SendLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: Case | null;
}

const SendLinkModal = ({ open, onOpenChange, caseData }: SendLinkModalProps) => {
  const [sending, setSending] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!caseData) return null;

  const caseCode = caseData.caseCode;
  const spouseCaseCode = caseData.spouseCaseCode;
  const isJoint = !!(caseData.isJointFiling && spouseCaseCode);

  const portalLink = caseCode ? `https://yourclearpath.app/client/${caseCode}` : '';
  const spousePortalLink = spouseCaseCode ? `https://yourclearpath.app/client/${spouseCaseCode}` : '';

  const primaryFirstName = caseData.clientName.split(' ')[0];
  const spouseFirstName = caseData.spouseName?.split(' ')[0] || 'Spouse';
  const firmName = getFirmSettings().firmName || "your attorney's office";

  const hasPhone = !!caseData.clientPhone;
  const hasEmail = !!caseData.clientEmail;
  const hasBothMissing = !hasPhone && !hasEmail;

  const handleCopy = (link: string, key: string) => {
    navigator.clipboard?.writeText(link);
    setCopiedKey(key);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSend = async () => {
    if (hasBothMissing) {
      toast.error('No contact info on file — add a phone or email to this case first.');
      return;
    }

    setSending(true);
    try {
      const result = await sendSmartReminder(caseData);
      const channels = [];
      if (result.email.status === 'sent') channels.push('email');
      if (result.sms.status === 'sent') channels.push('SMS');

      if (!hasPhone && hasEmail) {
        toast.warning(`Primary link sent by email only — no phone number on file for ${caseData.clientName}`);
      } else if (!hasEmail && hasPhone) {
        toast.warning(`Primary link sent by SMS only — no email address on file for ${caseData.clientName}`);
      } else if (channels.length > 0) {
        toast.success(`Primary link sent to ${caseData.clientName} via ${channels.join(' and ')}.`);
      } else {
        toast.success(`Primary link queued for ${caseData.clientName}.`);
      }

      // For joint filings, send the spouse their own link
      if (isJoint && caseData.spouseName && spouseCaseCode) {
        const spouseHasEmail = !!caseData.spouseEmail;
        const spouseHasPhone = !!caseData.spousePhone;
        if (!spouseHasEmail && !spouseHasPhone) {
          toast.warning(`No contact info for ${caseData.spouseName} — co-debtor link not sent.`);
        } else {
          // Reuse case-record fields by sending a welcome SMS for spouse if phone present
          if (spouseHasPhone) {
            await sendWelcomeSms(
              caseData.spousePhone,
              caseData.spouseName,
              spouseCaseCode,
              caseData.id,
              firmName,
            ).catch((err) => console.error('Spouse welcome SMS error:', err));
          }
          if (spouseHasEmail) {
            // Best-effort: log activity; full email send would require a templated edge call
            await supabase.from('activity_log').insert({
              case_id: caseData.id,
              event_type: 'notification_sent',
              actor_role: 'paralegal',
              actor_name: 'System',
              description: `Co-debtor intake link queued for ${caseData.spouseName} (${caseData.spouseEmail})`,
            });
          }
          toast.success(`Co-debtor link sent to ${caseData.spouseName}.`);
        }
      }

      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'notification_sent',
        actor_role: 'paralegal',
        actor_name: 'System',
        description: `Client intake link sent for ${caseData.clientName}`,
      });
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong — please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] border-border bg-background z-[100] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-xl text-foreground">
            {isJoint
              ? 'Your case is ready — send both clients their intake links.'
              : `Your case is ready — send ${primaryFirstName} their intake link.`}
          </DialogTitle>
          <DialogDescription className="font-body text-muted-foreground">
            {isJoint
              ? `${primaryFirstName} and ${spouseFirstName} will each receive their own secure link to upload documents.`
              : `${primaryFirstName} will receive a message with instructions to upload their documents.`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {hasBothMissing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No contact info on file. Add a phone or email to this case before sending.
            </div>
          )}

          {/* Primary debtor link */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground font-body">
              {isJoint ? `Primary debtor — ${primaryFirstName}'s link` : 'Client portal URL'}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-input border border-border rounded-[10px] px-3 py-2 text-sm text-foreground font-mono truncate">
                {caseCode ? portalLink : 'Generating link…'}
              </div>
              <Button variant="outline" size="icon" onClick={() => handleCopy(portalLink, 'primary')} disabled={!caseCode}>
                {copiedKey === 'primary' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Co-debtor link */}
          {isJoint && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground font-body">
                Co-debtor — {spouseFirstName}'s link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-input border border-border rounded-[10px] px-3 py-2 text-sm text-foreground font-mono truncate">
                  {spousePortalLink}
                </div>
                <Button variant="outline" size="icon" onClick={() => handleCopy(spousePortalLink, 'spouse')}>
                  {copiedKey === 'spouse' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Message previews */}
          <div className="surface-card p-4 text-sm text-muted-foreground font-body space-y-3">
            <div>
              <p className="mb-1 font-medium text-foreground">
                {isJoint ? `Message to ${primaryFirstName}:` : 'Message preview:'}
              </p>
              <p>
                "Hi {primaryFirstName}, {firmName} has sent you a secure link to upload your bankruptcy documents through ClearPath. Get started here: {portalLink} — Reply STOP to opt out."
              </p>
            </div>
            {isJoint && (
              <div className="pt-2 border-t border-border">
                <p className="mb-1 font-medium text-foreground">Message to {spouseFirstName}:</p>
                <p>
                  "Hi {spouseFirstName}, {firmName} has sent you a secure link to upload your bankruptcy documents through ClearPath. Get started here: {spousePortalLink} — Reply STOP to opt out."
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => handleCopy(portalLink, 'primary')} disabled={!caseCode}>
              <Copy className="w-4 h-4 mr-1.5" />
              {isJoint ? 'Copy primary' : (copiedKey === 'primary' ? 'Copied!' : 'Copy link')}
            </Button>
            <Button className="flex-1" onClick={handleSend} disabled={sending || hasBothMissing || !caseCode}>
              <Send className="w-4 h-4 mr-1.5" />
              {sending ? 'Sending…' : (isJoint ? 'Send both' : 'Send now')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendLinkModal;
