import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { getIntakeQuestions, saveIntakeQuestions, type IntakeQuestion } from '@/lib/store';
import { toast } from 'sonner';

const IntakeQuestionsTab = () => {
  const [questions, setQuestions] = useState<IntakeQuestion[]>(getIntakeQuestions());
  const [dragItem, setDragItem] = useState<string | null>(null);

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

  const sorted = [...questions].sort((a, b) => a.order - b.order);

  return (
    <div>
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
