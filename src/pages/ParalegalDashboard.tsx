import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertCircle, Clock, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import NewCaseModal from '@/components/case/NewCaseModal';
import { getAllCases, calculateProgress, type Case } from '@/lib/store';
import { toast } from 'sonner';

const ParalegalDashboard = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [showNewCase, setShowNewCase] = useState(false);

  useEffect(() => {
    setCases(getAllCases());
  }, []);

  const sortedCases = [...cases].sort((a, b) => {
    const order = { critical: 0, 'at-risk': 1, normal: 2 };
    const aHasFlags = a.checklist.some(i => i.flaggedForAttorney) ? -0.5 : 0;
    const bHasFlags = b.checklist.some(i => i.flaggedForAttorney) ? -0.5 : 0;
    const aReady = a.readyToFile ? 0.5 : 0;
    const bReady = b.readyToFile ? 0.5 : 0;
    return (order[a.urgency] + aHasFlags + aReady) - (order[b.urgency] + bHasFlags + bReady);
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body hidden sm:block">Paralegal Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden md:block">Sarah Johnson, Paralegal</span>
          <Button variant="ghost" size="icon" onClick={() => navigate('/paralegal/settings')}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowNewCase(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Case
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {sortedCases.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">No cases yet. Create your first case to get started.</p>
            <Button onClick={() => setShowNewCase(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Case
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCases.map((c, i) => (
              <CaseRow key={c.id} caseData={c} index={i} onNavigate={() => navigate(`/paralegal/case/${c.id}`)} />
            ))}
          </div>
        )}
      </main>

      <NewCaseModal
        open={showNewCase}
        onOpenChange={setShowNewCase}
        onCreated={() => setCases(getAllCases())}
      />
    </div>
  );
};

const CaseRow = ({ caseData, index, onNavigate }: { caseData: Case; index: number; onNavigate: () => void }) => {
  const progress = calculateProgress(caseData);
  const hasFlags = caseData.checklist.some(i => i.flaggedForAttorney);

  const urgencyClass = {
    critical: 'urgency-critical',
    'at-risk': 'urgency-at-risk',
    normal: 'urgency-normal',
  }[caseData.urgency];

  const getAction = () => {
    if (caseData.urgency === 'critical' && progress < 100) {
      return { label: 'Send Reminder', variant: 'warning' as const, action: () => {
        toast.success(`Reminder sent to ${caseData.clientName}`);
      }};
    }
    if (hasFlags) {
      return { label: 'Review Flags', variant: 'outline' as const, action: onNavigate };
    }
    if (progress === 100 && !caseData.readyToFile) {
      return { label: 'Mark Ready', variant: 'success' as const, action: onNavigate };
    }
    if (caseData.readyToFile) {
      return { label: 'Filed ✓', variant: 'ghost' as const, action: onNavigate };
    }
    return { label: 'View Case', variant: 'outline' as const, action: onNavigate };
  };

  const action = getAction();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="surface-card-hover p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 cursor-pointer"
      onClick={onNavigate}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-display font-bold text-foreground text-lg">{caseData.clientName}</h3>
          <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Ch.{caseData.chapterType}
          </span>
          <Badge className={`${urgencyClass} text-xs px-2 py-0.5 rounded-full`}>
            {caseData.urgency.replace('-', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(caseData.filingDeadline), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {hasFlags && <AlertCircle className="w-5 h-5 text-warning" />}
        <Button
          variant={action.variant}
          size="sm"
          onClick={e => { e.stopPropagation(); action.action(); }}
        >
          {action.label}
        </Button>
      </div>
    </motion.div>
  );
};

export default ParalegalDashboard;
