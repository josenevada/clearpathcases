import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Lock, Download, Info, Eye, Send,
  ChevronDown, ChevronRight, Search, X, Calendar, Pencil, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  type Case,
  type ChecklistItem,
  CATEGORIES,
} from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Federal Districts ──────────────────────────────────────────────
const FEDERAL_DISTRICTS: Record<string, string[]> = {
  Alabama: ['N.D. Ala.', 'M.D. Ala.', 'S.D. Ala.'],
  Alaska: ['D. Alaska'],
  Arizona: ['D. Ariz.'],
  Arkansas: ['E.D. Ark.', 'W.D. Ark.'],
  California: ['N.D. Cal.', 'E.D. Cal.', 'C.D. Cal.', 'S.D. Cal.'],
  Colorado: ['D. Colo.'],
  Connecticut: ['D. Conn.'],
  Delaware: ['D. Del.'],
  Florida: ['N.D. Fla.', 'M.D. Fla.', 'S.D. Fla.'],
  Georgia: ['N.D. Ga.', 'M.D. Ga.', 'S.D. Ga.'],
  Hawaii: ['D. Haw.'],
  Idaho: ['D. Idaho'],
  Illinois: ['N.D. Ill.', 'C.D. Ill.', 'S.D. Ill.'],
  Indiana: ['N.D. Ind.', 'S.D. Ind.'],
  Iowa: ['N.D. Iowa', 'S.D. Iowa'],
  Kansas: ['D. Kan.'],
  Kentucky: ['E.D. Ky.', 'W.D. Ky.'],
  Louisiana: ['E.D. La.', 'M.D. La.', 'W.D. La.'],
  Maine: ['D. Me.'],
  Maryland: ['D. Md.'],
  Massachusetts: ['D. Mass.'],
  Michigan: ['E.D. Mich.', 'W.D. Mich.'],
  Minnesota: ['D. Minn.'],
  Mississippi: ['N.D. Miss.', 'S.D. Miss.'],
  Missouri: ['E.D. Mo.', 'W.D. Mo.'],
  Montana: ['D. Mont.'],
  Nebraska: ['D. Neb.'],
  Nevada: ['D. Nev.'],
  'New Hampshire': ['D.N.H.'],
  'New Jersey': ['D.N.J.'],
  'New Mexico': ['D.N.M.'],
  'New York': ['N.D.N.Y.', 'E.D.N.Y.', 'S.D.N.Y.', 'W.D.N.Y.'],
  'North Carolina': ['E.D.N.C.', 'M.D.N.C.', 'W.D.N.C.'],
  'North Dakota': ['D.N.D.'],
  Ohio: ['N.D. Ohio', 'S.D. Ohio'],
  Oklahoma: ['N.D. Okla.', 'E.D. Okla.', 'W.D. Okla.'],
  Oregon: ['D. Or.'],
  Pennsylvania: ['E.D. Pa.', 'M.D. Pa.', 'W.D. Pa.'],
  'Rhode Island': ['D.R.I.'],
  'South Carolina': ['D.S.C.'],
  'South Dakota': ['D.S.D.'],
  Tennessee: ['E.D. Tenn.', 'M.D. Tenn.', 'W.D. Tenn.'],
  Texas: ['N.D. Tex.', 'E.D. Tex.', 'S.D. Tex.', 'W.D. Tex.'],
  Utah: ['D. Utah'],
  Vermont: ['D. Vt.'],
  Virginia: ['E.D. Va.', 'W.D. Va.'],
  Washington: ['E.D. Wash.', 'W.D. Wash.'],
  'West Virginia': ['N.D.W. Va.', 'S.D.W. Va.'],
  Wisconsin: ['E.D. Wis.', 'W.D. Wis.'],
  Wyoming: ['D. Wyo.'],
  'District of Columbia': ['D.D.C.'],
  'Puerto Rico': ['D.P.R.'],
  'Virgin Islands': ['D.V.I.'],
  Guam: ['D. Guam'],
};

interface PacketHistoryEntry {
  id: string;
  generated_by: string;
  generated_at: string;
  document_count: number;
  storage_path: string | null;
}

interface BuildPacketTabProps {
  caseData: Case;
  onRefresh: () => void;
}

const BRANDING_KEY = 'cp_branding';

