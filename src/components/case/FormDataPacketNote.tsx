import { useState, useEffect } from 'react';
import { Info, Sparkles, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FormDataPacketNoteProps {
  caseId: string;
}

export const FormDataPacketNote = ({ caseId }: FormDataPacketNoteProps) => {
  const [state, setState] = useState<'none' | 'draft' | 'approved'>('none');

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('generated_federal_forms')
        .select('watermark_status')
        .eq('case_id', caseId);

      if (!data || data.length === 0) {
        setState('none');
      } else if (data.every((f: any) => f.watermark_status === 'approved')) {
        setState('approved');
      } else {
        setState('draft');
      }
    };
    check();
  }, [caseId]);

  if (state === 'none') {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-xs text-muted-foreground font-body">
          AI form filling is available. Go to the <span className="text-primary font-bold">Form Data</span> tab to extract and generate pre-filled federal forms.
        </p>
      </div>
    );
  }

  if (state === 'draft') {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-warning/5 border border-warning/15">
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
        <p className="text-xs text-warning font-body">
          Pre-filled federal forms are pending attorney approval. Approve them in the <span className="font-bold">Form Data</span> tab before generating your court packet.
        </p>
      </div>
    );
  }

  return null; // approved — no note needed
};
