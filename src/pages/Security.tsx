import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Lock, Shield, Users, Server, FileOutput, Award, CheckCircle, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';

const trustBadges = [
  'TLS 1.3 Encrypted',
  'AES-256 at Rest',
  'AWS Infrastructure',
  'US-Based Data Centers',
];

const sections = [
  {
    icon: Lock,
    heading: 'Bank-level encryption in transit',
    body: 'All data transmitted between your browser and ClearPath is protected by TLS 1.3 — the same encryption standard used by major banks and financial institutions. Our SSL configuration is independently rated A+ by Qualys SSL Labs, the industry benchmark for transport security. Every connection to ClearPath enforces HTTPS with HSTS — unencrypted connections are rejected entirely.',
  },
  {
    icon: Shield,
    heading: 'Documents encrypted at rest',
    body: 'Every document your clients upload is encrypted at rest using AES-256 encryption before it is written to storage. Files are stored in private encrypted buckets with no public access — a document URL cannot be guessed, shared, or accessed without authentication. Documents are never stored unencrypted at any point in their lifecycle.',
  },
  {
    icon: Users,
    heading: 'Strict access control and data isolation',
    body: "Every firm's data is completely isolated at the database level — it is architecturally impossible for one firm to access another firm's cases, documents, or client information. Client portal access requires date of birth verification on every new browser session. Staff access is role-based — paralegals and attorneys see only what their role permits. Every access event is logged with a timestamp and actor in a full audit trail.",
  },
  {
    icon: Server,
    heading: 'Enterprise-grade infrastructure',
    body: 'ClearPath runs on Supabase which is built on AWS — the same infrastructure used by Netflix, Airbnb, and the majority of Fortune 500 companies. Your data is stored in US-based data centers with a 99.9 percent uptime SLA. Our infrastructure scales automatically and is monitored continuously for availability and performance.',
  },
  {
    icon: FileOutput,
    heading: 'Your data belongs to you',
    body: 'You own your data completely. You can export all approved documents from any case at any time using our one-click ZIP or PDF export — no support ticket required. If you cancel your ClearPath account your data remains accessible and exportable for 90 days before permanent deletion. We never sell, share, license, or use your client data for any purpose other than operating the ClearPath service.',
  },
  {
    icon: Award,
    heading: 'SOC 2 compliance in progress',
    body: 'We are actively working toward SOC 2 Type II certification — the gold standard for SaaS security and compliance. Our current security practices are designed to align with SOC 2 requirements across the five trust service criteria: security, availability, processing integrity, confidentiality, and privacy. Law firms with specific compliance requirements or security questionnaires are welcome to contact us directly at security@yourclearpath.app. We respond to all security inquiries within one business day.',
  },
];

const Security = () => {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <Link to="/"><Logo size="sm" /></Link>
        <div className="flex items-center gap-4">
          <a href="/#features" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Features</a>
          <Link to="/security" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Security</Link>
          <a href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">Pricing</a>
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Start Free Trial</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 md:pt-28 pb-12 text-center max-w-3xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-display font-bold text-4xl md:text-5xl text-foreground leading-tight"
        >
          Your clients' documents are safe with us.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-6 text-lg text-muted-foreground font-body max-w-2xl mx-auto"
        >
          ClearPath is built with the same security standards used by financial institutions and healthcare platforms. Here is exactly how we protect your data.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {trustBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground/[0.06] border border-foreground/[0.08] text-xs font-medium text-foreground/80 font-body"
            >
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              {badge}
            </span>
          ))}
        </motion.div>
      </section>

      {/* Content sections */}
      <div className="max-w-3xl mx-auto px-6 pb-16">
        {sections.map((section, i) => (
          <motion.div
            key={section.heading}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
          >
            {i > 0 && (
              <div className="h-px w-full bg-foreground/[0.06] my-10" />
            )}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <section.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-foreground mb-3">{section.heading}</h2>
                <p className="text-muted-foreground font-body leading-relaxed">{section.body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Contact card */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="surface-card p-8 border-l-4 border-primary">
          <h3 className="font-display font-bold text-lg text-foreground mb-3">Security questions or concerns?</h3>
          <p className="text-muted-foreground font-body mb-6">
            We take security seriously and respond to all inquiries promptly. If you have a specific compliance requirement, a security questionnaire to fill out, or a concern to report contact us at security@yourclearpath.app.
          </p>
          <a href="mailto:security@yourclearpath.app?subject=ClearPath%20Security%20Inquiry">
            <Button>
              <Mail className="w-4 h-4 mr-2" />
              Send Security Email
            </Button>
          </a>
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
            <Link to="/security" className="hover:text-foreground">Security</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Security;
