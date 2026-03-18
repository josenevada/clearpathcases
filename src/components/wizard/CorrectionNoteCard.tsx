import { AlertTriangle } from 'lucide-react';

interface CorrectionNoteCardProps {
  requestedBy: string;
  reason: string;
  details?: string;
}

const CorrectionNoteCard = ({ requestedBy, reason, details }: CorrectionNoteCardProps) => {
  return (
    <div className="rounded-2xl border border-warning/20 border-l-4 border-l-warning bg-warning/10 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
        <AlertTriangle className="h-4 w-4" />
        <span>Correction requested</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">
        <span className="font-semibold">{requestedBy}</span>
        {' — '}
        {reason}
        {details?.trim() ? ` ${details.trim()}` : ''}
      </p>
    </div>
  );
};

export default CorrectionNoteCard;
