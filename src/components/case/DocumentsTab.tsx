import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Download, FileText, Image, FileCheck, AlertTriangle, Check, X, Shield, ShieldAlert, ShieldCheck, ExternalLink, Trash2, CheckSquare, ThumbsUp, ThumbsDown, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  updateCase, CATEGORIES,
  type Case, type ChecklistItem, type UploadedFile, type FileReviewStatus,
} from '@/lib/store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DocumentViewer from '@/components/case/DocumentViewer';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';

type ViewRole = 'paralegal' | 'attorney';

interface FileEntry {
  file: UploadedFile;
  item: ChecklistItem;
}

interface DocumentsTabProps {
  caseData: Case;
  viewRole: ViewRole;
  onRefresh: () => void;
}

const CATEGORY_FOLDERS: Record<string, string> = {
  'Income & Employment': '01-Income',
  'Bank & Financial Accounts': '02-Bank-Financial',
  'Debts & Credit': '03-Debts-Credit',
  'Assets & Property': '04-Assets-Property',
  'Personal Identification': '05-Personal-ID',
  'Agreements & Confirmation': '06-Legal-Agreements',
};

const STATUS_FILTERS = ['All', 'Pending Review', 'Approved', 'Correction Requested', 'Needs Review'] as const;

const CATEGORY_SHORT: Record<string, string> = {
  'Income & Employment': 'Income',
  'Bank & Financial Accounts': 'Bank',
  'Debts & Credit': 'Debts',
  'Assets & Property': 'Assets',
  'Personal Identification': 'ID',
  'Agreements & Confirmation': 'Legal',
};

const correctionChips = ['Wrong year', 'Illegible', 'Missing pages', 'Wrong document type'];

const getFileUrl = async (file: UploadedFile): Promise<string> => {
  if (file.dataUrl) return file.dataUrl;
  if (file.storagePath) {
    const { data } = supabase.storage
      .from('case-documents')
      .getPublicUrl(file.storagePath);
    return data.publicUrl || '';
  }
  return '';
};

