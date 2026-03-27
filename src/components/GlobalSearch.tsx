import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FileText, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllCases, calculateProgress, type Case, type UploadedFile } from '@/lib/store';
import { format } from 'date-fns';

interface CaseResult {
  caseId: string;
  clientName: string;
  chapterType: string;
  urgency: string;
  progress: number;
  caseCode?: string;
}

interface DocumentResult {
  caseId: string;
  clientName: string;
  fileName: string;
  documentType: string;
  uploadedAt: string;
  checklistItemId: string;
  fileId: string;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const GlobalSearch = ({ open, onClose }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [caseResults, setCaseResults] = useState<CaseResult[]>([]);
  const [docResults, setDocResults] = useState<DocumentResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const cases = useMemo(() => getAllCases(), [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setCaseResults([]);
      setDocResults([]);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const performSearch = useCallback((term: string) => {
    if (!term.trim()) {
      setCaseResults([]);
      setDocResults([]);
      return;
    }
    const t = term.toLowerCase();

    const matchedCases: CaseResult[] = [];
    const matchedDocs: DocumentResult[] = [];

    for (const c of cases) {
      const nameMatch = c.clientName.toLowerCase().includes(t);
      const codeMatch = c.caseCode?.toLowerCase().includes(t);
      const courtMatch = c.courtCaseNumber?.toLowerCase().includes(t);

      if (nameMatch || codeMatch || courtMatch) {
        matchedCases.push({
          caseId: c.id,
          clientName: c.clientName,
          chapterType: c.chapterType,
          urgency: c.urgency,
          progress: calculateProgress(c),
          caseCode: c.caseCode,
        });
      }

      // Search checklist items and their files
      for (const item of c.checklist) {
        const labelMatch = item.label.toLowerCase().includes(t);

        if (labelMatch && !matchedCases.find(mc => mc.caseId === c.id)) {
          matchedCases.push({
            caseId: c.id,
            clientName: c.clientName,
            chapterType: c.chapterType,
            urgency: c.urgency,
            progress: calculateProgress(c),
            caseCode: c.caseCode,
          });
        }

        for (const file of item.files) {
          if (file.name.toLowerCase().includes(t) || labelMatch) {
            matchedDocs.push({
              caseId: c.id,
              clientName: c.clientName,
              fileName: file.name,
              documentType: item.label,
              uploadedAt: file.uploadedAt,
              checklistItemId: item.id,
              fileId: file.id,
            });
          }
        }
      }
    }

    setCaseResults(matchedCases);
    setDocResults(matchedDocs);
  }, [cases]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      if (caseResults.length > 0) {
        navigate(`/paralegal/case/${caseResults[0].caseId}`);
        onClose();
      } else if (docResults.length > 0) {
        navigate(`/paralegal/case/${docResults[0].caseId}?tab=documents&file=${docResults[0].fileId}`);
        onClose();
      }
    }
  };

  const hasResults = caseResults.length > 0 || docResults.length > 0;
  const hasQuery = query.trim().length > 0;

  const urgencyClass: Record<string, string> = {
    critical: 'urgency-critical',
    'at-risk': 'urgency-at-risk',
    normal: 'urgency-normal',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute left-0 right-0 top-full z-50 overflow-hidden border-b border-border bg-background shadow-lg"
        >
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search clients, cases, or documents…"
                className="pl-10 pr-10 bg-input border-border rounded-[10px]"
              />
              <button onClick={onClose} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {hasQuery && (
              <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background">
                {!hasResults ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results found for <span className="font-medium text-foreground">"{query}"</span>
                  </div>
                ) : (
                  <>
                    {caseResults.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cases</span>
                          <span className="text-xs text-muted-foreground">({caseResults.length})</span>
                        </div>
                        {caseResults.slice(0, 5).map(r => (
                          <button
                            key={r.caseId}
                            onClick={() => { navigate(`/paralegal/case/${r.caseId}`); onClose(); }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display font-bold text-sm text-foreground">{r.clientName}</span>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Ch.{r.chapterType}
                                </span>
                                <Badge className={`${urgencyClass[r.urgency] || ''} rounded-full px-2 py-0.5 text-xs`}>
                                  {r.urgency.replace('-', ' ')}
                                </Badge>
                              </div>
                              {r.caseCode && (
                                <span className="text-xs text-muted-foreground">{r.caseCode}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{r.progress}%</span>
                          </button>
                        ))}
                        {caseResults.length > 5 && (
                          <div className="px-4 py-2 text-xs text-primary cursor-pointer hover:underline border-b border-border">
                            View all {caseResults.length} results
                          </div>
                        )}
                      </div>
                    )}

                    {docResults.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Documents</span>
                          <span className="text-xs text-muted-foreground">({docResults.length})</span>
                        </div>
                        {docResults.slice(0, 5).map((r, i) => (
                          <button
                            key={`${r.fileId}-${i}`}
                            onClick={() => { navigate(`/paralegal/case/${r.caseId}?tab=documents&file=${r.fileId}`); onClose(); }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                          >
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-foreground truncate">{r.fileName}</span>
                              <span className="text-xs text-muted-foreground">
                                {r.documentType} · {r.clientName}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(r.uploadedAt), 'MMM d')}
                            </span>
                          </button>
                        ))}
                        {docResults.length > 5 && (
                          <div className="px-4 py-2 text-xs text-primary cursor-pointer hover:underline">
                            View all {docResults.length} results
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearch;
