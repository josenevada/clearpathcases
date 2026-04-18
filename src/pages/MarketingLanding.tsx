import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText, LayoutDashboard, PackageCheck, X, CheckCircle2, XCircle,
  ArrowRight, Lock, Shield, CheckCircle, Clock, ChevronDown,
  Plus, Minus, Sparkles, MessageSquare, ClipboardList,
  Building, UploadCloud, ChevronRight, Download,
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
    <div ref={ref} className="relative mt-12 max-w-3xl mx-auto" style={{ ...baseStyle, overflow: 'visible', border: 'none', borderLeft: 'none', outline: 'none' }}>
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
    { value: 6, prefix: '', suffix: '', label: 'Document categories organized automatically' },
    { value: 0, prefix: '', suffix: '', label: 'Clients can upload on their schedule', displayOverride: '24/7' },
    { value: 5, prefix: '', suffix: ' min', label: 'Time to create and send your first case' },
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
            <p className="font-display font-bold text-[36px] md:text-[52px] text-primary" style={{ letterSpacing: '-0.01em', lineHeight: '1' }}>
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

const MockupWizard = () => (
  <motion.div
    key="wizard"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.25 }}
  >
    <div style={{
      position: 'relative',
      width: '100%',
      paddingTop: '56.25%',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#0B1623'
    }}>
      <iframe
        src="https://watchclueso.com/embed/ts2yv4p5qxllae0w?autoplay=1&muted=1&loop=1"
        frameBorder="0"
        // @ts-expect-error vendor-prefixed fullscreen attrs
        webkitallowfullscreen="true"
        mozallowfullscreen="true"
        allowFullScreen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px'
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
    </div>
  </motion.div>
);

type AlexBubble = { who: 'client' | 'alex'; text: string };

const ALEX_BUBBLES: AlexBubble[] = [
  { who: 'client', text: 'Where do I get my W-2?' },
  { who: 'alex', text: 'Log into your payroll portal — ADP at adp.com or Workday. Go to Pay & Tax → Tax Documents and download both years.' },
  { who: 'client', text: 'I use ADP' },
  { who: 'alex', text: 'Go to adp.com → Sign In → Pay & Tax → Tax Statements. Download 2023 and 2024. Takes 2 minutes ✓' },
];

const TYPE_CHAR_MS = 18;        // characters per ms for Alex
const CLIENT_PAUSE_MS = 500;    // pause after client message before Alex starts
const ALEX_THINK_MS = 600;      // typing dots before Alex types
const POST_ALEX_MS = 700;       // pause after Alex finishes before next message

type StepState = {
  visibleCount: number;          // 0..bubbles.length — how many bubbles exist (incl. typing)
  typing: boolean;               // is the current Alex bubble showing typing dots
  typedChars: number;            // chars revealed in the currently typing Alex bubble
};

