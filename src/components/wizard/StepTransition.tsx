import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, isItemEffectivelyComplete, type Case } from '@/lib/store';

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
  const completedItems = caseData.checklist.filter(i => i.category === completedName);
  const nextItems = caseData.checklist.filter(i => i.category === nextName);
  const nextPreview = nextItems.slice(0, 2);

  return (
    <motion.div {...pageTransition} className="max-w-md mx-auto w-full">
      {/* Animated checkmark */}
      <div className="flex justify-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
        >
          <CheckCircle2 className="w-9 h-9 text-success" />
        </motion.div>
      </div>

      {/* Heading */}
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground text-center mb-5">
        You finished {completedName}
      </h2>

      {/* Completed items list */}
      <div className="space-y-1.5 mb-6">
        {completedItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="flex items-center gap-2 px-3 py-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{item.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Divider + next section */}
      {nextName && (
        <>
          <div className="border-t border-border my-5" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Up next</p>
          <p className="text-primary font-display font-bold text-lg mb-3">{nextName}</p>
          <div className="space-y-1 mb-8">
            {nextPreview.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-1">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
            ))}
            {nextItems.length > 2 && (
              <p className="text-xs text-muted-foreground/60 px-3">
                + {nextItems.length - 2} more
              </p>
            )}
          </div>
        </>
      )}

      <Button onClick={onContinue} size="lg" className="w-full max-w-xs mx-auto block">
        Start {nextName} →
      </Button>
    </motion.div>
  );
};

export default StepTransition;
