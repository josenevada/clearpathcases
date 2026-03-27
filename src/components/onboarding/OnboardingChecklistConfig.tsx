import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Zap, FileText, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  getDocTemplates, saveDocTemplates, buildDefaultTemplates,
  CATEGORIES, type TemplateItem,
} from '@/lib/store';
import { toast } from 'sonner';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

const PRESETS: { label: string; icon: React.ReactNode; description: string; key: string }[] = [
  { label: 'Standard Chapter 7', icon: <FileText className="w-4 h-4" />, description: 'All items enabled', key: 'ch7' },
  { label: 'Standard Chapter 13', icon: <ListChecks className="w-4 h-4" />, description: 'All items + repayment plan', key: 'ch13' },
  { label: 'Minimal — Quick Start', icon: <Zap className="w-4 h-4" />, description: 'Essential items only', key: 'minimal' },
];

const MINIMAL_LABELS = new Set([
  'Pay Stubs (Last 2 Months)',
  'Checking/Savings Statements (Last 6 Months)',
  'Tax Returns (Last 2 Years)',
  'Government-Issued Photo ID',
]);

const REPAYMENT_ITEM: Omit<TemplateItem, 'id' | 'order'> = {
  category: 'Agreements & Confirmation',
  label: 'Proposed Repayment Plan',
  description: 'Upload or review the proposed repayment plan for your Chapter 13 filing.',
  whyWeNeedThis: 'Chapter 13 requires a court-approved repayment plan detailing how debts will be repaid over 3-5 years.',
  required: true,
  active: true,
  isCustom: true,
};

const OnboardingChecklistConfig = ({ onNext, onSkip }: Props) => {
  const [templates, setTemplates] = useState<TemplateItem[]>(getDocTemplates());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['Income & Employment']));

  const persist = useCallback((items: TemplateItem[]) => {
    setTemplates(items);
    saveDocTemplates(items);
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleField = (id: string, field: 'required' | 'active') => {
    persist(templates.map(t => t.id === id ? { ...t, [field]: !t[field] } : t));
  };

  const applyPreset = (key: string) => {
    let items = buildDefaultTemplates();

    if (key === 'ch7') {
      items = items.map(t => ({ ...t, active: true }));
    } else if (key === 'ch13') {
      items = items.map(t => ({ ...t, active: true }));
      // Add repayment plan item if not present
      if (!items.some(t => t.label === REPAYMENT_ITEM.label)) {
        items.push({
          ...REPAYMENT_ITEM,
          id: Math.random().toString(36).substr(2, 9),
          order: items.length,
        });
      }
    } else if (key === 'minimal') {
      items = items.map(t => ({ ...t, active: MINIMAL_LABELS.has(t.label) }));
    }

    persist(items);
    toast.success(`Preset applied: ${PRESETS.find(p => p.key === key)?.label}`);
  };

  const getCategoryItems = (cat: string) =>
    templates.filter(t => t.category === cat).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">Configure Your Checklist</h2>
        <p className="text-sm text-muted-foreground font-body mt-2">
          This is your firm's default document checklist. Every new case will start with these items. You can always update this later in Firm Settings.
        </p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-3 gap-3">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className="surface-card p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors space-y-1"
          >
            <div className="flex justify-center text-primary">{p.icon}</div>
            <p className="text-xs font-body font-semibold text-foreground">{p.label}</p>
            <p className="text-[10px] text-muted-foreground font-body">{p.description}</p>
          </button>
        ))}
      </div>

      {/* Category list */}
      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {(CATEGORIES as readonly string[]).map(cat => {
          const items = getCategoryItems(cat);
          const isOpen = expandedCats.has(cat);

          return (
            <div key={cat} className="surface-card overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between p-3 hover:bg-[hsl(var(--surface-hover))] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="font-display font-bold text-sm text-foreground">{cat}</span>
                  <span className="text-[10px] text-muted-foreground font-body">{items.filter(i => i.active).length} active</span>
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-all ${!item.active ? 'opacity-50 border-border' : 'border-border'}`}
                        >
                          <p className={`font-body text-xs flex-1 min-w-0 ${item.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                            {item.label}
                          </p>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">Req</span>
                              <Switch checked={item.required} onCheckedChange={() => toggleField(item.id, 'required')} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">Active</span>
                              <Switch checked={item.active} onCheckedChange={() => toggleField(item.id, 'active')} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <Button className="w-full" onClick={onNext}>Next</Button>
      <p className="text-sm text-muted-foreground text-center cursor-pointer hover:text-foreground" onClick={onSkip}>
        Skip for now
      </p>
    </div>
  );
};

export default OnboardingChecklistConfig;
