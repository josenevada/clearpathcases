import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

export interface StepDef {
  icon: LucideIcon;
  label: string;
  description: string;
}

interface AnimatedStepsProps {
  steps: StepDef[];
  autoAdvanceMs?: number;
  accentColor?: string;
}

const AnimatedSteps = ({ steps, autoAdvanceMs = 2500, accentColor = 'hsl(var(--primary))' }: AnimatedStepsProps) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % steps.length);
    }, autoAdvanceMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [steps.length, autoAdvanceMs]);

  const handleClick = (idx: number) => {
    setActiveIdx(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % steps.length);
    }, autoAdvanceMs);
  };

  return (
    <div className="relative pl-6">
      {/* Connecting line */}
      <div className="absolute left-[17px] top-4 bottom-4 w-px bg-border" />

      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = idx === activeIdx;

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.4, duration: 0.35, ease: [0.2, 0, 0, 1] }}
            onClick={() => handleClick(idx)}
            className="relative flex items-start gap-3 py-2.5 cursor-pointer group"
          >
            {/* Number circle */}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                isActive
                  ? 'text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
              style={isActive ? {
                backgroundColor: accentColor,
                boxShadow: `0 0 12px ${accentColor}50, 0 0 24px ${accentColor}25`,
                animation: 'pulse-glow 2s cubic-bezier(0.4,0,0.6,1) infinite',
              } : undefined}
            >
              {idx + 1}
            </div>

            <div className="flex-1 min-w-0 -mt-0.5">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              <p className={`text-xs mt-0.5 transition-colors ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                {step.description}
              </p>
            </div>
          </motion.div>
        );
      })}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px ${accentColor}40, 0 0 16px ${accentColor}20; }
          50% { box-shadow: 0 0 16px ${accentColor}60, 0 0 32px ${accentColor}30; }
        }
      `}</style>
    </div>
  );
};

export default AnimatedSteps;
