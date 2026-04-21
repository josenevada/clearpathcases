import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import FormDataTab from '@/components/case/FormDataTab';
import MeansTestTab from '@/components/case/MeansTestTab';
import ExemptionsTab from '@/components/case/ExemptionsTab';
import SignaturesTab from '@/components/case/SignaturesTab';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, Download, FileText, Flag, MessageSquare, Pencil, PhoneOff, Trash2, Ban, Plus, Tag, Lock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DocumentsTab from '@/components/case/DocumentsTab';
import DocumentViewer from '@/components/case/DocumentViewer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BuildPacketTab from '@/components/case/BuildPacketTab';
import EditCasePanel from '@/components/case/EditCasePanel';
import CaseStatusDropdown from '@/components/case/CaseStatusDropdown';
import ClientInfoTab from '@/components/case/ClientInfoTab';
import { sendCorrectionRequest } from '@/lib/notifications';
import { sendCorrectionSms } from '@/lib/sms';
import { useAuth } from '@/lib/auth';
import {
  updateCase,
  deleteCase,
  
  calculateProgress,
  isItemEffectivelyComplete,
  CATEGORIES,
  CH13_MILESTONES,
  type Case,
  type ChecklistItem,
  type UploadedFile,
  type FileReviewStatus,
  type MilestoneEntry,
} from '@/lib/store';
import { CORRECTION_REASON_OPTIONS, getChecklistItemStatus } from '@/lib/corrections';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits, FEATURE_GATE_INFO } from '@/lib/plan-limits';
import UpgradeModal from '@/components/UpgradeModal';

type ViewRole = 'paralegal' | 'attorney';
type TabType = 'checklist' | 'client-info' | 'documents' | 'activity' | 'packet' | 'form-data' | 'means-test' | 'exemptions' | 'signatures';

type PreviewFile = { name: string; dataUrl: string; itemId: string; fileId: string; reviewStatus: string } | null;

