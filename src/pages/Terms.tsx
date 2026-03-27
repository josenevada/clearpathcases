import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <div className="mb-10">
    <h2 className="font-display font-bold text-xl md:text-2xl text-foreground mb-4">
      {number}. {title}
    </h2>
    <div className="space-y-3 text-muted-foreground font-body leading-relaxed text-[15px]">{children}</div>
  </div>
);

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-5 mb-4">
    <h3 className="font-display font-semibold text-lg text-foreground mb-3">{title}</h3>
    <div className="space-y-3 text-muted-foreground font-body leading-relaxed text-[15px]">{children}</div>
  </div>
);

const Terms = () => {
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
          Terms of Service
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-4 text-lg text-muted-foreground font-body"
        >
          Effective Date: March 27, 2026
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-1 text-sm text-muted-foreground/70 font-body"
        >
          Last Updated: March 27, 2026
        </motion.p>
      </section>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 pb-16">
        <Section number="1" title="Agreement to Terms">
          <p>
            These Terms of Service constitute a legally binding agreement between you and ClearPath ("ClearPath," "we," "us," or "our") governing your access to and use of the ClearPath platform, website, and services available at yourclearpath.app (collectively, the "Service").
          </p>
          <p>
            By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service. If you are using the Service on behalf of a law firm or other organization, you represent that you have authority to bind that organization to these Terms.
          </p>
        </Section>

        <Section number="2" title="Description of Service">
          <p>
            ClearPath is a Software-as-a-Service platform that provides bankruptcy document intake and management services for law firms. The Service allows law firms and their staff to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Create and manage bankruptcy cases for their clients.</li>
            <li>Guide clients through secure document collection via a guided portal.</li>
            <li>Review, approve, and manage uploaded documents.</li>
            <li>Export court-ready filing packets.</li>
            <li>Connect client bank accounts via Plaid to retrieve financial statements.</li>
          </ul>
        </Section>

        <Section number="3" title="Accounts and Registration">
          <SubSection title="3.1 Firm Accounts">
            <ul className="list-disc pl-6 space-y-2">
              <li>To access the Service, your firm must register for an account and provide accurate, complete information.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</li>
              <li>You must notify us immediately at <a href="mailto:security@yourclearpath.app" className="text-primary hover:underline">security@yourclearpath.app</a> if you suspect unauthorized access to your account.</li>
              <li>You may not share your account credentials with individuals outside your firm or transfer your account to another party.</li>
            </ul>
          </SubSection>
          <SubSection title="3.2 Client Portal Access">
            <ul className="list-disc pl-6 space-y-2">
              <li>End clients access the Service through a unique secure link provided by their law firm. Client access does not require account creation.</li>
              <li>Law firms are responsible for obtaining appropriate client consent before creating a case and sharing a portal link.</li>
            </ul>
          </SubSection>
        </Section>

        <Section number="4" title="Subscription Plans and Payment">
          <SubSection title="4.1 Plans and Pricing">
            <ul className="list-disc pl-6 space-y-2">
              <li>ClearPath offers subscription plans at the following tiers: Solo at $49 per month, Starter at $99 per month, Professional at $249 per month, and Firm at $799 per month. Current pricing is available at yourclearpath.app.</li>
              <li>Each new account receives a 14-day free trial with no credit card required. At the end of the trial period, continued use requires selecting a paid plan.</li>
              <li>We reserve the right to modify pricing with 30 days advance notice to active subscribers.</li>
            </ul>
          </SubSection>
          <SubSection title="4.2 Billing">
            <ul className="list-disc pl-6 space-y-2">
              <li>Subscriptions are billed monthly in advance. Payment is processed through Stripe. By providing payment information you authorize us to charge your payment method on a recurring monthly basis.</li>
              <li>All fees are non-refundable except as required by applicable law or as expressly stated in these Terms.</li>
              <li>If payment fails, we will notify you and may suspend access to the Service until payment is resolved.</li>
            </ul>
          </SubSection>
        </Section>

        <Section number="5" title="Acceptable Use">
          <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Service for any purpose other than legitimate bankruptcy legal practice.</li>
            <li>Upload or transmit any malicious code, viruses, or harmful content.</li>
            <li>Attempt to gain unauthorized access to any part of the Service or another firm's data.</li>
            <li>Use the Service to store or transmit data that violates any applicable law or regulation.</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code of the Service.</li>
            <li>Resell, sublicense, or otherwise transfer access to the Service to any third party.</li>
          </ul>
        </Section>

        <Section number="6" title="Data and Privacy">
          <SubSection title="6.1 Your Data">
            <ul className="list-disc pl-6 space-y-2">
              <li>You retain ownership of all data you upload to the Service including client documents, case information, and firm data.</li>
              <li>By uploading data to the Service, you grant ClearPath a limited license to process, store, and transmit that data solely for the purpose of providing the Service.</li>
              <li>We do not sell, share, or use your data for any purpose other than operating the Service.</li>
            </ul>
          </SubSection>
          <SubSection title="6.2 Privacy Policy">
            <p>
              Our Privacy Policy at <Link to="/privacy" className="text-primary hover:underline">yourclearpath.app/privacy</Link> describes how we collect, use, and protect your data. By using the Service, you agree to our Privacy Policy.
            </p>
          </SubSection>
          <SubSection title="6.3 Client Data Responsibility">
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for ensuring that you have appropriate authorization from your clients before uploading their personal and financial information to the Service.</li>
              <li>You are responsible for compliance with all applicable attorney-client confidentiality obligations, bar association rules, and data protection laws governing your use of the Service.</li>
            </ul>
          </SubSection>
        </Section>

        <Section number="7" title="Third-Party Services">
          <p>
            The Service integrates with third-party services including Plaid for bank account connectivity, Stripe for payment processing, Twilio for SMS notifications, and Resend for email delivery. Your use of these integrations is subject to the respective third-party terms of service.
          </p>
          <p>
            When a client connects their bank account via Plaid, the client's use of Plaid is subject to Plaid's End User Privacy Policy. ClearPath accesses financial data read-only and does not initiate any transactions or store banking credentials.
          </p>
        </Section>

        <Section number="8" title="Intellectual Property">
          <ul className="list-disc pl-6 space-y-2">
            <li>The Service, including all software, design, text, graphics, and functionality, is owned by ClearPath and protected by applicable intellectual property laws.</li>
            <li>We grant you a limited, non-exclusive, non-transferable license to use the Service for your internal business purposes during your subscription period.</li>
            <li>You may not copy, modify, distribute, or create derivative works based on the Service without our express written permission.</li>
          </ul>
        </Section>

        <Section number="9" title="Data Retention and Account Termination">
          <ul className="list-disc pl-6 space-y-2">
            <li>Case data is retained for 7 years after case closure consistent with federal records retention requirements. Firms receive 90 days advance notice before scheduled deletion.</li>
            <li>If you cancel your subscription, your data remains accessible and exportable for 90 days following cancellation before permanent deletion.</li>
            <li>You may export all your data at any time using the export features within the Service.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice.</li>
          </ul>
        </Section>

        <Section number="10" title="Disclaimers and Limitation of Liability">
          <SubSection title="10.1 No Legal Advice">
            <p>
              ClearPath is a document management tool and does not provide legal advice. Nothing in the Service constitutes legal advice. Law firms and attorneys are solely responsible for the legal work they perform for their clients.
            </p>
          </SubSection>
          <SubSection title="10.2 Disclaimer of Warranties">
            <p className="uppercase text-xs tracking-wide">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLEARPATH DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </SubSection>
          <SubSection title="10.3 Limitation of Liability">
            <p className="uppercase text-xs tracking-wide">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLEARPATH SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY TO YOU SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE THREE MONTHS PRECEDING THE CLAIM.
            </p>
          </SubSection>
        </Section>

        <Section number="11" title="Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless ClearPath and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.
          </p>
        </Section>

        <Section number="12" title="Governing Law and Dispute Resolution">
          <ul className="list-disc pl-6 space-y-2">
            <li>These Terms are governed by the laws of the State of Ohio without regard to its conflict of law provisions.</li>
            <li>Any dispute arising from these Terms or your use of the Service shall be resolved through binding arbitration in Hamilton County, Ohio, except that either party may seek injunctive relief in court for intellectual property violations.</li>
            <li>You waive any right to participate in a class action lawsuit or class-wide arbitration.</li>
          </ul>
        </Section>

        <Section number="13" title="Changes to Terms">
          <p>
            We may update these Terms from time to time. We will notify active subscribers of material changes via email at least 30 days before the changes take effect. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section number="14" title="Contact">
          <p>If you have questions about these Terms please contact us:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email: <a href="mailto:hello@yourclearpath.app" className="text-primary hover:underline">hello@yourclearpath.app</a></li>
            <li>Security concerns: <a href="mailto:security@yourclearpath.app" className="text-primary hover:underline">security@yourclearpath.app</a></li>
            <li>Privacy requests: <a href="mailto:privacy@yourclearpath.app" className="text-primary hover:underline">privacy@yourclearpath.app</a></li>
            <li>Website: <a href="https://yourclearpath.app" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">yourclearpath.app</a></li>
          </ul>
        </Section>

        {/* Acknowledgment */}
        <div className="mt-12 pt-8 border-t border-foreground/[0.06]">
          <p className="text-muted-foreground font-body text-[15px] leading-relaxed">
            By using ClearPath you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-muted-foreground font-body">Bankruptcy document intake, simplified.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/security" className="hover:text-foreground">Security</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
