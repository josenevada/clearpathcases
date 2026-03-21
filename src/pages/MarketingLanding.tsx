import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, LayoutDashboard, PackageCheck, X, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import PricingCards from '@/components/PricingCards';
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
      {/* Teal glow */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div className="surface-card overflow-hidden relative z-10">
        {/* Titlebar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(36_91%_55%/0.6)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/50" />
          </div>
          <span className="text-[11px] text-muted-foreground ml-2 font-body">ClearPath — Active Cases</span>
        </div>
        {/* Case rows */}
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
      <section className="px-6 py-20 md:py-28 text-center max-w-4xl mx-auto">
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
          ClearPath guides bankruptcy clients through document collection step by step — so your paralegals spend less time chasing and more time filing.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-8 flex items-center justify-center gap-4 flex-wrap"
        >
          <Button size="lg" onClick={() => navigate('/signup')}>Start Free Trial</Button>
          <Button size="lg" variant="ghost" onClick={() => setShowDemo(true)}>Watch a 2-Minute Demo</Button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          Designed for Chapter 7 and Chapter 13 bankruptcy practices.
        </motion.p>

        {/* Product mockup */}
        <DashboardMockup />
      </section>

      <SectionDivider />

      {/* Problem / Solution */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

      {/* Features */}
      <section id="features" className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: 'Clients actually finish', desc: 'A guided step-by-step portal that walks clients through every document they need to upload. Adapts to each client\'s situation automatically.' },
            { icon: LayoutDashboard, title: 'Know exactly where every case stands', desc: 'Every case in one place, sorted by urgency. See who\'s done, who\'s stalled, and what needs your attention today.' },
            { icon: PackageCheck, title: 'Go from documents to filing in one click', desc: 'Download an organized ZIP or compiled PDF of all approved documents, ready for court, in one click.' },
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

      {/* Social Proof */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
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
      <section id="pricing" className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-4">Simple, transparent pricing</h2>
        <p className="text-muted-foreground text-center mb-12 font-body">14-day free trial on every plan. No credit card required.</p>
        <PricingCards onSelectPlan={handlePlan} buttonLabel="Start Free — No Card Needed" />
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
