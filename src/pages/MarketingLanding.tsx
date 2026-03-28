import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, LayoutDashboard, PackageCheck, X, CheckCircle2, XCircle,
  ArrowRight, Upload, Lock, Shield, CheckCircle, Clock, ChevronDown,
  Plus, Minus, Sparkles, MessageSquare, ClipboardList, Zap,
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
import {
  useScrollReveal,
  usePrefersReducedMotion,
  useIsMobileAnimation,
} from '@/hooks/use-scroll-reveal';

/* ────── helpers ────── */
const SectionDivider = () => (
  <div className="max-w-5xl mx-auto px-6">
    <div className="h-px w-full" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }} />
  </div>
);

/** Animated counter that counts from 0 to target */
const CountUp = ({ target, duration = 1500, started, prefix = '', suffix = '' }: { target: number; duration?: number; started: boolean; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState('0');
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!started) { setDisplay('0'); return; }
    if (reduced) { setDisplay(formatNum(target)); return; }

    const isInt = Number.isInteger(target);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setDisplay(formatNum(isInt ? Math.round(current) : parseFloat(current.toFixed(1))));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration, reduced]);

  function formatNum(n: number) {
    if (n >= 1000) return n.toLocaleString();
    return String(n);
  }

  return <>{prefix}{display}{suffix}</>;
};

