import { Link } from 'react-router-dom';

const SmsConsent = () => {
  return (
    <div className="min-h-screen" style={{ background: '#0d1b2a' }}>
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <Link to="/" className="inline-block mb-10 text-sm font-body" style={{ color: '#00C2A8' }}>
          ← Back to Home
        </Link>

        <h1 className="font-display font-bold text-3xl md:text-4xl mb-4" style={{ color: '#EDF0F4', letterSpacing: '-0.01em' }}>
          SMS Consent & Messaging Policy
        </h1>
        <div className="w-16 h-0.5 mb-12" style={{ background: '#00C2A8' }} />

        {/* Section 1 */}
        <section className="mb-10">
          <h2 className="font-display font-bold text-xl md:text-2xl mb-4" style={{ color: '#EDF0F4' }}>
            How Clients Are Enrolled
          </h2>
          <p className="font-body text-base leading-relaxed mb-4" style={{ color: '#8aa3b8' }}>
            ClearPath sends SMS messages to bankruptcy clients strictly on behalf of licensed law firms. Before any message is sent, clients must provide explicit consent through a two-step SMS opt-in process:
          </p>
          <div className="space-y-4 pl-1">
            {[
              { step: '1', text: "The client's attorney enters their phone number when creating their case." },
              { step: '2', text: '"[Firm Name] would like to send you SMS updates about your bankruptcy case documents. Reply YES to receive updates or NO to decline. Msg & data rates may apply."' },
              { step: '3', text: 'Only after the client replies YES does ClearPath send any further messages.' },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-body font-bold text-sm" style={{ background: 'rgba(0,194,168,0.12)', color: '#00C2A8' }}>
                  {step}
                </span>
                <p className="font-body text-base leading-relaxed pt-1" style={{ color: '#8aa3b8' }}>
                  {step === '2' ? (
                    <>The client receives a consent request: <span className="italic" style={{ color: '#EDF0F4' }}>{text}</span></>
                  ) : text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="font-display font-bold text-xl md:text-2xl mb-4" style={{ color: '#EDF0F4' }}>
            What Messages Are Sent
          </h2>
          <p className="font-body text-base leading-relaxed mb-4" style={{ color: '#8aa3b8' }}>
            All messages are transactional only:
          </p>
          <ul className="space-y-2 pl-1 mb-4">
            {[
              'A secure link to their document upload portal',
              'Reminders when documents are still needed',
              'Alerts when a correction is requested by their attorney',
              'Notification when their case is ready',
            ].map((item) => (
              <li key={item} className="flex gap-3 items-start font-body text-base" style={{ color: '#8aa3b8' }}>
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00C2A8' }} />
                {item}
              </li>
            ))}
          </ul>
          <p className="font-body text-base font-semibold" style={{ color: '#EDF0F4' }}>
            No marketing messages are ever sent.<br />
            No third parties ever receive client phone numbers.
          </p>
        </section>

        {/* Section 3 */}
        <section className="mb-10">
          <h2 className="font-display font-bold text-xl md:text-2xl mb-4" style={{ color: '#EDF0F4' }}>
            How to Opt Out
          </h2>
          <p className="font-body text-base leading-relaxed" style={{ color: '#8aa3b8' }}>
            Clients may opt out at any time by replying <span className="font-bold" style={{ color: '#EDF0F4' }}>STOP</span> to any message. They will receive one final confirmation and no further messages will be sent.
          </p>
          <p className="font-body text-base leading-relaxed mt-3" style={{ color: '#8aa3b8' }}>
            For help, clients may reply <span className="font-bold" style={{ color: '#EDF0F4' }}>HELP</span> or visit{' '}
            <a href="https://yourclearpath.app" className="underline" style={{ color: '#00C2A8' }}>yourclearpath.app</a>
          </p>
        </section>

        {/* Section 4 */}
        <section className="mb-10">
          <h2 className="font-display font-bold text-xl md:text-2xl mb-4" style={{ color: '#EDF0F4' }}>
            Message Frequency
          </h2>
          <p className="font-body text-base leading-relaxed mb-3" style={{ color: '#8aa3b8' }}>
            Message frequency varies by case activity, typically 2–5 messages per case over the course of the intake process.
          </p>
          <p className="font-body text-base leading-relaxed" style={{ color: '#8aa3b8' }}>
            Standard message and data rates may apply.
          </p>
        </section>

        {/* Section 5 */}
        <section className="mb-10">
          <h2 className="font-display font-bold text-xl md:text-2xl mb-4" style={{ color: '#EDF0F4' }}>
            Contact
          </h2>
          <p className="font-body text-base leading-relaxed" style={{ color: '#8aa3b8' }}>
            For questions about this policy contact:<br />
            <a href="mailto:support@yourclearpath.app" className="underline" style={{ color: '#00C2A8' }}>support@yourclearpath.app</a><br />
            <a href="https://yourclearpath.app" className="underline" style={{ color: '#00C2A8' }}>yourclearpath.app</a>
          </p>
        </section>

        <div className="pt-8 mt-8" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div className="flex gap-6 text-sm font-body" style={{ color: '#8aa3b8' }}>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmsConsent;
