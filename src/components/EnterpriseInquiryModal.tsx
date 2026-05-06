import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CASE_OPTIONS = ['50–75', '76–100', '101–150', '150+'];

const EnterpriseInquiryModal = ({ open, onOpenChange }: Props) => {
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [casesPerMonth, setCasesPerMonth] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setFullName(''); setFirmName(''); setEmail(''); setPhone('');
    setCasesPerMonth(''); setMessage(''); setErrors({}); setSuccess(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) setTimeout(reset, 200);
    onOpenChange(o);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Required';
    if (!firmName.trim()) e.firmName = 'Required';
    if (!email.trim()) e.email = 'Required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Invalid email';
    if (!casesPerMonth) e.casesPerMonth = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-enterprise-inquiry', {
        body: { fullName, firmName, email, phone, casesPerMonth, message },
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setErrors({ submit: 'Failed to send. Please try again or email hello@yourclearpath.app.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Get Enterprise Pricing</DialogTitle>
          <DialogDescription>
            Tell us about your firm and we'll be in touch within 1 business day.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/15 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">We'll be in touch soon!</h3>
            <p className="text-sm text-muted-foreground mt-1">Usually within 1 business day.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="ent-name">Full Name *</Label>
              <Input id="ent-name" value={fullName} onChange={e => setFullName(e.target.value)} />
              {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <Label htmlFor="ent-firm">Firm Name *</Label>
              <Input id="ent-firm" value={firmName} onChange={e => setFirmName(e.target.value)} />
              {errors.firmName && <p className="text-xs text-destructive mt-1">{errors.firmName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ent-email">Email *</Label>
                <Input id="ent-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="ent-phone">Phone</Label>
                <Input id="ent-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Cases per month *</Label>
              <Select value={casesPerMonth} onValueChange={setCasesPerMonth}>
                <SelectTrigger><SelectValue placeholder="Select volume" /></SelectTrigger>
                <SelectContent>
                  {CASE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.casesPerMonth && <p className="text-xs text-destructive mt-1">{errors.casesPerMonth}</p>}
            </div>
            <div>
              <Label htmlFor="ent-msg">Message</Label>
              <Textarea
                id="ent-msg"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Anything else you'd like us to know?"
                rows={3}
              />
            </div>
            {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : 'Send'}
            </Button>
          </form>
        )}

        <div className="text-center pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Prefer to talk now?</p>
          <a
            href="https://calendly.com/hello-yourclearpath/20min"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm font-medium hover:underline"
          >
            Book a 20-minute call →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnterpriseInquiryModal;