/* ────── Dashboard Mockup (hero) ────── */
const DashboardMockup = ({ visible }: { visible: boolean }) => {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobileAnimation();
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

  const baseStyle = reduced
    ? {}
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : isMobile ? 'none' : 'translateY(100px)',
        transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
      };

  return (
    <div className="relative mt-14 max-w-3xl mx-auto" style={baseStyle}>
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div className="surface-card overflow-hidden relative z-10" style={{ animation: 'mockup-border-pulse 3s ease-in-out infinite', border: '1px solid hsl(172 100% 38% / 0.3)' }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(36_91%_55%/0.6)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/50" />
          </div>
          <span className="text-[11px] text-muted-foreground ml-2 font-body">ClearPath — Active Cases</span>
        </div>
        <div className="divide-y divide-border/40">
          {cases.map((c, i) => {
            const rowStyle = reduced
              ? {}
              : {
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : isMobile ? 'translateX(0)' : 'translateX(-20px)',
                  transition: `opacity 0.35s ease-out ${0.5 + i * 0.15}s, transform 0.35s ease-out ${0.5 + i * 0.15}s`,
                };
            return (
              <div key={c.name} className="flex items-center gap-4 px-5 py-3.5" style={rowStyle}>
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ────── Stats Bar ────── */
const StatsBar = () => {
  const [ref, visible] = useScrollReveal<HTMLDivElement>(0.3);
  const reduced = usePrefersReducedMotion();
  const stats = [
    { value: 8.5, prefix: '', suffix: ' hrs', label: 'Saved per case vs. manual intake' },
    { value: 10600, prefix: '$', suffix: '', label: 'Monthly labor saved at Professional tier' },
    { value: 26, prefix: '', suffix: 'x', label: 'Average ROI for Professional firms' },
    { value: 15, prefix: '', suffix: '', label: 'Federal forms auto-filled by AI' },
  ];

  return (
    <div ref={ref} className="max-w-4xl mx-auto mt-10">
      <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] grid grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`text-center py-5 px-4 ${i < stats.length - 1 ? 'border-b lg:border-b-0 lg:border-r border-foreground/[0.08]' : ''} ${i % 2 === 0 && i < 2 ? 'border-r lg:border-r border-foreground/[0.08]' : ''}`}
            style={reduced ? {} : { opacity: visible ? 1 : 0, transition: `opacity 0.4s ease-out ${i * 0.1}s` }}
          >
            <p className="font-display font-bold text-2xl md:text-3xl text-primary">
              <CountUp target={s.value} started={visible} prefix={s.prefix} suffix={s.suffix} />
            </p>
            <p className="text-xs text-[#8aa3b8] font-body mt-1 leading-snug">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ────── Client Wizard Phone Mockup ────── */
const ClientWizardMockup = () => (
  <div className="w-[280px] mx-auto md:mx-0 flex-shrink-0">
    <div className="rounded-[2rem] border-2 border-foreground/[0.12] bg-background p-3 shadow-xl">
      <div className="rounded-[1.4rem] overflow-hidden border border-border/60 bg-card">
        <div className="flex items-center justify-center py-2 px-4">
          <div className="w-20 h-1 rounded-full bg-foreground/20" />
        </div>
        <div className="px-4 pb-5 pt-2 space-y-3">
          <p className="text-[10px] text-muted-foreground font-body">Step 3 of 8</p>
          <h4 className="font-display font-bold text-sm text-foreground leading-snug">Most recent pay stubs</h4>
          <button className="flex items-center gap-1.5 text-[11px] text-primary font-body">
            <ChevronDown className="w-3 h-3" />
            Why do we need this?
          </button>
          <div className="border border-dashed border-primary/30 rounded-lg bg-primary/[0.04] flex flex-col items-center justify-center py-6 gap-2">
            <Upload className="w-5 h-5 text-primary/60" />
            <p className="text-[10px] text-muted-foreground font-body">Tap to upload or take a photo</p>
          </div>
          <div className="rounded-full bg-primary py-2 text-center">
            <span className="text-xs font-bold text-primary-foreground">Continue</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ────── AI Form Filling Section ────── */
const AIFormFillingSection = () => {
  const [ref, visible] = useScrollReveal<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();

  const revealStyle = (delay = 0): React.CSSProperties =>
    reduced ? {} : {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.5s ease-out ${delay}s, transform 0.5s ease-out ${delay}s`,
    };

  const fields = [
    { label: 'Gross Monthly Income', value: '$4,833.00', confidence: 'High', source: 'Pay Stub — March 2026', color: 'bg-[rgba(34,197,94,0.15)] text-[rgb(34,197,94)]' },
    { label: 'Employer Name', value: 'Riverside Medical Group', confidence: 'High', source: 'Pay Stub — March 2026', color: 'bg-[rgba(34,197,94,0.15)] text-[rgb(34,197,94)]' },
    { label: 'Federal Tax Deduction', value: '$621.00', confidence: 'High', source: 'Pay Stub — March 2026', color: 'bg-[rgba(34,197,94,0.15)] text-[rgb(34,197,94)]' },
    { label: 'Net Monthly Pay', value: '$3,744.00', confidence: 'Medium', source: 'Conflict detected', color: 'bg-[rgba(251,191,36,0.15)] text-[rgb(251,191,36)]', conflict: true },
  ];

  const forms = [
    'B101 — Voluntary Petition', 'B106A/B — Property Schedule', 'B106C — Exemptions',
    'B106D — Secured Creditors', 'B106E/F — Unsecured Creditors', 'B106G — Executory Contracts',
    'B106H — Codebtors', 'B106I — Income', 'B106J — Expenses', 'B106 Summary',
    'B106 Declaration', 'B107 — Statement of Financial Affairs', 'B108 — Statement of Intention',
    'B122A-1 — Means Test', 'B122A-2 — Means Test Calculation',
  ];

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto" ref={ref}>
      <div className="text-center mb-12" style={revealStyle(0)}>
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-foreground leading-tight landing-heading-glow">
          Your paralegals should review forms.<br />
          <span className="text-primary">Not type them.</span>
        </h2>
        <p className="text-[#8aa3b8] font-body mt-4 max-w-2xl mx-auto leading-relaxed">
          Once documents are approved, ClearPath reads every file and<br className="hidden sm:block" />
          pre-fills all 15 official federal bankruptcy forms automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left — form extraction card */}
        <div style={revealStyle(0.1)}>
          <div className="rounded-xl p-6" style={{ background: '#111f2e', border: '1px solid rgba(0,194,168,0.15)' }}>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-primary" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span className="font-display font-bold text-sm text-foreground">B106I — Schedule I: Income</span>
              <span className="ml-auto text-xs text-primary font-body">Extraction Complete</span>
            </div>
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#8aa3b8] font-body">{f.label}</p>
                      <p className="text-[15px] text-foreground font-medium font-body">{f.value}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-body ${f.color}`}>{f.confidence}</span>
                  </div>
                  {f.conflict ? (
                    <>
                      <p className="text-[12px] italic font-body" style={{ color: 'rgb(168,85,247)' }}>Conflict detected</p>
                      <div className="mt-2 ml-2 space-y-1 text-[12px] font-body text-[#8aa3b8]">
                        <p>Pay Stub Feb: <span className="text-foreground">$3,744.00</span></p>
                        <p>Pay Stub Mar: <span className="text-foreground">$3,912.00</span></p>
                      </div>
                      <p className="text-[11px] italic text-[#8aa3b8] font-body mt-1">Paralegal selects correct value</p>
                    </>
                  ) : (
                    <p className="text-[12px] italic text-[#8aa3b8] font-body">{f.source}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[12px] text-[#8aa3b8] font-body text-center mt-4">
            Conflicts across documents detected and flagged automatically.
          </p>
        </div>

        {/* Right — form list */}
        <div style={revealStyle(0.2)}>
          <h3 className="font-display font-bold text-lg text-foreground mb-4">All 15 Ch.7 forms. Pre-filled.</h3>
          <ul className="space-y-2">
            {forms.map((f, i) => (
              <li key={i} className="flex items-center gap-2" style={revealStyle(0.25 + i * 0.03)}>
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground font-body">{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body" style={{ background: 'rgba(251,191,36,0.12)', color: 'rgb(251,191,36)' }}>
            <Zap className="w-3 h-3" />
            Available on Professional &amp; Firm plans
          </div>
        </div>
      </div>
    </section>
  );
};

/* ────── Main Component ────── */
const MarketingLanding = () => {
  const navigate = useNavigate();
  const [showDemo, setShowDemo] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobileAnimation();

  const handlePlan = (plan: PlanKey) => {
    sessionStorage.setItem('selected_plan', plan);
    navigate('/signup');
  };

  // Hero staggered entrance state
  const [heroLoaded, setHeroLoaded] = useState(false);
  useEffect(() => {
    if (reduced) { setHeroLoaded(true); return; }
    const t = requestAnimationFrame(() => setHeroLoaded(true));
    return () => cancelAnimationFrame(t);
  }, [reduced]);

  const heroStagger = (step: number) => {
    if (reduced) return {};
    const delay = step * 0.06;
    return {
      opacity: heroLoaded ? 1 : 0,
      transform: heroLoaded ? 'translateY(0)' : isMobile ? 'none' : 'translateY(20px)',
      transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`,
    };
  };

  const [beforeAfterRef, beforeAfterVisible] = useScrollReveal<HTMLDivElement>();
  const [howRef, howVisible] = useScrollReveal<HTMLDivElement>();
  const [featureRef, featureVisible] = useScrollReveal<HTMLDivElement>();
  const [clientRef, clientVisible] = useScrollReveal<HTMLDivElement>();
  const [pricingRef, pricingVisible] = useScrollReveal<HTMLDivElement>();
  const [faqRef, faqVisible] = useScrollReveal<HTMLDivElement>();
  const [ctaRef, ctaVisible] = useScrollReveal<HTMLDivElement>();

  const revealStyle = (
    isVisible: boolean,
    opts?: { delay?: number; x?: number; y?: number; scale?: number },
  ): React.CSSProperties => {
    if (reduced) return {};
    const { delay = 0, x = 0, y = isMobile ? 0 : 40, scale = 1 } = opts || {};
    const transforms: string[] = [];
    if (y && !isMobile) transforms.push(`translateY(${isVisible ? 0 : y}px)`);
    if (x && !isMobile) transforms.push(`translateX(${isVisible ? 0 : x}px)`);
    if (scale !== 1 && !isMobile) transforms.push(`scale(${isVisible ? 1 : scale})`);
    return {
      opacity: isVisible ? 1 : 0,
      transform: transforms.length ? transforms.join(' ') : undefined,
      transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`,
    };
  };

  // How-it-works sequential animation (now 4 steps → steps 1-9: c1, l1, c2, l2, c3, l3, c4, t1-t4)
  const [howStep, setHowStep] = useState(0);
  useEffect(() => {
    if (!howVisible || reduced) { if (howVisible) setHowStep(9); return; }
    const delays = [0, 150, 300, 450, 600, 750, 900, 1050, 1200];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 9; i++) {
      timers.push(setTimeout(() => setHowStep(i), delays[i - 1]));
    }
    return () => timers.forEach(clearTimeout);
  }, [howVisible, reduced]);

  const howSteps = [
    { num: '1', title: 'Create a Case', desc: 'A paralegal creates a case in seconds and sends the client a secure intake link via email or SMS. No client account required.', circleStep: 1, textStep: 1 },
    { num: '2', title: 'Client Uploads Documents', desc: 'The client follows a guided step-by-step walkthrough on any device — one document at a time, with AI validation on every upload.', circleStep: 3, textStep: 3 },
    { num: '3', title: 'AI Extracts & Pre-fills', desc: 'Once all documents are approved, ClearPath\'s AI reads every file and pre-fills all 15 federal bankruptcy forms automatically. Conflicts flagged instantly.', circleStep: 5, textStep: 5 },
    { num: '4', title: 'Review, Approve & File', desc: 'Paralegals review extracted data in minutes. Attorney approves. Court-ready packet generated with pre-filled forms included — one click.', circleStep: 7, textStep: 7 },
  ];

  return (
    <div className="min-h-screen" style={{ lineHeight: '1.7' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between" style={{ background: 'hsl(210 45% 11% / 0.8)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <Logo size="sm" />
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block nav-link-underline relative">Features</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block nav-link-underline relative">Pricing</a>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
          <Button size="sm" onClick={() => navigate('/signup')} className="landing-btn-glow">Start Free Trial</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 md:pt-28 pb-10 md:pb-14 text-center max-w-4xl mx-auto relative">
        {/* Subtle radial gradient for hero */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,194,168,0.04) 0%, transparent 60%)' }} />
        <h1 className="font-display font-extrabold text-4xl md:text-[3.5rem] text-foreground leading-tight relative landing-heading-glow" style={heroStagger(0)}>
          The bankruptcy firm that still<br />
          types data into federal forms<br />
          <span className="text-primary">is leaving money on the table.</span>
        </h1>
        <p
          className="mt-6 text-lg text-[#8aa3b8] font-body max-w-2xl mx-auto relative leading-relaxed"
          style={heroStagger(4)}
        >
          ClearPath collects documents from your clients automatically,<br className="hidden sm:block" />
          then pre-fills all 15 federal Ch.7 forms using AI —<br className="hidden sm:block" />
          so your paralegals review in minutes, not hours.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap relative" style={heroStagger(6)}>
          <Button size="lg" onClick={() => navigate('/signup')} className="landing-btn-glow">Start Free Trial</Button>
          <Button size="lg" variant="ghost" onClick={() => setShowDemo(true)} className="group">See How It Works <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></Button>
        </div>
        <p className="mt-6 text-sm text-[#8aa3b8] relative" style={heroStagger(8)}>
          ✓ 14-day free trial &nbsp;&nbsp; ✓ No credit card required &nbsp;&nbsp; ✓ Setup in 5 minutes
        </p>

        <DashboardMockup visible={heroLoaded} />
        <StatsBar />
      </section>

      <SectionDivider />

      {/* Before / After */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div ref={beforeAfterRef} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-stretch">
          <div
            className="rounded-2xl bg-destructive/[0.04] border border-destructive/10 border-l-4 border-l-destructive/40 p-6 landing-card-hover"
            style={revealStyle(beforeAfterVisible, { x: -60, y: 0 })}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">Before ClearPath</p>
            <ul className="space-y-3.5">
              {[
                'Email clients a 20-item document checklist and wait',
                'Chase missing documents for days over email and phone',
                'Paralegals retype data from PDFs into federal forms by hand',
                '7–11 hours of paralegal time per case',
                'Errors, omissions, and last-minute court scrambles',
                'Court packets assembled manually',
              ].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-destructive/70 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground/70 font-body">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden md:flex flex-col items-center justify-center gap-2 px-2" style={revealStyle(beforeAfterVisible, { delay: 0.4, y: 0 })}>
            <div className="w-px flex-1 bg-foreground/[0.08]" />
            <ArrowRight className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary text-center whitespace-nowrap">Your practice,<br />transformed</p>
            <div className="w-px flex-1 bg-foreground/[0.08]" />
          </div>
          <div className="flex md:hidden items-center justify-center gap-3 py-1" style={revealStyle(beforeAfterVisible, { delay: 0.2, y: 0 })}>
            <div className="h-px flex-1 bg-foreground/[0.08]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary whitespace-nowrap">Your practice, transformed</p>
            <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="h-px flex-1 bg-foreground/[0.08]" />
          </div>
          <div
            className="rounded-2xl bg-primary/[0.04] border border-primary/10 border-l-4 border-l-primary/50 p-6 landing-card-hover"
            style={revealStyle(beforeAfterVisible, { x: 60, y: 0 })}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">With ClearPath</p>
            <ul className="space-y-3.5">
              {[
                'Client guided through every document step by step — no emails',
                'AI validates every document the moment it\'s uploaded',
                'All 15 federal Ch.7 forms pre-filled automatically from approved documents',
                '~1 hour of paralegal time per case',
                'Attorney reviews and approves — nothing retyped',
                'Court-ready packet generated in one click',
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

      {/* AI Form Filling — NEW SECTION */}
      <AIFormFillingSection />

      <SectionDivider />

      {/* How it works */}
      <section id="features" className="px-6 py-12 max-w-5xl mx-auto">
        <h2 className="font-display font-extrabold text-3xl text-foreground text-center mb-12 landing-heading-glow">How it works</h2>
        <div ref={howRef} className="grid grid-cols-1 md:grid-cols-4 gap-0 items-start relative">
          {/* Dashed connector lines (desktop) */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="hidden md:block absolute top-5 border-t-2 border-dashed border-primary/25 origin-left"
              style={{
                left: `calc(${12.5 + i * 25}% + 20px)`,
                right: `calc(${62.5 - i * 25}% + 20px)`,
                ...(reduced ? {} : {
                  transform: howStep >= (i + 1) * 2 ? 'scaleX(1)' : 'scaleX(0)',
                  transition: 'transform 0.3s ease-out',
                }),
              }}
            />
          ))}
          {howSteps.map((step, i) => (
            <div key={step.num} className="flex flex-col items-center text-center px-4 py-4 relative z-10">
              <div
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mb-4"
                style={reduced ? {} : {
                  transform: howStep >= step.circleStep ? 'scale(1)' : isMobile ? 'scale(1)' : 'scale(0)',
                  opacity: howStep >= step.circleStep ? 1 : 0,
                  transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
                }}
              >
                <span className="font-display font-bold text-sm text-primary-foreground">{step.num}</span>
              </div>
              <div style={reduced ? {} : { opacity: howStep >= step.textStep ? 1 : 0, transition: 'opacity 0.3s ease-out' }}>
                <h3 className="font-display font-bold text-base text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-[#8aa3b8] font-body max-w-[220px]">{step.desc}</p>
              </div>
              {i < 3 && (
                <div className="md:hidden w-px h-8 border-l-2 border-dashed border-primary/25 mt-4" />
              )}
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Feature cards */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div ref={featureRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: 'Clients actually finish', desc: 'A guided step-by-step portal that walks clients through every document they need to upload. Adapts to each client\'s situation automatically.' },
            { icon: LayoutDashboard, title: 'Know exactly where every case stands', desc: 'Every case in one place, sorted by urgency. See who\'s done, who\'s stalled, and what needs your attention today.' },
            { icon: PackageCheck, title: 'Court-ready packets in one click', desc: 'Download an organized ZIP or compiled PDF of all approved documents and pre-filled federal forms, ready for court, in one click.' },
            { icon: Sparkles, title: 'AI Form Filling — All 15 Federal Forms', desc: 'ClearPath pre-fills every Ch.7 federal form from approved documents. B101 through B122A-2. Attorney reviews and approves — nothing retyped by hand.' },
            { icon: MessageSquare, title: 'AI catches mistakes before they reach you', desc: 'Gemini Vision AI reviews every uploaded document the moment it arrives. Wrong document type, blurry photo, wrong year — rejected instantly before it reaches your review queue.' },
            { icon: ClipboardList, title: 'Full audit trail on every case', desc: 'Every upload, approval, correction, and client interaction is logged with a timestamp and actor — so you always know exactly what happened and when.' },
          ].map((f, i) => (
            <div
              key={f.title}
              className="p-6 landing-card-hover rounded-2xl"
              style={{
                border: '0.5px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                background: 'hsl(var(--surface))',
                ...revealStyle(featureVisible, { delay: i * 0.1, y: 40 }),
              }}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                <f.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-[#8aa3b8] text-sm font-body font-light">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Client experience */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display font-extrabold text-3xl text-foreground mb-3 landing-heading-glow">Your clients will actually finish</h2>
          <p className="text-[#8aa3b8] font-body max-w-2xl mx-auto">
            ClearPath guides them through every document in plain English — one step at a time, on any device.
          </p>
        </div>
        <div ref={clientRef} className="flex flex-col md:flex-row items-center gap-10 md:gap-14 justify-center">
          <div style={revealStyle(clientVisible, { x: -60, y: 0 })}>
            <ClientWizardMockup />
          </div>
          <ul className="space-y-5 max-w-sm">
            {[
              'No confusing legal jargon',
              'Works on any phone or computer',
              'Saves progress automatically',
              'Clients know exactly what to do next',
            ].map((item, i) => (
              <li
                key={item}
                className="flex items-start gap-3"
                style={revealStyle(clientVisible, { delay: i * 0.08, x: 30, y: 0 })}
              >
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground font-body">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SectionDivider />

      {/* Trust bar */}
      <section style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { icon: Lock, text: 'Bank-level encryption' },
            { icon: Shield, text: 'Documents stored securely' },
            { icon: CheckCircle, text: 'Files encrypted in transit and at rest' },
            { icon: Clock, text: 'Automatic deadline tracking' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-[#8aa3b8]" />
              <span className="text-xs text-[#8aa3b8] font-body">{item.text}</span>
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
          <p className="mt-5 text-sm text-[#8aa3b8] italic font-body">
            Join the firms already using ClearPath
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* Pricing */}
      <section id="pricing" className="px-6 py-12 max-w-6xl mx-auto">
        <h2 className="font-display font-extrabold text-3xl text-foreground text-center mb-4 landing-heading-glow">Simple, transparent pricing</h2>
        <p className="text-[#8aa3b8] text-center mb-8 font-body">14-day free trial on every plan. No credit card required.</p>

        {/* Monthly/Annual Toggle */}
        <div className="flex items-center justify-center mb-10">
          <div className="inline-flex rounded-full p-1" style={{ background: 'hsl(var(--secondary))' }}>
            <button
              className={`px-5 py-2 rounded-full text-sm font-body font-medium transition-all ${!isAnnual ? 'bg-primary text-primary-foreground' : 'text-[#8aa3b8] hover:text-foreground'}`}
              onClick={() => setIsAnnual(false)}
            >
              Monthly
            </button>
            <button
              className={`px-5 py-2 rounded-full text-sm font-body font-medium transition-all ${isAnnual ? 'bg-primary text-primary-foreground' : 'text-[#8aa3b8] hover:text-foreground'}`}
              onClick={() => setIsAnnual(true)}
            >
              Annual <span className="text-xs opacity-80">2 months free</span>
            </button>
          </div>
        </div>

        <div ref={pricingRef}>
          <PricingCards onSelectPlan={handlePlan} buttonLabel="Start Free — No Card Needed" isAnnual={isAnnual} />
        </div>
        <div className="text-center mt-8 space-y-1">
          <p className="text-xs text-[#8aa3b8] font-body">
            Need more than 60 cases? Enterprise pricing available — <a href="mailto:hello@yourclearpath.app" className="text-primary hover:underline">contact us</a>.
          </p>
          <p className="text-xs text-[#8aa3b8] font-body">
            Overage: $25/case over your plan limit.
          </p>
          <p className="text-xs text-[#8aa3b8] font-body mt-4">
            Your data is protected with bank-level encryption.{' '}
            <a href="/security" className="text-primary hover:underline">Learn more</a>
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* FAQ */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <h2 className="font-display font-extrabold text-3xl text-foreground text-center mb-3 landing-heading-glow">Common questions</h2>
        <p className="text-[#8aa3b8] font-body text-center mb-10">Everything bankruptcy firms want to know before getting started.</p>
        <div ref={faqRef}>
          <Accordion type="single" collapsible className="space-y-2">
            {[
              {
                q: 'How does AI form filling work?',
                a: 'Once your paralegal approves all uploaded documents, ClearPath automatically sends each document to our AI engine, which reads and extracts the relevant data. That data is mapped to the correct fields across all 15 official federal bankruptcy forms. Your paralegal reviews the extracted fields, resolves any flagged conflicts, and your attorney approves before the forms are included in the court packet. Nothing is filed automatically — the attorney always has final review.',
              },
              {
                q: 'How do clients access their document portal?',
                a: 'When you create a case, ClearPath generates a secure, unique link for that client. You send it via email or SMS directly from the dashboard. Clients click the link and are guided through their document uploads step by step — no account creation, no app download, no login required.',
              },
              {
                q: 'Do clients need to create an account?',
                a: 'No. Clients access their portal via a secure unique link. They verify their identity with their date of birth and proceed directly to their document checklist. Zero friction for clients who are already stressed.',
              },
              {
                q: 'What happens if a client uploads the wrong document?',
                a: 'Our AI validates every document the moment it\'s uploaded. If the document doesn\'t match what\'s expected — wrong type, wrong year, unreadable image — the client is notified immediately and guided to upload the correct file. It never reaches your review queue.',
              },
              {
                q: 'Is client data secure?',
                a: 'Yes. All documents are encrypted at rest and in transit using TLS 1.3. Our infrastructure has an independently verified SSL A+ rating. We maintain a 7-year data retention policy matching federal bankruptcy recordkeeping requirements. We never share client data with third parties.',
              },
              {
                q: 'Which bankruptcy chapters do you support?',
                a: 'ClearPath fully supports Chapter 7 and Chapter 13. Each chapter has its own document checklist, conditional screener questions, and milestone tracker. AI form filling is currently available for Chapter 7, with Chapter 13 coming soon.',
              },
              {
                q: 'Can we customize the document checklist for our firm?',
                a: 'Yes. At every paid tier you can customize which documents are required, add custom document types, and configure the credit counseling provider link and attorney code. Firm tier includes full white-label branding so clients never see the ClearPath name.',
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border/60 rounded-xl px-5 data-[state=open]:bg-foreground/[0.02]"
                style={revealStyle(faqVisible, { delay: i * 0.06, y: 20 })}
              >
                <AccordionTrigger className="hover:no-underline py-5 [&>svg]:hidden">
                  <span className="text-left font-body text-sm font-medium text-foreground">{item.q}</span>
                  <Plus className="w-4 h-4 text-[#8aa3b8] flex-shrink-0 ml-4 block [[data-state=open]_&]:hidden" />
                  <Minus className="w-4 h-4 text-[#8aa3b8] flex-shrink-0 ml-4 hidden [[data-state=open]_&]:block" />
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#8aa3b8] font-body leading-relaxed pb-5 overflow-hidden transition-all duration-[250ms] ease-in-out">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <SectionDivider />

      {/* Final CTA */}
      <section className="px-6 py-16 md:py-20">
        <div
          ref={ctaRef}
          className="max-w-3xl mx-auto text-center rounded-2xl bg-primary/[0.06] border border-primary/10 px-8 py-14"
          style={revealStyle(ctaVisible, { y: 20, scale: 0.97 })}
        >
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-foreground mb-4 landing-heading-glow">
            Your next case could take<br />one hour instead of ten.
          </h2>
          <p className="text-[#8aa3b8] font-body mb-8 max-w-xl mx-auto">
            Start your free 14-day trial. No credit card. No commitment.<br />
            Set up your firm in under 5 minutes.
          </p>
          <Button size="lg" onClick={() => navigate('/signup')} className="cta-shimmer relative overflow-hidden landing-btn-glow">Start Free — No Card Needed</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="text-sm text-[#8aa3b8] font-body">Bankruptcy document intake, simplified.</span>
            </div>
            <span className="text-[12px] text-[#8aa3b8] font-body md:ml-11">
              Chapter 7 &amp; 13 · AI Form Filling · Court Packet Generation
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8aa3b8]">
            <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground">Terms of Service</a>
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
              <p className="text-[#8aa3b8] font-body">Demo video coming soon</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingLanding;
