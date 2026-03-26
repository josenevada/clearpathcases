import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, LayoutDashboard, PackageCheck, X, CheckCircle2, XCircle,
  ArrowRight, Upload, Lock, Shield, CheckCircle, Clock, ChevronDown,
  Plus, Minus, Sparkles, MessageSquare, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import PricingCards from '@/components/PricingCards';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { PlanKey } from '@/lib/stripe';

const SectionDivider = () => (
  <div className="max-w-5xl mx-auto px-6">
    <div className="h-px w-full bg-foreground/[0.06]" />
  </div>
);

/* Fake dashboard mockup for hero */
const DashboardMockup = () => {
  const cases = [
    { name: 'Maria Rodriguez', chapter: '7', urgency: 'critical', progress: 85, docs: '6 of 8' },
    { name: 'James Chen', chapter: '13', urgency: 'at-risk', progress: 45, docs: '3 of 8' },
    { name: 'Robert Kim', chapter: '7', urgency: 'normal', progress: 100, docs: '8 of 8' },
  ];
  const urgencyColors: Record<string, string> = {
    critical: 'bg-destructive/15 text-destructive border-destructive/25',
    'at-risk': 'bg-[hsl(36_91%_55%/0.15)] text-[hsl(36_91%_55%)] border-[hsl(36_91%_55%/0.25)]',
    normal: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="relative mt-14 max-w-3xl mx-auto"
    >
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div className="surface-card overflow-hidden relative z-10">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(36_91%_55%/0.6)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/50" />
          </div>
          <span className="text-[11px] text-muted-foreground ml-2 font-body">ClearPath — Active Cases</span>
        </div>
        <div className="divide-y divide-border/40">
          {cases.map((c) => (
            <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">Chapter {c.chapter}</p>
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${urgencyColors[c.urgency]}`}>
                {c.urgency === 'at-risk' ? 'At Risk' : c.urgency}
              </span>
              <div className="w-28 hidden sm:block">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{c.docs} docs</span>
                  <span>{c.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${c.progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* Stats confidence bar */
const StatsBar = () => {
  const stats = [
    { value: 'Just days', label: 'Average document collection time — firms report significant time savings' },
    { value: 'High', label: 'Client completion rate — guided step by step' },
    { value: 'Zero', label: 'Filing deadlines missed — with automated reminders' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="max-w-3xl mx-auto mt-10"
    >
      <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] flex flex-col sm:flex-row items-center justify-center divide-y sm:divide-y-0 sm:divide-x divide-foreground/[0.08] py-4 sm:py-0">
        {stats.map((s) => (
          <div key={s.label} className="flex-1 text-center py-4 sm:py-5 px-6">
            <p className="font-display font-bold text-2xl text-primary">{s.value}</p>
            <p className="text-xs text-muted-foreground font-body mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/* Client wizard phone mockup */
const ClientWizardMockup = () => (
  <div className="w-[280px] mx-auto md:mx-0 flex-shrink-0">
    {/* Phone frame */}
    <div className="rounded-[2rem] border-2 border-foreground/[0.12] bg-background p-3 shadow-xl">
      <div className="rounded-[1.4rem] overflow-hidden border border-border/60 bg-card">
        {/* Status bar */}
        <div className="flex items-center justify-center py-2 px-4">
          <div className="w-20 h-1 rounded-full bg-foreground/20" />
        </div>
        {/* Content */}
        <div className="px-4 pb-5 pt-2 space-y-3">
          <p className="text-[10px] text-muted-foreground font-body">Step 3 of 8</p>
          <h4 className="font-display font-bold text-sm text-foreground leading-snug">Most recent pay stubs</h4>
          {/* Accordion hint */}
          <button className="flex items-center gap-1.5 text-[11px] text-primary font-body">
            <ChevronDown className="w-3 h-3" />
            Why do we need this?
          </button>
          {/* Upload zone */}
          <div className="border border-dashed border-primary/30 rounded-lg bg-primary/[0.04] flex flex-col items-center justify-center py-6 gap-2">
            <Upload className="w-5 h-5 text-primary/60" />
            <p className="text-[10px] text-muted-foreground font-body">Tap to upload or take a photo</p>
          </div>
          {/* Continue button */}
          <div className="rounded-full bg-primary py-2 text-center">
            <span className="text-xs font-bold text-primary-foreground">Continue</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MarketingLanding = () => {
  const navigate = useNavigate();
  const [showDemo, setShowDemo] = useState(false);

  const handlePlan = (plan: PlanKey) => {
    sessionStorage.setItem('selected_plan', plan);
    navigate('/signup');
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Features</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Pricing</a>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
          <Button size="sm" onClick={() => navigate('/signup')}>Start Free Trial</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 md:pt-28 pb-10 md:pb-14 text-center max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="font-display font-bold text-4xl md:text-6xl text-foreground leading-tight"
        >
          Your clients have the documents.{' '}
          <span className="text-primary">We help them send them.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-6 text-lg text-muted-foreground font-body max-w-2xl mx-auto"
        >
          No more chasing clients over email. No more documents arriving in the wrong format. No more wondering what's missing.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-8 flex items-center justify-center gap-4 flex-wrap"
        >
          <Button size="lg" onClick={() => navigate('/signup')}>Start Free Trial</Button>
          <Button size="lg" variant="ghost" onClick={() => setShowDemo(true)} className="group">Watch a 2-Minute Demo <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></Button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          Designed for Chapter 7 and Chapter 13 bankruptcy practices.
        </motion.p>

        <DashboardMockup />
        <StatsBar />
      </section>

      <SectionDivider />

      {/* Before / After with narrative connector */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-stretch">
          {/* Old way */}
          <div className="rounded-2xl bg-destructive/[0.04] border border-destructive/10 border-l-4 border-l-destructive/40 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">Before ClearPath</p>
            <ul className="space-y-3.5">
              {[
                'Chasing clients over email for weeks',
                'Documents arrive in the wrong format',
                'No visibility into what\'s missing',
                'Paralegals manually organizing files before filing',
              ].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-destructive/70 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground/70 font-body">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Connector */}
          <div className="hidden md:flex flex-col items-center justify-center gap-2 px-2">
            <div className="w-px flex-1 bg-foreground/[0.08]" />
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary text-center whitespace-nowrap">Your practice,<br />transformed</p>
            <div className="w-px flex-1 bg-foreground/[0.08]" />
          </div>
          {/* Mobile connector */}
          <div className="flex md:hidden items-center justify-center gap-3 py-1">
            <div className="h-px flex-1 bg-foreground/[0.08]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary whitespace-nowrap">Your practice, transformed</p>
            <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="h-px flex-1 bg-foreground/[0.08]" />
          </div>
          {/* ClearPath way */}
          <div className="rounded-2xl bg-primary/[0.04] border border-primary/10 border-l-4 border-l-primary/50 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">With ClearPath</p>
            <ul className="space-y-3.5">
              {[
                'Clients guided step by step in plain English',
                'Documents collected in the right format automatically',
                'Real-time progress tracking per case',
                'Court-ready filing packet generated in one click',
              ].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground/70 font-body">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* How it works — 3-step flow */}
      <section id="features" className="px-6 py-12 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 items-start relative">
          {/* Dashed connector line (desktop) */}
          <div className="hidden md:block absolute top-5 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] border-t-2 border-dashed border-primary/25" />
          {[
            { num: '1', title: 'Create a case', desc: 'A paralegal sets up the case and the system generates a secure client link in seconds.' },
            { num: '2', title: 'Client uploads documents', desc: 'The client follows a guided step-by-step walkthrough on any device, one document at a time.' },
            { num: '3', title: 'Review and file', desc: 'The paralegal reviews documents, requests corrections if needed, and exports a court-ready filing packet in one click.' },
          ].map((step, i) => (
            <div key={step.num} className="flex flex-col items-center text-center px-6 py-4 relative z-10">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mb-4">
                <span className="font-display font-bold text-sm text-primary-foreground">{step.num}</span>
              </div>
              <h3 className="font-display font-bold text-base text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground font-body max-w-xs">{step.desc}</p>
              {/* Mobile connector */}
              {i < 2 && (
                <div className="md:hidden w-px h-8 border-l-2 border-dashed border-primary/25 mt-4" />
              )}
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Feature cards */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: 'Clients actually finish', desc: 'A guided step-by-step portal that walks clients through every document they need to upload. Adapts to each client\'s situation automatically.' },
            { icon: LayoutDashboard, title: 'Know exactly where every case stands', desc: 'Every case in one place, sorted by urgency. See who\'s done, who\'s stalled, and what needs your attention today.' },
            { icon: PackageCheck, title: 'Go from documents to filing in one click', desc: 'Download an organized ZIP or compiled PDF of all approved documents, ready for court, in one click.' },
            { icon: Sparkles, title: 'AI catches mistakes before they reach you', desc: 'Every uploaded document is validated instantly — wrong year, wrong file, wrong document type — and the client is guided to fix it before it lands in your review queue.' },
            { icon: MessageSquare, title: 'Clients stay on track automatically', desc: 'Automated SMS and email nudges bring clients back when they go quiet — timed to their behavior, written in plain English, with a direct link back to exactly where they left off.' },
            { icon: ClipboardList, title: 'Full audit trail on every case', desc: 'Every upload, approval, correction, and client interaction is logged with a timestamp and actor — so you always know exactly what happened and when.' },
          ].map(f => (
            <div key={f.title} className="surface-card p-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                <f.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm font-body">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Client experience showcase */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl text-foreground mb-3">Your clients will actually finish</h2>
          <p className="text-muted-foreground font-body max-w-2xl mx-auto">
            ClearPath guides them through every document in plain English — one step at a time, on any device.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-14 justify-center">
          <ClientWizardMockup />
          <ul className="space-y-5 max-w-sm">
            {[
              'No confusing legal jargon',
              'Works on any phone or computer',
              'Saves progress automatically',
              'Clients know exactly what to do next',
            ].map(item => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground font-body">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SectionDivider />

      {/* Trust bar */}
      <section className="border-t border-foreground/[0.06] border-b border-b-foreground/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { icon: Lock, text: 'Bank-level encryption' },
            { icon: Shield, text: 'Documents stored securely' },
            { icon: CheckCircle, text: 'Files encrypted in transit and at rest' },
            { icon: Clock, text: 'Automatic deadline tracking' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-body">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <div className="surface-card p-8 border-l-4 border-primary">
          <p className="text-lg md:text-xl text-foreground font-body italic leading-relaxed">
            "We used to spend two weeks collecting documents by email. With ClearPath we have everything we need in three days."
          </p>
          <p className="mt-5 text-sm text-muted-foreground italic font-body">
            Join the firms already using ClearPath
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* Pricing */}
      <section id="pricing" className="px-6 py-12 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-4">Simple, transparent pricing</h2>
        <p className="text-muted-foreground text-center mb-12 font-body">14-day free trial on every plan. No credit card required.</p>
        <PricingCards onSelectPlan={handlePlan} buttonLabel="Start Free — No Card Needed" />
        <p className="text-center text-xs text-muted-foreground font-body mt-8">
          Your data is protected with bank-level encryption.{' '}
          <a href="/security" className="text-primary hover:underline">Learn more</a>
        </p>
      </section>

      <SectionDivider />

      {/* FAQ */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-3">Common questions</h2>
        <p className="text-muted-foreground font-body text-center mb-10">Everything bankruptcy firms want to know before getting started.</p>
        <Accordion type="single" collapsible className="space-y-2">
          {[
            {
              q: 'How do clients access their document portal?',
              a: 'When you create a case in ClearPath the system generates a unique secure link for your client. You share that link with them by email or text. They click it, verify their identity with their date of birth, and are guided through uploading their documents step by step — no account creation required.',
            },
            {
              q: 'Do clients need to create an account?',
              a: 'No. Clients access their portal through a unique secure link and verify their identity with their date of birth. There is no username or password for clients to manage. This removes the biggest barrier to getting documents submitted quickly.',
            },
            {
              q: 'What happens if a client uploads the wrong document?',
              a: 'ClearPath uses AI validation to detect common mistakes — wrong document type, wrong year, illegible files — and alerts the client immediately with plain English guidance on what to fix. If a paralegal catches an issue during review they can request a correction with one click and the client receives an email and text notification with a direct link to fix it.',
            },
            {
              q: 'Is client data secure?',
              a: 'All documents are encrypted in transit and at rest using AES-256 encryption. Files are stored on secure AWS infrastructure. Client portal links are unique and access requires date of birth verification. We take data security seriously and are working toward formal SOC 2 compliance.',
            },
            {
              q: 'Can we customize the document checklist for our firm?',
              a: 'Yes. In your firm settings you can turn individual document requirements on or off, mark items as optional, add custom document types specific to your practice, and configure intake questions that automatically personalize each client\'s checklist based on their situation — whether they own property, have a vehicle, are self-employed, and more.',
            },
          ].map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border border-border/60 rounded-xl px-5 data-[state=open]:bg-foreground/[0.02]">
              <AccordionTrigger className="hover:no-underline py-5 [&>svg]:hidden">
                <span className="text-left font-body text-sm font-medium text-foreground">{item.q}</span>
                <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-4 block [[data-state=open]_&]:hidden" />
                <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-4 hidden [[data-state=open]_&]:block" />
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground font-body leading-relaxed pb-5">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <SectionDivider />

      {/* Final CTA */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center rounded-2xl bg-primary/[0.06] border border-primary/10 px-8 py-14">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Ready to stop chasing documents?</h2>
          <p className="text-muted-foreground font-body mb-8 max-w-xl mx-auto">Join ClearPath and get your first case set up in minutes.</p>
          <Button size="lg" onClick={() => navigate('/signup')}>Start Free — No Card Needed</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-muted-foreground font-body">Bankruptcy document intake, simplified.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms of Service</a>
            <a href="/security" className="hover:text-foreground">Security</a>
            <a href="/login" className="hover:text-foreground">Sign In</a>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowDemo(false)}>
          <div className="surface-card max-w-3xl w-full p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowDemo(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-display font-bold text-xl text-foreground mb-4">Product Demo</h3>
            <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground font-body">Demo video coming soon</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingLanding;
