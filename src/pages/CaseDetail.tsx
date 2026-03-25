import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, FileText, Flag, MessageSquare, Pencil, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import DocumentsTab from '@/components/case/DocumentsTab';
import EditCasePanel from '@/components/case/EditCasePanel';
import CaseStatusDropdown from '@/components/case/CaseStatusDropdown';
import ClientInfoTab from '@/components/case/ClientInfoTab';
import { sendCorrectionRequest } from '@/lib/notifications';
import { sendCorrectionSms } from '@/lib/sms';
import { useAuth } from '@/lib/auth';
import {
  getCase,
  updateCase,
  addActivityEntry,
  calculateProgress,
  isItemEffectivelyComplete,
  CATEGORIES,
  type Case,
  type ChecklistItem,
  type UploadedFile,
  type FileReviewStatus,
} from '@/lib/store';
import { CORRECTION_REASON_OPTIONS, getChecklistItemStatus } from '@/lib/corrections';
import { toast } from 'sonner';

type ViewRole = 'paralegal' | 'attorney';
type TabType = 'checklist' | 'client-info' | 'documents' | 'activity';

const ApproveButton = ({ onApprove }: { onApprove: () => void }) => {
  const [state, setState] = useState<'idle' | 'success'>('idle');

  const handleClick = () => {
    onApprove();
    setState('success');
    setTimeout(() => setState('idle'), 1500);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={`gap-1 border-primary/30 text-primary hover:bg-primary/10 transition-colors ${
        state === 'success' ? 'border-success/40 text-success bg-success/10' : ''
      }`}
      disabled={state === 'success'}
    >
      <CheckCircle2 className="w-3 h-3" />
      {state === 'success' ? 'Approved' : 'Approve'}
    </Button>
  );
};

