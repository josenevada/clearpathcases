import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-10">
    <h2 className="font-display font-bold text-xl md:text-2xl text-foreground mb-4">{title}</h2>
    <div className="space-y-3 text-muted-foreground font-body leading-relaxed text-[15px]">{children}</div>
  </div>
);

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground font-body mb-10">Last updated: March 27, 2026</p>

        <Section title="Overview">
          <p>
            ClearPath ("we," "us," or "our") provides a bankruptcy document intake platform for law firms and their clients. 
            This Privacy Policy describes how we collect, use, store, and protect your personal information when you use our 
            services at yourclearpath.app.
          </p>
          <p>
            We are committed to handling your data responsibly. Because our platform processes sensitive financial and legal 
            documents, we hold ourselves to a high standard of care.
          </p>
        </Section>

        <Section title="Information We Collect">
          <p>We collect the following categories of information in the course of providing our services:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Account Information</strong> — Name, email address, phone number, and 
              professional role for law firm staff who create accounts on the platform.
            </li>
            <li>
              <strong className="text-foreground">Client Contact Information</strong> — Name, email address, phone number, 
              date of birth, and mailing address provided by or on behalf of bankruptcy clients during the intake process.
            </li>
            <li>
              <strong className="text-foreground">Financial Documents</strong> — Pay stubs, tax returns, bank statements, 
              government-issued identification, and other documents uploaded through the client portal as part of a bankruptcy filing.
            </li>
            <li>
              <strong className="text-foreground">Financial Data</strong> — Employment information, income figures, expense 
              breakdowns, and bank account details collected through intake forms or connected services.
            </li>
            <li>
              <strong className="text-foreground">Usage Data</strong> — Information about how you interact with the platform, 
              including pages visited, features used, and timestamps of activity for audit and support purposes.
            </li>
          </ul>
        </Section>

        <Section title="How We Use Your Information">
          <p>
            We use the information we collect <strong className="text-foreground">solely to provide and improve the ClearPath 
            bankruptcy document intake service</strong>. Specifically, we use your information to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Facilitate document collection and organization for bankruptcy filings.</li>
            <li>Enable communication between law firm staff and their clients regarding case progress.</li>
            <li>Send transactional notifications such as document reminders, correction requests, and case status updates.</li>
            <li>Validate uploaded documents for completeness and accuracy.</li>
            <li>Maintain audit trails for compliance and quality assurance.</li>
            <li>Process payments for subscription services.</li>
          </ul>
          <p>
            We do <strong className="text-foreground">not</strong> sell, rent, or share your personal information with third 
            parties for marketing purposes. We do not use your data for advertising. We do not train machine learning models 
            on your documents or personal information.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            We rely on a limited set of trusted third-party service providers to operate the platform. Each provider is bound 
            by their own privacy policies and data protection obligations:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Supabase</strong> — Database hosting, file storage, and authentication. 
              Data is encrypted at rest using AES-256 and in transit using TLS 1.2+. Infrastructure is hosted on AWS.
            </li>
            <li>
              <strong className="text-foreground">Plaid</strong> — Secure bank account connection for financial data 
              verification. Plaid accesses bank data only with explicit user authorization and does not store credentials 
              on our servers.
            </li>
            <li>
              <strong className="text-foreground">Twilio</strong> — SMS delivery for case notifications, document reminders, 
              and verification codes. Phone numbers are shared with Twilio solely for message delivery.
            </li>
            <li>
              <strong className="text-foreground">Resend</strong> — Transactional email delivery for case updates, 
              invitation links, and system notifications.
            </li>
            <li>
              <strong className="text-foreground">Stripe</strong> — Payment processing for firm subscriptions. We do not 
              store credit card numbers on our servers. All payment data is handled directly by Stripe, which is PCI DSS 
              Level 1 certified.
            </li>
          </ul>
          <p>
            We do not share documents, financial data, or client information with any third party beyond what is strictly 
            necessary for the services described above.
          </p>
        </Section>

        <Section title="Data Storage and Security">
          <p>
            All data is stored on secure infrastructure provided by Supabase (hosted on Amazon Web Services) within the 
            United States. We implement the following security measures:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>AES-256 encryption for data at rest.</li>
            <li>TLS 1.2+ encryption for all data in transit.</li>
            <li>Row-level security policies ensuring users can only access data they are authorized to view.</li>
            <li>Unique, time-limited client portal links with date-of-birth verification.</li>
            <li>Role-based access controls for firm staff.</li>
          </ul>
          <p>
            For more details on our security practices, please visit our{' '}
            <a href="/security" className="text-primary hover:underline">Security page</a>.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            We retain case data, including uploaded documents and client information, for a period of{' '}
            <strong className="text-foreground">seven (7) years</strong> following case closure or filing. This retention 
            period aligns with common legal and regulatory requirements for bankruptcy records.
          </p>
          <p>
            After the seven-year retention period, we will notify the firm's primary contact via email that case data is 
            scheduled for permanent deletion. Firms have a 90-day window to export any data they wish to preserve. If no 
            action is taken, all associated records — including documents, checklist items, activity logs, client information, 
            and the case record itself — are permanently and irreversibly deleted from our systems, including file storage.
          </p>
          <p>
            Firms may also manually delete case data at any time through the platform.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>You have the following rights regarding your personal information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Access and Export</strong> — You may request a copy of your personal 
              data at any time. Firm administrators can export case documents and client information directly from the platform.
            </li>
            <li>
              <strong className="text-foreground">Correction</strong> — You may request that we correct any inaccurate 
              personal information we hold about you.
            </li>
            <li>
              <strong className="text-foreground">Deletion</strong> — You may request that we delete your personal 
              information, subject to any legal retention obligations. Firm administrators can delete case records 
              through the platform, which removes all associated data.
            </li>
            <li>
              <strong className="text-foreground">Portability</strong> — You may request your data in a commonly used, 
              machine-readable format.
            </li>
          </ul>
          <p>
            If you are a client whose data was submitted through a law firm using ClearPath, please contact your 
            attorney's office to exercise these rights, as they are the data controller for your case information.
          </p>
        </Section>

        <Section title="Cookies and Tracking">
          <p>
            ClearPath uses only essential cookies required for authentication and session management. We do not use 
            advertising cookies, tracking pixels, or third-party analytics that profile individual users.
          </p>
        </Section>

        <Section title="Children's Privacy">
          <p>
            ClearPath is not directed at individuals under the age of 18. We do not knowingly collect personal 
            information from children. If you believe a child has provided us with personal information, please 
            contact us and we will promptly delete it.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. 
            When we make material changes, we will notify registered users via email and update the "Last updated" date 
            at the top of this page. Your continued use of the platform after such changes constitutes acceptance of the 
            updated policy.
          </p>
        </Section>

        <Section title="Contact Us">
          <p>
            If you have questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="mt-2">
            <a href="mailto:privacy@yourclearpath.app" className="text-primary hover:underline font-medium">
              privacy@yourclearpath.app
            </a>
          </p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-muted-foreground font-body">Bankruptcy document intake, simplified.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground">Terms of Service</a>
            <a href="/security" className="hover:text-foreground">Security</a>
            <a href="/login" className="hover:text-foreground">Sign In</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
