import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Logo from '@/components/Logo';

const SmsOptInPreview = () => {
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal wizard-style header */}
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <Logo />
          <span className="font-body text-sm text-muted-foreground">Step 2 of 8</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 lg:px-12 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3" style={{ letterSpacing: '-0.01em' }}>
              Stay Updated on Your Case
            </h1>
            <p className="font-body text-base text-muted-foreground leading-relaxed">
              Get SMS reminders so you never miss a document request from your attorney.
            </p>
          </div>

          <div
            className="rounded-2xl p-6 md:p-8 space-y-6"
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 20px 50px -10px rgba(0,0,0,0.3)',
            }}
          >
            <div>
              <label htmlFor="phone" className="block font-body text-sm font-medium text-foreground mb-2">
                Your Mobile Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <label className="flex gap-3 items-start cursor-pointer">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
                style={{ borderColor: '#00C2A8' }}
              />
              <span className="font-body text-[13px] leading-snug text-foreground">
                I agree to receive SMS messages about my bankruptcy case documents from my attorney's firm via ClearPath. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help anytime. View our{' '}
                <a href="/terms" style={{ color: '#00C2A8' }} className="hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" style={{ color: '#00C2A8' }} className="hover:underline">Privacy Policy</a>.
              </span>
            </label>

            <Button
              type="button"
              disabled={!agreed}
              className="w-full font-body font-semibold"
              style={
                agreed
                  ? { background: '#00C2A8', color: '#0d1b2a' }
                  : undefined
              }
            >
              Continue
            </Button>

            <p className="font-body text-xs text-center text-muted-foreground">
              Your number is never shared with third parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmsOptInPreview;