const CaseDetail = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const viewRole: ViewRole = user?.role === 'attorney' ? 'attorney' : 'paralegal';
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>(CATEGORIES[0]);
  const [noteTab, setNoteTab] = useState<'internal' | 'client'>('internal');
  const [newNote, setNewNote] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideTarget, setOverrideTarget] = useState<{ itemId: string; fileId: string } | null>(null);
  const [activeCorrectionTarget, setActiveCorrectionTarget] = useState<{ itemId: string; fileId: string } | null>(null);
  const [selectedCorrectionReason, setSelectedCorrectionReason] = useState('');
  const [correctionDetails, setCorrectionDetails] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('checklist');
  const [showEditPanel, setShowEditPanel] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    const c = getCase(caseId);
    if (!c) {
      navigate('/paralegal');
      return;
    }
    setCaseData(c);
  }, [caseId, navigate]);

  const refresh = () => {
    if (!caseId) return;
    const c = getCase(caseId);
    if (c) setCaseData(c);
  };

  if (!caseData) return null;

  const progress = calculateProgress(caseData);
  const urgencyClass = { critical: 'urgency-critical', 'at-risk': 'urgency-at-risk', normal: 'urgency-normal' }[caseData.urgency];
  const filteredNotes = caseData.notes.filter(note => (noteTab === 'internal' ? !note.clientVisible : note.clientVisible));

  const getFileStatusBadgeClass = (status: FileReviewStatus) => {
    switch (status) {
      case 'approved':
      case 'overridden':
        return 'bg-success/10 text-success border-success/20';
      case 'correction-requested':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const getFileStatusLabel = (file: UploadedFile) => {
    if (file.reviewStatus === 'overridden') return 'Approved (Override)';
    if (file.reviewStatus === 'correction-requested') return 'Correction Requested';
    if (file.reviewStatus === 'approved') return 'Approved';
    return 'Pending Review';
  };

  const resetCorrectionForm = () => {
    setActiveCorrectionTarget(null);
    setSelectedCorrectionReason('');
    setCorrectionDetails('');
  };

  const handleApprove = (item: ChecklistItem, fileId: string) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(checklistItem => checklistItem.id === item.id);
      const targetFile = found?.files.find(file => file.id === fileId);
      if (found && targetFile) {
        targetFile.reviewStatus = 'approved';
        targetFile.reviewNote = undefined;
      }
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'file_approved',
      actorRole: 'attorney',
      actorName: caseData.assignedAttorney,
      description: `Attorney approved ${item.label}`,
      itemId: item.id,
    });

    toast.success(`${item.label} approved`);
    refresh();
  };

  const handleCorrection = async (item: ChecklistItem, fileId: string) => {
    const reason = selectedCorrectionReason || correctionDetails.trim();
    const details = correctionDetails.trim() && correctionDetails.trim() !== selectedCorrectionReason ? correctionDetails.trim() : undefined;

    if (!reason) {
      toast.error('Please add a reason for the correction request.');
      return;
    }

    updateCase(caseData.id, c => {
      const found = c.checklist.find(checklistItem => checklistItem.id === item.id);
      const targetFile = found?.files.find(file => file.id === fileId);
      if (found && targetFile) {
        targetFile.reviewStatus = 'correction-requested';
        targetFile.reviewNote = details ? `${reason} — ${details}` : reason;
        found.completed = false;
        found.correctionRequest = {
          reason,
          details,
          requestedBy: caseData.assignedParalegal,
          requestedAt: new Date().toISOString(),
          targetFileId: fileId,
          status: 'open',
        };
      }
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'file_correction',
      actorRole: 'paralegal',
      actorName: caseData.assignedParalegal,
      description: `${caseData.assignedParalegal} requested a correction on ${item.label} — ${reason}`,
      itemId: item.id,
    });

    try {
      const result = await sendCorrectionRequest(caseData, reason, item.id);

      const channels = [];
      if (result.email.status === 'sent') channels.push('email');
      if (result.sms.status === 'sent') channels.push('SMS');

      if (channels.length > 0) {
        toast.success(`Correction requested and notification sent via ${channels.join(' and ')}.`);
      } else {
        toast.success('Correction requested. Notification delivery is configured but not active yet.');
      }
    } catch {
      toast.success('Correction requested. Notification delivery needs to be configured.');
    }

    // Trigger 5: Correction Request SMS
    sendCorrectionSms(
      caseData.clientPhone,
      caseData.clientName,
      caseData.caseCode || caseData.id,
      caseData.id,
    ).catch((err) => console.error('Correction SMS error:', err));

    resetCorrectionForm();
    refresh();
  };

  const handleOverride = (item: ChecklistItem, fileId: string) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(checklistItem => checklistItem.id === item.id);
      const targetFile = found?.files.find(file => file.id === fileId);
      if (found && targetFile) {
        targetFile.reviewStatus = 'overridden';
        targetFile.reviewNote = overrideNote || 'Attorney override';
      }
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'file_overridden',
      actorRole: 'attorney',
      actorName: caseData.assignedAttorney,
      description: `Attorney overrode and approved ${item.label}`,
      itemId: item.id,
    });

    setOverrideNote('');
    setOverrideTarget(null);
    toast.success('Document overridden and approved');
    refresh();
  };

  const handleFlag = (item: ChecklistItem) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(checklistItem => checklistItem.id === item.id);
      if (found) found.flaggedForAttorney = !found.flaggedForAttorney;
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'item_flagged',
      actorRole: 'paralegal',
      actorName: caseData.assignedParalegal,
      description: `${item.flaggedForAttorney ? 'Unflagged' : 'Flagged'} ${item.label} for attorney review`,
      itemId: item.id,
    });

    toast.success(item.flaggedForAttorney ? 'Flag removed' : 'Flagged for attorney');
    refresh();
  };

  const handleMarkReady = () => {
    const allRequiredApproved = caseData.checklist
      .filter(item => item.required)
      .every(item => item.files.length > 0 && item.files.some(file => file.reviewStatus === 'approved' || file.reviewStatus === 'overridden'));

    if (!allRequiredApproved) {
      toast.error('All required items must be approved before marking ready.');
      return;
    }

    updateCase(caseData.id, c => ({ ...c, readyToFile: true }));
    addActivityEntry(caseData.id, {
      eventType: 'case_ready',
      actorRole: 'attorney',
      actorName: caseData.assignedAttorney,
      description: 'Case marked as ready for filing',
    });
    toast.success('Case marked ready for filing!');
    refresh();
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    updateCase(caseData.id, c => ({
      ...c,
      notes: [...c.notes, {
        id: Math.random().toString(36).substr(2, 9),
        author: viewRole === 'paralegal' ? caseData.assignedParalegal : caseData.assignedAttorney,
        authorRole: viewRole,
        content: newNote,
        timestamp: new Date().toISOString(),
        clientVisible: noteTab === 'client',
      }],
    }));

    setNewNote('');
    toast.success('Note added');
    refresh();
  };

  const groupedActivity = caseData.activityLog
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .reduce<{ label: string; entries: typeof caseData.activityLog }[]>((groups, entry) => {
      const d = new Date(entry.timestamp);
      const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d');
      const existing = groups.find(group => group.label === label);
      if (existing) existing.entries.push(entry);
      else groups.push({ label, entries: [entry] });
      return groups;
    }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Link to="/paralegal" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex flex-1 items-center gap-3 flex-wrap">
            <h1 className="font-display text-xl font-bold text-foreground">{caseData.clientName}</h1>
            <span className="font-mono text-xs text-muted-foreground">{caseData.id}</span>
            <Button variant="outline" size="sm" onClick={() => setShowEditPanel(true)} className="gap-1.5">
              <Pencil className="w-3 h-3" /> Edit Case
            </Button>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ch.{caseData.chapterType}
            </span>
            <Badge className={`${urgencyClass} rounded-full px-2 py-0.5 text-xs`}>
              {caseData.urgency.replace('-', ' ')}
            </Badge>
            <CaseStatusDropdown
              caseData={caseData}
              actorName={user?.fullName || 'Staff'}
              onUpdated={setCaseData}
            />
            {!caseData.clientPhone && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
                <PhoneOff className="w-3 h-3" /> No phone number on file — SMS notifications paused
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="w-3 h-3" /> {format(new Date(caseData.filingDeadline), 'MMM d, yyyy')}
            </span>
            <span className="rounded-pill bg-secondary px-3 py-1 text-xs font-bold capitalize text-muted-foreground">
              {user?.fullName} · {viewRole}
            </span>
          </div>
        </div>
      </header>

      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-0">
            {([
              { key: 'checklist' as TabType, label: 'Checklist' },
              { key: 'client-info' as TabType, label: 'Client Info' },
              { key: 'documents' as TabType, label: 'Documents' },
              { key: 'activity' as TabType, label: 'Activity' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`border-b-2 px-5 py-3 text-sm font-bold font-body transition-all ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'client-info' && (
          <ClientInfoTab caseData={caseData} viewRole={viewRole} actorName={user?.fullName || 'Staff'} onRefresh={refresh} />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab caseData={caseData} viewRole={viewRole} onRefresh={refresh} />
        )}

        {activeTab === 'checklist' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="mb-4 space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-bold text-foreground">Documents</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    {progress}%
                  </div>
                </div>
                {(() => {
                  const allFiles = caseData.checklist.flatMap(i => i.files);
                  const validated = allFiles.filter(f => f.validationStatus === 'passed' || f.validationStatus === 'client-confirmed');
                  const needsReview = allFiles.filter(f => f.validationStatus === 'warning' || f.validationStatus === 'failed' || f.validationStatus === 'client-override');
                  const total = allFiles.length;
                  if (total === 0) return null;
                  if (needsReview.length > 0) {
                    return <p className="text-xs text-warning">{validated.length} of {total} documents validated — {needsReview.length} need review</p>;
                  }
                  if (validated.length === total && total > 0) {
                    return <p className="text-xs text-success">All documents validated</p>;
                  }
                  return null;
                })()}
              </div>

              {CATEGORIES.map(category => {
                const items = caseData.checklist.filter(item => item.category === category);
                const isOpen = expandedCategory === category;
                const catDone = items.filter(isItemEffectivelyComplete).length;
                const categoryHasCorrections = items.some(item => item.correctionRequest?.status === 'open');
                const categoryHasFlags = items.some(item => item.flaggedForAttorney);

                return (
                  <div key={category} className="surface-card overflow-hidden">
                    <button
                      onClick={() => setExpandedCategory(isOpen ? '' : category)}
                      className="flex w-full items-center justify-between p-4 transition-colors hover:bg-[hsl(var(--surface-hover))]"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        <span className="font-display font-bold text-foreground">{category}</span>
                        <span className="text-xs text-muted-foreground">{catDone}/{items.length}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {categoryHasCorrections && <AlertCircle className="w-4 h-4 text-warning" />}
                        {!categoryHasCorrections && categoryHasFlags && <Flag className="w-4 h-4 text-warning" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          {items.map(item => {
                            const status = getChecklistItemStatus(item);
                            const isExpanded = expandedItem === item.id;

                            return (
                              <div key={item.id} className="border-t border-border">
                                <button
                                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[hsl(var(--surface-hover))]"
                                >
                                  {item.completed ? (
                                    <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${status.tone === 'warning' ? 'text-warning' : 'text-success'}`} />
                                  ) : (
                                    <div className="w-5 h-5 flex-shrink-0 rounded-full border-2 border-muted-foreground/30" />
                                  )}
                                  <span className="flex-1 text-sm text-foreground">{item.label}</span>
                                  <span className={`text-xs ${status.colorClass}`}>{status.label}</span>
                                  {item.flaggedForAttorney && <Flag className="w-4 h-4 text-warning" />}
                                  {!item.required && <span className="text-[10px] text-muted-foreground">Optional</span>}
                                </button>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="space-y-4 px-4 pb-4 pl-12">
                                        {item.textEntry ? (
                                          <div className="surface-card p-4 space-y-2">
                                            <div className="flex items-start justify-between">
                                              <div>
                                                <p className="text-sm font-medium text-foreground">
                                                  {item.textEntry.selfEmployed
                                                    ? 'Self-employed'
                                                    : item.textEntry.notEmployed
                                                      ? 'Not currently employed'
                                                      : item.textEntry.employerName}
                                                </p>
                                                {item.textEntry.employerAddress && (
                                                  <p className="text-xs text-muted-foreground mt-1">{item.textEntry.employerAddress}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  Provided {format(new Date(item.textEntry.savedAt), 'MMM d, yyyy · h:mm a')}
                                                </p>
                                              </div>
                                              <Badge className={`${getFileStatusBadgeClass(item.files[0]?.reviewStatus || 'pending')} text-xs`}>
                                                {item.completed ? (item.files.some(f => f.reviewStatus === 'approved') ? 'Approved' : 'Pending Review') : 'Pending Review'}
                                              </Badge>
                                            </div>
                                            {viewRole === 'attorney' && (
                                              <div className="flex gap-2 mt-2">
                                                <Button variant="success" size="sm" onClick={() => {
                                                  const updated = updateCase(caseData!.id, c => {
                                                    const ci = c.checklist.find(x => x.id === item.id);
                                                    if (ci) ci.files = [{ id: 'text-approved', name: 'Employer Info', dataUrl: '', uploadedAt: item.textEntry!.savedAt, reviewStatus: 'approved', uploadedBy: 'client' }];
                                                    return c;
                                                  });
                                                  if (updated) setCaseData(updated);
                                                  toast.success('Employer information approved');
                                                }}>
                                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        ) : item.files.length > 0 ? (
                                          item.files.map(file => {
                                            const isActiveCorrection = activeCorrectionTarget?.itemId === item.id && activeCorrectionTarget.fileId === file.id;
                                            const isOverrideTarget = overrideTarget?.itemId === item.id && overrideTarget.fileId === file.id;

                                            return (
                                              <div key={file.id} className="space-y-3">
                                                <div className="surface-card p-4">
                                                  <div className="flex items-start gap-3">
                                                    <FileText className="w-8 h-8 flex-shrink-0 text-muted-foreground" />
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                                                          <p className="text-xs text-muted-foreground">
                                                            Uploaded {format(new Date(file.uploadedAt), 'MMM d, yyyy · h:mm a')} by {file.uploadedBy}
                                                          </p>
                                                          {file.reviewNote && (
                                                            <p className="mt-1 text-xs text-warning">Note: {file.reviewNote}</p>
                                                          )}
                                                        </div>
                                                        <Badge className={`${getFileStatusBadgeClass(file.reviewStatus)} text-xs`}>
                                                          {getFileStatusLabel(file)}
                                                        </Badge>
                                                      </div>

                                                      <div className="mt-3 flex flex-wrap gap-2">
                                                        {viewRole === 'paralegal' && file.reviewStatus !== 'approved' && file.reviewStatus !== 'overridden' && (
                                                          <ApproveButton
                                                            onApprove={() => {
                                                              updateCase(caseData.id, c => {
                                                                const found = c.checklist.find(ci => ci.id === item.id);
                                                                const target = found?.files.find(f => f.id === file.id);
                                                                if (found && target) {
                                                                  target.reviewStatus = 'approved';
                                                                  target.reviewNote = undefined;
                                                                }
                                                                return c;
                                                              });
                                                              addActivityEntry(caseData.id, {
                                                                eventType: 'file_approved',
                                                                actorRole: 'paralegal',
                                                                actorName: user?.fullName || caseData.assignedParalegal,
                                                                description: `${user?.fullName || caseData.assignedParalegal} approved ${file.name}`,
                                                                itemId: item.id,
                                                              });
                                                              refresh();
                                                            }}
                                                          />
                                                        )}
                                                        {viewRole === 'paralegal' && (
                                                          <Button
                                                            variant="warning"
                                                            size="sm"
                                                            onClick={() => {
                                                              setActiveCorrectionTarget({ itemId: item.id, fileId: file.id });
                                                              setSelectedCorrectionReason('');
                                                              setCorrectionDetails('');
                                                            }}
                                                          >
                                                            Request Correction
                                                          </Button>
                                                        )}

                                                        {viewRole === 'attorney' && (
                                                          <>
                                                            <Button variant="success" size="sm" onClick={() => handleApprove(item, file.id)}>
                                                              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                                            </Button>
                                                            <Button
                                                              variant="outline"
                                                              size="sm"
                                                              onClick={() => {
                                                                setOverrideTarget(isOverrideTarget ? null : { itemId: item.id, fileId: file.id });
                                                                setOverrideNote('');
                                                              }}
                                                            >
                                                              Override & Approve
                                                            </Button>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>

                                                {isActiveCorrection && viewRole === 'paralegal' && (
                                                  <div className="rounded-2xl border border-warning/20 bg-warning/10 p-4">
                                                    <p className="mb-3 text-sm font-semibold text-foreground">Reason for correction</p>
                                                    <div className="mb-3 flex flex-wrap gap-2">
                                                      {CORRECTION_REASON_OPTIONS.map(chip => (
                                                        <button
                                                          key={chip}
                                                          onClick={() => {
                                                            setSelectedCorrectionReason(chip);
                                                            setCorrectionDetails(chip);
                                                          }}
                                                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                                            selectedCorrectionReason === chip
                                                              ? 'border-warning bg-warning text-warning-foreground'
                                                              : 'border-warning/20 bg-background text-warning'
                                                          }`}
                                                        >
                                                          {chip}
                                                        </button>
                                                      ))}
                                                    </div>
                                                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                      Add details (optional)
                                                    </label>
                                                    <Input
                                                      value={correctionDetails}
                                                      onChange={event => setCorrectionDetails(event.target.value)}
                                                      placeholder="Add more detail for the client"
                                                      className="bg-background border-warning/20"
                                                    />
                                                    <div className="mt-3 flex gap-2">
                                                      <Button
                                                        variant="warning"
                                                        size="sm"
                                                        onClick={() => void handleCorrection(item, file.id)}
                                                        disabled={!selectedCorrectionReason && !correctionDetails.trim()}
                                                      >
                                                        Submit Correction Request
                                                      </Button>
                                                      <Button variant="ghost" size="sm" onClick={resetCorrectionForm}>
                                                        Cancel
                                                      </Button>
                                                    </div>
                                                  </div>
                                                )}

                                                {isOverrideTarget && viewRole === 'attorney' && (
                                                  <div className="surface-card p-3 space-y-2">
                                                    <p className="text-xs text-muted-foreground">Override note (optional):</p>
                                                    <Input
                                                      value={overrideNote}
                                                      onChange={event => setOverrideNote(event.target.value)}
                                                      className="bg-input border-border rounded-[10px] text-sm"
                                                      placeholder="Reason for override..."
                                                    />
                                                    <div className="flex gap-2">
                                                      <Button size="sm" onClick={() => handleOverride(item, file.id)}>Confirm Override</Button>
                                                      <Button variant="ghost" size="sm" onClick={() => setOverrideTarget(null)}>Cancel</Button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })
                                        ) : (
                                          <p className="text-sm text-muted-foreground">No file uploaded yet.</p>
                                        )}

                                        {viewRole === 'paralegal' && (
                                          <div className="flex items-center gap-3">
                                            <Button
                                              variant={item.flaggedForAttorney ? 'warning' : 'outline'}
                                              size="sm"
                                              onClick={() => handleFlag(item)}
                                            >
                                              <Flag className="w-3 h-3 mr-1" />
                                              {item.flaggedForAttorney ? 'Remove Flag' : 'Flag for Attorney'}
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {viewRole === 'attorney' && !caseData.readyToFile && (
                <div className="pt-4">
                  <Button size="lg" className="w-full" onClick={handleMarkReady}>
                    Mark Case Ready for Filing
                  </Button>
                </div>
              )}
              {caseData.readyToFile && (
                <div className="pt-4 text-center">
                  <Badge className="bg-success/10 text-success border-success/20 text-sm px-4 py-2">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Ready for Filing
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="mb-3 font-display text-lg font-bold text-foreground">Notes</h2>
                <div className="mb-4 flex rounded-pill bg-secondary p-0.5">
                  {(['internal', 'client'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setNoteTab(tab)}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold capitalize rounded-pill transition-all ${
                        noteTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {tab === 'internal' ? 'Internal' : 'Client-Visible'}
                    </button>
                  ))}
                </div>
                <div className="mb-4 max-h-[200px] space-y-2 overflow-y-auto">
                  {filteredNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No {noteTab} notes yet.</p>
                  ) : (
                    filteredNotes.map(note => (
                      <div key={note.id} className={`rounded-md p-3 text-sm ${note.clientVisible ? 'surface-card' : 'bg-secondary'}`}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{note.author}</span>
                          {!note.clientVisible && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Internal</span>}
                          <span className="ml-auto text-xs text-muted-foreground">{format(new Date(note.timestamp), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-muted-foreground">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={event => setNewNote(event.target.value)}
                    placeholder={`Add ${noteTab} note...`}
                    className="min-h-[60px] resize-none rounded-[10px] bg-input border-border text-sm"
                  />
                </div>
                <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2">
                  <MessageSquare className="w-3 h-3 mr-1" /> Add Note
                </Button>
              </div>

              <div className="surface-card p-4">
                <p className="mb-2 text-xs text-muted-foreground">Client Portal Link</p>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/client/${caseData.caseCode || caseData.id}`} className="rounded-[10px] bg-input border-border text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/client/${caseData.caseCode || caseData.id}`);
                      toast.success('Link copied!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="max-w-2xl">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Activity Log</h2>
            <div className="space-y-4">
              {groupedActivity.map(group => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  <div className="space-y-1">
                    {group.entries.map(entry => {
                      const isFlag = entry.eventType === 'item_flagged';
                      const isMilestone = entry.eventType === 'milestone_reached' || entry.eventType === 'case_ready';
                      return (
                        <div
                          key={entry.id}
                          className={`rounded-md p-2 text-sm ${
                            isFlag ? 'bg-warning/5 text-warning' : isMilestone ? 'bg-primary/5 text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          {entry.description}
                          <span className="ml-2 text-xs opacity-60">{format(new Date(entry.timestamp), 'h:mm a')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <EditCasePanel
        caseData={caseData}
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        onUpdated={setCaseData}
        actorName={user?.fullName || 'Staff'}
      />
    </div>
  );
};

export default CaseDetail;
