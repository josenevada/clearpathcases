import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PLANS, type PlanKey } from '@/lib/stripe';

interface PricingCardsProps {
  onSelectPlan: (plan: PlanKey) => void;
  buttonLabel?: string;
  currentPlan?: string | null;
}

const PricingCards = ({ onSelectPlan, buttonLabel = 'Start Free Trial', currentPlan }: PricingCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto">
      {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
        const isPopular = 'popular' in plan && plan.popular;
        const isCurrent = currentPlan === key;
        return (
          <div
            key={key}
            className={`surface-card relative flex flex-col p-6 ${isPopular ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
          >
            {isPopular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs">
                Most Popular
              </Badge>
            )}
            <h3 className="font-display font-bold text-xl text-foreground">{plan.name}</h3>
            <div className="mt-2 mb-4">
              <span className="font-display font-bold text-3xl text-foreground">{plan.price}</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              variant={isCurrent ? 'outline' : isPopular ? 'default' : 'outline'}
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
