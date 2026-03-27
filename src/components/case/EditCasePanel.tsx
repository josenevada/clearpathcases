import { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { updateCase, addActivityEntry, type Case, type ChapterType } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditCasePanelProps {
  caseData: Case;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: Case) => void;
  actorName: string;
}

const EditCasePanel = ({ caseData, open, onClose, onUpdated, actorName }: EditCasePanelProps) => {
  const [clientName, setClientName] = useState(caseData.clientName);
  const [clientEmail, setClientEmail] = useState(caseData.clientEmail);
  const [clientPhone, setClientPhone] = useState(caseData.clientPhone || '');
  const [chapterType, setChapterType] = useState<ChapterType>(caseData.chapterType);
  const [filingDeadline, setFilingDeadline] = useState<Date>(new Date(caseData.filingDeadline));
  const [courtCaseNumber, setCourtCaseNumber] = useState(caseData.courtCaseNumber || '');
  const [assignedParalegal, setAssignedParalegal] = useState(caseData.assignedParalegal);
  const [assignedAttorney, setAssignedAttorney] = useState(caseData.assignedAttorney);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setClientName(caseData.clientName);
      setClientEmail(caseData.clientEmail);
      setClientPhone(caseData.clientPhone || '');
      setChapterType(caseData.chapterType);
      setFilingDeadline(new Date(caseData.filingDeadline));
      setCourtCaseNumber(caseData.courtCaseNumber || '');
      setAssignedParalegal(caseData.assignedParalegal);
      setAssignedAttorney(caseData.assignedAttorney);
      setError(null);
    }
  }, [open, caseData]);

  const hasChanges =
    clientName !== caseData.clientName ||
    clientEmail !== caseData.clientEmail ||
    clientPhone !== (caseData.clientPhone || '') ||
    chapterType !== caseData.chapterType ||
    filingDeadline.toISOString().slice(0, 10) !== new Date(caseData.filingDeadline).toISOString().slice(0, 10) ||
    courtCaseNumber !== (caseData.courtCaseNumber || '') ||
    assignedParalegal !== caseData.assignedParalegal ||
    assignedAttorney !== caseData.assignedAttorney;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Update in Supabase
      const { error: dbError } = await supabase
        .from('cases')
        .update({
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone || null,
          chapter_type: chapterType,
          filing_deadline: filingDeadline.toISOString().slice(0, 10),
          court_case_number: courtCaseNumber || null,
          assigned_paralegal: assignedParalegal,
          assigned_attorney: assignedAttorney,
        })
        .eq('id', caseData.id);

      if (dbError) throw new Error(dbError.message);

      // Log court case number change
      const oldCCN = caseData.courtCaseNumber || '';
      if (courtCaseNumber && courtCaseNumber !== oldCCN) {
        addActivityEntry(caseData.id, {
          eventType: 'case_updated',
          actorRole: 'paralegal',
          actorName,
          description: `${actorName} added court case number ${courtCaseNumber}`,
        });
        // Sync to Supabase activity log
        await supabase.from('activity_log').insert({
          case_id: caseData.id,
          event_type: 'case_updated',
          actor_role: 'paralegal',
          actor_name: actorName,
          description: `${actorName} added court case number ${courtCaseNumber}`,
        });
      }

      // Update in localStorage
      const updated = updateCase(caseData.id, c => ({
        ...c,
        clientName,
        clientEmail,
        clientPhone: clientPhone || undefined,
        chapterType,
        filingDeadline: filingDeadline.toISOString(),
        courtCaseNumber: courtCaseNumber || undefined,
        assignedParalegal,
        assignedAttorney,
      }));

      addActivityEntry(caseData.id, {
        eventType: 'case_updated',
        actorRole: 'paralegal',
        actorName,
        description: `${actorName} updated case details`,
      });

      toast.success('Case updated successfully');
      if (updated) onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-[420px] border-l border-border bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">Edit Case</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Full Name</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} className="bg-input border-border rounded-[10px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Email</Label>
            <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="bg-input border-border rounded-[10px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Phone</Label>
            <Input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Optional" className="bg-input border-border rounded-[10px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Chapter Type</Label>
            <div className="flex rounded-full bg-secondary p-0.5">
              {(['7', '13'] as ChapterType[]).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChapterType(ch)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    chapterType === ch ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Chapter {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filing Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-input border-border rounded-[10px]")}>
                  {format(filingDeadline, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filingDeadline}
                  onSelect={d => d && setFilingDeadline(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assigned Paralegal</Label>
            <Input value={assignedParalegal} onChange={e => setAssignedParalegal(e.target.value)} className="bg-input border-border rounded-[10px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assigned Attorney</Label>
            <Input value={assignedAttorney} onChange={e => setAssignedAttorney(e.target.value)} className="bg-input border-border rounded-[10px]" />
          </div>

          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex gap-3">
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
};

export default EditCasePanel;
