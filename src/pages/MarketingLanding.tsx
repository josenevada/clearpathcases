import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, LayoutDashboard, PackageCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import PricingCards from '@/components/PricingCards';
import type { PlanKey } from '@/lib/stripe';

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
      <section className="px-6 py-20 md:py-32 text-center max-w-4xl mx-auto">
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
      </section>

      {/* Problem Section */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground mb-6">The old way</h2>
            <ul className="space-y-4">
              {[
                'Chasing clients over email for weeks',
                'Documents arrive in the wrong format',
                'No visibility into what\'s missing',
                'Paralegals manually organizing files before filing',
              ].map(t => (
                <li key={t} className="text-destructive/80 font-body">{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground mb-6">The ClearPath way</h2>
            <ul className="space-y-4">
              {[
                'Clients guided step by step in plain English',
                'Documents collected in the right format automatically',
                'Real-time progress tracking per case',
                'Court-ready filing packet generated in one click',
              ].map(t => (
                <li key={t} className="text-primary font-body">{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: 'Client Wizard', desc: 'A guided step-by-step portal that walks clients through every document they need to upload. Adapts to each client\'s situation automatically.' },
            { icon: LayoutDashboard, title: 'Paralegal Dashboard', desc: 'Every case in one place, sorted by urgency. See who\'s done, who\'s stalled, and what needs your attention today.' },
            { icon: PackageCheck, title: 'Filing Packet Export', desc: 'Download an organized ZIP or compiled PDF of all approved documents, ready for court, in one click.' },
          ].map(f => (
            <div key={f.title} className="surface-card p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm font-body">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="surface-card p-8 border-l-4 border-primary">
          <p className="text-lg text-foreground font-body italic">
            "We used to spend two weeks collecting documents by email. With ClearPath we have everything we need in three days."
          </p>
          <p className="mt-4 text-sm text-muted-foreground">— Sarah Johnson, Paralegal at Johnson & Associates</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-foreground text-center mb-4">Simple, transparent pricing</h2>
        <p className="text-muted-foreground text-center mb-12 font-body">14-day free trial on every plan. No credit card required.</p>
        <PricingCards onSelectPlan={handlePlan} />
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
