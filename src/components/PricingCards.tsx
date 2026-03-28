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
}

const LANDING_PLANS: Record<string, PlanDef> = {
  starter: {
    name: 'Starter',
    monthly: '$179',
    annual: '$149',
    subtitle: 'For solo practitioners and small firms',
    features: [
      'Up to 8 active cases',
      'Full client intake wizard',
      'AI document validation',
      'Manual document upload',
      'Basic case management',
      'Email & SMS reminders',
      '14-day free trial',
    ],
  },
  professional: {
    name: 'Professional',
    monthly: '$399',
    annual: '$332',
    subtitle: 'For growing firms ready to scale',
    popular: true,
    roiCallout: 'Saves ~$10,600/mo in paralegal labor',
    features: [
      'Up to 25 active cases',
      'Everything in Starter',
      'AI form filling — all 15 federal forms',
      'Court packet generation',
      'Plaid bank connection',
      'Priority support',
      '14-day free trial',
    ],
  },
  firm: {
    name: 'Firm',
    monthly: '$1,099',
    annual: '$916',
    subtitle: 'For high-volume practices',
    features: [
      'Up to 60 active cases',
      'Everything in Professional',
      'White-label client portal',
      'Custom firm branding',
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
  isAnnual?: boolean;
}

const PricingCards = ({ onSelectPlan, buttonLabel = 'Start Free Trial', currentPlan, isAnnual = false }: PricingCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl mx-auto">
      {(Object.entries(LANDING_PLANS) as [LandingPlanKey, PlanDef][]).map(([key, plan]) => {
        const isCurrent = currentPlan === key;
        const price = isAnnual ? plan.annual : plan.monthly;
        return (
          <div
            key={key}
            className={`relative flex flex-col px-6 py-6 rounded-2xl transition-all duration-200 ${plan.popular ? 'pricing-glow' : ''}`}
            style={{
              border: plan.popular ? '1px solid rgba(0,194,168,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              background: 'hsl(var(--surface))',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,194,168,0.3)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px rgba(0,194,168,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = plan.popular ? 'rgba(0,194,168,0.5)' : 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
            }}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs">
                Most Popular
              </Badge>
            )}
            <h3 className="font-display font-bold text-xl text-foreground">{plan.name}</h3>
            <p className="text-xs text-[#8aa3b8] font-body mt-1">{plan.subtitle}</p>
            <div className="mt-3 mb-1">
              <span className="font-display font-bold text-3xl text-foreground">{price}</span>
              <span className="text-[#8aa3b8] text-sm">/month</span>
            </div>
            {isAnnual && (
              <p className="text-xs text-primary font-body mb-2">Billed annually</p>
            )}
            {plan.roiCallout && (
              <div className="mb-4 inline-flex self-start items-center gap-1 px-3 py-1 rounded-full text-xs font-body" style={{ background: 'rgba(251,191,36,0.12)', color: 'rgb(251,191,36)' }}>
                {plan.roiCallout}
              </div>
            )}
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#8aa3b8]">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className={`w-full landing-btn-glow ${!isCurrent && !plan.popular ? 'border border-foreground/20' : ''}`}
              variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
              disabled={isCurrent}
              onClick={() => onSelectPlan(key)}
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
