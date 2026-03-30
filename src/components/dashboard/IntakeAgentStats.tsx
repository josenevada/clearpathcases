import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AgentStats {
  totalSessions: number;
  topPlatform: string | null;
  completionRate: number;
}

const IntakeAgentStats = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<AgentStats>({ totalSessions: 0, topPlatform: null, completionRate: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || loaded) return;

    const fetchStats = async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data, error } = await supabase
          .from('agent_interactions')
          .select('platform_selected, document_uploaded_after')
          .gte('session_at', startOfMonth);

        if (error || !data) return;

        const totalSessions = data.length;
        const uploadedAfter = data.filter(d => d.document_uploaded_after).length;
        const completionRate = totalSessions > 0 ? Math.round((uploadedAfter / totalSessions) * 100) : 0;

        // Find top platform
        const platformCounts: Record<string, number> = {};
        for (const row of data) {
          if (row.platform_selected) {
            platformCounts[row.platform_selected] = (platformCounts[row.platform_selected] || 0) + 1;
          }
        }
        const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        setStats({ totalSessions, topPlatform, completionRate });
        setLoaded(true);
      } catch (e) {
        console.warn('Failed to fetch agent stats:', e);
      }
    };

    fetchStats();
  }, [isOpen, loaded]);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="font-medium">Intake Agent</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
            <div className="surface-card mt-2 p-4 rounded-xl">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sessions this month</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.topPlatform || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Top platform</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Completion rate</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntakeAgentStats;
