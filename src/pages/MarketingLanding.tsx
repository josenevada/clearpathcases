import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link as LinkIcon, Upload, Sparkles, CheckCircle, Shield, FileText,
  ClipboardList, Package, Building, Layers, Lock, Archive, Database,
  ArrowRight, Menu, X,
} from 'lucide-react';
import type { PlanKey } from '@/lib/stripe';

/* ─── colors (used inline, matching design spec) ─── */
const C = {
  navy: '#0d1b2a',
  navyAlt: '#0a1520',
  card: '#111f2e',
  teal: '#00c2a8',
  amber: '#f5a623',
  white: '#f0f4f8',
  muted: '#8aa3b8',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.06)',
  footer: '#070f18',
};

/* ─── Intersection Observer hook (fire once) ─── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null!);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

/* ─── CountUp ─── */
const CountUp = ({ target, prefix = '', suffix = '', started }: { target: number; prefix?: string; suffix?: string; started: boolean }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(target); return; }
    const dur = 1500;
    const start = performance.now();
    const isFloat = !Number.isInteger(target);
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(isFloat ? parseFloat((eased * target).toFixed(1)) : Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target]);
  return <>{prefix}{val}{suffix}</>;
};

/* ─── Reveal wrapper ─── */
const Reveal = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const [ref, vis] = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(30px)',
      transition: `opacity 0.5s ease-out ${delay}s, transform 0.5s ease-out ${delay}s`,
    }}>
      {children}
    </div>
  );
};

/* ─── Hero FormData Mockup ─── */
const FormDataMockup = () => {
  const fields = [
    { label: 'Gross Monthly Income', value: '$4,833.00', confidence: 'High', color: C.teal, source: 'Pay Stub — March 2026' },
    { label: 'Employer Name', value: 'Midwest Auto Group', confidence: 'High', color: C.teal, source: 'Pay Stub — March 2026' },
    { label: 'Federal Tax Deduction', value: '$483.30 / $512.00', confidence: 'Conflict', color: '#a855f7', source: 'Pay Stub vs. Tax Return', isConflict: true },
  ];
  return (
    <div className="w-full max-w-md" style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: C.teal, animation: 'pulse 2s infinite' }} />
          <span className="font-display font-bold text-sm" style={{ color: C.white }}>B106I — Schedule I: Income</span>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: C.teal, background: 'rgba(0,194,168,0.1)' }}>Extraction Complete</span>
      </div>
      <div className="divide-y" style={{ borderColor: C.border }}>
        {fields.map((f) => (
          <div key={f.label} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: C.muted }}>{f.label}</p>
              <p className="text-sm font-medium" style={{ color: C.white }}>{f.value}</p>
              <p className="text-[10px] italic" style={{ color: C.muted }}>from: {f.source}</p>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: f.color, background: `${f.color}20`, border: `1px solid ${f.color}30` }}>
              {f.confidence}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: `${C.amber}15`, borderTop: `1px solid ${C.amber}30` }}>
        <span className="text-xs font-medium" style={{ color: C.amber }}>⚠ Attorney Review Required — 1 conflict detected</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════ MAIN ═══════════════════════════════════════ */
