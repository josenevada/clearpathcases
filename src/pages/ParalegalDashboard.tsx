import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import { getAllCases, createCase, calculateProgress, type Case, type ChapterType } from '@/lib/store';
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

  const handleCreateCase = (data: {
    clientName: string; clientEmail: string; clientPhone: string;
    chapterType: ChapterType; filingDeadline: string;
    assignedParalegal: string; assignedAttorney: string;
  }) => {
    const newCase = createCase({
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone || undefined,
      chapterType: data.chapterType,
      filingDeadline: new Date(data.filingDeadline).toISOString(),
      assignedParalegal: data.assignedParalegal,
      assignedAttorney: data.assignedAttorney,
    });
    setCases(getAllCases());
    setShowNewCase(false);
    navigator.clipboard?.writeText(`${window.location.origin}/client/${newCase.id}`);
    toast.success('Case created! Client portal link copied to clipboard.');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body hidden sm:block">Paralegal Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden md:block">Sarah Johnson, Paralegal</span>
          <Button onClick={() => setShowNewCase(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Case
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* New Case Form */}
        {showNewCase && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-6 mb-8"
          >
            <NewCaseForm
              onSubmit={handleCreateCase}
              onCancel={() => setShowNewCase(false)}
            />
          </motion.div>
        )}

        {/* Case List */}
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
              <CaseRow key={c.id} caseData={c} index={i} onNavigate={() => navigate(`/paralegal/case/${c.id}`)} onRefresh={() => setCases(getAllCases())} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const CaseRow = ({ caseData, index, onNavigate, onRefresh }: { caseData: Case; index: number; onNavigate: () => void; onRefresh: () => void }) => {
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

const NewCaseForm = ({ onSubmit, onCancel }: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '',
    chapterType: '7' as ChapterType, filingDeadline: '',
    assignedParalegal: 'Sarah Johnson', assignedAttorney: 'David Park',
  });

  const valid = form.clientName && form.clientEmail && form.filingDeadline;

  return (
    <div>
      <h3 className="font-display font-bold text-xl text-foreground mb-4">Create New Case</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm">Client Name *</Label>
          <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Client Email *</Label>
          <Input value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} type="email" className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Client Phone</Label>
          <Input value={form.clientPhone} onChange={e => setForm({ ...form, clientPhone: e.target.value })} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Chapter Type *</Label>
          <div className="flex gap-2 mt-1">
            {(['7', '13'] as ChapterType[]).map(ch => (
              <button
                key={ch}
                onClick={() => setForm({ ...form, chapterType: ch })}
                className={`flex-1 h-10 rounded-pill text-sm font-bold transition-all ${
                  form.chapterType === ch
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                Chapter {ch}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Filing Deadline *</Label>
          <Input value={form.filingDeadline} onChange={e => setForm({ ...form, filingDeadline: e.target.value })} type="date" className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Assigned Paralegal</Label>
          <Input value={form.assignedParalegal} onChange={e => setForm({ ...form, assignedParalegal: e.target.value })} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Assigned Attorney</Label>
          <Input value={form.assignedAttorney} onChange={e => setForm({ ...form, assignedAttorney: e.target.value })} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
      </div>
      <div className="flex gap-3 mt-6 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!valid}>Create Case</Button>
      </div>
    </div>
  );
};

export default ParalegalDashboard;