const DocumentsTab = ({ caseData, viewRole, onRefresh }: DocumentsTabProps) => {
  const { plan } = useSubscription();
  const bulkActionsEnabled = getPlanLimits(plan).bulkActions;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [showExportWarning, setShowExportWarning] = useState<'zip' | 'pdf' | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // AI validation feedback state
  const [feedbackMode, setFeedbackMode] = useState<'idle' | 'confirmed' | 'form' | 'submitted'>('idle');
  const [feedbackDocType, setFeedbackDocType] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkCorrection, setShowBulkCorrection] = useState(false);
  const [bulkCorrectionNote, setBulkCorrectionNote] = useState('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Gather all files across all checklist items
  const allFiles: FileEntry[] = useMemo(() => {
    const entries: FileEntry[] = [];
    caseData.checklist.forEach(item => {
      item.files.forEach(file => {
        entries.push({ file, item });
      });
    });
    return entries;
  }, [caseData]);

  // Filter
  const filteredFiles = useMemo(() => {
    return allFiles.filter(({ file, item }) => {
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter === 'Needs Review') {
        const vs = file.validationStatus;
        return vs === 'warning' || vs === 'failed' || vs === 'client-override';
      }
      if (statusFilter !== 'All') {
        const statusMap: Record<string, FileReviewStatus> = {
          'Pending Review': 'pending',
          'Approved': 'approved',
          'Correction Requested': 'correction-requested',
        };
        if (file.reviewStatus !== statusMap[statusFilter] && !(statusFilter === 'Approved' && file.reviewStatus === 'overridden')) return false;
      }
      if (categoryFilter !== 'All' && CATEGORY_SHORT[item.category] !== categoryFilter) return false;
      return true;
    });
  }, [allFiles, searchQuery, statusFilter, categoryFilter]);

  const unapprovedCount = allFiles.filter(f => f.file.reviewStatus !== 'approved' && f.file.reviewStatus !== 'overridden').length;
  const approvedFiles = allFiles.filter(f => f.file.reviewStatus === 'approved' || f.file.reviewStatus === 'overridden');

  const clientLastName = caseData.clientName.split(' ').pop() || caseData.clientName;

  // Bulk selection helpers
  const bulkMode = selectedIds.size > 0;
  const allVisibleSelected = filteredFiles.length > 0 && filteredFiles.every(fe => selectedIds.has(fe.file.id));

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(fe => fe.file.id)));
    }
  }, [allVisibleSelected, filteredFiles]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Auto-mark case ready-to-file when every required item has an approved/overridden file,
  // an approved text entry, or has been marked N/A. Called after each approval.
  const maybeAutoMarkReady = useCallback(async () => {
    if (caseData.readyToFile) return;
    const isRequiredItemComplete = (item: ChecklistItem) => {
      if (item.notApplicable) return true;
      if (item.textEntry?.savedAt) return item.attorneyNote?.startsWith('Approved by') ?? false;
      if (item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')) return true;
      return false;
    };
    const allRequiredComplete = caseData.checklist
      .filter(item => item.required)
      .every(isRequiredItemComplete);
    if (!allRequiredComplete) return;

    await supabase.from('cases').update({ ready_to_file: true }).eq('id', caseData.id);
    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'case_ready',
      actor_role: 'system',
      actor_name: 'ClearPath',
      description: 'Case automatically marked ready for filing — all required documents approved.',
    });
    toast.success('Case is ready to file — all required documents approved.');
  }, [caseData]);

  // Bulk approve
  const handleBulkApprove = useCallback(async () => {
    const targets = filteredFiles.filter(fe => selectedIds.has(fe.file.id));
    if (targets.length === 0) return;

    updateCase(caseData.id, c => {
      for (const { file, item } of targets) {
        const found = c.checklist.find(i => i.id === item.id);
        if (found) {
          const f = found.files.find(ff => ff.id === file.id);
          if (f) f.reviewStatus = 'approved';
        }
      }
      return c;
    });

    const targetIds = targets.map(t => t.file.id);
    await supabase
      .from('files')
      .update({ review_status: 'approved', review_note: null })
      .in('id', targetIds);

    for (const { file, item } of targets) {
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'file_approved',
        actor_role: viewRole,
        actor_name: viewRole === 'attorney' ? caseData.assignedAttorney : caseData.assignedParalegal,
        description: `${viewRole === 'attorney' ? 'Attorney' : 'Paralegal'} approved ${item.label}`,
        item_id: item.id,
      });
    }

    toast.success(`${targets.length} document${targets.length !== 1 ? 's' : ''} approved`);
    await maybeAutoMarkReady();
    clearSelection();
    onRefresh();
  }, [caseData, filteredFiles, selectedIds, viewRole, clearSelection, onRefresh]);

  // Bulk correction
  const handleBulkCorrection = useCallback(async () => {
    if (!bulkCorrectionNote.trim()) { toast.error('Please add a correction note.'); return; }
    const targets = filteredFiles.filter(fe => selectedIds.has(fe.file.id));
    if (targets.length === 0) return;

    updateCase(caseData.id, c => {
      for (const { file, item } of targets) {
        const found = c.checklist.find(i => i.id === item.id);
        if (found) {
          const f = found.files.find(ff => ff.id === file.id);
          if (f) {
            f.reviewStatus = 'correction-requested';
            f.reviewNote = bulkCorrectionNote;
          }
          found.completed = false;
        }
      }
      return c;
    });

    for (const { file, item } of targets) {
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'file_correction',
        actor_role: viewRole,
        actor_name: viewRole === 'attorney' ? caseData.assignedAttorney : caseData.assignedParalegal,
        description: `Correction requested on ${item.label} — '${bulkCorrectionNote}'`,
        item_id: item.id,
      });
    }

    toast.success(`Correction requested on ${targets.length} document${targets.length !== 1 ? 's' : ''}`);
    setBulkCorrectionNote('');
    setShowBulkCorrection(false);
    clearSelection();
    onRefresh();
  }, [caseData, filteredFiles, selectedIds, bulkCorrectionNote, viewRole, clearSelection, onRefresh]);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    const targets = filteredFiles.filter(fe => selectedIds.has(fe.file.id));
    if (targets.length === 0) return;

    const actorName = caseData.assignedParalegal || 'Staff';
    const targetIds = targets.map(t => t.file.id);
    const storagePaths = targets.map(t => t.file.storagePath).filter(Boolean) as string[];

    // Optimistic local state update
    updateCase(caseData.id, c => {
      for (const { file, item } of targets) {
        const found = c.checklist.find(i => i.id === item.id);
        if (found) {
          found.files = found.files.filter(f => f.id !== file.id);
          if (found.files.length === 0) found.completed = false;
        }
      }
      return c;
    });

    try {
      // Remove storage objects
      if (storagePaths.length > 0) {
        const { error: storageErr } = await supabase.storage.from('case-documents').remove(storagePaths);
        if (storageErr) console.warn('Storage removal failed:', storageErr);
      }

      // Delete file rows
      await supabase.from('files').delete().in('id', targetIds);

      // Re-mark checklist items as incomplete if they have no remaining files
      const affectedItemIds = Array.from(new Set(targets.map(t => t.item.id)));
      for (const itemId of affectedItemIds) {
        const item = caseData.checklist.find(i => i.id === itemId);
        if (!item) continue;
        const remaining = item.files.filter(f => !targetIds.includes(f.id));
        if (remaining.length === 0) {
          await supabase.from('checklist_items').update({ completed: false }).eq('id', itemId);
        }
      }

      // Activity log entries
      for (const { file, item } of targets) {
        await supabase.from('activity_log').insert({
          case_id: caseData.id,
          event_type: 'file_deleted',
          actor_role: 'paralegal',
          actor_name: actorName,
          description: `${actorName} deleted ${file.name}`,
          item_id: item.id,
        });
      }

      toast.success(`${targets.length} document${targets.length !== 1 ? 's' : ''} deleted`);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Some files could not be deleted.');
    }

    setShowBulkDeleteConfirm(false);
    clearSelection();
    onRefresh();
  }, [caseData, filteredFiles, selectedIds, clearSelection, onRefresh]);
  const handleExportCheck = (type: 'zip' | 'pdf') => {
    if (unapprovedCount > 0) {
      setShowExportWarning(type);
    } else {
      type === 'zip' ? doZipExport() : doPdfExport();
    }
  };

  const buildZipFromEntries = async (entries: FileEntry[], zipFileName: string) => {
    const JSZip = (await import('jszip')).default;
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();

    // Group by item label to detect collisions across all selected files
    const labelCounts = new Map<string, number>();
    entries.forEach(({ item }) => {
      labelCounts.set(item.label, (labelCounts.get(item.label) || 0) + 1);
    });
    const labelIndices = new Map<string, number>();

    for (const { file, item } of entries) {
      const folder = CATEGORY_FOLDERS[item.category] || 'Other';
      const date = format(new Date(file.uploadedAt), 'yyyy-MM-dd');
      const docType = item.label.replace(/[^a-zA-Z0-9]/g, '-');
      const rawExt = file.name.split('.').pop() || 'pdf';
      const ext = rawExt.toLowerCase();
      const hasMultiple = (labelCounts.get(item.label) || 0) > 1;
      let cleanName: string;
      if (hasMultiple) {
        const idx = (labelIndices.get(item.label) || 0) + 1;
        labelIndices.set(item.label, idx);
        cleanName = `${clientLastName}-${docType}-${date}-${idx}.${ext}`;
      } else {
        cleanName = `${clientLastName}-${docType}-${date}.${ext}`;
      }

      const url = await getFileUrl(file);
      if (url) {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          zip.folder(folder)?.file(cleanName, blob);
        } catch {
          zip.folder(folder)?.file(cleanName, `Placeholder for ${file.name}`);
        }
      } else {
        zip.folder(folder)?.file(cleanName, `Placeholder for ${file.name}`);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, zipFileName);
  };

  const doZipExport = async () => {
    await buildZipFromEntries(
      approvedFiles,
      `${clientLastName}-Documents-${format(new Date(), 'yyyy-MM-dd')}.zip`
    );
    toast.success('ZIP downloaded successfully.');
    setShowExportWarning(null);
  };

  const handleDownloadSelected = useCallback(async () => {
    const targets = filteredFiles.filter(fe => selectedIds.has(fe.file.id));
    if (targets.length === 0) {
      toast.error('No files selected.');
      return;
    }
    toast.info(`Downloading ${targets.length} file${targets.length !== 1 ? 's' : ''}...`);
    try {
      await buildZipFromEntries(
        targets,
        `${clientLastName}-Selected-${format(new Date(), 'yyyy-MM-dd')}.zip`
      );
      toast.success(`${targets.length} file${targets.length !== 1 ? 's' : ''} downloaded.`);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed.');
    }
  }, [filteredFiles, selectedIds, clientLastName]);

  const handleApproveAllPending = useCallback(async () => {
    const pendingFiles = allFiles.filter(
      f => f.file.reviewStatus !== 'approved' && f.file.reviewStatus !== 'overridden'
    );
    if (pendingFiles.length === 0) return;

    updateCase(caseData.id, c => {
      for (const { file, item } of pendingFiles) {
        const found = c.checklist.find(i => i.id === item.id);
        if (found) {
          const f = found.files.find(ff => ff.id === file.id);
          if (f) f.reviewStatus = 'approved';
        }
      }
      return c;
    });

    await supabase
      .from('files')
      .update({ review_status: 'approved', review_note: null })
      .in('id', pendingFiles.map(f => f.file.id));

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'file_approved',
      actor_role: viewRole,
      actor_name: viewRole === 'attorney' ? caseData.assignedAttorney : caseData.assignedParalegal,
      description: `${viewRole === 'attorney' ? 'Attorney' : 'Paralegal'} approved all pending documents (${pendingFiles.length})`,
    });

    toast.success(`${pendingFiles.length} document${pendingFiles.length !== 1 ? 's' : ''} approved`);
    await maybeAutoMarkReady();
    onRefresh();
  }, [allFiles, caseData, viewRole, onRefresh]);

  const doPdfExport = async () => {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const coverPage = pdfDoc.addPage([612, 792]);
    const { height: coverH } = coverPage.getSize();
    coverPage.drawText('Court Filing Packet', { x: 50, y: coverH - 100, size: 28, font: helveticaBold, color: rgb(0, 0.76, 0.66) });
    coverPage.drawText(caseData.clientName, { x: 50, y: coverH - 150, size: 20, font: helveticaBold, color: rgb(0.94, 0.96, 0.97) });
    coverPage.drawText(`Case ID: ${caseData.id}`, { x: 50, y: coverH - 185, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
    coverPage.drawText(`Chapter ${caseData.chapterType}`, { x: 50, y: coverH - 210, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
    coverPage.drawText(`Filing Deadline: ${format(new Date(caseData.filingDeadline), 'MMMM d, yyyy')}`, { x: 50, y: coverH - 235, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
    coverPage.drawText(`Compiled: ${format(new Date(), 'MMMM d, yyyy')}`, { x: 50, y: coverH - 260, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });

    for (const cat of CATEGORIES as readonly string[]) {
      const catFiles = approvedFiles.filter(f => f.item.category === cat);
      if (catFiles.length === 0) continue;

      const catPage = pdfDoc.addPage([612, 792]);
      const { height: catH } = catPage.getSize();
      catPage.drawText(cat, { x: 50, y: catH - 80, size: 22, font: helveticaBold, color: rgb(0, 0.76, 0.66) });
      catPage.drawText(`${catFiles.length} document${catFiles.length > 1 ? 's' : ''}`, { x: 50, y: catH - 110, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });

      let yPos = catH - 150;
      for (const { file, item } of catFiles) {
        if (yPos < 80) {
          const newPage = pdfDoc.addPage([612, 792]);
          yPos = newPage.getSize().height - 80;
        }
        catPage.drawText(`• ${item.label}`, { x: 70, y: yPos, size: 11, font: helvetica, color: rgb(0.94, 0.96, 0.97) });
        catPage.drawText(`  ${file.name} — ${format(new Date(file.uploadedAt), 'MMM d, yyyy')}`, { x: 85, y: yPos - 16, size: 9, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
        yPos -= 40;

        const fileUrl = await getFileUrl(file);
        if (fileUrl) {
          try {
            if (fileUrl.startsWith('data:')) {
              if (fileUrl.includes('image/png')) {
                const imgBytes = Uint8Array.from(atob(fileUrl.split(',')[1]), c => c.charCodeAt(0));
                const img = await pdfDoc.embedPng(imgBytes);
                const imgPage = pdfDoc.addPage([612, 792]);
                const scale = Math.min(512 / img.width, 692 / img.height);
                imgPage.drawImage(img, { x: 50, y: 50, width: img.width * scale, height: img.height * scale });
              } else if (fileUrl.includes('image/jpeg') || fileUrl.includes('image/jpg')) {
                const imgBytes = Uint8Array.from(atob(fileUrl.split(',')[1]), c => c.charCodeAt(0));
                const img = await pdfDoc.embedJpg(imgBytes);
                const imgPage = pdfDoc.addPage([612, 792]);
                const scale = Math.min(512 / img.width, 692 / img.height);
                imgPage.drawImage(img, { x: 50, y: 50, width: img.width * scale, height: img.height * scale });
              } else if (fileUrl.includes('application/pdf')) {
                const pdfBytes = Uint8Array.from(atob(fileUrl.split(',')[1]), c => c.charCodeAt(0));
                const srcDoc = await PDFDocument.load(pdfBytes);
                const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
                pages.forEach(p => pdfDoc.addPage(p));
              }
            } else {
              // Signed URL — fetch as blob
              const resp = await fetch(fileUrl);
              const blob = await resp.blob();
              const arrayBuf = await blob.arrayBuffer();
              const bytes = new Uint8Array(arrayBuf);
              if (blob.type.includes('png')) {
                const img = await pdfDoc.embedPng(bytes);
                const imgPage = pdfDoc.addPage([612, 792]);
                const scale = Math.min(512 / img.width, 692 / img.height);
                imgPage.drawImage(img, { x: 50, y: 50, width: img.width * scale, height: img.height * scale });
              } else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) {
                const img = await pdfDoc.embedJpg(bytes);
                const imgPage = pdfDoc.addPage([612, 792]);
                const scale = Math.min(512 / img.width, 692 / img.height);
                imgPage.drawImage(img, { x: 50, y: 50, width: img.width * scale, height: img.height * scale });
              } else if (blob.type.includes('pdf')) {
                const srcDoc = await PDFDocument.load(bytes);
                const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
                pages.forEach(p => pdfDoc.addPage(p));
              }
            }
          } catch {
            // If embedding fails, the index entry is still listed
          }
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }), `${clientLastName}-${caseData.id}-CourtPacket.pdf`);
    toast.success('PDF compiled successfully.');
    setShowExportWarning(null);
  };

  const handleApprove = async (entry: FileEntry) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === entry.item.id);
      if (found && found.files.length > 0) {
        const f = found.files.find(f => f.id === entry.file.id);
        if (f) f.reviewStatus = 'approved';
      }
      return c;
    });
    // Persist to Supabase
    await supabase.from('files').update({ review_status: 'approved', review_note: null }).eq('id', entry.file.id);
    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'file_approved',
      actor_role: 'attorney',
      actor_name: caseData.assignedAttorney,
      description: `Attorney approved ${entry.item.label}`,
      item_id: entry.item.id,
    });
    toast.success(`${entry.item.label} approved`);
    await maybeAutoMarkReady();
    setSelectedFile(null);
    onRefresh();
  };

  const handleCorrection = async (entry: FileEntry) => {
    if (!correctionNote.trim()) { toast.error('Please add a correction note.'); return; }
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === entry.item.id);
      if (found && found.files.length > 0) {
        const f = found.files.find(f => f.id === entry.file.id);
        if (f) {
          f.reviewStatus = 'correction-requested';
          f.reviewNote = correctionNote;
        }
        found.completed = false;
      }
      return c;
    });
    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'file_correction',
      actor_role: 'attorney',
      actor_name: caseData.assignedAttorney,
      description: `Correction requested on ${entry.item.label} — '${correctionNote}'`,
      item_id: entry.item.id,
    });
    setCorrectionNote('');
    setSelectedFile(null);
    toast.success('Correction requested');
    onRefresh();
  };

  const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  const getStatusBadgeClass = (status: FileReviewStatus) => {
    switch (status) {
      case 'approved':
      case 'overridden':
        return 'bg-success/10 text-success border-success/20';
      case 'correction-requested':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  // Completion summary
  const categorySummary = useMemo(() => {
    return (CATEGORIES as readonly string[]).map(cat => {
      const items = caseData.checklist.filter(i => i.category === cat);
      const withFiles = items.filter(i => i.files.length > 0);
      const approved = withFiles.filter(i => i.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden'));
      const pending = withFiles.filter(i => i.files.some(f => f.reviewStatus === 'pending'));
      const corrections = withFiles.filter(i => i.files.some(f => f.reviewStatus === 'correction-requested'));
      const requiredItems = items.filter(i => i.required);
      const requiredApproved = requiredItems.filter(i => i.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden'));

      let status: 'complete' | 'in-progress' | 'not-started' | 'attention';
      if (approved.length === 0 && pending.length === 0 && corrections.length === 0) status = 'not-started';
      else if (corrections.length > 0) status = 'attention';
      else if (pending.length > 0) status = 'in-progress';
      else if (approved.length > 0) status = 'complete';
      else status = 'not-started';

      return { category: cat, approved: approved.length, pending: pending.length, corrections: corrections.length, total: items.length, status };
    });
  }, [caseData]);

  const totalApproved = categorySummary.reduce((s, c) => s + c.approved, 0);
  const totalPending = categorySummary.reduce((s, c) => s + c.pending, 0);
  const totalCorrections = categorySummary.reduce((s, c) => s + c.corrections, 0);
  const overallStatus = totalApproved === 0 && totalPending === 0 && totalCorrections === 0 ? 'not-started' : totalCorrections > 0 ? 'attention' : totalPending > 0 ? 'in-progress' : categorySummary.every(c => c.approved > 0 && c.pending === 0 && c.corrections === 0) ? 'complete' : 'in-progress';

  return (
    <div className="space-y-6">
      {/* Toolbar — switches between search bar and bulk action bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {bulkActionsEnabled && bulkMode ? (
            /* Bulk action toolbar */
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/5 border border-primary/20"
            >
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAll}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="success"
                onClick={handleBulkApprove}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve All Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadSelected}
              >
                <Download className="w-4 h-4 mr-2" /> Download Selected
              </Button>
              <Button
                size="sm"
                variant="warning"
                onClick={() => setShowBulkCorrection(true)}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Request Correction
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ) : (
            /* Normal search bar */
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="pl-10 bg-input border-border rounded-[10px]"
              />
            </div>
          )}
          {!bulkMode && (
            <div className="flex items-center gap-2">
              {unapprovedCount > 0 && (
                <Button variant="ghost" onClick={handleApproveAllPending}>
                  <ShieldCheck className="w-4 h-4 mr-1" /> Approve All Pending
                  <span className="ml-1.5 text-xs text-muted-foreground">({unapprovedCount} pending)</span>
                </Button>
              )}
              {getPlanLimits(plan).batchExport ? (
                <Button onClick={() => handleExportCheck('zip')}>
                  <Download className="w-4 h-4 mr-1" /> Download ZIP
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-1.5" />Download ZIP
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Available on Professional and Firm plans</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(statusFilter === f ? 'All' : f)}
              className={cn(
                'px-3 py-1 text-xs font-bold rounded-full transition-all border',
                statusFilter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              {f}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {['All', ...Object.values(CATEGORY_SHORT)].filter((v, i, a) => a.indexOf(v) === i).map(f => (
            f === 'All' && statusFilter !== 'All' ? null :
            <button
              key={f}
              onClick={() => setCategoryFilter(categoryFilter === f ? 'All' : f)}
              className={cn(
                'px-3 py-1 text-xs font-bold rounded-full transition-all border',
                categoryFilter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* File Grid */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-body">
            {allFiles.length === 0
              ? 'No documents yet. Once the client starts uploading you\'ll see everything here.'
              : 'No files match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map(({ file, item }) => {
            const isSelected = selectedIds.has(file.id);
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'surface-card-hover p-4 cursor-pointer relative',
                  isSelected && 'ring-2 ring-primary/50 bg-primary/5'
                )}
                onClick={() => { setSelectedFile({ file, item }); setCorrectionNote(''); setFeedbackMode('idle'); setFeedbackDocType(''); setFeedbackNotes(''); }}
              >
                {/* Checkbox — only for plans with bulk actions */}
                {bulkActionsEnabled ? (
                <div
                  className="absolute top-3 left-3 z-10"
                  onClick={e => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(file.id)}
                    className="border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>
                ) : null}

                <div className={`flex items-start gap-3 mb-3 ${bulkActionsEnabled ? 'pl-7' : ''}`}>
                  {isImageFile(file.name) ? (
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <Image className="w-5 h-5 text-primary" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      {file.uploadedBy === 'plaid' && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0">Plaid</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(file.uploadedAt), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-7">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-bold uppercase tracking-wider">
                    {CATEGORY_SHORT[item.category] || item.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {file.validationStatus === 'passed' && <ShieldCheck className="w-3.5 h-3.5 text-success" />}
                    {file.validationStatus === 'warning' && <ShieldAlert className="w-3.5 h-3.5 text-warning" />}
                    {(file.validationStatus === 'failed' || file.validationStatus === 'client-override') && <ShieldAlert className="w-3.5 h-3.5 text-destructive" />}
                    <Badge className={`${getStatusBadgeClass(file.reviewStatus)} text-[10px]`}>
                      {file.reviewStatus.replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Completion Summary — only show when files exist */}
      {allFiles.length > 0 && <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-bold text-foreground">Completion Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-body font-normal">Category</th>
                <th className="text-center p-3 text-muted-foreground font-body font-normal">Approved</th>
                <th className="text-center p-3 text-muted-foreground font-body font-normal">Pending</th>
                <th className="text-right p-3 text-muted-foreground font-body font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {categorySummary.map(row => (
                <tr key={row.category} className="border-b border-border/50">
                  <td className="p-3 text-foreground font-body">{row.category}</td>
                  <td className="p-3 text-center text-success font-bold">{row.approved}</td>
                  <td className="p-3 text-center text-warning font-bold">{row.pending + row.corrections}</td>
                  <td className="p-3 text-right">
                    <StatusIndicator status={row.status} />
                  </td>
                </tr>
              ))}
              <tr className="bg-secondary/30">
                <td className="p-3 text-foreground font-display font-bold">Total</td>
                <td className="p-3 text-center text-success font-bold">{totalApproved}</td>
                <td className="p-3 text-center text-warning font-bold">{totalPending + totalCorrections}</td>
                <td className="p-3 text-right">
                  <StatusIndicator status={overallStatus} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>}

      {/* Slide-in Preview Panel */}
      <AnimatePresence>
        {selectedFile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedFile(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-background border-l border-border z-50 overflow-y-auto"
            >
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg text-foreground">Document Preview</h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Open in new tab"
                      onClick={() => {
                        if (selectedFile.file.dataUrl) {
                          const w = window.open('');
                          if (w) {
                            w.document.title = selectedFile.file.name;
                            if (isImageFile(selectedFile.file.name)) {
                              w.document.body.innerHTML = `<img src="${selectedFile.file.dataUrl}" style="max-width:100%;margin:auto;display:block" />`;
                            } else {
                              const embed = w.document.createElement('embed');
                              embed.src = selectedFile.file.dataUrl;
                              embed.type = 'application/pdf';
                              embed.style.cssText = 'width:100%;height:100vh';
                              w.document.body.style.margin = '0';
                              w.document.body.appendChild(embed);
                            }
                          }
                        }
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Download"
                      onClick={() => {
                        if (selectedFile.file.dataUrl) {
                          const a = document.createElement('a');
                          a.href = selectedFile.file.dataUrl;
                          a.download = selectedFile.file.name;
                          a.click();
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Document viewer */}
                {selectedFile.file.dataUrl ? (
                  <DocumentViewer fileName={selectedFile.file.name} dataUrl={selectedFile.file.dataUrl} />
                ) : (
                  <div className="surface-card p-6 flex flex-col items-center gap-3">
                    <FileText className="w-16 h-16 text-muted-foreground/30" />
                    {selectedFile.file.uploadedBy === 'plaid' ? (
                      <>
                        <p className="text-sm text-muted-foreground font-medium">Plaid Placeholder Record</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs">
                          This file was logged during a Plaid sandbox connection. In production, actual bank statement PDFs will be retrieved and viewable here.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No preview available</p>
                    )}
                  </div>
                )}

                {/* File info */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Document</span>
                    <span className="text-foreground">{selectedFile.item.label}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-foreground">{selectedFile.item.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uploaded</span>
                    <span className="text-foreground">{format(new Date(selectedFile.file.uploadedAt), 'MMM d, yyyy · h:mm a')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uploaded by</span>
                    <span className="text-foreground capitalize flex items-center gap-1.5">
                      {selectedFile.file.uploadedBy}
                      {selectedFile.file.uploadedBy === 'plaid' && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0">Plaid</Badge>
                      )}
                    </span>
                  </div>
                  {selectedFile.file.uploadedBy === 'plaid' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Source</span>
                      <span className="text-foreground text-xs">Plaid — automatically retrieved</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={`${getStatusBadgeClass(selectedFile.file.reviewStatus)} text-xs`}>
                      {selectedFile.file.reviewStatus.replace('-', ' ')}
                    </Badge>
                  </div>
                  {selectedFile.file.reviewNote && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="text-xs text-destructive font-medium">Correction Note</p>
                      <p className="text-sm text-destructive/80 mt-1">{selectedFile.file.reviewNote}</p>
                    </div>
                  )}
                  {/* Validation result */}
                  {selectedFile.file.validationResult && (
                    <div className="p-3 rounded-lg bg-secondary space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          {selectedFile.file.validationResult.validationStatus === 'passed' && <ShieldCheck className="w-3.5 h-3.5 text-success" />}
                          {selectedFile.file.validationResult.validationStatus === 'warning' && <ShieldAlert className="w-3.5 h-3.5 text-warning" />}
                          {selectedFile.file.validationResult.validationStatus === 'failed' && <ShieldAlert className="w-3.5 h-3.5 text-destructive" />}
                          AI Validation
                        </p>
                        {selectedFile.file.manuallyReviewed ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Manually Reviewed</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{Math.round(selectedFile.file.validationResult.confidenceScore * 100)}% confidence</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{selectedFile.file.validationResult.validatorNotes}</p>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        {selectedFile.file.validationResult.extractedYear && <div><span className="text-muted-foreground">Year:</span> <span className="text-foreground">{selectedFile.file.validationResult.extractedYear}</span></div>}
                        {selectedFile.file.validationResult.extractedInstitution && <div><span className="text-muted-foreground">Institution:</span> <span className="text-foreground">{selectedFile.file.validationResult.extractedInstitution}</span></div>}
                        {selectedFile.file.validationResult.extractedName && <div><span className="text-muted-foreground">Name:</span> <span className="text-foreground">{selectedFile.file.validationResult.extractedName}</span></div>}
                      </div>

                      {/* Paralegal feedback on AI validation */}
                      {!selectedFile.file.manuallyReviewed && feedbackMode === 'idle' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                          <span className="text-[11px] text-muted-foreground">Was this AI result correct?</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] border-primary/30 text-primary hover:bg-primary/10"
                            onClick={async () => {
                              setFeedbackMode('confirmed');
                              setFeedbackSubmitting(true);
                              try {
                                await supabase.from('document_validation_feedback').insert({
                                  file_id: selectedFile.file.id,
                                  case_id: caseData.id,
                                  expected_document_type: selectedFile.item.label,
                                  ai_result: selectedFile.file.validationResult!.validationStatus,
                                  paralegal_feedback: 'confirmed_correct',
                                  paralegal_id: caseData.assignedParalegal || 'unknown',
                                });
                                updateCase(caseData.id, c => {
                                  const item = c.checklist.find(i => i.id === selectedFile.item.id);
                                  const f = item?.files.find(ff => ff.id === selectedFile.file.id);
                                  if (f) f.manuallyReviewed = true;
                                  return c;
                                });
                                onRefresh();
                              } catch { /* silent */ }
                              setFeedbackSubmitting(false);
                            }}
                            disabled={feedbackSubmitting}
                          >
                            <ThumbsUp className="w-3 h-3 mr-1" /> Yes — correct
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] border-border text-muted-foreground hover:bg-secondary"
                            onClick={() => setFeedbackMode('form')}
                          >
                            <ThumbsDown className="w-3 h-3 mr-1" /> No — wrong detection
                          </Button>
                        </div>
                      )}

                      {feedbackMode === 'confirmed' && (
                        <p className="text-[11px] text-success pt-1">Thanks — your feedback helps improve accuracy.</p>
                      )}

                      {feedbackMode === 'form' && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <label className="text-[11px] text-muted-foreground font-medium">What is this document actually?</label>
                          <Select value={feedbackDocType} onValueChange={setFeedbackDocType}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select document type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {['Pay Stub', 'W-2', 'Bank Statement', 'Tax Return', 'Credit Card Statement', 'Government ID', 'Mortgage Statement', 'Other'].map(dt => (
                                <SelectItem key={dt} value={dt} className="text-xs">{dt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div>
                            <label className="text-[11px] text-muted-foreground font-medium">Any additional notes — optional</label>
                            <Input
                              value={feedbackNotes}
                              onChange={e => setFeedbackNotes(e.target.value)}
                              placeholder="e.g. This is actually a 1099..."
                              className="h-8 text-xs mt-1 bg-input border-border rounded-[10px]"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs w-full"
                            disabled={!feedbackDocType || feedbackSubmitting}
                            onClick={async () => {
                              setFeedbackSubmitting(true);
                              try {
                                await supabase.from('document_validation_feedback').insert({
                                  file_id: selectedFile.file.id,
                                  case_id: caseData.id,
                                  expected_document_type: selectedFile.item.label,
                                  ai_result: selectedFile.file.validationResult!.validationStatus,
                                  paralegal_feedback: 'wrong_detection',
                                  correct_document_type: feedbackDocType,
                                  additional_notes: feedbackNotes || null,
                                  paralegal_id: caseData.assignedParalegal || 'unknown',
                                });
                                updateCase(caseData.id, c => {
                                  const item = c.checklist.find(i => i.id === selectedFile.item.id);
                                  const f = item?.files.find(ff => ff.id === selectedFile.file.id);
                                  if (f) f.manuallyReviewed = true;
                                  return c;
                                });
                                await supabase.from('activity_log').insert({
                                  case_id: caseData.id,
                                  event_type: 'document_validated',
                                  actor_role: 'paralegal',
                                  actor_name: caseData.assignedParalegal || 'Paralegal',
                                  description: `Corrected AI detection on ${selectedFile.item.label} — actual type: ${feedbackDocType}`,
                                  item_id: selectedFile.item.id,
                                });
                                setFeedbackMode('submitted');
                                onRefresh();
                              } catch { /* silent */ }
                              setFeedbackSubmitting(false);
                            }}
                          >
                            Submit Feedback
                          </Button>
                        </div>
                      )}

                      {feedbackMode === 'submitted' && (
                        <p className="text-[11px] text-success pt-1">Thanks — your feedback helps improve accuracy.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {viewRole === 'attorney' && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex gap-2">
                      <Button variant="success" className="flex-1" onClick={() => handleApprove(selectedFile)}>
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    </div>
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
                        <Button variant="destructive" size="sm" onClick={() => handleCorrection(selectedFile)} disabled={!correctionNote.trim()}>
                          Request Correction
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bulk Correction Dialog */}
      <AlertDialog open={showBulkCorrection} onOpenChange={setShowBulkCorrection}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" /> Request Correction on {selectedIds.size} Document{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This correction reason will be applied to all selected documents. The client will be notified for each.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-1.5 flex-wrap">
              {correctionChips.map(chip => (
                <button
                  key={chip}
                  onClick={() => setBulkCorrectionNote(chip)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full transition-colors border',
                    bulkCorrectionNote === chip
                      ? 'bg-warning/10 text-warning border-warning/30 font-bold'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Input
              value={bulkCorrectionNote}
              onChange={e => setBulkCorrectionNote(e.target.value)}
              placeholder="Correction reason..."
              className="bg-input border-border rounded-[10px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkCorrectionNote('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={handleBulkCorrection}
              disabled={!bulkCorrectionNote.trim()}
            >
              Request Correction on {selectedIds.size} Document{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Delete this document?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The client will need to re-upload if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!selectedFile) return;
                const fileName = selectedFile.file.name;
                const actorName = caseData.assignedParalegal || 'Staff';

                updateCase(caseData.id, c => {
                  const found = c.checklist.find(i => i.id === selectedFile.item.id);
                  if (found) {
                    found.files = found.files.filter(f => f.id !== selectedFile.file.id);
                    if (found.files.length === 0) found.completed = false;
                  }
                  return c;
                });

                // Sync deletion to Supabase
                (async () => {
                  try {
                    await supabase.from('files').delete().eq('id', selectedFile.file.id);
                    // If no files remain for this checklist item, mark it incomplete
                    const remainingFiles = caseData.checklist.find(i => i.id === selectedFile.item.id)?.files.filter(f => f.id !== selectedFile.file.id) || [];
                    if (remainingFiles.length === 0) {
                      await supabase.from('checklist_items').update({ completed: false }).eq('id', selectedFile.item.id);
                    }
                  } catch (err) {
                    console.error('Failed to sync file deletion to database:', err);
                  }
                })();

                (async () => {
                  await supabase.from('activity_log').insert({
                    case_id: caseData.id,
                    event_type: 'file_deleted',
                    actor_role: 'paralegal',
                    actor_name: actorName,
                    description: `${actorName} deleted ${fileName}`,
                    item_id: selectedFile.item.id,
                  });
                })();

                toast.success(`${fileName} deleted`);
                setSelectedFile(null);
                setShowDeleteConfirm(false);
                onRefresh();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export warning dialog */}
      <AlertDialog open={showExportWarning !== null} onOpenChange={() => setShowExportWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" /> Unapproved Files
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unapprovedCount} file{unapprovedCount !== 1 ? 's are' : ' is'} not yet approved and will not be included in the {showExportWarning === 'zip' ? 'ZIP download' : 'compiled PDF'}. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => showExportWarning === 'zip' ? doZipExport() : doPdfExport()}>
              Continue with {approvedFiles.length} approved file{approvedFiles.length !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatusIndicator = ({ status }: { status: 'complete' | 'in-progress' | 'attention' | 'not-started' }) => {
  const config = {
    complete: { label: 'Complete', className: 'text-success' },
    'in-progress': { label: 'In Progress', className: 'text-warning' },
    attention: { label: 'Attention Needed', className: 'text-destructive' },
    'not-started': { label: 'Not Started', className: 'text-muted-foreground' },
  }[status];

  return (
    <span className={cn('text-xs font-bold', config.className)}>
      {status === 'complete' && <FileCheck className="w-3 h-3 inline mr-1" />}
      {status === 'attention' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
      {config.label}
    </span>
  );
};

export default DocumentsTab;
