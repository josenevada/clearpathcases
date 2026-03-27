import { useSubscription } from '@/lib/subscription';
import { getPlanDisplayName, getPlanLimits } from '@/lib/plan-limits';
import { getAllCases } from '@/lib/store';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const PlanBadge = () => {
  const { plan, status, daysLeft } = useSubscription();
  const limits = getPlanLimits(plan);
  const displayName = getPlanDisplayName(plan);

  const activeCaseCount = useMemo(() => {
    const cases = getAllCases();
    return cases.filter(c => c.status !== 'filed' && c.status !== 'closed').length;
  }, []);

  const showUsage = limits.activeCases !== Infinity;
  const usagePercent = showUsage ? activeCaseCount / limits.activeCases : 0;

  const isTrial = status === 'trial';

  return (
    <div className="flex flex-col items-end gap-0.5">
      {isTrial && daysLeft !== null ? (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide bg-warning/15 text-warning border border-warning/25">
          Trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide bg-muted text-muted-foreground border border-border">
          {displayName}
        </span>
      )}
      {showUsage && (
        <span className={`text-[10px] font-body ${
          usagePercent >= 1 ? 'text-destructive' : usagePercent >= 0.8 ? 'text-warning' : 'text-muted-foreground'
        }`}>
          {activeCaseCount} of {limits.activeCases} active cases used
          {usagePercent >= 1 && (
            <Link to="/paralegal/settings?tab=billing" className="ml-1 underline text-primary hover:text-primary/80">
              Upgrade
            </Link>
          )}
        </span>
      )}
    </div>
  );
};

export default PlanBadge;
