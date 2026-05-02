import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, Circle, AlertCircle, MinusCircle, X, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES, isItemEffectivelyComplete, type ChecklistItem } from '@/lib/store';

interface WizardSidebarProps {
  checklist: ChecklistItem[];
  currentCategoryIdx: number;
  currentItemIdx: number;
  onNavigate: (categoryIdx: number, itemIdx: number) => void;
  onClose?: () => void;
}

const getStatusIcon = (item: ChecklistItem) => {
  if (item.notApplicable) return <MinusCircle className="w-4 h-4 text-muted-foreground/50" />;
  if (item.correctionRequest?.status === 'open') return <div className="w-3 h-3 rounded-full bg-destructive" />;
  if (isItemEffectivelyComplete(item)) return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (item.files.length > 0 && !item.completed) return <div className="w-3 h-3 rounded-full bg-warning" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40" />;
};

const WizardSidebar = ({ checklist, currentCategoryIdx, currentItemIdx, onNavigate, onClose }: WizardSidebarProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(() => {
    const set = new Set<number>();
    set.add(currentCategoryIdx);
    return set;
  });

  const toggleCategory = (idx: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Update expanded when currentCategoryIdx changes
  React.useEffect(() => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.add(currentCategoryIdx);
      return next;
    });
  }, [currentCategoryIdx]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">My Documents</h2>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto py-2 pb-16">
        {CATEGORIES.map((category, catIdx) => {
          const catItems = checklist.filter(i => i.category === category);
          if (catItems.length === 0) return null;
          const doneCount = catItems.filter(isItemEffectivelyComplete).length;
          const isExpanded = expandedCategories.has(catIdx);
          const isCurrentCat = catIdx === currentCategoryIdx;

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(catIdx)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors",
                  isCurrentCat && "bg-primary/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", isCurrentCat ? "text-primary" : "text-foreground")}>
                    {category}
                  </p>
                  <p className="text-xs text-muted-foreground">{doneCount} of {catItems.length} done</p>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ml-2",
                  isExpanded && "rotate-180"
                )} />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {catItems.map((item, itemIdx) => {
                      const isActive = catIdx === currentCategoryIdx && itemIdx === currentItemIdx;
                      const label = item.label.length > 30 ? item.label.slice(0, 30) + '…' : item.label;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(catIdx, itemIdx);
                            onClose?.();
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-6 py-2 text-left transition-colors text-sm",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          )}
                        >
                          <span className="flex-shrink-0">{getStatusIcon(item)}</span>
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WizardSidebar;
