import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description: string;
}

const UpgradeModal = ({ open, onOpenChange, featureName, description }: UpgradeModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] text-center">
        <DialogHeader className="items-center">
          <div className="mb-2">
            <Logo size="sm" clickable={false} />
          </div>
          <DialogTitle className="font-display font-bold text-lg text-foreground">
            {featureName}
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate('/paralegal/settings?tab=billing');
            }}
          >
            Upgrade Plan
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
