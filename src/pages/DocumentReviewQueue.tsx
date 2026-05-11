import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, FileText, Image as ImageIcon, AlertTriangle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { getCaseDocumentSignedUrl } from '@/lib/case-documents';
import { fetchDashboardData } from '@/lib/dashboard-data';
import type { Case, ChecklistItem, UploadedFile } from '@/lib/store';
import { toast } from 'sonner';
import Logo from '@/components/Logo';
import { sendCorrectionRequest } from '@/lib/notifications';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DocumentViewer from '@/components/case/DocumentViewer';

type StatusFilter = 'all' | 'pending' | 'correction-requested';

interface QueuedDocument {
  caseRecord: Case;
  item: ChecklistItem;
  file: UploadedFile;
}

const DocumentReviewQueue = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseFilter, setCaseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [removedFileIds, setRemovedFileIds] = useState<Set<string>>(new Set());
  const [reviewedCount, setReviewedCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.firmId) return;
    try {
      const data = await fetchDashboardData(user.firmId);
      setCases(data.cases);
    } catch (e) {
      console.error('Failed to load review queue:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.firmId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Build flat queue of documents needing review
  const allQueued: QueuedDocument[] = useMemo(() => {
    const out: QueuedDocument[] = [];
    cases.forEach(c => {
      if (c.status === 'filed' || c.status === 'closed') return;
      c.checklist.forEach(item => {
        item.files.forEach(file => {
          if (
            (file.reviewStatus === 'pending' || file.reviewStatus === 'correction-requested') &&
            !removedFileIds.has(file.id)
          ) {
            out.push({ caseRecord: c, item, file });
          }
        });
      });
    });
    return out;
  }, [cases, removedFileIds]);

  // Apply filters
  const filteredQueue = useMemo(() => {
    return allQueued.filter(q => {
      if (caseFilter !== 'all' && q.caseRecord.id !== caseFilter) return false;
      if (statusFilter === 'pending' && q.file.reviewStatus !== 'pending') return false;
      if (statusFilter === 'correction-requested' && q.file.reviewStatus !== 'correction-requested') return false;
      return true;
    });
  }, [allQueued, caseFilter, statusFilter]);

  // Group filtered queue by case
  const groupedByCase = useMemo(() => {
    const groups = new Map<string, { caseRecord: Case; docs: QueuedDocument[] }>();
    filteredQueue.forEach(q => {
      const existing = groups.get(q.caseRecord.id);
      if (existing) existing.docs.push(q);
      else groups.set(q.caseRecord.id, { caseRecord: q.caseRecord, docs: [q] });
    });
    return Array.from(groups.values());
  }, [filteredQueue]);

  const totalPending = allQueued.length;
  const casesWithPending = new Set(allQueued.map(q => q.caseRecord.id)).size;

  const approveFile = async (fileId: string) => {
    const { error } = await supabase
      .from('files')
      .update({ review_status: 'approved' })
      .eq('id', fileId);
    if (error) {
      toast.error('Failed to approve document.');
      return false;
    }
    setRemovedFileIds(prev => new Set(prev).add(fileId));
    setReviewedCount(c => c + 1);
    return true;
  };

  const handleApprove = async (fileId: string) => {
    const ok = await approveFile(fileId);
    if (ok) toast.success('Document approved.');
  };

  const handleApproveAll = async () => {
    const ids = filteredQueue.filter(q => q.file.reviewStatus === 'pending').map(q => q.file.id);
    if (ids.length === 0) {
      toast.info('No pending documents to approve in current view.');
      return;
    }
    const { error } = await supabase
      .from('files')
      .update({ review_status: 'approved' })
      .in('id', ids);
    if (error) {
      toast.error('Failed to approve documents.');
      return;
    }
    setRemovedFileIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setReviewedCount(c => c + ids.length);
    toast.success(`Approved ${ids.length} document${ids.length === 1 ? '' : 's'}.`);
  };

  const handleRequestCorrection = async (q: QueuedDocument) => {
    const note = window.prompt('Reason for correction (will be visible to client):', '');
    if (!note || !note.trim()) return;

    const reason = note.trim();

    // 1. Update file status
    const { error } = await supabase
      .from('files')
      .update({ review_status: 'correction-requested', review_note: reason })
      .eq('id', q.file.id);

    if (error) {
      toast.error('Failed to request correction.');
      return;
    }

    // 2. Log activity
    await supabase.from('activity_log').insert({
      case_id: q.caseRecord.id,
      event_type: 'file_correction',
      actor_role: 'paralegal',
      actor_name: q.caseRecord.assignedParalegal || 'Paralegal',
      description: `Correction requested on ${q.item?.label || 'document'} — ${reason}`,
      item_id: q.item?.id,
    });

    // 3. Send notifications via email + SMS
    try {
      const result = await sendCorrectionRequest(q.caseRecord, reason, q.item.id);
      const channels: string[] = [];
      if (result.email?.status === 'sent') channels.push('email');
      if (result.sms?.status === 'sent') channels.push('SMS');

      if (channels.length > 0) {
        toast.success(`Correction requested. Client notified via ${channels.join(' and ')}.`);
      } else {
        toast.success('Correction requested. Client will see it next visit.');
      }
    } catch {
      toast.success('Correction requested.');
    }

    setRemovedFileIds(prev => new Set(prev).add(q.file.id));
    setReviewedCount(c => c + 1);
  };

  const handleViewFullSize = async (q: QueuedDocument) => {
    if (q.file.dataUrl) {
      window.open(q.file.dataUrl, '_blank');
    } else if (q.file.storagePath) {
      const url = await getCaseDocumentSignedUrl(q.file.storagePath);
      if (url) window.open(url, '_blank');
      else toast.error('No file URL available.');
    } else {
      toast.error('No file URL available.');
    }
  };

  const handleDelete = async (q: QueuedDocument) => {
    const confirmed = window.confirm('Delete this file? This cannot be undone.');
    if (!confirmed) return;

    try {
      // Delete storage object first (if present)
      if (q.file.storagePath) {
        const { error: storageErr } = await supabase.storage
          .from('case-documents')
          .remove([q.file.storagePath]);
        if (storageErr) console.warn('Storage removal failed:', storageErr);
      }

      const { error } = await supabase.from('files').delete().eq('id', q.file.id);
      if (error) {
        toast.error('Failed to delete file.');
        return;
      }

      // If no other files remain for this checklist item, mark it incomplete
      const remaining = q.item.files.filter(f => f.id !== q.file.id);
      if (remaining.length === 0) {
        await supabase.from('checklist_items').update({ completed: false }).eq('id', q.item.id);
      }

      await supabase.from('activity_log').insert({
        case_id: q.caseRecord.id,
        event_type: 'file_deleted',
        actor_role: 'paralegal',
        actor_name: user?.fullName || 'Paralegal',
        description: `Deleted ${q.file.name}`,
        item_id: q.item.id,
      });

      setRemovedFileIds(prev => new Set(prev).add(q.file.id));
      toast.success('File deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Delete failed.');
    }
  };

  const totalForProgress = totalPending + reviewedCount;

  // Cases dropdown options derived from all cases that have any pending docs
  const caseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allQueued.forEach(q => {
      if (!seen.has(q.caseRecord.id)) seen.set(q.caseRecord.id, q.caseRecord.clientName);
    });
    return Array.from(seen.entries());
  }, [allQueued]);

  const isImage = (f: UploadedFile) => /\.(png|jpe?g|gif|webp|heic)$/i.test(f.name);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body hidden sm:block">Document Review</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/paralegal')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Document Review Queue</h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {loading
                ? 'Loading…'
                : `${totalPending} document${totalPending === 1 ? '' : 's'} pending review across ${casesWithPending} case${casesWithPending === 1 ? '' : 's'}`}
            </p>
            {reviewedCount > 0 && totalForProgress > 0 && (
              <p className="text-xs text-success font-body mt-1">
                {reviewedCount} of {totalForProgress} reviewed this session
              </p>
            )}
          </div>
          {filteredQueue.length > 0 && (
            <Button onClick={handleApproveAll}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve All Visible
            </Button>
          )}
        </div>

        {/* Filter row */}
        {allQueued.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-xl border border-border/60 bg-secondary/20">
            <select
              value={caseFilter}
              onChange={e => setCaseFilter(e.target.value)}
              className="bg-input border border-border rounded-md px-3 py-1.5 text-sm font-body text-foreground"
            >
              <option value="all">All Cases</option>
              {caseOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              {(['all', 'pending', 'correction-requested'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-body rounded-md transition-colors ${
                    statusFilter === s
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'pending' ? 'Pending Review' : 'Correction Requested'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && allQueued.length === 0 ? (
          <div className="py-20 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
            <h2 className="font-display font-bold text-2xl text-foreground mb-2">All caught up.</h2>
            <p className="text-sm text-muted-foreground font-body mb-6">No documents pending review.</p>
            <Button onClick={() => navigate('/paralegal')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Button>
          </div>
        ) : !loading && filteredQueue.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground font-body">No documents match your filters.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setCaseFilter('all'); setStatusFilter('all'); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence>
              {groupedByCase.map(group => (
                <motion.section
                  key={group.caseRecord.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  layout
                >
                  {/* Case header row */}
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border/40">
                    <button
                      onClick={() => navigate(`/paralegal/case/${group.caseRecord.id}`)}
                      className="font-display font-bold text-foreground hover:text-primary transition-colors"
                    >
                      {group.caseRecord.clientName}
                    </button>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      group.caseRecord.chapterType === '13'
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      Ch.{group.caseRecord.chapterType}
                    </span>
                    <span className="text-xs text-muted-foreground font-body ml-auto">
                      Due {format(new Date(group.caseRecord.filingDeadline), 'MMM d, yyyy')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {group.docs.map(q => (
                        <motion.div
                          key={q.file.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.25 }}
                          className="surface-card p-4 rounded-xl"
                        >
                          <div className="flex items-start gap-4">
                            {/* Preview */}
                            <div className="flex-shrink-0 w-20 h-20 rounded-lg border border-border/60 bg-secondary/30 flex items-center justify-center overflow-hidden">
                              {isImage(q.file) && q.file.dataUrl ? (
                                <img src={q.file.dataUrl} alt={q.file.name} className="w-full h-full object-cover" />
                              ) : (
                                <FileText className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>

                            {/* Body */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-display font-semibold text-[16px] text-foreground truncate">{q.item.label}</h3>
                                {q.file.reviewStatus === 'correction-requested' && (
                                  <Badge className="border-warning/20 bg-warning/10 text-warning text-[10px]">
                                    Correction Requested
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground font-body truncate">{q.file.name}</p>
                              <p className="text-xs text-muted-foreground font-body mt-0.5">
                                Uploaded {format(new Date(q.file.uploadedAt), 'MMM d, yyyy h:mm a')}
                              </p>

                              {q.file.reviewStatus === 'correction-requested' && q.file.reviewNote && (
                                <div className="mt-2 p-2 rounded-md bg-warning/10 border border-warning/20 text-xs text-warning flex items-start gap-2">
                                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>{q.file.reviewNote}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-2 mt-3">
                                <Button size="sm" onClick={() => handleApprove(q.file.id)}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRequestCorrection(q)}>
                                  Request Correction
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleViewFullSize(q)}>
                                  <ImageIcon className="w-3.5 h-3.5 mr-1" /> View Full Size
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(q)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentReviewQueue;
