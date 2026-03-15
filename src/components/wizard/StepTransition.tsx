import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, type Case } from '@/lib/store';

interface StepTransitionProps {
  completedStepIdx: number;
  caseData: Case;
  onContinue: () => void;
}

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
};

const StepTransition = ({ completedStepIdx, caseData, onContinue }: StepTransitionProps) => {
  const completedName = CATEGORIES[completedStepIdx];
  const nextIdx = completedStepIdx + 1;
  const nextName = CATEGORIES[nextIdx];
  const nextItems = caseData.checklist.filter(i => i.category === nextName);
  const totalCompleted = caseData.checklist.filter(i => i.completed).length;
  const totalItems = caseData.checklist.length;

  return (
    <motion.div {...pageTransition} className="max-w-md mx-auto w-full text-center">
      <div className="flex items-center justify-center gap-2 mb-6">
        <CheckCircle2 className="w-6 h-6 text-success" />
        <span className="text-success font-display font-bold text-lg">
          Step {completedStepIdx + 1} complete
        </span>
      </div>

      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
        Up next: {nextName}
      </h2>

      <p className="text-muted-foreground text-lg font-body mb-2">
        {nextItems.length} {nextItems.length === 1 ? 'thing' : 'things'} to gather
      </p>

      <p className="text-muted-foreground/70 text-sm font-body mb-10">
        You've completed {totalCompleted} of {totalItems} items overall
      </p>

      <Button onClick={onContinue} size="lg" className="w-full max-w-xs">
        Let's go →
      </Button>
    </motion.div>
  );
};

export default StepTransition;