const ApproveButton = ({ onApprove }: { onApprove: () => Promise<void> }) => {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = async () => {
    setState('loading');
    try {
      await onApprove();
      setState('success');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('idle');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={state === 'loading' || state === 'success'}
      className={`gap-1 border-primary/30 text-primary hover:bg-primary/10 transition-colors ${
        state === 'success' ? 'border-success/40 text-success bg-success/10' : ''
      }`}
    >
      <CheckCircle2 className="w-3 h-3" />
      {state === 'loading' ? 'Saving…' : state === 'success' ? 'Approved' : 'Approve'}
    </Button>
  );
};

const CaseDetail = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'documents';
  const { user, loading: authLoading } = useAuth();
  const { plan, status: subStatus } = useSubscription();
  const planLimits = getPlanLimits(plan);
  const isTrial = subStatus === 'trial';
  const [caseData, setCaseData] = useState<Case | null>(null);
  const viewRole: ViewRole = user?.role === 'attorney' ? 'attorney' : 'paralegal';
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string>(CATEGORIES[0]);
  const [newNote, setNewNote] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideTarget, setOverrideTarget] = useState<{ itemId: string; fileId: string } | null>(null);
  const [activeCorrectionTarget, setActiveCorrectionTarget] = useState<{ itemId: string; fileId: string } | null>(null);
  const [selectedCorrectionReason, setSelectedCorrectionReason] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [zipBuilding, setZipBuilding] = useState(false);
  const [correctionDetails, setCorrectionDetails] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [naTarget, setNaTarget] = useState<string | null>(null);
  const [naReason, setNaReason] = useState('');
  const [naCustomReason, setNaCustomReason] = useState('');
  // PROMPT 5: Add custom document inline form state
  const [addDocCategory, setAddDocCategory] = useState<string | null>(null);
  const [addDocName, setAddDocName] = useState('');
  const [addDocDesc, setAddDocDesc] = useState('');
  const [addDocRequired, setAddDocRequired] = useState(true);

  const loadCaseFromSupabase = async (id: string) => {
    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (caseError) { console.error('Case load error:', caseError); toast.error('Failed to load case'); navigate('/paralegal'); return; }
    if (!caseRow) { navigate('/paralegal'); return; }

    const [{ data: checklistRows }, { data: fileRows }, { data: activityRows }, { data: noteRows }] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('case_id', id).order('sort_order', { ascending: true }),
      supabase.from('files').select('*').eq('case_id', id),
      supabase.from('activity_log').select('*').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('notes').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    ]);

    // Generate public URLs for files with storage_path
    const filesWithUrls = (fileRows || []).map((f: any) => {
      let displayUrl = f.data_url || '';
      if (f.storage_path && !displayUrl) {
        const { data: publicUrlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(f.storage_path);
        displayUrl = publicUrlData.publicUrl || '';
      }
      return { ...f, data_url: displayUrl };
    });

    const mapFiles = (itemId: string): UploadedFile[] =>
      filesWithUrls
        .filter((f: any) => f.checklist_item_id === itemId)
        .map((f: any) => ({
          id: f.id,
          name: f.file_name,
          dataUrl: f.data_url || '',
          storagePath: f.storage_path || undefined,
          uploadedAt: f.uploaded_at || new Date().toISOString(),
          reviewStatus: f.review_status || 'pending',
          reviewNote: f.review_note || undefined,
          uploadedBy: f.uploaded_by || 'client',
        }));

    const checklist: ChecklistItem[] = (checklistRows || []).map((row: any) => ({
      id: row.id,
      category: row.category,
      label: row.label,
      description: row.description || '',
      whyWeNeedThis: row.why_we_need_this || '',
      required: row.required ?? true,
      files: mapFiles(row.id),
      textEntry: row.text_value ? (row.text_value as any) : undefined,
      flaggedForAttorney: row.flagged_for_attorney ?? false,
      attorneyNote: row.attorney_note || undefined,
      correctionRequest: row.correction_status
        ? {
            reason: row.correction_reason || '',
            details: row.correction_details || undefined,
            requestedBy: row.correction_requested_by || '',
            requestedAt: row.correction_requested_at || '',
            targetFileId: row.correction_target_file_id || undefined,
            status: row.correction_status,
          }
        : undefined,
      resubmittedAt: row.resubmitted_at || undefined,
      completed: row.completed ?? false,
      notApplicable: row.not_applicable ?? false,
      notApplicableReason: row.not_applicable_reason || undefined,
      notApplicableMarkedBy: row.not_applicable_marked_by || undefined,
      notApplicableAt: row.not_applicable_at || undefined,
    }));

    const builtCase: Case = {
      id: caseRow.id,
      clientName: caseRow.client_name,
      clientEmail: caseRow.client_email,
      clientPhone: caseRow.client_phone || undefined,
      clientDob: caseRow.client_dob || undefined,
      caseCode: caseRow.case_code || undefined,
      courtCaseNumber: caseRow.court_case_number || undefined,
      chapterType: caseRow.chapter_type as any,
      assignedParalegal: caseRow.assigned_paralegal || '',
      assignedAttorney: caseRow.assigned_attorney || '',
      filingDeadline: caseRow.filing_deadline,
      createdAt: caseRow.created_at || new Date().toISOString(),
      lastClientActivity: caseRow.last_client_activity || undefined,
      checklist,
      activityLog: (activityRows || []).map((a: any) => ({
        id: a.id,
        eventType: a.event_type,
        actorRole: a.actor_role || '',
        actorName: a.actor_name || '',
        description: a.description || '',
        timestamp: a.created_at || new Date().toISOString(),
        itemId: a.item_id || undefined,
      })),
      notes: (noteRows || []).map((n: any) => ({
        id: n.id,
        author: n.author_name || '',
        authorRole: n.author_role || '',
        content: n.content || '',
        timestamp: n.created_at || new Date().toISOString(),
        clientVisible: n.visibility === 'client',
      })),
      checkpointsCompleted: [],
      urgency: (caseRow.urgency || 'normal') as Case['urgency'],
      status: (caseRow.status || 'active') as Case['status'],
      readyToFile: caseRow.ready_to_file ?? false,
      wizardStep: caseRow.wizard_step ?? 0,
      closedAt: caseRow.closed_at || undefined,
      retentionNotifiedAt: caseRow.retention_notified_at || undefined,
      retentionDeleteScheduledAt: caseRow.retention_delete_scheduled_at || undefined,
      district: caseRow.district || undefined,
      meetingDate: caseRow.meeting_date || undefined,
    };

    setCaseData(builtCase);
  };

  useEffect(() => {
    if (!caseId || authLoading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    void loadCaseFromSupabase(caseId);
  }, [caseId, navigate, authLoading, user]);

  // Default notes panel expansion based on whether notes exist
  useEffect(() => {
    if (caseData) {
      const visibleCount = caseData.notes.filter(n => !n.clientVisible).length;
      setNotesExpanded(visibleCount > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData?.id]);

  const refresh = () => {
    if (!caseId) return;
    void loadCaseFromSupabase(caseId);
  };

  if (authLoading || !caseData) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground font-body">Loading case…</div>
    </div>
  );

  const progress = calculateProgress(caseData);
  const urgencyClass = { critical: 'urgency-critical', 'at-risk': 'urgency-at-risk', normal: 'urgency-normal' }[caseData.urgency];
  const filteredNotes = caseData.notes.filter(note => !note.clientVisible);

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

  const CHECKLIST_CATEGORY_FOLDERS: Record<string, string> = {
    'Income & Employment': '01-Income',
    'Bank & Financial Accounts': '02-Bank-Financial',
    'Debts & Credit': '03-Debts-Credit',
    'Assets & Property': '04-Assets-Property',
    'Personal Identification': '05-Personal-ID',
    'Agreements & Confirmation': '06-Legal-Agreements',
  };

  const getClientLastName = () => {
    const last = (caseData as any).clientLastName?.trim?.();
    if (last) return String(last).replace(/[^a-zA-Z0-9]/g, '');
    const parts = (caseData.clientName || 'Client').trim().split(/\s+/);
    return (parts[parts.length - 1] || 'Client').replace(/[^a-zA-Z0-9]/g, '');
  };

  const fetchFileBlobUrl = async (file: UploadedFile): Promise<string | null> => {
    if (file.dataUrl) return file.dataUrl;
    if (file.storagePath) {
      const { data } = supabase.storage.from('case-documents').getPublicUrl(file.storagePath);
      return data.publicUrl || null;
    }
    return null;
  };

  const handleDownloadSingle = async (item: ChecklistItem, file: UploadedFile) => {
    setDownloadingFileId(file.id);
    try {
      const url = await fetchFileBlobUrl(file);
      if (!url) {
        toast.error('File not available for download.');
        return;
      }
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const docType = item.label.replace(/[^a-zA-Z0-9]/g, '-');
      const date = format(new Date(file.uploadedAt), 'yyyy-MM-dd');
      const downloadName = `${getClientLastName()}-${docType}-${date}.${ext}`;
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const hasApprovedFiles = caseData.checklist.some(item =>
    item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')
  );

  const handleDownloadAllApproved = async () => {
    const approvedEntries: { file: UploadedFile; item: ChecklistItem }[] = [];
    caseData.checklist.forEach(item => {
      item.files.forEach(file => {
        if (file.reviewStatus === 'approved' || file.reviewStatus === 'overridden') {
          approvedEntries.push({ file, item });
        }
      });
    });
    if (approvedEntries.length === 0) {
      toast.error('No approved files to download.');
      return;
    }

    setZipBuilding(true);
    const loadingToast = toast.loading(`Building ZIP with ${approvedEntries.length} file${approvedEntries.length !== 1 ? 's' : ''}...`);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();

      const labelCounts = new Map<string, number>();
      approvedEntries.forEach(({ item }) => {
        labelCounts.set(item.label, (labelCounts.get(item.label) || 0) + 1);
      });
      const labelIndices = new Map<string, number>();
      const lastName = getClientLastName();

      for (const { file, item } of approvedEntries) {
        const folder = CHECKLIST_CATEGORY_FOLDERS[item.category] || 'Other';
        const date = format(new Date(file.uploadedAt), 'yyyy-MM-dd');
        const docType = item.label.replace(/[^a-zA-Z0-9]/g, '-');
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const hasMultiple = (labelCounts.get(item.label) || 0) > 1;
        let cleanName: string;
        if (hasMultiple) {
          const idx = (labelIndices.get(item.label) || 0) + 1;
          labelIndices.set(item.label, idx);
          cleanName = `${lastName}-${docType}-${date}-${idx}.${ext}`;
        } else {
          cleanName = `${lastName}-${docType}-${date}.${ext}`;
        }
        const url = await fetchFileBlobUrl(file);
        if (url) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            zip.folder(folder)?.file(cleanName, blob);
          } catch {
            zip.folder(folder)?.file(cleanName, `Placeholder for ${file.name}`);
          }
        } else {
          zip.folder(folder)?.file(cleanName, `Placeholder for ${file.name}`);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${lastName}-Documents-${format(new Date(), 'yyyy-MM-dd')}.zip`);
      toast.dismiss(loadingToast);
      toast.success('ZIP downloaded successfully.');
    } catch (err) {
      console.error('ZIP build failed:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to build ZIP.');
    } finally {
      setZipBuilding(false);
    }
  };

  const resetCorrectionForm = () => {
    setActiveCorrectionTarget(null);
    setSelectedCorrectionReason('');
    setCorrectionDetails('');
  };

  const handleApprove = async (item: ChecklistItem, fileId: string) => {
    // Persist to Supabase first
    await supabase.from('files').update({ review_status: 'approved', review_note: null }).eq('id', fileId);
    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'file_approved',
      actor_role: 'attorney',
      actor_name: caseData.assignedAttorney,
      description: `Attorney approved ${item.label}`,
      item_id: item.id,
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

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'file_correction',
      actor_role: 'paralegal',
      actor_name: caseData.assignedParalegal,
      description: `${caseData.assignedParalegal} requested a correction on ${item.label} — ${reason}`,
      item_id: item.id,
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

  const handleOverride = async (item: ChecklistItem, fileId: string) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(checklistItem => checklistItem.id === item.id);
      const targetFile = found?.files.find(file => file.id === fileId);
      if (found && targetFile) {
        targetFile.reviewStatus = 'overridden';
        targetFile.reviewNote = overrideNote || 'Attorney override';
      }
      return c;
    });

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'file_overridden',
      actor_role: 'attorney',
      actor_name: caseData.assignedAttorney,
      description: `Attorney overrode and approved ${item.label}`,
      item_id: item.id,
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

    (async () => {
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'item_flagged',
        actor_role: 'paralegal',
        actor_name: caseData.assignedParalegal,
        description: `${item.flaggedForAttorney ? 'Unflagged' : 'Flagged'} ${item.label} for attorney review`,
        item_id: item.id,
      });
    })();

    toast.success(item.flaggedForAttorney ? 'Flag removed' : 'Flagged for attorney');
    refresh();
  };

  const handleMarkReady = async () => {
    const isRequiredItemComplete = (item: typeof caseData.checklist[number]) => {
      if (item.notApplicable) return true;
      if (item.textEntry?.savedAt) return item.attorneyNote?.startsWith('Approved by') ?? false;
      if (item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')) return true;
      return item.completed && item.files.length === 0;
    };

    const allRequiredComplete = caseData.checklist
      .filter(item => item.required)
      .every(isRequiredItemComplete);

    if (!allRequiredComplete) {
      const blocking = caseData.checklist
        .filter(item => item.required && !item.notApplicable)
        .filter(item => !isRequiredItemComplete(item))
        .map(item => item.label);

      toast.error(`${blocking.length} item${blocking.length !== 1 ? 's' : ''} still need approval: ${blocking.slice(0, 2).join(', ')}${blocking.length > 2 ? ` and ${blocking.length - 2} more` : ''}`);
      return;
    }

    await supabase.from('cases')
      .update({ ready_to_file: true })
      .eq('id', caseData.id);

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'case_ready',
      actor_role: 'attorney',
      actor_name: user?.fullName || caseData.assignedAttorney,
      description: 'Case marked as ready for filing',
    });

    toast.success('Case marked ready for filing!');
    refresh();
  };

  const handleDeleteCase = async () => {
    if (!caseData || deleteConfirmName !== caseData.clientName) return;
    setIsDeleting(true);
    try {
      // Delete all associated records from Supabase
      await Promise.all([
        supabase.from('files').delete().eq('case_id', caseData.id),
        supabase.from('checklist_items').delete().eq('case_id', caseData.id),
        supabase.from('activity_log').delete().eq('case_id', caseData.id),
        supabase.from('notes').delete().eq('case_id', caseData.id),
        supabase.from('client_info').delete().eq('case_id', caseData.id),
        supabase.from('attorney_notes').delete().eq('case_id', caseData.id),
        supabase.from('checkpoints').delete().eq('case_id', caseData.id),
      ]);
      // Delete the case itself
      await supabase.from('cases').delete().eq('id', caseData.id);
      // Delete from localStorage
      deleteCase(caseData.id);
      // Delete files from storage
      const { data: storedFiles } = await supabase.storage.from('case-documents').list(caseData.id);
      if (storedFiles && storedFiles.length > 0) {
        await supabase.storage.from('case-documents').remove(storedFiles.map(f => `${caseData.id}/${f.name}`));
      }
      toast.success('Case deleted permanently.');
      navigate('/paralegal');
    } catch (err) {
      console.error('Failed to delete case:', err);
      toast.error('Failed to delete case. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const NA_REASONS = [
    'Client is unemployed',
    'Client does not own this asset',
    'Document does not exist for this client',
    'Other',
  ];

  const handleMarkNotApplicable = async (item: ChecklistItem) => {
    const reason = naReason === 'Other' ? naCustomReason.trim() : naReason;
    if (!reason) {
      toast.error('Please select a reason.');
      return;
    }

    const actorName = user?.fullName || 'Staff';
    const timestamp = new Date().toISOString();

    updateCase(caseData.id, c => {
      const found = c.checklist.find(ci => ci.id === item.id);
      if (found) {
        found.notApplicable = true;
        found.notApplicableReason = reason;
        found.notApplicableMarkedBy = actorName;
        found.notApplicableAt = timestamp;
        found.completed = false;
      }
      return c;
    });

    (async () => {
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'item_not_applicable',
        actor_role: 'paralegal',
        actor_name: actorName,
        description: `${actorName} marked ${item.label} as not applicable — ${reason}`,
        item_id: item.id,
      });
    })();

    // Sync to Supabase
    await supabase.from('checklist_items').update({
      not_applicable: true,
      not_applicable_reason: reason,
      not_applicable_marked_by: actorName,
      not_applicable_at: timestamp,
    }).eq('id', item.id);

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'item_not_applicable',
      actor_role: 'paralegal',
      actor_name: actorName,
      description: `${actorName} marked ${item.label} as not applicable — ${reason}`,
      item_id: item.id,
    });

    setNaTarget(null);
    setNaReason('');
    setNaCustomReason('');
    toast.success(`${item.label} marked as not applicable`);
    refresh();
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const noteId = crypto.randomUUID();
    const author = viewRole === 'paralegal' 
      ? (caseData.assignedParalegal || user?.fullName || 'Staff')
      : (caseData.assignedAttorney || user?.fullName || 'Attorney');
    const timestamp = new Date().toISOString();

    await supabase.from('notes').insert({
      id: noteId,
      case_id: caseData.id,
      author_name: author,
      author_role: viewRole,
      content: newNote.trim(),
      visibility: 'internal',
      created_at: timestamp,
    });

    setNewNote('');
    toast.success('Note added');
    refresh();
  };

  // PROMPT 5: Add custom document to a category
  const handleAddCustomDoc = async (category: string) => {
    const actorRole = viewRole;
    if (!addDocName.trim()) {
      toast.error('Please enter a document name.');
      return;
    }
    const newItemId = crypto.randomUUID();
    const sortOrder = caseData.checklist.filter(i => i.category === category).length;

    // Add to localStorage
    updateCase(caseData.id, c => ({
      ...c,
      checklist: [...c.checklist, {
        id: newItemId,
        category,
        label: addDocName.trim(),
        description: addDocDesc.trim(),
        whyWeNeedThis: '',
        required: addDocRequired,
        files: [],
        flaggedForAttorney: false,
        completed: false,
        isCustom: true,
      } as any],
    }));

    // Sync to Supabase
    await supabase.from('checklist_items').insert({
      id: newItemId,
      case_id: caseData.id,
      category,
      label: addDocName.trim(),
      description: addDocDesc.trim(),
      why_we_need_this: '',
      required: addDocRequired,
      completed: false,
      sort_order: sortOrder,
      input_type: 'file',
    });

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'item_added',
      actor_role: actorRole,
      actor_name: user?.fullName || 'Staff',
      description: `Added custom document "${addDocName.trim()}" to ${category}`,
      item_id: newItemId,
    });

    setAddDocCategory(null);
    setAddDocName('');
    setAddDocDesc('');
    setAddDocRequired(true);
    toast.success(`"${addDocName.trim()}" added to checklist`);
    refresh();
  };

  const handleDeleteCustomDoc = async (item: ChecklistItem) => {
    const isCustom = (item as any).isCustom;
    const confirmMsg = isCustom
      ? `Delete "${item.label}" from this checklist? This cannot be undone.`
      : `Delete "${item.label}" from this checklist? Any uploaded files for this item will also be removed. This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    // Remove from localStorage
    updateCase(caseData.id, c => ({
      ...c,
      checklist: c.checklist.filter(i => i.id !== item.id),
    }));

    // Remove from Supabase
    await supabase.from('files').delete().eq('checklist_item_id', item.id);
    await supabase.from('checklist_items').delete().eq('id', item.id);

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'item_removed',
      actor_role: viewRole,
      actor_name: user?.fullName || 'Staff',
      description: `Removed checklist item "${item.label}"`,
      item_id: item.id,
    });

    toast.success(`"${item.label}" removed from checklist`);
    refresh();
  };

  const handleQuickMarkNA = async (item: ChecklistItem) => {
    const actorName = user?.fullName || 'Staff';
    const timestamp = new Date().toISOString();

    updateCase(caseData.id, c => {
      const found = c.checklist.find(ci => ci.id === item.id);
      if (found) {
        found.notApplicable = true;
        found.notApplicableReason = 'Marked by staff';
        found.notApplicableMarkedBy = actorName;
        found.notApplicableAt = timestamp;
        found.completed = false;
      }
      return c;
    });

    await supabase.from('checklist_items').update({
      not_applicable: true,
      not_applicable_reason: 'Marked by staff',
      not_applicable_marked_by: actorName,
      not_applicable_at: timestamp,
    }).eq('id', item.id);

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'item_not_applicable',
      actor_role: viewRole,
      actor_name: actorName,
      description: `${actorName} marked ${item.label} as not applicable`,
      item_id: item.id,
    });

    toast.success(`${item.label} marked as N/A`);
    refresh();
  };

  const handleRemoveNA = async (item: ChecklistItem) => {
    const actorName = user?.fullName || 'Staff';

    updateCase(caseData.id, c => {
      const found = c.checklist.find(ci => ci.id === item.id);
      if (found) {
        found.notApplicable = false;
        found.notApplicableReason = undefined;
        found.notApplicableMarkedBy = undefined;
        found.notApplicableAt = undefined;
      }
      return c;
    });

    await supabase.from('checklist_items').update({
      not_applicable: false,
      not_applicable_reason: null,
      not_applicable_marked_by: null,
      not_applicable_at: null,
    }).eq('id', item.id);

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'item_na_removed',
      actor_role: viewRole,
      actor_name: actorName,
      description: `${actorName} removed N/A from ${item.label}`,
      item_id: item.id,
    });

    toast.success(`N/A removed from ${item.label}`);
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
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link to="/paralegal" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>

          <h1 className="font-display text-xl font-bold text-foreground">{caseData.clientName}</h1>

          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            caseData.chapterType === '13'
              ? 'bg-warning/10 text-warning border border-warning/20'
              : 'bg-primary/10 text-primary border border-primary/20'
          }`}>
            Ch.{caseData.chapterType}
          </span>

          {caseData.urgency !== 'normal' && (
            <Badge className={`${urgencyClass} rounded-full px-2 py-0.5 text-xs`}>
              {caseData.urgency.replace('-', ' ')}
            </Badge>
          )}

          <CaseStatusDropdown
            caseData={caseData}
            actorName={user?.fullName || 'Staff'}
            onUpdated={setCaseData}
          />

          <div className="flex-1" />

          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Due</span>
            {format(new Date(caseData.filingDeadline), 'MMM d, yyyy')}
          </span>

          <div className="relative group">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => setShowEditPanel(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-t-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Case
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-b-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Case
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CH.13 Milestone Timeline */}
      {caseData.chapterType === '13' && caseData.milestones && (
        <div className="border-b border-border bg-secondary/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Chapter 13 Milestones</span>
            </div>
            <div className="flex items-center gap-0 overflow-x-auto pb-1">
              {caseData.milestones.map((ms, i) => {
                const isCompleted = ms.completed;
                const isUpcoming = !isCompleted && (i === 0 || caseData.milestones![i - 1]?.completed);
                return (
                  <div key={ms.name} className="flex items-center flex-shrink-0">
                    <button
                      className="flex flex-col items-center gap-1.5 group"
                      onClick={() => {
                        const newDate = ms.date ? undefined : new Date().toISOString().split('T')[0];
                        const toggled = !ms.completed;
                        updateCase(caseData.id, c => ({
                          ...c,
                          milestones: c.milestones?.map((m, idx) => idx === i ? { ...m, completed: toggled, date: toggled ? (m.date || new Date().toISOString().split('T')[0]) : m.date } : m),
                        }));
                        refresh();
                      }}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                        isCompleted
                          ? 'bg-success text-success-foreground'
                          : isUpcoming
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {isCompleted ? '✓' : i + 1}
                      </div>
                      <span className={`text-[9px] font-body text-center max-w-[72px] leading-tight ${
                        isCompleted ? 'text-success font-bold' : isUpcoming ? 'text-primary font-bold' : 'text-muted-foreground'
                      }`}>
                        {ms.name}
                      </span>
                      {ms.date && (
                        <span className="text-[8px] text-muted-foreground">{ms.date}</span>
                      )}
                    </button>
                    {i < caseData.milestones!.length - 1 && (
                      <div className={`w-6 h-0.5 mx-0.5 flex-shrink-0 ${isCompleted ? 'bg-success' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-0">
            {(() => {
              const isFeatureGated = (tabKey: string) => {
                if (isTrial) return false;
                const gatedPro = ['packet', 'form-data', 'means-test', 'exemptions', 'signatures'];
                if (gatedPro.includes(tabKey)) return !planLimits.courtPackets;
                return false;
              };
              return ([
                { key: 'documents' as TabType, label: 'Documents' },
                { key: 'checklist' as TabType, label: 'Checklist' },
                { key: 'client-info' as TabType, label: 'Client Info' },
                { key: 'activity' as TabType, label: 'Activity' },
              ]).map(tab => {
                const locked = isFeatureGated(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`border-b-2 px-5 py-3 text-sm font-bold font-body transition-all ${
                      activeTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {locked && <Lock className="w-3 h-3" />}
                      {tab.label}
                      {'dot' in tab && tab.dot && !locked && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Feature gate card for locked tabs */}
        {(() => {
          const gatedTabs = ['packet', 'form-data', 'means-test', 'exemptions', 'signatures'];
          const isLocked = gatedTabs.includes(activeTab) && !isTrial && !planLimits.courtPackets;
          if (!isLocked) return null;
          const info = FEATURE_GATE_INFO[activeTab] || { name: activeTab, minTier: 'Professional', roi: '' };
          return (
            <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold font-heading text-foreground">{info.name}</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {info.name} is available on {info.minTier} and above. Upgrade your plan to unlock this feature.
              </p>
              {info.roi && (
                <p className="text-sm text-primary font-medium">{info.roi}</p>
              )}
              <Button onClick={() => navigate('/paralegal/settings')} className="bg-primary text-primary-foreground">
                Upgrade Plan
              </Button>
            </div>
          );
        })()}
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-lg font-bold text-foreground">Documents</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      {progress}%
                    </div>
                  </div>
                  {hasApprovedFiles && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadAllApproved}
                      disabled={zipBuilding}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {zipBuilding ? 'Building…' : 'Download All Approved'}
                    </Button>
                  )}
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
                              <div key={item.id} className="border-t border-border group">
                                <button
                                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[hsl(var(--surface-hover))]"
                                >
                                  {item.notApplicable ? (
                                    <Ban className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                                  ) : item.completed ? (
                                    <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${status.tone === 'warning' ? 'text-warning' : 'text-success'}`} />
                                  ) : (
                                    <div className="w-5 h-5 flex-shrink-0 rounded-full border-2 border-muted-foreground/30" />
                                  )}
                                  <span className={`flex-1 text-sm ${item.notApplicable ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {item.label}
                                    {(item as any).isCustom && (
                                      <Badge className="ml-1.5 bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0">Custom</Badge>
                                    )}
                                  </span>
                                  {item.notApplicable ? (
                                    <Badge className="bg-muted text-muted-foreground border-border text-[10px]">N/A</Badge>
                                  ) : (
                                    <span className={`text-xs ${status.colorClass}`}>{status.label}</span>
                                  )}
                                  {item.flaggedForAttorney && <Flag className="w-4 h-4 text-warning" />}
                                  {!item.required && !item.notApplicable && <span className="text-[10px] text-muted-foreground">Optional</span>}
                                  <div onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                          <MoreVertical className="w-3.5 h-3.5" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-44">
                                        {!item.notApplicable ? (
                                          <DropdownMenuItem onClick={() => handleQuickMarkNA(item)}>
                                            <Ban className="w-3.5 h-3.5 mr-2" /> Mark as N/A
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => handleRemoveNA(item)}>
                                            <Ban className="w-3.5 h-3.5 mr-2" /> Remove N/A
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteCustomDoc(item)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Item
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
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
                                                {item.completed 
                                                  ? (item.textEntry?.savedAt 
                                                      ? (item.attorneyNote?.startsWith('Approved by') ? 'Approved' : 'Provided')
                                                      : item.files.some(f => f.reviewStatus === 'approved') 
                                                        ? 'Approved' 
                                                        : 'Pending Review'
                                                    ) 
                                                  : 'Pending Review'
                                                }
                                              </Badge>
                                            </div>
                                            {viewRole === 'attorney' && 
                                             item.textEntry?.savedAt && 
                                             !item.attorneyNote?.startsWith('Approved by') && (
                                              <div className="flex gap-2 mt-2">
                                                <Button variant="success" size="sm" onClick={async () => {
                                                  try {
                                                    const { error: updateError } = await supabase
                                                      .from('checklist_items')
                                                      .update({
                                                        completed: true,
                                                        attorney_note: `Approved by ${user?.fullName || 'Attorney'} on ${new Date().toLocaleDateString()}`,
                                                        flagged_for_attorney: false,
                                                      })
                                                      .eq('id', item.id);

                                                    if (updateError) {
                                                      console.error('Approval update error:', updateError);
                                                      toast.error('Approval failed. Please try again.');
                                                      return;
                                                    }

                                                    const { error: logError } = await supabase.from('activity_log').insert({
                                                      case_id: caseData!.id,
                                                      event_type: 'file_approved',
                                                      actor_role: 'attorney',
                                                      actor_name: user?.fullName || caseData!.assignedAttorney,
                                                      description: `Attorney approved employer information for ${caseData!.clientName}`,
                                                      item_id: item.id,
                                                    });

                                                    if (logError) console.error('Activity log error:', logError);

                                                    toast.success('Employer information approved');
                                                    refresh();
                                                  } catch (err) {
                                                    console.error('Failed to approve employer info:', err);
                                                    toast.error('Approval failed. Please try again.');
                                                  }
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
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const url = file.dataUrl || (file.storagePath ? supabase.storage.from('case-documents').getPublicUrl(file.storagePath).data.publicUrl : '');
                                                        if (url) setPreviewFile({ name: file.name, dataUrl: url, itemId: item.id, fileId: file.id, reviewStatus: file.reviewStatus });
                                                      }}
                                                      className="mt-0.5 hover:text-primary transition-colors"
                                                    >
                                                      <FileText className="w-8 h-8 flex-shrink-0 text-muted-foreground hover:text-primary" />
                                                    </button>
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const url = file.dataUrl || (file.storagePath ? supabase.storage.from('case-documents').getPublicUrl(file.storagePath).data.publicUrl : '');
                                                              if (url) setPreviewFile({ name: file.name, dataUrl: url, itemId: item.id, fileId: file.id, reviewStatus: file.reviewStatus });
                                                            }}
                                                            className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors text-left"
                                                          >
                                                            {file.name}
                                                          </button>
                                                          <p className="text-xs text-muted-foreground">
                                                            Uploaded {format(new Date(file.uploadedAt), 'MMM d, yyyy · h:mm a')} by {file.uploadedBy}
                                                          </p>
                                                          {file.reviewNote && (
                                                            <p className="mt-1 text-xs text-warning">Note: {file.reviewNote}</p>
                                                          )}
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDownloadSingle(item, file)}
                                                            disabled={downloadingFileId === file.id}
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                            title="Download file"
                                                          >
                                                            <Download className="w-4 h-4" />
                                                          </Button>
                                                          <Badge className={`${getFileStatusBadgeClass(file.reviewStatus)} text-xs`}>
                                                            {getFileStatusLabel(file)}
                                                          </Badge>
                                                        </div>
                                                      </div>

                                                      <div className="mt-3 flex flex-wrap gap-2">
                                                        {viewRole === 'paralegal' && file.reviewStatus !== 'approved' && file.reviewStatus !== 'overridden' && (
                                                          <ApproveButton
                                                            onApprove={async () => {
                                                              await supabase.from('files').update({ review_status: 'approved', review_note: null }).eq('id', file.id);
                                                              await supabase.from('activity_log').insert({
                                                                case_id: caseData.id,
                                                                event_type: 'file_approved',
                                                                actor_role: 'paralegal',
                                                                actor_name: user?.fullName || caseData.assignedParalegal,
                                                                description: `${user?.fullName || caseData.assignedParalegal} approved ${file.name}`,
                                                                item_id: item.id,
                                                              });
                                                              refresh();
                                                            }}
                                                          />
                                                        )}
{viewRole === 'paralegal' && file.reviewStatus !== 'approved' && file.reviewStatus !== 'overridden' && (
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

{viewRole === 'attorney' && file.reviewStatus !== 'approved' && file.reviewStatus !== 'overridden' && (
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
                                          <div className="space-y-3">
                                            {item.notApplicable && (
                                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Ban className="w-4 h-4" />
                                                <span>Marked N/A{item.notApplicableReason ? ` — ${item.notApplicableReason}` : ''}</span>
                                                {item.notApplicableMarkedBy && (
                                                  <span className="text-xs">by {item.notApplicableMarkedBy}</span>
                                                )}
                                              </div>
                                            )}
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <Button
                                                variant={item.flaggedForAttorney ? 'warning' : 'outline'}
                                                size="sm"
                                                onClick={() => handleFlag(item)}
                                              >
                                                <Flag className="w-3 h-3 mr-1" />
                                                {item.flaggedForAttorney ? 'Remove Flag' : 'Flag for Attorney'}
                                              </Button>
                                              {!item.notApplicable && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => { setNaTarget(item.id); setNaReason(''); setNaCustomReason(''); }}
                                                  className="text-muted-foreground"
                                                >
                                                  <Ban className="w-3 h-3 mr-1" /> Mark as Not Applicable
                                                </Button>
                                              )}
                                            </div>

                                            {naTarget === item.id && (
                                              <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                                                <p className="text-sm font-semibold text-foreground">Reason for N/A</p>
                                                <Select value={naReason} onValueChange={setNaReason}>
                                                  <SelectTrigger className="bg-background">
                                                    <SelectValue placeholder="Select a reason..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {NA_REASONS.map(r => (
                                                      <SelectItem key={r} value={r}>{r}</SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                {naReason === 'Other' && (
                                                  <Input
                                                    value={naCustomReason}
                                                    onChange={e => setNaCustomReason(e.target.value)}
                                                    placeholder="Describe why this doesn't apply..."
                                                    className="bg-background"
                                                  />
                                                )}
                                                <div className="flex gap-2">
                                                  <Button
                                                    size="sm"
                                                    onClick={() => handleMarkNotApplicable(item)}
                                                    disabled={!naReason || (naReason === 'Other' && !naCustomReason.trim())}
                                                  >
                                                    Save
                                                  </Button>
                                                  <Button variant="ghost" size="sm" onClick={() => setNaTarget(null)}>Cancel</Button>
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

                          {/* Add custom document button */}
                          {(
                            <div className="border-t border-border px-4 py-3">
                              {addDocCategory === category ? (
                                <div className="space-y-3">
                                  <Input
                                    value={addDocName}
                                    onChange={e => setAddDocName(e.target.value)}
                                    placeholder="Document name (required)"
                                    className="bg-input border-border rounded-[10px] text-sm"
                                    autoFocus
                                  />
                                  <Input
                                    value={addDocDesc}
                                    onChange={e => setAddDocDesc(e.target.value)}
                                    placeholder="Instructions for the client (optional)"
                                    className="bg-input border-border rounded-[10px] text-sm"
                                  />
                                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <input type="checkbox" checked={addDocRequired} onChange={e => setAddDocRequired(e.target.checked)} className="accent-primary" />
                                    Required
                                  </label>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleAddCustomDoc(category)} disabled={!addDocName.trim()}>
                                      Add to checklist
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { setAddDocCategory(null); setAddDocName(''); setAddDocDesc(''); }}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAddDocCategory(category)}
                                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add document to this section
                                </button>
                              )}
                            </div>
                          )}
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
              {!notesExpanded ? (
                <button
                  onClick={() => setNotesExpanded(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Notes</span>
                    <Badge variant="secondary" className="text-xs">{filteredNotes.length}</Badge>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : (
                <AnimatePresence initial={false}>
                  <motion.div
                    key="notes-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-display text-lg font-bold text-foreground">Notes</h2>
                      <button
                        onClick={() => setNotesExpanded(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Collapse notes"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mb-4 max-h-[200px] space-y-2 overflow-y-auto">
                      {filteredNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No notes yet.</p>
                      ) : (
                        filteredNotes.map(note => (
                          <div key={note.id} className="rounded-md p-3 text-sm bg-secondary">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground">{note.author}</span>
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
                        placeholder="Add note..."
                        className="min-h-[60px] resize-none rounded-[10px] bg-input border-border text-sm"
                      />
                    </div>
                    <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2">
                      <MessageSquare className="w-3 h-3 mr-1" /> Add Note
                    </Button>
                  </motion.div>
                </AnimatePresence>
              )}

              <div className="surface-card p-4">
                <p className="mb-2 text-xs text-muted-foreground">Client Portal Link</p>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/client/${caseData.caseCode}`} className="rounded-[10px] bg-input border-border text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/client/${caseData.caseCode}`);
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

        {activeTab === 'packet' && (isTrial || planLimits.courtPackets) && (
          <BuildPacketTab caseData={caseData} onRefresh={refresh} />
        )}

        {activeTab === 'form-data' && (isTrial || planLimits.aiFormFilling) && (
          <FormDataTab caseData={caseData} onRefresh={refresh} />
        )}

        {activeTab === 'means-test' && (isTrial || planLimits.meansTest) && (
          <MeansTestTab caseData={caseData} onRefresh={refresh} />
        )}

        {activeTab === 'exemptions' && (isTrial || planLimits.exemptionOptimizer) && (
          <ExemptionsTab caseData={caseData} onRefresh={refresh} />
        )}

        {activeTab === 'signatures' && (isTrial || planLimits.courtPackets) && (
          <SignaturesTab caseData={caseData} onRefresh={refresh} />
        )}
      </main>

      <EditCasePanel
        caseData={caseData}
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        onUpdated={setCaseData}
        actorName={user?.fullName || 'Staff'}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={open => { if (!open) { setShowDeleteDialog(false); setDeleteConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this case?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>All documents, activity history, and client data will be permanently deleted. This cannot be undone.</p>
              <p className="font-medium text-foreground">Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{caseData.clientName}</span> to confirm deletion.</p>
              <Input
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder="Type client name..."
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCase}
              disabled={deleteConfirmName !== caseData.clientName || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Case'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate text-base">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-4">
              <DocumentViewer fileName={previewFile.name} dataUrl={previewFile.dataUrl} />
              {previewFile.reviewStatus !== 'approved' && previewFile.reviewStatus !== 'overridden' && (
                <div className="flex gap-2 justify-end border-t border-border pt-4">
                  {viewRole === 'paralegal' && (
                    <ApproveButton
                      onApprove={async () => {
                        await supabase.from('files').update({ review_status: 'approved', review_note: null }).eq('id', previewFile.fileId);
                        await supabase.from('activity_log').insert({
                          case_id: caseData.id,
                          event_type: 'file_approved',
                          actor_role: 'paralegal',
                          actor_name: user?.fullName || caseData.assignedParalegal,
                          description: `${user?.fullName || caseData.assignedParalegal} approved ${previewFile.name}`,
                          item_id: previewFile.itemId,
                        });
                        setPreviewFile(null);
                        refresh();
                      }}
                    />
                  )}
                  {viewRole === 'attorney' && (
                    <Button variant="success" size="sm" onClick={async () => {
                      const item = caseData.checklist.find(i => i.id === previewFile.itemId);
                      if (item) await handleApprove(item, previewFile.fileId);
                      setPreviewFile(null);
                    }}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseDetail;
