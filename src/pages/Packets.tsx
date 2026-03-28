import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileCheck, AlertTriangle, Briefcase, Download, ArrowLeft, Settings, LogOut, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import PlanBadge from '@/components/PlanBadge';
import { getAllCases, calculateProgress, type Case } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Packets = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setCases(getAllCases());
  }, []);

  const activeCases = cases.filter(c => c.status !== 'filed' && c.status !== 'closed');

  const getCaseReadiness = (c: Case) => {
    const requiredItems = c.checklist.filter(item => item.required && !item.notApplicable);
    const approvedItems = requiredItems.filter(item =>
      item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')
    );
    const total = requiredItems.length;
    const ready = approvedItems.length;
    const missing = total - ready;
    const percent = total > 0 ? Math.round((ready / total) * 100) : 0;
    return { total, ready, missing, percent, isReady: missing === 0 && total > 0 };
  };

  const readyCases = activeCases.filter(c => getCaseReadiness(c).isReady);
  const missingCases = activeCases.filter(c => !getCaseReadiness(c).isReady);

  const filteredCases = activeCases.filter(c => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return c.clientName.toLowerCase().includes(term) || (c.caseCode && c.caseCode.toLowerCase().includes(term));
  });

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary/20 text-primary',
      'bg-[hsl(210,80%,55%)]/20 text-[hsl(210,80%,55%)]',
      'bg-success/20 text-success',
      'bg-warning/20 text-warning',
      'bg-[hsl(280,60%,55%)]/20 text-[hsl(280,60%,55%)]',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="min-h-screen">
      <header className="relative flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="hidden text-sm text-muted-foreground font-body sm:block">Court Packets</span>
          <PlanBadge />
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => navigate('/paralegal/settings')}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/paralegal')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">Court Packets</h1>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                {readyCases.length} ready to generate
              </p>
            </div>
            <Button
              onClick={() => toast('Coming soon', { description: 'Batch export is not yet available.' })}
            >
              <Download className="w-4 h-4 mr-1.5" /> Batch export
            </Button>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="surface-card p-5 space-y-1">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Ready to generate</p>
              </div>
              <p className="text-2xl font-body font-bold text-primary tabular-nums">{readyCases.length}</p>
            </div>
            <div className="surface-card p-5 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Missing documents</p>
              </div>
              <p className="text-2xl font-body font-bold text-warning tabular-nums">{missingCases.length}</p>
            </div>
            <div className="surface-card p-5 space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Total active cases</p>
              </div>
              <p className="text-2xl font-body font-bold text-foreground tabular-nums">{activeCases.length}</p>
            </div>
          </div>

          {/* Search */}
          {activeCases.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by client name or case code"
                className="pl-10 pr-10 bg-input border-border rounded-[10px]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Case list */}
          {filteredCases.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground font-body">
                {searchTerm ? 'No cases match your search.' : 'No active cases.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCases.map(c => {
                const { percent, missing, isReady } = getCaseReadiness(c);

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/paralegal/case/${c.id}?tab=packet`)}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(c.clientName)}`}>
                      {getInitials(c.clientName)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-body text-foreground truncate">{c.clientName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-body">
                        <span>CH.{c.chapterType}</span>
                        <span>·</span>
                        <span>Deadline: {format(new Date(c.filingDeadline), 'MMM d')}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full sm:w-32 flex-shrink-0">
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-primary' : 'bg-warning'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-body mt-1 text-right">{percent}%</p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      {isReady ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full text-[10px] font-bold">
                          Ready
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-warning/20 rounded-full text-[10px] font-bold">
                          {missing} missing
                        </Badge>
                      )}
                    </div>

                    {/* Generate button */}
                    <div className="flex-shrink-0">
                      {isReady ? (
                        <Button size="sm" className="gap-1.5 text-xs" onClick={e => { e.stopPropagation(); toast.success('Packet generation coming soon'); }}>
                          <Download className="w-3 h-3" /> Generate
                        </Button>
                      ) : (
                        <Button size="sm" disabled className="gap-1.5 text-xs bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted">
                          Not ready
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Packets;
