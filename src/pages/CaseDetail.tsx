import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock, FileText, Flag, MessageSquare, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import Logo from '@/components/Logo';
import { getCase, updateCase, addActivityEntry, calculateProgress, CATEGORIES, type Case, type ChecklistItem, type FileReviewStatus, type InternalNote } from '@/lib/store';
import { toast } from 'sonner';

type ViewRole = 'paralegal' | 'attorney';

const CaseDetail = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [viewRole, setViewRole] = useState<ViewRole>('paralegal');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>(CATEGORIES[0]);
  const [noteTab, setNoteTab] = useState<'internal' | 'client'>('internal');
  const [newNote, setNewNote] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [showConfirmOverride, setShowConfirmOverride] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    const c = getCase(caseId);
    if (!c) { navigate('/paralegal'); return; }
    setCaseData(c);
  }, [caseId, navigate]);

  const refresh = () => { if (caseId) { const c = getCase(caseId); if (c) setCaseData(c); } };

  if (!caseData) return null;

  const progress = calculateProgress(caseData);
  const urgencyClass = { critical: 'urgency-critical', 'at-risk': 'urgency-at-risk', normal: 'urgency-normal' }[caseData.urgency];

  const getStatusInfo = (item: ChecklistItem) => {
    if (item.files.length === 0) return { label: 'Not Started', color: 'text-muted-foreground' };
    const status = item.files[0].reviewStatus;
    const map: Record<FileReviewStatus, { label: string; color: string }> = {
      'pending': { label: 'Pending Review', color: 'text-warning' },
      'approved': { label: 'Approved', color: 'text-success' },
      'correction-requested': { label: 'Correction Requested', color: 'text-destructive' },
      'overridden': { label: 'Overridden', color: 'text-primary' },
    };
    return map[status];
  };

  const handleApprove = (item: ChecklistItem) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === item.id);
      if (found && found.files.length > 0) found.files[0].reviewStatus = 'approved';
      return c;
    });
    addActivityEntry(caseData.id, {
      eventType: 'file_approved', actorRole: 'attorney', actorName: caseData.assignedAttorney,
      description: `Attorney approved ${item.label}`, itemId: item.id,
    });
    toast.success(`${item.label} approved`);
    refresh();
  };

  const handleCorrection = (item: ChecklistItem) => {
    if (!correctionNote.trim()) { toast.error('Please add a note for the correction.'); return; }
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === item.id);
      if (found && found.files.length > 0) {
        found.files[0].reviewStatus = 'correction-requested';
        found.files[0].reviewNote = correctionNote;
        found.completed = false;
      }
      return c;
    });
    addActivityEntry(caseData.id, {
      eventType: 'file_correction', actorRole: 'attorney', actorName: caseData.assignedAttorney,
      description: `Correction requested on ${item.label} — '${correctionNote}'`, itemId: item.id,
    });
    setCorrectionNote('');
    toast.success('Correction requested');
    refresh();
  };

  const handleOverride = (item: ChecklistItem) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === item.id);
      if (found && found.files.length > 0) {
        found.files[0].reviewStatus = 'overridden';
        found.files[0].reviewNote = overrideNote || 'Attorney override';
      }
      return c;
    });
    addActivityEntry(caseData.id, {
      eventType: 'file_overridden', actorRole: 'attorney', actorName: caseData.assignedAttorney,
      description: `Attorney overrode and approved ${item.label}`, itemId: item.id,
    });
    setOverrideNote('');
    setShowConfirmOverride(false);
    toast.success('Document overridden and approved');
    refresh();
  };

  const handleFlag = (item: ChecklistItem) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === item.id);
      if (found) found.flaggedForAttorney = !found.flaggedForAttorney;
      return c;
    });
    addActivityEntry(caseData.id, {
      eventType: 'item_flagged', actorRole: 'paralegal', actorName: caseData.assignedParalegal,
      description: `${item.flaggedForAttorney ? 'Unflagged' : 'Flagged'} ${item.label} for attorney review`, itemId: item.id,
    });
    toast.success(item.flaggedForAttorney ? 'Flag removed' : 'Flagged for attorney');
    refresh();
  };

  const handleMarkReady = () => {
    const allRequiredApproved = caseData.checklist
      .filter(i => i.required)
      .every(i => i.files.length > 0 && (i.files[0].reviewStatus === 'approved' || i.files[0].reviewStatus === 'overridden'));

    if (!allRequiredApproved) {
      toast.error('All required items must be approved before marking ready.');
      return;
    }

    updateCase(caseData.id, c => ({ ...c, readyToFile: true }));
    addActivityEntry(caseData.id, {
      eventType: 'case_ready', actorRole: 'attorney', actorName: caseData.assignedAttorney,
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

  // Group activity by date
  const groupedActivity = caseData.activityLog
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .reduce<{ label: string; entries: typeof caseData.activityLog }[]>((groups, entry) => {
      const d = new Date(entry.timestamp);
      const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d');
      const existing = groups.find(g => g.label === label);
      if (existing) existing.entries.push(entry);
      else groups.push({ label, entries: [entry] });
      return groups;
    }, []);

  const correctionChips = ['Wrong year', 'Illegible', 'Missing pages', 'Wrong document type'];

  const filteredNotes = caseData.notes.filter(n => noteTab === 'internal' ? !n.clientVisible : n.clientVisible);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <Link to="/paralegal" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex-1 flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-bold text-xl text-foreground">{caseData.clientName}</h1>
            <span className="text-xs text-muted-foreground font-mono">{caseData.id}</span>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Ch.{caseData.chapterType}
            </span>
            <Badge className={`${urgencyClass} text-xs px-2 py-0.5 rounded-full`}>
              {caseData.urgency.replace('-', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {format(new Date(caseData.filingDeadline), 'MMM d, yyyy')}
            </span>
            {/* Role toggle */}
            <div className="flex bg-secondary rounded-pill p-0.5">
              {(['paralegal', 'attorney'] as ViewRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => setViewRole(role)}
                  className={`px-3 py-1 text-xs font-bold rounded-pill capitalize transition-all ${
                    viewRole === role ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Document Checklist */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display font-bold text-lg text-foreground">Documents</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                </div>
                {progress}%
              </div>
            </div>

            {CATEGORIES.map(cat => {
              const items = caseData.checklist.filter(i => i.category === cat);
              const isOpen = expandedCategory === cat;
              const catDone = items.filter(i => i.completed).length;

              return (
                <div key={cat} className="surface-card overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(isOpen ? '' : cat)}
                    className="w-full flex items-center justify-between p-4 hover:bg-[hsl(var(--surface-hover))] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      <span className="font-display font-bold text-foreground">{cat}</span>
                      <span className="text-xs text-muted-foreground">{catDone}/{items.length}</span>
                    </div>
                    {items.some(i => i.flaggedForAttorney) && <AlertCircle className="w-4 h-4 text-warning" />}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        {items.map(item => {
                          const status = getStatusInfo(item);
                          const isExpanded = expandedItem === item.id;

                          return (
                            <div key={item.id} className="border-t border-border">
                              <button
                                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                className="w-full flex items-center gap-3 p-4 hover:bg-[hsl(var(--surface-hover))] transition-colors text-left"
                              >
                                {item.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                                )}
                                <span className="flex-1 text-foreground text-sm">{item.label}</span>
                                <span className={`text-xs ${status.color}`}>{status.label}</span>
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
                                    <div className="px-4 pb-4 pl-12 space-y-4">
                                      {item.files.length > 0 ? (
                                        <div className="surface-card p-4 flex items-center gap-3">
                                          <FileText className="w-8 h-8 text-muted-foreground" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-foreground text-sm font-medium truncate">{item.files[0].name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Uploaded {format(new Date(item.files[0].uploadedAt), 'MMM d, yyyy · h:mm a')} by {item.files[0].uploadedBy}
                                            </p>
                                            {item.files[0].reviewNote && (
                                              <p className="text-xs text-destructive mt-1">Note: {item.files[0].reviewNote}</p>
                                            )}
                                          </div>
                                          <Badge className={`${
                                            item.files[0].reviewStatus === 'approved' || item.files[0].reviewStatus === 'overridden'
                                              ? 'bg-success/10 text-success border-success/20'
                                              : item.files[0].reviewStatus === 'correction-requested'
                                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                                : 'bg-warning/10 text-warning border-warning/20'
                                          } text-xs`}>
                                            {item.files[0].reviewStatus.replace('-', ' ')}
                                          </Badge>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No file uploaded yet.</p>
                                      )}

                                      {/* Paralegal actions */}
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

                                      {/* Attorney actions */}
                                      {viewRole === 'attorney' && item.files.length > 0 && (
                                        <div className="space-y-3">
                                          <div className="flex gap-2 flex-wrap">
                                            <Button variant="success" size="sm" onClick={() => handleApprove(item)}>
                                              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setShowConfirmOverride(showConfirmOverride ? false : true)}
                                            >
                                              Override & Approve
                                            </Button>
                                          </div>

                                          {/* Correction */}
                                          <div className="space-y-2">
                                            <div className="flex gap-1 flex-wrap">
                                              {correctionChips.map(chip => (
                                                <button
                                                  key={chip}
                                                  onClick={() => setCorrectionNote(chip)}
                                                  className="px-2 py-1 text-xs rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                  {chip}
                                                </button>
                                              ))}
                                            </div>
                                            <div className="flex gap-2">
                                              <Input
                                                value={correctionNote}
                                                onChange={e => setCorrectionNote(e.target.value)}
                                                placeholder="Correction note..."
                                                className="bg-input border-border rounded-[10px] text-sm"
                                              />
                                              <Button variant="destructive" size="sm" onClick={() => handleCorrection(item)} disabled={!correctionNote.trim()}>
                                                Request Correction
                                              </Button>
                                            </div>
                                          </div>

                                          {/* Override confirm */}
                                          {showConfirmOverride && (
                                            <div className="surface-card p-3 space-y-2">
                                              <p className="text-xs text-muted-foreground">Override note (optional):</p>
                                              <Input value={overrideNote} onChange={e => setOverrideNote(e.target.value)} className="bg-input border-border rounded-[10px] text-sm" placeholder="Reason for override..." />
                                              <div className="flex gap-2">
                                                <Button size="sm" onClick={() => handleOverride(item)}>Confirm Override</Button>
                                                <Button variant="ghost" size="sm" onClick={() => setShowConfirmOverride(false)}>Cancel</Button>
                                              </div>
                                            </div>
                                          )}
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

            {/* Mark ready button (attorney only) */}
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

          {/* Right: Activity Feed + Notes */}
          <div className="space-y-6">
            {/* Activity Feed */}
            <div>
              <h2 className="font-display font-bold text-lg text-foreground mb-4">Activity</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {groupedActivity.map(group => (
                  <div key={group.label}>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">{group.label}</p>
                    <div className="space-y-1">
                      {group.entries.map(entry => {
                        const isFlag = entry.eventType === 'item_flagged';
                        const isMilestone = entry.eventType === 'milestone_reached' || entry.eventType === 'case_ready';
                        return (
                          <div
                            key={entry.id}
                            className={`text-sm p-2 rounded-md ${
                              isFlag ? 'bg-warning/5 text-warning' : isMilestone ? 'bg-primary/5 text-primary' : 'text-muted-foreground'
                            }`}
                          >
                            {entry.description}
                            <span className="text-xs ml-2 opacity-60">
                              {format(new Date(entry.timestamp), 'h:mm a')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <h2 className="font-display font-bold text-lg text-foreground mb-3">Notes</h2>
              <div className="flex bg-secondary rounded-pill p-0.5 mb-4">
                {(['internal', 'client'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setNoteTab(tab)}
                    className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-pill capitalize transition-all ${
                      noteTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {tab === 'internal' ? 'Internal' : 'Client-Visible'}
                  </button>
                ))}
              </div>

              <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
                {filteredNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No {noteTab} notes yet.</p>
                ) : (
                  filteredNotes.map(note => (
                    <div key={note.id} className={`p-3 rounded-md text-sm ${
                      note.clientVisible ? 'surface-card' : 'bg-secondary'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground text-xs">{note.author}</span>
                        {!note.clientVisible && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Internal</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{note.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder={`Add ${noteTab} note...`}
                  className="bg-input border-border rounded-[10px] text-sm min-h-[60px] resize-none"
                />
              </div>
              <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2">
                <MessageSquare className="w-3 h-3 mr-1" /> Add Note
              </Button>
            </div>

            {/* Client Portal Link */}
            <div className="surface-card p-4">
              <p className="text-xs text-muted-foreground mb-2">Client Portal Link</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/client/${caseData.id}`}
                  className="bg-input border-border rounded-[10px] text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/client/${caseData.id}`);
                    toast.success('Link copied!');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CaseDetail;
