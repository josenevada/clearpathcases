import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import { Shield, Headphones, Mail } from 'lucide-react';

const SupportTab = () => {
  const { plan } = useSubscription();
  const limits = getPlanLimits(plan);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">Support</h2>
        <p className="text-sm text-muted-foreground font-body">Your plan's support tier and contact information.</p>
      </div>

      {limits.prioritySupport ? (
        <div className="surface-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground mb-1">Priority Support</h3>
            <p className="text-sm text-muted-foreground font-body">
              Priority support — we respond within 4 business hours.
            </p>
            <a href="mailto:hello@yourclearpath.app" className="text-sm text-primary hover:underline font-body mt-2 inline-block">
              hello@yourclearpath.app
            </a>
          </div>
        </div>
      ) : (
        <div className="surface-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground mb-1">Standard Support</h3>
            <p className="text-sm text-muted-foreground font-body">
              Email support with responses within 1–2 business days.
            </p>
            <p className="text-xs text-muted-foreground font-body mt-2">
              Upgrade to Professional for priority 4-hour response times.
            </p>
          </div>
        </div>
      )}

      {limits.dedicatedOnboarding && (
        <div className="surface-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Headphones className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground mb-1">Dedicated Onboarding</h3>
            <p className="text-sm text-muted-foreground font-body">
              Dedicated onboarding support — contact{' '}
              <a href="mailto:hello@yourclearpath.app" className="text-primary hover:underline">
                hello@yourclearpath.app
              </a>{' '}
              to schedule.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTab;
