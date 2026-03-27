import { useState, useEffect } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { AlertTriangle, Download, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RetentionCase {
  id: string;
  client_name: string;
  court_case_number: string | null;
  case_code: string | null;
  status: string;
  closed_at: string | null;
  created_at: string;
  retention_delete_scheduled_at: string | null;
}

const DataRetentionTab = () => {
  const [cases, setCases] = useState<RetentionCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRetentionCases();
  }, []);

  const loadRetentionCases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, client_name, court_case_number, case_code, status, closed_at, created_at, retention_delete_scheduled_at')
        .in('status', ['filed', 'closed'])
        .not('retention_delete_scheduled_at', 'is', null)
        .order('retention_delete_scheduled_at', { ascending: true });

      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      console.error('Failed to load retention cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (caseId: string) => {
    // Navigate to case documents tab for export
    window.open(`/paralegal/case/${caseId}?tab=documents`, '_blank');
    toast.info('Opening case documents for export.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">Data Retention</h2>
        <p className="text-sm text-muted-foreground font-body">
          ClearPath's data retention policy ensures compliance with legal requirements.
        </p>
      </div>

      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-display font-bold text-foreground">7-Year Retention Policy</h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Cases that have been marked as <strong>Filed</strong> or <strong>Closed</strong> for more than 7 years
              are eligible for automatic deletion. When a case becomes eligible, your firm's primary contact
              receives an email notification with a 90-day window to export any documents before permanent deletion.
            </p>
            <p className="text-sm text-muted-foreground font-body mt-2">
              If you export the data or manually delete the case before the 90-day window expires, the scheduled
              deletion is cancelled for that case. If no action is taken, all associated records — including documents,
              activity history, and client information — are permanently removed.
            </p>
          </div>
        </div>
      </div>

      {cases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="font-display font-bold text-foreground">
              Cases Approaching Deletion ({cases.length})
            </h3>
          </div>

          {cases.map(c => {
            const deleteDate = c.retention_delete_scheduled_at
              ? new Date(c.retention_delete_scheduled_at)
              : null;
            const daysLeft = deleteDate
              ? differenceInDays(deleteDate, new Date())
              : null;

            return (
              <div key={c.id} className="surface-card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-foreground text-sm">{c.client_name}</span>
                    {c.court_case_number && (
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {c.court_case_number}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs capitalize">{c.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    {deleteDate && (
                      <>
                        Scheduled deletion: <strong>{format(deleteDate, 'MMM d, yyyy')}</strong>
                        {daysLeft !== null && daysLeft > 0 && (
                          <span className={`ml-2 ${daysLeft <= 14 ? 'text-warning' : ''}`}>
                            ({daysLeft} days remaining)
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExport(c.id)} className="flex-shrink-0 gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export Now
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && cases.length === 0 && (
        <div className="surface-card p-6 text-center">
          <Shield className="w-8 h-8 text-primary mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground font-body">
            No cases are currently approaching the retention window. All data is safe.
          </p>
        </div>
      )}
    </div>
  );
};

export default DataRetentionTab;
