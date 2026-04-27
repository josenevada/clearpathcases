import { useEffect, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Headphones, Mail, Send, ChevronDown, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const ticketSchema = z.object({
  category: z.enum([
    'general',
    'bug',
    'billing',
    'feature_request',
    'client_portal',
    'reminders',
    'cases',
    'team',
    'security',
  ]),
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters')
    .max(140, 'Subject must be 140 characters or fewer'),
  message: z
    .string()
    .trim()
    .min(10, 'Please describe your issue (at least 10 characters)')
    .max(4000, 'Message must be 4000 characters or fewer'),
});

type TicketCategory = z.infer<typeof ticketSchema>['category'];

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General question' },
  { value: 'bug', label: 'Something is broken' },
  { value: 'client_portal', label: 'Client portal / uploads' },
  { value: 'reminders', label: 'Email or SMS reminders' },
  { value: 'cases', label: 'Cases & checklists' },
  { value: 'billing', label: 'Billing & subscription' },
  { value: 'team', label: 'Team & invitations' },
  { value: 'security', label: 'Security & data' },
  { value: 'feature_request', label: 'Feature request' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I share a portal link with a client?',
    a: 'When you create a case, ClearPath generates a unique Case Code and a portal URL (yourclearpath.app/client/<code>). Use the "Send Link" action on the dashboard to text or email it. The client is asked to verify their date of birth before they can upload anything.',
  },
  {
    q: 'My client says the upload failed — what should I check?',
    a: 'Most upload issues come from very large files or HEIC images on older iPhones. ClearPath accepts PDF, JPG, PNG, and HEIC up to ~15 MB per file. On iOS, ClearPath compresses photos automatically. If a single file is genuinely too big, ask the client to retake the photo or scan the document into a smaller PDF.',
  },
  {
    q: 'Why didn\'t my SMS reminder send?',
    a: 'Reminders are gated by two server rules: (1) Quiet hours — SMS is only sent between 8:00 AM and 8:00 PM MST, and (2) Cooldown — only one SMS per case every 4 hours. The cooldown is bypassed for paralegal-triggered manual sends, but quiet hours are enforced for everyone. If you see "Cooldown" or "Quiet hours" in the toast, that\'s why.',
  },
  {
    q: 'How do I mark a checklist item as Not Applicable?',
    a: 'Open the case, go to the Checklist tab, and use the menu next to any item to mark it N/A. N/A items are excluded from the client\'s wizard and don\'t count against their progress. You can also add custom items the client wasn\'t originally asked for.',
  },
  {
    q: 'What does "Ready to File" mean?',
    a: 'Only attorneys can mark a case Ready to File, and only after every required (non-N/A) checklist item is finalized — that means files uploaded and reviewed, or text entries saved. The status is meant as a final attorney sign-off before filing.',
  },
  {
    q: 'A client uploaded the wrong document — how do I request a correction?',
    a: 'On the document in the Documents tab, choose "Request correction" and enter a short reason. The client gets an email and SMS (subject to quiet hours) with a link straight back to that item. Their wizard will reopen on that step.',
  },
  {
    q: 'How do I add a paralegal or attorney to my firm?',
    a: 'Settings → Team. Invite by email and assign a role. Seat limits depend on your plan — Starter includes 1 seat, Professional 5, Firm unlimited. Invitations expire after 7 days.',
  },
  {
    q: 'How do I change my plan or update payment info?',
    a: 'Settings → Billing. The "Manage Subscription" button opens the secure billing portal where you can change tier, update card, or download invoices. Cancellations take effect at the end of the current billing cycle.',
  },
  {
    q: 'What happens to a client\'s documents after a case is filed?',
    a: 'Cases marked Filed or Closed are kept for 7 years per our retention policy, then automatically deleted. Firm admins are notified before any deletion. You can manually delete a case at any time from the Case Detail screen.',
  },
  {
    q: 'Is my client\'s data secure?',
    a: 'Yes. All client data is isolated by firm with row-level security — your firm cannot see another firm\'s data even at the database level. Documents are stored in encrypted, scoped folders and only accessible via signed URLs. Passwords are checked against known breach databases on signup.',
  },
  {
    q: 'My client can\'t log in — they say the link is expired.',
    a: 'The portal link itself doesn\'t expire, but DOB verification is required on each new device. If verification keeps failing, double-check the DOB on file in the Client Info tab — even a one-day mismatch will block them. Update it and ask the client to retry.',
  },
  {
    q: 'Can I customize the document checklist for a specific case?',
    a: 'Yes. While creating a case in the New Case modal, use the inline checklist editor to remove items the client doesn\'t need. After creation, you can also add custom items, mark items N/A, or change requirements from the Checklist tab.',
  },
];