const TypingDots = () => (
  <div className="bg-secondary rounded-2xl px-4 py-3 inline-flex items-center gap-1 mr-auto">
    {[0, 1, 2].map((d) => (
      <motion.span
        key={d}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
        style={{ display: 'inline-block' }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.12, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

const MockupAlex = () => {
  const [state, setState] = useState<StepState>({ visibleCount: 0, typing: false, typedChars: 0 });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const wait = (ms: number) => new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      timeouts.push(t);
    });

    const run = async () => {
      // small initial delay so the entrance fade can play
      await wait(300);
      for (let i = 0; i < ALEX_BUBBLES.length; i++) {
        if (cancelledRef.current) return;
        const b = ALEX_BUBBLES[i];
        if (b.who === 'client') {
          setState((s) => ({ visibleCount: i + 1, typing: false, typedChars: 0 }));
          await wait(CLIENT_PAUSE_MS);
        } else {
          // show typing indicator
          setState({ visibleCount: i + 1, typing: true, typedChars: 0 });
          await wait(ALEX_THINK_MS);
          if (cancelledRef.current) return;
          // start typewriter
          setState({ visibleCount: i + 1, typing: false, typedChars: 0 });
          await new Promise<void>((resolve) => {
            let chars = 0;
            const total = b.text.length;
            const iv = setInterval(() => {
              if (cancelledRef.current) {
                clearInterval(iv);
                resolve();
                return;
              }
              chars += 1;
              setState({ visibleCount: i + 1, typing: false, typedChars: chars });
              if (chars >= total) {
                clearInterval(iv);
                resolve();
              }
            }, TYPE_CHAR_MS);
            intervals.push(iv);
          });
          await wait(POST_ALEX_MS);
        }
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, []);

  return (
    <motion.div
      key="alex"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">A</div>
        <div>
          <p className="font-body font-semibold text-foreground text-sm">Alex</p>
          <p className="text-[11px] text-muted-foreground">Document Assistant</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {ALEX_BUBBLES.slice(0, state.visibleCount).map((b, i) => {
          const isCurrent = i === state.visibleCount - 1;
          if (b.who === 'client') {
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="ml-auto max-w-[80%] bg-primary/15 text-foreground rounded-2xl px-4 py-2.5 text-sm font-body"
              >
                {b.text}
              </motion.div>
            );
          }
          // Alex bubble
          if (isCurrent && state.typing) {
            return <TypingDots key={i} />;
          }
          const shown = isCurrent ? b.text.slice(0, state.typedChars) : b.text;
          const stillTyping = isCurrent && state.typedChars < b.text.length;
          return (
            <div
              key={i}
              className="mr-auto max-w-[80%] bg-secondary text-foreground rounded-2xl px-4 py-2.5 text-sm font-body"
            >
              {shown}
              {stillTyping && (
                <motion.span
                  className="inline-block w-[2px] h-[1em] bg-foreground/70 ml-0.5 align-middle"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const MockupPlaid = () => (
  <motion.div
    key="plaid"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.25 }}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="font-body font-bold text-[15px] text-foreground">Plaid</span>
      <div className="w-2 h-2 rounded-full bg-success" />
    </div>
    <p className="text-[13px] text-[#8aa3b8] font-body font-light mb-4">Connect your bank account securely.</p>
    <div className="flex flex-wrap gap-2 mb-4">
      {['Chase', 'Bank of America', 'Wells Fargo'].map(b => (
        <span key={b} className="bg-secondary rounded-full px-3 py-1 text-[12px] font-body text-foreground">{b}</span>
      ))}
    </div>
    <button className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-body font-semibold mb-3">
      Connect Bank Account
    </button>
    <p className="text-[11px] text-muted-foreground font-body text-center mb-4">
      10,000+ institutions supported · 256-bit encryption · Trusted by millions
    </p>
    <div className="rounded-xl bg-success/10 border border-success/20 px-3 py-2.5 flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
      <span className="text-success font-medium text-sm font-body">Connected — 6 months of statements ready</span>
    </div>
  </motion.div>
);

const MockupOrganized = () => {
  const cats = [
    { name: 'Income & Employment', count: '4/4', state: 'done' },
    { name: 'Bank & Financial', count: '2/2', state: 'done' },
    { name: 'Debts & Credit', count: '2/4', state: 'partial' },
    { name: 'Personal ID', count: '0/2', state: 'empty' },
  ];
  return (
    <motion.div
      key="organized"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <h4 className="font-display font-bold text-[16px] text-foreground mb-3">Kevin James — Chapter 7</h4>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: '78%' }} />
        </div>
        <span className="text-[11px] text-muted-foreground font-body">78% complete</span>
      </div>
      <div className="space-y-1.5 mb-4">
        {cats.map(c => (
          <div key={c.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02]">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[13px] text-foreground font-body flex-1">{c.name}</span>
            {c.state === 'done' && (
              <span className="flex items-center gap-1 text-success text-[11px] font-body font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />{c.count}
              </span>
            )}
            {c.state === 'partial' && (
              <span className="flex items-center gap-1 text-[hsl(36_91%_55%)] text-[11px] font-body font-semibold">
                <Clock className="w-3.5 h-3.5" />{c.count}
              </span>
            )}
            {c.state === 'empty' && (
              <span className="text-muted-foreground text-[11px] font-body">{c.count}</span>
            )}
          </div>
        ))}
      </div>
      <button className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-body font-semibold mb-2 inline-flex items-center justify-center gap-2">
        <Download className="w-4 h-4" />
        Download ZIP
      </button>
      <p className="text-center text-[12px] text-muted-foreground font-body underline cursor-pointer">View all documents</p>
    </motion.div>
  );
};

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
      className="px-6 py-20 max-w-6xl mx-auto"
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
        className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-12 items-start"
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

        <div>
          <div
            className="rounded-2xl p-6"
            style={{
              background: '#111f2e',
              border: '0.5px solid rgba(255,255,255,0.08)',
              minHeight: '380px',
            }}
          >
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
      transform: heroLoaded ? 'translateY(0)' : isMobile ? 'none' : 'translateY(16px)',
      transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`,
    };
  };

  const [comparisonRef, comparisonVisible] = useScrollReveal<HTMLDivElement>();
  const [alexRef, alexVisible] = useScrollReveal<HTMLDivElement>();
  const [wizRef, wizVisible] = useScrollReveal<HTMLDivElement>();
  const [howRef, howVisible] = useScrollReveal<HTMLDivElement>();
  const [featureRef, featureVisible] = useScrollReveal<HTMLDivElement>();
  
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

  // How-it-works sequential animation
  const [howStep, setHowStep] = useState(0);
  useEffect(() => {
    if (!howVisible || reduced) { if (howVisible) setHowStep(7); return; }
    const delays = [0, 150, 300, 450, 600, 750, 900];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 7; i++) {
      timers.push(setTimeout(() => setHowStep(i), delays[i - 1]));
    }
    return () => timers.forEach(clearTimeout);
  }, [howVisible, reduced]);

  const howSteps = [
    { num: '1', title: 'Create a case in 60 seconds', desc: 'Enter the client\'s name, contact info, and answer 7 screener questions. ClearPath builds a custom document checklist based on their specific situation automatically.', circleStep: 1, textStep: 1 },
    { num: '2', title: 'Client completes intake on their phone', desc: 'They receive a secure link via SMS and email. A guided wizard walks them through each document one at a time — with plain English instructions and help finding documents they can\'t locate. No app download needed.', circleStep: 3, textStep: 3 },
    { num: '3', title: 'Review organized, validated documents', desc: 'Every document arrives sorted by category with AI validation. Approve, request corrections, download, or send reminders — all from one place.', circleStep: 5, textStep: 5 },
  ];

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
      q: 'What happens if a client uploads the wrong document?',
      preview: 'AI validates every document instantly and tells the client right away.',
      a: 'ClearPath checks every uploaded document the moment it arrives — verifying document type, legibility, and flagging issues like wrong year or wrong account. If something is wrong the client sees an immediate message explaining what to fix. Corrections happen in real time, not days later when a paralegal reviews.',
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
      preview: 'Your first case in under 5 minutes. No training required.',
      a: 'Create your account, set up your firm profile, and send your first client link in under 5 minutes. No training required — the workflow is intuitive enough that paralegals pick it up immediately.',
    },
    {
      q: 'Will ClearPath add form filling and court packets?',
      preview: 'Yes — AI form filling and court packets are coming soon on paid plans.',
      a: 'AI form filling for all 15 federal Ch.7 forms, means test calculation, exemption analysis, and one-click court packet generation are currently in development. These features will be available on Professional and Firm plans. Customers on those plans will get early access when they launch.',
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
        <Logo size="sm" />
        <div className="flex items-center gap-4">
          <a href="#features" onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm text-muted-foreground hover:text-primary hidden sm:block transition-colors duration-150 nav-link-underline relative cursor-pointer">Features</a>
          <a href="#pricing" onClick={e => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm text-muted-foreground hover:text-primary hidden sm:block transition-colors duration-150 nav-link-underline relative cursor-pointer">Pricing</a>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
          <Button size="sm" onClick={() => navigate('/signup')} className="landing-btn-glow">Start Free Trial</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 md:pt-20 pb-6 md:pb-8 text-center max-w-4xl mx-auto relative" style={{ background: 'hsl(var(--background))', overflow: 'visible', border: 'none', borderLeft: 'none', outline: 'none' }}>
        <h1
          className="font-display font-bold text-[34px] md:text-[52px] text-foreground relative landing-heading-glow mx-auto"
          style={{ ...heroStagger(0), letterSpacing: '-0.01em', lineHeight: '1.08', maxWidth: '720px' }}
        >
          Stop chasing documents. Start filing.
        </h1>
        <p
          className="mt-6 text-[15px] md:text-lg text-[#8aa3b8] font-body font-light max-w-2xl mx-auto relative"
          style={{ ...heroStagger(4), lineHeight: '1.7' }}
        >
          Your clients upload everything from their phone.<br className="hidden sm:block" />
          You open the case to find it organized and ready.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap relative" style={heroStagger(6)}>
          <Button size="lg" onClick={() => navigate('/signup')} className="landing-btn-glow" style={{ padding: '14px 28px' }}>Start Free Trial</Button>
          <Button size="lg" variant="ghost" onClick={() => setShowDemo(true)} className="group" style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '14px 28px' }}>
            See How It Works <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
        <p className="mt-6 text-sm text-[#8aa3b8] relative" style={heroStagger(8)}>
          ✓ 14-day free trial &nbsp;&nbsp; ✓ No credit card required &nbsp;&nbsp; ✓ First case in 5 minutes
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

      {/* Comparison Table */}
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
                  { label: 'AI validates every document', cols: ['x', 'x', 'x', 'check'] },
                  { label: 'AI guide answers client questions', cols: ['x', 'x', 'x', 'alex'] },
                  { label: 'Bank statements via Plaid', cols: ['x', 'x', 'x', 'plaid'] },
                  { label: 'Automatic SMS reminders', cols: ['x', 'x', '-', 'check'] },
                  { label: 'Documents organized on arrival', cols: ['x', 'x', '-', 'check'] },
                  { label: "Works on client's phone", cols: ['-', '-', '-', 'check'] },
                  { label: 'Built for Ch. 7 & Ch. 13', cols: ['x', 'x', '-', 'check'] },
                  { label: 'Setup in under 5 minutes', cols: ['check', 'check', 'x', 'check'] },
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

      {/* Wizard Section */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div ref={wizRef} className="text-center mb-12" style={revealStyle(wizVisible)}>
          <h2 className="font-display font-bold text-[28px] md:text-[40px] text-foreground leading-[1.1] landing-heading-glow" style={{ letterSpacing: '-0.01em' }}>
            Your clients shouldn't need a paralegal<br />
            <span className="text-primary">to submit their documents.</span>
          </h2>
          <p className="text-[15px] text-[#8aa3b8] font-body font-light mt-4 max-w-2xl mx-auto" style={{ lineHeight: '1.7' }}>
            ClearPath does the hand-holding so your team doesn't have to.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: ClipboardList, title: 'Step-by-step for every client', desc: 'Clients follow a step-by-step wizard built for non-technical users. Plain English instructions, camera upload, and document help built in. Works on any phone, no app download needed.' },
            { icon: Building, title: 'Bank statements via Plaid', desc: 'Clients connect their bank account directly through Plaid — the same technology trusted by millions of apps. Statements arrive instantly, no downloading or scanning required. Supports Chase, Bank of America, Wells Fargo, and 10,000+ institutions.' },
            { icon: Sparkles, title: "Meet Alex — your clients' AI guide", desc: "When clients get stuck, Alex answers instantly. Where to find a W-2, what a bank statement looks like, how to get a pay stub from ADP. Alex keeps clients moving forward so your team never has to explain it." },
          ].map((c, i) => (
            <div
              key={c.title}
              className="p-7 rounded-xl transition-all duration-200"
              style={{
                background: '#111f2e',
                border: '0.5px solid rgba(255,255,255,0.08)',
                ...revealStyle(wizVisible, { delay: 0.1 + i * 0.08, y: 16 }),
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,194,168,0.25)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <c.icon className="w-7 h-7 text-primary mb-4" />
              <h3 className="font-body font-semibold text-[17px] text-foreground mb-2">{c.title}</h3>
              <p className="text-[15px] text-[#8aa3b8] font-body font-light" style={{ lineHeight: '1.7' }}>{c.desc}</p>
            </div>
          ))}
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
          <div
            className="rounded-2xl border p-4"
            style={{ background: '#111f2e', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">A</div>
              <div>
                <p className="font-body font-semibold text-foreground text-sm">Alex</p>
                <p className="text-[11px] text-muted-foreground">Document Assistant</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="ml-auto max-w-[80%] bg-primary/15 text-foreground rounded-2xl px-4 py-2.5 text-sm font-body">
                Where do I get my W-2?
              </div>
              <div className="mr-auto max-w-[80%] bg-secondary text-foreground rounded-2xl px-4 py-2.5 text-sm font-body">
                Log into your payroll portal — ADP at adp.com, Workday at workday.com, or Paychex. Go to Pay & Tax → Tax Documents and download both years.
              </div>
              <div className="ml-auto max-w-[80%] bg-primary/15 text-foreground rounded-2xl px-4 py-2.5 text-sm font-body">
                I use ADP
              </div>
              <div className="mr-auto max-w-[80%] bg-secondary text-foreground rounded-2xl px-4 py-2.5 text-sm font-body">
                Go to adp.com → Sign In → Pay & Tax → Tax Statements. Download 2023 and 2024 and upload them here. Takes about 2 minutes ✓
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      <FeatureShowcase />

      <SectionDivider />
      <section className="px-6 py-10 max-w-3xl mx-auto">
        <div
          className="rounded-xl p-6 text-center"
          style={{
            background: 'hsl(var(--surface))',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-body font-semibold mb-4"
            style={{ background: 'rgba(0,194,168,0.1)', color: 'rgb(0,194,168)' }}
          >
            Coming Soon
          </span>
          <h3 className="font-display font-bold text-lg text-foreground mb-2">AI Form Filling</h3>
          <p className="text-[14px] text-[#8aa3b8] font-body font-light max-w-lg mx-auto" style={{ lineHeight: '1.7' }}>
            ClearPath will automatically pre-fill all 15 federal Ch.7 forms from your approved documents. Means test, exemption analysis, and court-ready packet generation included. Currently in development for Professional plans.
          </p>
        </div>
      </section>

      <SectionDivider />

      {/* How it works */}
      <section id="features" className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-[28px] md:text-[40px] text-foreground text-center mb-12 landing-heading-glow" style={{ letterSpacing: '-0.01em', lineHeight: '1.1' }}>How it works</h2>
        <div ref={howRef} className="grid grid-cols-1 md:grid-cols-3 gap-0 items-start relative">
          {[0, 1].map(i => (
            <div
              key={i}
              className="hidden md:block absolute top-5"
              style={{
                left: `calc(${16.67 + i * 33.33}% + 20px)`,
                right: `calc(${50 - i * 33.33}% + 20px)`,
                borderTop: '1px solid rgba(0,194,168,0.2)',
                ...(reduced ? {} : {
                  transform: howStep >= (i + 1) * 2 ? 'scaleX(1)' : 'scaleX(0)',
                  transition: 'transform 0.3s ease-out',
                  transformOrigin: 'left',
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
                <h3 className="font-display font-semibold text-[17px] text-foreground mb-2">{step.title}</h3>
                <p className="text-[15px] text-[#8aa3b8] font-body font-light max-w-[260px] mx-auto" style={{ lineHeight: '1.7' }}>{step.desc}</p>
              </div>
              {i < 2 && (
                <div className="md:hidden w-px h-8 border-l-2 border-dashed border-primary/25 mt-4" />
              )}
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Feature cards */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div ref={featureRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: ClipboardList, title: 'Guided Mobile Wizard', desc: 'Clients follow a step-by-step wizard built for non-technical users. Plain English instructions, camera upload, and document help built in. Works on any phone, no app download needed.' },
            { icon: MessageSquare, title: 'AI Document Validation', desc: 'Every uploaded document is checked instantly by AI — wrong year, wrong type, illegible scan. Clients are notified immediately so corrections happen before you ever open the case.' },
            { icon: Sparkles, title: 'Alex — Built-in Document AI', desc: 'Every document step has Alex built in. Clients ask where to find their documents and get instant answers with direct links. Alex knows ADP, Gusto, Chase, IRS.gov, and dozens more by name.' },
            { icon: Clock, title: 'Automatic SMS Reminders', desc: 'Clients who go quiet get automatic follow-up reminders. Targeted, specific, and sent at the right time — so your paralegal spends zero time chasing documents.' },
            { icon: LayoutDashboard, title: 'Organized on Arrival', desc: 'Every document lands in the right category automatically. Income, bank accounts, debts, assets, ID — organized before you open the case.' },
            { icon: Building, title: 'Bank Connection via Plaid', desc: 'ClearPath integrates directly with Plaid — the same bank connection technology used by Venmo and Robinhood. Clients connect once and 6 months of statements arrive instantly. Available on Professional and Firm plans.' },
          ].map((f, i) => (
            <div
              key={f.title}
              className="p-6 rounded-xl transition-all duration-200"
              style={{
                border: '0.5px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                background: 'hsl(var(--surface))',
                ...revealStyle(featureVisible, { delay: i * 0.06, y: 16 }),
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(0,194,168,0.3)';
                el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 0 20px rgba(0,194,168,0.06)';
                el.style.transform = 'translateY(-2px)';
                el.style.background = '#131f2e';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(255,255,255,0.08)';
                el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
                el.style.transform = 'translateY(0)';
                el.style.background = 'hsl(var(--surface))';
              }}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                <f.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-[17px] text-foreground mb-2">{f.title}</h3>
              <p className="text-[15px] text-[#8aa3b8] font-body font-light" style={{ lineHeight: '1.7' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-[28px] md:text-[40px] text-foreground text-center mb-4 landing-heading-glow" style={{ letterSpacing: '-0.01em', lineHeight: '1.1' }}>
          Simple pricing.<br />Free to start.
        </h2>
        <p className="text-[15px] text-[#8aa3b8] text-center mb-8 font-body font-light">14-day free trial on every plan. No credit card required.</p>

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
            Stop chasing documents. Start your free trial and send your first case in 5 minutes.
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
            14-day free trial · Cancel anytime · First case in 5 minutes
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
              Chapter 7 &amp; 13 · Guided Client Intake · AI Validation
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
