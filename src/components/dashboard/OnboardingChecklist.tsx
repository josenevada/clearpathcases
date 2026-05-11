import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X, Building2, BookOpen, Plus, Send, FileText } from 'lucide-react';

interface OnboardingChecklistProps {
  firmProfileComplete: boolean;
  counselingComplete: boolean;
  hasTemplate: boolean;
  hasCases: boolean;
  hasSentLink: boolean;
  onNewCase: () => void;
  onSendLink: () => void;
}

const OnboardingChecklist = ({ firmProfileComplete, counselingComplete, hasTemplate, hasCases, hasSentLink, onNewCase, onSendLink }: OnboardingChecklistProps) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const steps = [
    {
      label: 'Complete your firm profile',
      done: firmProfileComplete,
      action: () => navigate('/paralegal/settings/firm/profile'),
      icon: Building2,
    },
    {
      label: 'Set your credit counseling provider link',
      done: counselingComplete,
      action: () => navigate('/paralegal/settings/case/questions'),
      icon: BookOpen,
    },
    {
      label: 'Customize your document checklist template',
      done: hasTemplate,
      action: () => navigate('/paralegal/settings/case/templates'),
      icon: FileText,
    },
    {
      label: 'Create your first case',
      done: hasCases,
      action: onNewCase,
      icon: Plus,
    },
    ...(hasCases ? [{
      label: 'Send your client their intake link',
      done: hasSentLink,
      action: onSendLink,
      icon: Send,
    }] : []),
  ];

  const completedCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  if (completedCount === totalCount) {
    return null;
  }

  return (
    <div className="surface-card p-6 mb-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-4 mb-5">
        {/* Progress ring */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--secondary))" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div>
          <h3 className="font-display font-bold text-foreground text-lg">Get ClearPath ready for your first client</h3>
          <p className="text-sm text-muted-foreground font-body">Complete these steps to start managing cases.</p>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={step.action}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
              step.done
                ? 'opacity-60'
                : 'hover:bg-[hsl(var(--surface-hover))]'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
            <span className={`text-sm font-body ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {step.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
