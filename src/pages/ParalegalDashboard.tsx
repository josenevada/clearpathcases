// STAFF FACING — subscription-gated for paralegal/attorney access
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, Clock, Settings, LogOut, Search, X, FileCheck, Send, Mail, Phone, AlertCircle } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import { Input } from '@/components/ui/input';
import { format, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Logo from '@/components/Logo';
import NewCaseModal from '@/components/case/NewCaseModal';
import TrialBanner from '@/components/TrialBanner';
import ThemeToggle from '@/components/ThemeToggle';
import SubscriptionGate from '@/components/SubscriptionGate';
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist';
import StatsBar from '@/components/dashboard/StatsBar';
import IntakeAgentStats from '@/components/dashboard/IntakeAgentStats';
import SendLinkModal from '@/components/dashboard/SendLinkModal';
import { getAllCases, saveCases, calculateProgress, type Case } from '@/lib/store';
import { caseHasRecentResubmission } from '@/lib/corrections';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import { sendSmartReminder } from '@/lib/notifications';
import { toast } from 'sonner';
import PlanBadge from '@/components/PlanBadge';
import UpgradeModal from '@/components/UpgradeModal';
import { fetchDashboardData, type DashboardOnboardingState } from '@/lib/dashboard-data';

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
  const [statsFilter, setStatsFilter] = useState<string | null>(null);
  const [sendLinkCase, setSendLinkCase] = useState<Case | null>(null);
  const [showSendLink, setShowSendLink] = useState(false);
  const [onboardingState, setOnboardingState] = useState<DashboardOnboardingState>({
    firmProfileComplete: false,
    brandingComplete: false,
    counselingComplete: false,
    hasSentLink: false,
  });

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

  const refreshDashboardData = useCallback(async () => {
    if (!user?.firmId) {
      setCases([]);
      return;
    }

    try {
      const data = await fetchDashboardData(user.firmId);
      setCases(data.cases);
      saveCases(data.cases);
      setOnboardingState(data.onboarding);
    } catch (error) {
      console.error('Failed to hydrate dashboard data:', error);
      setCases(getAllCases());
    }
  }, [user?.firmId]);

  useEffect(() => {
    void refreshDashboardData();
    const handleFocus = () => {
      void refreshDashboardData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshDashboardData]);

  const handleSignOut = async () => {
    sessionStorage.removeItem('admin_viewing_firm');
    await signOut();
    navigate('/login');
  };

  const handleCaseCreated = (c: Case) => {
    void refreshDashboardData();
    // Show send link modal for newly created case
    setSendLinkCase(c);
    setShowSendLink(true);
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

  const filterByStats = (list: Case[]) => {
    if (!statsFilter) return list;
    switch (statsFilter) {
      case 'active':
        return list.filter(c => c.status !== 'filed' && c.status !== 'closed');
      case 'pending':
        return list.filter(c => c.checklist.some(item => item.files.some(f => f.reviewStatus === 'pending')));
      case 'deadlines':
        return list.filter(c => {
          const d = differenceInDays(new Date(c.filingDeadline), new Date());
          return d >= 0 && d <= 7;
        });
      case 'ready':
        return list.filter(c => c.readyToFile);
      default:
        return list;
    }
  };

  const activeCases = [...cases].filter(c => c.status !== 'filed' && c.status !== 'closed');
  const completedCases = cases.filter(c => c.status === 'filed' || c.status === 'closed');
  const filteredActive = filterByStats(filterBySearch(activeCases));
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
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(() => {
    const dismissed = localStorage.getItem('upgrade_banner_dismissed');
    if (!dismissed) return false;
    return Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000;
  });

  const displayName = user?.fullName ?? 'Staff';
  const displayRole = user?.role === 'attorney' ? 'Attorney' : 'Paralegal';

  // PROMPT 1: Show upgrade interstitial with client-portal-safe message when trial expired
  if (!subLoading && !subscribed && (status === 'trial_expired' || status === 'canceled' || status === 'inactive')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <Logo size="lg" />
        <h1 className="font-display font-bold text-3xl text-foreground mt-8 mb-2">Your account is paused</h1>
        <p className="text-muted-foreground font-body mb-4 text-center max-w-md">
          Upgrade to continue managing cases.
        </p>
        <p className="text-sm text-muted-foreground font-body mb-10 text-center max-w-md">
          Note: your clients can still access their intake portals and upload documents while your account is paused.
        </p>
        <SubscriptionGate />
      </div>
    );
  }

  const showStarterBanner = plan === 'starter' && status === 'active' && !upgradeBannerDismissed;

  return (
    <div className="min-h-screen">
      {status === 'trial' && daysLeft !== null && daysLeft <= 3 && (
        <TrialBanner daysLeft={daysLeft} />
      )}
      {showStarterBanner && (
        <div
          className="flex items-center justify-between px-6 py-3 text-[13px] font-body"
          style={{ background: 'rgba(245,166,35,0.1)', borderLeft: '3px solid #f5a623' }}
        >
          <span className="text-foreground">
            You're on the Starter plan. Unlock AI form filling, means test engine, and exemption optimizer on Professional.{' '}
            <button onClick={() => navigate('/paralegal/settings')} className="text-primary font-medium hover:underline">
              Upgrade for $599/mo →
            </button>
          </span>
          <button
            onClick={() => { setUpgradeBannerDismissed(true); localStorage.setItem('upgrade_banner_dismissed', String(Date.now())); }}
            className="text-muted-foreground hover:text-foreground ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
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
        {/* Onboarding checklist */}
        <OnboardingChecklist
          firmProfileComplete={onboardingState.firmProfileComplete}
          brandingComplete={onboardingState.brandingComplete}
          counselingComplete={onboardingState.counselingComplete}
          hasCases={cases.length > 0}
          hasSentLink={onboardingState.hasSentLink}
          onNewCase={handleNewCase}
          onSendLink={() => {
            if (cases.length > 0) {
              setSendLinkCase(cases[0]);
              setShowSendLink(true);
            }
          }}
        />

        {/* Stats bar */}
        <StatsBar cases={cases} onFilter={setStatsFilter} activeFilter={statsFilter} />


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
          searchTerm || statsFilter ? (
            <div className="py-20 text-center">
              <p className="text-sm text-muted-foreground font-body">No cases match your filters.</p>
              {statsFilter && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setStatsFilter(null)}>
                  Clear filter
                </Button>
              )}
            </div>
          ) : cases.length === 0 ? (
            <div className="py-20 text-center">
              <p className="mb-2 text-lg font-display font-bold text-foreground">No cases yet</p>
              <p className="mb-6 text-sm text-muted-foreground font-body">Create your first case to get started.</p>
              {!isAdminViewing && (
                <Button size="lg" onClick={handleNewCase}>
                  <Plus className="w-4 h-4 mr-1" /> New Case
                </Button>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground font-body">No active cases.</p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {sortedCases.map((caseRecord, index) => (
              <CaseCard
                key={caseRecord.id}
                caseData={caseRecord}
                index={index}
                onNavigate={() => navigate(`/paralegal/case/${caseRecord.id}`)}
                onSendLink={() => { setSendLinkCase(caseRecord); setShowSendLink(true); }}
              />
            ))}

            {filteredCompleted.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-secondary/50"
                >
                  <span className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-0' : '-rotate-90'}`}>▾</span>
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
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                caseRecord.chapterType === '13'
                                  ? 'bg-warning/10 text-warning border border-warning/20'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}>
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

      <NewCaseModal open={showNewCase} onOpenChange={setShowNewCase} onCreated={handleCaseCreated} />
      <SendLinkModal open={showSendLink} onOpenChange={setShowSendLink} caseData={sendLinkCase} />
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        featureName={`Active Case Limit Reached`}
        description={`You have reached the ${getPlanLimits(plan).activeCases === 3 ? 'Solo' : 'Starter'} plan limit of ${getPlanLimits(plan).activeCases} active cases. Upgrade to ${getPlanLimits(plan).activeCases === 3 ? 'Starter' : 'Professional'} to add more.`}
      />
    </div>
  );
};

// ─── Case Card ───────────────────────────────────────────────────────
const CaseCard = ({ caseData, index, onNavigate, onSendLink }: { caseData: Case; index: number; onNavigate: () => void; onSendLink: () => void }) => {
  const [meansTestStatus, setMeansTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (caseData.chapterType !== '7') return;
    supabase
      .from('means_test_calculations')
      .select('eligibility_result')
      .eq('case_id', caseData.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMeansTestStatus(data.eligibility_result);
      });
  }, [caseData.id, caseData.chapterType]);
  const progress = calculateProgress(caseData);
  const hasRecentResubmission = caseHasRecentResubmission(caseData);
  const navigate = useNavigate();

  const docsUploaded = caseData.checklist.reduce((s, i) => s + i.files.length, 0);
  const docsApproved = caseData.checklist.reduce((s, i) => s + i.files.filter(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden').length, 0);
  const daysUntilDeadline = differenceInDays(new Date(caseData.filingDeadline), new Date());

  const deadlineColorClass = daysUntilDeadline < 7
    ? 'text-destructive'
    : daysUntilDeadline < 14
      ? 'text-warning'
      : 'text-primary';

  const urgencyClass = {
    critical: 'urgency-critical',
    'at-risk': 'urgency-at-risk',
    normal: 'urgency-normal',
  }[caseData.urgency];

  const hasPhone = !!caseData.clientPhone;
  const hasEmail = !!caseData.clientEmail;
  const hasBothMissing = !hasPhone && !hasEmail;

  const handleSendReminder = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // PROMPT 2: Contact validation before sending
    if (hasBothMissing) return; // button is disabled

    try {
      const result = await sendSmartReminder(caseData);
      const channels = [];
      if (result.email.status === 'sent') channels.push('email');
      if (result.sms.status === 'sent') channels.push('SMS');

      if (!hasPhone && hasEmail) {
        toast.warning(`Reminder sent by email only — no phone number on file for this client`);
      } else if (!hasEmail && hasPhone) {
        toast.warning(`Reminder sent by SMS only — no email address on file for this client`);
      } else if (channels.length > 0) {
        toast.success(`Reminder sent to ${caseData.clientName} via ${channels.join(' and ')}`);
      } else {
        toast.success(`Reminder queued for ${caseData.clientName}`);
      }
    } catch {
      toast.error('Failed to send reminder.');
    }
  };

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
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg font-bold text-foreground">{caseData.clientName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              caseData.chapterType === '13'
                ? 'bg-warning/10 text-warning border border-warning/20'
                : 'bg-primary/10 text-primary border border-primary/20'
            }`}>
              Ch.{caseData.chapterType}
            </span>
            {/* Means test status dot */}
            {meansTestStatus && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                    meansTestStatus === 'eligible_below_median' || meansTestStatus === 'eligible_above_median_passes'
                      ? 'bg-success'
                      : meansTestStatus === 'borderline'
                      ? 'bg-warning'
                      : meansTestStatus === 'presumption_of_abuse'
                      ? 'bg-destructive'
                      : ''
                  }`} />
                </TooltipTrigger>
                <TooltipContent>
                  {meansTestStatus === 'eligible_below_median' || meansTestStatus === 'eligible_above_median_passes'
                    ? 'Ch.7 Eligible'
                    : meansTestStatus === 'borderline'
                    ? 'Borderline — Review'
                    : meansTestStatus === 'presumption_of_abuse'
                    ? 'Presumption of Abuse'
                    : 'Means Test'}
                </TooltipContent>
              </Tooltip>
            )}
            {caseData.clientName.includes(' & ') && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full">Joint</Badge>
            )}
            <Badge className={`${urgencyClass} rounded-full px-2 py-0.5 text-xs`}>
              {caseData.urgency.replace('-', ' ')}
            </Badge>
            {hasRecentResubmission && (
              <Badge className="border-warning/20 bg-warning/10 text-warning text-xs">
                Resubmitted
              </Badge>
            )}
          </div>

          {/* Contact indicators — PROMPT 2 */}
          <div className="flex items-center gap-2 mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasEmail) navigate(`/paralegal/case/${caseData.id}`);
                  }}
                  className="flex items-center"
                >
                  <Mail className={`w-3 h-3 ${hasEmail ? 'text-success' : 'text-destructive'}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{hasEmail ? caseData.clientEmail : 'No email on file — edit case to add'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasPhone) navigate(`/paralegal/case/${caseData.id}`);
                  }}
                  className="flex items-center"
                >
                  <Phone className={`w-3 h-3 ${hasPhone ? 'text-success' : 'text-destructive'}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{hasPhone ? caseData.clientPhone : 'No phone on file — edit case to add'}</TooltipContent>
            </Tooltip>
            {hasBothMissing && (
              <span className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertCircle className="w-3 h-3" /> No contact info
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{docsUploaded} uploaded</span>
            <span className="text-success">{docsApproved} approved</span>
            <span className={`flex items-center gap-1 ${deadlineColorClass}`}>
              <Clock className="w-3 h-3" />
              {daysUntilDeadline > 0 ? `${daysUntilDeadline}d left` : daysUntilDeadline === 0 ? 'Due today' : 'Overdue'}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            View case
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendReminder}
                  className="text-primary hover:text-primary"
                  disabled={hasBothMissing}
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Remind
                </Button>
              </span>
            </TooltipTrigger>
            {hasBothMissing && (
              <TooltipContent>No contact info on file — edit this case to add a phone or email</TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
};

export default ParalegalDashboard;