const MarketingLanding = () => {
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [annual, setAnnual] = useState(false);

  /* Hero stagger */
  const [heroIn, setHeroIn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setHeroIn(true)); }, []);
  const hs = (step: number): React.CSSProperties => ({
    opacity: heroIn ? 1 : 0,
    transform: heroIn ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.5s ease-out ${step * 0.1}s, transform 0.5s ease-out ${step * 0.1}s`,
  });

  /* Stats reveal */
  const [statsRef, statsVis] = useReveal(0.3);

  const goSignup = () => navigate('/signup');
  const goLogin = () => navigate('/login');

  const scrollTo = (id: string) => {
    setMobileNav(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Security', id: 'security' },
  ];

  return (
    <div className="min-h-screen" style={{ background: C.navy, color: C.white }}>
      {/* ══ NAV ══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.borderLight}` }}>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollTo('hero')}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 8l10-4 10 4-10 4-10-4z" fill={C.teal} opacity="0.8"/><path d="M4 14l10 4 10-4" stroke={C.teal} strokeWidth="2" fill="none"/><path d="M4 20l10 4 10-4" stroke={C.teal} strokeWidth="2" fill="none" opacity="0.5"/></svg>
          <span className="font-display font-[800] text-xl" style={{ color: C.white }}>ClearPath</span>
        </div>
        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(l => (
            <button key={l.id} onClick={() => scrollTo(l.id)}
              className="text-sm font-body relative pb-1 group"
              style={{ color: C.muted }}>
              {l.label}
              <span className="absolute bottom-0 left-0 w-full h-0.5 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" style={{ background: C.teal }} />
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={goLogin} className="text-sm font-body px-4 py-2 rounded-md border transition-colors"
            style={{ color: C.white, borderColor: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.teal)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}>
            Sign In
          </button>
          <button onClick={goSignup} className="text-sm font-body font-medium px-5 py-2 rounded-md transition-shadow"
            style={{ background: C.teal, color: C.navy, boxShadow: `0 0 20px rgba(0,194,168,0.3)` }}>
            Start Free Trial
          </button>
        </div>
        {/* Mobile hamburger */}
        <button className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
          {mobileNav ? <X size={24} style={{ color: C.white }} /> : <Menu size={24} style={{ color: C.white }} />}
        </button>
      </nav>

      {/* Mobile nav overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8" style={{ background: C.navy }}>
          {navLinks.map(l => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="font-display font-bold text-2xl" style={{ color: C.white }}>{l.label}</button>
          ))}
          <button onClick={() => { setMobileNav(false); goLogin(); }} className="font-body text-lg" style={{ color: C.muted }}>Sign In</button>
          <button onClick={() => { setMobileNav(false); goSignup(); }} className="font-body font-medium text-lg px-8 py-3 rounded-md" style={{ background: C.teal, color: C.navy }}>Start Free Trial</button>
        </div>
      )}

      {/* ══ HERO ══ */}
      <section id="hero" className="relative pt-28 md:pt-40 pb-20 md:pb-28 px-6 overflow-hidden" style={{ minHeight: '100vh' }}>
        {/* Radial gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 15% 20%, rgba(0,194,168,0.04), transparent)` }} />
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-16 relative">
          {/* Left */}
          <div className="flex-[3] min-w-0">
            <div style={hs(0)}>
              <span className="inline-flex items-center gap-1.5 text-xs font-body font-medium px-3 py-1 rounded-full border" style={{ color: C.teal, borderColor: `${C.teal}40`, background: `${C.teal}10` }}>
                ⚡ Built for bankruptcy law firms
              </span>
            </div>
            <h1 className="font-display font-[800] text-[44px] md:text-[72px] leading-[1.05] mt-6" style={{ ...hs(1), color: C.white }}>
              Your firm files faster.<br />
              <span style={{ color: C.teal }}>Your clients stress less.</span>
            </h1>
            <p className="font-body font-light text-lg md:text-xl mt-6 max-w-[520px] leading-relaxed" style={{ ...hs(2), color: C.muted }}>
              ClearPath guides bankruptcy clients through document collection, then automatically pre-fills all 15 federal Ch.7 forms using AI — so your paralegals review, not retype.
            </p>
            <div className="flex flex-wrap gap-3 mt-8" style={hs(3)}>
              <button onClick={goSignup} className="font-body font-medium text-base px-8 py-4 rounded-md transition-shadow"
                style={{ background: C.teal, color: C.navy, boxShadow: `0 0 20px rgba(0,194,168,0.3)` }}>
                Start Your Free Trial
              </button>
              <button onClick={() => scrollTo('how-it-works')} className="font-body text-base px-6 py-4 rounded-md border flex items-center gap-2 transition-colors"
                style={{ color: C.white, borderColor: 'rgba(255,255,255,0.2)' }}>
                See How It Works <ArrowRight size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-5 mt-6 text-sm font-body" style={{ ...hs(4), color: C.muted }}>
              <span>✓ 14-day free trial</span>
              <span>✓ No credit card required</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>
          {/* Right - Mockup */}
          <div className="flex-[2] flex justify-center" style={hs(2)}>
            <FormDataMockup />
          </div>
        </div>
      </section>

      {/* ══ SOCIAL PROOF ══ */}
      <section className="py-12 md:py-16 px-6" style={{ background: C.navyAlt }}>
        <p className="text-center text-xs font-body uppercase tracking-[0.2em]" style={{ color: C.muted }}>
          Trusted by bankruptcy law firms across the country
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mt-6">
          {['Harmon & Velez Law', 'Phoenix Fresh Start', 'Midwest Debt Relief', 'Cutler Legal Group', 'Summit Bankruptcy'].map((n, i) => (
            <span key={n} className="font-display font-bold text-base md:text-lg" style={{ color: `${C.muted}80`, opacity: 0.6 + i * 0.05 }}>{n}</span>
          ))}
        </div>
      </section>

      {/* ══ BEFORE/AFTER ══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: C.navy }}>
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="font-display font-[800] text-3xl md:text-5xl" style={{ color: C.white }}>Bankruptcy intake hasn't changed in 20 years.</h2>
            <p className="font-body font-light text-lg mt-3" style={{ color: C.muted }}>Until now.</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal>
              <div className="h-full p-7 rounded-xl" style={{ background: '#130f0f', border: '1px solid rgba(255,107,107,0.2)' }}>
                <span className="text-xs font-body font-bold uppercase tracking-[0.15em]" style={{ color: '#ff6b6b' }}>Before</span>
                <ul className="mt-5 space-y-3.5">
                  {[
                    'Email clients a 20-item document checklist and wait',
                    'Chase missing documents for days',
                    'Paralegals retype data from PDFs into federal forms',
                    '7–11 hours of paralegal time per case',
                    'Errors, omissions, and last-minute scrambles',
                    'Court packets assembled by hand',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm font-body" style={{ color: C.white }}>
                      <span style={{ color: '#ff6b6b' }}>✗</span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="h-full p-7 rounded-xl" style={{ background: '#0a1a18', border: `1px solid rgba(0,194,168,0.2)` }}>
                <span className="text-xs font-body font-bold uppercase tracking-[0.15em]" style={{ color: C.teal }}>With ClearPath</span>
                <ul className="mt-5 space-y-3.5">
                  {[
                    'Client guided through uploads step by step — no emails',
                    'AI validates every document instantly',
                    'All 15 federal forms pre-filled from approved documents',
                    '~1 hour of paralegal time per case',
                    'Attorney reviews, approves, files — nothing retyped',
                    'Court packet generated in one click',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm font-body" style={{ color: C.white }}>
                      <span style={{ color: C.teal }}>✓</span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ ROI STATS ══ */}
      <section ref={statsRef} className="py-16 md:py-24 px-6" style={{ background: C.navyAlt }}>
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { target: 8.5, suffix: '', label: 'Hours saved per case', color: C.teal },
            { target: 10600, prefix: '$', suffix: '', label: 'Monthly labor saved at Professional tier', color: C.teal },
            { target: 26, suffix: 'x', label: 'Average ROI for Professional firms', color: C.amber },
            { target: 15, suffix: '', label: 'Federal Ch.7 forms auto-filled by AI', color: C.teal },
          ].map(s => (
            <div key={s.label} className="text-center p-6 rounded-xl" style={{ background: C.card, border: `0.5px solid ${C.border}` }}>
              <p className="font-display font-[800] text-4xl md:text-6xl" style={{ color: s.color }}>
                <CountUp target={s.target} prefix={s.prefix} suffix={s.suffix} started={statsVis} />
              </p>
              <p className="font-body text-sm mt-2" style={{ color: C.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how-it-works" className="py-20 md:py-28 px-6" style={{ background: C.navy }}>
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display font-[800] text-3xl md:text-5xl" style={{ color: C.white }}>From intake to court packet — automated.</h2>
          </Reveal>
          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5" style={{ background: `${C.teal}30` }} />
            {[
              { icon: LinkIcon, title: 'Send the Link', desc: 'Create a case in seconds. Send your client a secure intake link via email or SMS. No login required for clients.' },
              { icon: Upload, title: 'Client Uploads', desc: 'Your client is guided through every document one at a time with clear instructions, mobile camera capture, and AI validation.' },
              { icon: Sparkles, title: 'AI Extracts', desc: "Once documents are approved, ClearPath's AI reads every document and extracts data into all 15 federal bankruptcy forms automatically." },
              { icon: CheckCircle, title: 'Review & File', desc: 'Paralegals review extracted fields in minutes. Attorney approves. Court-ready packet generated with one click.' },
            ].map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1} className="text-center relative z-10">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: `${C.teal}15`, border: `2px solid ${C.teal}40` }}>
                  <step.icon size={24} style={{ color: C.teal }} />
                </div>
                <h3 className="font-display font-bold text-lg mb-2" style={{ color: C.white }}>{step.title}</h3>
                <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="py-20 md:py-28 px-6" style={{ background: C.navyAlt }}>
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="font-display font-[800] text-3xl md:text-5xl" style={{ color: C.white }}>Everything your firm needs.<br />Nothing it doesn't.</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: 'AI Document Validation', desc: 'Gemini Vision AI reviews every uploaded document and rejects invalid files instantly — no more blurry photos or wrong documents.' },
              { icon: FileText, title: 'Automatic Form Filling', desc: 'All 15 Chapter 7 federal forms pre-filled from approved documents. B101 through B122A-2. Attorney reviews, not paralegals.' },
              { icon: ClipboardList, title: 'Client Intake Wizard', desc: 'A guided, mobile-first experience that walks clients through every document with instructions, tips, and real-time progress.' },
              { icon: Package, title: 'Court Packet Builder', desc: 'One-click court packet generation with SSN redaction, document organization, and attorney certification — ready to file.' },
              { icon: Building, title: 'Plaid Bank Connection', desc: 'Clients connect bank accounts directly via Plaid for instant statement retrieval — no downloads, no uploads.' },
              { icon: Layers, title: 'Chapter 7 & 13 Support', desc: 'Full support for both chapters with chapter-specific document checklists, forms, and milestone tracking.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="h-full p-7 rounded-xl" style={{ background: C.card, border: `0.5px solid ${C.border}` }}>
                  <f.icon size={28} style={{ color: C.teal }} className="mb-4" />
                  <h3 className="font-display font-bold text-lg mb-2" style={{ color: C.white }}>{f.title}</h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="py-20 md:py-28 px-6" style={{ background: C.navy }}>
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="font-display font-[800] text-3xl md:text-5xl" style={{ color: C.white }}>Straightforward pricing.<br />Extraordinary ROI.</h2>
            <p className="font-body font-light text-lg mt-3" style={{ color: C.muted }}>Every plan includes a 14-day free trial. No credit card required.</p>
          </Reveal>
          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="font-body text-sm" style={{ color: annual ? C.muted : C.white }}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} className="relative w-14 h-7 rounded-full transition-colors" style={{ background: annual ? C.teal : 'rgba(255,255,255,0.15)' }}>
              <div className="absolute top-0.5 w-6 h-6 rounded-full transition-transform" style={{ background: annual ? C.navy : C.white, left: annual ? 'calc(100% - 1.625rem)' : '0.125rem' }} />
            </button>
            <span className="font-body text-sm" style={{ color: annual ? C.white : C.muted }}>Annual <span className="font-medium" style={{ color: C.teal }}>(2 months free)</span></span>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: 'Starter', price: annual ? 149 : 179, subtitle: 'For solo practitioners getting started', popular: false,
                features: ['Up to 8 active cases', 'Client intake wizard', 'AI document validation', 'Manual document upload', 'Basic case management', 'Email support'],
              },
              {
                name: 'Professional', price: annual ? 332 : 399, subtitle: 'For growing firms ready to scale', popular: true,
                roi: 'Saves ~$10,600/mo in paralegal time',
                features: ['Up to 25 active cases', 'Everything in Starter', 'AI form filling — all 15 federal forms', 'Court packet generation', 'Plaid bank connection', 'Priority support'],
              },
              {
                name: 'Firm', price: annual ? 916 : 1099, subtitle: 'For high-volume practices', popular: false,
                features: ['Up to 60 active cases', 'Everything in Professional', 'White label client portal', 'Custom firm branding', 'Dedicated onboarding', 'SLA support'],
              },
            ].map((plan) => (
              <Reveal key={plan.name}>
                <div className="relative h-full flex flex-col p-7 rounded-xl"
                  style={{
                    background: C.card,
                    border: plan.popular ? `1px solid ${C.teal}40` : `0.5px solid ${C.border}`,
                    boxShadow: plan.popular ? `0 0 30px rgba(0,194,168,0.15)` : 'none',
                  }}>
                  {plan.popular && (
                    <span className="absolute -top-3 right-6 text-[11px] font-body font-bold uppercase px-3 py-1 rounded-full"
                      style={{ background: C.amber, color: C.navy }}>Most Popular</span>
                  )}
                  <h3 className="font-display font-bold text-xl" style={{ color: C.white }}>{plan.name}</h3>
                  <div className="mt-2">
                    <span className="font-display font-[800] text-4xl" style={{ color: C.white }}>${plan.price}</span>
                    <span className="font-body text-sm" style={{ color: C.muted }}>/mo</span>
                  </div>
                  <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{plan.subtitle}</p>
                  {plan.roi && (
                    <span className="inline-block mt-3 text-xs font-body font-medium px-3 py-1.5 rounded-md" style={{ background: `${C.amber}20`, color: C.amber }}>{plan.roi}</span>
                  )}
                  <ul className="mt-5 space-y-2.5 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm font-body" style={{ color: C.muted }}>
                        <CheckCircle size={14} style={{ color: C.teal, marginTop: 3, flexShrink: 0 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={goSignup} className="w-full mt-6 font-body font-medium text-sm py-3 rounded-md transition-shadow"
                    style={plan.popular
                      ? { background: C.teal, color: C.navy, boxShadow: `0 0 20px rgba(0,194,168,0.3)` }
                      : { background: 'transparent', color: C.teal, border: `1px solid ${C.teal}40` }}>
                    Start Free Trial
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-center font-body text-sm mt-8" style={{ color: C.muted }}>
            Need more than 60 cases? → Enterprise pricing available. <button onClick={() => window.location.href = 'mailto:hello@yourclearpath.app'} className="underline" style={{ color: C.teal }}>Contact us</button>.<br />
            Overage: $25/case over your plan limit.
          </p>
        </div>
      </section>

      {/* ══ SECURITY ══ */}
      <section id="security" className="py-20 md:py-28 px-6" style={{ background: C.navyAlt }}>
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="font-display font-[800] text-3xl md:text-[40px]" style={{ color: C.white }}>Built for the security standards<br />law firms demand.</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'SSL A+ Rating', desc: 'Independently verified A+ SSL rating via Qualys. TLS 1.3 enforced.' },
              { icon: Lock, title: 'SOC 2 Ready', desc: 'Infrastructure and access controls built to SOC 2 standards from day one.' },
              { icon: Archive, title: '7-Year Retention', desc: 'Automatic data retention policy matching federal bankruptcy recordkeeping requirements.' },
              { icon: Database, title: 'Encrypted Storage', desc: 'All documents encrypted at rest and in transit. Zero third-party data sharing.' },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="text-center p-6 rounded-xl" style={{ background: C.card, border: `0.5px solid ${C.border}` }}>
                  <s.icon size={28} style={{ color: C.teal }} className="mx-auto mb-3" />
                  <h3 className="font-display font-bold text-base mb-1.5" style={{ color: C.white }}>{s.title}</h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: C.navy }}>
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="font-display font-[800] text-3xl md:text-[40px]" style={{ color: C.white }}>What firms are saying.</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: 'ClearPath cut our intake process from two days to two hours. The AI form filling alone is worth ten times what we pay.', attr: '— Managing Attorney, Phoenix AZ' },
              { quote: "Our paralegals used to spend half their week chasing documents. Now they spend that time on work that actually requires their expertise.", attr: '— Bankruptcy Paralegal, 8-attorney firm' },
              { quote: "The court packets come out cleaner than what we were producing manually. I don't know how we did this without it.", attr: '— Solo Bankruptcy Practitioner, Ohio' },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="h-full p-7 rounded-xl flex flex-col" style={{ background: C.card, border: `0.5px solid ${C.border}` }}>
                  <p className="font-body font-light italic text-base leading-relaxed flex-1" style={{ color: C.white }}>"{t.quote}"</p>
                  <p className="font-body font-medium text-sm mt-4" style={{ color: C.muted }}>{t.attr}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: `linear-gradient(135deg, ${C.teal}15, ${C.navy})` }}>
        <Reveal className="max-w-[800px] mx-auto text-center">
          <h2 className="font-display font-[800] text-3xl md:text-[56px] leading-tight" style={{ color: C.white }}>
            Your next case could take<br />one hour instead of ten.
          </h2>
          <p className="font-body font-light text-lg mt-5" style={{ color: `${C.white}cc` }}>
            Start your free 14-day trial. No credit card. No commitment.<br />Set up your firm in under 5 minutes.
          </p>
          <button onClick={goSignup} className="font-display font-bold text-lg px-12 py-5 rounded-lg mt-8 transition-transform hover:scale-[1.02]"
            style={{ background: C.white, color: C.navy }}>
            Start Free Trial
          </button>
          <p className="font-body text-sm mt-5" style={{ color: C.muted }}>14-day free trial · Cancel anytime · Setup in 5 minutes</p>
        </Reveal>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="py-16 px-6" style={{ background: C.footer, borderTop: `1px solid ${C.borderLight}` }}>
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <span className="font-display font-[800] text-lg" style={{ color: C.white }}>ClearPath</span>
            <p className="font-body text-sm mt-2" style={{ color: C.muted }}>Bankruptcy intake, automated.</p>
          </div>
          <div>
            <p className="font-body font-medium text-sm mb-3" style={{ color: C.white }}>Product</p>
            {[{ l: 'Features', id: 'features' }, { l: 'Pricing', id: 'pricing' }, { l: 'Security', to: '/security' }].map(x => (
              <button key={x.l} onClick={() => 'to' in x ? navigate(x.to!) : scrollTo(x.id!)} className="block font-body text-sm mb-1.5 hover:underline" style={{ color: C.muted }}>{x.l}</button>
            ))}
          </div>
          <div>
            <p className="font-body font-medium text-sm mb-3" style={{ color: C.white }}>Legal</p>
            {[{ l: 'Privacy Policy', to: '/privacy' }, { l: 'Terms of Service', to: '/terms' }].map(x => (
              <button key={x.l} onClick={() => navigate(x.to)} className="block font-body text-sm mb-1.5 hover:underline" style={{ color: C.muted }}>{x.l}</button>
            ))}
          </div>
          <div>
            <p className="font-body font-medium text-sm mb-3" style={{ color: C.white }}>Contact</p>
            <a href="mailto:hello@yourclearpath.app" className="block font-body text-sm mb-1.5 hover:underline" style={{ color: C.muted }}>hello@yourclearpath.app</a>
            <a href="mailto:support@yourclearpath.app" className="block font-body text-sm mb-1.5 hover:underline" style={{ color: C.muted }}>support@yourclearpath.app</a>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-12 pt-6" style={{ borderTop: `1px solid ${C.borderLight}` }}>
          <p className="text-center font-body text-[13px]" style={{ color: C.muted }}>© 2026 ClearPath. All rights reserved.</p>
        </div>
      </footer>

      {/* Pulse keyframe for mockup */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
};

export default MarketingLanding;
