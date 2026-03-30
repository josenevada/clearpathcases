import { useState } from 'react';
import { Copy, Send, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { sendSmartReminder } from '@/lib/notifications';
import { getFirmSettings, type Case } from '@/lib/store';
import { toast } from 'sonner';

interface SendLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: Case | null;
}

const SendLinkModal = ({ open, onOpenChange, caseData }: SendLinkModalProps) => {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!caseData) return null;

  const portalLink = `${window.location.origin}/client/${caseData.caseCode}`;
  const firstName = caseData.clientName.split(' ')[0];
  const hasPhone = !!caseData.clientPhone;
  const hasEmail = !!caseData.clientEmail;
  const hasBothMissing = !hasPhone && !hasEmail;

  const handleCopy = () => {
    navigator.clipboard?.writeText(portalLink);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    // PROMPT 2: Contact validation on send
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
        toast.warning(`Link sent by email only — no phone number on file for ${caseData.clientName}`);
      } else if (!hasEmail && hasPhone) {
        toast.warning(`Link sent by SMS only — no email address on file for ${caseData.clientName}`);
      } else if (channels.length > 0) {
        toast.success(`Link sent to ${caseData.clientName} via ${channels.join(' and ')}.`);
      } else {
        toast.success(`Link queued for ${caseData.clientName}.`);
      }
      localStorage.setItem('cp_link_sent', 'true');
      onOpenChange(false);
    } catch {
      toast.error('Something went wrong — please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] border-border bg-background">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-xl text-foreground">
            Your case is ready — send {firstName} their intake link.
          </DialogTitle>
          <DialogDescription className="font-body text-muted-foreground">
            {firstName} will receive a message with instructions to upload their documents.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {hasBothMissing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No contact info on file. Add a phone or email to this case before sending.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground font-body">Client portal URL</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-input border border-border rounded-[10px] px-3 py-2 text-sm text-foreground font-mono truncate">
                {portalLink}
              </div>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="surface-card p-4 text-sm text-muted-foreground font-body">
            <p className="mb-2 font-medium text-foreground">Message preview:</p>
            <p>
              "Hi {firstName}, {getFirmSettings().firmName || 'your attorney\'s office'} has created your ClearPath intake portal.
              Please upload your documents here: {portalLink}. If you have questions, reply to this message."
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-1.5" />
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button className="flex-1" onClick={handleSend} disabled={sending || hasBothMissing}>
              <Send className="w-4 h-4 mr-1.5" />
              {sending ? 'Sending…' : 'Send now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendLinkModal;
