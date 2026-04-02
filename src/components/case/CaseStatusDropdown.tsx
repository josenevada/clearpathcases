import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
import { updateCase, type Case, type CaseStatus } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<CaseStatus, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-primary/10 text-primary border-primary/20' },
  'on-hold': { label: 'On Hold', classes: 'bg-warning/10 text-warning border-warning/20' },
  'ready-to-file': { label: 'Ready to File', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  filed: { label: 'Filed', classes: 'bg-success/10 text-success border-success/20' },
  closed: { label: 'Closed', classes: 'bg-muted text-muted-foreground border-border' },
};

interface CaseStatusDropdownProps {
  caseData: Case;
  actorName: string;
  onUpdated: (updated: Case) => void;
}

const CaseStatusDropdown = ({ caseData, actorName, onUpdated }: CaseStatusDropdownProps) => {
  const [confirmDialog, setConfirmDialog] = useState<CaseStatus | null>(null);
  const currentStatus = caseData.status || 'active';
  const config = STATUS_CONFIG[currentStatus];

  const changeStatus = async (newStatus: CaseStatus) => {
    // Update Supabase
    await supabase.from('cases').update({ status: newStatus }).eq('id', caseData.id);

    // Update localStorage
    const updated = updateCase(caseData.id, c => ({
      ...c,
      status: newStatus,
      readyToFile: newStatus === 'ready-to-file' || newStatus === 'filed' ? true : c.readyToFile,
    }));

    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'status_change',
      actor_role: 'paralegal',
      actor_name: actorName,
      description: `${actorName} marked this case as ${STATUS_CONFIG[newStatus].label}`,
    });

    // Log notification pause for terminal statuses
    if (newStatus === 'filed' || newStatus === 'closed') {
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'notifications_paused',
        actor_role: 'system',
        actor_name: 'ClearPath',
        description: 'Automated notifications paused — case marked as ' + (newStatus === 'filed' ? 'filed' : 'closed'),
      });
      // Persist to Supabase activity log
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'notifications_paused',
        actor_role: 'system',
        actor_name: 'ClearPath',
        description: 'Automated notifications paused — case marked as ' + (newStatus === 'filed' ? 'filed' : 'closed'),
      });
    }

    toast.success(`Case status updated to ${STATUS_CONFIG[newStatus].label}`);
    if (updated) onUpdated(updated);
    setConfirmDialog(null);
  };

  const handleSelect = (status: CaseStatus) => {
    if (status === currentStatus) return;
    if (status === 'filed' || status === 'closed') {
      setConfirmDialog(status);
    } else {
      changeStatus(status);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors hover:opacity-80 ${config.classes}`}>
            {config.label}
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map(status => (
            <DropdownMenuItem
              key={status}
              onClick={() => handleSelect(status)}
              className={status === currentStatus ? 'font-bold' : ''}
            >
              <span className={`mr-2 inline-block h-2 w-2 rounded-full ${
                status === 'active' ? 'bg-primary' :
                status === 'on-hold' ? 'bg-warning' :
                status === 'ready-to-file' ? 'bg-blue-400' :
                status === 'filed' ? 'bg-success' : 'bg-muted-foreground'
              }`} />
              {STATUS_CONFIG[status].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDialog === 'filed'} onOpenChange={open => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this case as Filed?</AlertDialogTitle>
            <AlertDialogDescription>This will move it to your completed cases list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeStatus('filed')}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDialog === 'closed'} onOpenChange={open => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this case as Closed?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be easily undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeStatus('closed')}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CaseStatusDropdown;
