import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlanDef {
  name: string;
  monthly: string;
  annual: string;
  subtitle: string;
  features: string[];
  popular?: boolean;
  roiCallout?: string;
  note?: string;
}

interface PlanDefWithDiff extends PlanDef {
  differentiator?: string;
}

const LANDING_PLANS: Record<string, PlanDefWithDiff> = {
  starter: {
    name: 'Starter',
    monthly: '$199',
    annual: '$166',
    subtitle: 'For solo practitioners',
    differentiator: 'Solo practice · Up to 8 cases',
    features: [
      'Up to 8 active cases',
      'Full client intake wizard',
      'AI document validation',
      'Alex — AI document guide',
      'Automated SMS & email reminders',
      'Custom document checklists',
      'Case management dashboard',
      '14-day free trial',
    ],
  },
  professional: {
    name: 'Professional',
    monthly: '$399',
    annual: '$332',
    subtitle: 'For growing firms',
    popular: true,
    differentiator: 'Growing firms · Up to 25 cases',
    features: [
      'Up to 25 active cases',
      'Everything in Starter',
      'Plaid bank connection',
      'White-label client portal',
      'Priority support',
      '14-day free trial',
    ],
    note: 'White-label portal coming soon',
  },
  firm: {
    name: 'Firm',
    monthly: '$699',
    annual: '$582',
    subtitle: 'For high-volume practices',
    differentiator: 'High volume · Up to 60 cases',
    features: [
      'Up to 60 active cases',
      'Everything in Professional',
      'Dedicated onboarding call',
      'SLA support',
      '14-day free trial',
    ],
  },
};

type LandingPlanKey = keyof typeof LANDING_PLANS;

interface PricingCardsProps {
  onSelectPlan: (plan: any) => void;
  buttonLabel?: string;
  currentPlan?: string | null;
}

const PricingCards = ({ onSelectPlan, buttonLabel = 'Start Free Trial', currentPlan }: PricingCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl mx-auto">
      {(Object.entries(LANDING_PLANS) as [LandingPlanKey, PlanDefWithDiff][]).map(([key, plan]) => {
        const isCurrent = currentPlan === key;
        const price = plan.monthly;
        return (
          <div
            key={key}
            className="relative flex flex-col px-6 py-6 rounded-xl transition-all duration-200"
            style={{
              border: plan.popular ? '1px solid rgba(0,194,168,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
              boxShadow: plan.popular
                ? '0 8px 48px rgba(0,0,0,0.4), 0 0 32px rgba(0,194,168,0.1)'
                : '0 4px 24px rgba(0,0,0,0.3)',
              background: 'hsl(var(--surface))',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'rgba(0,194,168,0.3)';
              el.style.boxShadow = plan.popular
                ? '0 12px 56px rgba(0,0,0,0.45), 0 0 40px rgba(0,194,168,0.15)'
                : '0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(0,194,168,0.06)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = plan.popular ? 'rgba(0,194,168,0.5)' : 'rgba(255,255,255,0.08)';
              el.style.boxShadow = plan.popular
                ? '0 8px 48px rgba(0,0,0,0.4), 0 0 32px rgba(0,194,168,0.1)'
                : '0 4px 24px rgba(0,0,0,0.3)';
            }}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs">
                Most Popular
              </Badge>
            )}
            <h3 className="font-display font-semibold text-[17px] text-foreground">{plan.name}</h3>
            <p className="text-xs text-[#8aa3b8] font-body mt-1">{plan.subtitle}</p>
            {plan.differentiator && (
              <span className="text-[12px] font-body font-semibold text-primary bg-primary/10 rounded-full px-3 py-1 inline-block mt-3 mb-1 self-start">
                {plan.differentiator}
              </span>
            )}
            <div className="mt-3 mb-2">
              <span className="font-display font-bold text-3xl text-foreground">{price}</span>
              <span className="text-[#8aa3b8] text-sm">/month</span>
            </div>
            {plan.roiCallout && (
              <div
                className="mb-4 inline-flex self-start items-center gap-1 px-3 py-1 rounded-full text-[13px] font-body font-semibold"
                style={{
                  background: 'rgba(251,191,36,0.12)',
                  color: 'rgb(251,191,36)',
                  boxShadow: '0 0 12px rgba(245,166,35,0.2)',
                }}
              >
                {plan.roiCallout}
              </div>
            )}
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[15px] text-[#8aa3b8] font-light" style={{ lineHeight: '1.7' }}>
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.note && (
              <p className="text-[11px] text-muted-foreground italic mt-2 mb-4">{plan.note}</p>
            )}
            <Button
              className={`w-full transition-all duration-200 ${!isCurrent && !plan.popular ? 'border border-foreground/20' : ''}`}
              variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
              disabled={isCurrent}
              onClick={() => onSelectPlan(key)}
              style={{
                padding: '14px 28px',
                ...(plan.popular ? { boxShadow: '0 0 24px rgba(0,194,168,0.3)' } : {}),
              }}
            >
              {isCurrent ? 'Current Plan' : buttonLabel}
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default PricingCards;
