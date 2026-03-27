import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, AlertCircle, Clock, Settings, LogOut, ChevronDown, MessageSquare, Search, X } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import { Input } from '@/components/ui/input';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import NewCaseModal from '@/components/case/NewCaseModal';
import TrialBanner from '@/components/TrialBanner';
import ThemeToggle from '@/components/ThemeToggle';
import SubscriptionGate from '@/components/SubscriptionGate';
import { getAllCases, calculateProgress, type Case } from '@/lib/store';
import { caseHasRecentResubmission } from '@/lib/corrections';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import { sendSmartReminder } from '@/lib/notifications';
import { toast } from 'sonner';
import PlanBadge from '@/components/PlanBadge';
import UpgradeModal from '@/components/UpgradeModal';

const ParalegalDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { subscribed, status, daysLeft, plan, loading: subLoading, refresh } = useSubscription();
  const [cases, setCases] = useState<Case[]>([]);
  const [showNewCase, setShowNewCase] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const planLimits = getPlanLimits(plan);
  const activeCaseCount = cases.filter(c => c.status !== 'filed' && c.status !== 'closed').length;

  const handleNewCase = () => {
    if (planLimits.activeCases !== Infinity && activeCaseCount >= planLimits.activeCases) {
      setShowUpgrade(true);
    } else {
      setShowNewCase(true);
    }
  };

  const isAdminViewing = !!sessionStorage.getItem('admin_viewing_firm');

  // Session persistence check — redirect if no valid session after 3s
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login?expired=true', { replace: true });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      toast.success('Welcome back! Your subscription is active.');
      refresh();
    }
  }, [searchParams]);

  useEffect(() => {
    const refreshCases = () => setCases(getAllCases());
    refreshCases();
    window.addEventListener('focus', refreshCases);
    return () => window.removeEventListener('focus', refreshCases);
  }, []);

  const handleSignOut = async () => {
    sessionStorage.removeItem('admin_viewing_firm');
    await signOut();
    navigate('/login');
  };

  const filterBySearch = (list: Case[]) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(c =>
      c.clientName.toLowerCase().includes(term) ||
      (c.caseCode && c.caseCode.toLowerCase().includes(term)) ||
      (c.courtCaseNumber && c.courtCaseNumber.toLowerCase().includes(term))
    );
  };

  const activeCases = [...cases].filter(c => c.status !== 'filed' && c.status !== 'closed');
  const completedCases = cases.filter(c => c.status === 'filed' || c.status === 'closed');
  const filteredActive = filterBySearch(activeCases);
  const filteredCompleted = filterBySearch(completedCases);

  const sortedCases = [...filteredActive].sort((a, b) => {
    const order = { critical: 0, 'at-risk': 1, normal: 2 };
    const aHasResubmission = caseHasRecentResubmission(a) ? -1 : 0;
    const bHasResubmission = caseHasRecentResubmission(b) ? -1 : 0;
    const aHasFlags = a.checklist.some(item => item.flaggedForAttorney) ? -0.5 : 0;
    const bHasFlags = b.checklist.some(item => item.flaggedForAttorney) ? -0.5 : 0;
    const aReady = a.readyToFile ? 0.5 : 0;
    const bReady = b.readyToFile ? 0.5 : 0;
    return (order[a.urgency] + aHasResubmission + aHasFlags + aReady) - (order[b.urgency] + bHasResubmission + bHasFlags + bReady);
  });

  const [showCompleted, setShowCompleted] = useState(false);

  const displayName = user?.fullName ?? 'Staff';
  const displayRole = user?.role === 'attorney' ? 'Attorney' : 'Paralegal';

  // Show subscription gate if trial expired
  if (!subLoading && !subscribed && status === 'trial_expired') {
    return <SubscriptionGate />;
  }

  return (
    <div className="min-h-screen">
      {/* Trial countdown banner */}
      {status === 'trial' && daysLeft !== null && daysLeft <= 3 && (
        <TrialBanner daysLeft={daysLeft} />
      )}
      <header className="relative flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="hidden text-sm text-muted-foreground font-body sm:block">
            {isAdminViewing ? 'Admin View (Read-Only)' : `${displayRole} Dashboard`}
          </span>
          <PlanBadge />
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted-foreground md:block">
            {displayName}, {displayRole}
          </span>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setGlobalSearchOpen(true)}>
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/paralegal/settings')}>
            <Settings className="w-4 h-4" />
          </Button>
          {!isAdminViewing && (
            <Button onClick={handleNewCase}>
              <Plus className="w-4 h-4 mr-1" /> New Case
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Search bar */}
        {(cases.length > 0) && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search cases by client name or case number"
              className="pl-10 pr-10 bg-input border-border rounded-[10px]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {sortedCases.length === 0 && filteredCompleted.length === 0 ? (
          searchTerm ? (
            <div className="py-20 text-center">
              <p className="text-sm text-muted-foreground font-body">No cases match your search.</p>
            </div>
          ) : (
          <div className="py-20 text-center">
            <p className="mb-2 text-lg font-display font-bold text-foreground">No cases yet</p>
            <p className="mb-6 text-sm text-muted-foreground font-body">Create your first case to get started.</p>
            {!isAdminViewing && (
              <Button size="lg" onClick={handleNewCase}>
                <Plus className="w-4 h-4 mr-1" /> New Case
              </Button>
            )}
          </div>
          )
        ) : (
          <div className="space-y-3">
            {sortedCases.length === 0 && !searchTerm && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground font-body">No active cases.</p>
              </div>
            )}
            {sortedCases.map((caseRecord, index) => (
              <CaseRow key={caseRecord.id} caseData={caseRecord} index={index} onNavigate={() => navigate(`/paralegal/case/${caseRecord.id}`)} />
            ))}

            {filteredCompleted.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-secondary/50"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-0' : '-rotate-90'}`} />
                  Completed Cases
                  <Badge variant="secondary" className="ml-1 text-xs">{filteredCompleted.length}</Badge>
                </button>
                {showCompleted && (
                  <div className="mt-2 space-y-2 opacity-60">
                    {filteredCompleted.map((caseRecord) => (
                      <motion.div
                        key={caseRecord.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="surface-card cursor-pointer p-4"
                        onClick={() => navigate(`/paralegal/case/${caseRecord.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-foreground">{caseRecord.clientName}</h3>
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Ch.{caseRecord.chapterType}
                              </span>
                              <Badge className="bg-muted text-muted-foreground border-border text-xs capitalize">
                                {caseRecord.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <NewCaseModal open={showNewCase} onOpenChange={setShowNewCase} onCreated={() => setCases(getAllCases())} />
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        featureName={`Active Case Limit Reached`}
        description={`You have reached the ${getPlanLimits(plan).activeCases === 3 ? 'Solo' : 'Starter'} plan limit of ${getPlanLimits(plan).activeCases} active cases. Upgrade to ${getPlanLimits(plan).activeCases === 3 ? 'Starter' : 'Professional'} to add more.`}
      />
    </div>
  );
};

const CaseRow = ({ caseData, index, onNavigate }: { caseData: Case; index: number; onNavigate: () => void }) => {
  const progress = calculateProgress(caseData);
  const hasFlags = caseData.checklist.some(item => item.flaggedForAttorney);
  const hasRecentResubmission = caseHasRecentResubmission(caseData);

  // Find last SMS/notification sent
  const lastSmsEntry = [...caseData.activityLog]
    .filter(e => e.eventType === 'reminder_sent' || e.description?.toLowerCase().includes('sms'))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const lastSmsText = lastSmsEntry
    ? `Last contacted via SMS ${formatDistanceToNow(new Date(lastSmsEntry.timestamp), { addSuffix: true })}`
    : null;

  const urgencyClass = {
    critical: 'urgency-critical',
    'at-risk': 'urgency-at-risk',
    normal: 'urgency-normal',
  }[caseData.urgency];

  const getAction = () => {
    if (hasRecentResubmission) {
      return { label: 'Review Update', variant: 'warning' as const, action: onNavigate };
    }
    if (caseData.urgency === 'critical' && progress < 100) {
      return {
        label: 'Send Reminder',
        variant: 'warning' as const,
        action: async () => {
          try {
            const result = await sendSmartReminder(caseData);
            const channels = [];
            if (result.email.status === 'sent') channels.push('email');
            if (result.sms.status === 'sent') channels.push('SMS');
            if (channels.length > 0) {
              toast.success(`Reminder sent to ${caseData.clientName} via ${channels.join(' and ')}`);
            } else {
              toast.success(`Reminder queued for ${caseData.clientName}`);
            }
          } catch {
            toast.error('Failed to send reminder. Please try again.');
          }
        },
      };
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
      className={`surface-card-hover cursor-pointer p-4 sm:p-5 ${hasRecentResubmission ? 'border-warning/40 bg-warning/10' : ''}`}
      onClick={onNavigate}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-bold text-foreground">{caseData.clientName}</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ch.{caseData.chapterType}
            </span>
            <Badge className={`${urgencyClass} rounded-full px-2 py-0.5 text-xs`}>
              {caseData.urgency.replace('-', ' ')}
            </Badge>
            {hasRecentResubmission && (
              <Badge className="border-warning/20 bg-warning/10 text-warning text-xs">
                Resubmitted
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <span>{progress}%</span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(caseData.filingDeadline), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs mt-1">
            <MessageSquare className="w-3 h-3" />
            {lastSmsText ? (
              <span className="text-muted-foreground">{lastSmsText}</span>
            ) : (
              <span className="text-warning">Awaiting first contact</span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {(hasFlags || hasRecentResubmission) && <AlertCircle className={`w-5 h-5 ${hasRecentResubmission ? 'text-warning' : 'text-warning'}`} />}
          <Button
            variant={action.variant}
            size="sm"
            onClick={event => {
              event.stopPropagation();
              action.action();
            }}
          >
            {action.label}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ParalegalDashboard;