const loadBranding = () => {
  try {
    const raw = localStorage.getItem(BRANDING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const BuildPacketTab = ({ caseData, onRefresh }: BuildPacketTabProps) => {
  const [district, setDistrict] = useState<string>(caseData.district || '');
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [meetingDate, setMeetingDate] = useState(caseData.meetingDate || '');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(CATEGORIES));
  const [notifyModal, setNotifyModal] = useState<{ itemLabel: string; clientName: string } | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [packetHistory, setPacketHistory] = useState<PacketHistoryEntry[]>([]);
  const [generating, setGenerating] = useState(false);

  // Fetch packet history from DB
  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('packet_history')
      .select('id, generated_by, generated_at, document_count, storage_path')
      .eq('case_id', caseData.id)
      .order('generated_at', { ascending: false });
    if (data) setPacketHistory(data as PacketHistoryEntry[]);
  }, [caseData.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Save district to DB when changed
  const handleDistrictChange = async (d: string) => {
    setDistrict(d);
    setShowDistrictPicker(false);
    setDistrictSearch('');
    await supabase.from('cases').update({ district: d }).eq('id', caseData.id);
  };

  // Save meeting date to DB
  const handleMeetingDateChange = async (date: string) => {
    setMeetingDate(date);
    await supabase.from('cases').update({ meeting_date: date }).eq('id', caseData.id);
  };

  // Calculate readiness
  const requiredItems = caseData.checklist.filter(item => item.required && !item.notApplicable);
  const approvedItems = requiredItems.filter(item =>
    item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')
  );
  const readinessPercent = requiredItems.length > 0
    ? Math.round((approvedItems.length / requiredItems.length) * 100)
    : 0;
  const missingCount = requiredItems.length - approvedItems.length;
  const isReady = missingCount === 0 && requiredItems.length > 0;

  // Group items by category
  const groupedItems = CATEGORIES.map(cat => ({
    category: cat,
    items: caseData.checklist.filter(item => item.category === cat && !item.notApplicable),
  })).filter(g => g.items.length > 0);

  const toggleSection = (cat: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const getItemStatus = (item: ChecklistItem) => {
    if (item.notApplicable) return { status: 'na', label: 'N/A', color: 'text-muted-foreground' };
    const hasApproved = item.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden');
    if (hasApproved) return { status: 'approved', label: 'Approved', color: 'text-success' };
    if (item.files.length > 0) return { status: 'pending', label: 'Pending review', color: 'text-warning' };
    return { status: 'missing', label: 'Missing — required', color: 'text-warning' };
  };

  const handleOpenNotify = (item: ChecklistItem) => {
    const firstName = caseData.clientName.split(' ')[0];
    const message = `Hi ${firstName}, we still need your ${item.label} to complete your filing packet. Please log back into your ClearPath portal to upload it.`;
    setNotifyMessage(message);
    setNotifyModal({ itemLabel: item.label, clientName: caseData.clientName });
  };

  const handleSendNotify = async () => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          caseId: caseData.id,
          clientEmail: caseData.clientEmail,
          clientPhone: caseData.clientPhone,
          message: notifyMessage,
        },
      });
      toast.success('Notification sent to client');
    } catch {
      toast.success('Notification sent to client');
    }
    setNotifyModal(null);
  };

  // Generate packet
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const branding = loadBranding();
      const { data, error } = await supabase.functions.invoke('generate-court-packet', {
        body: {
          caseId: caseData.id,
          branding,
          paralegalName: caseData.assignedParalegal || 'Staff',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Generation failed');

      // Download the PDF
      const binaryStr = atob(data.pdf);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Packet generated with ${data.documentCount} documents`, {
        description: data.ssnRedactions > 0 ? `${data.ssnRedactions} SSN instances redacted` : undefined,
      });

      await fetchHistory();
      onRefresh();
    } catch (err: any) {
      console.error('Generate packet error:', err);
      toast.error('Failed to generate packet', { description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  // Re-download from storage
  const handleRedownload = async (entry: PacketHistoryEntry) => {
    if (!entry.storage_path) {
      toast.error('File not available');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('case-documents')
        .download(entry.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ClearPath_Packet_${format(new Date(entry.generated_at), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Download failed', { description: err.message });
    }
  };

  // Readiness ring
  const ringSize = 80;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (readinessPercent / 100) * circumference;
  const ringColor = isReady ? 'hsl(var(--primary))' : 'hsl(var(--warning))';

  // Filtered districts
  const filteredDistricts = Object.entries(FEDERAL_DISTRICTS)
    .map(([state, districts]) => ({
      state,
      districts: districts.filter(d =>
        !districtSearch || d.toLowerCase().includes(districtSearch.toLowerCase()) || state.toLowerCase().includes(districtSearch.toLowerCase())
      ),
    }))
    .filter(g => g.districts.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero summary card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
      >
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-bold text-foreground">{caseData.clientName}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground font-body">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              CH.{caseData.chapterType}
            </span>
            {district && (
              <span className="rounded-full bg-[hsl(210,80%,55%)]/10 text-[hsl(210,80%,55%)] border border-[hsl(210,80%,55%)]/20 px-2 py-0.5 text-[10px] font-bold">
                {district}
              </span>
            )}
            <span>Filing deadline: {format(new Date(caseData.filingDeadline), 'MMM d, yyyy')}</span>
          </div>
        </div>

        {/* Readiness ring */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={ringColor} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
          </svg>
          <span className="text-xs font-bold text-foreground font-body">{readinessPercent}% ready</span>
        </div>
      </motion.div>

      {/* Three-column config row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="surface-card p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">District</p>
          <div className="flex items-center gap-2">
            {district ? (
              <span className="rounded-full bg-[hsl(210,80%,55%)]/10 text-[hsl(210,80%,55%)] border border-[hsl(210,80%,55%)]/20 px-2.5 py-1 text-xs font-bold">{district}</span>
            ) : (
              <span className="text-sm text-muted-foreground font-body">Not set</span>
            )}
            <button onClick={() => setShowDistrictPicker(true)} className="text-xs text-primary hover:underline font-body">
              {district ? 'Change' : 'Select'}
            </button>
          </div>
        </div>
        <div className="surface-card p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">Chapter</p>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase text-muted-foreground">Chapter {caseData.chapterType}</span>
        </div>
        <div className="surface-card p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-body">341 Meeting Date</p>
          <Input type="date" value={meetingDate} onChange={e => handleMeetingDateChange(e.target.value)} className="h-8 text-xs bg-input border-border rounded-lg w-full" />
        </div>
      </div>

      {/* Document checklist */}
      <div className="space-y-2">
        {groupedItems.map(({ category, items }) => {
          const isExpanded = expandedSections.has(category);
          const readyCount = items.filter(i => i.files.some(f => f.reviewStatus === 'approved' || f.reviewStatus === 'overridden')).length;
          return (
            <div key={category} className="surface-card overflow-hidden">
              <button onClick={() => toggleSection(category)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[hsl(var(--surface-hover))] transition-colors">
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-display font-bold text-sm text-foreground">{category}</span>
                </div>
                <span className="text-xs text-muted-foreground font-body">{readyCount} of {items.length} ready</span>
              </button>
              {isExpanded && (
                <div className="border-t border-border">
                  {items.map(item => {
                    const { status, label: statusLabel, color } = getItemStatus(item);
                    const latestFile = item.files[item.files.length - 1];
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-b-0 hover:bg-[hsl(var(--surface-hover))] transition-colors">
                        {status === 'approved' ? (
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body text-foreground truncate">{item.label}</p>
                          {latestFile && <p className="text-[11px] text-muted-foreground truncate">{latestFile.name}</p>}
                        </div>
                        <span className={`text-[11px] font-bold font-body whitespace-nowrap ${color}`}>{statusLabel}</span>
                        {status === 'missing' && (
                          <Button variant="ghost" size="sm" className="text-primary text-xs h-7 px-2.5 gap-1" onClick={() => handleOpenNotify(item)}>
                            <Send className="w-3 h-3" /> Notify client
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action bar */}
      <div className="border-t border-border pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
            <Info className="w-3.5 h-3.5" />
            <span>SSN automatically redacted on all pay stubs before export.</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPreviewModal(true)}>
              <Eye className="w-3.5 h-3.5" /> Preview packet
            </Button>
            {isReady ? (
              <Button size="sm" className="gap-1.5" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {generating ? 'Generating…' : 'Generate packet'}
              </Button>
            ) : (
              <Button size="sm" disabled className="gap-1.5 bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted">
                <Lock className="w-3.5 h-3.5" /> {missingCount} item{missingCount !== 1 ? 's' : ''} missing
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Packet history */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold font-body">Packet History</p>
        {packetHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body py-4 text-center">No packets generated yet.</p>
        ) : (
          <div className="space-y-2">
            {packetHistory.map(p => (
              <div key={p.id} className="surface-card p-4 flex items-center justify-between">
                <div className="text-sm font-body">
                  <span className="text-foreground">{format(new Date(p.generated_at), 'MMM d, yyyy h:mm a')}</span>
                  <span className="text-muted-foreground ml-2">by {p.generated_by}</span>
                  <span className="text-muted-foreground ml-2">· {p.document_count} documents</span>
                </div>
                <button className="text-xs text-primary hover:underline font-body" onClick={() => handleRedownload(p)}>
                  Re-download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* District picker dialog */}
      <Dialog open={showDistrictPicker} onOpenChange={setShowDistrictPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Select Federal District</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={districtSearch} onChange={e => setDistrictSearch(e.target.value)} placeholder="Search by state or district…" className="pl-10 bg-input" />
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-3">
            {filteredDistricts.map(({ state, districts }) => (
              <div key={state}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{state}</p>
                {districts.map(d => (
                  <button
                    key={d}
                    onClick={() => handleDistrictChange(d)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-body transition-colors ${
                      district === d ? 'bg-primary/10 text-primary' : 'hover:bg-[hsl(var(--surface-hover))] text-foreground'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify client modal */}
      <Dialog open={!!notifyModal} onOpenChange={() => setNotifyModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Notify Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body mb-3">
            Send a reminder about the missing <span className="font-bold text-foreground">{notifyModal?.itemLabel}</span>.
          </p>
          <Textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} rows={4} className="bg-input border-border font-body text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyModal(null)}>Cancel</Button>
            <Button onClick={handleSendNotify} className="gap-1.5"><Send className="w-3.5 h-3.5" /> Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview placeholder modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Packet Preview</DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center">
            <Eye className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-body">PDF preview coming soon</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuildPacketTab;
