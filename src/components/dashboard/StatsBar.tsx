import { FileSearch, CalendarClock, CheckSquare, Briefcase } from 'lucide-react';
import { differenceInDays, startOfWeek, endOfWeek } from 'date-fns';
import type { Case } from '@/lib/store';

interface StatsBarProps {
  cases: Case[];
  onFilter: (filter: string) => void;
  activeFilter: string | null;
}

const StatsBar = ({ cases, onFilter, activeFilter }: StatsBarProps) => {
  const activeCases = cases.filter(c => c.status !== 'filed' && c.status !== 'closed');

  const pendingReview = cases.reduce((sum, c) =>
    sum + c.checklist.reduce((s, item) =>
      s + item.files.filter(f => f.reviewStatus === 'pending').length, 0
    ), 0
  );

  const now = new Date();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const deadlinesThisWeek = activeCases.filter(c => {
    const d = differenceInDays(new Date(c.filingDeadline), now);
    return d >= 0 && d <= 7;
  }).length;

  const readyToFile = activeCases.filter(c => c.readyToFile).length;

  const stats = [
    { key: 'active', label: 'Active Cases', value: activeCases.length, icon: Briefcase },
    { key: 'pending', label: 'Docs Pending Review', value: pendingReview, icon: FileSearch },
    { key: 'deadlines', label: 'Deadlines This Week', value: deadlinesThisWeek, icon: CalendarClock },
    { key: 'ready', label: 'Ready to File', value: readyToFile, icon: CheckSquare },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map(stat => {
        const isActive = activeFilter === stat.key;
        return (
          <button
            key={stat.key}
            onClick={() => onFilter(isActive ? '' : stat.key)}
            className={`group surface-card p-4 text-left rounded-xl cursor-pointer transition-colors hover:bg-white/[0.03] hover:border-primary/30 ${
              isActive ? 'bg-primary/5 border border-primary/20' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-body">{stat.label}</span>
              <span className={`ml-auto text-xs text-primary transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                →
              </span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
          </button>
        );
      })}
    </div>
  );
};

export default StatsBar;
