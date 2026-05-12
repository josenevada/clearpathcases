import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText, LayoutDashboard, PackageCheck, CheckCircle2, XCircle,
  ArrowRight, Lock, Shield, CheckCircle, ChevronDown, Clock,
  Plus, Minus, MessageSquare, ClipboardList,
  Building, UploadCloud, ChevronRight, Download, Circle, Mail, Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import PricingCards from '@/components/PricingCards';
import AlexChatDemo from '@/components/AlexChatDemo';
import EnterpriseInquiryModal from '@/components/EnterpriseInquiryModal';
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
import { useAuth } from '@/lib/auth';

/* ────── helpers ────── */
const SectionDivider = () => (
  <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }} />
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
  const [ref, inView] = useScrollReveal<HTMLDivElement>(0.2);
  const show = visible || inView;

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

  const baseStyle: React.CSSProperties = reduced
    ? {}
    : {
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : isMobile ? 'none' : 'translateY(30px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      };

  return (
    <div ref={ref} className="relative mt-8 max-w-3xl mx-auto" style={{ ...baseStyle, overflow: 'visible', border: 'none', borderLeft: 'none', outline: 'none' }}>
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div
        className="surface-card relative z-10 mockup-border-animate pb-4"
        style={{
          border: '1px solid hsl(172 100% 38% / 0.3)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4), 0 0 40px rgba(0,194,168,0.06)',
          overflow: 'visible',
        }}
      >
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
            const rowStyle: React.CSSProperties = reduced
              ? {}
              : {
                  opacity: show ? 1 : 0,
                  transform: show ? 'translateX(0)' : isMobile ? 'translateX(0)' : 'translateX(-20px)',
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
    { value: 0, prefix: '', suffix: '', label: 'Emails chasing documents', displayOverride: 'Zero' },
    { value: 0, prefix: '', suffix: '', label: 'Average client intake completion time', displayOverride: '15 min' },
    { value: 0, prefix: '', suffix: '', label: 'Clients can upload on their schedule', displayOverride: '24/7' },
    { value: 0, prefix: '', suffix: '', label: 'To create a case and send the intake link', displayOverride: '60 sec' },
  ];

  return (
    <div
      ref={ref}
      className="max-w-4xl mx-auto mt-10"
      style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="text-center py-6 px-4"
            style={{
              borderRight: i < stats.length - 1 && i !== 1 ? '0.5px solid rgba(255,255,255,0.06)' : undefined,
              ...(i === 1 ? { borderRight: '0.5px solid rgba(255,255,255,0.06)' } : {}),
              ...(reduced ? {} : { opacity: visible ? 1 : 0, transition: `opacity 0.4s ease-out ${i * 0.1}s` }),
            }}
          >
            <p className="font-display font-bold text-[28px] md:text-[42px] text-primary" style={{ letterSpacing: '-0.01em', lineHeight: '1' }}>
              {(s as any).displayOverride ? ((s as any).displayOverride) : <CountUp target={s.value} started={visible} prefix={s.prefix} suffix={s.suffix} />}
            </p>
            <p className="text-xs text-[#8aa3b8] font-body mt-2 leading-snug">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};


/* ────── Interactive Feature Showcase ────── */
const showcaseFeatures = [
  {
    icon: ClipboardList,
    title: 'Guided client wizard',
    desc: 'Step-by-step intake built for non-technical clients. Works on any phone.',
  },
  {
    icon: MessageSquare,
    title: 'Alex — AI document guide',
    desc: 'Clients ask where to find documents. Alex answers with specific steps and direct links.',
  },
  {
    icon: Building,
    title: 'Bank connection via Plaid',
    desc: 'Clients connect their bank once. Six months of statements arrive instantly.',
  },
  {
    icon: LayoutDashboard,
    title: 'Organized on arrival',
    desc: 'Every document lands in the right category. The paralegal opens a case ready to review.',
  },
];

const ROTATION_MS = 4000;

const VIDEO_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/marketing-videos`;

const FeatureVideo = ({ src, motionKey }: { src: string; motionKey: string }) => (
  <motion.div
    key={motionKey}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.25 }}
  >
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      style={{
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: '12px',
        display: 'block',
        objectFit: 'contain',
      }}
    >
      <source src={src} type="video/mp4" />
    </video>
  </motion.div>
);

const MockupWizard = () => (
  <FeatureVideo motionKey="wizard" src={`${VIDEO_BASE}/pay-stubs-workflow.mp4`} />
);

const MockupAlex = () => (
  <FeatureVideo motionKey="alex" src={`${VIDEO_BASE}/ask-alex.mp4`} />
);

const MockupPlaid = () => (
  <FeatureVideo motionKey="plaid" src={`${VIDEO_BASE}/connecting-bank.mp4`} />
);

const MockupOrganized = () => (
  <FeatureVideo motionKey="organized" src={`${VIDEO_BASE}/reminders-approve.mp4`} />
);

const FeatureShowcase = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showcaseRef, showcaseVisible] = useScrollReveal<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => {
      setActive(a => (a + 1) % showcaseFeatures.length);
    }, ROTATION_MS);
    return () => clearInterval(t);
  }, [paused, reduced]);

  const mockups = [<MockupWizard />, <MockupAlex />, <MockupPlaid />, <MockupOrganized />];

  return (
    <section
      ref={showcaseRef}
      id="features"
      className="px-6 py-20 max-w-7xl mx-auto scroll-mt-24"
      style={{
        opacity: showcaseVisible ? 1 : 0,
        transform: showcaseVisible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
      }}
    >
      <h2 className="font-display font-bold text-[28px] md:text-[36px] text-foreground text-center mb-4">
        Everything your intake workflow needs
      </h2>
      <p className="text-[15px] text-[#8aa3b8] font-body font-light text-center mb-12">
        Click any feature to see how it works.
      </p>

      <div
        className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 items-start overflow-visible"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div>
          {showcaseFeatures.map((f, i) => {
            const Icon = f.icon;
            const isActive = i === active;
            return (
              <button
                key={f.title}
                onClick={() => setActive(i)}
                className={`w-full text-left py-4 px-3 border-b border-white/[0.06] transition-colors ${
                  isActive ? 'border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      isActive ? 'bg-primary/10 border-primary/20' : 'bg-secondary/50 border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-body font-semibold text-[16px] ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {f.title}
                    </p>
                    {isActive && (
                      <p className="text-[14px] text-[#8aa3b8] font-body font-light mt-1.5" style={{ lineHeight: '1.6' }}>
                        {f.desc}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="overflow-visible">
          <div className="overflow-visible">
            <AnimatePresence mode="wait">{mockups[active]}</AnimatePresence>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {showcaseFeatures.map((_, i) => (
              <div key={i} className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: i < active ? '100%' : i === active ? (paused || reduced ? '50%' : '100%') : '0%',
                    transition: i === active && !paused && !reduced ? `width ${ROTATION_MS}ms linear` : 'width 0.2s ease-out',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ────── Main Component ────── */
const MarketingLanding = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  

  // Redirect authenticated users straight to the dashboard so they never see the marketing page.
  useEffect(() => {
    if (!loading && user) {
      navigate('/paralegal', { replace: true });
    }
  }, [user, loading, navigate]);
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobileAnimation();

  const handlePlan = (plan: PlanKey) => {
    sessionStorage.setItem('selected_plan', plan);
    navigate('/signup');
  };

  // Hero staggered entrance state
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [enterpriseModalOpen, setEnterpriseModalOpen] = useState(false);
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
      transform: heroLoaded ? 'translateY(0)' : isMobile ? 'none' : 'translateY(16px)',
      transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`,
    };
  };

  const [comparisonRef, comparisonVisible] = useScrollReveal<HTMLDivElement>();
  const [alexRef, alexVisible] = useScrollReveal<HTMLDivElement>();
  const [twoViewsRef, twoViewsVisible] = useScrollReveal<HTMLDivElement>();
  const [beforeAfterState, setBeforeAfterState] = useState<'before' | 'after'>('before');

  useEffect(() => {
    const id = setInterval(() => {
      setBeforeAfterState((s) => (s === 'before' ? 'after' : 'before'));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const toggleBeforeAfter = (next: 'before' | 'after') => {
    setBeforeAfterState(next);
  };
  
  const [pricingRef, pricingVisible] = useScrollReveal<HTMLDivElement>();
  const [faqRef, faqVisible] = useScrollReveal<HTMLDivElement>();
  const [ctaRef, ctaVisible] = useScrollReveal<HTMLDivElement>();

  const revealStyle = (
    isVisible: boolean,
    opts?: { delay?: number; x?: number; y?: number; scale?: number },
  ): React.CSSProperties => {
    if (reduced) return {};
    const { delay = 0, x = 0, y = isMobile ? 0 : 16, scale = 1 } = opts || {};
    const transforms: string[] = [];
    if (y && !isMobile) transforms.push(`translateY(${isVisible ? 0 : y}px)`);
    if (x && !isMobile) transforms.push(`translateX(${isVisible ? 0 : x}px)`);
    if (scale !== 1 && !isMobile) transforms.push(`scale(${isVisible ? 1 : scale})`);
    return {
      opacity: isVisible ? 1 : 0,
      transform: transforms.length ? transforms.join(' ') : undefined,
      transition: `opacity 0.5s ease-out ${delay}s, transform 0.5s ease-out ${delay}s`,
    };
  };

  const faqItems = [
    {
      q: 'What is Alex?',
      preview: 'An AI assistant built into the wizard that answers client document questions instantly.',
      a: 'Alex is an AI assistant built into the client intake wizard. When clients get stuck — they don\'t know where to find a document, what it looks like, or how to get it — they ask Alex. Alex answers in plain English with specific guidance and direct links to the right source. Available on every document step, 24/7.',
    },
    {
      q: 'How does the client experience work?',
      preview: 'Clients get a secure link and complete intake in about 15 minutes on their phone.',
      a: 'When you create a case, ClearPath sends your client a secure link via SMS and email. They verify their identity, then follow a guided wizard through each required document one at a time. Plain English instructions tell them exactly what to upload and why. Most clients complete the full intake on their phone without calling the firm once.',
    },
    {
      q: 'What if a client doesn\'t finish uploading?',
      preview: 'Automatic reminders go out so your team never has to chase.',
      a: 'ClearPath automatically sends SMS and email reminders when a client hasn\'t completed their intake. Reminders are targeted — if a client uploaded some documents but not others, they receive a message listing exactly what\'s still missing.',
    },
    {
      q: 'How are documents organized when they arrive?',
      preview: 'Everything is sorted into six categories automatically before you open the case.',
      a: 'Documents are automatically organized into six categories — Income & Employment, Bank & Financial Accounts, Debts & Credit, Assets & Property, Personal Identification, and Agreements & Confirmation. When your paralegal opens a case they see a clean organized view, not a pile of files to sort through.',
    },
    {
      q: 'Does ClearPath work for Chapter 13?',
      preview: 'Yes — both Chapter 7 and Chapter 13 are fully supported.',
      a: 'ClearPath supports both Chapter 7 and Chapter 13. Each chapter has its own document checklist and screener questions.',
    },
    {
      q: 'How long does setup take?',
      preview: 'Your first case in under 60 seconds. No training required.',
      a: 'Create your account, set up your firm profile, and send your first client link in under 60 seconds. No training required — the workflow is intuitive enough that paralegals pick it up immediately.',
    },
  ];

  return (
    <div className="min-h-screen" style={{ lineHeight: '1.7', background: 'hsl(var(--background))', overflow: 'visible', border: 'none', borderLeft: 'none', outline: 'none', boxShadow: 'none' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(13,27,42,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="cursor-pointer" aria-label="Scroll to top">
          <Logo size="sm" />
        </button>
        <div className="flex items-center gap-4">
          <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm text-muted-foreground hover:text-primary hidden sm:block transition-colors duration-150 nav-link-underline relative cursor-pointer">Features</a>
          <a href="#pricing" onClick={e => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm text-muted-foreground hover:text-primary hidden sm:block transition-colors duration-150 nav-link-underline relative cursor-pointer">Pricing</a>
          <a
            href="https://calendly.com/hello-yourclearpath/20min"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-body text-muted-foreground hover:text-primary transition-colors duration-150 nav-link-underline relative cursor-pointer"
          >
            Book a Call
          </a>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
          <Button size="sm" onClick={() => navigate('/signup')} className="landing-btn-glow">Start Free — No Card Needed</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 md:pt-20 pb-2 md:pb-4 text-center max-w-4xl mx-auto relative" style={{ background: 'hsl(var(--background))', overflow: 'visible', border: 'none', borderLeft: 'none', outline: 'none' }}>
        <h1
          className="font-display font-bold text-[34px] md:text-[52px] text-foreground relative landing-heading-glow mx-auto"
          style={{ ...heroStagger(0), letterSpacing: '-0.01em', lineHeight: '1.08', maxWidth: '720px' }}
        >
          The document intake tool built for bankruptcy firms.
        </h1>
        <p
          className="mt-6 text-[15px] md:text-lg text-[#8aa3b8] font-body font-light max-w-2xl mx-auto relative"
          style={{ ...heroStagger(4), lineHeight: '1.7' }}
        >
          Send clients a guided intake link. They upload everything from their phone. You open the case to find it organized and ready.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap relative" style={heroStagger(6)}>
          <Button size="lg" onClick={() => navigate('/signup')} className="landing-btn-glow" style={{ padding: '14px 28px' }}>Start Free — No Card Needed</Button>
          <Button size="lg" variant="ghost" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="group" style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '14px 28px' }}>
            See How it Works <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
        <p className="mt-6 text-sm text-[#8aa3b8] relative" style={heroStagger(8)}>
          ✓ 30-day free trial &nbsp;&nbsp; ✓ No credit card required &nbsp;&nbsp; ✓ First case in 60 seconds
        </p>

        {/* Capability pills */}
        <div className="flex justify-center mt-4 relative gap-2 flex-wrap" style={heroStagger(9)}>
          <span
            className="font-body text-[13px] text-[#8aa3b8]"
            style={{
              border: '0.5px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              padding: '8px 20px',
              borderRadius: '100px',
              display: 'inline-block',
            }}
          >
            Built for Chapter 7 &amp; Chapter 13
          </span>
          <span className="font-body bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-2 text-[13px]">
            ✦ Includes Alex, your clients' AI guide
          </span>
        </div>

        <DashboardMockup visible={heroLoaded} />
        <StatsBar />
      </section>

      <SectionDivider />

      {/* Comparison grid — moved up before See the difference */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div ref={comparisonRef} style={revealStyle(comparisonVisible)}>
          <h2 className="font-display font-bold text-[28px] md:text-[36px] text-foreground text-center mb-4">
            Built for how bankruptcy actually works
          </h2>
          <p className="text-[15px] text-[#8aa3b8] font-body font-light text-center mb-12">
            See how ClearPath compares to how most firms collect documents today.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-4 pr-6 min-w-[200px]"></th>
                  <th className="py-4 px-3 text-center">
                    <span className="text-[11px] font-semibold font-body text-muted-foreground bg-secondary/50 rounded-full px-3 py-1 inline-block">Email & PDF</span>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <span className="text-[11px] font-semibold font-body text-muted-foreground bg-secondary/50 rounded-full px-3 py-1 inline-block">Google Forms</span>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <span className="text-[11px] font-semibold font-body text-muted-foreground bg-secondary/50 rounded-full px-3 py-1 inline-block">Generic Software</span>
                  </th>
                  <th className="py-4 px-3 text-center bg-primary/[0.03]">
                    <span className="text-[11px] font-semibold font-body text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 inline-block">ClearPath</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Client guided step by step', cols: ['x', 'x', '-', 'check'] },
                  { label: 'AI guide answers client questions', cols: ['x', 'x', 'x', 'alex'] },
                  { label: 'Bank statements via Plaid', cols: ['x', 'x', 'x', 'plaid'] },
                  { label: 'Automatic SMS reminders', cols: ['x', 'x', '-', 'check'] },
                  { label: 'Documents organized by category', cols: ['x', 'x', '-', 'check'] },
                  { label: 'Works on any phone — no app needed', cols: ['-', '-', '-', 'check'] },
                  { label: 'Secure portal — no login required', cols: ['x', 'x', 'x', 'check'] },
                  { label: 'One-click court-ready ZIP export', cols: ['x', 'x', '-', 'check'] },
                  { label: 'Paralegal review dashboard', cols: ['x', 'x', '-', 'check'] },
                  { label: 'Correction requests sent to client automatically', cols: ['x', 'x', 'x', 'check'] },
                  { label: 'Custom document templates per firm', cols: ['x', 'x', 'x', 'check'] },
                  { label: 'Personalized checklist per client', cols: ['x', 'x', 'x', 'check'] },
                  { label: 'Flat monthly pricing — not per case', cols: ['-', '-', 'x', 'check'] },
                ].map((row, rowIdx) => (
                  <tr key={row.label} className={rowIdx % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                    <td className="text-[14px] text-foreground font-body font-medium py-4 pr-6 min-w-[200px]">
                      {row.label}
                    </td>
                    {row.cols.map((cell, colIdx) => {
                      const isClearPath = colIdx === 3;
                      return (
                        <td
                          key={colIdx}
                          className={`py-4 px-3 text-center ${isClearPath ? 'bg-primary/[0.03]' : ''}`}
                        >
                          <div className="flex items-center justify-center">
                            {cell === 'x' && <XCircle className="text-destructive/60 w-4 h-4" />}
                            {cell === 'check' && <CheckCircle2 className="text-primary w-4 h-4" />}
                            {cell === '-' && <span className="text-muted-foreground">—</span>}
                            {cell === 'alex' && (
                              <>
                                <CheckCircle2 className="text-primary w-4 h-4" />
                                <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2">Alex</span>
                              </>
                            )}
                            {cell === 'plaid' && (
                              <>
                                <CheckCircle2 className="text-primary w-4 h-4" />
                                <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2">Plaid</span>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* See the difference — unified before/after for both parties */}
      <section
        ref={twoViewsRef}
        className="px-6 py-20 max-w-6xl mx-auto"
        style={revealStyle(twoViewsVisible)}
      >
        <h2 className="font-display font-bold text-[28px] md:text-[40px] text-foreground text-center" style={{ letterSpacing: '-0.01em', lineHeight: '1.1' }}>
          See the difference.
        </h2>
        <p className="text-[15px] text-[#8aa3b8] font-body font-light text-center mt-4 max-w-2xl mx-auto">
          Before ClearPath, both sides suffered. After, everyone wins.
        </p>

        {/* Toggle pills */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            type="button"
            onClick={() => toggleBeforeAfter('before')}
            className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
              beforeAfterState === 'before'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground border border-transparent'
            }`}
          >
            Before ClearPath
          </button>
          <button
            type="button"
            onClick={() => toggleBeforeAfter('after')}
            className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
              beforeAfterState === 'after'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground border border-transparent'
            }`}
          >
            With ClearPath
          </button>
        </div>

        {/* Two-column unified before/after */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 items-start">
          {/* LEFT — Your client */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 text-center">
              Your client
            </p>
            <AnimatePresence mode="wait">
              {beforeAfterState === 'before' ? (
                <motion.div
                  key="client-before"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="overflow-hidden mx-auto"
                  style={{ background: '#ffffff', border: '1px solid #e2e6ea', borderRadius: 16, maxWidth: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
                >
                  {/* Storage warning banner */}
                  <div style={{ background: '#fef7e0', borderBottom: '1px solid #f9ab00', padding: '6px 16px' }}>
                    <span style={{ fontSize: 11, color: '#7a5900' }}>⚠️ Storage 94% full — upgrade to receive attachments</span>
                  </div>
                  <div style={{ background: '#f1f3f4', padding: '10px 16px', borderBottom: '1px solid #e2e6ea', fontFamily: '"Times New Roman", serif' }}>
                    <span className="font-semibold text-[12px]" style={{ color: '#1a1a1a' }}>📧 New message from: Sarah Mitchell Law</span>
                  </div>
                  <div style={{ padding: 16, fontFamily: '"Times New Roman", serif' }}>
                    <p style={{ fontSize: 13, fontWeight: 'bold', color: '#1a1a1a' }}>
                      IMPORTANT: Documents needed for your Chapter 7 bankruptcy filing — PLEASE READ CAREFULLY
                    </p>
                    <p style={{ fontSize: 12, color: '#444', lineHeight: 1.6, marginTop: 8, fontFamily: '"Times New Roman", serif' }}>
                      Dear Kevin James, As per our previous correspondence, please find attached herewith the required documentation checklist for the purposes of your Chapter 7 bankruptcy proceeding. Kindly ensure all items are gathered and submitted to this office via email reply at your EARLIEST convenience. Failure to provide documentation in a timely manner may result in delays to your case. If you have questions please telephone the office during normal business hours (Mon-Fri, 9am-5pm only).
                    </p>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5" style={{ color: '#1a75d2' }} />
                        <span className="text-[11px]" style={{ color: '#1a75d2' }}>Bankruptcy_Checklist_FINAL_v3_USE_THIS_ONE.pdf</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5" style={{ color: '#999' }} />
                        <span className="text-[11px]" style={{ color: '#999', textDecoration: 'line-through' }}>Bankruptcy_Checklist_v2_OLD.pdf</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5" style={{ color: '#1a75d2' }} />
                        <span className="text-[11px]" style={{ color: '#1a75d2' }}>Instructions_READ_FIRST.docx</span>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5" style={{ fontFamily: '"Times New Roman", serif' }}>
                      {[
                        'Paystubs — most recent 60 days (biweekly = 4 stubs, weekly = 8 stubs, note: must show YTD)',
                        'W-2 Wage statements — tax years 2022 AND 2023 (both years required, no exceptions)',
                        'Federal 1040 tax returns — 2022 and 2023 (all pages, all schedules, all attachments)',
                        'Bank statements — ALL accounts, ALL institutions, last 6 months (savings AND checking AND any joint accounts)',
                        "Government-issued photo ID (driver's license OR passport — NOT expired)",
                        'Social Security card (original or certified copy — photocopies may not be accepted)',
                        'Credit card statements — last 3 months per card (ALL cards)',
                        'Loan documentation — auto, personal, student (see attached instructions re: format)',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ fontSize: 11, color: '#444' }}>
                          <span className="w-3 h-3 inline-block flex-shrink-0 mt-0.5" style={{ border: '1px solid #b0b6bd', borderRadius: 2 }} />
                          <span>{item}</span>
                        </li>
                      ))}
                      <li className="flex items-start gap-2" style={{ fontSize: 11, color: '#d93025', fontWeight: 'bold' }}>
                        <span className="w-3 h-3 inline-block flex-shrink-0 mt-0.5" style={{ border: '1px solid #d93025', borderRadius: 2 }} />
                        <span>⚠️ See page 2 for additional required items</span>
                      </li>
                    </ul>
                    <p className="text-[11px] italic text-center mt-3 pb-2" style={{ color: '#888' }}>
                      😰 Which version do I use? What's page 2? What's YTD?
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="client-after"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                >
                  <motion.div
                    animate={reduced ? undefined : { y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: 260,
                      height: 520,
                      borderRadius: 40,
                      background: '#0d1a27',
                      border: '8px solid #1a2d42',
                      boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,194,168,0.15)',
                      margin: '0 auto',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: 80, height: 20, background: '#1a2d42', borderRadius: '0 0 12px 12px', margin: '0 auto' }} />
                    <div style={{ height: 3, background: '#00C2A8', width: '28%' }} />
                    <div className="flex items-center justify-between" style={{ padding: '8px 14px' }}>
                      <span className="font-display font-bold text-[11px] text-primary">ClearPath</span>
                      <span className="text-[10px] text-muted-foreground">Step 1 of 6</span>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-display font-bold text-[15px] text-foreground mt-2">Pay Stubs</h3>
                      <p className="text-[11px] text-primary/80 mt-1">Proves your current income to the court.</p>
                      <div
                        style={{
                          border: '1.5px dashed rgba(0,194,168,0.25)',
                          borderRadius: 12,
                          padding: '16px 10px',
                          textAlign: 'center',
                          marginTop: 10,
                          background: 'rgba(0,194,168,0.02)',
                        }}
                      >
                        <UploadCloud className="w-5 h-5 text-primary/50 mx-auto mb-1" />
                        <p className="text-[11px] text-muted-foreground">Tap to upload</p>
                      </div>
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 20,
                          padding: '5px 12px',
                          fontSize: 11,
                          color: '#7FA0B8',
                          marginTop: 10,
                          display: 'inline-block',
                        }}
                      >
                        💬 Ask Alex
                      </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', background: 'rgba(13,26,40,0.95)' }}>
                      <div
                        className="bg-primary text-primary-foreground font-body font-semibold text-[12px] text-center"
                        style={{ borderRadius: 10, padding: '10px 14px' }}
                      >
                        Continue →
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            {beforeAfterState === 'before' ? (
              <p className="text-destructive/60 text-[12px] text-center mt-3">
                Confused. Overwhelmed. Likely to give up.
              </p>
            ) : (
              <p className="text-[13px] text-[#8aa3b8] font-body font-light text-center mt-6">
                Guided step by step. Done in 15 minutes.
              </p>
            )}
          </div>

          {/* RIGHT — Your firm */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 text-center">
              Your firm
            </p>
            <AnimatePresence mode="wait">
              {beforeAfterState === 'before' ? (
                <motion.div
                  key="firm-before"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="overflow-hidden mx-auto"
                  style={{ background: '#ffffff', border: '1px solid #e2e6ea', borderRadius: 16, maxWidth: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
                >
                  {/* Urgent banner */}
                  <div style={{ background: '#fce8e6', borderBottom: '1px solid #d93025', padding: '6px 16px' }}>
                    <span style={{ fontSize: 11, color: '#c5221f' }}>🔴 4 messages marked URGENT — filing deadlines at risk</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ background: '#f1f3f4', padding: '10px 16px', borderBottom: '1px solid #e2e6ea' }}>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" style={{ color: '#444' }} />
                      <span className="font-semibold text-[12px]" style={{ color: '#1a1a1a' }}>Inbox (47 unread)</span>
                    </div>
                    <span className="text-[10px] font-semibold text-white rounded-full px-2 py-0.5" style={{ background: '#d93025' }}>47 unread</span>
                  </div>
                  <div>
                    {[
                      { who: 'Kevin J.', subj: 'RE: RE: RE: RE: RE: bank statements — STILL waiting', when: '4 days ago', bold: true, unread: true, color: '#1a1a1a', subjColor: '#444', padX: 18 },
                      { who: 'Mail Delivery', subj: '⚠️ Delivery Failed: your message to kevin.james@gmail...', when: '3 days ago', bold: false, unread: false, color: '#d93025', subjColor: '#d93025', padX: 14 },
                      { who: 'Maria R.', subj: '(no subject)', when: '3 days ago', bold: false, unread: true, color: '#1a1a1a', subjColor: '#888', padX: 18 },
                      { who: 'James C.', subj: 'I sent the files??? did you get them??? let me know', when: '5 days ago', bold: false, unread: true, color: '#1a1a1a', subjColor: '#444', padX: 14 },
                      { who: 'Auto-Reply', subj: 'Out of Office: I will return on...', when: '1 week ago', bold: false, unread: false, color: '#999', subjColor: '#999', italic: true, padX: 18 },
                      { who: 'Linda T.', subj: 'can you just call me i dont understand the email', when: '1 week ago', bold: false, unread: false, color: '#1a1a1a', subjColor: '#444', padX: 14 },
                      { who: 'Robert K.', subj: 'FWD: FWD: FWD: maybe these? not sure if right format lol', when: '2 weeks ago', bold: false, unread: false, color: '#1a1a1a', subjColor: '#444', padX: 18 },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center gap-3" style={{ padding: `9px ${e.padX}px`, borderBottom: '1px solid #e2e6ea', background: '#fff' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: '#e8eaed', color: '#444' }}>
                          {e.who.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] truncate" style={{ fontStyle: e.italic ? 'italic' : 'normal' }}>
                            <span style={{ color: e.color, fontWeight: e.bold ? 700 : 600 }}>{e.who}</span>
                            <span style={{ color: e.subjColor, fontWeight: e.bold ? 600 : 400 }}> — {e.subj}</span>
                          </p>
                        </div>
                        <span className="text-[10px] whitespace-nowrap" style={{ color: '#888' }}>{e.when}</span>
                        {e.unread && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#d93025' }} />}
                      </div>
                    ))}
                  </div>
                  {/* Sticky notes */}
                  <div className="flex flex-wrap gap-2" style={{ padding: '10px 16px', borderBottom: '1px solid #e2e6ea' }}>
                    <div style={{ background: '#fef7cd', border: '1px solid #f9ab00', borderRadius: 4, padding: '6px 10px', fontSize: 11, fontFamily: '"Comic Sans MS", cursive', color: '#5a4500', transform: 'rotate(-1deg)' }}>
                      📌 Call Kevin re: wrong docs AGAIN
                    </div>
                    <div style={{ background: '#fce4ec', border: '1px solid #e91e63', borderRadius: 4, padding: '6px 10px', fontSize: 11, fontFamily: '"Comic Sans MS", cursive', color: '#880e4f', transform: 'rotate(1.5deg)' }}>
                      📌 Maria — still missing 6 items — deadline FRI???
                    </div>
                  </div>
                  <p style={{ color: '#d93025', fontSize: 11, textAlign: 'center', padding: 10, fontWeight: 'bold' }}>
                    47 unread. 3 deadlines this week. 0 documents organized.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="firm-after"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="overflow-hidden mx-auto"
                  style={{
                    background: '#111f2e',
                    border: '1px solid rgba(0,194,168,0.25)',
                    borderRadius: 16,
                    maxWidth: 460,
                    boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Browser chrome */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-[13px] text-foreground">← Kevin James</span>
                      <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                        CH.7
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Due May 29</span>
                  </div>
                  <div className="px-4">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '78%' }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">78% complete</p>
                  </div>
                  <div className="mt-3">
                    {[
                      { name: 'Income & Employment', count: '4/4', state: 'done' },
                      { name: 'Bank & Financial', count: '2/2', state: 'done' },
                      { name: 'Debts & Credit', count: '2/4', state: 'partial' },
                      { name: 'Personal ID', count: '0/2', state: 'empty' },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-3 px-4"
                        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          {row.state === 'done' && <CheckCircle2 className="w-4 h-4 text-success" />}
                          {row.state === 'partial' && (
                            <div className="w-4 h-4 rounded-full border-2 border-warning relative overflow-hidden">
                              <div className="absolute inset-0 bg-warning" style={{ clipPath: 'inset(0 50% 0 0)' }} />
                            </div>
                          )}
                          {row.state === 'empty' && <Circle className="w-4 h-4 text-muted-foreground" />}
                          <span className="text-[12px] text-foreground/90">{row.name}</span>
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            row.state === 'done'
                              ? 'text-success'
                              : row.state === 'partial'
                              ? 'text-warning'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3">
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[12px] text-foreground/90">📱 Kevin uploaded 3 documents today</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">2 hours ago</p>
                      </div>
                      <button className="text-[11px] font-semibold text-primary">Review →</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 pb-4">
                    <button className="flex-1 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg py-2">
                      Approve All
                    </button>
                    <button className="flex-1 border border-border text-foreground text-[12px] font-semibold rounded-lg py-2">
                      Download ZIP
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {beforeAfterState === 'before' ? (
              <p className="text-destructive/60 text-[12px] text-center mt-3">
                Chasing documents. Missing deadlines.
              </p>
            ) : (
              <p className="text-[13px] text-[#8aa3b8] font-body font-light text-center mt-6">
                Organized on arrival. Ready to review.
              </p>
            )}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* Alex Spotlight */}
      <section ref={alexRef} className="py-20 px-6 max-w-5xl mx-auto" style={revealStyle(alexVisible)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left column */}
          <div>
            <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-[12px] font-semibold mb-4 inline-block">NEW</span>
            <h2 className="font-display text-[28px] md:text-[36px] font-bold text-foreground mb-4">
              Your clients will never feel lost again.
            </h2>
            <p className="text-[15px] text-[#8aa3b8] font-body font-light mb-6" style={{ lineHeight: '1.7' }}>
              We built Alex — a friendly AI assistant that lives inside the document wizard. When a client doesn't know where to find their bank statements or what a W-2 looks like, they ask Alex. Alex answers in plain English, gives them direct links, and walks them through exactly what to do. No calls to your office. No abandoned intake portals.
            </p>
            <ul className="space-y-3">
              {[
                'Available on every document step, 24/7',
                'Answers questions about any document type',
                'Guides clients to the exact source — ADP, IRS, Chase, and more',
              ].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <CheckCircle2 className="text-primary w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="text-[15px] text-[#8aa3b8] font-body font-light">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right column — chat mockup */}
          <AlexChatDemo />
        </div>
      </section>

      <SectionDivider />

      <div className="max-w-3xl mx-auto py-10 px-6 text-center">
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 items-center justify-center">
          <p className="text-[16px] font-body font-light" style={{ color: '#8aa3b8' }}>
            Ready to give your clients a better intake experience?
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="text-primary font-semibold text-[16px] hover:underline cursor-pointer"
          >
            Start your free trial →
          </button>
        </div>
      </div>

      <FeatureShowcase />

      <div className="py-10 text-center">
        <p className="text-[15px] text-[#8aa3b8] font-body font-light">
          Seen enough?{' '}
          <span
            onClick={() => navigate('/signup')}
            className="text-primary font-semibold cursor-pointer hover:underline"
          >
            Start your free trial — no card needed →
          </span>
        </p>
      </div>
      <SectionDivider />

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-7xl mx-auto">
        <h2 className="font-display font-bold text-[28px] md:text-[40px] text-foreground text-center mb-4 landing-heading-glow" style={{ letterSpacing: '-0.01em', lineHeight: '1.1' }}>
          Simple pricing.<br />Free to start.
        </h2>
        <p className="text-[15px] text-[#8aa3b8] text-center mb-8 font-body font-light">30-day free trial on every plan. No credit card required.</p>

        <div ref={pricingRef}>
          <PricingCards onSelectPlan={handlePlan} buttonLabel="Start Free — No Card Needed" showEnterprise onEnterpriseClick={() => setEnterpriseModalOpen(true)} />
        </div>
        <div className="text-center mt-8 space-y-1">
          <p className="text-xs text-[#8aa3b8] font-body mt-4">
            Your data is protected with bank-level encryption.{' '}
            <a href="/security" className="text-primary hover:underline" aria-label="Learn more about ClearPath security">Learn more about our security</a>
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* FAQ */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-[28px] md:text-[40px] text-foreground text-center mb-3 landing-heading-glow" style={{ letterSpacing: '-0.01em', lineHeight: '1.1' }}>Common questions</h2>
        <p className="text-[15px] text-[#8aa3b8] font-body font-light text-center mb-10">Everything bankruptcy firms want to know before getting started.</p>
        <div ref={faqRef}>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border/60 rounded-xl px-5 data-[state=open]:bg-foreground/[0.02]"
                style={revealStyle(faqVisible, { delay: i * 0.06, y: 16 })}
              >
                <AccordionTrigger className="hover:no-underline py-4 [&>svg]:hidden">
                  <div className="text-left flex-1">
                    <span className="font-body text-sm font-medium text-foreground block">{item.q}</span>
                    <span className="font-body text-[13px] font-light text-[#8aa3b8] block mt-0.5">{item.preview}</span>
                  </div>
                  <Plus className="w-4 h-4 text-[#8aa3b8] flex-shrink-0 ml-4 block [[data-state=open]_&]:hidden" />
                  <Minus className="w-4 h-4 text-[#8aa3b8] flex-shrink-0 ml-4 hidden [[data-state=open]_&]:block" />
                </AccordionTrigger>
                <AccordionContent className="text-[15px] text-[#8aa3b8] font-body font-light pb-5 overflow-hidden transition-all duration-[250ms] ease-in-out" style={{ lineHeight: '1.7' }}>
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <p className="text-center text-[14px] text-[#8aa3b8] font-body font-light mt-10">
          Still have questions?{' '}
          <a href="mailto:hello@yourclearpath.app" className="text-primary hover:underline">
            Email us at hello@yourclearpath.app
          </a>
          {' '}— we respond within one business day.
        </p>
      </section>

      <SectionDivider />

      {/* Final CTA — Redesigned */}
      <section
        className="px-6 py-16 md:py-20 relative"
        style={{ background: '#0a1520' }}
      >
        <div
          ref={ctaRef}
          className="max-w-3xl mx-auto text-center relative"
          style={revealStyle(ctaVisible, { y: 16 })}
        >
          <h2
            className="font-display font-bold text-[36px] md:text-[44px] text-foreground landing-heading-glow"
            style={{ letterSpacing: '-0.01em', lineHeight: '1.05' }}
          >
            The best intake experience<br />your clients have ever had.
          </h2>
          <p className="text-[#8aa3b8] font-body font-light text-[15px] md:text-[17px] mt-4 max-w-lg mx-auto" style={{ lineHeight: '1.7' }}>
            Stop chasing documents. Start your free trial and send your first case in 60 seconds.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/signup')}
            className="mt-8 cta-shimmer relative overflow-hidden transition-all duration-200"
            style={{
              boxShadow: '0 0 24px rgba(0,194,168,0.3)',
              padding: '14px 28px',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(0,194,168,0.45)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px) scale(1.01)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(0,194,168,0.3)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
            }}
          >
            Start Free — No Card Needed
          </Button>
          <p className="text-[13px] text-[#8aa3b8] font-body mt-4">
            30-day free trial · Cancel anytime · First case in 60 seconds
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8" style={{ background: '#070f18', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="text-sm text-[#8aa3b8] font-body">Bankruptcy document intake, simplified.</span>
            </div>
            <span className="text-[12px] text-[#8aa3b8] font-body md:ml-11">
              Chapter 7 &amp; 13 · Guided Client Intake
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8aa3b8]">
            <a href="/privacy" className="hover:text-foreground transition-colors duration-150">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors duration-150">Terms of Service</a>
            <a href="/sms-consent" className="hover:text-foreground transition-colors duration-150">SMS Policy</a>
            <a href="/security" className="hover:text-foreground transition-colors duration-150">Security</a>
            <a href="/login" className="hover:text-foreground transition-colors duration-150">Sign In</a>
          </div>
        </div>
      </footer>

      <EnterpriseInquiryModal open={enterpriseModalOpen} onOpenChange={setEnterpriseModalOpen} />
    </div>
  );
};

export default MarketingLanding;
