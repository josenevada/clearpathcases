import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Download, FileText, Image, FileCheck, AlertTriangle, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  updateCase, addActivityEntry, CATEGORIES,
  type Case, type ChecklistItem, type UploadedFile, type FileReviewStatus,
} from '@/lib/store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const STATUS_FILTERS = ['All', 'Pending Review', 'Approved', 'Correction Requested'] as const;

const CATEGORY_SHORT: Record<string, string> = {
  'Income & Employment': 'Income',
  'Bank & Financial Accounts': 'Bank',
  'Debts & Credit': 'Debts',
  'Assets & Property': 'Assets',
  'Personal Identification': 'ID',
  'Agreements & Confirmation': 'Legal',
};

const DocumentsTab = ({ caseData, viewRole, onRefresh }: DocumentsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [showExportWarning, setShowExportWarning] = useState<'zip' | 'pdf' | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');

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

  const handleExportCheck = (type: 'zip' | 'pdf') => {
    if (unapprovedCount > 0) {
      setShowExportWarning(type);
    } else {
      type === 'zip' ? doZipExport() : doPdfExport();
    }
  };

  const doZipExport = async () => {
    const JSZip = (await import('jszip')).default;
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();

    for (const { file, item } of approvedFiles) {
      const folder = CATEGORY_FOLDERS[item.category] || 'Other';
      const date = format(new Date(file.uploadedAt), 'yyyy-MM-dd');
      const docType = item.label.replace(/[^a-zA-Z0-9]/g, '-');
      const ext = file.name.split('.').pop() || 'pdf';
      const cleanName = `${clientLastName}-${docType}-${date}.${ext}`;

      if (file.dataUrl) {
        const response = await fetch(file.dataUrl);
        const blob = await response.blob();
        zip.folder(folder)?.file(cleanName, blob);
      } else {
        // Demo data without actual file content
        zip.folder(folder)?.file(cleanName, `Placeholder for ${file.name}`);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${clientLastName}-${caseData.id}-FilingPacket.zip`);
    toast.success('ZIP downloaded successfully.');
    setShowExportWarning(null);
  };

  const doPdfExport = async () => {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Cover page
    const coverPage = pdfDoc.addPage([612, 792]);
    const { height: coverH } = coverPage.getSize();
    coverPage.drawText('Court Filing Packet', { x: 50, y: coverH - 100, size: 28, font: helveticaBold, color: rgb(0, 0.76, 0.66) });
    coverPage.drawText(caseData.clientName, { x: 50, y: coverH - 150, size: 20, font: helveticaBold, color: rgb(0.94, 0.96, 0.97) });
    coverPage.drawText(`Case ID: ${caseData.id}`, { x: 50, y: coverH - 185, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
    coverPage.drawText(`Chapter ${caseData.chapterType}`, { x: 50, y: coverH - 210, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
    coverPage.drawText(`Filing Deadline: ${format(new Date(caseData.filingDeadline), 'MMMM d, yyyy')}`, { x: 50, y: coverH - 235, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });
    coverPage.drawText(`Compiled: ${format(new Date(), 'MMMM d, yyyy')}`, { x: 50, y: coverH - 260, size: 12, font: helvetica, color: rgb(0.54, 0.64, 0.72) });

    // Group approved files by category
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

        // Embed actual files if available
        if (file.dataUrl && file.dataUrl.startsWith('data:')) {
          try {
            if (file.dataUrl.includes('image/png')) {
              const imgBytes = Uint8Array.from(atob(file.dataUrl.split(',')[1]), c => c.charCodeAt(0));
              const img = await pdfDoc.embedPng(imgBytes);
              const imgPage = pdfDoc.addPage([612, 792]);
              const scale = Math.min(512 / img.width, 692 / img.height);
              imgPage.drawImage(img, { x: 50, y: 50, width: img.width * scale, height: img.height * scale });
            } else if (file.dataUrl.includes('image/jpeg') || file.dataUrl.includes('image/jpg')) {
              const imgBytes = Uint8Array.from(atob(file.dataUrl.split(',')[1]), c => c.charCodeAt(0));
              const img = await pdfDoc.embedJpg(imgBytes);
              const imgPage = pdfDoc.addPage([612, 792]);
              const scale = Math.min(512 / img.width, 692 / img.height);
              imgPage.drawImage(img, { x: 50, y: 50, width: img.width * scale, height: img.height * scale });
            } else if (file.dataUrl.includes('application/pdf')) {
              const pdfBytes = Uint8Array.from(atob(file.dataUrl.split(',')[1]), c => c.charCodeAt(0));
              const srcDoc = await PDFDocument.load(pdfBytes);
              const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
              pages.forEach(p => pdfDoc.addPage(p));
            }
          } catch {
            // If embedding fails, the index entry is still listed
          }
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `${clientLastName}-${caseData.id}-CourtPacket.pdf`);
    toast.success('PDF compiled successfully.');
    setShowExportWarning(null);
  };

  const handleApprove = (entry: FileEntry) => {
    updateCase(caseData.id, c => {
      const found = c.checklist.find(i => i.id === entry.item.id);
      if (found && found.files.length > 0) {
        const f = found.files.find(f => f.id === entry.file.id);
        if (f) f.reviewStatus = 'approved';
      }
      return c;
    });
    addActivityEntry(caseData.id, {
      eventType: 'file_approved', actorRole: 'attorney', actorName: caseData.assignedAttorney,
      description: `Attorney approved ${entry.item.label}`, itemId: entry.item.id,
    });
    toast.success(`${entry.item.label} approved`);
    setSelectedFile(null);
    onRefresh();
  };

  const handleCorrection = (entry: FileEntry) => {
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
    addActivityEntry(caseData.id, {
      eventType: 'file_correction', actorRole: 'attorney', actorName: caseData.assignedAttorney,
      description: `Correction requested on ${entry.item.label} — '${correctionNote}'`, itemId: entry.item.id,
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

      let status: 'complete' | 'in-progress' | 'attention';
      if (corrections.length > 0) status = 'attention';
      else if (requiredApproved.length === requiredItems.length && requiredItems.length > 0) status = 'complete';
      else status = 'in-progress';

      return { category: cat, approved: approved.length, pending: pending.length, corrections: corrections.length, total: items.length, status };
    });
  }, [caseData]);

  const totalApproved = categorySummary.reduce((s, c) => s + c.approved, 0);
  const totalPending = categorySummary.reduce((s, c) => s + c.pending, 0);
  const totalCorrections = categorySummary.reduce((s, c) => s + c.corrections, 0);
  const overallStatus = totalCorrections > 0 ? 'attention' : totalPending > 0 ? 'in-progress' : 'complete';

  const correctionChips = ['Wrong year', 'Illegible', 'Missing pages', 'Wrong document type'];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-10 bg-input border-border rounded-[10px]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleExportCheck('zip')}>
              <Download className="w-4 h-4 mr-1" /> Download ZIP
            </Button>
            <Button variant="secondary" onClick={() => handleExportCheck('pdf')}>
              <FileText className="w-4 h-4 mr-1" /> Compile PDF
            </Button>
          </div>
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
          {filteredFiles.map(({ file, item }) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-card-hover p-4 cursor-pointer"
              onClick={() => { setSelectedFile({ file, item }); setCorrectionNote(''); }}
            >
              <div className="flex items-start gap-3 mb-3">
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
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(file.uploadedAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-bold uppercase tracking-wider">
                  {CATEGORY_SHORT[item.category] || item.category}
                </span>
                <Badge className={`${getStatusBadgeClass(file.reviewStatus)} text-[10px]`}>
                  {file.reviewStatus.replace('-', ' ')}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Uploaded by {file.uploadedBy}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Completion Summary */}
      <div className="surface-card overflow-hidden">
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
      </div>

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
                  <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* File preview area */}
                <div className="surface-card p-6 flex flex-col items-center gap-3">
                  {isImageFile(selectedFile.file.name) && selectedFile.file.dataUrl ? (
                    <img src={selectedFile.file.dataUrl} alt={selectedFile.file.name} className="max-w-full max-h-64 rounded-lg object-contain" />
                  ) : (
                    <FileText className="w-16 h-16 text-muted-foreground/30" />
                  )}
                  <p className="text-foreground font-medium text-center">{selectedFile.file.name}</p>
                </div>

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
                    <span className="text-foreground capitalize">{selectedFile.file.uploadedBy}</span>
                  </div>
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

const StatusIndicator = ({ status }: { status: 'complete' | 'in-progress' | 'attention' }) => {
  const config = {
    complete: { label: 'Complete', className: 'text-success' },
    'in-progress': { label: 'In Progress', className: 'text-warning' },
    attention: { label: 'Attention Needed', className: 'text-destructive' },
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
