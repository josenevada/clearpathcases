import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CorrectionBannerProps {
  onFixNow: () => void;
}

const CorrectionBanner = ({ onFixNow }: CorrectionBannerProps) => {
  return (
    <div className="border-b border-warning/20 bg-warning/10 px-4 py-3">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-warning">
          <AlertTriangle className="h-4 w-4" />
          <span>Action needed — one document needs to be replaced.</span>
        </div>
        <Button variant="warning" size="sm" onClick={onFixNow}>
          Fix it now
        </Button>
      </div>
    </div>
  );
};

export default CorrectionBanner;
