import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileCheck, AlertTriangle, Briefcase, Download, ArrowLeft, Settings, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Logo from '@/components/Logo';

import PlanBadge from '@/components/PlanBadge';
import { getAllCases, type Case } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Packets = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  useEffect(() => {
    setCases(getAllCases());
  }, []);

  const activeCases = cases.filter(c => c.status !== 'filed' && c.status !== 'closed');

  const getCaseReadiness = (c: Case) => {
    const requiredItems = c.checklist.filter(item => item.required && !item.notApplicable);
    const approvedItems = requiredItems.filter(item =>
      item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')
    );
    const total = requiredItems.length;
    const ready = approvedItems.length;
    const missing = total - ready;
    const percent = total > 0 ? Math.round((ready / total) * 100) : 0;
    return { total, ready, missing, percent, isReady: missing === 0 && total > 0 };
  };

  const readyCases = activeCases.filter(c => getCaseReadiness(c).isReady);
  const missingCases = activeCases.filter(c => !getCaseReadiness(c).isReady);

  const filteredCases = activeCases.filter(c => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return c.clientName.toLowerCase().includes(term) || (c.caseCode && c.caseCode.toLowerCase().includes(term));
  });

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary/20 text-primary',
      'bg-[hsl(210,80%,55%)]/20 text-[hsl(210,80%,55%)]',
      'bg-success/20 text-success',
      'bg-warning/20 text-warning',
      'bg-[hsl(280,60%,55%)]/20 text-[hsl(280,60%,55%)]',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const loadBranding = () => {
    try {
      const raw = localStorage.getItem('cp_branding');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const handleBatchExport = async () => {
    setShowBatchConfirm(false);
    setBatchExporting(true);
    setBatchProgress({ current: 0, total: readyCases.length });

    const zip = new JSZip();
    const branding = loadBranding();
    let successCount = 0;
    const failedCases: string[] = [];

    for (let i = 0; i < readyCases.length; i++) {
      const c = readyCases[i];
      setBatchProgress({ current: i + 1, total: readyCases.length });

      try {
        const { data, error } = await supabase.functions.invoke('generate-court-packet', {
          body: {
            caseId: c.id,
            branding,
            paralegalName: c.assignedParalegal || 'Staff',
          },
        });

        if (error || !data?.success) {
          console.error(`Failed for case ${c.clientName}:`, error || data?.error);
          failedCases.push(c.clientName);
          continue;
        }

        const binaryStr = atob(data.pdf);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }
        zip.file(data.fileName, bytes);
        successCount++;
      } catch (err) {
        console.error(`Batch export error for ${c.clientName}:`, err);
        failedCases.push(c.clientName);
      }
    }

    if (successCount > 0) {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      saveAs(zipBlob, `ClearPath_Packets_${dateStr}.zip`);

      if (failedCases.length > 0) {
        toast.warning(`${successCount} of ${readyCases.length} packets exported. The following cases had errors: ${failedCases.join(', ')}. Check those cases for missing documents.`);
      } else {
        toast.success(`${successCount} packet${successCount > 1 ? 's' : ''} exported successfully`);
      }
    } else {
      toast.error('No packets could be generated. Please check the cases for missing documents and try again.');
    }

    setBatchExporting(false);
  };

  const handleSingleGenerate = async (c: Case, e: React.MouseEvent) => {
    e.stopPropagation();
    const branding = loadBranding();
    try {
      const { data, error } = await supabase.functions.invoke('generate-court-packet', {
        body: {
          caseId: c.id,
          branding,
          paralegalName: c.assignedParalegal || 'Staff',
        },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Failed');

      const binaryStr = atob(data.pdf);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Packet generated');
    } catch (err: any) {
      toast.error('Generation failed', { description: err.message });
    }
  };

  return (
    <div className="min-h-screen">
      <header className="relative flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="hidden text-sm text-muted-foreground font-body sm:block">Court Packets</span>
          <PlanBadge />
        </div>
        <div className="flex items-center gap-4">
          
          <Button variant="ghost" size="icon" onClick={() => navigate('/paralegal/settings')}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/paralegal')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">Court Packets</h1>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                {readyCases.length} ready to generate
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => readyCases.length > 0 ? setShowBatchConfirm(true) : undefined}
                    disabled={batchExporting || activeCases.length === 0}
                  >
                    {batchExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Generating {batchProgress.current} of {batchProgress.total}…
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1.5" /> Batch export
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {activeCases.length === 0 && (
                <TooltipContent>No active cases yet — create your first case to get started</TooltipContent>
              )}
              {activeCases.length > 0 && readyCases.length === 0 && (
                <TooltipContent>No cases are ready to export yet — {missingCases.length} cases have missing documents</TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="surface-card p-5 space-y-1">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Ready to generate</p>
              </div>
              <p className="text-2xl font-body font-bold text-primary tabular-nums">{readyCases.length}</p>
            </div>
            <div className="surface-card p-5 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Missing documents</p>
              </div>
              <p className="text-2xl font-body font-bold text-warning tabular-nums">{missingCases.length}</p>
            </div>
            <div className="surface-card p-5 space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Total active cases</p>
              </div>
              <p className="text-2xl font-body font-bold text-foreground tabular-nums">{activeCases.length}</p>
            </div>
          </div>

          {/* Search */}
          {activeCases.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by client name or case code"
                className="pl-10 pr-10 bg-input border-border rounded-[10px]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Case list */}
          {filteredCases.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground font-body">
                {searchTerm ? 'No cases match your search.' : 'No active cases.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCases.map(c => {
                const { percent, missing, isReady } = getCaseReadiness(c);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/paralegal/case/${c.id}?tab=packet`)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(c.clientName)}`}>
                      {getInitials(c.clientName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-body text-foreground truncate">{c.clientName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-body">
                        <span>CH.{c.chapterType}</span>
                        <span>·</span>
                        <span>Deadline: {format(new Date(c.filingDeadline), 'MMM d')}</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-32 flex-shrink-0">
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${percent}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-body mt-1 text-right">{percent}%</p>
                    </div>
                    <div className="flex-shrink-0">
                      {isReady ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full text-[10px] font-bold">Ready</Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-warning/20 rounded-full text-[10px] font-bold">{missing} missing</Badge>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {isReady ? (
                        <Button size="sm" className="gap-1.5 text-xs" onClick={e => handleSingleGenerate(c, e)}>
                          <Download className="w-3 h-3" /> Generate
                        </Button>
                      ) : (
                        <Button size="sm" disabled className="gap-1.5 text-xs bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted">
                          Not ready
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>

      {/* Batch export confirmation */}
      <AlertDialog open={showBatchConfirm} onOpenChange={setShowBatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export packets for {readyCases.length} ready case{readyCases.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate and download a ZIP file containing {readyCases.length} court packet{readyCases.length !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchExport}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Packets;
