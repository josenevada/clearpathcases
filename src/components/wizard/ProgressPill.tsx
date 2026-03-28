import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import { CATEGORIES, isItemEffectivelyComplete, type Case } from '@/lib/store';

interface ProgressPillProps {
  caseData: Case;
}

const ProgressPill = ({ caseData }: ProgressPillProps) => {
  const [open, setOpen] = useState(false);

  const totalItems = caseData.checklist.length;
  const completedItems = caseData.checklist.filter(isItemEffectivelyComplete).length;

  const categories = CATEGORIES.map(cat => {
    const items = caseData.checklist.filter(i => i.category === cat);
    const done = items.filter(isItemEffectivelyComplete).length;
    const total = items.length;
    const status: 'complete' | 'in-progress' | 'not-started' =
      done === total && total > 0 ? 'complete' : done > 0 ? 'in-progress' : 'not-started';
    return { name: cat, done, total, status };
  }).filter(cat => cat.total > 0);

  return (
    <>
      {/* Floating pill */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors font-body"
      >
        {completedItems} of {totalItems} done — tap to see details
      </button>

      {/* Drawer overlay + content */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-background p-6 pb-10 max-h-[70vh] overflow-y-auto"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
              <h3 className="font-display text-lg font-bold text-foreground mb-4">
                Your Progress
              </h3>
              <div className="space-y-3">
                {categories.map(cat => (
                  <div
                    key={cat.name}
                    className="flex items-center gap-3 p-3 rounded-xl surface-card"
                  >
                    <StatusIcon status={cat.status} />
                    <span className="flex-1 text-foreground font-medium text-sm font-body">
                      {cat.name}
                    </span>
                    <span className="text-muted-foreground text-sm font-body">
                      {cat.done} of {cat.total}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const StatusIcon = ({ status }: { status: 'complete' | 'in-progress' | 'not-started' }) => {
  if (status === 'complete') {
    return <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />;
  }
  if (status === 'in-progress') {
    return (
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
      </div>
    );
  }
  return <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />;
};

export default ProgressPill;