const SupportTab = () => {
  const { plan } = useSubscription();
  const limits = getPlanLimits(plan);
  const { user } = useAuth();

  const [firmId, setFirmId] = useState<string | null>(null);
  const [firmName, setFirmName] = useState<string>('');
  const [submitterName, setSubmitterName] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [category, setCategory] = useState<TicketCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('firm_id, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (userRow?.firm_id) {
        setFirmId(userRow.firm_id);
        setSubmitterName(userRow.full_name || user.email || 'Unknown');
        const { data: firmRow } = await supabase
          .from('firms')
          .select('name')
          .eq('id', userRow.firm_id)
          .maybeSingle();
        if (!cancelled && firmRow?.name) setFirmName(firmRow.name);
      }
      setLoadingProfile(false);
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firmId) {
      toast.error('You must be signed in to submit a ticket.');
      return;
    }

    const parsed = ticketSchema.safeParse({ category, subject, message });
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || 'Please check the form and try again.';
      toast.error(firstError);
      return;
    }

    setSubmitting(true);
    try {
      const priority = limits.prioritySupport ? 'priority' : 'standard';

      const { data: inserted, error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          firm_id: firmId,
          submitted_by_user_id: user.id,
          submitted_by_name: submitterName,
          submitted_by_email: user.email || '',
          firm_name: firmName || null,
          subject: parsed.data.subject,
          message: parsed.data.message,
          category: parsed.data.category,
          priority,
          status: 'open',
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message || 'Failed to save ticket');
      }

      // Fire-and-await the email notification — don't block UI on email failure
      const { error: emailError } = await supabase.functions.invoke('send-support-ticket', {
        body: {
          ticketId: inserted.id,
          firmName,
          submittedByName: submitterName,
          submittedByEmail: user.email,
          subject: parsed.data.subject,
          message: parsed.data.message,
          category: parsed.data.category,
          priority,
        },
      });

      if (emailError) {
        // Ticket is saved; just warn about the email
        console.error('Support email failed:', emailError);
        toast.warning('Ticket saved, but confirmation email could not be sent.');
      } else {
        toast.success('Support ticket submitted — we\'ll be in touch soon.');
      }

      setSubject('');
      setMessage('');
      setCategory('general');
    } catch (err) {
      console.error('Support submit error:', err);
      toast.error('Could not submit ticket. Please try again or email hello@yourclearpath.app.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">Support</h2>
        <p className="text-sm text-muted-foreground font-body">
          Submit a ticket, browse common questions, or reach our team directly.
        </p>
      </div>

      {/* Support tier cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {limits.prioritySupport ? (
          <div className="surface-card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground mb-1">Priority Support</h3>
              <p className="text-sm text-muted-foreground font-body">
                Tickets are answered within 4 business hours.
              </p>
              <a
                href="mailto:hello@yourclearpath.app"
                className="text-sm text-primary hover:underline font-body mt-2 inline-block"
              >
                hello@yourclearpath.app
              </a>
            </div>
          </div>
        ) : (
          <div className="surface-card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground mb-1">Standard Support</h3>
              <p className="text-sm text-muted-foreground font-body">
                Tickets are answered within 1–2 business days.
              </p>
              <p className="text-xs text-muted-foreground font-body mt-2">
                Upgrade to Professional for priority 4-hour response times.
              </p>
            </div>
          </div>
        )}

        {limits.dedicatedOnboarding && (
          <div className="surface-card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Headphones className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground mb-1">Dedicated Onboarding</h3>
              <p className="text-sm text-muted-foreground font-body">
                Schedule a 1:1 with our onboarding specialist —{' '}
                <a href="mailto:hello@yourclearpath.app" className="text-primary hover:underline">
                  hello@yourclearpath.app
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Submit ticket form */}
      <div className="surface-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LifeBuoy className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground">Submit a support ticket</h3>
        </div>
        <p className="text-sm text-muted-foreground font-body mb-5">
          Tell us what's going on and we'll get back to you by email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TicketCategory)}
                disabled={submitting}
              >
                <SelectTrigger id="ticket-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-from">From</Label>
              <Input
                id="ticket-from"
                value={loadingProfile ? 'Loading…' : `${submitterName}${user?.email ? ` <${user.email}>` : ''}`}
                disabled
                readOnly
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              maxLength={140}
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">Message</Label>
            <Textarea
              id="ticket-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened? Include the case code or client name if relevant."
              rows={6}
              maxLength={4000}
              disabled={submitting}
              required
            />
            <p className="text-xs text-muted-foreground font-body text-right">
              {message.length}/4000
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground font-body">
              {limits.prioritySupport ? 'Priority queue — 4-hour SLA.' : 'Standard queue — 1–2 business days.'}
            </p>
            <Button type="submit" disabled={submitting || loadingProfile || !firmId}>
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Sending…' : 'Submit ticket'}
            </Button>
          </div>
        </form>
      </div>

      {/* FAQ */}
      <div className="surface-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ChevronDown className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground">Frequently asked questions</h3>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((item, idx) => (
            <AccordionItem key={idx} value={`faq-${idx}`}>
              <AccordionTrigger className="text-left font-body text-foreground hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground font-body leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default SupportTab;
