import { useEffect, useState } from 'react';
import { GripVertical, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getIntakeQuestions, saveIntakeQuestions, type IntakeQuestion } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { fetchCounselingSettings, saveCounselingSettings } from '@/lib/dashboard-data';
import { toast } from 'sonner';

const COUNSELING_KEY = 'cp_counseling_provider';

interface CounselingProvider {
  providerName: string;
  providerLink: string;
  attorneyCode: string;
}

const loadCounseling = (): CounselingProvider => {
  try {
    const raw = localStorage.getItem(COUNSELING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { providerName: '', providerLink: '', attorneyCode: '' };
};

const saveCounselingProvider = (data: CounselingProvider) => {
  localStorage.setItem(COUNSELING_KEY, JSON.stringify(data));
};

const IntakeQuestionsTab = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<IntakeQuestion[]>(getIntakeQuestions());
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [counseling, setCounseling] = useState<CounselingProvider>(loadCounseling);

  useEffect(() => {
    const loadPersistedCounseling = async () => {
      if (!user?.firmId) return;

      try {
        setCounseling(await fetchCounselingSettings(user.firmId));
      } catch {
        toast.error('Failed to load credit counseling settings.');
      }
    };

    void loadPersistedCounseling();
  }, [user?.firmId]);

  const persist = (items: IntakeQuestion[]) => {
    setQuestions(items);
    saveIntakeQuestions(items);
  };

  const toggleActive = (id: string) => {
    persist(questions.map(q => q.id === id ? { ...q, active: !q.active } : q));
    toast.success('Question updated.');
  };

  const handleDragStart = (id: string) => setDragItem(id);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragItem || dragItem === targetId) return;
    const items = [...questions];
    const fromIdx = items.findIndex(q => q.id === dragItem);
    const toIdx = items.findIndex(q => q.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    items.forEach((q, i) => q.order = i);
    persist(items);
  };

  const handleDragEnd = () => setDragItem(null);

  const handleSaveCounseling = async () => {
    try {
      saveCounselingProvider(counseling);
      if (user?.firmId) {
        await saveCounselingSettings(user.firmId, counseling);
      }
      toast.success('Credit counseling provider saved.');
    } catch {
      toast.error('Failed to save credit counseling provider.');
    }
  };

  const sorted = [...questions].sort((a, b) => a.order - b.order);

  return (
    <div>
      {/* Credit Counseling Provider */}
      <div className="surface-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground">Credit Counseling Provider</h3>
        </div>
        <p className="text-xs text-muted-foreground font-body mb-4">
          This link is shown to clients in their intake portal when they reach the Credit Counseling Certificate step. Use an EOUST-approved provider.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Provider name</Label>
            <Input
              value={counseling.providerName}
              onChange={e => setCounseling(prev => ({ ...prev, providerName: e.target.value }))}
              placeholder="e.g. Evergreen Financial Counseling"
              className="bg-input border-border rounded-[10px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Provider link</Label>
            <Input
              type="url"
              value={counseling.providerLink}
              onChange={e => setCounseling(prev => ({ ...prev, providerLink: e.target.value }))}
              placeholder="https://evergreenclass.com"
              className="bg-input border-border rounded-[10px]"
            />
          </div>
        </div>
        <div className="space-y-1.5 mb-4 max-w-sm">
          <Label className="text-sm text-muted-foreground">Attorney code (optional)</Label>
          <Input
            value={counseling.attorneyCode}
            onChange={e => setCounseling(prev => ({ ...prev, attorneyCode: e.target.value }))}
            placeholder="e.g. ATT-12345"
            className="bg-input border-border rounded-[10px]"
          />
        </div>
        <Button size="sm" onClick={handleSaveCounseling}>Save Provider</Button>
      </div>

      {/* Intake Questions */}
      <div className="surface-card p-4 mb-4">
        <p className="text-sm text-muted-foreground font-body">
          Customize which questions appear during new case creation. Deactivating a question hides it from the intake flow but does not remove the associated documents.
        </p>
      </div>

      <div className="space-y-2">
        {sorted.map(q => (
          <div
            key={q.id}
            draggable
            onDragStart={() => handleDragStart(q.id)}
            onDragOver={(e) => handleDragOver(e, q.id)}
            onDragEnd={handleDragEnd}
            className={`surface-card p-4 flex items-start gap-3 transition-all ${
              dragItem === q.id ? 'opacity-50 border-primary/50' : ''
            } ${!q.active ? 'opacity-60' : ''}`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={`font-body text-sm ${q.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {q.question}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {q.controlsItems.map(item => (
                  <Badge key={item} variant="secondary" className="text-[10px] font-body">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground">Active</span>
              <Switch checked={q.active} onCheckedChange={() => toggleActive(q.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntakeQuestionsTab;
